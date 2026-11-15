/**
 * Module 19: Cinematic Boss Arrival Cutscene ("The Specialist Anestesi")
 * Delta-driven 7.0s 3D choreography:
 * - Stage 1 (0.0s–1.4s): Input lock, red alert pulse, continuous sky pan-up aligned to pod trajectory
 * - Stage 2 (1.4s–3.4s): Atmospheric drop-pod re-entry, crater impact, shockwave, pooled debris & smoke
 * - Stage 3 (3.4s–6.2s): Smoke clears, Boss rises & poses for dramatic close-up
 * - Stage 4 (6.2s–7.0s): Smooth elevated return arc to First-Person camera & combat handoff
 */

import * as THREE from 'three';
import { BossSpecialist } from './boss';

export type CutscenePhase = 'alert' | 'descent' | 'impact' | 'reveal' | 'return';

export interface CutsceneHudSnapshot {
  active: boolean;
  phase: CutscenePhase;
  elapsed: number;
  duration: number;
  glitchIntensity: number;
  showTitleCard: boolean;
  canSkip: boolean;
}

export interface CutsceneCallbacks {
  onReentryStart: () => void;
  onImpact: () => void;
  onRevealSting: () => void;
  onComplete: (skipped: boolean) => void;
}

interface DebrisChunk {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  radius: number;
  bounces: number;
  active: boolean;
}

interface SmokePuff {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  vel: THREE.Vector3;
  startScale: number;
  endScale: number;
  maxOpacity: number;
  active: boolean;
}

export const BOSS_LANDING_POS = new THREE.Vector3(0, 0, -18.5);
const CUTSCENE_DURATION = 7.0;
const IMPACT_TIME = 2.65;
const MAX_DEBRIS = 26;
const MAX_SMOKE = 22;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

function easeInQuad(t: number): number {
  const x = clamp01(t);
  return x * x;
}

export class BossArrivalCutscene {
  public isActive = false;
  public elapsed = 0;
  public readonly duration = CUTSCENE_DURATION;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private boss: BossSpecialist | null = null;
  private callbacks: CutsceneCallbacks;
  private isPotato = false;
  private baseFov = 75;

  private savedCamPos = new THREE.Vector3();
  private savedCamQuat = new THREE.Quaternion();
  private startLookTarget = new THREE.Vector3();
  private camWorkPos = new THREE.Vector3();
  private camWorkLook = new THREE.Vector3();
  private lookMatrix = new THREE.Matrix4();
  private targetQuat = new THREE.Quaternion();
  private returnArcLift = 0;
  private craneArcLift = 0;

  // Constant choreography waypoints (zero per-frame allocations)
  private readonly podStartPos = new THREE.Vector3(5.5, 48, -24.5);
  private readonly podLandPos = new THREE.Vector3(2.1, 0.72, -20.6);
  private readonly skyTarget = new THREE.Vector3(5.5, 46, -24.5);
  private readonly trackStartPos = new THREE.Vector3(-7.2, 5.8, -11.5);
  private readonly trackEndPos = new THREE.Vector3(-4.8, 3.6, -12.8);
  private readonly craterFocus = new THREE.Vector3(0, 1.35, -18.5);
  private readonly closeUpPos = new THREE.Vector3(0.45, 2.02, -14.85);
  private readonly closeUpEndPos = new THREE.Vector3(0.18, 2.15, -15.35);
  private readonly closeUpLook = new THREE.Vector3(0.06, 2.28, -18.5);

  // Scratch vectors & quaternions
  private readonly _worldUp = new THREE.Vector3(0, 1, 0);
  private readonly _negY = new THREE.Vector3(0, -1, 0);
  private readonly _travelDir = new THREE.Vector3();
  private readonly _podQuat = new THREE.Quaternion();
  private readonly _tmpDir = new THREE.Vector3();

  private rootGroup: THREE.Group;
  private podGroup: THREE.Group;
  private plasmaCone: THREE.Mesh;
  private plasmaMat: THREE.MeshBasicMaterial;
  private podLight: THREE.PointLight;
  private craterGroup: THREE.Group;
  private craterGlowMat: THREE.MeshBasicMaterial;
  private shockwaveRing: THREE.Mesh;
  private shockwaveMat: THREE.MeshBasicMaterial;
  private impactFlashLight: THREE.PointLight;

