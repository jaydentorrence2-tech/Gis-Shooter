/**
 * High-Resolution Procedural Canvas Textures & Bump Maps for GIS Shooter: Tactical Edition
 * 100% self-generated: Albedo maps use SRGBColorSpace, Bump maps use linear space.
 */

import * as THREE from 'three';

const textureCache: Record<string, THREE.CanvasTexture> = {};

function configureTexture(tex: THREE.CanvasTexture, isAlbedo: boolean, maxAnisotropy = 8) {
  if (isAlbedo) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Tactical Concrete Floor Albedo + Matching Bump Map
 * Features expansion joints, concrete speckle grain, zone borders, and cyber-night markings.
 */
export function createFloorTextures(maxAnisotropy = 8): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  if (textureCache['floor_albedo'] && textureCache['floor_bump']) {
    return {
      map: textureCache['floor_albedo'],
      bumpMap: textureCache['floor_bump'],
    };
  }

  const size = 1024;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const actx = albedoCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d')!;

  // Base concrete slate
  actx.fillStyle = '#181e28';
  actx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  // Subtle concrete aggregate noise
  for (let i = 0; i < 16000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = Math.random();
    actx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.08)';
    actx.fillRect(x, y, 2, 2);

    const bv = Math.floor(110 + v * 36);
    bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bctx.fillRect(x, y, 2, 2);
  }

  // Modular 256x256 concrete slabs
  const tile = 256;
  for (let x = 0; x < size; x += tile) {
    for (let y = 0; y < size; y += tile) {
      // Recessed expansion seam
      actx.strokeStyle = '#0c1017';
      actx.lineWidth = 6;
      actx.strokeRect(x, y, tile, tile);

      bctx.strokeStyle = '#202020';
      bctx.lineWidth = 6;
      bctx.strokeRect(x, y, tile, tile);

      // Inner bevel trim
      actx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      actx.lineWidth = 2;
      actx.strokeRect(x + 12, y + 12, tile - 24, tile - 24);

      bctx.strokeStyle = '#a0a0a0';
      bctx.lineWidth = 2;
      bctx.strokeRect(x + 12, y + 12, tile - 24, tile - 24);

      // Tactical zone marking lines on alternating tiles
      if ((x / tile + y / tile) % 2 === 0) {
        actx.fillStyle = 'rgba(6, 182, 212, 0.35)';
        actx.fillRect(x + 28, y + tile - 34, 68, 4);

        actx.fillStyle = 'rgba(245, 158, 11, 0.45)';
        actx.fillRect(x + tile - 52, y + 28, 24, 4);

        // Stencil coordinate
        actx.fillStyle = 'rgba(148, 163, 184, 0.25)';
        actx.font = 'bold 14px monospace';
        actx.fillText(`SEC-${x / tile}${y / tile}`, x + 28, y + 40);
      }

      // Corner anchor bolts
      const bolts = [
        [x + 18, y + 18],
        [x + tile - 18, y + 18],
        [x + 18, y + tile - 18],
        [x + tile - 18, y + tile - 18],
      ];
      bolts.forEach(([bx, by]) => {
        actx.fillStyle = '#334155';
        actx.beginPath();
        actx.arc(bx, by, 3, 0, Math.PI * 2);
        actx.fill();

        bctx.fillStyle = '#d8d8d8';
        bctx.beginPath();
        bctx.arc(bx, by, 3, 0, Math.PI * 2);
        bctx.fill();
      });
    }
  }

  const map = configureTexture(new THREE.CanvasTexture(albedoCanvas), true, maxAnisotropy);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bumpMap = configureTexture(new THREE.CanvasTexture(bumpCanvas), false, maxAnisotropy);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  textureCache['floor_albedo'] = map;
  textureCache['floor_bump'] = bumpMap;
  return { map, bumpMap };
}

/**
 * Reinforced Sci-Fi Metal Wall Panels + Procedural Bump Map
 */
