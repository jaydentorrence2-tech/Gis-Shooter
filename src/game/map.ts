/**
 * Procedural 3D Sci-Fi Tactical Facility Arena (GIS Shooter: Tactical Edition)
 * Features normal/bump-mapped surfaces, sky dome, second-floor catwalk bridge,
 * watchtowers with access ramps, stacked cargo containers, and cyber-night point lights.
 */

import * as THREE from 'three';
import {
  createFloorTextures,
  createWallTextures,
  createCrateTextures,
  createHazardTexture,
  createSkyDomeTexture,
} from './textures';

export interface ArenaCollision {
  box: THREE.Box3;
  mesh?: THREE.Mesh;
  type: 'wall' | 'crate' | 'ramp' | 'platform' | 'pillar';
  heightAt?: (x: number, z: number) => number;
}

export interface RadarRect {
  x: number;
  z: number;
  w: number;
  d: number;
  rotY?: number;
  kind: 'wall' | 'crate' | 'platform';
}

export interface TacticalArena {
  group: THREE.Group;
  collisions: ArenaCollision[];
  obstacleMeshes: THREE.Object3D[];
  radarRects: RadarRect[];
  playerSpawn: THREE.Vector3;
  enemySpawns: THREE.Vector3[];
  patrolNodes: THREE.Vector3[];
  energyCores: THREE.Mesh[];
}

