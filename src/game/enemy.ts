/**
 * Articulated Multi-Part 3D Tactical Combat Androids (GIS Shooter: Tactical Edition)
 * Features:
 * - Distinct Head (2.5x Headshot hitbox) & Armored Torso/Limbs
 * - Articulated Leg Walk Cycle & Arm Weapon Aiming
 * - Line-of-Sight Raycast Awareness + Lateral Strafing AI
 * - Collapse / Topple Death Animation
 */

import * as THREE from 'three';
import { soundSystem } from '../audio/SoundSystem';
import { ArenaCollision } from './map';

export type AIState = 'patrol' | 'chase' | 'attack' | 'dying' | 'dead';

export class EnemyBot {
  public id: string;
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
  private leftLegPivot: THREE.Group;
  private rightLegPivot: THREE.Group;
  private rightArmPivot: THREE.Group;
  private gunMesh: THREE.Mesh;
  private healthBarMesh: THREE.Mesh;

  private hitFlashTimer = 0;
  public stunTimer = 0;
  private walkCycle = Math.random() * Math.PI * 2;
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

  // Pre-allocated scratch vectors (zero GC in loop)
  private _raycaster = new THREE.Raycaster();
  private _eyeOrigin = new THREE.Vector3();
  private _toPlayerDir = new THREE.Vector3();
  private _strafeVec = new THREE.Vector3();
  private _moveStep = new THREE.Vector3();