export function createWallTextures(maxAnisotropy = 8): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  if (textureCache['wall_albedo'] && textureCache['wall_bump']) {
    return {
      map: textureCache['wall_albedo'],
      bumpMap: textureCache['wall_bump'],
    };
  }

  const size = 512;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const actx = albedoCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d')!;

  actx.fillStyle = '#1b222e';
  actx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#707070';
  bctx.fillRect(0, 0, size, size);

  const panelH = 128;
  for (let y = 0; y < size; y += panelH) {
    // Raised armor plating
    actx.fillStyle = y % 256 === 0 ? '#232c3b' : '#1e2634';
    actx.fillRect(6, y + 6, size - 12, panelH - 12);

    bctx.fillStyle = '#b0b0b0';
    bctx.fillRect(6, y + 6, size - 12, panelH - 12);

    // Recessed vertical vents
    for (let vx = 32; vx < size - 48; vx += 64) {
      actx.fillStyle = '#111620';
      actx.fillRect(vx, y + 26, 36, panelH - 52);
      bctx.fillStyle = '#383838';
      bctx.fillRect(vx, y + 26, 36, panelH - 52);
    }

    // Panel seam
    actx.strokeStyle = '#090d14';
    actx.lineWidth = 6;
    actx.strokeRect(0, y, size, panelH);

    bctx.strokeStyle = '#181818';
    bctx.lineWidth = 6;
    bctx.strokeRect(0, y, size, panelH);

    // Rivet line
    for (let rx = 20; rx < size - 16; rx += 32) {
      actx.fillStyle = '#475569';
      actx.beginPath();
      actx.arc(rx, y + 14, 2.5, 0, Math.PI * 2);
      actx.arc(rx, y + panelH - 14, 2.5, 0, Math.PI * 2);
      actx.fill();

      bctx.fillStyle = '#f0f0f0';
      bctx.beginPath();
      bctx.arc(rx, y + 14, 2.5, 0, Math.PI * 2);
      bctx.arc(rx, y + panelH - 14, 2.5, 0, Math.PI * 2);
      bctx.fill();
    }
  }

  // Glowing cyan/amber accent line
  actx.fillStyle = '#06b6d4';
  actx.fillRect(16, 248, size - 32, 4);
  actx.fillStyle = '#f59e0b';
  actx.font = 'bold 20px monospace';
  actx.fillText('GIS-FACILITY // SECTOR 07', 24, 232);

  const map = configureTexture(new THREE.CanvasTexture(albedoCanvas), true, maxAnisotropy);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bumpMap = configureTexture(new THREE.CanvasTexture(bumpCanvas), false, maxAnisotropy);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  textureCache['wall_albedo'] = map;
  textureCache['wall_bump'] = bumpMap;
  return { map, bumpMap };
}

/**
 * Industrial Cargo Crate Albedo + Bump Map
 */
export function createCrateTextures(tint = '#f59e0b', maxAnisotropy = 8): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const key = `crate_${tint}`;
  if (textureCache[`${key}_albedo`] && textureCache[`${key}_bump`]) {
    return {
      map: textureCache[`${key}_albedo`],
      bumpMap: textureCache[`${key}_bump`],
    };
  }

  const size = 512;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const actx = albedoCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d')!;

  // Base metallic slate
  actx.fillStyle = '#1d2330';
  actx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#606060';
  bctx.fillRect(0, 0, size, size);

  // Outer raised frame
  actx.fillStyle = '#2d3748';
  actx.fillRect(16, 16, size - 32, size - 32);
  bctx.fillStyle = '#c0c0c0';
  bctx.fillRect(16, 16, size - 32, size - 32);

  // Inner recessed steel plate
  actx.fillStyle = '#161b24';
  actx.fillRect(48, 48, size - 96, size - 96);
  bctx.fillStyle = '#787878';
  bctx.fillRect(48, 48, size - 96, size - 96);

  // Corrugated horizontal ribs on inner plate
  for (let ry = 80; ry < size - 80; ry += 28) {
    actx.fillStyle = '#1f2735';
    actx.fillRect(64, ry, size - 128, 12);
    bctx.fillStyle = '#a8a8a8';
    bctx.fillRect(64, ry, size - 128, 12);
  }

  // Accent stenciling
  actx.fillStyle = tint;
  actx.textAlign = 'center';
  actx.font = '900 34px monospace';
  actx.fillText('GIS TACTICAL', 256, 200);
  actx.font = '700 18px monospace';
  actx.fillText('ORDNANCE CONTAINER', 256, 236);

  // Hazard bar at base
  for (let x = 80; x < 420; x += 30) {
    actx.fillStyle = tint;
    actx.beginPath();
    actx.moveTo(x, 380);
    actx.lineTo(x + 15, 380);
    actx.lineTo(x + 5, 404);
    actx.lineTo(x - 10, 404);
    actx.closePath();
    actx.fill();
  }

  const map = configureTexture(new THREE.CanvasTexture(albedoCanvas), true, maxAnisotropy);
  const bumpMap = configureTexture(new THREE.CanvasTexture(bumpCanvas), false, maxAnisotropy);

  textureCache[`${key}_albedo`] = map;
  textureCache[`${key}_bump`] = bumpMap;
  return { map, bumpMap };
}

/**
 * Yellow & Black Hazard Stripes Texture
 */
