/**
 * Wave 10 Boss Entity: "The Specialist Anestesi"
 * Composite 3D Masked Doctor Model with:
 * - Tattered bio-stained white surgical lab coat
 * - Black tactical medical mask + protective goggles with glowing crimson eyes
 * - Glowing emerald dorsal anesthetic fluid tank (ENEMY_WEAKSPOT: 2.2x Critical Damage)
 * - Giant high-pressure Syringe Blaster (right arm) & Laser Scalpel (left arm)
 * - 3 Attack Patterns: Syringe Dart Barrage (slow), Anesthetic Gas Cloud (area DoT), Scalpel Rush
 */

import * as THREE from 'three';
import { soundSystem } from '../audio/SoundSystem';
import { ArenaCollision } from './map';

let cachedLabCoatTex: THREE.CanvasTexture | null = null;

function getLabCoatTexture(): THREE.CanvasTexture {
  if (cachedLabCoatTex) return cachedLabCoatTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  // Base clinical white coat
  ctx.fillStyle = '#dce3ec';
  ctx.fillRect(0, 0, 256, 256);

  // Tattered seams & grime
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, 236, 236);
  ctx.beginPath();
  ctx.moveTo(128, 12);
  ctx.lineTo(128, 244);
  ctx.stroke();

  // Tactical cyan/emerald chemical fluid splatters
  const blobs = [
    [55, 165, 22, 'rgba(16, 185, 129, 0.55)'],
    [188, 140, 28, 'rgba(6, 182, 212, 0.45)'],
    [95, 210, 18, 'rgba(185, 28, 28, 0.52)'],
    [172, 205, 24, 'rgba(16, 185, 129, 0.48)'],
    [68, 86, 14, 'rgba(185, 28, 28, 0.42)'],
  ] as const;
  blobs.forEach(([bx, by, r, col]) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Ragged hem slashes
  ctx.fillStyle = '#1e293b';
  for (let x = 0; x < 256; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 256);
    ctx.lineTo(x + 14, 234 - (x % 3) * 6);
    ctx.lineTo(x + 28, 256);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedLabCoatTex = tex;
  return tex;
}

export type BossHitZone = 'body' | 'head' | 'weakspot';
export type BossAttackMode = 'barrage' | 'gas' | 'rush_telegraph' | 'rush_lunge' | 'stalk';

export interface BossCallbacks {
  onFireSyringeDart: (origin: THREE.Vector3, dir: THREE.Vector3) => void;
  onSpawnGasCloud: (targetPos: THREE.Vector3) => void;
  onScalpelStrike: (damage: number) => void;
}

export class BossSpecialist {
  public id = 'THE SPECIALIST';
  public displayName = 'THE SPECIALIST ANESTESI';
  public group: THREE.Group;
  public position: THREE.Vector3;
  public health: number;
  public maxHealth: number;
  public isDead = false;
  public isDying = false;
  public attackMode: BossAttackMode = 'stalk';
  public attackLabel = 'SYRINGE BARRAGE READY';
  public stunTimer = 0;

  private bodyPivot: THREE.Group;
  private torsoMesh: THREE.Mesh;
  private headMesh: THREE.Mesh;
  private leftArmPivot: THREE.Group;
  private rightArmPivot: THREE.Group;
  private leftLegPivot: THREE.Group;
  private rightLegPivot: THREE.Group;
  private syringeMuzzle: THREE.Object3D;
  private weakspotTankMat: THREE.MeshStandardMaterial;
  private coatMat: THREE.MeshStandardMaterial;
  private scalpelBladeMat: THREE.MeshStandardMaterial;
  private redEyeMat: THREE.MeshStandardMaterial;

  private hitFlashTimer = 0;
  private walkCycle = 0;
  private collapseProgress = 0;
  private strafeDir = 1;
  private strafeTimer = 0;

  // Attack pattern timers
  private barrageCooldown = 1.8;
  private barrageBurstLeft = 0;
  private barrageBurstTimer = 0;
  private gasCooldown = 5.5;
  private rushCooldown = 6.0;
  private rushTimer = 0;
  private rushDir = new THREE.Vector3();
  private rushHitDealt = false;

  public hitMeshes: THREE.Mesh[] = [];