  constructor(id: string, spawnPos: THREE.Vector3, patrolNodes: THREE.Vector3[], wave = 1) {
    this.id = id;
    this.position = spawnPos.clone();
    this.maxHealth = 90 + (wave - 1) * 20;
    this.health = this.maxHealth;
    this.moveSpeed = 3.9 + Math.min(2.6, wave * 0.28);
    this.fireInterval = Math.max(1.05, 1.95 - wave * 0.08);
    this.damage = Math.min(14, Math.max(3, Math.round((6 + wave * 1) * 0.6)));

    this.patrolTarget = patrolNodes[Math.floor(Math.random() * patrolNodes.length)].clone();

    // Root Group grounded at bottom-center (y = 0)
    this.group = new THREE.Group();
    this.group.name = `ENEMY_${id}`;
    this.group.position.copy(this.position);

    this.bodyPivot = new THREE.Group();
    this.group.add(this.bodyPivot);

    // Materials with calibrated PBR contrast
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x1e2530,
      roughness: 0.42,
      metalness: 0.82,
    });
    const armorVestMat = new THREE.MeshStandardMaterial({
      color: 0x881337, // deep crimson tactical plate
      roughness: 0.55,
      metalness: 0.35,
    });
    const darkJointMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.78,
      metalness: 0.2,
    });
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0xff1e42,
      emissive: 0xff0033,
      emissiveIntensity: 1.8,
      roughness: 0.1,
    });

    // 1. Torso & Armored Vest
    this.torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.36), chassisMat);
    this.torsoMesh.position.y = 1.24;
    this.torsoMesh.castShadow = true;
    this.torsoMesh.name = 'ENEMY_BODY';
    this.bodyPivot.add(this.torsoMesh);

    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.46, 0.42), armorVestMat);
    chestPlate.position.set(0, 0.08, 0.02);
    chestPlate.name = 'ENEMY_BODY';
    this.torsoMesh.add(chestPlate);

    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.48, 0.18), darkJointMat);
    backpack.position.set(0, 0.05, -0.24);
    backpack.name = 'ENEMY_BODY';
    this.torsoMesh.add(backpack);

    // 2. Head & Glowing Optical Visor (Critical 2.5x Hitbox)
    this.headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.36), chassisMat);
    this.headMesh.position.y = 1.82;
    this.headMesh.castShadow = true;
    this.headMesh.name = 'ENEMY_HEAD';
    this.bodyPivot.add(this.headMesh);

    const helmetCrest = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.38), armorVestMat);
    helmetCrest.position.set(0, 0.19, 0);
    helmetCrest.name = 'ENEMY_HEAD';
    this.headMesh.add(helmetCrest);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.06), visorMat);
    visor.position.set(0, 0.03, 0.17);
    visor.name = 'ENEMY_HEAD';
    this.headMesh.add(visor);

    // 3. Left Arm & Shoulder Pauldron
    const leftShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.24), armorVestMat);
    leftShoulder.position.set(-0.38, 1.48, 0);
    leftShoulder.name = 'ENEMY_BODY';
    this.bodyPivot.add(leftShoulder);

    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.56, 0.16), darkJointMat);
    leftArm.position.set(-0.38, 1.15, 0.1);
    leftArm.rotation.x = -0.35;
    leftArm.name = 'ENEMY_BODY';
    this.bodyPivot.add(leftArm);

    // 4. Right Arm & Combat Pulse Rifle
    const rightShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.24), armorVestMat);
    rightShoulder.position.set(0.38, 1.48, 0);
    rightShoulder.name = 'ENEMY_BODY';
    this.bodyPivot.add(rightShoulder);

    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.38, 1.42, 0);
    this.bodyPivot.add(this.rightArmPivot);

    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.52, 0.16), darkJointMat);
    rightArm.position.set(0, -0.18, 0.18);
    rightArm.rotation.x = -Math.PI / 2.6;
    rightArm.name = 'ENEMY_BODY';
    this.rightArmPivot.add(rightArm);

    this.gunMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.055, 0.68, 10).rotateX(Math.PI / 2),
      chassisMat
    );
    this.gunMesh.position.set(0, -0.22, 0.52);
    this.gunMesh.name = 'ENEMY_BODY';
    this.rightArmPivot.add(this.gunMesh);

    const gunTip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), visorMat);
    gunTip.position.set(0, -0.22, 0.86);
    this.rightArmPivot.add(gunTip);

    // 5. Articulated Legs (Hip Pivot -> Thigh -> Knee -> Shin/Boot)
    const createLeg = (xOffset: number): THREE.Group => {
      const legPivot = new THREE.Group();
      legPivot.position.set(xOffset, 0.88, 0);

      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.44, 0.22), chassisMat);
      thigh.position.y = -0.22;
      thigh.castShadow = true;
      thigh.name = 'ENEMY_BODY';
      legPivot.add(thigh);

      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.44, 0.2), darkJointMat);
      shin.position.y = -0.66;
      shin.castShadow = true;
      shin.name = 'ENEMY_BODY';
      legPivot.add(shin);

      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.3), armorVestMat);
      boot.position.set(0, -0.82, 0.05);
      boot.name = 'ENEMY_BODY';
      legPivot.add(boot);

      return legPivot;
    };

    this.leftLegPivot = createLeg(-0.16);
    this.rightLegPivot = createLeg(0.16);
    this.bodyPivot.add(this.leftLegPivot);
    this.bodyPivot.add(this.rightLegPivot);

    // 6. Floating Overhead Health Bar
    const hbCanvas = document.createElement('canvas');
    hbCanvas.width = 128;
    hbCanvas.height = 16;
    const hbCtx = hbCanvas.getContext('2d')!;
    hbCtx.fillStyle = '#ef4444';
    hbCtx.fillRect(0, 0, 128, 16);
    const hbTex = new THREE.CanvasTexture(hbCanvas);

    const hbMat = new THREE.MeshBasicMaterial({
      map: hbTex,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    this.healthBarMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.1), hbMat);
    this.healthBarMesh.position.y = 2.28;
    this.healthBarMesh.renderOrder = 999;
    this.group.add(this.healthBarMesh);
  }

  public takeDamage(dmg: number, isHeadshot = false): { isDead: boolean; isHeadshot: boolean } {
    if (this.isDead || this.state === 'dying') {
      return { isDead: true, isHeadshot };
    }

    const actualDmg = isHeadshot ? Math.round(dmg * 2.5) : dmg;
    this.health -= actualDmg;
    this.hitFlashTimer = 0.14;

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
      return { isDead: true, isHeadshot };
    }

    return { isDead: false, isHeadshot };
  }

  public stun(duration: number) {
    if (this.isDead || this.state === 'dying') return;
    this.stunTimer = Math.max(this.stunTimer, duration);
  }

  private hasLineOfSight(playerPos: THREE.Vector3, obstacleMeshes: THREE.Object3D[]): boolean {
    this._eyeOrigin.set(this.position.x, this.position.y + 1.7, this.position.z);
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
    // Collapse / Topple animation upon elimination
    if (this.state === 'dying') {
      this.collapseProgress += delta * 2.4;
      const t = Math.min(1, this.collapseProgress);
      this.bodyPivot.rotation.x = t * (Math.PI / 2) * this.fallDirection;
      this.bodyPivot.position.y = -t * 0.65;
      if (t >= 1) {
        this.state = 'dead';
      }
      return;
    }

    if (this.state === 'dead' || this.isDead) return;

    this.healthBarMesh.quaternion.copy(camera.quaternion);

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
      this.leftLegPivot.rotation.x = THREE.MathUtils.damp(this.leftLegPivot.rotation.x, 0, 10, delta);
      this.rightLegPivot.rotation.x = THREE.MathUtils.damp(this.rightLegPivot.rotation.x, 0, 10, delta);
      return;
    } else {
      torsoMat.emissive.setHex(0x000000);
      torsoMat.emissiveIntensity = 0;
      this.headMesh.rotation.y = THREE.MathUtils.damp(this.headMesh.rotation.y, 0, 10, delta);
      this.headMesh.rotation.z = THREE.MathUtils.damp(this.headMesh.rotation.z, 0, 10, delta);
    }

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
      this._moveStep.normalize().multiplyScalar(this.moveSpeed * delta);
      this.moveWithCollision(this._moveStep, collisions);

      const angle = Math.atan2(this._moveStep.x, this._moveStep.z);
      this.group.rotation.y = THREE.MathUtils.damp(this.group.rotation.y, angle, 9, delta);
    } else if (this.state === 'attack') {
      // Face player
      const dx = playerPos.x - this.position.x;
      const dz = playerPos.z - this.position.z;
      const angle = Math.atan2(dx, dz);
      this.group.rotation.y = THREE.MathUtils.damp(this.group.rotation.y, angle, 12, delta);

      // Tactical lateral strafing
      this.strafeTimer += delta;
      if (this.strafeTimer > 1.6 + Math.random() * 0.8) {
        this.strafeTimer = 0;
        this.strafeDir *= -1;
      }

      this._strafeVec.set(-dz, 0, dx).normalize().multiplyScalar(this.strafeDir * this.moveSpeed * 0.68 * delta);
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

        const gunMuzzle = new THREE.Vector3();
        this.gunMesh.getWorldPosition(gunMuzzle);

        const aimTarget = new THREE.Vector3(
          playerPos.x + (Math.random() - 0.5) * 1.45,
          playerPos.y - 0.15 + (Math.random() - 0.5) * 0.75,
          playerPos.z + (Math.random() - 0.5) * 1.45
        );
        onShootPlayer(gunMuzzle, aimTarget, this.damage);
      }
    }

    // Leg Walking Stride Cycle
    if (isMoving) {
      this.walkCycle += delta * (this.state === 'chase' ? 11 : 8);
      const swing = Math.sin(this.walkCycle) * 0.52;
      this.leftLegPivot.rotation.x = swing;
      this.rightLegPivot.rotation.x = -swing;
      this.bodyPivot.position.y = Math.abs(Math.cos(this.walkCycle)) * 0.05;
    } else {
      this.leftLegPivot.rotation.x = THREE.MathUtils.damp(this.leftLegPivot.rotation.x, 0, 10, delta);
      this.rightLegPivot.rotation.x = THREE.MathUtils.damp(this.rightLegPivot.rotation.x, 0, 10, delta);
      this.bodyPivot.position.y = THREE.MathUtils.damp(this.bodyPivot.position.y, 0, 10, delta);
    }
  }

  private moveWithCollision(step: THREE.Vector3, collisions: ArenaCollision[]): boolean {
    const nextX = this.position.x + step.x;
    const nextZ = this.position.z + step.z;
    const botRadius = 0.55;

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