export function createHazardTexture(maxAnisotropy = 8): THREE.CanvasTexture {
  if (textureCache['hazard']) return textureCache['hazard'];

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = '#f59e0b';
  const stripe = 32;
  for (let i = -256; i < 512; i += stripe * 2) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + stripe, 0);
    ctx.lineTo(i + stripe + 256, 256);
    ctx.lineTo(i + 256, 256);
    ctx.closePath();
    ctx.fill();
  }

  const texture = configureTexture(new THREE.CanvasTexture(canvas), true, maxAnisotropy);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  textureCache['hazard'] = texture;
  return texture;
}

/**
 * Procedural Bullet Impact Hole Decal Texture
 */
export function createBulletDecalTexture(): THREE.CanvasTexture {
  if (textureCache['bullet_decal']) return textureCache['bullet_decal'];

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 128, 128);

  // Outer scorch ring
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 58);
  grad.addColorStop(0, 'rgba(10, 12, 16, 0.98)');
  grad.addColorStop(0.28, 'rgba(20, 24, 30, 0.85)');
  grad.addColorStop(0.55, 'rgba(30, 35, 42, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(64, 64, 58, 0, Math.PI * 2);
  ctx.fill();

  // Radial fracture cracks
  ctx.strokeStyle = 'rgba(15, 18, 24, 0.85)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
    const len = 24 + Math.random() * 24;
    ctx.beginPath();
    ctx.moveTo(64 + Math.cos(a) * 10, 64 + Math.sin(a) * 10);
    ctx.lineTo(64 + Math.cos(a) * len, 64 + Math.sin(a) * len);
    ctx.stroke();
  }

  // Dark bullet crater center
  ctx.fillStyle = '#05070a';
  ctx.beginPath();
  ctx.arc(64, 64, 12, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache['bullet_decal'] = tex;
  return tex;
}

/**
 * Sci-Fi Cyber Night Sky Dome Gradient + Starfield Texture
 */
