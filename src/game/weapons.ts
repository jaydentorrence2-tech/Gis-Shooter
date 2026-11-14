/**
 * Tactical Weapon Definitions & Ultra-Detailed Multi-Component PBR Viewmodel Builders
 * Slots:
 *  1: AR-X7 Tactical (Assault Rifle)
 *  2: Vector-V9 Tactical (Suppressed High-ROF SMG)
 *  3: SG-12 Breach (Pump-Action Shotgun)
 *  4: SR-50 Marksman (Bolt-Action Suppressed Sniper)
 *  5: .50 Desert Python (Heavy Magnum Pistol)
 *  6: M84 Flash-Frag (Concussion Stun-Frag Grenade)
 *  7: Nano-Medkit (Bio-Gel Syringe)
 */

import * as THREE from 'three';

export type WeaponType = 'rifle' | 'smg' | 'shotgun' | 'sniper' | 'pistol' | 'grenade' | 'medkit';

export interface WeaponDef {
  id: string;
  name: string;
  shortName: string;
  type: WeaponType;
  slot: number;
  damage: number;
  pellets?: number;
  fireRate: number;
  magSize: number;
  maxReserve: number;
  currentAmmo: number;
  reserveAmmo: number;
  reloadTime: number;
  spread: number;
  adsSpread: number;
  adsFov: number;
  range: number;
  caliber: string;
  description: string;
}

export const INITIAL_WEAPONS: WeaponDef[] = [
  {
    id: 'ar_x7',
    name: 'AR-X7 Tactical',
    shortName: 'AR-X7',
    type: 'rifle',
    slot: 1,
    damage: 32,
    fireRate: 0.105,
    magSize: 30,
    maxReserve: 150,
    currentAmmo: 30,
    reserveAmmo: 120,
    reloadTime: 1.75,
    spread: 0.036,
    adsSpread: 0.006,
    adsFov: 54,
    range: 130,
    caliber: '6.8MM SPC',
    description:
      'Modular assault carbine with moving bolt carrier, charging handle, holographic reflex optic, laser sight, and tactical light.',
  },
  {
    id: 'vector_v9',
    name: 'Vector-V9 Tactical',
    shortName: 'VECTOR-V9',
    type: 'smg',
    slot: 2,
    damage: 21,
    fireRate: 0.062,
    magSize: 36,
    maxReserve: 180,
    currentAmmo: 36,
    reserveAmmo: 144,
    reloadTime: 1.45,
    spread: 0.044,
    adsSpread: 0.014,
    adsFov: 58,
    range: 75,
    caliber: '9MM AP',
    description:
      'Compact CQB submachine gun with blistering 960 RPM cyclic rate, integrated suppressor, straight stick mag, and micro red-dot.',
  },
  {
    id: 'sg_12',
    name: 'SG-12 Breach',
    shortName: 'SG-12',
    type: 'shotgun',
    slot: 3,
    damage: 19,
    pellets: 8,
    fireRate: 0.78,
    magSize: 8,
    maxReserve: 40,
    currentAmmo: 8,
    reserveAmmo: 32,
    reloadTime: 2.1,
    spread: 0.088,
    adsSpread: 0.048,
    adsFov: 60,
    range: 46,
    caliber: '12 GAUGE',
    description:
      'Pump-action tactical shotgun with ventilated barrel heat shield, animated pump forend, bolt carrier, and underbarrel torch.',
  },
  {
    id: 'sr_50',
    name: 'SR-50 Marksman',
    shortName: 'SR-50',
    type: 'sniper',
    slot: 4,
    damage: 95,
    fireRate: 1.05,
    magSize: 5,
    maxReserve: 25,
    currentAmmo: 5,
    reserveAmmo: 20,
    reloadTime: 2.35,
    spread: 0.055,
    adsSpread: 0.0008,
    adsFov: 26,
    range: 220,
    caliber: '.338 SUPP',
    description:
      'Long-range precision marksman rifle with integral suppressor, variable 8x reflective optic scope, bolt handle, and folding bipod.',
  },
  {
    id: 'desert_python',
    name: '.50 Desert Python',
    shortName: '.50 PYTHON',
    type: 'pistol',
    slot: 5,
    damage: 58,
    fireRate: 0.34,
    magSize: 7,
    maxReserve: 42,
    currentAmmo: 7,
    reserveAmmo: 35,
    reloadTime: 1.35,
    spread: 0.026,
    adsSpread: 0.004,
    adsFov: 60,
    range: 95,
    caliber: '.50 AE MAG',
    description:
      'Heavy magnum sidearm featuring brushed steel reciprocating slide with last-shot hold-open, rib barrel, and underbarrel laser.',
  },
  {
    id: 'flash_frag',
    name: 'M84 Flash-Frag',
    shortName: 'FLASH-FRAG',
    type: 'grenade',
    slot: 6,
    damage: 145,
    fireRate: 0.9,
    magSize: 3,
    maxReserve: 4,
    currentAmmo: 2,
    reserveAmmo: 0,
    reloadTime: 0.6,
    spread: 0,
    adsSpread: 0,
    adsFov: 68,
    range: 36,
    caliber: 'CONCUSSION',
    description:
      'Dual-stage tactical grenade that deals 145 blast damage in a 9.5m radius and stuns surviving hostiles for 2.5s.',
  },
  {
    id: 'nano_medkit',
    name: 'Nano-Medkit',
    shortName: 'MEDKIT',
    type: 'medkit',
    slot: 7,
    damage: 0,
    fireRate: 1.0,
    magSize: 1,
    maxReserve: 3,
    currentAmmo: 2,
    reserveAmmo: 2,
    reloadTime: 0.5,
    spread: 0,
    adsSpread: 0,
    adsFov: 68,
    range: 0,
    caliber: 'BIO-GEL',
    description:
      'Pressurized nanite combat injector restoring +60 HP and +35 Armor immediately on activation.',
  },
];

