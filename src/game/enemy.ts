/**
 * Articulated Multi-Class 3D Tactical Combat Enemies (GIS Shooter: Tactical Edition)
 * Classes:
 * - 'assault'    : Assault Trooper — dark titanium armor, red visor/chest core LED, pulse rifle
 * - 'juggernaut' : Heavy Juggernaut — 1.22x blast armor, heavy pauldrons, dual cannon, translucent Energy Shield
 * - 'drone'      : Speed Runner Drone — hovering recon chassis, glowing blue/orange thrusters, zig-zag evasion
 */

import * as THREE from 'three';
import { soundSystem } from '../audio/SoundSystem';
import { ArenaCollision } from './map';
import { createArmorWearTextures } from './textures';

export type AIState = 'patrol' | 'chase' | 'attack' | 'dying' | 'dead';
export type EnemyClass = 'assault' | 'juggernaut' | 'drone';
export type EnemyHitZone = 'body' | 'head' | 'shield';

let sharedHbTex: THREE.CanvasTexture | null = null;
let sharedHbGeo: THREE.PlaneGeometry | null = null;

function getSharedHealthBarTexture(): THREE.CanvasTexture {
  if (sharedHbTex) return sharedHbTex;
  const hbCanvas = document.createElement('canvas');
  hbCanvas.width = 64;
  hbCanvas.height = 8;
  const hbCtx = hbCanvas.getContext('2d')!;
  hbCtx.fillStyle = '#ef4444';
  hbCtx.fillRect(0, 0, 64, 8);
  sharedHbTex = new THREE.CanvasTexture(hbCanvas);
  sharedHbTex.colorSpace = THREE.SRGBColorSpace;
  return sharedHbTex;
}

function getSharedHealthBarGeo(): THREE.PlaneGeometry {
  if (sharedHbGeo) return sharedHbGeo;
  sharedHbGeo = new THREE.PlaneGeometry(0.85, 0.1);
  return sharedHbGeo;
}

export class EnemyBot {
  public id: string;
  public enemyClass: EnemyClass;
  public group: THREE.Group;
  public position: THREE.Vector3;
  public health: number;
  public maxHealth: number;
  public state: AIState = 'patrol';
  public isDead = false;

  // Articulated Body Parts
  private bodyPivot: THREE.Group;
  private headMesh: THREE.Mesh;
  private torsoMesh: THREE.Mesh;
  private leftLegPivot: THREE.Group | null = null;
  private rightLegPivot: THREE.Group | null = null;
  private rightArmPivot: THREE.Group | null = null;
  private leftArmPivot: THREE.Group | null = null;
  private gunMesh: THREE.Object3D;
  private shieldMat: THREE.MeshPhysicalMaterial | null = null;
  private thrusterFlames: THREE.Mesh[] = [];
  private healthBarMesh: THREE.Mesh;

  private hitFlashTimer = 0;
  private shieldFlashTimer = 0;
  private flinchTimer = 0;
  private flinchSide = 1;
  public stunTimer = 0;
  private walkCycle = Math.random() * Math.PI * 2;
  private hoverPhase = Math.random() * Math.PI * 2;
  private zigZagPhase = Math.random() * Math.PI * 2;
  private collapseProgress = 0;
  private fallDirection = Math.random() > 0.5 ? 1 : -1;

  // AI State Timers
  private patrolTarget: THREE.Vector3;
  private patrolWaitTimer = 0;
  private fireTimer = 0.6 + Math.random() * 0.8;
  private fireInterval: number;
  private strafeDir = Math.random() > 0.5 ? 1 : -1;
  private strafeTimer = 0;

  // Stats
  private moveSpeed: number;
  private attackRange = 26;
  private detectRange = 42;
  private damage: number;

  public hitMeshes: THREE.Mesh[] = [];

  // Pre-allocated scratch vectors (zero GC in loop)
  private _raycaster = new THREE.Raycaster();
  private _eyeOrigin = new THREE.Vector3();
  private _toPlayerDir = new THREE.Vector3();
  private _strafeVec = new THREE.Vector3();
  private _moveStep = new THREE.Vector3();
  private _gunMuzzle = new THREE.Vector3();
  private _aimTarget = new THREE.Vector3();