export function buildTacticalArena(maxAnisotropy = 8): TacticalArena {
  const arenaGroup = new THREE.Group();
  arenaGroup.name = 'TACTICAL_FACILITY';

  const collisions: ArenaCollision[] = [];
  const obstacleMeshes: THREE.Object3D[] = [];
  const radarRects: RadarRect[] = [];
  const enemySpawns: THREE.Vector3[] = [];
  const patrolNodes: THREE.Vector3[] = [];
  const energyCores: THREE.Mesh[] = [];

  // 1. Sky Dome (Sci-Fi Cyber Night Atmosphere)
  const skyGeo = new THREE.SphereGeometry(220, 32, 20);
  const skyMat = new THREE.MeshBasicMaterial({
    map: createSkyDomeTexture(),
    side: THREE.BackSide,
    fog: false,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  arenaGroup.add(skyDome);

  // 2. Procedural PBR Textures + Bump Maps
  const floorTex = createFloorTextures(maxAnisotropy);
  floorTex.map.repeat.set(14, 14);
  floorTex.bumpMap.repeat.set(14, 14);

  const wallTex = createWallTextures(maxAnisotropy);
  wallTex.map.repeat.set(4, 2);
  wallTex.bumpMap.repeat.set(4, 2);

  const hazardTex = createHazardTexture(maxAnisotropy);
  hazardTex.repeat.set(1, 8);

  const crateOrange = createCrateTextures('#f59e0b', maxAnisotropy);
  const crateCyan = createCrateTextures('#06b6d4', maxAnisotropy);
  const crateRed = createCrateTextures('#ef4444', maxAnisotropy);

  // Materials
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex.map,
    bumpMap: floorTex.bumpMap,
    bumpScale: 0.045,
    roughness: 0.72,
    metalness: 0.25,
  });

  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex.map,
    bumpMap: wallTex.bumpMap,
    bumpScale: 0.06,
    roughness: 0.48,
    metalness: 0.58,
  });

  const rampMat = new THREE.MeshStandardMaterial({
    map: hazardTex,
    roughness: 0.42,
    metalness: 0.55,
  });

  const metalTrussMat = new THREE.MeshStandardMaterial({
    color: 0x263143,
    roughness: 0.32,
    metalness: 0.85,
  });

  const railMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.28,
    metalness: 0.82,
  });

  const hazardEdgeTex = hazardTex.clone();
  hazardEdgeTex.needsUpdate = true;
  hazardEdgeTex.repeat.set(28, 1);

  const hazardTrimMat = new THREE.MeshStandardMaterial({
    map: hazardEdgeTex,
    roughness: 0.44,
    metalness: 0.45,
  });

  const controlGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    roughness: 0.08,
    metalness: 0.1,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 0.34,
    side: THREE.DoubleSide,
  });

  const cyanGlowMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.65,
    roughness: 0.15,
  });

  const redAlertGlowMat = new THREE.MeshStandardMaterial({
    color: 0xff1e42,
    emissive: 0xff1e42,
    emissiveIntensity: 2.0,
    roughness: 0.15,
  });

  // 3. Arena Floor (80x80m) + Yellow-Black Perimeter Hazard Trim
  const floorGeo = new THREE.PlaneGeometry(80, 80);
  floorGeo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  arenaGroup.add(floor);
  obstacleMeshes.push(floor);

  const trimGeoNS = new THREE.BoxGeometry(79.4, 0.06, 0.95);
  [-39.45, 39.45].forEach((tz) => {
    const trim = new THREE.Mesh(trimGeoNS, hazardTrimMat);
    trim.position.set(0, 0.03, tz);
    trim.receiveShadow = true;
    arenaGroup.add(trim);
  });

  const trimGeoEW = new THREE.BoxGeometry(0.95, 0.06, 78.0);
  [-39.45, 39.45].forEach((tx) => {
    const trim = new THREE.Mesh(trimGeoEW, hazardTrimMat);
    trim.position.set(tx, 0.03, 0);
    trim.receiveShadow = true;
    arenaGroup.add(trim);
  });

  function addCollision(
    minX: number,
    minY: number,
    minZ: number,
    maxX: number,
    maxY: number,
    maxZ: number,
    type: ArenaCollision['type'] = 'wall',
    mesh?: THREE.Mesh,
    heightAt?: (x: number, z: number) => number
  ) {
    const box = new THREE.Box3(
      new THREE.Vector3(minX, minY, minZ),
      new THREE.Vector3(maxX, maxY, maxZ)
    );
    collisions.push({ box, type, mesh, heightAt });
  }

  // 4. Perimeter Boundary Walls (80m x 80m, 6.5m tall)
  const wallH = 6.5;
  const wallThick = 2;
  const halfS = 40;

  const northWall = new THREE.Mesh(new THREE.BoxGeometry(84, wallH, wallThick), wallMat);
  northWall.position.set(0, wallH / 2, -halfS - wallThick / 2);
  northWall.castShadow = true;
  northWall.receiveShadow = true;
  arenaGroup.add(northWall);
  obstacleMeshes.push(northWall);
  addCollision(-42, 0, -42, 42, wallH, -40, 'wall', northWall);

  const southWall = northWall.clone();
  southWall.position.set(0, wallH / 2, halfS + wallThick / 2);
  arenaGroup.add(southWall);
  obstacleMeshes.push(southWall);
  addCollision(-42, 0, 40, 42, wallH, 42, 'wall', southWall);

  const eastWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH, 80), wallMat);
  eastWall.position.set(halfS + wallThick / 2, wallH / 2, 0);
  eastWall.castShadow = true;
  eastWall.receiveShadow = true;
  arenaGroup.add(eastWall);
  obstacleMeshes.push(eastWall);
  addCollision(40, 0, -40, 42, wallH, 40, 'wall', eastWall);

  const westWall = eastWall.clone();
  westWall.position.set(-halfS - wallThick / 2, wallH / 2, 0);
  arenaGroup.add(westWall);
  obstacleMeshes.push(westWall);
  addCollision(-42, 0, -40, -40, wallH, 40, 'wall', westWall);

  // 5. Tactical Cover Walls & Angled Barricades
  function createCoverBarrier(x: number, z: number, length: number, height: number, rotationY = 0) {
    const width = 0.85;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, height, width), wallMat);
    mesh.position.set(x, height / 2, z);
    mesh.rotation.y = rotationY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    arenaGroup.add(mesh);
    obstacleMeshes.push(mesh);

    const topTrim = new THREE.Mesh(new THREE.BoxGeometry(length + 0.04, 0.07, width + 0.06), rampMat);
    topTrim.position.set(0, height / 2 + 0.035, 0);
    mesh.add(topTrim);

    mesh.updateMatrixWorld();
    const box = new THREE.Box3().setFromObject(mesh);
    collisions.push({ box, type: 'wall', mesh });
    radarRects.push({ x, z, w: length, d: width, rotY: rotationY, kind: 'wall' });
  }

  // Tactical Quadrant Cover Walls
  createCoverBarrier(-13, -11, 8, 1.85, 0);
  createCoverBarrier(13, -11, 8, 1.85, 0);
  createCoverBarrier(-13, 13, 8, 1.85, 0);
  createCoverBarrier(13, 13, 8, 1.85, 0);

  createCoverBarrier(-24, 0, 7.5, 2.2, Math.PI / 2);
  createCoverBarrier(24, 0, 7.5, 2.2, Math.PI / 2);
  createCoverBarrier(0, -23, 10, 2.0, 0);
  createCoverBarrier(0, 23, 10, 2.0, 0);

  // Diagonal skirmish barricades
  createCoverBarrier(-18, -25, 6.5, 1.6, Math.PI / 4);
  createCoverBarrier(18, -25, 6.5, 1.6, -Math.PI / 4);
  createCoverBarrier(-18, 25, 6.5, 1.6, -Math.PI / 4);
  createCoverBarrier(18, 25, 6.5, 1.6, Math.PI / 4);

  const crateOrangeMat = new THREE.MeshStandardMaterial({
    map: crateOrange.map,
    bumpMap: crateOrange.bumpMap,
    bumpScale: 0.05,
    roughness: 0.46,
    metalness: 0.52,
  });
  const crateCyanMat = new THREE.MeshStandardMaterial({
    map: crateCyan.map,
    bumpMap: crateCyan.bumpMap,
    bumpScale: 0.05,
    roughness: 0.46,
    metalness: 0.52,
  });
  const crateRedMat = new THREE.MeshStandardMaterial({
    map: crateRed.map,
    bumpMap: crateRed.bumpMap,
    bumpScale: 0.05,
    roughness: 0.46,
    metalness: 0.52,
  });

  // 6. Stacked Industrial Cargo Containers
  function createCrate(
    x: number,
    y: number,
    z: number,
    size = 2.4,
    mat: THREE.MeshStandardMaterial = crateOrangeMat,
    rotY = 0
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
    mesh.position.set(x, y + size / 2, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    arenaGroup.add(mesh);
    obstacleMeshes.push(mesh);

    mesh.updateMatrixWorld();
    const box = new THREE.Box3().setFromObject(mesh);
    collisions.push({ box, type: 'crate', mesh });
    if (y === 0) {
      radarRects.push({ x, z, w: size, d: size, rotY, kind: 'crate' });
    }
  }

  // Stacked Clusters
  createCrate(-18, 0, -8, 2.5, crateOrangeMat, 0.08);
  createCrate(-15.2, 0, -8, 2.5, crateCyanMat, -0.05);
  createCrate(-16.6, 2.5, -8, 2.35, crateRedMat, 0.04);

  createCrate(18, 0, -8, 2.5, crateCyanMat, 0);
  createCrate(20.8, 0, -8, 2.5, crateOrangeMat, 0.1);
  createCrate(19.4, 2.5, -8, 2.35, crateOrangeMat, 0.14);

  createCrate(-20, 0, 16, 2.5, crateRedMat, 0.14);
  createCrate(-22.8, 0, 16, 2.5, crateOrangeMat, -0.08);
  createCrate(-21.4, 2.5, 16, 2.35, crateCyanMat, 0.05);

  createCrate(20, 0, 16, 2.5, crateCyanMat, 0.05);
  createCrate(17.2, 0, 16, 2.5, crateRedMat, -0.1);
  createCrate(18.6, 2.5, 16, 2.35, crateOrangeMat, 0);

  createCrate(-7.5, 0, 3.5, 2.1, crateOrangeMat, 0.35);
  createCrate(7.5, 0, -3.5, 2.1, crateCyanMat, -0.3);

  // 7. Second-Floor Connecting Bridge (Catwalk) & Access Ramps
  const platW = 14;
  const platD = 10;
  const platElevation = 3.2;

  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(platW, 0.42, platD),
    metalTrussMat
  );
  platform.position.set(0, platElevation, 0);
  platform.receiveShadow = true;
  platform.castShadow = true;
  arenaGroup.add(platform);
  obstacleMeshes.push(platform);
  addCollision(
    -platW / 2,
    platElevation - 0.21,
    -platD / 2,
    platW / 2,
    platElevation + 0.21,
    platD / 2,
    'platform',
    platform
  );
  radarRects.push({ x: 0, z: 0, w: platW, d: platD, kind: 'platform' });

  // Support columns under catwalk
  const pillarGeo = new THREE.CylinderGeometry(0.36, 0.42, platElevation, 12);
  [
    [-platW / 2 + 0.8, -platD / 2 + 0.8],
    [platW / 2 - 0.8, -platD / 2 + 0.8],
    [-platW / 2 + 0.8, platD / 2 - 0.8],
    [platW / 2 - 0.8, platD / 2 - 0.8],
  ].forEach(([px, pz]) => {
    const pMesh = new THREE.Mesh(pillarGeo, metalTrussMat);
    pMesh.position.set(px, platElevation / 2, pz);
    pMesh.castShadow = true;
    arenaGroup.add(pMesh);
    obstacleMeshes.push(pMesh);
    addCollision(px - 0.4, 0, pz - 0.4, px + 0.4, platElevation, pz + 0.4, 'pillar', pMesh);
  });

  // Safety railings along East & West catwalk edges
  function addRailing(x1: number, z1: number, x2: number, z2: number, elev: number) {
    const dist = Math.hypot(x2 - x1, z2 - z1);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(dist, 0.85, 0.1), railMat);
    rail.position.set((x1 + x2) / 2, elev + 0.55, (z1 + z2) / 2);
    rail.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    arenaGroup.add(rail);
    rail.updateMatrixWorld();
    collisions.push({ box: new THREE.Box3().setFromObject(rail), type: 'wall', mesh: rail });
  }

  addRailing(-platW / 2, -platD / 2, -platW / 2, platD / 2, platElevation);
  addRailing(platW / 2, -platD / 2, platW / 2, platD / 2, platElevation);

  // North & South Access Ramps to Catwalk
  const rampLen = 9.5;
  const rampW = 3.8;
  const rampAng = Math.atan2(platElevation, rampLen);
  const rampGeo = new THREE.BoxGeometry(rampW, 0.3, rampLen);

  const northRamp = new THREE.Mesh(rampGeo, rampMat);
  northRamp.rotation.x = -rampAng;
  northRamp.position.set(0, platElevation / 2, -platD / 2 - rampLen / 2);
  northRamp.receiveShadow = true;
  northRamp.castShadow = true;
  arenaGroup.add(northRamp);
  obstacleMeshes.push(northRamp);

  const nStart = -platD / 2 - rampLen;
  const nEnd = -platD / 2;
  addCollision(-rampW / 2, 0, nStart, rampW / 2, platElevation, nEnd, 'ramp', northRamp, (_x, z) => {
    const t = (z - nStart) / rampLen;
    return Math.max(0, Math.min(platElevation, t * platElevation));
  });

  const southRamp = new THREE.Mesh(rampGeo, rampMat);
  southRamp.rotation.x = rampAng;
  southRamp.position.set(0, platElevation / 2, platD / 2 + rampLen / 2);
  southRamp.receiveShadow = true;
  southRamp.castShadow = true;
  arenaGroup.add(southRamp);
  obstacleMeshes.push(southRamp);

  const sStart = platD / 2 + rampLen;
  const sEnd = platD / 2;
  addCollision(-rampW / 2, 0, sEnd, rampW / 2, platElevation, sStart, 'ramp', southRamp, (_x, z) => {
    const t = (sStart - z) / rampLen;
    return Math.max(0, Math.min(platElevation, t * platElevation));
  });

  // 8. Corner Watchtowers with Accessible Ramps
  function createWatchtower(tx: number, tz: number, rampDirZ: number) {
    const towerH = 4.4;
    const towerW = 6.0;

    const top = new THREE.Mesh(new THREE.BoxGeometry(towerW, 0.4, towerW), metalTrussMat);
    top.position.set(tx, towerH, tz);
    top.receiveShadow = true;
    top.castShadow = true;
    arenaGroup.add(top);
    obstacleMeshes.push(top);
    addCollision(
      tx - towerW / 2,
      towerH - 0.2,
      tz - towerW / 2,
      tx + towerW / 2,
      towerH + 0.2,
      tz + towerW / 2,
      'platform',
      top
    );
    radarRects.push({ x: tx, z: tz, w: towerW, d: towerW, kind: 'platform' });

    const postGeo = new THREE.BoxGeometry(0.35, towerH, 0.35);
    [-towerW / 2 + 0.3, towerW / 2 - 0.3].forEach((ox) => {
      [-towerW / 2 + 0.3, towerW / 2 - 0.3].forEach((oz) => {
        const post = new THREE.Mesh(postGeo, metalTrussMat);
        post.position.set(tx + ox, towerH / 2, tz + oz);
        post.castShadow = true;
        arenaGroup.add(post);
        obstacleMeshes.push(post);
        addCollision(tx + ox - 0.2, 0, tz + oz - 0.2, tx + ox + 0.2, towerH, tz + oz + 0.2, 'pillar', post);
      });
    });

    // Tower Access Ramp
    const tRampLen = 10.5;
    const tRampW = 2.8;
    const tAng = Math.atan2(towerH, tRampLen);
    const tRamp = new THREE.Mesh(new THREE.BoxGeometry(tRampW, 0.28, tRampLen), rampMat);
    tRamp.rotation.x = rampDirZ > 0 ? tAng : -tAng;
    const rCenterZ = tz + rampDirZ * (towerW / 2 + tRampLen / 2);
    tRamp.position.set(tx, towerH / 2, rCenterZ);
    tRamp.castShadow = true;
    tRamp.receiveShadow = true;
    arenaGroup.add(tRamp);
    obstacleMeshes.push(tRamp);

    const zLow = rampDirZ > 0 ? tz + towerW / 2 + tRampLen : tz - towerW / 2 - tRampLen;
    const zHigh = rampDirZ > 0 ? tz + towerW / 2 : tz - towerW / 2;
    const minZ = Math.min(zLow, zHigh);
    const maxZ = Math.max(zLow, zHigh);

    addCollision(tx - tRampW / 2, 0, minZ, tx + tRampW / 2, towerH, maxZ, 'ramp', tRamp, (_x, z) => {
      const distFromLow = Math.abs(z - zLow);
      return Math.max(0, Math.min(towerH, (distFromLow / tRampLen) * towerH));
    });
  }

  createWatchtower(-28, -28, 1);
  createWatchtower(28, 28, -1);

  // 9. Energy Beacons with Strategic Cyan & Amber Point Lights
  function createEnergyCore(cx: number, cz: number, color: number, yBase = 0) {
    const coreGroup = new THREE.Group();
    coreGroup.position.set(cx, yBase, cz);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.3, 0.55, 8),
      metalTrussMat
    );
    base.position.y = 0.28;
    base.receiveShadow = true;
    coreGroup.add(base);

    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 3.0, 16),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.6,
        roughness: 0.1,
      })
    );
    rod.position.y = 1.85;
    coreGroup.add(rod);
    energyCores.push(rod);

    const ringGeo = new THREE.TorusGeometry(0.68, 0.075, 8, 24);
    const ring1 = new THREE.Mesh(ringGeo, metalTrussMat);
    ring1.rotation.x = Math.PI / 2;
    ring1.position.y = 1.15;
    coreGroup.add(ring1);

    const ring2 = ring1.clone();
    ring2.position.y = 2.35;
    coreGroup.add(ring2);

    const pLight = new THREE.PointLight(color, 18, 20, 1.4);
    pLight.position.set(0, 2.5, 0);
    coreGroup.add(pLight);

    arenaGroup.add(coreGroup);
    addCollision(cx - 1.15, yBase, cz - 1.15, cx + 1.15, yBase + 3.4, cz + 1.15, 'pillar', base);
  }

  createEnergyCore(-26, 12, 0x06b6d4, 0);
  createEnergyCore(26, -12, 0xf59e0b, 0);
  createEnergyCore(-28, -28, 0x06b6d4, 4.6);
  createEnergyCore(28, 28, 0xf59e0b, 4.6);
  createEnergyCore(0, 0, 0x06b6d4, platElevation + 0.2);

  // 9B. Four Corner Glowing Reactor Containment Tubes
  function createReactorTube(rx: number, rz: number) {
    const rGroup = new THREE.Group();
    rGroup.position.set(rx, 0, rz);

    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.85, 0.7, 8), metalTrussMat);
    plinth.position.y = 0.35;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    rGroup.add(plinth);
    obstacleMeshes.push(plinth);

    const topCap = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.55, 0.75, 8), metalTrussMat);
    topCap.position.y = 5.45;
    topCap.castShadow = true;
    rGroup.add(topCap);

    // Glass containment cylinder
    const glassTube = new THREE.Mesh(
      new THREE.CylinderGeometry(1.12, 1.12, 4.4, 20, 1, true),
      controlGlassMat
    );
    glassTube.position.y = 2.9;
    rGroup.add(glassTube);
    obstacleMeshes.push(glassTube);

    // 4 External Armored Containment Struts
    for (let s = 0; s < 4; s++) {
      const ang = (s * Math.PI) / 2 + Math.PI / 4;
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.5, 0.22), railMat);
      strut.position.set(Math.cos(ang) * 1.28, 2.9, Math.sin(ang) * 1.28);
      strut.rotation.y = -ang;
      strut.castShadow = true;
      rGroup.add(strut);
    }

    // Inner Rotating Plasma Core + Orbital Ring
    const coreRod = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 4.1, 12), cyanGlowMat);
    coreRod.position.y = 2.9;
    const coreOrb = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.08, 8, 20), cyanGlowMat);
    coreOrb.rotation.x = Math.PI / 3;
    coreRod.add(coreOrb);
    rGroup.add(coreRod);
    energyCores.push(coreRod);

    const rLight = new THREE.PointLight(0x06b6d4, 18, 24, 1.35);
    rLight.position.y = 2.9;
    rGroup.add(rLight);

    arenaGroup.add(rGroup);
    addCollision(rx - 1.65, 0, rz - 1.65, rx + 1.65, 5.8, rz + 1.65, 'pillar', plinth);
    radarRects.push({ x: rx, z: rz, w: 3.2, d: 3.2, kind: 'platform' });
  }

  createReactorTube(-35.2, -35.2);
  createReactorTube(35.2, -35.2);
  createReactorTube(-35.2, 35.2);
  createReactorTube(35.2, 35.2);

  // 9C. Massive Structural Support Pillars & High Gantry Trusses
  function createStructuralPillar(px: number, pz: number) {
    const pGroup = new THREE.Group();
    pGroup.position.set(px, 0, pz);

    const base = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.8, 2.1), metalTrussMat);
    base.position.y = 0.4;
    base.castShadow = true;
    base.receiveShadow = true;
    pGroup.add(base);
    obstacleMeshes.push(base);

    const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.45, 7.6, 1.45), wallMat);
    shaft.position.y = 4.2;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    pGroup.add(shaft);
    obstacleMeshes.push(shaft);

    const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(1.52, 5.2, 0.14), cyanGlowMat);
    ledStrip.position.y = 4.1;
    pGroup.add(ledStrip);

    const hazBand = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.22, 2.14), hazardTrimMat);
    hazBand.position.y = 0.85;
    pGroup.add(hazBand);

    arenaGroup.add(pGroup);
    addCollision(px - 1.05, 0, pz - 1.05, px + 1.05, 8.0, pz + 1.05, 'pillar', shaft);
    radarRects.push({ x: px, z: pz, w: 2.1, d: 2.1, kind: 'wall' });
  }

  createStructuralPillar(-33, -14);
  createStructuralPillar(33, -14);
  createStructuralPillar(-33, 14);
  createStructuralPillar(33, 14);
  createStructuralPillar(-15, -34);
  createStructuralPillar(15, -34);

  // Overhead High Gantry Trusses (y = 7.7m, clear of player movement)
  [-14, 14].forEach((gz) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(66, 0.65, 0.9), metalTrussMat);
    beam.position.set(0, 7.7, gz);
    arenaGroup.add(beam);
  });

  // 9D. Elevated Glass Control Room (North Perimeter Command Bay)
  {
    const ctrlX = 0;
    const ctrlZ = -36.5;
    const ctrlW = 14.0;
    const ctrlD = 5.4;
    const ctrlGroup = new THREE.Group();
    ctrlGroup.position.set(ctrlX, 0, ctrlZ);

    // Lower Armored Bunker Wall
    const lowerWall = new THREE.Mesh(new THREE.BoxGeometry(ctrlW, 1.55, ctrlD), wallMat);
    lowerWall.position.y = 0.775;
    lowerWall.castShadow = true;
    lowerWall.receiveShadow = true;
    ctrlGroup.add(lowerWall);
    obstacleMeshes.push(lowerWall);

    // Corner mullions + Roof Deck
    [-ctrlW / 2 + 0.45, ctrlW / 2 - 0.45].forEach((mx) => {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.3, ctrlD), metalTrussMat);
      mullion.position.set(mx, 2.7, 0);
      mullion.castShadow = true;
      ctrlGroup.add(mullion);
      obstacleMeshes.push(mullion);
    });

    const roof = new THREE.Mesh(new THREE.BoxGeometry(ctrlW + 0.6, 0.75, ctrlD + 0.7), metalTrussMat);
    roof.position.set(0, 4.2, 0.15);
    roof.castShadow = true;
    roof.receiveShadow = true;
    ctrlGroup.add(roof);
    obstacleMeshes.push(roof);

    const roofStrip = new THREE.Mesh(new THREE.BoxGeometry(ctrlW - 1.2, 0.12, 0.14), cyanGlowMat);
    roofStrip.position.set(0, 3.92, ctrlD / 2 + 0.42);
    ctrlGroup.add(roofStrip);

    // Ballistic Observation Glass Window (Front + Sides)
    const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(ctrlW - 1.8, 2.25), controlGlassMat);
    frontGlass.position.set(0, 2.68, ctrlD / 2 - 0.15);
    ctrlGroup.add(frontGlass);
    obstacleMeshes.push(frontGlass);

    // Interior Tactical Console & Glowing Holographic Screens
    const consoleDesk = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.9, 1.2), metalTrussMat);
    consoleDesk.position.set(0, 1.95, 0.55);
    ctrlGroup.add(consoleDesk);

    [-2.8, 0, 2.8].forEach((sx) => {
      const monitor = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.95, 0.08), cyanGlowMat);
      monitor.position.set(sx, 2.75, 0.35);
      monitor.rotation.x = -0.2;
      ctrlGroup.add(monitor);
    });

    const ctrlLight = new THREE.PointLight(0x38bdf8, 14, 16, 1.4);
    ctrlLight.position.set(0, 3.3, 0.2);
    ctrlGroup.add(ctrlLight);

    arenaGroup.add(ctrlGroup);
    addCollision(
      ctrlX - ctrlW / 2,
      0,
      ctrlZ - ctrlD / 2,
      ctrlX + ctrlW / 2,
      4.6,
      ctrlZ + ctrlD / 2,
      'wall',
      lowerWall
    );
    radarRects.push({ x: ctrlX, z: ctrlZ, w: ctrlW, d: ctrlD, kind: 'wall' });
  }

  // 9E. Red Emergency Spotlights on Arena Choke Points (Zero Shadow Maps for 60 FPS)
  [
    [-21, 7.6, -14, -15, 0, -10],
    [21, 7.6, -14, 15, 0, -10],
    [-21, 7.6, 14, -15, 0, 10],
    [21, 7.6, 14, 15, 0, 10],
  ].forEach(([sx, sy, sz, tx, ty, tz]) => {
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.42, 10), metalTrussMat);
    housing.position.set(sx, sy, sz);
    arenaGroup.add(housing);

    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), redAlertGlowMat);
    lens.position.set(sx, sy - 0.2, sz);
    arenaGroup.add(lens);

    const spot = new THREE.SpotLight(0xff1e42, 34, 30, Math.PI / 5.2, 0.58, 1.35);
    spot.position.set(sx, sy - 0.25, sz);
    spot.castShadow = false;
    spot.target.position.set(tx, ty, tz);
    arenaGroup.add(spot);
    arenaGroup.add(spot.target);
  });

  // 10. Spawns & Patrol Waypoints
  const playerSpawn = new THREE.Vector3(0, 1.75, 31);

  enemySpawns.push(
    new THREE.Vector3(-28, 0, -14),
    new THREE.Vector3(28, 0, -14),
    new THREE.Vector3(-30, 0, 16),
    new THREE.Vector3(30, 0, 16),
    new THREE.Vector3(0, 0, -30.5),
    new THREE.Vector3(-21, 0, -4),
    new THREE.Vector3(21, 0, -4)
  );

  patrolNodes.push(
    new THREE.Vector3(-15, 0, -16),
    new THREE.Vector3(15, 0, -16),
    new THREE.Vector3(-15, 0, 16),
    new THREE.Vector3(15, 0, 16),
    new THREE.Vector3(0, 0, -21),
    new THREE.Vector3(-21, 0, 0),
    new THREE.Vector3(21, 0, 0),
    new THREE.Vector3(0, 0, 18)
  );

  // Freeze static world matrices on arena geometry (skip rotating energy core rods)
  const coreSet = new Set<THREE.Object3D>(energyCores);
  arenaGroup.updateMatrixWorld(true);
  arenaGroup.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh && !coreSet.has(obj)) {
      obj.matrixAutoUpdate = false;
    }
  });

  return {
    group: arenaGroup,
    collisions,
    obstacleMeshes,
    radarRects,
    playerSpawn,
    enemySpawns,
    patrolNodes,
    energyCores,
  };
}