// --- Procedural PBR Surface Wear & Grip Textures (Cached Once) ---
interface WeaponMaterials {
  gunmetal: THREE.MeshStandardMaterial;
  darkSteel: THREE.MeshStandardMaterial;
  polymer: THREE.MeshStandardMaterial;
  tanPolymer: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  cyanEmit: THREE.MeshStandardMaterial;
  amberEmit: THREE.MeshStandardMaterial;
  emeraldEmit: THREE.MeshStandardMaterial;
  redEmit: THREE.MeshStandardMaterial;
  flashlightLens: THREE.MeshStandardMaterial;
  opticGlass: THREE.MeshPhysicalMaterial;
  medGlass: THREE.MeshPhysicalMaterial;
  laserBeamMat: THREE.MeshBasicMaterial;
  laserDotMat: THREE.MeshBasicMaterial;
}

let cachedMats: WeaponMaterials | null = null;

function createWearMaps(): { roughMap: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const s = 256;
  const rc = document.createElement('canvas');
  const bc = document.createElement('canvas');
  rc.width = rc.height = s;
  bc.width = bc.height = s;
  const rx = rc.getContext('2d')!;
  const bx = bc.getContext('2d')!;

  rx.fillStyle = '#525252';
  rx.fillRect(0, 0, s, s);
  bx.fillStyle = '#808080';
  bx.fillRect(0, 0, s, s);

  // Fine brushed machining grain
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    const len = 8 + Math.random() * 26;
    rx.strokeStyle = Math.random() > 0.5 ? 'rgba(200,200,200,0.16)' : 'rgba(30,30,30,0.18)';
    rx.lineWidth = 1;
    rx.beginPath();
    rx.moveTo(x, y);
    rx.lineTo(x + len, y);
    rx.stroke();

    bx.strokeStyle = Math.random() > 0.5 ? 'rgba(180,180,180,0.2)' : 'rgba(70,70,70,0.2)';
    bx.beginPath();
    bx.moveTo(x, y);
    bx.lineTo(x + len, y);
    bx.stroke();
  }

  // Edge scuffing & wear scratches
  for (let i = 0; i < 65; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    const dx = (Math.random() - 0.5) * 18;
    const dy = (Math.random() - 0.5) * 18;
    rx.strokeStyle = 'rgba(230,230,230,0.26)';
    rx.lineWidth = 1.2;
    rx.beginPath();
    rx.moveTo(x, y);
    rx.lineTo(x + dx, y + dy);
    rx.stroke();
  }

  const roughMap = new THREE.CanvasTexture(rc);
  roughMap.wrapS = roughMap.wrapT = THREE.RepeatWrapping;
  roughMap.repeat.set(2, 2);

  const bumpMap = new THREE.CanvasTexture(bc);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 2);

  return { roughMap, bumpMap };
}

function createKnurlBumpMap(): THREE.CanvasTexture {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#686868';
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = '#c8c8c8';
  ctx.lineWidth = 2;
  for (let i = -s; i < s * 2; i += 8) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + s, s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i + s, 0);
    ctx.lineTo(i, s);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