  constructor(
    id: string,
    spawnPos: THREE.Vector3,
    patrolNodes: THREE.Vector3[],
    wave = 1,
    enemyClass: EnemyClass = 'assault'
  ) {
    this.id = id;
    this.enemyClass = enemyClass;
    this.position = spawnPos.clone();

    if (enemyClass === 'juggernaut') {
      this.maxHealth = 210 + (wave - 1) * 38;
      this.moveSpeed = 2.7 + Math.min(1.2, wave * 0.14);
      this.fireInterval = Math.max(1.25, 2.2 - wave * 0.08);
      this.damage = Math.min(17, Math.max(5, Math.round((8 + wave * 1.1) * 0.68)));
    } else if (enemyClass === 'drone') {
      this.maxHealth = 65 + (wave - 1) * 14;
      this.moveSpeed = 5.75 + Math.min(2.6, wave * 0.28);
      this.fireInterval = Math.max(0.85, 1.5 - wave * 0.06);
      this.damage = Math.min(11, Math.max(3, Math.round((4.5 + wave * 0.8) * 0.6)));
    } else {
      this.maxHealth = 90 + (wave - 1) * 20;
      this.moveSpeed = 3.9 + Math.min(2.4, wave * 0.25);
      this.fireInterval = Math.max(1.05, 1.95 - wave * 0.08);
      this.damage = Math.min(14, Math.max(3, Math.round((6 + wave * 1) * 0.6)));
    }
    this.health = this.maxHealth;

    this.patrolTarget = patrolNodes[Math.floor(Math.random() * patrolNodes.length)].clone();

    // Root Group grounded at bottom-center (y = 0)
    this.group = new THREE.Group();
    this.group.name = `ENEMY_${id}`;
    this.group.position.copy(this.position);

    this.bodyPivot = new THREE.Group();
    this.group.add(this.bodyPivot);

    const { roughnessMap, bumpMap } = createArmorWearTextures();

    // Calibrated PBR Materials with procedural brushed metal roughness & bump maps
    const chassisMat = new THREE.MeshStandardMaterial({
      color: enemyClass === 'juggernaut' ? 0x222936 : enemyClass === 'drone' ? 0x1b2432 : 0x1e2634,
      roughness: 0.36,
      metalness: 0.86,
      roughnessMap,
      bumpMap,
      bumpScale: 0.008,
    });
    const armorVestMat = new THREE.MeshStandardMaterial({
      color: enemyClass === 'juggernaut' ? 0x92400e : enemyClass === 'drone' ? 0x0f4c5c : 0x881337,
      roughness: 0.48,
      metalness: 0.45,
      roughnessMap,
      bumpMap,
      bumpScale: 0.006,
    });
    const darkJointMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.72,
      metalness: 0.28,
    });
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0xff1e42,
      emissive: 0xff0033,
      emissiveIntensity: 2.0,
      roughness: 0.1,
    });
    const thrusterBlueMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 2.0,
      roughness: 0.12,
    });
    const thrusterOrangeMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.86,
    });

    if (enemyClass === 'drone') {
      // =========================================================
      // SPEED RUNNER / RECON DRONE (Hovering, Blue/Orange Thrusters)
      // =========================================================
      this.bodyPivot.position.y = 1.2;

      this.torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.28, 0.72), chassisMat);
      this.torsoMesh.castShadow = true;
      this.torsoMesh.name = 'ENEMY_BODY';
      this.bodyPivot.add(this.torsoMesh);

      const upperCowling = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.56), armorVestMat);
      upperCowling.position.set(0, 0.18, -0.04);
      upperCowling.name = 'ENEMY_BODY';
      this.torsoMesh.add(upperCowling);

      // Glowing Chest Reactor Core LED
      const coreLed = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 8), visorMat);
      coreLed.rotation.x = Math.PI / 2;
      coreLed.position.set(0, -0.02, 0.37);
      coreLed.name = 'ENEMY_BODY';
      this.torsoMesh.add(coreLed);

      // Forward Optic Sensor Head (2.5x Headshot Hitbox)
      this.headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), chassisMat);
      this.headMesh.position.set(0, 0.16, 0.34);
      this.headMesh.castShadow = true;
      this.headMesh.name = 'ENEMY_HEAD';
      this.bodyPivot.add(this.headMesh);

      const droneEye = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.08), visorMat);
      droneEye.position.set(0, 0, 0.16);
      droneEye.name = 'ENEMY_HEAD';
      this.headMesh.add(droneEye);

      // Swept Side Wings + Dual Thruster Pods (Blue Rings + Orange Exhaust Cones)
      [-1, 1].forEach((side) => {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.05, 0.34), armorVestMat);
        wing.position.set(side * 0.48, 0.02, -0.04);
        wing.rotation.z = side * -0.18;
        wing.rotation.y = side * -0.25;
        wing.name = 'ENEMY_BODY';
        this.torsoMesh.add(wing);

        const pod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11, 0.13, 0.34, 10).rotateX(Math.PI / 2),
          darkJointMat
        );
        pod.position.set(side * 0.56, 0.02, -0.22);
        pod.name = 'ENEMY_BODY';
        this.torsoMesh.add(pod);

        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.024, 8, 14), thrusterBlueMat);
        ring.position.set(side * 0.56, 0.02, -0.39);
        ring.name = 'ENEMY_BODY';
        this.torsoMesh.add(ring);

        const flame = new THREE.Mesh(
          new THREE.ConeGeometry(0.085, 0.34, 8).rotateX(-Math.PI / 2),
          thrusterOrangeMat
        );
        flame.position.set(side * 0.56, 0.02, -0.56);
        this.torsoMesh.add(flame);
        this.thrusterFlames.push(flame);
      });

      // Underslung Twin Rapid Blaster
      const blaster = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.055, 0.55, 8).rotateX(Math.PI / 2),
        darkJointMat
      );
      blaster.position.set(0, -0.2, 0.25);
      blaster.name = 'ENEMY_BODY';
      this.torsoMesh.add(blaster);

      const muzzleLed = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), visorMat);
      muzzleLed.position.set(0, -0.2, 0.54);
      this.torsoMesh.add(muzzleLed);
      this.gunMesh = muzzleLed;
    } else {
      // =========================================================
      // ASSAULT TROOPER & HEAVY JUGGERNAUT (Composite Humanoid Rig)
      // =========================================================
      const isJug = enemyClass === 'juggernaut';
      if (isJug) {
        this.bodyPivot.scale.setScalar(1.22);
      }

      // 1. Torso, Tactical Vest & Chest Reactor Core LED
      this.torsoMesh = new THREE.Mesh(
        new THREE.BoxGeometry(isJug ? 0.68 : 0.56, 0.72, isJug ? 0.44 : 0.36),
        chassisMat
      );
      this.torsoMesh.position.y = 1.24;
      this.torsoMesh.castShadow = true;
      this.torsoMesh.name = 'ENEMY_BODY';
      this.bodyPivot.add(this.torsoMesh);

      const chestPlate = new THREE.Mesh(
        new THREE.BoxGeometry(isJug ? 0.64 : 0.52, 0.48, isJug ? 0.48 : 0.41),
        armorVestMat
      );
      chestPlate.position.set(0, 0.07, 0.02);
      chestPlate.name = 'ENEMY_BODY';
      this.torsoMesh.add(chestPlate);

      // Glowing Chest Reactor Core LED
      const chestCore = new THREE.Mesh(
        new THREE.CylinderGeometry(isJug ? 0.08 : 0.055, isJug ? 0.08 : 0.055, 0.06, 8).rotateX(
          Math.PI / 2
        ),
        visorMat
      );
      chestCore.position.set(0, 0.1, isJug ? 0.25 : 0.215);
      chestCore.name = 'ENEMY_BODY';
      this.torsoMesh.add(chestCore);

      const waistBelt = new THREE.Mesh(
        new THREE.BoxGeometry(isJug ? 0.6 : 0.5, 0.14, isJug ? 0.4 : 0.34),
        darkJointMat
      );
      waistBelt.position.set(0, -0.28, 0);
      waistBelt.name = 'ENEMY_BODY';
      this.torsoMesh.add(waistBelt);

      const backpack = new THREE.Mesh(
        new THREE.BoxGeometry(isJug ? 0.48 : 0.38, 0.5, 0.22),
        darkJointMat
      );
      backpack.position.set(0, 0.05, isJug ? -0.3 : -0.25);
      backpack.name = 'ENEMY_BODY';
      this.torsoMesh.add(backpack);

      // 2. Sculpted Helmet & Glowing Optical Visor (Critical 2.5x Hitbox)
      this.headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.34, 0.37), chassisMat);
      this.headMesh.position.y = 1.82;
      this.headMesh.castShadow = true;
      this.headMesh.name = 'ENEMY_HEAD';
      this.bodyPivot.add(this.headMesh);

      const helmetCrest = new THREE.Mesh(
        new THREE.BoxGeometry(isJug ? 0.22 : 0.14, 0.09, 0.4),
        armorVestMat
      );
      helmetCrest.position.set(0, 0.19, 0);
      helmetCrest.name = 'ENEMY_HEAD';
      this.headMesh.add(helmetCrest);

      [-0.19, 0.19].forEach((ex) => {
        const earPod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8).rotateZ(Math.PI / 2), darkJointMat);
        earPod.position.set(ex, 0.02, 0);
        earPod.name = 'ENEMY_HEAD';
        this.headMesh.add(earPod);
      });

      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.09, 0.07), visorMat);
      visor.position.set(0, 0.03, 0.17);
      visor.name = 'ENEMY_HEAD';
      this.headMesh.add(visor);

      // 3. Left Arm, Shoulder Pauldron (+ Translucent Energy Shield for Juggernaut)
      const armOffsetX = isJug ? 0.46 : 0.38;
      const leftShoulder = new THREE.Mesh(
        new THREE.BoxGeometry(isJug ? 0.3 : 0.22, isJug ? 0.26 : 0.2, isJug ? 0.3 : 0.24),
        armorVestMat
      );
      leftShoulder.position.set(-armOffsetX, 1.48, 0);
      leftShoulder.name = 'ENEMY_BODY';
      this.bodyPivot.add(leftShoulder);

      this.leftArmPivot = new THREE.Group();
      this.leftArmPivot.position.set(-armOffsetX, 1.42, 0);
      this.bodyPivot.add(this.leftArmPivot);

      const leftArm = new THREE.Mesh(
        new THREE.BoxGeometry(isJug ? 0.19 : 0.15, 0.56, isJug ? 0.2 : 0.16),
        darkJointMat
      );
      leftArm.position.set(0, -0.22, 0.12);
      leftArm.rotation.x = isJug ? -0.75 : -0.35;
      leftArm.name = 'ENEMY_BODY';
      this.leftArmPivot.add(leftArm);

      if (isJug) {
        // Translucent Cyan Frontal Energy Shield (mitigates frontal body shots!)
        const shieldEmitter = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.18), darkJointMat);
        shieldEmitter.position.set(-0.08, -0.26, 0.32);
        shieldEmitter.name = 'ENEMY_BODY';
        this.leftArmPivot.add(shieldEmitter);

        this.shieldMat = new THREE.MeshPhysicalMaterial({
          color: 0x22d3ee,
          emissive: 0x0891b2,
          emissiveIntensity: 0.72,
          roughness: 0.08,
          metalness: 0.1,
          clearcoat: 1.0,
          transparent: true,
          opacity: 0.44,
          side: THREE.DoubleSide,
        });
        const energyShield = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.15, 0.05), this.shieldMat);
        energyShield.position.set(0.1, -0.18, 0.44);
        energyShield.rotation.y = 0.22;
        energyShield.name = 'ENEMY_SHIELD';
        this.leftArmPivot.add(energyShield);

        const shieldRim = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.07), thrusterBlueMat);
        shieldRim.position.set(0, 0.57, 0);
        shieldRim.name = 'ENEMY_SHIELD';
        energyShield.add(shieldRim);

        const shieldRimBot = shieldRim.clone();
        shieldRimBot.position.y = -0.57;
        shieldRimBot.name = 'ENEMY_SHIELD';
        energyShield.add(shieldRimBot);
      }

      // 4. Right Arm & Combat Weapon (Twin Autocannon for Juggernaut, Pulse Rifle for Assault)
      const rightShoulder = new THREE.Mesh(
        new THREE.BoxGeometry(isJug ? 0.3 : 0.22, isJug ? 0.26 : 0.2, isJug ? 0.3 : 0.24),
        armorVestMat
      );
      rightShoulder.position.set(armOffsetX, 1.48, 0);
      rightShoulder.name = 'ENEMY_BODY';
      this.bodyPivot.add(rightShoulder);

      this.rightArmPivot = new THREE.Group();
      this.rightArmPivot.position.set(armOffsetX, 1.42, 0);
      this.bodyPivot.add(this.rightArmPivot);

      const rightArm = new THREE.Mesh(
        new THREE.BoxGeometry(isJug ? 0.19 : 0.15, 0.52, isJug ? 0.2 : 0.16),
        darkJointMat
      );
      rightArm.position.set(0, -0.18, 0.18);
      rightArm.rotation.x = -Math.PI / 2.6;
      rightArm.name = 'ENEMY_BODY';
      this.rightArmPivot.add(rightArm);

      if (isJug) {
        const cannonBody = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.62), chassisMat);
        cannonBody.position.set(0, -0.22, 0.46);
        cannonBody.name = 'ENEMY_BODY';
        this.rightArmPivot.add(cannonBody);

        [-0.04, 0.04].forEach((bx) => {
          const bPipe = new THREE.Mesh(
            new THREE.CylinderGeometry(0.032, 0.035, 0.48, 8).rotateX(Math.PI / 2),
            darkJointMat
          );
          bPipe.position.set(bx, -0.22, 0.72);
          bPipe.name = 'ENEMY_BODY';
          this.rightArmPivot!.add(bPipe);
        });
        this.gunMesh = cannonBody;
      } else {
        const rifleMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.11, 0.52),
          darkJointMat
        );
        rifleMesh.position.set(0, -0.22, 0.42);
        rifleMesh.name = 'ENEMY_BODY';
        this.rightArmPivot.add(rifleMesh);

        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.028, 0.034, 0.36, 8).rotateX(Math.PI / 2),
          chassisMat
        );
        barrel.position.set(0, -0.21, 0.7);
        barrel.name = 'ENEMY_BODY';
        this.rightArmPivot.add(barrel);
        this.gunMesh = barrel;
      }

      const gunTip = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), visorMat);
      gunTip.position.set(0, -0.22, isJug ? 0.96 : 0.89);
      this.rightArmPivot.add(gunTip);

      // 5. Articulated Legs (Hip Pivot -> Thigh -> Knee Guard -> Shin/Boot)
      const createLeg = (xOffset: number): THREE.Group => {
        const legPivot = new THREE.Group();
        legPivot.position.set(xOffset, 0.88, 0);

        const thigh = new THREE.Mesh(
          new THREE.BoxGeometry(isJug ? 0.23 : 0.19, 0.44, isJug ? 0.25 : 0.22),
          chassisMat
        );
        thigh.position.y = -0.22;
        thigh.castShadow = true;
        thigh.name = 'ENEMY_BODY';
        legPivot.add(thigh);

        const knee = new THREE.Mesh(
          new THREE.BoxGeometry(isJug ? 0.2 : 0.17, 0.12, 0.08),
          armorVestMat
        );
        knee.position.set(0, -0.44, 0.11);
        knee.name = 'ENEMY_BODY';
        legPivot.add(knee);

        const shin = new THREE.Mesh(
          new THREE.BoxGeometry(isJug ? 0.2 : 0.16, 0.44, isJug ? 0.23 : 0.2),
          darkJointMat
        );
        shin.position.y = -0.66;
        shin.castShadow = true;
        shin.name = 'ENEMY_BODY';
        legPivot.add(shin);

        const boot = new THREE.Mesh(
          new THREE.BoxGeometry(isJug ? 0.22 : 0.18, 0.12, 0.32),
          armorVestMat
        );
        boot.position.set(0, -0.82, 0.05);
        boot.name = 'ENEMY_BODY';
        legPivot.add(boot);

        return legPivot;
      };

      this.leftLegPivot = createLeg(isJug ? -0.19 : -0.16);
      this.rightLegPivot = createLeg(isJug ? 0.19 : 0.16);
      this.bodyPivot.add(this.leftLegPivot);
      this.bodyPivot.add(this.rightLegPivot);
    }

    // 6. Floating Overhead Health Bar (shared texture & plane geometry)
    const hbMat = new THREE.MeshBasicMaterial({
      map: getSharedHealthBarTexture(),
      side: THREE.DoubleSide,
      depthTest: false,
    });
    this.healthBarMesh = new THREE.Mesh(getSharedHealthBarGeo(), hbMat);
    this.healthBarMesh.position.y =
      enemyClass === 'juggernaut' ? 2.68 : enemyClass === 'drone' ? 2.02 : 2.28;
    this.healthBarMesh.renderOrder = 999;
    this.group.add(this.healthBarMesh);

    this.group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child !== this.healthBarMesh) {
        this.hitMeshes.push(child as THREE.Mesh);
      }
    });
  }

  public takeDamage(
    dmg: number,
    hitZone: boolean | EnemyHitZone = false,
    headshotMultiplier = 2.5
  ): { isDead: boolean; isHeadshot: boolean; hitShield: boolean; actualDmg: number } {
    const isHeadshot = hitZone === true || hitZone === 'head';
    const hitShield = hitZone === 'shield';

    if (this.isDead || this.state === 'dying') {
      return { isDead: true, isHeadshot, hitShield, actualDmg: 0 };
    }

    let actualDmg = dmg;
    if (isHeadshot) {
      actualDmg = Math.round(dmg * headshotMultiplier);
    } else if (hitShield) {
      actualDmg = Math.max(1, Math.round(dmg * 0.45));
      this.shieldFlashTimer = 0.16;
    }

    this.health -= actualDmg;
    if (!hitShield) {
      this.hitFlashTimer = 0.14;
    }
    this.flinchTimer = hitShield ? 0.09 : 0.18;
    this.flinchSide = Math.random() > 0.5 ? 1 : -1;

    soundSystem.playHitmarker(isHeadshot);

    const ratio = Math.max(0, this.health / this.maxHealth);
    this.healthBarMesh.scale.x = ratio;
    this.healthBarMesh.position.x = -(1 - ratio) * 0.425;

    if (this.state === 'patrol') {
      this.state = 'chase';
    }

    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
      this.state = 'dying';
      this.healthBarMesh.visible = false;
      soundSystem.playEnemyKilled();
      return { isDead: true, isHeadshot, hitShield, actualDmg };
    }

    return { isDead: false, isHeadshot, hitShield, actualDmg };
  }

  public stun(duration: number) {
    if (this.isDead || this.state === 'dying') return;
    this.stunTimer = Math.max(this.stunTimer, duration);
  }

  private hasLineOfSight(playerPos: THREE.Vector3, obstacleMeshes: THREE.Object3D[]): boolean {
    const eyeH = this.enemyClass === 'juggernaut' ? 2.05 : this.enemyClass === 'drone' ? 1.35 : 1.7;
    this._eyeOrigin.set(this.position.x, this.position.y + eyeH, this.position.z);
    this._toPlayerDir.subVectors(playerPos, this._eyeOrigin);
    const dist = this._toPlayerDir.length();
    if (dist < 0.5) return true;
    this._toPlayerDir.divideScalar(dist);

    this._raycaster.set(this._eyeOrigin, this._toPlayerDir);
    this._raycaster.far = dist - 0.5;
    const hits = this._raycaster.intersectObjects(obstacleMeshes, false);
    return hits.length === 0;
  }

  public update(
    delta: number,
    playerPos: THREE.Vector3,
    patrolNodes: THREE.Vector3[],
    collisions: ArenaCollision[],
    obstacleMeshes: THREE.Object3D[],
    camera: THREE.Camera,
    onShootPlayer: (from: THREE.Vector3, to: THREE.Vector3, dmg: number) => void
  ) {
    // Collapse / Crash animation upon elimination
    if (this.state === 'dying') {
      this.collapseProgress += delta * (this.enemyClass === 'drone' ? 2.1 : 2.4);
      const t = Math.min(1, this.collapseProgress);
      if (this.enemyClass === 'drone') {
        this.bodyPivot.rotation.y += delta * 11;
        this.bodyPivot.rotation.z = t * 1.15 * this.fallDirection;
        this.bodyPivot.position.y = THREE.MathUtils.lerp(1.2, 0.16, t);
      } else {
        this.bodyPivot.rotation.x = t * (Math.PI / 2) * this.fallDirection;
        this.bodyPivot.position.y = -t * 0.65;
      }
      if (t >= 1) {
        this.state = 'dead';
      }
      return;
    }

    if (this.state === 'dead' || this.isDead) return;

    this.healthBarMesh.quaternion.copy(camera.quaternion);

    // Thruster flame flicker on Recon Drone
    if (this.thrusterFlames.length > 0) {
      this.hoverPhase += delta * 6.5;
      const flicker = 0.8 + Math.sin(this.hoverPhase * 5.2) * 0.25;
      for (let i = 0; i < this.thrusterFlames.length; i++) {
        this.thrusterFlames[i].scale.set(1, flicker, 1);
      }
    }

    // Shield hit flare feedback (Juggernaut)
    if (this.shieldMat) {
      if (this.shieldFlashTimer > 0) {
        this.shieldFlashTimer -= delta;
        this.shieldMat.emissive.setHex(0xe0f2fe);
        this.shieldMat.emissiveIntensity = 1.9;
        this.shieldMat.opacity = 0.72;
      } else {
        this.shieldMat.emissive.setHex(0x0891b2);
        this.shieldMat.emissiveIntensity = 0.72;
        this.shieldMat.opacity = 0.44;
      }
    }

    // Hit flash & stun daze visual feedback
    const torsoMat = this.torsoMesh.material as THREE.MeshStandardMaterial;
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      torsoMat.emissive.setHex(0xffffff);
      torsoMat.emissiveIntensity = 0.85;
    } else if (this.stunTimer > 0) {
      this.stunTimer = Math.max(0, this.stunTimer - delta);
      torsoMat.emissive.setHex(0x38bdf8);
      torsoMat.emissiveIntensity = 0.35 + 0.35 * Math.sin(this.stunTimer * 28);
      this.headMesh.rotation.y = Math.sin(this.stunTimer * 12) * 0.42;
      this.headMesh.rotation.z = Math.cos(this.stunTimer * 9) * 0.16;
      if (this.leftLegPivot && this.rightLegPivot) {
        this.leftLegPivot.rotation.x = THREE.MathUtils.damp(this.leftLegPivot.rotation.x, 0, 10, delta);
        this.rightLegPivot.rotation.x = THREE.MathUtils.damp(this.rightLegPivot.rotation.x, 0, 10, delta);
      }
      return;
    } else {
      torsoMat.emissive.setHex(0x000000);
      torsoMat.emissiveIntensity = 0;
      this.headMesh.rotation.y = THREE.MathUtils.damp(this.headMesh.rotation.y, 0, 10, delta);
      this.headMesh.rotation.z = THREE.MathUtils.damp(this.headMesh.rotation.z, 0, 10, delta);
    }

    // Smooth hit flinch decay
    if (this.flinchTimer > 0) {
      this.flinchTimer = Math.max(0, this.flinchTimer - delta);
    }
    const flinchFactor = this.flinchTimer / 0.18;

    const distToPlayer = this.position.distanceTo(playerPos);
    const hasLOS = distToPlayer <= this.detectRange && this.hasLineOfSight(playerPos, obstacleMeshes);

    if (hasLOS && distToPlayer <= this.attackRange) {
      this.state = 'attack';
    } else if (distToPlayer <= this.detectRange && (hasLOS || this.state !== 'patrol')) {
      this.state = 'chase';
    } else if (distToPlayer > this.detectRange * 1.25) {
      this.state = 'patrol';
    }

    let isMoving = false;
    let lateralBank = 0;

    if (this.state === 'patrol') {
      this._moveStep.subVectors(this.patrolTarget, this.position);
      this._moveStep.y = 0;
      const tDist = this._moveStep.length();

      if (tDist < 1.5) {
        this.patrolWaitTimer += delta;
        if (this.patrolWaitTimer > 1.8) {
          this.patrolWaitTimer = 0;
          this.patrolTarget.copy(patrolNodes[Math.floor(Math.random() * patrolNodes.length)]);
        }
      } else {
        isMoving = true;
        this._moveStep.divideScalar(tDist).multiplyScalar(this.moveSpeed * 0.65 * delta);
        this.moveWithCollision(this._moveStep, collisions);
        const angle = Math.atan2(this._moveStep.x, this._moveStep.z);
        this.group.rotation.y = THREE.MathUtils.damp(this.group.rotation.y, angle, 6, delta);
      }
    } else if (this.state === 'chase') {
      isMoving = true;
      this._moveStep.subVectors(playerPos, this.position);
      this._moveStep.y = 0;
      this._moveStep.normalize();

      // Speed Runner Drone weaves in a fast zig-zag approach
      if (this.enemyClass === 'drone') {
        this.zigZagPhase += delta * 4.8;
        const zig = Math.sin(this.zigZagPhase);
        lateralBank = -zig * 0.34;
        this._strafeVec.set(-this._moveStep.z, 0, this._moveStep.x).multiplyScalar(zig * 0.72);
        this._moveStep.add(this._strafeVec).normalize();
      }

      this._moveStep.multiplyScalar(this.moveSpeed * delta);
      this.moveWithCollision(this._moveStep, collisions);

      const angle = Math.atan2(this._moveStep.x, this._moveStep.z);
      this.group.rotation.y = THREE.MathUtils.damp(this.group.rotation.y, angle, 9, delta);
    } else if (this.state === 'attack') {
      // Face player
      const dx = playerPos.x - this.position.x;
      const dz = playerPos.z - this.position.z;
      const angle = Math.atan2(dx, dz);
      this.group.rotation.y = THREE.MathUtils.damp(this.group.rotation.y, angle, 12, delta);

      // Tactical lateral strafing (drones flip faster in zig-zag loops)
      this.strafeTimer += delta;
      const flipPeriod = this.enemyClass === 'drone' ? 0.85 : 1.6 + Math.random() * 0.8;
      if (this.strafeTimer > flipPeriod) {
        this.strafeTimer = 0;
        this.strafeDir *= -1;
      }

      const strafeScale = this.enemyClass === 'drone' ? 0.92 : 0.68;
      lateralBank = -this.strafeDir * (this.enemyClass === 'drone' ? 0.36 : 0);
      this._strafeVec
        .set(-dz, 0, dx)
        .normalize()
        .multiplyScalar(this.strafeDir * this.moveSpeed * strafeScale * delta);
      const moved = this.moveWithCollision(this._strafeVec, collisions);
      if (!moved) {
        this.strafeDir *= -1;
      } else {
        isMoving = true;
      }

      // Fire when LOS is clear
      this.fireTimer -= delta;
      if (this.fireTimer <= 0 && hasLOS) {
        this.fireTimer = this.fireInterval;
        soundSystem.playEnemyShot();

        this.gunMesh.getWorldPosition(this._gunMuzzle);
        this._aimTarget.set(
          playerPos.x + (Math.random() - 0.5) * 1.45,
          playerPos.y - 0.15 + (Math.random() - 0.5) * 0.75,
          playerPos.z + (Math.random() - 0.5) * 1.45
        );
        onShootPlayer(this._gunMuzzle, this._aimTarget, this.damage);
      }
    }

    // Procedural Motion & Hit Flinch
    if (this.enemyClass === 'drone') {
      this.bodyPivot.position.y = 1.2 + Math.sin(this.hoverPhase) * 0.14;
      this.bodyPivot.rotation.z = THREE.MathUtils.damp(
        this.bodyPivot.rotation.z,
        lateralBank + flinchFactor * 0.22 * this.flinchSide,
        10,
        delta
      );
      this.bodyPivot.rotation.x = THREE.MathUtils.damp(
        this.bodyPivot.rotation.x,
        (isMoving ? 0.18 : 0.04) - flinchFactor * 0.24,
        10,
        delta
      );
    } else if (this.leftLegPivot && this.rightLegPivot) {
      const strideSpeed = this.enemyClass === 'juggernaut' ? 6.5 : this.state === 'chase' ? 11 : 8;
      if (isMoving) {
        this.walkCycle += delta * strideSpeed;
        const swing = Math.sin(this.walkCycle) * (this.enemyClass === 'juggernaut' ? 0.36 : 0.52);
        this.leftLegPivot.rotation.x = swing;
        this.rightLegPivot.rotation.x = -swing;
        this.bodyPivot.position.y = Math.abs(Math.cos(this.walkCycle)) * 0.05;
      } else {
        this.leftLegPivot.rotation.x = THREE.MathUtils.damp(this.leftLegPivot.rotation.x, 0, 10, delta);
        this.rightLegPivot.rotation.x = THREE.MathUtils.damp(this.rightLegPivot.rotation.x, 0, 10, delta);
        this.bodyPivot.position.y = THREE.MathUtils.damp(this.bodyPivot.position.y, 0, 10, delta);
      }
      this.bodyPivot.rotation.x = THREE.MathUtils.damp(
        this.bodyPivot.rotation.x,
        -flinchFactor * 0.22,
        14,
        delta
      );
      this.torsoMesh.rotation.y = THREE.MathUtils.damp(
        this.torsoMesh.rotation.y,
        flinchFactor * 0.28 * this.flinchSide,
        14,
        delta
      );
    }
  }

  private moveWithCollision(step: THREE.Vector3, collisions: ArenaCollision[]): boolean {
    const nextX = this.position.x + step.x;
    const nextZ = this.position.z + step.z;
    const botRadius = this.enemyClass === 'juggernaut' ? 0.72 : 0.55;

    let canMoveX = true;
    let canMoveZ = true;

    for (let i = 0; i < collisions.length; i++) {
      const c = collisions[i];
      if (c.type === 'ramp') continue;
      if (c.box.min.y > 2.2) continue;

      const minX = c.box.min.x - botRadius;
      const maxX = c.box.max.x + botRadius;
      const minZ = c.box.min.z - botRadius;
      const maxZ = c.box.max.z + botRadius;

      if (nextX >= minX && nextX <= maxX && this.position.z >= minZ && this.position.z <= maxZ) {
        canMoveX = false;
      }
      if (this.position.x >= minX && this.position.x <= maxX && nextZ >= minZ && nextZ <= maxZ) {
        canMoveZ = false;
      }
    }

    if (canMoveX) this.position.x = nextX;
    if (canMoveZ) this.position.z = nextZ;

    this.group.position.x = this.position.x;
    this.group.position.z = this.position.z;
    return canMoveX || canMoveZ;
  }
}
