/**
 * GIS Shooter: Tactical Edition — 3D Interactive Tactical Hangar & Operator Showcase
 * Builds the real-time Main Menu lobby scene:
 *  - Rotating turntable podium with cyan/amber LED rings
 *  - Articulated 3D Third-Person Operator with live visor accent & active weapon showcase
 *  - Steel-ribbed Tactical Hangar with "GIS DEPLOYMENT BAY" blast door
 *  - Giant observation glass overlooking a 3D Cyber-Night Megacity Skyline
 *  - Illuminated 3D Wall Weapon Racks (AR-X7, SG-12, SR-50)
 *  - Holo-Table with rotating 3D wireframe tactical facility hologram
 *  - Military supply crates + hovering animated Recon Drone
 *  - Three-point studio lighting + floating atmospheric dust motes
 *  - Smooth damped drag-orbit, scroll-zoom, and Armory/Profile/Settings camera transitions
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  createBlastDoorTexture,
  createCrateTextures,
  createHangarDeckTexture,
  createHazardTexture,
  createSkyDomeTexture,
  createWallTextures,
} from './textures';
import {
  createARX7ViewModel,
  createDesertPythonViewModel,
  createFlashFragViewModel,
  createNanoMedkitViewModel,
  createSG12ViewModel,
  createSR50ViewModel,
  createVectorV9ViewModel,
  setViewmodelLaserVisible,
} from './weapons';

export type LobbyFocusMode = 'overview' | 'armory' | 'profile' | 'settings';

interface CameraPreset {
  azimuth: number;
  elevation: number;
  distance: number;
  target: THREE.Vector3;
  fov: number;
}

const CAMERA_PRESETS: Record<LobbyFocusMode, CameraPreset> = {
  overview: {
    azimuth: 0.36,
    elevation: 0.16,
    distance: 6.1,
    target: new THREE.Vector3(-0.65, 1.32, 0.0),
    fov: 48,
  },
  armory: {
    azimuth: 0.56,
    elevation: 0.09,
    distance: 2.55,
    target: new THREE.Vector3(0.45, 1.32, 0.12),
    fov: 40,
  },
  profile: {
    azimuth: 0.24,
    elevation: 0.11,
    distance: 1.9,
    target: new THREE.Vector3(0.32, 1.8, 0.06),
    fov: 38,
  },
  settings: {
    azimuth: 0.42,
    elevation: 0.18,
    distance: 5.5,
    target: new THREE.Vector3(0.7, 1.32, 0.0),
    fov: 48,
  },
};

function createDustTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(224, 242, 254, 1)');
  grad.addColorStop(0.45, 'rgba(56, 189, 248, 0.45)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSkyscraperWindowTexture(accentHex: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#070b14';
  ctx.fillRect(0, 0, 128, 256);

  for (let y = 10; y < 246; y += 12) {
    for (let x = 8; x < 120; x += 14) {
      const r = Math.random();
      if (r > 0.62) {
        ctx.fillStyle =
          r > 0.88 ? accentHex : r > 0.74 ? 'rgba(56, 189, 248, 0.55)' : 'rgba(245, 158, 11, 0.45)';
        ctx.fillRect(x, y, 8, 6);
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x, y, 8, 6);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export class TacticalLobby {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;

  private turntableGroup: THREE.Group;
  private operatorGroup: THREE.Group;
  private torsoPivot: THREE.Group;
  private headPivot: THREE.Group;
  private weaponMount: THREE.Group;
  private weaponModels: THREE.Group[] = [];
  private visorMat: THREE.MeshStandardMaterial;
  private accentRingMat: THREE.MeshStandardMaterial;
  private podiumLight: THREE.PointLight;
  private hemiLight: THREE.HemisphereLight;
  private keyLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private fillLight: THREE.PointLight;
  private ambientLight: THREE.AmbientLight;
  private pmremTex: THREE.Texture | null = null;

  private holoModelGroup: THREE.Group;
  private droneGroup: THREE.Group;
  private droneRotors: THREE.Mesh[] = [];
  private dustPoints: THREE.Points;
  private dustVelocities: Float32Array;
  private beaconMeshes: THREE.Mesh[] = [];

  // Camera Choreography & Drag Orbit State
  private focusMode: LobbyFocusMode = 'overview';
  private curAzimuth = CAMERA_PRESETS.overview.azimuth;
  private curElevation = CAMERA_PRESETS.overview.elevation;
  private curDistance = CAMERA_PRESETS.overview.distance;
  private curTarget = CAMERA_PRESETS.overview.target.clone();
  private userAzimuthOffset = 0;
  private userElevationOffset = 0;
  private userDistanceOffset = 0;
  private isDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private elapsed = 0;

  constructor(
    renderer: THREE.WebGLRenderer,
    isSoftwareGl: boolean,
    aspect: number,
    maxAnisotropy: number,
    initialAccentColor: string,
    initialWeaponSlot: number
  ) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070b12);
    this.scene.fog = new THREE.FogExp2(0x070b12, 0.014);

    const pmrem = new THREE.PMREMGenerator(renderer);
    this.pmremTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.pmremTex;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.1, 260);

    // --- 1. Three-Point Studio Hangar Lighting + Potato Ambient Fallback ---
    this.ambientLight = new THREE.AmbientLight(0xdbeafe, 1.25);
    this.ambientLight.visible = false;
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0b1019, 0.72);
    this.scene.add(this.hemiLight);

    // Warm Key Light above podium
    this.keyLight = new THREE.DirectionalLight(0xfde68a, 2.05);
    this.keyLight.position.set(4.5, 8.5, 5.5);
    this.keyLight.castShadow = !isSoftwareGl;
    this.keyLight.shadow.mapSize.width = 2048;
    this.keyLight.shadow.mapSize.height = 2048;
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 28;
    this.keyLight.shadow.camera.left = -10;
    this.keyLight.shadow.camera.right = 10;
    this.keyLight.shadow.camera.top = 10;
    this.keyLight.shadow.camera.bottom = -10;
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    // Cool Rim Light behind the Blast Door / Operator silhouette
    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 1.35);
    this.rimLight.position.set(-3.5, 5.2, -7.2);
    this.scene.add(this.rimLight);

    // Soft Fill from left holo-table flank
    this.fillLight = new THREE.PointLight(0x06b6d4, 6.5, 16, 2);
    this.fillLight.position.set(-4.2, 2.4, 2.5);
    this.scene.add(this.fillLight);

    // --- 2. Exterior Cyber-Night Sky & Megacity Skyline ---
    const skyTex = createSkyDomeTexture();
    const skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(120, 28, 18),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
    );
    this.scene.add(skyDome);

    this.buildMegacitySkyline();

    // --- 3. Hangar Bay Floor, Walls, Slanted Pillars, Glass Windows & Blast Door ---
    this.buildHangarArchitecture(maxAnisotropy);

    // --- 4. Rotating Turntable Platform ---
    this.turntableGroup = new THREE.Group();
    this.scene.add(this.turntableGroup);

    const brushedSteel = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.25,
      metalness: 0.9,
    });
    const darkTrim = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.5,
      metalness: 0.75,
    });

    const basePlinth = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.5, 0.14, 48), darkTrim);
    basePlinth.position.y = 0.07;
    basePlinth.receiveShadow = true;
    this.scene.add(basePlinth);

    const rotatingDeck = new THREE.Mesh(new THREE.CylinderGeometry(1.98, 2.08, 0.12, 48), brushedSteel);
    rotatingDeck.position.y = 0.18;
    rotatingDeck.receiveShadow = true;
    rotatingDeck.castShadow = true;
    this.turntableGroup.add(rotatingDeck);

    // Spoke plates on rotating turntable
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 1.82), darkTrim);
      spoke.position.set(Math.sin(ang) * 0.92, 0.245, Math.cos(ang) * 0.92);
      spoke.rotation.y = ang;
      this.turntableGroup.add(spoke);
    }

    // Outer Cyan Neon Ring + Inner Amber Neon Ring
    const cyanRingMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 2.0,
      roughness: 0.2,
    });
    const outerLed = new THREE.Mesh(new THREE.TorusGeometry(2.04, 0.024, 12, 64), cyanRingMat);
    outerLed.rotation.x = Math.PI / 2;
    outerLed.position.y = 0.21;
    this.turntableGroup.add(outerLed);

    this.accentRingMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.7,
      roughness: 0.2,
    });
    const innerLed = new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.018, 10, 56), this.accentRingMat);
    innerLed.rotation.x = Math.PI / 2;
    innerLed.position.y = 0.245;
    this.turntableGroup.add(innerLed);

    this.podiumLight = new THREE.PointLight(0x06b6d4, 5.5, 8, 2);
    this.podiumLight.position.set(0, 0.55, 0);
    this.scene.add(this.podiumLight);

    // --- 5. Third-Person Tactical 3D Operator Model ---
    this.visorMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(initialAccentColor),
      emissive: new THREE.Color(initialAccentColor),
      emissiveIntensity: 2.2,
      roughness: 0.12,
      metalness: 0.3,
    });

    this.operatorGroup = new THREE.Group();
    this.operatorGroup.position.y = 0.245; // Rest flush on turntable top
    this.torsoPivot = new THREE.Group();
    this.headPivot = new THREE.Group();
    this.weaponMount = new THREE.Group();
    this.buildOperatorModel();
    this.turntableGroup.add(this.operatorGroup);

    this.setWeapon(initialWeaponSlot);
    this.setAccentColor(initialAccentColor);

    // --- 6. Hangar Props: Illuminated Weapon Racks, Holo-Table, Supply Crates, Hovering Drone ---
    this.buildWeaponRacks();
    this.holoModelGroup = this.buildHoloTable();
    this.buildSupplyCrates(maxAnisotropy);
    this.droneGroup = this.buildReconDrone();

    // --- 7. Floating Dust Motes ---
    const dustCount = 220;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    this.dustVelocities = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 18;
      dustPos[i * 3 + 1] = 0.3 + Math.random() * 6.5;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 16;
      this.dustVelocities[i * 3] = (Math.random() - 0.5) * 0.14;
      this.dustVelocities[i * 3 + 1] = 0.04 + Math.random() * 0.08;
      this.dustVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.14;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      map: createDustTexture(),
      size: 0.11,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.dustPoints = new THREE.Points(dustGeo, dustMat);
    this.scene.add(this.dustPoints);

    // Snap initial camera position immediately
    this.applyCameraPosition(1.0);
  }

  private buildMegacitySkyline() {
    const cityGroup = new THREE.Group();
    const texCyan = createSkyscraperWindowTexture('#06b6d4');
    const texAmber = createSkyscraperWindowTexture('#f59e0b');

    const buildingPositions: [number, number, number, number, number, boolean][] = [
      // [x, z, width, depth, height, amberTint]
      [-34, -26, 7, 7, 36, false],
      [-25, -34, 9, 8, 52, true],
      [-14, -42, 10, 10, 64, false],
      [0, -48, 12, 10, 74, false],
      [15, -40, 9, 9, 58, true],
      [28, -32, 8, 8, 46, false],
      [36, -24, 7, 7, 38, true],
      [-30, -14, 6, 7, 32, true],
      [-28, 4, 7, 8, 44, false],
      [-32, 18, 8, 8, 38, true],
      [30, -12, 7, 7, 36, false],
      [29, 6, 8, 8, 48, true],
      [33, 20, 7, 7, 40, false],
      [-42, -38, 11, 11, 56, false],
      [42, -38, 11, 11, 60, true],
      [-18, -28, 6, 6, 40, true],
      [18, -26, 6, 6, 42, false],
    ];

    const beaconGeo = new THREE.SphereGeometry(0.28, 8, 8);
    buildingPositions.forEach(([x, z, w, d, h, isAmber]) => {
      const tex = isAmber ? texAmber.clone() : texCyan.clone();
      tex.needsUpdate = true;
      tex.repeat.set(Math.max(1, Math.round(w / 4)), Math.max(2, Math.round(h / 12)));

      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        emissive: isAmber ? 0x451a03 : 0x082f49,
        emissiveMap: tex,
        emissiveIntensity: 0.95,
        roughness: 0.4,
        metalness: 0.6,
      });

      const bldg = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      bldg.position.set(x, h / 2 - 14, z);
      cityGroup.add(bldg);

      // Rooftop aviation beacon
      const beaconMat = new THREE.MeshBasicMaterial({
        color: isAmber ? 0xf59e0b : 0x06b6d4,
      });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(x, h - 13.7, z);
      cityGroup.add(beacon);
      this.beaconMeshes.push(beacon);
    });

    this.scene.add(cityGroup);
  }

  private buildHangarArchitecture(maxAnisotropy: number) {
    const { map: deckMap, bumpMap: deckBump } = createHangarDeckTexture(maxAnisotropy);
    deckMap.repeat.set(9, 9);
    deckBump.repeat.set(9, 9);

    const floorMat = new THREE.MeshStandardMaterial({
      map: deckMap,
      bumpMap: deckBump,
      bumpScale: 0.03,
      roughness: 0.42,
      metalness: 0.72,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 22), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const { map: wallMap, bumpMap: wallBump } = createWallTextures(maxAnisotropy);
    wallMap.repeat.set(3, 1.5);
    wallBump.repeat.set(3, 1.5);

    const wallMat = new THREE.MeshStandardMaterial({
      map: wallMap,
      bumpMap: wallBump,
      bumpScale: 0.04,
      roughness: 0.48,
      metalness: 0.68,
    });

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x1a2230,
      roughness: 0.35,
      metalness: 0.85,
    });

    const hazardMat = new THREE.MeshStandardMaterial({
      map: createHazardTexture(maxAnisotropy),
      roughness: 0.55,
      metalness: 0.3,
    });

    // Giant Rear Blast Door ("GIS DEPLOYMENT BAY")
    const { map: doorMap, bumpMap: doorBump } = createBlastDoorTexture(maxAnisotropy);
    const blastDoor = new THREE.Mesh(
      new THREE.BoxGeometry(7.6, 7.2, 0.45),
      new THREE.MeshStandardMaterial({
        map: doorMap,
        bumpMap: doorBump,
        bumpScale: 0.045,
        roughness: 0.38,
        metalness: 0.78,
      })
    );
    blastDoor.position.set(0, 3.6, -8.8);
    blastDoor.receiveShadow = true;
    this.scene.add(blastDoor);

    // Blast Door Frame Pillars + Hydraulic Rams
    [-4.1, 4.1].forEach((px) => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.7, 8.2, 0.9), steelMat);
      col.position.set(px, 4.1, -8.6);
      this.scene.add(col);

      const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 6.2, 12), steelMat);
      piston.position.set(px * 0.9, 3.1, -8.25);
      this.scene.add(piston);
    });

    const headerBeam = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.85, 1.0), steelMat);
    headerBeam.position.set(0, 7.6, -8.6);
    this.scene.add(headerBeam);

    // Rear Side Lower Bulkheads + Flanking Observation Glass looking out at Cyber City
    [-7.8, 7.8].forEach((bx) => {
      const lowerBulkhead = new THREE.Mesh(new THREE.BoxGeometry(6.8, 2.1, 0.4), wallMat);
      lowerBulkhead.position.set(bx, 1.05, -8.8);
      this.scene.add(lowerBulkhead);

      const upperHeader = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.4, 0.4), steelMat);
      upperHeader.position.set(bx, 7.9, -8.8);
      this.scene.add(upperHeader);

      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.16,
        roughness: 0.08,
        metalness: 0.1,
        depthWrite: false,
      });
      const windowPane = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 5.1), glassMat);
      windowPane.position.set(bx, 4.65, -8.8);
      windowPane.renderOrder = 4;
      this.scene.add(windowPane);
    });

    // Side Hangar Walls (Lower Steel Bulkheads + Giant Panoramic Observation Windows)
    [-11.0, 11.0].forEach((wx) => {
      const lowerWall = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.2, 20.0), wallMat);
      lowerWall.position.set(wx, 1.1, 0);
      this.scene.add(lowerWall);

      const sillHazard = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.22, 19.6), hazardMat);
      sillHazard.position.set(wx, 2.22, 0);
      this.scene.add(sillHazard);

      const topBeam = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.3, 20.0), steelMat);
      topBeam.position.set(wx, 7.95, 0);
      this.scene.add(topBeam);

      const sideGlassMat = new THREE.MeshPhysicalMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.14,
        roughness: 0.1,
        metalness: 0.15,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const sideGlass = new THREE.Mesh(new THREE.PlaneGeometry(19.2, 5.0), sideGlassMat);
      sideGlass.rotation.y = Math.PI / 2;
      sideGlass.position.set(wx, 4.85, 0);
      sideGlass.renderOrder = 4;
      this.scene.add(sideGlass);
    });

    // Angled Structural Steel Pillars along Hangar Sides + Overhead Ceiling Gantry Trusses
    const pillarZ = [-6.5, -1.5, 3.5, 7.8];
    pillarZ.forEach((pz) => {
      [-1, 1].forEach((side) => {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 8.6, 0.65), steelMat);
        pillar.position.set(side * 9.8, 4.15, pz);
        pillar.rotation.z = side * 0.16; // Lean inward ergonomically
        pillar.castShadow = true;
        this.scene.add(pillar);
      });

      // Overhead ceiling gantry beam
      const truss = new THREE.Mesh(new THREE.BoxGeometry(18.8, 0.45, 0.55), steelMat);
      truss.position.set(0, 8.45, pz);
      this.scene.add(truss);

      // Glowing overhead light bar
      const lightStrip = new THREE.Mesh(
        new THREE.BoxGeometry(7.2, 0.08, 0.18),
        new THREE.MeshBasicMaterial({ color: pz < 0 ? 0x67e8f9 : 0xfbbf24 })
      );
      lightStrip.position.set(0, 8.2, pz);
      this.scene.add(lightStrip);
    });

    // Dark ceiling panels
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(24, 22), darkMat());
    roof.rotation.x = Math.PI / 2;
    roof.position.y = 8.75;
    this.scene.add(roof);

    function darkMat() {
      return new THREE.MeshStandardMaterial({ color: 0x0b1018, roughness: 0.7, metalness: 0.5 });
    }
  }

  private buildOperatorModel() {
    const suitMat = new THREE.MeshStandardMaterial({
      color: 0x1b222e,
      roughness: 0.72,
      metalness: 0.2,
    });
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x2c3647,
      roughness: 0.34,
      metalness: 0.78,
    });
    const gunmetalMat = new THREE.MeshStandardMaterial({
      color: 0x121720,
      roughness: 0.42,
      metalness: 0.85,
    });
    const trimCyan = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.4,
    });

    // --- Legs & Boots (grounded at y = 0) ---
    [-0.17, 0.17].forEach((lx, idx) => {
      const leg = new THREE.Group();
      leg.position.set(lx, 0, idx === 0 ? 0.03 : -0.03);

      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.25), gunmetalMat);
      boot.position.set(0, 0.06, 0.03);
      boot.castShadow = true;
      leg.add(boot);

      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.06, 0.36, 12), suitMat);
      shin.position.y = 0.28;
      shin.castShadow = true;
      leg.add(shin);

      const shinGuard = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.26, 0.08), armorMat);
      shinGuard.position.set(0, 0.28, 0.045);
      leg.add(shinGuard);

      const knee = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.12), armorMat);
      knee.position.set(0, 0.47, 0.035);
      leg.add(knee);

      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.072, 0.38, 12), suitMat);
      thigh.position.y = 0.68;
      thigh.castShadow = true;
      leg.add(thigh);

      const thighPlate = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.2, 0.11), armorMat);
      thighPlate.position.set(idx === 0 ? -0.04 : 0.04, 0.68, 0.02);
      leg.add(thighPlate);

      this.operatorGroup.add(leg);
    });

    // Pelvis & Tactical Belt
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.24), gunmetalMat);
    pelvis.position.y = 0.92;
    pelvis.castShadow = true;
    this.operatorGroup.add(pelvis);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.075, 0.26), armorMat);
    belt.position.y = 0.98;
    this.operatorGroup.add(belt);

    // --- Articulated Upper Torso (Breathing Pivot) ---
    this.torsoPivot.position.y = 1.0;
    this.operatorGroup.add(this.torsoPivot);

    const chestUndersuit = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.48, 0.24), suitMat);
    chestUndersuit.position.y = 0.24;
    chestUndersuit.castShadow = true;
    this.torsoPivot.add(chestUndersuit);

    // Front Tactical Vest Armor Plate
    const vestFront = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.29), armorMat);
    vestFront.position.set(0, 0.25, 0.01);
    vestFront.castShadow = true;
    this.torsoPivot.add(vestFront);

    // Chest MOLLE Pouches
    [-0.1, 0, 0.1].forEach((px) => {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.11, 0.05), gunmetalMat);
      pouch.position.set(px, 0.14, 0.165);
      this.torsoPivot.add(pouch);
    });

    // Rear Power Pack + Glowing Spine Strip
    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.14), gunmetalMat);
    backpack.position.set(0, 0.27, -0.17);
    backpack.castShadow = true;
    this.torsoPivot.add(backpack);

    const spineLed = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.02), trimCyan);
    spineLed.position.set(0, 0.27, -0.245);
    this.torsoPivot.add(spineLed);

    // Collar Guard
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.032, 8, 16), armorMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.48, 0);
    this.torsoPivot.add(collar);

    // --- Shoulders & Arms (Low-Ready Showcase Stance) ---
    // Right Arm (holding weapon grip)
    const rShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.18), armorMat);
    rShoulder.position.set(-0.27, 0.42, 0.02);
    rShoulder.rotation.z = 0.22;
    rShoulder.castShadow = true;
    this.torsoPivot.add(rShoulder);

    const rUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.28, 10), suitMat);
    rUpperArm.position.set(-0.27, 0.28, 0.08);
    rUpperArm.rotation.x = -0.55;
    rUpperArm.rotation.z = -0.15;
    this.torsoPivot.add(rUpperArm);

    const rForearm = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.26, 0.095), armorMat);
    rForearm.position.set(-0.18, 0.2, 0.24);
    rForearm.rotation.x = -1.1;
    rForearm.rotation.z = -0.35;
    this.torsoPivot.add(rForearm);

    // Left Arm (supporting foregrip / barrel)
    const lShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.18), armorMat);
    lShoulder.position.set(0.27, 0.42, 0.02);
    lShoulder.rotation.z = -0.22;
    lShoulder.castShadow = true;
    this.torsoPivot.add(lShoulder);

    const lUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.28, 10), suitMat);
    lUpperArm.position.set(0.26, 0.29, 0.11);
    lUpperArm.rotation.x = -0.75;
    lUpperArm.rotation.z = 0.2;
    this.torsoPivot.add(lUpperArm);

    const lForearm = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.26, 0.095), armorMat);
    lForearm.position.set(0.11, 0.24, 0.29);
    lForearm.rotation.x = -1.25;
    lForearm.rotation.z = 0.55;
    this.torsoPivot.add(lForearm);

    // Weapon Mount positioned naturally in Operator's hands
    this.weaponMount.position.set(-0.04, 0.23, 0.34);
    this.weaponMount.rotation.set(0.14, -0.78, 0.08);
    this.weaponMount.scale.setScalar(1.08);
    this.torsoPivot.add(this.weaponMount);

    const ar = createARX7ViewModel();
    const v9 = createVectorV9ViewModel();
    const sg = createSG12ViewModel();
    const sr = createSR50ViewModel();
    const py = createDesertPythonViewModel();
    py.scale.setScalar(1.22);
    const fg = createFlashFragViewModel();
    fg.rotation.x = Math.PI / 2;
    fg.scale.setScalar(1.25);
    const med = createNanoMedkitViewModel();
    med.rotation.x = Math.PI / 2;
    med.scale.setScalar(0.95);
    this.weaponModels = [ar, v9, sg, sr, py, fg, med];
    this.weaponModels.forEach((vm) => {
      vm.visible = false;
      setViewmodelLaserVisible(vm, false);
      vm.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          obj.castShadow = true;
        }
      });
      this.weaponMount.add(vm);
    });

    // --- Head & Ballistic Tactical Helmet (`headPivot`) ---
    this.headPivot.position.set(0, 0.52, 0.01);
    this.torsoPivot.add(this.headPivot);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.068, 0.1, 10), suitMat);
    neck.position.y = 0.04;
    this.headPivot.add(neck);

    const helmetShell = new THREE.Mesh(new THREE.SphereGeometry(0.148, 18, 16), armorMat);
    helmetShell.position.y = 0.18;
    helmetShell.scale.set(0.96, 1.02, 1.08);
    helmetShell.castShadow = true;
    this.headPivot.add(helmetShell);

    const chinGuard = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.1, 0.17), gunmetalMat);
    chinGuard.position.set(0, 0.11, 0.06);
    this.headPivot.add(chinGuard);

    // Side Comms Earcups
    [-0.145, 0.145].forEach((ex) => {
      const ear = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.04, 12).rotateZ(Math.PI / 2),
        gunmetalMat
      );
      ear.position.set(ex, 0.17, -0.01);
      this.headPivot.add(ear);
    });

    // Glowing Tactical Visor (live-updated from Profile accentColor)
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.068, 0.11), this.visorMat);
    visor.position.set(0, 0.195, 0.108);
    this.headPivot.add(visor);

    // Helmet Brow NVG Rail & Antenna
    const browMount = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.036, 0.06), gunmetalMat);
    browMount.position.set(0, 0.255, 0.13);
    this.headPivot.add(browMount);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.18, 6), gunmetalMat);
    antenna.position.set(-0.14, 0.3, -0.06);
    this.headPivot.add(antenna);
  }

  private buildWeaponRacks() {
    const rackMetal = new THREE.MeshStandardMaterial({
      color: 0x161d29,
      roughness: 0.4,
      metalness: 0.82,
    });
    const stripMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });

    const racks: { x: number; z: number; rotY: number }[] = [
      { x: -7.2, z: -2.2, rotY: Math.PI / 3.4 },
      { x: 7.2, z: -2.2, rotY: -Math.PI / 3.4 },
    ];

    racks.forEach((cfg, rIdx) => {
      const rack = new THREE.Group();
      rack.position.set(cfg.x, 0, cfg.z);
      rack.rotation.y = cfg.rotY;

      const backBoard = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.8, 0.18), rackMetal);
      backBoard.position.y = 1.6;
      backBoard.castShadow = true;
      backBoard.receiveShadow = true;
      rack.add(backBoard);

      const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.16, 0.65), rackMetal);
      canopy.position.set(0, 3.02, 0.22);
      rack.add(canopy);

      const lightBar = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.05, 0.12), stripMat);
      lightBar.position.set(0, 2.93, 0.42);
      rack.add(lightBar);

      // Overhead small spotlight illuminating rack weapons
      const rackSpot = new THREE.SpotLight(rIdx === 0 ? 0x38bdf8 : 0xfbbf24, 14, 7, Math.PI / 4, 0.6, 1.5);
      rackSpot.position.set(0, 2.9, 0.55);
      const targetObj = new THREE.Object3D();
      targetObj.position.set(0, 1.4, 0.15);
      rack.add(targetObj);
      rackSpot.target = targetObj;
      rack.add(rackSpot);

      // Mount full arsenal across left & right Hangar weapon racks
      const items =
        rIdx === 0
          ? [
              { model: createARX7ViewModel(), y: 2.32, scale: 1.48 },
              { model: createSG12ViewModel(), y: 1.62, scale: 1.48 },
              { model: createSR50ViewModel(), y: 0.92, scale: 1.36 },
            ]
          : [
              { model: createVectorV9ViewModel(), y: 2.32, scale: 1.62 },
              { model: createDesertPythonViewModel(), y: 1.62, scale: 2.2 },
              { model: createFlashFragViewModel(), y: 0.92, scale: 2.4 },
            ];
      items.forEach((it) => {
        setViewmodelLaserVisible(it.model, false);
        it.model.rotation.y = Math.PI / 2;
        it.model.scale.setScalar(it.scale);
        it.model.position.set(0, it.y, 0.22);
        rack.add(it.model);

        [-0.36, 0.36].forEach((px) => {
          const peg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.22), rackMetal);
          peg.position.set(px, it.y - 0.06, 0.15);
          rack.add(peg);
        });
      });

      this.scene.add(rack);
    });
  }

  private buildHoloTable(): THREE.Group {
    const tableGroup = new THREE.Group();
    tableGroup.position.set(-3.45, 0, 1.45);
    tableGroup.rotation.y = 0.42;

    const deskMat = new THREE.MeshStandardMaterial({
      color: 0x161f2d,
      roughness: 0.35,
      metalness: 0.85,
    });
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.62, 0.88, 8), deskMat);
    ped.position.y = 0.44;
    ped.castShadow = true;
    tableGroup.add(ped);

    const topPlate = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 1.15), deskMat);
    topPlate.position.y = 0.92;
    topPlate.castShadow = true;
    tableGroup.add(topPlate);

    const rimCyan = new THREE.Mesh(
      new THREE.BoxGeometry(1.74, 0.03, 1.19),
      new THREE.MeshBasicMaterial({ color: 0x06b6d4 })
    );
    rimCyan.position.y = 0.92;
    tableGroup.add(rimCyan);

    // Translucent emitter cone
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 0.65, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    cone.rotation.x = Math.PI;
    cone.position.y = 1.3;
    tableGroup.add(cone);

    // Floating rotating 3D wireframe tactical map mini-model
    const holo = new THREE.Group();
    holo.position.y = 1.38;
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.72,
    });
    const amberWire = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      wireframe: true,
      transparent: true,
      opacity: 0.8,
    });

    const baseGrid = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.02, 0.76), wireMat);
    holo.add(baseGrid);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.14), amberWire);
    bridge.position.y = 0.16;
    holo.add(bridge);
    [
      [-0.25, -0.25],
      [0.25, 0.25],
    ].forEach(([tx, tz]) => {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.14), wireMat);
      tower.position.set(tx, 0.13, tz);
      holo.add(tower);
    });

    tableGroup.add(holo);
    this.scene.add(tableGroup);
    return holo;
  }

  private buildSupplyCrates(maxAnisotropy: number) {
    const { map: amberMap, bumpMap: amberBump } = createCrateTextures('#f59e0b', maxAnisotropy);
    const { map: cyanMap, bumpMap: cyanBump } = createCrateTextures('#06b6d4', maxAnisotropy);

    const matAmber = new THREE.MeshStandardMaterial({
      map: amberMap,
      bumpMap: amberBump,
      bumpScale: 0.03,
      roughness: 0.5,
      metalness: 0.45,
    });
    const matCyan = new THREE.MeshStandardMaterial({
      map: cyanMap,
      bumpMap: cyanBump,
      bumpScale: 0.03,
      roughness: 0.5,
      metalness: 0.45,
    });

    const specs: [number, number, number, number, number, boolean][] = [
      [4.5, 0.55, 2.4, 1.1, 0.35, true],
      [5.4, 0.45, 1.4, 0.9, -0.2, false],
      [4.65, 1.5, 2.35, 0.8, 0.15, false],
      [-5.1, 0.6, -5.6, 1.2, 0.22, true],
      [-6.3, 0.5, -4.9, 1.0, -0.4, false],
      [5.2, 0.6, -5.8, 1.2, -0.3, false],
    ];
    specs.forEach(([x, y, z, s, ry, isAmber]) => {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), isAmber ? matAmber : matCyan);
      crate.position.set(x, y, z);
      crate.rotation.y = ry;
      crate.castShadow = true;
      crate.receiveShadow = true;
      this.scene.add(crate);
    });
  }

  private buildReconDrone(): THREE.Group {
    const drone = new THREE.Group();
    drone.position.set(3.85, 2.85, -3.1);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.3,
      metalness: 0.85,
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 14), bodyMat);
    core.scale.set(1.2, 0.72, 1.35);
    core.castShadow = true;
    drone.add(core);

    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x06b6d4 })
    );
    eye.position.set(0, -0.02, 0.3);
    drone.add(eye);

    const rotorMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });

    [
      [-0.36, 0.32],
      [0.36, 0.32],
      [-0.36, -0.32],
      [0.36, -0.32],
    ].forEach(([ax, az]) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.035, 0.05), bodyMat);
      arm.position.set(ax * 0.55, 0.04, az * 0.55);
      arm.rotation.y = Math.atan2(az, ax);
      drone.add(arm);

      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 10), bodyMat);
      pod.position.set(ax, 0.06, az);
      drone.add(pod);

      const rotor = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.18, 16), rotorMat);
      rotor.rotation.x = Math.PI / 2;
      rotor.position.set(ax, 0.105, az);
      drone.add(rotor);
      this.droneRotors.push(rotor);
    });

    this.scene.add(drone);
    return drone;
  }

  // --- External State Updates ---
  public setFocusMode(mode: LobbyFocusMode) {
    if (this.focusMode !== mode) {
      this.focusMode = mode;
      // Gently reset manual drag offsets when transitioning into a targeted close-up
      this.userAzimuthOffset = 0;
      this.userElevationOffset = 0;
      this.userDistanceOffset = 0;
    }
  }

  public setWeapon(slotIndex: number) {
    this.weaponModels.forEach((vm, idx) => {
      vm.visible = idx === slotIndex;
    });
  }

  public setAccentColor(hex: string) {
    const col = new THREE.Color(hex || '#06b6d4');
    this.visorMat.color.copy(col);
    this.visorMat.emissive.copy(col);
    this.accentRingMat.color.copy(col);
    this.accentRingMat.emissive.copy(col);
    this.podiumLight.color.copy(col);
  }

  public setGraphicsPreset(
    preset: 'high' | 'medium' | 'potato',
    isSoftwareGl: boolean,
    renderer?: THREE.WebGLRenderer
  ) {
    if (renderer) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      this.pmremTex?.dispose();
      this.pmremTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    }

    if (preset === 'potato') {
      this.dustPoints.visible = false;
      this.ambientLight.visible = true;
      this.hemiLight.visible = false;
      this.rimLight.visible = false;
      this.fillLight.intensity = 0;
      this.podiumLight.intensity = 0;
      this.keyLight.castShadow = false;
      this.keyLight.intensity = 1.35;
      this.scene.environment = null;
      this.scene.fog = new THREE.Fog(0x070b12, 8, 28);
      this.camera.far = 90;
    } else {
      this.dustPoints.visible = true;
      this.ambientLight.visible = false;
      this.hemiLight.visible = true;
      this.rimLight.visible = true;
      this.fillLight.intensity = 6.5;
      this.podiumLight.intensity = 5.5;
      this.keyLight.castShadow = !isSoftwareGl;
      this.keyLight.intensity = 2.05;
      this.scene.environment = this.pmremTex;
      this.scene.fog = new THREE.FogExp2(0x070b12, 0.014);
      this.camera.far = preset === 'medium' ? 180 : 260;
    }
    this.camera.updateProjectionMatrix();
  }

  // --- Mouse Drag Orbit & Wheel Zoom Handlers ---
  public handlePointerDown(clientX: number, clientY: number) {
    this.isDragging = true;
    this.lastPointerX = clientX;
    this.lastPointerY = clientY;
  }

  public handlePointerMove(clientX: number, clientY: number) {
    if (!this.isDragging) return;
    const dx = clientX - this.lastPointerX;
    const dy = clientY - this.lastPointerY;
    this.lastPointerX = clientX;
    this.lastPointerY = clientY;

    this.userAzimuthOffset -= dx * 0.0075;
    this.userElevationOffset = THREE.MathUtils.clamp(
      this.userElevationOffset + dy * 0.005,
      -0.25,
      0.55
    );
  }

  public handlePointerUp() {
    this.isDragging = false;
  }

  public handleWheel(deltaY: number) {
    this.userDistanceOffset = THREE.MathUtils.clamp(
      this.userDistanceOffset + deltaY * 0.0025,
      -1.2,
      2.6
    );
  }

  private applyCameraPosition(lerpAlpha: number) {
    const preset = CAMERA_PRESETS[this.focusMode];
    const targetAz = preset.azimuth + this.userAzimuthOffset;
    const targetEl = THREE.MathUtils.clamp(preset.elevation + this.userElevationOffset, -0.05, 0.72);
    const targetDist = THREE.MathUtils.clamp(preset.distance + this.userDistanceOffset, 1.35, 9.2);

    this.curAzimuth = THREE.MathUtils.lerp(this.curAzimuth, targetAz, lerpAlpha);
    this.curElevation = THREE.MathUtils.lerp(this.curElevation, targetEl, lerpAlpha);
    this.curDistance = THREE.MathUtils.lerp(this.curDistance, targetDist, lerpAlpha);
    this.curTarget.lerp(preset.target, lerpAlpha);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, preset.fov, lerpAlpha);
    this.camera.updateProjectionMatrix();

    const horiz = Math.cos(this.curElevation) * this.curDistance;
    this.camera.position.set(
      this.curTarget.x + Math.sin(this.curAzimuth) * horiz,
      this.curTarget.y + Math.sin(this.curElevation) * this.curDistance,
      this.curTarget.z + Math.cos(this.curAzimuth) * horiz
    );
    this.camera.lookAt(this.curTarget);
  }

  public update(delta: number) {
    this.elapsed += delta;

    // 1. Slow Turntable Rotation (pauses while dragging so inspection feels locked-in)
    if (!this.isDragging) {
      this.turntableGroup.rotation.y += delta * 0.18;
    }

    // 2. Operator Breathing Cycle & Subtle Head Glance
    const breath = Math.sin(this.elapsed * 2.1);
    this.torsoPivot.position.y = 1.0 + breath * 0.008;
    this.torsoPivot.rotation.x = breath * 0.015;
    this.headPivot.rotation.y = Math.sin(this.elapsed * 0.65) * 0.14;
    this.headPivot.rotation.x = Math.sin(this.elapsed * 1.1) * 0.04;

    // 3. Holo-Table Wireframe Spin
    this.holoModelGroup.rotation.y += delta * 0.45;
    this.holoModelGroup.position.y = 1.38 + Math.sin(this.elapsed * 1.8) * 0.03;

    // 4. Hovering Recon Drone & Spinning Rotors
    this.droneGroup.position.y = 2.85 + Math.sin(this.elapsed * 1.6) * 0.22;
    this.droneGroup.position.x = 3.85 + Math.sin(this.elapsed * 0.7) * 0.35;
    this.droneGroup.rotation.y = -0.55 + Math.sin(this.elapsed * 0.5) * 0.25;
    for (let i = 0; i < this.droneRotors.length; i++) {
      this.droneRotors[i].rotation.z += delta * 18;
    }

    // 5. Subtle City Beacon Pulse
    const pulse = 0.6 + 0.4 * Math.sin(this.elapsed * 2.8);
    for (let i = 0; i < this.beaconMeshes.length; i++) {
      this.beaconMeshes[i].scale.setScalar(0.85 + pulse * 0.35);
    }

    // 6. Floating Dust Motes Drift (skipped in Potato Mode)
    if (this.dustPoints.visible) {
      const posAttr = this.dustPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] += this.dustVelocities[i] * delta;
        arr[i + 1] += this.dustVelocities[i + 1] * delta;
        arr[i + 2] += this.dustVelocities[i + 2] * delta;
        if (arr[i + 1] > 7.2) arr[i + 1] = 0.3;
        if (arr[i] > 9) arr[i] = -9;
        if (arr[i] < -9) arr[i] = 9;
        if (arr[i + 2] > 8) arr[i + 2] = -8;
        if (arr[i + 2] < -8) arr[i + 2] = 8;
      }
      posAttr.needsUpdate = true;
    }

    // 7. Smooth Exponential Camera Damping
    const alpha = 1 - Math.exp(-7.5 * delta);
    this.applyCameraPosition(alpha);
  }
}