function getMats(): WeaponMaterials {
  if (cachedMats) return cachedMats;
  const { roughMap, bumpMap } = createWearMaps();
  const knurlBump = createKnurlBumpMap();

  cachedMats = {
    gunmetal: new THREE.MeshStandardMaterial({
      color: 0x2a323f,
      roughness: 0.34,
      metalness: 0.88,
      roughnessMap: roughMap,
      bumpMap,
      bumpScale: 0.004,
    }),
    darkSteel: new THREE.MeshStandardMaterial({
      color: 0x161c26,
      roughness: 0.38,
      metalness: 0.85,
      roughnessMap: roughMap,
      bumpMap,
      bumpScale: 0.003,
    }),
    polymer: new THREE.MeshStandardMaterial({
      color: 0x12151c,
      roughness: 0.78,
      metalness: 0.12,
      bumpMap: knurlBump,
      bumpScale: 0.005,
    }),
    tanPolymer: new THREE.MeshStandardMaterial({
      color: 0x3f4756,
      roughness: 0.65,
      metalness: 0.22,
      bumpMap: knurlBump,
      bumpScale: 0.004,
    }),
    chrome: new THREE.MeshStandardMaterial({
      color: 0xb8c4d4,
      roughness: 0.16,
      metalness: 0.96,
      roughnessMap: roughMap,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.22,
      metalness: 0.92,
    }),
    cyanEmit: new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.5,
    }),
    amberEmit: new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.3,
    }),
    emeraldEmit: new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 1.5,
    }),
    redEmit: new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 1.8,
    }),
    flashlightLens: new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: 0xfef3c7,
      emissiveIntensity: 0.12,
      roughness: 0.15,
      metalness: 0.2,
    }),
    opticGlass: new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      metalness: 0.1,
      roughness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      reflectivity: 1.0,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
    }),
    medGlass: new THREE.MeshPhysicalMaterial({
      color: 0xa7f3d0,
      metalness: 0.05,
      roughness: 0.08,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.48,
    }),
    laserBeamMat: new THREE.MeshBasicMaterial({
      color: 0xff1e38,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    laserDotMat: new THREE.MeshBasicMaterial({
      color: 0xff3b52,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
  };
  return cachedMats;
}

// --- Shared Tactical Attachment Builders ---
function addPicatinnyTeeth(
  group: THREE.Group,
  x: number,
  y: number,
  zStart: number,
  zEnd: number,
  step: number,
  width = 0.022
) {
  const m = getMats();
  const geo = new THREE.BoxGeometry(width, 0.005, 0.011);
  for (let z = zStart; z >= zEnd; z -= step) {
    const tooth = new THREE.Mesh(geo, m.darkSteel);
    tooth.position.set(x, y, z);
    group.add(tooth);
  }
}

function addLaserModule(
  group: THREE.Group,
  x: number,
  y: number,
  z: number,
  side: 'left' | 'right' = 'right'
) {
  const m = getMats();
  const unit = new THREE.Group();
  unit.position.set(x, y, z);

  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.024, 0.082), m.darkSteel);
  unit.add(housing);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.014, 10).rotateX(Math.PI / 2),
    m.gunmetal
  );
  cap.position.set(0, 0, -0.045);
  unit.add(cap);

  const emitterLed = new THREE.Mesh(new THREE.CircleGeometry(0.0045, 10), m.redEmit);
  emitterLed.position.set(0, 0, -0.053);
  unit.add(emitterLed);

  const batteryKnob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.007, 0.007, 0.012, 8).rotateZ(Math.PI / 2),
    m.chrome
  );
  batteryKnob.position.set(side === 'right' ? 0.014 : -0.014, 0.003, 0.015);
  unit.add(batteryKnob);

  // Anchor at emitter tip for dynamic laser raycast beam
  const laserAnchor = new THREE.Object3D();
  laserAnchor.name = 'laserAnchor';
  laserAnchor.position.set(0, 0, -0.056);
  unit.add(laserAnchor);

  // Short built-in visual beam segment (scaled dynamically in GameEngine; hidden in lobby showcase)
  const beamGeo = new THREE.CylinderGeometry(0.0011, 0.0011, 1, 6);
  beamGeo.rotateX(Math.PI / 2);
  beamGeo.translate(0, 0, -0.5);
  const laserBeam = new THREE.Mesh(beamGeo, m.laserBeamMat);
  laserBeam.name = 'laserBeam';
  laserBeam.scale.z = 16;
  laserAnchor.add(laserBeam);

  group.add(unit);
}