  // Scratch vectors
  private _raycaster = new THREE.Raycaster();
  private _eyeOrigin = new THREE.Vector3();
  private _toPlayer = new THREE.Vector3();
  private _strafeVec = new THREE.Vector3();
  private _moveStep = new THREE.Vector3();
  private _muzzleWorld = new THREE.Vector3();
  private _aimDir = new THREE.Vector3();
  private _forwardFlat = new THREE.Vector3();
  private _moveVec = new THREE.Vector3();
  private _gasTarget = new THREE.Vector3();

  constructor(spawnPos: THREE.Vector3) {
    this.position = spawnPos.clone();
    this.position.y = 0;
    this.maxHealth = 2200;
    this.health = this.maxHealth;

    this.group = new THREE.Group();
    this.group.name = 'ENEMY_BOSS_SPECIALIST';
    this.group.position.copy(this.position);

    this.bodyPivot = new THREE.Group();
    this.bodyPivot.scale.setScalar(1.36); // Tall imposing ~2.45m silhouette
    this.group.add(this.bodyPivot);

    this.coatMat = new THREE.MeshStandardMaterial({
      map: getLabCoatTexture(),
      roughness: 0.72,
      metalness: 0.08,
    });
    const scrubsMat = new THREE.MeshStandardMaterial({
      color: 0x134e4a,
      roughness: 0.75,
      metalness: 0.1,
    });
    const maskMat = new THREE.MeshStandardMaterial({
      color: 0x0b0f17,
      roughness: 0.85,
      metalness: 0.1,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.22,
      metalness: 0.9,
    });
    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.8,
    });
    this.redEyeMat = new THREE.MeshStandardMaterial({
      color: 0xff1e42,
      emissive: 0xff0033,
      emissiveIntensity: 3.2,
      roughness: 0.1,
    });
    this.weakspotTankMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x00ffaa,
      emissiveIntensity: 2.2,
      roughness: 0.15,
      metalness: 0.2,
    });
    this.scalpelBladeMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xff1e42,
      emissiveIntensity: 2.4,
      roughness: 0.12,
      metalness: 0.7,
    });

    // 1. Torso & Tattered Lab Coat
    this.torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.38), this.coatMat);
    this.torsoMesh.position.y = 1.24;
    this.torsoMesh.castShadow = true;
    this.torsoMesh.name = 'ENEMY_BODY';
    this.bodyPivot.add(this.torsoMesh);

    const coatSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.44, 0.56, 10, 1, true),
      this.coatMat
    );
    coatSkirt.position.y = -0.52;
    coatSkirt.name = 'ENEMY_BODY';
    this.torsoMesh.add(coatSkirt);

    const chestHarness = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.44, 0.41), darkMetalMat);
    chestHarness.position.set(0, 0.08, 0);
    chestHarness.name = 'ENEMY_BODY';
    this.torsoMesh.add(chestHarness);

    // 2. Dorsal Weakspot: Pressurized Anesthetic Fluid Canister Rig (2.2x Critical)
    const tankRig = new THREE.Group();
    tankRig.position.set(0, 0.1, -0.28);
    this.torsoMesh.add(tankRig);

    const tankFrame = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.14), darkMetalMat);
    tankFrame.name = 'ENEMY_WEAKSPOT';
    tankRig.add(tankFrame);

    [-0.12, 0.12].forEach((tx) => {
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.095, 0.52, 12),
        this.weakspotTankMat
      );
      tank.position.set(tx, 0.02, -0.06);
      tank.name = 'ENEMY_WEAKSPOT';
      tankRig.add(tank);

      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.08, 10), chromeMat);
      cap.position.set(tx, 0.3, -0.06);
      cap.name = 'ENEMY_WEAKSPOT';
      tankRig.add(cap);
    });

    // 3. Head, Black Medical Mask & Glowing Crimson Eyes Behind Protective Goggles
    this.headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.35), scrubsMat);
    this.headMesh.position.y = 1.84;
    this.headMesh.castShadow = true;
    this.headMesh.name = 'ENEMY_HEAD';
    this.bodyPivot.add(this.headMesh);

    const surgicalCap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.13, 0.37), scrubsMat);
    surgicalCap.position.set(0, 0.16, 0);
    surgicalCap.name = 'ENEMY_HEAD';
    this.headMesh.add(surgicalCap);

    // Black tactical surgical mask covering lower face
    const blackMask = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.24), maskMat);
    blackMask.position.set(0, -0.08, 0.08);
    blackMask.name = 'ENEMY_HEAD';
    this.headMesh.add(blackMask);

    // Protective goggle frame + glowing red eyes
    const goggleFrame = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.1, 0.08), darkMetalMat);
    goggleFrame.position.set(0, 0.04, 0.16);
    goggleFrame.name = 'ENEMY_HEAD';
    this.headMesh.add(goggleFrame);

    [-0.08, 0.08].forEach((ex) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 10), this.redEyeMat);
      eye.position.set(ex, 0.04, 0.195);
      eye.name = 'ENEMY_HEAD';
      this.headMesh.add(eye);
    });

    const headlamp = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 10).rotateX(Math.PI / 2), chromeMat);
    headlamp.position.set(0, 0.14, 0.19);
    headlamp.name = 'ENEMY_HEAD';
    this.headMesh.add(headlamp);

    // 4. Right Arm: Giant High-Pressure Syringe Blaster
    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.42, 1.44, 0);
    this.bodyPivot.add(this.rightArmPivot);

    const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.52, 0.16), this.coatMat);
    rArm.position.set(0, -0.18, 0.18);
    rArm.rotation.x = -Math.PI / 2.5;
    rArm.name = 'ENEMY_BODY';
    this.rightArmPivot.add(rArm);

    const syringeGroup = new THREE.Group();
    syringeGroup.position.set(0, -0.22, 0.55);
    this.rightArmPivot.add(syringeGroup);

    const blasterHousing = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.48), darkMetalMat);
    blasterHousing.name = 'ENEMY_BODY';
    syringeGroup.add(blasterHousing);

    const vialChamber = new THREE.Mesh(
      new THREE.CylinderGeometry(0.072, 0.072, 0.44, 12).rotateX(Math.PI / 2),
      this.weakspotTankMat
    );
    vialChamber.position.set(0, 0.04, 0.28);
    vialChamber.name = 'ENEMY_BODY';
    syringeGroup.add(vialChamber);

    const needleBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.032, 0.46, 10).rotateX(Math.PI / 2),
      chromeMat
    );
    needleBarrel.position.set(0, 0.04, 0.68);
    needleBarrel.name = 'ENEMY_BODY';
    syringeGroup.add(needleBarrel);

    this.syringeMuzzle = new THREE.Object3D();
    this.syringeMuzzle.position.set(0, 0.04, 0.94);
    syringeGroup.add(this.syringeMuzzle);

    // 5. Left Arm: Glowing Laser Scalpel for Rush Attacks
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.42, 1.44, 0);
    this.bodyPivot.add(this.leftArmPivot);

    const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.52, 0.16), this.coatMat);
    lArm.position.set(0, -0.2, 0.16);
    lArm.rotation.x = -0.7;
    lArm.name = 'ENEMY_BODY';
    this.leftArmPivot.add(lArm);

    const scalpelHandle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.28), darkMetalMat);
    scalpelHandle.position.set(0, -0.34, 0.36);
    scalpelHandle.name = 'ENEMY_BODY';
    this.leftArmPivot.add(scalpelHandle);

    const scalpelBlade = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.09, 0.68), this.scalpelBladeMat);
    scalpelBlade.position.set(0, -0.34, 0.78);
    scalpelBlade.name = 'ENEMY_BODY';
    this.leftArmPivot.add(scalpelBlade);

    // 6. Articulated Legs
    const buildLeg = (xOff: number): THREE.Group => {
      const lp = new THREE.Group();
      lp.position.set(xOff, 0.86, 0);
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.44, 0.22), scrubsMat);
      thigh.position.y = -0.22;
      thigh.castShadow = true;
      thigh.name = 'ENEMY_BODY';
      lp.add(thigh);
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.44, 0.21), darkMetalMat);
      shin.position.y = -0.66;
      shin.castShadow = true;
      shin.name = 'ENEMY_BODY';
      lp.add(shin);
      return lp;
    };
    this.leftLegPivot = buildLeg(-0.18);
    this.rightLegPivot = buildLeg(0.18);
    this.bodyPivot.add(this.leftLegPivot);
    this.bodyPivot.add(this.rightLegPivot);

    this.group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        this.hitMeshes.push(child as THREE.Mesh);
      }
    });
  }

  public takeDamage(
    dmg: number,
    zone: BossHitZone,
    headMultiplier = 2.0
  ): { isDead: boolean; isCrit: boolean; actualDmg: number } {
    if (this.isDead || this.isDying) {
      return { isDead: true, isCrit: zone !== 'body', actualDmg: 0 };
    }

    const mult = zone === 'weakspot' ? Math.max(2.2, headMultiplier) : zone === 'head' ? headMultiplier : 1.0;
    const actualDmg = Math.round(dmg * mult);
    this.health = Math.max(0, this.health - actualDmg);
    this.hitFlashTimer = 0.12;
    soundSystem.playHitmarker(zone !== 'body');

    if (this.health <= 0) {
      this.isDead = true;
      this.isDying = true;
      soundSystem.playEnemyKilled();
    }

    return { isDead: this.isDead, isCrit: zone !== 'body', actualDmg };
  }

  public stun(duration: number) {
    if (this.isDead || this.isDying) return;
    // Boss resists full stun duration (1.4s max)
    this.stunTimer = Math.max(this.stunTimer, Math.min(1.4, duration * 0.56));
  }

  public setCutscenePose(mode: 'hidden' | 'emerge' | 'pose' | 'combat', progress = 1) {
    const p = THREE.MathUtils.clamp(progress, 0, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    if (mode === 'hidden') {
      this.group.visible = false;
      this.bodyPivot.position.y = -1.65;
      return;
    }

    this.group.visible = true;
    this.leftLegPivot.rotation.set(0, 0, 0);
    this.rightLegPivot.rotation.set(0, 0, 0);

    if (mode === 'emerge') {
      // Face south (+Z) directly toward the close-up camera & arena center
      this.group.rotation.y = 0;
      this.bodyPivot.position.y = THREE.MathUtils.lerp(-1.55, 0, ease);
      this.rightArmPivot.rotation.set(THREE.MathUtils.lerp(0.32, -0.34, ease), -0.14 * ease, 0);
      this.leftArmPivot.rotation.set(THREE.MathUtils.lerp(0.28, -0.46, ease), 0.1 * ease, 0);
      this.headMesh.rotation.set(THREE.MathUtils.lerp(0.24, 0.06, ease), 0, 0);
      this.redEyeMat.emissiveIntensity = 4.0 + Math.sin(p * Math.PI * 3) * 0.8;
      this.weakspotTankMat.emissiveIntensity = 3.0;
      this.scalpelBladeMat.emissiveIntensity = 3.4;
      return;
    }

    if (mode === 'pose') {
      this.group.rotation.y = 0;
      this.bodyPivot.position.y = 0;
      this.rightArmPivot.rotation.set(-0.34 + Math.sin(p * Math.PI) * 0.06, -0.18, 0);
      this.leftArmPivot.rotation.set(-0.48, 0.12, 0);
      this.headMesh.rotation.set(0.06, Math.sin(p * Math.PI) * 0.06, 0);
      this.redEyeMat.emissiveIntensity = 4.6 + Math.sin(p * Math.PI * 4) * 0.9;
      this.weakspotTankMat.emissiveIntensity = 3.2;
      this.scalpelBladeMat.emissiveIntensity = 3.6;
      return;
    }

    // Combat reset
    this.bodyPivot.position.y = 0;
    this.bodyPivot.rotation.set(0, 0, 0);
    this.headMesh.rotation.set(0, 0, 0);
    this.rightArmPivot.rotation.set(0, 0, 0);
    this.leftArmPivot.rotation.set(0, 0, 0);
    this.redEyeMat.emissiveIntensity = 3.2;
    this.weakspotTankMat.emissiveIntensity = 2.2;
    this.scalpelBladeMat.emissiveIntensity = 2.4;
  }

  public update(
    delta: number,
    playerPos: THREE.Vector3,
    collisions: ArenaCollision[],
    obstacleMeshes: THREE.Object3D[],
    callbacks: BossCallbacks
  ) {
    if (this.isDying) {
      this.collapseProgress = Math.min(1, this.collapseProgress + delta * 1.4);
      this.bodyPivot.rotation.x = this.collapseProgress * (Math.PI / 2);
      this.bodyPivot.position.y = -this.collapseProgress * 0.8;
      if (this.collapseProgress >= 1) this.isDying = false;
      return;
    }
    if (this.isDead) return;

    // Pulse dorsal weakspot canisters & hit flash feedback
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= delta;
      this.coatMat.emissive.setHex(0xffffff);
      this.coatMat.emissiveIntensity = 0.45;
    } else if (this.stunTimer > 0) {
      this.stunTimer = Math.max(0, this.stunTimer - delta);
      this.coatMat.emissive.setHex(0x38bdf8);
      this.coatMat.emissiveIntensity = 0.35;
      this.headMesh.rotation.y = Math.sin(this.stunTimer * 12) * 0.4;
      this.leftLegPivot.rotation.x = 0;
      this.rightLegPivot.rotation.x = 0;
      return;
    } else {
      this.coatMat.emissive.setHex(0x000000);
      this.coatMat.emissiveIntensity = 0;
      this.headMesh.rotation.y = 0;
    }

    const pulse = 1.8 + Math.sin(performance.now() * 0.008) * 0.6;
    this.weakspotTankMat.emissiveIntensity = pulse;

    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const distToPlayer = Math.hypot(dx, dz);

    // Always face player cleanly (except mid-rush momentum)
    if (this.attackMode !== 'rush_lunge') {
      this.group.rotation.y = Math.atan2(dx, dz);
    }

    // Line-of-sight check
    this._eyeOrigin.set(this.position.x, 2.25, this.position.z);
    this._toPlayer.subVectors(playerPos, this._eyeOrigin).normalize();
    this._raycaster.set(this._eyeOrigin, this._toPlayer);
    this._raycaster.near = 0.2;
    this._raycaster.far = Math.max(0.2, distToPlayer - 0.5);
    const hasLOS = this._raycaster.intersectObjects(obstacleMeshes, false).length === 0;

    // Cooldowns
    this.barrageCooldown -= delta;
    this.gasCooldown -= delta;
    this.rushCooldown -= delta;

    // 1. Handle Active Rush State
    if (this.attackMode === 'rush_telegraph') {
      this.rushTimer -= delta;
      this.attackLabel = 'WARNING · SCALPEL RUSH INCOMING';
      this.leftArmPivot.rotation.x = -1.6;
      this.scalpelBladeMat.emissiveIntensity = 4.5;
      if (this.rushTimer <= 0) {
        this.attackMode = 'rush_lunge';
        this.rushTimer = 0.65;
        this.rushHitDealt = false;
        this.rushDir.set(dx, 0, dz).normalize();
        soundSystem.playScalpelRush();
      }
      return;
    }

    if (this.attackMode === 'rush_lunge') {
      this.rushTimer -= delta;
      this.attackLabel = 'SCALPEL RUSH';
      this.leftArmPivot.rotation.x = -0.35 + Math.sin(this.rushTimer * 18) * 0.9;
      this.tryMove(this.rushDir, 14.5 * delta, collisions);
      this.animateLegs(delta * 2.1);

      if (!this.rushHitDealt && distToPlayer < 2.65) {
        this.rushHitDealt = true;
        callbacks.onScalpelStrike(13);
      }

      if (this.rushTimer <= 0) {
        this.attackMode = 'stalk';
        this.rushCooldown = 7.2;
        this.leftArmPivot.rotation.x = 0;
        this.scalpelBladeMat.emissiveIntensity = 2.4;
      }
      return;
    }

    // 2. Trigger Rush Attack if close
    if (hasLOS && distToPlayer < 8.5 && this.rushCooldown <= 0 && this.barrageBurstLeft <= 0) {
      this.attackMode = 'rush_telegraph';
      this.rushTimer = 0.55;
      this.attackLabel = 'WARNING · SCALPEL RUSH';
      return;
    }

    // 3. Anesthetic Gas Cloud Lob
    if (this.gasCooldown <= 0 && distToPlayer < 36 && this.barrageBurstLeft <= 0) {
      this.gasCooldown = 9.0;
      this.attackLabel = 'ANESTHETIC GAS CLOUD DEPLOYED';
      soundSystem.playGasCanisterHiss();
      this._gasTarget.copy(playerPos);
      callbacks.onSpawnGasCloud(this._gasTarget);
    }

    // 4. Syringe Dart Barrage (Burst of 4 toxic darts)
    if (this.barrageBurstLeft > 0) {
      this.barrageBurstTimer -= delta;
      this.attackLabel = 'SYRINGE DART BARRAGE';
      if (this.barrageBurstTimer <= 0) {
        this.barrageBurstTimer = 0.22;
        this.barrageBurstLeft--;
        this.syringeMuzzle.getWorldPosition(this._muzzleWorld);
        this._aimDir
          .subVectors(playerPos, this._muzzleWorld)
          .set(
            this._aimDir.x + (Math.random() - 0.5) * 0.9,
            this._aimDir.y - 0.08 + (Math.random() - 0.5) * 0.38,
            this._aimDir.z + (Math.random() - 0.5) * 0.9
          )
          .normalize();
        soundSystem.playSyringeShot();
        callbacks.onFireSyringeDart(this._muzzleWorld, this._aimDir);
      }
    } else if (hasLOS && this.barrageCooldown <= 0) {
      this.barrageCooldown = 3.2;
      this.barrageBurstLeft = 4;
      this.barrageBurstTimer = 0.05;
      this.attackLabel = 'SYRINGE DART BARRAGE';
    } else {
      this.attackLabel = hasLOS ? 'PURSUING OPERATIVE' : 'TRACKING BEHIND COVER';
    }

    // 5. Tactical Movement (Advance + Strafe)
    this.strafeTimer += delta;
    if (this.strafeTimer > 2.2) {
      this.strafeTimer = 0;
      this.strafeDir *= -1;
    }

    this._forwardFlat.set(dx, 0, dz).normalize();
    this._strafeVec.set(-this._forwardFlat.z, 0, this._forwardFlat.x).multiplyScalar(this.strafeDir);

    this._moveVec.set(0, 0, 0);
    if (!hasLOS || distToPlayer > 16) {
      this._moveVec.addScaledVector(this._forwardFlat, 0.85).addScaledVector(this._strafeVec, 0.45);
    } else if (distToPlayer < 6.5) {
      this._moveVec.addScaledVector(this._strafeVec, 0.9);
    } else {
      this._moveVec.addScaledVector(this._forwardFlat, 0.35).addScaledVector(this._strafeVec, 0.75);
    }
    this._moveVec.normalize();

    this.tryMove(this._moveVec, 4.35 * delta, collisions);
    this.animateLegs(delta);
  }

  private animateLegs(delta: number) {
    this.walkCycle += delta * 8.5;
    const swing = Math.sin(this.walkCycle) * 0.5;
    this.leftLegPivot.rotation.x = swing;
    this.rightLegPivot.rotation.x = -swing;
    this.rightArmPivot.rotation.x = Math.sin(this.walkCycle * 0.5) * 0.05;
  }

  private tryMove(dir: THREE.Vector3, stepLen: number, collisions: ArenaCollision[]) {
    this._moveStep.copy(dir).multiplyScalar(stepLen);
    const radius = 0.75;
    const nextX = this.position.x + this._moveStep.x;
    const nextZ = this.position.z + this._moveStep.z;

    let canX = Math.abs(nextX) < 37.5;
    let canZ = Math.abs(nextZ) < 37.5;

    for (let i = 0; i < collisions.length; i++) {
      const c = collisions[i];
      if (c.type === 'ramp') continue;
      if (c.box.max.y <= 0.3) continue;

      if (
        nextX >= c.box.min.x - radius &&
        nextX <= c.box.max.x + radius &&
        this.position.z >= c.box.min.z - radius &&
        this.position.z <= c.box.max.z + radius
      ) {
        canX = false;
      }
      if (
        this.position.x >= c.box.min.x - radius &&
        this.position.x <= c.box.max.x + radius &&
        nextZ >= c.box.min.z - radius &&
        nextZ <= c.box.max.z + radius
      ) {
        canZ = false;
      }
    }

    if (canX) this.position.x = nextX;
    if (canZ) this.position.z = nextZ;
    this.group.position.copy(this.position);
  }
}