export function createSkyDomeTexture(): THREE.CanvasTexture {
  if (textureCache['skydome']) return textureCache['skydome'];

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#04070d');
  grad.addColorStop(0.45, '#09111e');
  grad.addColorStop(0.75, '#0f1c2e');
  grad.addColorStop(1.0, '#0c1017');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // Subtle stars in upper hemisphere
  for (let i = 0; i < 380; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 280;
    const alpha = 0.25 + Math.random() * 0.7;
    ctx.fillStyle = Math.random() > 0.85 ? `rgba(56, 189, 248, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
    const r = Math.random() > 0.9 ? 1.8 : 1.0;
    ctx.fillRect(x, y, r, r);
  }

  // Horizon cyber grid glow band
  const hGlow = ctx.createLinearGradient(0, 290, 0, 390);
  hGlow.addColorStop(0, 'rgba(6, 182, 212, 0)');
  hGlow.addColorStop(0.5, 'rgba(6, 182, 212, 0.14)');
  hGlow.addColorStop(1, 'rgba(245, 158, 11, 0.06)');
  ctx.fillStyle = hGlow;
  ctx.fillRect(0, 290, 1024, 100);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache['skydome'] = tex;
  return tex;
}

/**
 * Giant Hangar Blast Door Texture with "GIS DEPLOYMENT BAY" Stencil & Hydraulic Plating
 */
export function createBlastDoorTexture(maxAnisotropy = 8): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  if (textureCache['blast_door_albedo'] && textureCache['blast_door_bump']) {
    return {
      map: textureCache['blast_door_albedo'],
      bumpMap: textureCache['blast_door_bump'],
    };
  }

  const w = 1024;
  const h = 1024;
  const ac = document.createElement('canvas');
  ac.width = w;
  ac.height = h;
  const ctx = ac.getContext('2d')!;

  const bc = document.createElement('canvas');
  bc.width = w;
  bc.height = h;
  const bctx = bc.getContext('2d')!;

  // Brushed dark titanium base
  ctx.fillStyle = '#151c26';
  ctx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#707070';
  bctx.fillRect(0, 0, w, h);

  // Outer structural frame
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(24, 24, w - 48, h - 48);
  bctx.fillStyle = '#b8b8b8';
  bctx.fillRect(24, 24, w - 48, h - 48);

  // Recessed twin blast leaves
  ctx.fillStyle = '#101620';
  ctx.fillRect(54, 210, 444, 710);
  ctx.fillRect(526, 210, 444, 710);
  bctx.fillStyle = '#505050';
  bctx.fillRect(54, 210, 444, 710);
  bctx.fillRect(526, 210, 444, 710);

  // Horizontal armor ribs across both leaves
  for (let y = 260; y < 890; y += 110) {
    ctx.fillStyle = '#1c2432';
    ctx.fillRect(74, y, 404, 74);
    ctx.fillRect(546, y, 404, 74);
    bctx.fillStyle = '#9a9a9a';
    bctx.fillRect(74, y, 404, 74);
    bctx.fillRect(546, y, 404, 74);
  }

  // Center interlocking vertical seam + cyan lock LED strip
  ctx.fillStyle = '#06090f';
  ctx.fillRect(498, 200, 28, 740);
  ctx.fillStyle = '#06b6d4';
  ctx.fillRect(508, 220, 8, 700);

  // Header Stencil Banner: "GIS DEPLOYMENT BAY"
  ctx.fillStyle = '#0c111a';
  ctx.fillRect(54, 52, w - 108, 132);
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 4;
  ctx.strokeRect(54, 52, w - 108, 132);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '900 62px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GIS DEPLOYMENT BAY', w / 2, 108);

  ctx.fillStyle = '#f59e0b';
  ctx.font = '700 22px monospace';
  ctx.fillText('SECTOR 07  //  TACTICAL AIRLOCK READY', w / 2, 156);

  // Bottom Amber/Black Hazard Chevron Strip
  ctx.fillStyle = '#090d14';
  ctx.fillRect(48, 932, w - 96, 48);
  ctx.save();
  ctx.beginPath();
  ctx.rect(48, 932, w - 96, 48);
  ctx.clip();
  ctx.fillStyle = '#f59e0b';
  for (let x = -40; x < w + 40; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x, 932);
    ctx.lineTo(x + 22, 932);
    ctx.lineTo(x - 6, 980);
    ctx.lineTo(x - 28, 980);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Rivets along outer header
  for (let rx = 72; rx <= w - 72; rx += 64) {
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(rx, 38, 4, 0, Math.PI * 2);
    ctx.fill();
    bctx.fillStyle = '#e5e5e5';
    bctx.beginPath();
    bctx.arc(rx, 38, 4, 0, Math.PI * 2);
    bctx.fill();
  }

  const map = configureTexture(new THREE.CanvasTexture(ac), true, maxAnisotropy);
  const bumpMap = configureTexture(new THREE.CanvasTexture(bc), false, maxAnisotropy);
  textureCache['blast_door_albedo'] = map;
  textureCache['blast_door_bump'] = bumpMap;
  return { map, bumpMap };
}

/**
 * Dark Metallic Hangar Floor Decking Texture
 */
export function createHangarDeckTexture(maxAnisotropy = 8): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  if (textureCache['hangar_deck_albedo'] && textureCache['hangar_deck_bump']) {
    return {
      map: textureCache['hangar_deck_albedo'],
      bumpMap: textureCache['hangar_deck_bump'],
    };
  }

  const size = 512;
  const ac = document.createElement('canvas');
  ac.width = size;
  ac.height = size;
  const ctx = ac.getContext('2d')!;

  const bc = document.createElement('canvas');
  bc.width = size;
  bc.height = size;
  const bctx = bc.getContext('2d')!;

  ctx.fillStyle = '#111722';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#686868';
  bctx.fillRect(0, 0, size, size);

  const step = 128;
  for (let x = 0; x < size; x += step) {
    for (let y = 0; y < size; y += step) {
      ctx.fillStyle = (x / step + y / step) % 2 === 0 ? '#161e2c' : '#131a26';
      ctx.fillRect(x + 4, y + 4, step - 8, step - 8);
      bctx.fillStyle = '#909090';
      bctx.fillRect(x + 4, y + 4, step - 8, step - 8);

      // Subtle diamond anti-slip tread
      ctx.fillStyle = 'rgba(148, 163, 184, 0.06)';
      bctx.fillStyle = '#b4b4b4';
      for (let tx = x + 16; tx < x + step - 12; tx += 16) {
        for (let ty = y + 16; ty < y + step - 12; ty += 16) {
          ctx.fillRect(tx, ty, 5, 2);
          bctx.fillRect(tx, ty, 5, 2);
        }
      }

      ctx.strokeStyle = '#070a10';
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, step, step);
      bctx.strokeStyle = '#202020';
      bctx.lineWidth = 4;
      bctx.strokeRect(x, y, step, step);
    }
  }

  const map = configureTexture(new THREE.CanvasTexture(ac), true, maxAnisotropy);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  const bumpMap = configureTexture(new THREE.CanvasTexture(bc), false, maxAnisotropy);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  textureCache['hangar_deck_albedo'] = map;
  textureCache['hangar_deck_bump'] = bumpMap;
  return { map, bumpMap };
}