function addFlashlightModule(group: THREE.Group, x: number, y: number, z: number) {
  const m = getMats();
  const unit = new THREE.Group();
  unit.position.set(x, y, z);

  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.095, 12).rotateX(Math.PI / 2),
    m.darkSteel
  );
  unit.add(tube);

  const bezel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.013, 0.025, 12).rotateX(Math.PI / 2),
    m.gunmetal
  );
  bezel.position.set(0, 0, -0.052);
  unit.add(bezel);

  const lensMat = m.flashlightLens.clone();
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.0125, 14), lensMat);
  lens.name = 'flashlightLens';
  lens.position.set(0, 0, -0.0655);
  unit.add(lens);

  const anchor = new THREE.Object3D();
  anchor.name = 'flashlightAnchor';
  anchor.position.set(0, 0, -0.07);
  unit.add(anchor);

  group.add(unit);
}

export function setViewmodelLaserVisible(group: THREE.Group, visible: boolean) {
  const beam = group.getObjectByName('laserBeam');
  if (beam) beam.visible = visible;
}

/** 1. AR-X7 Tactical Assault Rifle */
export function createARX7ViewModel(): THREE.Group {
  const m = getMats();
  const root = new THREE.Group();

  // Lower & Upper Split Receivers
  const lower = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.052, 0.34), m.gunmetal);
  lower.position.set(0, -0.012, 0.01);
  root.add(lower);

  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.044, 0.37), m.darkSteel);
  upper.position.set(0, 0.028, -0.01);
  root.add(upper);

  // Moving Bolt Carrier (animates backward on shot + locks back on empty mag)
  const boltGroup = new THREE.Group();
  boltGroup.name = 'boltSlide';
  boltGroup.position.set(0.024, 0.028, -0.04);
  boltGroup.userData.baseZ = -0.04;
  boltGroup.userData.travelZ = 0.058;
  const boltCarrier = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.024, 0.095), m.chrome);
  boltGroup.add(boltCarrier);
  root.add(boltGroup);

  // Rear Charging Handle (pulled back during reload)
  const chGroup = new THREE.Group();
  chGroup.name = 'chargingHandle';
  chGroup.position.set(0, 0.042, 0.175);
  chGroup.userData.baseZ = 0.175;
  chGroup.userData.travelZ = 0.07;
  const chBar = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.011, 0.026), m.chrome);
  chGroup.add(chBar);
  root.add(chGroup);

  // M-LOK Perforated Handguard + Side Rail
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.34), m.darkSteel);
  handguard.position.set(0, 0.012, -0.35);
  root.add(handguard);

  const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.012, 0.56), m.darkSteel);
  topRail.position.set(0, 0.056, -0.17);
  root.add(topRail);
  addPicatinnyTeeth(root, 0, 0.064, 0.09, -0.43, 0.024);

  // Barrel & Compensator Muzzle Brake
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.015, 0.44, 14).rotateX(Math.PI / 2),
    m.darkSteel
  );
  barrel.position.set(0, 0.016, -0.5);
  root.add(barrel);

  const brake = new THREE.Mesh(
    new THREE.CylinderGeometry(0.019, 0.018, 0.072, 12).rotateX(Math.PI / 2),
    m.gunmetal
  );
  brake.position.set(0, 0.016, -0.73);
  root.add(brake);

  // Curved Extruded Magazine + Grip + Buttstock
  const magShape = new THREE.Shape();
  magShape.moveTo(0, 0);
  magShape.lineTo(0.06, 0);
  magShape.quadraticCurveTo(0.08, -0.09, 0.11, -0.17);
  magShape.lineTo(0.045, -0.18);
  magShape.quadraticCurveTo(0.02, -0.1, 0, 0);
  const magGeo = new THREE.ExtrudeGeometry(magShape, {
    depth: 0.036,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
  });
  magGeo.rotateY(Math.PI / 2);
  magGeo.translate(-0.018, -0.035, -0.06);
  root.add(new THREE.Mesh(magGeo, m.polymer));

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.13, 0.054), m.polymer);
  grip.position.set(0, -0.092, 0.105);
  grip.rotation.x = -0.35;
  root.add(grip);

  const stockTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.22, 12).rotateX(Math.PI / 2),
    m.gunmetal
  );
  stockTube.position.set(0, 0.016, 0.27);
  root.add(stockTube);

  const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.12, 0.15), m.tanPolymer);
  stockPad.position.set(0, -0.015, 0.34);
  root.add(stockPad);

  // Holographic Optic with Reflective Physical Glass
  const holoHood = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.048, 0.072), m.darkSteel);
  holoHood.position.set(0, 0.088, -0.04);
  root.add(holoHood);

  const holoGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.036, 0.034), m.opticGlass);
  holoGlass.position.set(0, 0.088, -0.042);
  root.add(holoGlass);

  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.003, 0.0055, 16),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide })
  );
  reticle.position.set(0, 0.088, -0.04);
  root.add(reticle);

  // Angled Foregrip + Modular Laser Sight + Underbarrel Flashlight
  const fg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.09, 10), m.polymer);
  fg.position.set(0, -0.058, -0.32);
  fg.rotation.x = 0.18;
  root.add(fg);

  const ammoLed = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, 0.04), m.cyanEmit);
  ammoLed.position.set(-0.029, 0.025, 0.02);
  root.add(ammoLed);

  addLaserModule(root, 0.036, 0.016, -0.42, 'right');
  addFlashlightModule(root, -0.036, -0.004, -0.42);

  const muzzle = new THREE.Object3D();
  muzzle.name = 'muzzleAnchor';
  muzzle.position.set(0, 0.016, -0.78);
  root.add(muzzle);

  const eject = new THREE.Object3D();
  eject.name = 'ejectionAnchor';
  eject.position.set(0.036, 0.028, -0.04);
  root.add(eject);

  return root;
}

