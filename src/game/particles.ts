/**
 * Advanced Pooled VFX System for GIS Shooter: Tactical Edition
 * - O(1) Ring-Buffer Pooled Tracers, Particles & Brass/Shotgun Shells
 * - Dynamic DrawRange & Conditional GPU Buffer Uploads (0 vertex uploads when idle)
 * - Pooled Shockwave Rings (zero standalone rAF loops or runtime PointLights)
 * - Cached Floating Damage-Number Textures & Persistent Bullet Hole Decals
 */

import * as THREE from 'three';
import { soundSystem } from '../audio/SoundSystem';
import { createBulletDecalTexture } from './textures';

interface Tracer {
  mesh: THREE.Line;
  start: THREE.Vector3;
  end: THREE.Vector3;
  progress: number;
  speed: number;
  active: boolean;
}

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  life: number;
  maxLife: number;
  active: boolean;
}

interface ShellCasing {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  angVel: THREE.Vector3;
  life: number;
  maxLife: number;
  bounces: number;
  active: boolean;
}

interface ShockwaveRing {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  maxScale: number;
  active: boolean;
}

interface FloatingDamage {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  baseScaleX: number;
  baseScaleY: number;
}

export class ParticleSystem {
  private scene: THREE.Scene;

  // 1. Tracers (O(1) ring cursor)
  private tracers: Tracer[] = [];
  private maxTracers = 48;
  private tracerCursor = 0;

  // 2. Sparks & Debris Points (O(1) ring cursor + drawRange)
  private maxParticles = 700;
  private particleCursor = 0;
  private particleGeo: THREE.BufferGeometry;
  private particleMat: THREE.PointsMaterial;
  private particlePoints: THREE.Points;
  private particlePool: Particle[] = [];
  private posArray: Float32Array;
  private colorArray: Float32Array;
  private hadActiveParticles = false;

  // 3. Ejected Brass / Shotgun Shell Casings (O(1) ring cursor)
  private shells: ShellCasing[] = [];
  private maxShells = 36;
  private shellCursor = 0;
  private shellGeo: THREE.CylinderGeometry;
  private brassMat: THREE.MeshStandardMaterial;
  private shotgunHullMat: THREE.MeshStandardMaterial;

  // 4. Bullet Hole Decals (Ring Buffer Pool)
  private decals: THREE.Mesh[] = [];
  private maxDecals = 64;
  private decalCursor = 0;
  private decalGeo: THREE.PlaneGeometry;
  private decalMat: THREE.MeshBasicMaterial;

  // 5. Pooled Shockwave Rings (integrated into update())
  private shockwaves: ShockwaveRing[] = [];
  private shockwaveGeo: THREE.RingGeometry;
  private shockwaveCursor = 0;

  // 6. World-Space Floating Damage Numbers + LRU Texture Cache
  private floatingDamages: FloatingDamage[] = [];
  private maxFloatingDamages = 28;
  private damageTexCache = new Map<string, THREE.CanvasTexture>();
  private maxDamageTexCache = 64;

  // Graphics Quality Scaling
  private particleScale = 1.0;
  private disableShells = false;

