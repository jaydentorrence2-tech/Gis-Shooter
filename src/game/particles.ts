/**
 * Advanced Pooled VFX System for GIS Shooter: Tactical Edition
 * - Glowing Bullet Tracers
 * - Additive Impact Sparks & Elimination Explosions
 * - Ejected Brass & Shotgun Shell Casings with Floor Bounce + Clink
 * - Persistent Surface Bullet Hole Decals
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

interface FloatingDamage {
  sprite: THREE.Sprite;
  tex: THREE.CanvasTexture;
  mat: THREE.SpriteMaterial;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  baseScaleX: number;
  baseScaleY: number;
}

export class ParticleSystem {
  private scene: THREE.Scene;

  // 1. Tracers
  private tracers: Tracer[] = [];
  private maxTracers = 48;

  // 2. Sparks & Debris Points
  private maxParticles = 700;
  private particleGeo: THREE.BufferGeometry;
  private particleMat: THREE.PointsMaterial;
  private particlePoints: THREE.Points;
  private particlePool: Particle[] = [];
  private posArray: Float32Array;
  private colorArray: Float32Array;

  // 3. Ejected Brass / Shotgun Shell Casings
  private shells: ShellCasing[] = [];
  private maxShells = 36;
  private shellGeo: THREE.CylinderGeometry;
  private brassMat: THREE.MeshStandardMaterial;
  private shotgunHullMat: THREE.MeshStandardMaterial;

  // 4. Bullet Hole Decals (Ring Buffer Pool)
  private decals: THREE.Mesh[] = [];
  private maxDecals = 64;
  private decalCursor = 0;
  private decalGeo: THREE.PlaneGeometry;
  private decalMat: THREE.MeshBasicMaterial;

  // 5. World-Space Floating Damage Numbers
  private floatingDamages: FloatingDamage[] = [];
  private maxFloatingDamages = 28;

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
  }

  public addTracer(start: THREE.Vector3, end: THREE.Vector3, colorHex = 0x06b6d4) {
    const tracer = this.tracers.find((t) => !t.active);
    if (!tracer) return;

    tracer.start.copy(start);
    tracer.end.copy(end);
    tracer.progress = 0;
    tracer.speed = 165;
    tracer.active = true;

    const mat = tracer.mesh.material as THREE.LineBasicMaterial;
    mat.color.setHex(colorHex);
    tracer.mesh.visible = true;
  }

  public addImpactSparks(pos: THREE.Vector3, normal: THREE.Vector3, isEnemyHit = false) {
    const count = isEnemyHit ? 20 : 12;
    for (let i = 0; i < count; i++) {
      const p = this.particlePool.find((part) => !part.active);
      if (!p) break;

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
    const shell = this.shells.find((s) => !s.active);
    if (!shell) return;

    shell.active = true;
    shell.life = 0;
    shell.maxLife = 2.4;
    shell.bounces = 0;

    shell.mesh.material = isShotgun ? this.shotgunHullMat : this.brassMat;
    shell.mesh.scale.set(isShotgun ? 1.35 : 1, isShotgun ? 1.35 : 1, isShotgun ? 1.35 : 1);
    shell.mesh.position.copy(origin);
    shell.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    shell.mesh.visible = true;

    // Eject to the right and slightly upward/backward
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
    const count = 48;
    for (let i = 0; i < count; i++) {
      const p = this.particlePool.find((part) => !part.active);
      if (!p) break;

      p.active = true;
      p.position.copy(pos).add(new THREE.Vector3(0, 1.0, 0));
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
    // High-energy cyan/white/amber radial concussion burst
    const count = 72;
    for (let i = 0; i < count; i++) {
      const p = this.particlePool.find((part) => !part.active);
      if (!p) break;

      p.active = true;
      p.position.copy(pos).add(new THREE.Vector3(0, 0.25, 0));
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

    // Expanding shockwave ring + flash light
    const ringGeo = new THREE.RingGeometry(0.25, 0.6, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(pos).setY(Math.max(0.15, pos.y + 0.1));
    this.scene.add(ring);

    const flash = new THREE.PointLight(0x7dd3fc, 28, 22, 1.6);
    flash.position.copy(pos).add(new THREE.Vector3(0, 0.6, 0));
    this.scene.add(flash);

    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 420;
      if (t >= 1) {
        this.scene.remove(ring);
        this.scene.remove(flash);
        ringGeo.dispose();
        ringMat.dispose();
        return;
      }
      const scale = 1 + t * 15;
      ring.scale.setScalar(scale);
      ringMat.opacity = (1 - t) * 0.9;
      flash.intensity = (1 - t) * 28;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  public addBossEntranceMist(pos: THREE.Vector3) {
    const count = 90;
    for (let i = 0; i < count; i++) {
      const p = this.particlePool.find((part) => !part.active);
      if (!p) break;

      p.active = true;
      p.position.copy(pos).add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 3.4,
          0.25 + Math.random() * 2.2,
          (Math.random() - 0.5) * 3.4
        )
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

    const ringGeo = new THREE.RingGeometry(0.4, 0.85, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(pos.x, 0.14, pos.z);
    this.scene.add(ring);

    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 720;
      if (t >= 1) {
        this.scene.remove(ring);
        ringGeo.dispose();
        ringMat.dispose();
        return;
      }
      ring.scale.setScalar(1 + t * 14);
      ringMat.opacity = (1 - t) * 0.92;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  public addFloatingDamage(pos: THREE.Vector3, amount: number, isCrit: boolean) {
    if (amount <= 0) return;
    if (this.floatingDamages.length >= this.maxFloatingDamages) {
      const oldest = this.floatingDamages.shift();
      if (oldest) {
        this.scene.remove(oldest.sprite);
        oldest.tex.dispose();
        oldest.mat.dispose();
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const label = isCrit ? `${Math.round(amount)}!` : `${Math.round(amount)}`;

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
      tex,
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

    // 2. Sparks
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
      this.posArray[activeIndex * 3] = p.position.x;
      this.posArray[activeIndex * 3 + 1] = p.position.y;
      this.posArray[activeIndex * 3 + 2] = p.position.z;

      this.colorArray[activeIndex * 3] = p.color.r * lifeRatio;
      this.colorArray[activeIndex * 3 + 1] = p.color.g * lifeRatio;
      this.colorArray[activeIndex * 3 + 2] = p.color.b * lifeRatio;
      activeIndex++;
    }

    for (let i = activeIndex; i < this.maxParticles; i++) {
      this.posArray[i * 3] = 0;
      this.posArray[i * 3 + 1] = -999;
      this.posArray[i * 3 + 2] = 0;
    }

    this.particleGeo.attributes.position.needsUpdate = true;
    this.particleGeo.attributes.color.needsUpdate = true;

    // 3. Ejected Shell Casings
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

    // 4. Floating Damage Numbers
    for (let i = this.floatingDamages.length - 1; i >= 0; i--) {
      const fd = this.floatingDamages[i];
      fd.life += delta;
      if (fd.life >= fd.maxLife) {
        this.scene.remove(fd.sprite);
        fd.tex.dispose();
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

    this.floatingDamages.forEach((fd) => {
      this.scene.remove(fd.sprite);
      fd.tex.dispose();
      fd.mat.dispose();
    });
    this.floatingDamages = [];

    this.scene.remove(this.particlePoints);
    this.particleGeo.dispose();
    this.particleMat.dispose();
  }
}