/** 2. Vector-V9 Tactical SMG (High-ROF Suppressed Compact Carbine) */
export function createVectorV9ViewModel(): THREE.Group {
  const m = getMats();
  const root = new THREE.Group();

  // Super-V Angled Recoil Housing + Upper Shroud
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.046, 0.34), m.gunmetal);
  upper.position.set(0, 0.022, -0.04);
  root.add(upper);

  const lowerV = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.075, 0.18), m.tanPolymer);
  lowerV.position.set(0, -0.03, -0.1);
  lowerV.rotation.x = 0.22;
  root.add(lowerV);

  // Moving Side Bolt Carrier
  const boltGroup = new THREE.Group();
  boltGroup.name = 'boltSlide';
  boltGroup.position.set(0.024, 0.024, -0.05);
  boltGroup.userData.baseZ = -0.05;
  boltGroup.userData.travelZ = 0.044;
  boltGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.02, 0.07), m.chrome));
  root.add(boltGroup);

  // Side Folding Charging Handle
  const chGroup = new THREE.Group();
  chGroup.name = 'chargingHandle';
  chGroup.position.set(-0.032, 0.026, -0.11);
  chGroup.userData.baseZ = -0.11;
  chGroup.userData.travelZ = 0.058;
  chGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.012, 0.02), m.chrome));
  root.add(chGroup);

  // Integrated Hex Suppressor
  const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.048, 0.12), m.darkSteel);
  shroud.position.set(0, 0.014, -0.25);
  root.add(shroud);

  const suppressor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.023, 0.023, 0.22, 8).rotateX(Math.PI / 2),
    m.darkSteel
  );
  suppressor.position.set(0, 0.012, -0.39);
  root.add(suppressor);

  // Suppressor Heat Collar
  const suppCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.028, 12).rotateX(Math.PI / 2),
    m.cyanEmit
  );
  suppCollar.position.set(0, 0.012, -0.29);
  root.add(suppCollar);

  // Straight Stick Magazine (36-round 9mm AP)
  const stickMag = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.042), m.polymer);
  stickMag.position.set(0, -0.135, -0.14);
  stickMag.rotation.x = 0.16;
  root.add(stickMag);

  const magBase = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.018, 0.048), m.cyanEmit);
  magBase.position.set(0, -0.24, -0.158);
  magBase.rotation.x = 0.16;
  root.add(magBase);

  // Pistol Grip & Compact Folding Stock
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.12, 0.05), m.polymer);
  grip.position.set(0, -0.075, 0.09);
  grip.rotation.x = -0.32;
  root.add(grip);

  const stockArm = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.028, 0.21), m.gunmetal);
  stockArm.position.set(0, 0.02, 0.22);
  root.add(stockArm);

  const stockButt = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.11, 0.035), m.polymer);
  stockButt.position.set(0, -0.01, 0.32);
  root.add(stockButt);

  // Top Rail + Compact Reflex Micro-Optic
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.01, 0.32), m.darkSteel);
  rail.position.set(0, 0.048, -0.06);
  root.add(rail);
  addPicatinnyTeeth(root, 0, 0.055, 0.08, -0.2, 0.024);

  const opticBase = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.02, 0.052), m.darkSteel);
  opticBase.position.set(0, 0.064, -0.02);
  root.add(opticBase);

  const opticRing = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.004, 8, 20), m.gunmetal);
  opticRing.position.set(0, 0.084, -0.02);
  root.add(opticRing);

  const opticLens = new THREE.Mesh(new THREE.CircleGeometry(0.017, 16), m.opticGlass);
  opticLens.position.set(0, 0.084, -0.021);
  root.add(opticLens);

  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0028, 10), m.emeraldEmit);
  dot.position.set(0, 0.084, -0.019);
  root.add(dot);

  // Modular Laser & Flashlight
  addLaserModule(root, 0.034, 0.014, -0.22, 'right');
  addFlashlightModule(root, -0.034, -0.005, -0.22);

  const muzzle = new THREE.Object3D();
  muzzle.name = 'muzzleAnchor';
  muzzle.position.set(0, 0.012, -0.51);
  root.add(muzzle);

  const eject = new THREE.Object3D();
  eject.name = 'ejectionAnchor';
  eject.position.set(0.032, 0.024, -0.05);
  root.add(eject);

  return root;
}