  // Scratch vectors (zero GC in loop)
  private _p1 = new THREE.Vector3();
  private _p2 = new THREE.Vector3();
  private _up = new THREE.Vector3(0, 0, 1);

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Tracers pool
    for (let i = 0; i < this.maxTracers; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1),
      ]);
      const mat = new THREE.LineBasicMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.92,
      });
      const line = new THREE.Line(geo, mat);
      line.visible = false;
      this.scene.add(line);

      this.tracers.push({
        mesh: line,
        start: new THREE.Vector3(),
        end: new THREE.Vector3(),
        progress: 0,
        speed: 140,
        active: false,
      });
    }

    // Sparks pool
    this.posArray = new Float32Array(this.maxParticles * 3);
    this.colorArray = new Float32Array(this.maxParticles * 3);

    this.particleGeo = new THREE.BufferGeometry();
    this.particleGeo.setAttribute('position', new THREE.BufferAttribute(this.posArray, 3));
    this.particleGeo.setAttribute('color', new THREE.BufferAttribute(this.colorArray, 3));
    this.particleGeo.setDrawRange(0, 0);

    const pCanvas = document.createElement('canvas');
    pCanvas.width = 64;
    pCanvas.height = 64;
    const pCtx = pCanvas.getContext('2d')!;
    const grad = pCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,210,120,0.85)');
    grad.addColorStop(0.75, 'rgba(0,210,255,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    pCtx.fillStyle = grad;
    pCtx.fillRect(0, 0, 64, 64);
    const pTex = new THREE.CanvasTexture(pCanvas);

    this.particleMat = new THREE.PointsMaterial({
      size: 0.24,
      map: pTex,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particlePoints = new THREE.Points(this.particleGeo, this.particleMat);
    this.particlePoints.frustumCulled = false;
    this.particlePoints.visible = false;
    this.scene.add(this.particlePoints);

    for (let i = 0; i < this.maxParticles; i++) {
      this.particlePool.push({
        position: new THREE.Vector3(0, -999, 0),
        velocity: new THREE.Vector3(),
        color: new THREE.Color(1, 1, 1),
        life: 0,
        maxLife: 1,
        active: false,
      });
    }

    // Brass & Shotgun Shell Casing Pool
    this.shellGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.048, 8);
    this.brassMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.22,
      metalness: 0.92,
    });
    this.shotgunHullMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.45,
      metalness: 0.2,
    });

    for (let i = 0; i < this.maxShells; i++) {
      const mesh = new THREE.Mesh(this.shellGeo, this.brassMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.shells.push({
        mesh,
        velocity: new THREE.Vector3(),
        angVel: new THREE.Vector3(),
        life: 0,
        maxLife: 2.2,
        bounces: 0,
        active: false,
      });
    }

    // Wall Bullet Hole Decal Pool
    this.decalGeo = new THREE.PlaneGeometry(0.16, 0.16);
    this.decalMat = new THREE.MeshBasicMaterial({
      map: createBulletDecalTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    for (let i = 0; i < this.maxDecals; i++) {
      const decal = new THREE.Mesh(this.decalGeo, this.decalMat);
      decal.visible = false;
      this.scene.add(decal);
      this.decals.push(decal);
    }

    // Pooled Shockwave Rings (8 simultaneous rings max)
    this.shockwaveGeo = new THREE.RingGeometry(0.28, 0.65, 32);
    this.shockwaveGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(this.shockwaveGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.shockwaves.push({
        mesh,
        mat,
        life: 0,
        maxLife: 0.42,
        maxScale: 15,
        active: false,
      });
    }
  }

  private nextParticleSlot(): Particle {
    for (let step = 0; step < this.maxParticles; step++) {
      const idx = (this.particleCursor + step) % this.maxParticles;
      if (!this.particlePool[idx].active) {
        this.particleCursor = (idx + 1) % this.maxParticles;
        return this.particlePool[idx];
      }
    }
    const p = this.particlePool[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % this.maxParticles;
    return p;
  }

  private spawnShockwave(pos: THREE.Vector3, colorHex: number, maxLife: number, maxScale: number) {
    const sw = this.shockwaves[this.shockwaveCursor];
    this.shockwaveCursor = (this.shockwaveCursor + 1) % this.shockwaves.length;
    sw.active = true;
    sw.life = 0;
    sw.maxLife = maxLife;
    sw.maxScale = maxScale;
    sw.mat.color.setHex(colorHex);
    sw.mat.opacity = 0.92;
    sw.mesh.position.set(pos.x, Math.max(0.14, pos.y + 0.1), pos.z);
    sw.mesh.scale.setScalar(1);
    sw.mesh.visible = true;
  }

  public addTracer(start: THREE.Vector3, end: THREE.Vector3, colorHex = 0x06b6d4) {
    let tracer: Tracer | null = null;
    for (let step = 0; step < this.maxTracers; step++) {
      const idx = (this.tracerCursor + step) % this.maxTracers;
      if (!this.tracers[idx].active) {
        this.tracerCursor = (idx + 1) % this.maxTracers;
        tracer = this.tracers[idx];
        break;
      }
    }
    if (!tracer) {
      tracer = this.tracers[this.tracerCursor];
      this.tracerCursor = (this.tracerCursor + 1) % this.maxTracers;
    }

    tracer.start.copy(start);
    tracer.end.copy(end);
    tracer.progress = 0;
    tracer.speed = 165;
    tracer.active = true;

    const mat = tracer.mesh.material as THREE.LineBasicMaterial;
    mat.color.setHex(colorHex);
    tracer.mesh.visible = true;
  }

  public setGraphicsPreset(preset: 'high' | 'medium' | 'potato') {
    if (preset === 'potato') {
      this.particleScale = 0.4;
      this.disableShells = true;
      for (let i = 0; i < this.shells.length; i++) {
        this.shells[i].active = false;
        this.shells[i].mesh.visible = false;
      }
    } else if (preset === 'medium') {
      this.particleScale = 0.68;
      this.disableShells = false;
    } else {
      this.particleScale = 1.0;
      this.disableShells = false;
    }
  }

  public addImpactSparks(pos: THREE.Vector3, normal: THREE.Vector3, isEnemyHit = false) {
    const baseCount = isEnemyHit ? 20 : 12;
    const count = Math.max(3, Math.round(baseCount * this.particleScale));
    for (let i = 0; i < count; i++) {
      const p = this.nextParticleSlot();
      p.active = true;
      p.position.copy(pos);
      p.life = 0;
      p.maxLife = 0.22 + Math.random() * 0.28;
      if (isEnemyHit) {
        p.color.setRGB(1.0, 0.18 + Math.random() * 0.2, 0.18);
      } else {
        p.color.setRGB(1.0, 0.72 + Math.random() * 0.25, 0.2);
      }

      const spread = 0.75;
      p.velocity
        .set(
          normal.x + (Math.random() - 0.5) * spread,
          normal.y + (Math.random() - 0.5) * spread + 0.35,
          normal.z + (Math.random() - 0.5) * spread
        )
        .normalize()
        .multiplyScalar(4.5 + Math.random() * 8.5);
    }
  }

  public addWallDecal(pos: THREE.Vector3, worldNormal: THREE.Vector3) {
    const decal = this.decals[this.decalCursor];
    this.decalCursor = (this.decalCursor + 1) % this.maxDecals;

    decal.position.copy(pos).addScaledVector(worldNormal, 0.012);
    decal.quaternion.setFromUnitVectors(this._up, worldNormal);
    decal.rotateZ(Math.random() * Math.PI * 2);
    const scale = 0.8 + Math.random() * 0.5;
    decal.scale.set(scale, scale, 1);
    decal.visible = true;
  }

  public ejectShell(
    origin: THREE.Vector3,
    right: THREE.Vector3,
    up: THREE.Vector3,
    forward: THREE.Vector3,
    isShotgun = false
  ) {
    if (this.disableShells) return;
    let shell: ShellCasing | null = null;
    for (let step = 0; step < this.maxShells; step++) {
      const idx = (this.shellCursor + step) % this.maxShells;
      if (!this.shells[idx].active) {
        this.shellCursor = (idx + 1) % this.maxShells;
        shell = this.shells[idx];
        break;
      }
    }
    if (!shell) return;

    shell.active = true;
    shell.life = 0;
    shell.maxLife = 2.4;
    shell.bounces = 0;

    shell.mesh.material = isShotgun ? this.shotgunHullMat : this.brassMat;
    const sc = isShotgun ? 1.35 : 1;
    shell.mesh.scale.set(sc, sc, sc);
    shell.mesh.position.copy(origin);
    shell.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    shell.mesh.visible = true;

    shell.velocity
      .copy(right)
      .multiplyScalar(2.4 + Math.random() * 1.1)
      .addScaledVector(up, 1.8 + Math.random() * 0.7)
      .addScaledVector(forward, -0.4 + (Math.random() - 0.5) * 0.4);

    shell.angVel.set(
      (Math.random() - 0.5) * 18,
      (Math.random() - 0.5) * 18,
      (Math.random() - 0.5) * 18
    );
  }

  public addExplosion(pos: THREE.Vector3) {
    const count = Math.max(12, Math.round(48 * this.particleScale));
    for (let i = 0; i < count; i++) {
      const p = this.nextParticleSlot();
      p.active = true;
      p.position.set(pos.x, pos.y + 1.0, pos.z);
      p.life = 0;
      p.maxLife = 0.45 + Math.random() * 0.45;

      if (Math.random() > 0.35) {
        p.color.setRGB(1.0, 0.45 + Math.random() * 0.3, 0.1);
      } else {
        p.color.setRGB(0.05, 0.85, 1.0);
      }

      p.velocity
        .set((Math.random() - 0.5) * 2, Math.random() * 1.8, (Math.random() - 0.5) * 2)
        .normalize()
        .multiplyScalar(5 + Math.random() * 10);
    }
  }

  public addFlashFragExplosion(pos: THREE.Vector3) {
    const count = Math.max(18, Math.round(72 * this.particleScale));
    for (let i = 0; i < count; i++) {
      const p = this.nextParticleSlot();
      p.active = true;
      p.position.set(pos.x, pos.y + 0.25, pos.z);
      p.life = 0;
      p.maxLife = 0.35 + Math.random() * 0.45;

      const r = Math.random();
      if (r > 0.55) {
        p.color.setRGB(0.95, 0.98, 1.0);
      } else if (r > 0.2) {
        p.color.setRGB(0.15, 0.88, 1.0);
      } else {
        p.color.setRGB(1.0, 0.7, 0.15);
      }

      p.velocity
        .set((Math.random() - 0.5) * 2, 0.25 + Math.random() * 1.5, (Math.random() - 0.5) * 2)
        .normalize()
        .multiplyScalar(7 + Math.random() * 14);
    }

    this.spawnShockwave(pos, 0x67e8f9, 0.42, 15);
  }

  public addBossEntranceMist(pos: THREE.Vector3) {
    const count = Math.max(24, Math.round(90 * this.particleScale));
    for (let i = 0; i < count; i++) {
      const p = this.nextParticleSlot();
      p.active = true;
      p.position.set(
        pos.x + (Math.random() - 0.5) * 3.4,
        pos.y + 0.25 + Math.random() * 2.2,
        pos.z + (Math.random() - 0.5) * 3.4
      );
      p.life = 0;
      p.maxLife = 0.8 + Math.random() * 0.9;

      if (Math.random() > 0.42) {
        p.color.setRGB(1.0, 0.12, 0.22);
      } else {
        p.color.setRGB(0.08, 0.92, 0.62);
      }

      p.velocity
        .set((Math.random() - 0.5) * 2, 0.4 + Math.random() * 1.4, (Math.random() - 0.5) * 2)
        .normalize()
        .multiplyScalar(3.5 + Math.random() * 7.5);
    }

    this.spawnShockwave(pos, 0xf43f5e, 0.72, 14);
  }

  private getDamageTexture(roundedAmount: number, isCrit: boolean): THREE.CanvasTexture {
    const key = `${roundedAmount}_${isCrit ? 1 : 0}`;
    const cached = this.damageTexCache.get(key);
    if (cached) {
      // Refresh LRU position
      this.damageTexCache.delete(key);
      this.damageTexCache.set(key, cached);
      return cached;
    }

    if (this.damageTexCache.size >= this.maxDamageTexCache) {
      const oldestKey = this.damageTexCache.keys().next().value;
      if (oldestKey !== undefined) {
        const oldTex = this.damageTexCache.get(oldestKey);
        this.damageTexCache.delete(oldestKey);
        oldTex?.dispose();
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const label = isCrit ? `${roundedAmount}!` : `${roundedAmount}`;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = isCrit
      ? '900 72px "JetBrains Mono", monospace'
      : '800 54px "JetBrains Mono", monospace';
    ctx.lineJoin = 'round';
    ctx.lineWidth = isCrit ? 11 : 8;
    ctx.strokeStyle = isCrit ? 'rgba(69, 10, 10, 0.96)' : 'rgba(2, 6, 23, 0.92)';
    ctx.strokeText(label, 128, 64);

    if (isCrit) {
      const grad = ctx.createLinearGradient(0, 24, 0, 104);
      grad.addColorStop(0, '#fef08a');
      grad.addColorStop(0.55, '#facc15');
      grad.addColorStop(1, '#ef4444');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = '#ffffff';
    }
    ctx.fillText(label, 128, 64);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.damageTexCache.set(key, tex);
    return tex;
  }

  public addFloatingDamage(pos: THREE.Vector3, amount: number, isCrit: boolean) {
    if (amount <= 0) return;
    if (this.floatingDamages.length >= this.maxFloatingDamages) {
      const oldest = this.floatingDamages.shift();
      if (oldest) {
        this.scene.remove(oldest.sprite);
        oldest.mat.dispose();
      }
    }

    const tex = this.getDamageTexture(Math.round(amount), isCrit);
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(
      pos.x + (Math.random() - 0.5) * 0.24,
      pos.y + 0.16,
      pos.z + (Math.random() - 0.5) * 0.24
    );
    const baseScaleX = isCrit ? 1.55 : 1.05;
    const baseScaleY = isCrit ? 0.78 : 0.52;
    sprite.scale.set(baseScaleX, baseScaleY, 1);
    sprite.renderOrder = 1000;
    this.scene.add(sprite);

    this.floatingDamages.push({
      sprite,
      mat,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.65,
        isCrit ? 2.15 : 1.65,
        (Math.random() - 0.5) * 0.65
      ),
      life: 0,
      maxLife: isCrit ? 0.8 : 0.65,
      baseScaleX,
      baseScaleY,
    });
  }

  public update(delta: number) {
    // 1. Tracers
    for (let i = 0; i < this.tracers.length; i++) {
      const tracer = this.tracers[i];
      if (!tracer.active) continue;

      const totalDist = tracer.start.distanceTo(tracer.end);
      tracer.progress += (tracer.speed * delta) / Math.max(0.001, totalDist);

      if (tracer.progress >= 1.0) {
        tracer.active = false;
        tracer.mesh.visible = false;
        continue;
      }

      const tailP = Math.max(0, tracer.progress - 0.22);
      const headP = Math.min(1, tracer.progress);

      this._p1.lerpVectors(tracer.start, tracer.end, tailP);
      this._p2.lerpVectors(tracer.start, tracer.end, headP);

      const posAttr = tracer.mesh.geometry.attributes.position as THREE.BufferAttribute;
      posAttr.setXYZ(0, this._p1.x, this._p1.y, this._p1.z);
      posAttr.setXYZ(1, this._p2.x, this._p2.y, this._p2.z);
      posAttr.needsUpdate = true;
    }

    // 2. Sparks (compact active range + zero upload when idle)
    let activeIndex = 0;
    const gravity = -11.5;

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particlePool[i];
      if (!p.active) continue;

      p.life += delta;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }

      p.velocity.y += gravity * delta;
      p.position.addScaledVector(p.velocity, delta);

      if (p.position.y < 0.04) {
        p.position.y = 0.04;
        p.velocity.y *= -0.45;
        p.velocity.x *= 0.72;
        p.velocity.z *= 0.72;
      }

      const lifeRatio = 1 - p.life / p.maxLife;
      const offset = activeIndex * 3;
      this.posArray[offset] = p.position.x;
      this.posArray[offset + 1] = p.position.y;
      this.posArray[offset + 2] = p.position.z;

      this.colorArray[offset] = p.color.r * lifeRatio;
      this.colorArray[offset + 1] = p.color.g * lifeRatio;
      this.colorArray[offset + 2] = p.color.b * lifeRatio;
      activeIndex++;
    }

    if (activeIndex > 0) {
      this.particlePoints.visible = true;
      this.particleGeo.setDrawRange(0, activeIndex);
      this.particleGeo.attributes.position.needsUpdate = true;
      this.particleGeo.attributes.color.needsUpdate = true;
      this.hadActiveParticles = true;
    } else if (this.hadActiveParticles) {
      this.particlePoints.visible = false;
      this.particleGeo.setDrawRange(0, 0);
      this.hadActiveParticles = false;
    }

    // 3. Pooled Shockwave Rings
    for (let i = 0; i < this.shockwaves.length; i++) {
      const sw = this.shockwaves[i];
      if (!sw.active) continue;
      sw.life += delta;
      const t = sw.life / sw.maxLife;
      if (t >= 1) {
        sw.active = false;
        sw.mesh.visible = false;
      } else {
        sw.mesh.scale.setScalar(1 + t * sw.maxScale);
        sw.mat.opacity = (1 - t) * 0.92;
      }
    }

    // 4. Ejected Shell Casings
    for (let i = 0; i < this.shells.length; i++) {
      const s = this.shells[i];
      if (!s.active) continue;

      s.life += delta;
      if (s.life >= s.maxLife) {
        s.active = false;
        s.mesh.visible = false;
        continue;
      }

      s.velocity.y -= 13.5 * delta;
      s.mesh.position.addScaledVector(s.velocity, delta);
      s.mesh.rotation.x += s.angVel.x * delta;
      s.mesh.rotation.y += s.angVel.y * delta;
      s.mesh.rotation.z += s.angVel.z * delta;

      if (s.mesh.position.y <= 0.025) {
        s.mesh.position.y = 0.025;
        if (s.bounces === 0) {
          soundSystem.playShellClink();
        }
        s.bounces++;
        s.velocity.y *= -0.42;
        s.velocity.x *= 0.65;
        s.velocity.z *= 0.65;
        s.angVel.multiplyScalar(0.5);
      }
    }

    // 5. Floating Damage Numbers
    for (let i = this.floatingDamages.length - 1; i >= 0; i--) {
      const fd = this.floatingDamages[i];
      fd.life += delta;
      if (fd.life >= fd.maxLife) {
        this.scene.remove(fd.sprite);
        fd.mat.dispose();
        this.floatingDamages.splice(i, 1);
        continue;
      }

      const t = fd.life / fd.maxLife;
      fd.velocity.y = Math.max(0.45, fd.velocity.y - delta * 1.4);
      fd.sprite.position.addScaledVector(fd.velocity, delta);
      const pop = t < 0.16 ? 0.85 + (t / 0.16) * 0.35 : 1.2 - (t - 0.16) * 0.26;
      fd.sprite.scale.set(fd.baseScaleX * pop, fd.baseScaleY * pop, 1);
      fd.mat.opacity = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.4);
    }
  }

  public dispose() {
    this.tracers.forEach((t) => {
      this.scene.remove(t.mesh);
      t.mesh.geometry.dispose();
      (t.mesh.material as THREE.Material).dispose();
    });
    this.shells.forEach((s) => this.scene.remove(s.mesh));
    this.shellGeo.dispose();
    this.brassMat.dispose();
    this.shotgunHullMat.dispose();

    this.decals.forEach((d) => this.scene.remove(d));
    this.decalGeo.dispose();
    this.decalMat.dispose();

    this.shockwaves.forEach((sw) => {
      this.scene.remove(sw.mesh);
      sw.mat.dispose();
    });
    this.shockwaveGeo.dispose();

    this.floatingDamages.forEach((fd) => {
      this.scene.remove(fd.sprite);
      fd.mat.dispose();
    });
    this.floatingDamages = [];

    this.damageTexCache.forEach((tex) => tex.dispose());
    this.damageTexCache.clear();

    this.scene.remove(this.particlePoints);
    this.particleGeo.dispose();
    this.particleMat.map?.dispose();
    this.particleMat.dispose();
  }
}