  // Pre-allocated object pools & shared assets (0 allocations on impact)
  private debris: DebrisChunk[] = [];
  private smokePuffs: SmokePuff[] = [];
  private debrisBoxGeo: THREE.BoxGeometry;
  private debrisRockGeo: THREE.DodecahedronGeometry;
  private smokeGeo: THREE.SphereGeometry;
  private concreteMat: THREE.MeshStandardMaterial;
  private metalMat: THREE.MeshStandardMaterial;
  private emberMat: THREE.MeshBasicMaterial;

  private reentryTriggered = false;
  private impactTriggered = false;
  private revealTriggered = false;
  private cleanupTimer = 0;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, callbacks: CutsceneCallbacks) {
    this.scene = scene;
    this.camera = camera;
    this.callbacks = callbacks;

    this.rootGroup = new THREE.Group();
    this.rootGroup.visible = false;
    this.scene.add(this.rootGroup);

    // 1. Tactical Armored Drop Pod
    this.podGroup = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.32,
      metalness: 0.85,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xe11d48,
      emissiveIntensity: 1.8,
      roughness: 0.35,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.25,
      metalness: 0.9,
    });

    const coreBody = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.72, 2.4, 8), hullMat);
    coreBody.position.y = 0.2;
    this.podGroup.add(coreBody);

    const noseCone = new THREE.Mesh(new THREE.ConeGeometry(0.72, 1.05, 8), chromeMat);
    noseCone.rotation.x = Math.PI;
    noseCone.position.y = -1.52;
    this.podGroup.add(noseCone);

    const upperCap = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.92, 0.55, 8), hullMat);
    upperCap.position.y = 1.66;
    this.podGroup.add(upperCap);

    // Four aerodynamic stabilizer fins + red hazard strips
    const finGeo = new THREE.BoxGeometry(0.14, 1.65, 0.58);
    const stripGeo = new THREE.BoxGeometry(0.16, 1.1, 0.08);
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2;
      const fin = new THREE.Mesh(finGeo, hullMat);
      fin.position.set(Math.sin(ang) * 0.96, 0.65, Math.cos(ang) * 0.96);
      fin.rotation.y = ang;
      this.podGroup.add(fin);

      const strip = new THREE.Mesh(stripGeo, trimMat);
      strip.position.set(Math.sin(ang) * 0.92, 0.2, Math.cos(ang) * 0.92);
      strip.rotation.y = ang;
      this.podGroup.add(strip);
    }

    // Blazing Plasma Re-Entry Sheath
    this.plasmaMat = new THREE.MeshBasicMaterial({
      color: 0xff6b2b,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.plasmaCone = new THREE.Mesh(
      new THREE.ConeGeometry(1.75, 5.4, 14, 1, true),
      this.plasmaMat
    );
    this.plasmaCone.rotation.x = Math.PI;
    this.plasmaCone.position.y = -0.35;
    this.podGroup.add(this.plasmaCone);

    this.podLight = new THREE.PointLight(0xff5522, 0, 32, 1.5);
    this.podLight.position.set(0, -1.0, 0);
    this.podGroup.add(this.podLight);
    this.rootGroup.add(this.podGroup);

    // 2. Crater Scorch Decal + Glowing Hazard Rim
    this.craterGroup = new THREE.Group();
    this.craterGroup.position.copy(BOSS_LANDING_POS);
    this.craterGroup.visible = false;

    const scorchDisc = new THREE.Mesh(
      new THREE.CircleGeometry(4.4, 28).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0x090c12,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      })
    );
    scorchDisc.position.y = 0.035;
    this.craterGroup.add(scorchDisc);

    this.craterGlowMat = new THREE.MeshBasicMaterial({
      color: 0xff4520,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const craterRim = new THREE.Mesh(
      new THREE.TorusGeometry(2.85, 0.13, 8, 32).rotateX(Math.PI / 2),
      this.craterGlowMat
    );
    craterRim.position.y = 0.06;
    this.craterGroup.add(craterRim);

    const innerCrackRing = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 2.7, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0x1e293b,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      })
    );
    innerCrackRing.position.y = 0.04;
    this.craterGroup.add(innerCrackRing);

    this.rootGroup.add(this.craterGroup);

    // 3. Expanding Ground Shockwave Ring
    this.shockwaveMat = new THREE.MeshBasicMaterial({
      color: 0xfb7185,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.shockwaveRing = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 1.5, 36).rotateX(-Math.PI / 2),
      this.shockwaveMat
    );
    this.shockwaveRing.position.set(BOSS_LANDING_POS.x, 0.12, BOSS_LANDING_POS.z);
    this.shockwaveRing.visible = false;
    this.rootGroup.add(this.shockwaveRing);

    this.impactFlashLight = new THREE.PointLight(0xff4d2e, 0, 48, 1.3);
    this.impactFlashLight.position.set(BOSS_LANDING_POS.x, 2.2, BOSS_LANDING_POS.z);
    this.rootGroup.add(this.impactFlashLight);

    // 4. Pre-allocated Impact Debris & Volumetric Smoke Pools (zero mid-cutscene shader compile hitch)
    this.concreteMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.88,
      metalness: 0.15,
    });
    this.metalMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.35,
      metalness: 0.85,
    });
    this.emberMat = new THREE.MeshBasicMaterial({ color: 0xff6b2b });
    this.debrisBoxGeo = new THREE.BoxGeometry(0.38, 0.12, 0.24);
    this.debrisRockGeo = new THREE.DodecahedronGeometry(0.28, 0);

    for (let i = 0; i < MAX_DEBRIS; i++) {
      const isMetal = i % 3 === 0;
      const isEmber = i % 5 === 0;
      const geo = isMetal ? this.debrisBoxGeo : this.debrisRockGeo;
      const mat = isEmber ? this.emberMat : isMetal ? this.metalMat : this.concreteMat;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.rootGroup.add(mesh);
      this.debris.push({
        mesh,
        vel: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        radius: isEmber ? 0.14 : 0.22,
        bounces: 0,
        active: false,
      });
    }

    this.smokeGeo = new THREE.SphereGeometry(1, 8, 8);
    for (let i = 0; i < MAX_SMOKE; i++) {
      const tint = i % 4 === 0 ? 0x10b981 : i % 3 === 0 ? 0x991b1b : 0x334155;
      const mat = new THREE.MeshBasicMaterial({
        color: tint,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.smokeGeo, mat);
      mesh.visible = false;
      this.rootGroup.add(mesh);
      this.smokePuffs.push({
        mesh,
        mat,
        vel: new THREE.Vector3(),
        startScale: 1,
        endScale: 3,
        maxOpacity: i % 4 === 0 ? 0.34 : 0.56,
        active: false,
      });
    }
  }

  public start(
    boss: BossSpecialist,
    savedPos: THREE.Vector3,
    savedQuat: THREE.Quaternion,
    baseFov: number,
    isPotato: boolean
  ) {
    this.hideTransients();

    this.boss = boss;
    this.boss.position.copy(BOSS_LANDING_POS);
    this.boss.group.position.copy(BOSS_LANDING_POS);
    this.boss.setCutscenePose('hidden', 0);

    this.isActive = true;
    this.elapsed = 0;
    this.cleanupTimer = 0;
    this.isPotato = isPotato;
    this.baseFov = baseFov;
    this.reentryTriggered = false;
    this.impactTriggered = false;
    this.revealTriggered = false;

    this.savedCamPos.copy(savedPos);
    this.savedCamQuat.copy(savedQuat);
    this._tmpDir.set(0, 0, -1).applyQuaternion(savedQuat);
    this.startLookTarget.copy(savedPos).addScaledVector(this._tmpDir, 14);

    // Precompute smooth elevated arc height so camera sweeps cleanly over central catwalk/energy core
    const distFromTrack = this.savedCamPos.distanceTo(this.trackStartPos);
    const distFromCloseUp = this.savedCamPos.distanceTo(this.closeUpEndPos);
    this.craneArcLift = distFromTrack > 12 ? Math.min(6.0, distFromTrack * 0.14) : 0;
    this.returnArcLift = distFromCloseUp > 12 ? Math.min(6.0, distFromCloseUp * 0.14) : 0;

    this.rootGroup.visible = true;
    this.podGroup.visible = false;
    this.podGroup.position.copy(this.podStartPos);
    this.podGroup.rotation.set(0, 0, 0);
    this.plasmaMat.opacity = 0;
    this.podLight.intensity = 0;
    this.craterGroup.visible = false;
    this.craterGlowMat.opacity = 0.9;
    this.shockwaveRing.visible = false;
    this.shockwaveRing.scale.setScalar(1);
    this.shockwaveMat.opacity = 0;
    this.impactFlashLight.intensity = 0;
  }

  private spawnImpactEffects() {
    this.craterGroup.visible = true;
    this.craterGlowMat.opacity = 0.95;
    this.shockwaveRing.visible = true;
    this.shockwaveRing.scale.setScalar(1);
    this.shockwaveMat.opacity = 0.9;
    this.impactFlashLight.intensity = this.isPotato ? 0 : 42;

    const debrisCount = this.isPotato ? 10 : MAX_DEBRIS;
    for (let i = 0; i < debrisCount; i++) {
      const d = this.debris[i];
      const isEmber = i % 5 === 0;
      const scaleFactor = isEmber ? 0.65 + Math.random() * 0.45 : 0.8 + Math.random() * 0.85;
      const ang = (i / debrisCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const spd = 6.5 + Math.random() * 11.5;

      d.active = true;
      d.bounces = 0;
      d.radius = 0.2 * scaleFactor;
      d.mesh.scale.setScalar(scaleFactor);
      d.mesh.position.set(
        BOSS_LANDING_POS.x + Math.cos(ang) * 0.8,
        0.35 + Math.random() * 0.4,
        BOSS_LANDING_POS.z + Math.sin(ang) * 0.8
      );
      d.vel.set(Math.cos(ang) * spd, 7.5 + Math.random() * 9.5, Math.sin(ang) * spd);
      d.rotVel.set(
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14
      );
      d.mesh.visible = true;
    }

    const smokeCount = this.isPotato ? 8 : MAX_SMOKE;
    for (let i = 0; i < smokeCount; i++) {
      const s = this.smokePuffs[i];
      const ang = (i / smokeCount) * Math.PI * 2 + Math.random() * 0.35;
      const rad = 0.4 + Math.random() * 1.6;
      const startScale = 0.85 + Math.random() * 0.65;

      s.active = true;
      s.startScale = startScale;
      s.endScale = startScale * (2.4 + Math.random() * 1.2);
      s.mesh.position.set(
        BOSS_LANDING_POS.x + Math.cos(ang) * rad,
        0.65 + Math.random() * 0.8,
        BOSS_LANDING_POS.z + Math.sin(ang) * rad
      );
      s.mesh.scale.setScalar(startScale);
      s.vel.set(
        Math.cos(ang) * (2.6 + Math.random() * 2.8),
        0.9 + Math.random() * 1.8,
        Math.sin(ang) * (2.6 + Math.random() * 2.8)
      );
      s.mat.opacity = s.maxOpacity;
      s.mesh.visible = true;
    }
  }

  private hideTransients() {
    for (let i = 0; i < this.debris.length; i++) {
      this.debris[i].active = false;
      this.debris[i].mesh.visible = false;
    }
    for (let i = 0; i < this.smokePuffs.length; i++) {
      this.smokePuffs[i].active = false;
      this.smokePuffs[i].mesh.visible = false;
    }
  }

  public skip() {
    if (!this.isActive) return;
    this.hideTransients();
    this.podGroup.visible = true;
    this.podGroup.position.copy(this.podLandPos);
    this.podGroup.rotation.set(0.2, 0.42, -0.16);
    this.plasmaMat.opacity = 0;
    this.podLight.intensity = 0;
    this.craterGroup.visible = true;
    this.craterGlowMat.opacity = 0.25;
    this.shockwaveRing.visible = false;
    this.impactFlashLight.intensity = 0;

    if (this.boss) {
      this.boss.position.copy(BOSS_LANDING_POS);
      this.boss.group.position.copy(BOSS_LANDING_POS);
      this.boss.setCutscenePose('combat', 1);
    }

    this.camera.position.copy(this.savedCamPos);
    this.camera.quaternion.copy(this.savedCamQuat);
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();

    this.isActive = false;
    this.cleanupTimer = 18.0;
    this.callbacks.onComplete(true);
  }

  public resetAll() {
    this.isActive = false;
    this.cleanupTimer = 0;
    this.hideTransients();
    this.rootGroup.visible = false;
    this.podGroup.visible = false;
    this.craterGroup.visible = false;
    this.shockwaveRing.visible = false;
    this.impactFlashLight.intensity = 0;
    this.podLight.intensity = 0;
    this.boss = null;
  }

  public getHudSnapshot(): CutsceneHudSnapshot | null {
    if (!this.isActive) return null;
    const t = this.elapsed;
    let phase: CutscenePhase = 'alert';
    if (t >= 6.2) phase = 'return';
    else if (t >= 3.4) phase = 'reveal';
    else if (t >= IMPACT_TIME) phase = 'impact';
    else if (t >= 1.4) phase = 'descent';

    const impactGlitch =
      t >= IMPACT_TIME && t < IMPACT_TIME + 0.55
        ? 1 - (t - IMPACT_TIME) / 0.55
        : 0;
    const alertGlitch = t < 0.7 ? 0.55 * (1 - t / 0.7) : 0;
    const revealGlitch = t >= 4.2 && t < 4.7 ? 0.65 * (1 - (t - 4.2) / 0.5) : 0;
    const glitchIntensity = clamp01(Math.max(alertGlitch, impactGlitch, revealGlitch));

    return {
      active: true,
      phase,
      elapsed: t,
      duration: this.duration,
      glitchIntensity,
      showTitleCard: t >= 4.2 && t < 6.35,
      canSkip: t > 0.25,
    };
  }

  public update(delta: number) {
    if (!this.isActive) {
      if (this.cleanupTimer > 0) {
        this.cleanupTimer = Math.max(0, this.cleanupTimer - delta);
        this.craterGlowMat.opacity = 0.22 * (this.cleanupTimer / 18.0);
        if (this.cleanupTimer <= 0) {
          this.rootGroup.visible = false;
        }
      }
      return;
    }

    this.elapsed = Math.min(this.duration, this.elapsed + delta);
    const t = this.elapsed;

    // --- 1. Stage Triggers ---
    if (!this.reentryTriggered && t >= 1.35) {
      this.reentryTriggered = true;
      this.podGroup.visible = true;
      this.callbacks.onReentryStart();
    }

    if (!this.impactTriggered && t >= IMPACT_TIME) {
      this.impactTriggered = true;
      this.spawnImpactEffects();
      this.callbacks.onImpact();
    }

    if (!this.revealTriggered && t >= 4.15) {
      this.revealTriggered = true;
      this.callbacks.onRevealSting();
    }

    // --- 2. Drop Pod Descent & Impact Physics ---
    if (t >= 1.35 && t < IMPACT_TIME) {
      const dp = easeInQuad((t - 1.35) / (IMPACT_TIME - 1.35));
      this.podGroup.position.lerpVectors(this.podStartPos, this.podLandPos, dp);
      this._travelDir.subVectors(this.podLandPos, this.podStartPos).normalize();
      this._podQuat.setFromUnitVectors(this._negY, this._travelDir);
      this.podGroup.quaternion.copy(this._podQuat);
      this.podGroup.rotateY(t * 7.5);
      this.plasmaMat.opacity = 0.45 + dp * 0.48;
      const pulseW = 1 + Math.sin(t * 26) * 0.08;
      this.plasmaCone.scale.set(pulseW, 1 + dp * 0.3, pulseW);
      this.podLight.intensity = this.isPotato ? 0 : 18 + dp * 18;
    } else if (t >= IMPACT_TIME) {
      this.podGroup.visible = true;
      this.podGroup.position.copy(this.podLandPos);
      this.podGroup.rotation.set(0.2, 0.42, -0.16);
      const fadePlasma = clamp01(1 - (t - IMPACT_TIME) / 0.45);
      this.plasmaMat.opacity = fadePlasma * 0.7;
      this.podLight.intensity = this.isPotato ? 0 : fadePlasma * 16;
      this.impactFlashLight.intensity = this.isPotato
        ? 0
        : Math.max(0, 42 * (1 - (t - IMPACT_TIME) / 0.5));
      this.craterGlowMat.opacity = Math.max(0.28, 0.95 - (t - IMPACT_TIME) * 0.18);
    }

    // --- 3. Shockwave Expansion ---
    if (this.shockwaveRing.visible) {
      const swP = clamp01((t - IMPACT_TIME) / 0.95);
      this.shockwaveRing.scale.setScalar(1 + easeOutCubic(swP) * 22);
      this.shockwaveMat.opacity = (1 - swP) * 0.85;
      if (swP >= 1) this.shockwaveRing.visible = false;
    }

    // --- 4. Pooled Debris Ballistic Physics ---
    for (let i = 0; i < this.debris.length; i++) {
      const d = this.debris[i];
      if (!d.active) continue;
      d.vel.y -= 24 * delta;
      d.mesh.position.addScaledVector(d.vel, delta);
      d.mesh.rotation.x += d.rotVel.x * delta;
      d.mesh.rotation.y += d.rotVel.y * delta;
      d.mesh.rotation.z += d.rotVel.z * delta;
      if (d.mesh.position.y <= d.radius) {
        d.mesh.position.y = d.radius;
        if (Math.abs(d.vel.y) > 1.4 && d.bounces < 3) {
          d.vel.y *= -0.44;
          d.vel.x *= 0.65;
          d.vel.z *= 0.65;
          d.bounces++;
        } else {
          d.vel.set(0, 0, 0);
          d.rotVel.multiplyScalar(0.85);
        }
      }
      if (t > 4.6) {
        const shrink = clamp01(1 - (t - 4.6) / 1.2);
        if (shrink <= 0.01) {
          d.active = false;
          d.mesh.visible = false;
        } else {
          d.mesh.scale.setScalar(shrink);
        }
      }
    }

    // --- 5. Volumetric Smoke Dispersion ---
    if (t >= IMPACT_TIME) {
      const smokeAge = t - IMPACT_TIME;
      const windClear = clamp01((t - 3.35) / 1.55);
      for (let i = 0; i < this.smokePuffs.length; i++) {
        const s = this.smokePuffs[i];
        if (!s.active) continue;
        s.mesh.position.addScaledVector(s.vel, delta);
        s.mesh.position.x += delta * 2.2 * windClear;
        s.vel.multiplyScalar(Math.max(0.4, 1 - delta * 1.1));
        const growP = clamp01(smokeAge / 1.4);
        s.mesh.scale.setScalar(THREE.MathUtils.lerp(s.startScale, s.endScale, easeOutCubic(growP)));
        const op = s.maxOpacity * (1 - windClear);
        s.mat.opacity = op;
        if (op <= 0.01) {
          s.active = false;
          s.mesh.visible = false;
        }
      }
    }

    // --- 6. Boss Emergence & Close-Up Posing ---
    if (this.boss) {
      if (t < 3.35) {
        this.boss.setCutscenePose('hidden', 0);
      } else if (t < 4.55) {
        this.boss.setCutscenePose('emerge', (t - 3.35) / 1.2);
      } else if (t < 6.35) {
        this.boss.setCutscenePose('pose', (t - 4.55) / 1.8);
      } else {
        this.boss.setCutscenePose('combat', 1);
      }
    }

    // --- 7. 4-Stage Obstacle-Free Camera Choreography ---
    if (t < 1.4) {
      // Stage 1: Pan up smoothly onto the fiery re-entry vector
      const p = easeInOutCubic(t / 1.4);
      this.camWorkPos.copy(this.savedCamPos);
      this.camWorkPos.y += p * 0.45;
      this.camWorkLook.lerpVectors(this.startLookTarget, this.skyTarget, p);
      this.camera.fov = THREE.MathUtils.lerp(this.baseFov, this.baseFov + 6, p);
    } else if (t < 3.4) {
      // Stage 2: High crane arc to north-west plaza vantage tracking pod down to crater
      const p = easeOutCubic((t - 1.4) / 1.25);
      if (t < 2.0) {
        const moveP = easeInOutCubic((t - 1.4) / 0.6);
        this.camWorkPos.lerpVectors(this.savedCamPos, this.trackStartPos, moveP);
        this.camWorkPos.y += (1 - moveP) * 0.45 + Math.sin(moveP * Math.PI) * this.craneArcLift;
      } else {
        this.camWorkPos.lerpVectors(
          this.trackStartPos,
          this.trackEndPos,
          clamp01((t - 2.0) / 1.4)
        );
      }
      const podFocus = this.podGroup.visible ? this.podGroup.position : this.skyTarget;
      const lookMix =
        t < IMPACT_TIME ? p * 0.55 : 0.55 + easeOutCubic((t - IMPACT_TIME) / 0.75) * 0.45;
      this.camWorkLook.lerpVectors(podFocus, this.craterFocus, lookMix);
      this.camera.fov = THREE.MathUtils.lerp(
        this.baseFov + 6,
        this.baseFov - 4,
        clamp01((t - 1.4) / 2.0)
      );
    } else if (t < 6.2) {
      // Stage 3: Low-angle dramatic close-up of mask, crimson visor eyes & Syringe Blaster
      const glideP = easeInOutCubic((t - 3.4) / 1.45);
      if (t < 4.85) {
        this.camWorkPos.lerpVectors(this.trackEndPos, this.closeUpPos, glideP);
        this.camWorkLook.lerpVectors(this.craterFocus, this.closeUpLook, glideP);
      } else {
        const drift = easeInOutCubic(clamp01((t - 4.85) / 1.35));
        this.camWorkPos.lerpVectors(this.closeUpPos, this.closeUpEndPos, drift);
        this.camWorkLook.copy(this.closeUpLook);
      }
      this.camera.fov = THREE.MathUtils.lerp(this.baseFov - 4, 52, glideP);
    } else {
      // Stage 4: Smooth elevated arc back to First-Person operative camera (no catwalk clipping)
      const retP = easeInOutCubic((t - 6.2) / (this.duration - 6.2));
      this.camWorkPos.lerpVectors(this.closeUpEndPos, this.savedCamPos, retP);
      this.camWorkPos.y += Math.sin(retP * Math.PI) * this.returnArcLift;
      this.camera.fov = THREE.MathUtils.lerp(52, this.baseFov, retP);
    }

    this.camera.position.copy(this.camWorkPos);
    if (t < 6.2) {
      this.lookMatrix.lookAt(this.camWorkPos, this.camWorkLook, this._worldUp);
      this.targetQuat.setFromRotationMatrix(this.lookMatrix);
      this.camera.quaternion.copy(this.targetQuat);
    } else {
      const retP = easeInOutCubic((t - 6.2) / (this.duration - 6.2));
      this.lookMatrix.lookAt(this.camWorkPos, this.closeUpLook, this._worldUp);
      this.targetQuat.setFromRotationMatrix(this.lookMatrix);
      this.camera.quaternion.slerpQuaternions(this.targetQuat, this.savedCamQuat, retP);
    }
    this.camera.updateProjectionMatrix();

    if (this.elapsed >= this.duration) {
      this.camera.position.copy(this.savedCamPos);
      this.camera.quaternion.copy(this.savedCamQuat);
      this.camera.fov = this.baseFov;
      this.camera.updateProjectionMatrix();
      this.isActive = false;
      this.cleanupTimer = 18.0;
      this.hideTransients();
      this.callbacks.onComplete(false);
    }
  }

  public dispose() {
    this.resetAll();
    this.debrisBoxGeo.dispose();
    this.debrisRockGeo.dispose();
    this.smokeGeo.dispose();
    this.concreteMat.dispose();
    this.metalMat.dispose();
    this.emberMat.dispose();
    for (let i = 0; i < this.smokePuffs.length; i++) {
      this.smokePuffs[i].mat.dispose();
    }
    this.plasmaMat.dispose();
    this.craterGlowMat.dispose();
    this.shockwaveMat.dispose();
    this.scene.remove(this.rootGroup);
  }
}