/** 3. SG-12 Breach Shotgun */
export function createSG12ViewModel(): THREE.Group {
  const m = getMats();
  const root = new THREE.Group();

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.092, 0.34), m.gunmetal);
  receiver.position.set(0, 0, 0.01);
  root.add(receiver);

  // Moving Chrome Bolt (eject port + lock-open when empty)
  const boltGroup = new THREE.Group();
  boltGroup.name = 'boltSlide';
  boltGroup.position.set(0.031, 0.016, -0.03);
  boltGroup.userData.baseZ = -0.03;
  boltGroup.userData.travelZ = 0.062;
  boltGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.028, 0.088), m.chrome));
  root.add(boltGroup);

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.022, 0.56, 16).rotateX(Math.PI / 2),
    m.darkSteel
  );
  barrel.position.set(0, 0.022, -0.43);
  root.add(barrel);

  // Perforated Cooling Rings
  for (let z = -0.2; z >= -0.52; z -= 0.06) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.0032, 8, 16), m.chrome);
    ring.position.set(0, 0.022, z);
    root.add(ring);
  }

  const magTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.017, 0.52, 12).rotateX(Math.PI / 2),
    m.darkSteel
  );
  magTube.position.set(0, -0.018, -0.41);
  root.add(magTube);

  // Animated Pump-Action Forend
  const pumpSlide = new THREE.Group();
  pumpSlide.name = 'pumpSlide';
  pumpSlide.position.set(0, -0.018, -0.34);
  const pumpBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.031, 0.031, 0.19, 14).rotateX(Math.PI / 2),
    m.polymer
  );
  pumpSlide.add(pumpBody);
  for (let i = -3; i <= 3; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.0025, 6, 14), m.darkSteel);
    rib.position.z = i * 0.022;
    pumpSlide.add(rib);
  }
  root.add(pumpSlide);

  // Side Shell Saddle (4 reserve shells mounted on receiver)
  for (let i = 0; i < 4; i++) {
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.048, 8), m.amberEmit);
    sh.position.set(-0.038, 0.005, -0.08 + i * 0.026);
    root.add(sh);
  }

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.14, 0.058), m.polymer);
  grip.position.set(0, -0.095, 0.12);
  grip.rotation.x = -0.32;
  root.add(grip);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.25), m.polymer);
  stock.position.set(0, -0.018, 0.28);
  root.add(stock);

  const frontPost = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.018, 0.012), m.darkSteel);
  frontPost.position.set(0, 0.048, -0.68);
  root.add(frontPost);
  const frontBead = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 8), m.emeraldEmit);
  frontBead.position.set(0, 0.057, -0.68);
  root.add(frontBead);

  addLaserModule(root, 0.036, 0.018, -0.56, 'right');
  addFlashlightModule(root, -0.036, -0.016, -0.56);

  const muzzle = new THREE.Object3D();
  muzzle.name = 'muzzleAnchor';
  muzzle.position.set(0, 0.022, -0.73);
  root.add(muzzle);

  const eject = new THREE.Object3D();
  eject.name = 'ejectionAnchor';
  eject.position.set(0.042, 0.018, -0.03);
  root.add(eject);

  return root;
}

/** 4. SR-50 Marksman Sniper Rifle */
export function createSR50ViewModel(): THREE.Group {
  const m = getMats();
  const root = new THREE.Group();

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.084, 0.44), m.gunmetal);
  root.add(chassis);

  // Moving Bolt Carrier + Bolt Handle
  const boltGroup = new THREE.Group();
  boltGroup.name = 'boltSlide';
  boltGroup.position.set(0.024, 0.024, 0.01);
  boltGroup.userData.baseZ = 0.01;
  boltGroup.userData.travelZ = 0.068;
  boltGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.11, 10).rotateX(Math.PI / 2), m.chrome));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 10), m.darkSteel);
  knob.position.set(0.024, -0.01, 0.035);
  boltGroup.add(knob);
  root.add(boltGroup);

  const chGroup = new THREE.Group();
  chGroup.name = 'chargingHandle';
  chGroup.position.set(-0.028, 0.028, -0.04);
  chGroup.userData.baseZ = -0.04;
  chGroup.userData.travelZ = 0.068;
  chGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.024), m.chrome));
  root.add(chGroup);

  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.012, 0.4), m.darkSteel);
  rail.position.set(0, 0.048, -0.06);
  root.add(rail);
  addPicatinnyTeeth(root, 0, 0.056, 0.12, -0.24, 0.025);

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.016, 0.52, 14).rotateX(Math.PI / 2),
    m.darkSteel
  );
  barrel.position.set(0, 0.018, -0.48);
  root.add(barrel);

  const suppressor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.26, 16).rotateX(Math.PI / 2),
    m.tanPolymer
  );
  suppressor.position.set(0, 0.018, -0.82);
  root.add(suppressor);

  // Variable 8x Optical Scope + Reflective Physical Lenses
  const scopeTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.24, 16).rotateX(Math.PI / 2),
    m.darkSteel
  );
  scopeTube.position.set(0, 0.088, -0.04);
  root.add(scopeTube);

  const objectiveBell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.021, 0.085, 16).rotateX(Math.PI / 2),
    m.gunmetal
  );
  objectiveBell.position.set(0, 0.088, -0.19);
  root.add(objectiveBell);

  const frontLens = new THREE.Mesh(new THREE.CircleGeometry(0.026, 16), m.opticGlass);
  frontLens.position.set(0, 0.088, -0.234);
  root.add(frontLens);

  const rearLens = new THREE.Mesh(new THREE.CircleGeometry(0.018, 16), m.opticGlass);
  rearLens.position.set(0, 0.088, 0.085);
  root.add(rearLens);

  [-0.02, -0.1].forEach((rz) => {
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.04, 0.024), m.gunmetal);
    mount.position.set(0, 0.065, rz);
    root.add(mount);
  });

  // Bipod Legs + Box Mag + Precision Stock
  [-0.024, 0.024].forEach((bx) => {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.2, 8).rotateX(Math.PI / 2),
      m.chrome
    );
    leg.position.set(bx, -0.055, -0.25);
    root.add(leg);
  });

  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.095, 0.08), m.polymer);
  mag.position.set(0, -0.075, -0.03);
  root.add(mag);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.12, 0.052), m.polymer);
  grip.position.set(0, -0.085, 0.14);
  grip.rotation.x = -0.3;
  root.add(grip);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.1, 0.24), m.tanPolymer);
  stock.position.set(0, -0.015, 0.3);
  root.add(stock);

  addLaserModule(root, 0.034, 0.018, -0.4, 'right');
  addFlashlightModule(root, -0.034, -0.01, -0.4);

  const muzzle = new THREE.Object3D();
  muzzle.name = 'muzzleAnchor';
  muzzle.position.set(0, 0.018, -0.96);
  root.add(muzzle);

  const eject = new THREE.Object3D();
  eject.name = 'ejectionAnchor';
  eject.position.set(0.038, 0.024, 0.01);
  root.add(eject);

  return root;
}

/** 5. .50 Desert Python Heavy Magnum Pistol */
export function createDesertPythonViewModel(): THREE.Group {
  const m = getMats();
  const root = new THREE.Group();

  // Heavy Polymer & Steel Frame
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.038, 0.24), m.darkSteel);
  frame.position.set(0, -0.004, -0.02);
  root.add(frame);

  // Underbarrel Ribbed Rail
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.016, 0.11), m.gunmetal);
  rail.position.set(0, -0.026, -0.08);
  root.add(rail);

  // Reciprocating Brushed Chrome Upper Slide (locks back on empty mag!)
  const slideGroup = new THREE.Group();
  slideGroup.name = 'boltSlide';
  slideGroup.position.set(0, 0.032, -0.02);
  slideGroup.userData.baseZ = -0.02;
  slideGroup.userData.travelZ = 0.062;

  const slideMain = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.038, 0.255), m.chrome);
  slideGroup.add(slideMain);

  // Rear & Front Tritium Iron Sights
  const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.012, 0.016), m.darkSteel);
  rearSight.position.set(0, 0.024, 0.105);
  slideGroup.add(rearSight);
  [-0.008, 0.008].forEach((sx) => {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 6, 6), m.emeraldEmit);
    dot.position.set(sx, 0.027, 0.114);
    slideGroup.add(dot);
  });

  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.013, 0.014), m.darkSteel);
  frontSight.position.set(0, 0.024, -0.114);
  slideGroup.add(frontSight);
  const fDot = new THREE.Mesh(new THREE.SphereGeometry(0.0026, 6, 6), m.amberEmit);
  fDot.position.set(0, 0.028, -0.106);
  slideGroup.add(fDot);

  root.add(slideGroup);

  // Exposed Heavy .50 Barrel under Slide Cutout
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.24, 12).rotateX(Math.PI / 2),
    m.gunmetal
  );
  barrel.position.set(0, 0.028, -0.04);
  root.add(barrel);

  // Ergonomic Textured Grip + Mag Baseplate
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.13, 0.056), m.polymer);
  grip.position.set(0, -0.072, 0.062);
  grip.rotation.x = -0.26;
  root.add(grip);

  const baseplate = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.014, 0.06), m.chrome);
  baseplate.position.set(0, -0.136, 0.079);
  baseplate.rotation.x = -0.26;
  root.add(baseplate);

  // Compact Trigger Guard
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.032, 0.054), m.darkSteel);
  guard.position.set(0, -0.032, 0.005);
  root.add(guard);

  // Underbarrel Laser + Flashlight Combo
  addLaserModule(root, 0.024, -0.026, -0.09, 'right');
  addFlashlightModule(root, -0.024, -0.026, -0.09);

  const muzzle = new THREE.Object3D();
  muzzle.name = 'muzzleAnchor';
  muzzle.position.set(0, 0.028, -0.17);
  root.add(muzzle);

  const eject = new THREE.Object3D();
  eject.name = 'ejectionAnchor';
  eject.position.set(0.024, 0.038, -0.01);
  root.add(eject);

  return root;
}

/** 6. M84 Flash-Frag Concussion Grenade */
export function createFlashFragViewModel(): THREE.Group {
  const m = getMats();
  const root = new THREE.Group();

  // Hexagonal Steel Fragmentation Shell
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.036, 0.115, 12), m.gunmetal);
  root.add(body);

  // Cyan/Amber Concussion Banding
  const topBand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.018, 14), m.cyanEmit);
  topBand.position.y = 0.028;
  root.add(topBand);

  const botBand = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.039, 0.014, 14), m.amberEmit);
  botBand.position.y = -0.03;
  root.add(botBand);

  // Top Fuse Neck + Spoon Lever + Pull Ring
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.035, 12), m.darkSteel);
  neck.position.y = 0.072;
  root.add(neck);

  const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.088, 0.012), m.tanPolymer);
  spoon.position.set(0.028, 0.036, 0);
  spoon.rotation.z = -0.15;
  root.add(spoon);

  const pinRing = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0028, 8, 16), m.chrome);
  pinRing.position.set(-0.024, 0.08, 0.01);
  pinRing.rotation.y = Math.PI / 4;
  root.add(pinRing);

  return root;
}

/** Thrown World-Space Grenade Projectile Mesh */
export function createGrenadeProjectileMesh(): THREE.Group {
  const vm = createFlashFragViewModel();
  vm.scale.setScalar(1.35);
  return vm;
}

/** 7. Nano-Medkit Bio-Gel Injector */
export function createNanoMedkitViewModel(): THREE.Group {
  const m = getMats();
  const root = new THREE.Group();

  const chamber = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.18, 16), m.medGlass);
  root.add(chamber);

  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.16, 16), m.emeraldEmit);
  root.add(core);

  const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.048, 0.042, 16), m.gunmetal);
  topCap.position.y = 0.11;
  root.add(topCap);

  const botCap = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.05, 0.042, 16), m.gunmetal);
  botCap.position.y = -0.11;
  root.add(botCap);

  const needle = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.08, 12), m.chrome);
  needle.position.y = 0.17;
  root.add(needle);

  const plunger = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.06, 12), m.polymer);
  plunger.position.y = -0.16;
  root.add(plunger);

  return root;
}
