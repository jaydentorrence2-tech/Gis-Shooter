/**
 * GIS Shooter: Tactical Edition — Core 3D FPS Engine
 * Manages Three.js scene, PointerLockControls, orbiting menu camera, player physics,
 * 4 multi-component weapon viewmodels with sway/bob/recoil/pump/reload/ADS,
 * articulated AI bots, shell ejection, bullet decals, and HUD/Profile state.
 */

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundSystem } from '../audio/SoundSystem';
import { LobbyFocusMode, TacticalLobby } from './lobby';
import { buildTacticalArena, RadarRect, TacticalArena } from './map';
import { ParticleSystem } from './particles';
import { EnemyBot } from './enemy';
import { BossHitZone, BossSpecialist } from './boss';
import {
  BOSS_LANDING_POS,
  BossArrivalCutscene,
  CutsceneHudSnapshot,
} from './cutscene';
import {
  WeaponDef,
  Slot4Choice,
  SLOT4_OPTIONS,
  INITIAL_WEAPONS,
  buildFourSlotLoadout,
  createARX7ViewModel,
  createVectorV9ViewModel,
  createSG12ViewModel,
  createSR50ViewModel,
  createDesertPythonViewModel,
  createFlashFragViewModel,
  createGrenadeProjectileMesh,
  createNanoMedkitViewModel,
  setViewmodelLaserVisible,
} from './weapons';
import {
  getMergedLeaderboard,
  LeaderboardEntry,
  saveLocalScore,
} from './leaderboard';

export interface GameState {
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  score: number;
  wave: number;
  enemiesRemaining: number;
  isDead: boolean;
  isPaused: boolean;
  isInMenu: boolean;
  isInventoryOpen: boolean;
  activeWeaponIndex: number;
  weapons: WeaponDef[];
  isReloading: boolean;
  isAiming: boolean;
  isScoped: boolean;
  isCrouching: boolean;
  flashlightOn: boolean;
  flashbangGlare: number;
  crosshairSpread: number;
  hitmarkerActive: boolean;
  hitmarkerHeadshot: boolean;
  damageVignette: number;
  killFeed: { id: string; text: string; headshot: boolean }[];
  sessionKills: number;
  sessionHeadshots: number;
  sessionShots: number;
  sessionHits: number;
  sessionXp: number;
  survivalTimeSec: number;
  scoreSubmitted: boolean;
  submittedRank: number | null;
  prepPhaseRemaining: number;
  isBossWave: boolean;
  bossState: {
    name: string;
    health: number;
    maxHealth: number;
    attackLabel: string;
    active: boolean;
  } | null;
  slowRemaining: number;
  inGasHazard: boolean;
  bossBanner: {
    title: string;
    subtitle: string;
    tone: 'crimson' | 'emerald';
  } | null;
  cutscene: CutsceneHudSnapshot | null;
  vampireHealEvent: {
    id: number;
    amount: number;
    percent: number;
    label: string;
  } | null;
  fps: number;
  pointerLockNotice: string | null;
  adminCheats: AdminCheatsState;
  radarData: {
    playerX: number;
    playerZ: number;
    playerAngle: number;
    enemies: { x: number; z: number; isDead: boolean; isBoss?: boolean }[];
    rects: RadarRect[];
  };
}

export interface AdminCheatsState {
  godMode: boolean;
  infiniteAmmo: boolean;
  speedMultiplier: number;
  jumpMultiplier: number;
}

export type GraphicsPreset = 'high' | 'medium' | 'potato';

export type CrosshairStyle = 'classic' | 'dot' | 'circle' | 'cross_dot';

export interface CrosshairConfig {
  style: CrosshairStyle;
  color: string;
  length: number;
  thickness: number;
  gap: number;
  dotSize: number;
  opacity: number;
  outline: boolean;
  dynamic: boolean;
}

export const DEFAULT_CROSSHAIR: CrosshairConfig = {
  style: 'classic',
  color: '#22C55E',
  length: 9,
  thickness: 2,
  gap: 5,
  dotSize: 3,
  opacity: 0.95,
  outline: true,
  dynamic: true,
};

export interface PlayerProfileData {
  callsign: string;
  level: number;
  xp: number;
  totalKills: number;
  totalHeadshots: number;
  totalDeaths: number;
  totalShots: number;
  totalHits: number;
  highScore: number;
  highestWave: number;
  mouseSensitivity: number;
  baseFov: number;
  masterVolume: number;
  accentColor: string;
  preferredSlot: number;
  slot4Choice: Slot4Choice;
  crosshair: CrosshairConfig;
  graphicsPreset: GraphicsPreset;
  achievements: string[];
  bossDefeatedCount: number;
  allUnlocked?: boolean;
}

export const DEFAULT_PROFILE: PlayerProfileData = {
  callsign: 'SPECTRE-01',
  level: 1,
  xp: 0,
  totalKills: 0,
  totalHeadshots: 0,
  totalDeaths: 0,
  totalShots: 0,
  totalHits: 0,
  highScore: 0,
  highestWave: 1,
  mouseSensitivity: 1.0,
  baseFov: 75,
  masterVolume: 0.7,
  accentColor: '#06b6d4',
  preferredSlot: 0,
  slot4Choice: 'desert_python',
  crosshair: { ...DEFAULT_CROSSHAIR },
  graphicsPreset: 'high',
  achievements: [],
  bossDefeatedCount: 0,
  allUnlocked: false,
};

export function getRankTitle(level: number): string {
  if (level >= 15) return 'APEX COMMANDER';
  if (level >= 10) return 'PHANTOM ELITE';
  if (level >= 6) return 'VANGUARD';
  if (level >= 3) return 'SENTINEL';
  return 'RECRUIT';
}

export class GameEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private currentAntialias: boolean;
  private isSoftwareGl: boolean;
  private scene: THREE.Scene;
  private scenePmremTex: THREE.Texture | null = null;
  private camera: THREE.PerspectiveCamera;
  private controls: PointerLockControls;
  private pointerLockNoticeTimer: number | null = null;
  private clock: THREE.Clock;

  // Lighting & Material Optimization Pools
  private arenaAmbientLight: THREE.AmbientLight;
  private arenaHemiLight: THREE.HemisphereLight;
  private arenaSunLight: THREE.DirectionalLight;
  private arenaRimLight: THREE.DirectionalLight;
  private arenaPointLights: { light: THREE.PointLight; baseIntensity: number }[] = [];
  private originalMaterials = new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private lambertMaterials = new WeakMap<THREE.Material, THREE.MeshLambertMaterial>();

  // World, Lobby & VFX
  private arena: TacticalArena;
  private lobby: TacticalLobby;
  private particles: ParticleSystem;
  private enemies: EnemyBot[] = [];
  private boss: BossSpecialist | null = null;
  private bossCutscene: BossArrivalCutscene;
  private bossAlarmGroup: THREE.Group;
  private bossAlarmLights: THREE.PointLight[] = [];
  private bossAlarmRotors: THREE.Group[] = [];
  private bossAlarmBeams: THREE.MeshBasicMaterial[] = [];
  private activeSyringeDarts: {
    mesh: THREE.Group;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    life: number;
  }[] = [];
  private activeGasClouds: {
    mesh: THREE.Group;
    position: THREE.Vector3;
    life: number;
    radius: number;
  }[] = [];
  private slowRemaining = 0;
  private inGasHazard = false;
  private bossBannerTimer = 0;

  // Viewmodels
  private weaponRig: THREE.Group;
  private viewmodels: Record<string, THREE.Group> = {};
  private activeViewmodel: THREE.Group | null = null;
  private muzzleFlashGroup: THREE.Group;
  private muzzleFlashLight: THREE.PointLight;
  private muzzleFlashTimer = 0;

  // Weapon Animation, Moving Parts, Attachments & Swap Transition
  private tacticalLight: THREE.SpotLight;
  private tacticalLightTarget: THREE.Object3D;
  private laserDot: THREE.Mesh;
  private flashlightOn = false;
  private swayTargetX = 0;
  private swayTargetY = 0;
  private swayX = 0;
  private swayY = 0;
  private recoilPitch = 0;
  private recoilZ = 0;
  private boltKick = 0;
  private pumpAnim = 0;
  private screenShakeIntensity = 0;
  private screenShakePhase = 0;
  private walkBobCycle = 0;
  private reloadProgress = 0;
  private isReloading = false;
  private shootCooldown = 0;
  private isMouseDown = false;

  private previousWeaponIndex = 3; // defaults to Slot 4 quick-switch
  private swapPhase: 'idle' | 'unequip' | 'equip' = 'idle';
  private pendingWeaponIndex = 0;
  private swapTimer = 0;
  private swapOffsetY = 0;
  private swapVelY = 0;
  private lastWheelSwapTime = 0;

  private activeGrenades: {
    mesh: THREE.Group;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    fuseTimer: number;
    bounces: number;
  }[] = [];

  // Player Physics
  private playerPos = new THREE.Vector3(0, 1.75, 31);
  private playerVel = new THREE.Vector3();
  private isGrounded = true;
  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;
  private isSprinting = false;
  private isAiming = false;
  private isCrouching = false;
  private playerEyeHeight = 1.75;
  private stepDistanceAccum = 0;
  private lowHpAlertTimer = 0;

  // Pre-allocated scratch helpers (zero GC inside render loop)
  private _forward = new THREE.Vector3();
  private _right = new THREE.Vector3();
  private _up = new THREE.Vector3(0, 1, 0);
  private _moveDir = new THREE.Vector3();
  private _camDir = new THREE.Vector3();
  private _spreadDir = new THREE.Vector3();
  private _muzzlePos = new THREE.Vector3();
  private _ejectPos = new THREE.Vector3();
  private _worldNormal = new THREE.Vector3();
  private _normalMatrix = new THREE.Matrix3();
  private _raycaster = new THREE.Raycaster();
  private _farPt = new THREE.Vector3();
  private _laserStart = new THREE.Vector3();
  private _laserQuat = new THREE.Quaternion();
  private _laserDir = new THREE.Vector3();
  private _grenadeNextPos = new THREE.Vector3();
  private _tmpCheckPos = new THREE.Vector3();
  private _dartAimPt = new THREE.Vector3();
  private raycastTargetsCache: THREE.Object3D[] = [];

  // Shared Boss Hazard Geometries & Materials (prevent per-attack allocation & GPU leak)
  private dartBodyGeo: THREE.BufferGeometry;
  private dartTipGeo: THREE.BufferGeometry;
  private dartBodyMat: THREE.MeshBasicMaterial;
  private dartTipMat: THREE.MeshBasicMaterial;
  private gasDomeGeo: THREE.BufferGeometry;
  private gasRingGeo: THREE.BufferGeometry;
  private gasDomeMat: THREE.MeshBasicMaterial;
  private gasRingMat: THREE.MeshBasicMaterial;

  // State & Callbacks
  public state: GameState;
  public profile: PlayerProfileData;
  private onStateChange: (state: GameState) => void;
  private onProfileChange: (profile: PlayerProfileData) => void;
  private animFrameId = 0;
  private softGlTimerId: number | null = null;
  private disposed = false;
  private hudEmitAccum = 0;
  private radarEmitAccum = 0.05;
  private lastCutsceneEmitKey = '';
  private lastDiscreteHudKey = '';
  private waveIntermissionTimer = 0;
  private vampireHealTimer = 0;
  private vampireHealSeq = 0;
  private matchWeaponKills: Record<string, number> = {};
  private contextLost = false;
  private fpsFrames = 0;
  private fpsLastSample = performance.now();
  private currentFps = 60;

  constructor(
    container: HTMLElement,
    onStateChange: (state: GameState) => void,
    onProfileChange: (profile: PlayerProfileData) => void
  ) {
    this.container = container;
    this.onStateChange = onStateChange;
    this.onProfileChange = onProfileChange;
    this.clock = new THREE.Clock();

    this.profile = this.loadProfile();
    soundSystem.setVolume(this.profile.masterVolume);

    // 1. Software-WebGL Guard
    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    // 2. Renderer Setup
    const initAntialias = this.profile.graphicsPreset !== 'potato' && !this.isSoftwareGl;
    this.currentAntialias = initAntialias;
    this.renderer = new THREE.WebGLRenderer({
      antialias: initAntialias,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(
      this.profile.graphicsPreset === 'potato'
        ? 0.75
        : this.profile.graphicsPreset === 'medium' || this.isSoftwareGl
        ? 1
        : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = this.profile.graphicsPreset !== 'potato' && !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);

    // 3. Scene & Cyber Night Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c1017);
    this.scene.fog = new THREE.FogExp2(0x0c1017, 0.014);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scenePmremTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.scenePmremTex;
    pmrem.dispose();

    // 4. Camera & PointerLockControls
    this.camera = new THREE.PerspectiveCamera(
      this.profile.baseFov,
      container.clientWidth / container.clientHeight,
      0.08,
      500
    );
    this.camera.position.set(30, 14, 30);
    this.camera.lookAt(0, 2, 0);
    this.scene.add(this.camera);

    this.controls = this.createPointerLockControls();

    // 5. Balanced 3-Point Cyber-Night Lighting + Potato Mode Ambient Fallback
    this.arenaAmbientLight = new THREE.AmbientLight(0xdbeafe, 1.35);
    this.arenaAmbientLight.visible = false;
    this.scene.add(this.arenaAmbientLight);

    this.arenaHemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.72);
    this.scene.add(this.arenaHemiLight);

    this.arenaSunLight = new THREE.DirectionalLight(0xfef3c7, 1.85);
    this.arenaSunLight.position.set(32, 48, 22);
    this.arenaSunLight.castShadow = !this.isSoftwareGl;
    this.arenaSunLight.shadow.mapSize.width = 2048;
    this.arenaSunLight.shadow.mapSize.height = 2048;
    this.arenaSunLight.shadow.camera.near = 0.5;
    this.arenaSunLight.shadow.camera.far = 130;
    const d = 46;
    this.arenaSunLight.shadow.camera.left = -d;
    this.arenaSunLight.shadow.camera.right = d;
    this.arenaSunLight.shadow.camera.top = d;
    this.arenaSunLight.shadow.camera.bottom = -d;
    this.arenaSunLight.shadow.bias = -0.0004;
    this.arenaSunLight.shadow.normalBias = 0.02;
    this.scene.add(this.arenaSunLight);

    this.arenaRimLight = new THREE.DirectionalLight(0x06b6d4, 0.55);
    this.arenaRimLight.position.set(-35, 24, -30);
    this.scene.add(this.arenaRimLight);

    // Boss Fight Rotating Crimson Emergency Alarm Beacons
    this.bossAlarmGroup = new THREE.Group();
    this.bossAlarmGroup.visible = false;
    [
      [-15, 9.2, -16],
      [15, 9.2, -16],
      [-15, 9.2, 16],
      [15, 9.2, 16],
    ].forEach(([ax, ay, az]) => {
      const beacon = new THREE.Group();
      beacon.position.set(ax, ay, az);
      const housing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.34, 0.4, 12),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 })
      );
      beacon.add(housing);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0xff1e42 })
      );
      bulb.position.y = -0.24;
      beacon.add(bulb);

      const rotor = new THREE.Group();
      rotor.position.y = -0.24;
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xff1e42,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.bossAlarmBeams.push(beamMat);
      [0, Math.PI].forEach((ang) => {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(2.4, 13.5, 14, 1, true).rotateX(Math.PI / 2),
          beamMat
        );
        cone.position.set(Math.sin(ang) * 6.75, -1.6, Math.cos(ang) * 6.75);
        cone.rotation.y = ang;
        cone.rotation.x = 0.24;
        rotor.add(cone);
      });
      beacon.add(rotor);
      this.bossAlarmRotors.push(rotor);

      const pLight = new THREE.PointLight(0xff1e42, 0, 44, 1.4);
      pLight.position.y = -0.45;
      beacon.add(pLight);
      this.bossAlarmLights.push(pLight);
      this.bossAlarmGroup.add(beacon);
    });
    this.scene.add(this.bossAlarmGroup);

    this.bossCutscene = new BossArrivalCutscene(this.scene, this.camera, {
      onReentryStart: () => {
        soundSystem.playDropPodReentry();
      },
      onImpact: () => {
        soundSystem.playDropPodImpact();
        this.screenShakeIntensity = Math.max(this.screenShakeIntensity, 0.16);
      },
      onRevealSting: () => {
        soundSystem.playBossRevealSting();
      },
      onComplete: (skipped) => {
        this.finishBossCutscene(skipped);
      },
    });

    // 6. Build Tactical Facility Arena, 3D Interactive Hangar Lobby & Particle Pool
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.arena = buildTacticalArena(maxAniso);
    this.scene.add(this.arena.group);
    this.arena.group.traverse((obj) => {
      if ((obj as THREE.PointLight).isPointLight) {
        const pl = obj as THREE.PointLight;
        this.arenaPointLights.push({ light: pl, baseIntensity: pl.intensity });
      }
    });

    this.lobby = new TacticalLobby(
      this.renderer,
      this.isSoftwareGl,
      container.clientWidth / container.clientHeight,
      maxAniso,
      this.profile.accentColor,
      Math.min(3, Math.max(0, this.profile.preferredSlot || 0))
    );
    const initialLoadout = buildFourSlotLoadout(this.profile.slot4Choice);
    const startWep = initialLoadout[this.profile.preferredSlot] || initialLoadout[0];
    if (startWep) {
      this.lobby.setWeaponById(startWep.id);
    }

    this.particles = new ParticleSystem(this.scene);

    // 7. Weapon Rig & Multi-Part 3D Viewmodels
    this.weaponRig = new THREE.Group();
    this.weaponRig.position.set(0.22, -0.22, -0.42);
    this.weaponRig.visible = false; // hidden during orbiting main menu
    this.camera.add(this.weaponRig);

    // 3D Star/Cone Muzzle Flash
    this.muzzleFlashGroup = new THREE.Group();
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffedd5,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const cone1 = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 6).rotateX(-Math.PI / 2), flashMat);
    cone1.position.z = -0.1;
    this.muzzleFlashGroup.add(cone1);

    const spikeGeo = new THREE.ConeGeometry(0.025, 0.16, 4);
    for (let i = 0; i < 4; i++) {
      const spike = new THREE.Mesh(spikeGeo, flashMat);
      spike.rotation.z = (i * Math.PI) / 2;
      spike.position.set(Math.cos((i * Math.PI) / 2) * 0.05, Math.sin((i * Math.PI) / 2) * 0.05, 0);
      this.muzzleFlashGroup.add(spike);
    }
    this.weaponRig.add(this.muzzleFlashGroup);

    this.muzzleFlashLight = new THREE.PointLight(0xffaa33, 0, 10, 2);
    this.weaponRig.add(this.muzzleFlashLight);

    // Register all 7 Viewmodels
    this.viewmodels['ar_x7'] = createARX7ViewModel();
    this.viewmodels['vector_v9'] = createVectorV9ViewModel();
    this.viewmodels['sg_12'] = createSG12ViewModel();
    this.viewmodels['sr_50'] = createSR50ViewModel();
    this.viewmodels['desert_python'] = createDesertPythonViewModel();
    this.viewmodels['flash_frag'] = createFlashFragViewModel();
    this.viewmodels['nano_medkit'] = createNanoMedkitViewModel();

    Object.values(this.viewmodels).forEach((vm) => {
      vm.visible = false;
      this.weaponRig.add(vm);
    });

    // Underbarrel Tactical Flashlight (Toggled with [F])
    this.tacticalLight = new THREE.SpotLight(0xe0f2fe, 0, 42, Math.PI / 6.5, 0.45, 1.35);
    this.tacticalLight.position.set(0.14, -0.14, -0.55);
    this.tacticalLightTarget = new THREE.Object3D();
    this.tacticalLightTarget.position.set(0, -0.05, -20);
    this.camera.add(this.tacticalLight);
    this.camera.add(this.tacticalLightTarget);
    this.tacticalLight.target = this.tacticalLightTarget;

    // World-space Red Laser Dot
    this.laserDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff2a48, depthWrite: false })
    );
    this.laserDot.visible = false;
    this.scene.add(this.laserDot);

    // 8. Initialize GameState
    this.state = {
      health: 100,
      maxHealth: 100,
      armor: 100,
      maxArmor: 100,
      score: 0,
      wave: 1,
      enemiesRemaining: 0,
      isDead: false,
      isPaused: true,
      isInMenu: true,
      isInventoryOpen: false,
      activeWeaponIndex: Math.min(3, Math.max(0, this.profile.preferredSlot || 0)),
      weapons: buildFourSlotLoadout(this.profile.slot4Choice),
      isReloading: false,
      isAiming: false,
      isScoped: false,
      isCrouching: false,
      flashlightOn: false,
      flashbangGlare: 0,
      crosshairSpread: 0.14,
      hitmarkerActive: false,
      hitmarkerHeadshot: false,
      damageVignette: 0,
      killFeed: [],
      sessionKills: 0,
      sessionHeadshots: 0,
      sessionShots: 0,
      sessionHits: 0,
      sessionXp: 0,
      survivalTimeSec: 0,
      scoreSubmitted: false,
      submittedRank: null,
      prepPhaseRemaining: 0,
      isBossWave: false,
      bossState: null,
      slowRemaining: 0,
      inGasHazard: false,
      bossBanner: null,
      cutscene: null,
      vampireHealEvent: null,
      fps: 60,
      pointerLockNotice: null,
      adminCheats: {
        godMode: false,
        infiniteAmmo: false,
        speedMultiplier: 1.0,
        jumpMultiplier: 1.0,
      },
      radarData: {
        playerX: 0,
        playerZ: 0,
        playerAngle: 0,
        enemies: [],
        rects: this.arena.radarRects,
      },
    };

    this.dartBodyGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.36, 8).rotateX(Math.PI / 2);
    this.dartTipGeo = new THREE.ConeGeometry(0.035, 0.14, 8).rotateX(Math.PI / 2);
    this.dartBodyMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    this.dartTipMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
    this.gasDomeGeo = new THREE.SphereGeometry(4.8, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    this.gasRingGeo = new THREE.RingGeometry(4.62, 4.8, 32).rotateX(-Math.PI / 2);
    this.gasDomeMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.gasRingMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.equipWeapon(this.state.activeWeaponIndex, true);
    this.applyGraphicsPreset(this.profile.graphicsPreset);
    this.bindEvents();
    window.addEventListener('resize', this.onResize);

    // Pre-compile WebGL shaders up-front to eliminate first-frame / impact hitches
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
      this.renderer.compile(this.lobby.scene, this.lobby.camera);
    }

    // Start render loop immediately for live orbiting 3D Main Menu
    this.clock.start();
    this.loop();
  }

  // --- Profile Persistence ---
  private loadProfile(): PlayerProfileData {
    let savedPreset: GraphicsPreset | null = null;
    try {
      const rawPreset = localStorage.getItem('GIS_SHOOTER_GRAPHICS_PRESET');
      if (rawPreset === 'high' || rawPreset === 'medium' || rawPreset === 'potato') {
        savedPreset = rawPreset;
      }
    } catch {
      // ignore storage errors
    }

    try {
      const saved = localStorage.getItem('GIS_SHOOTER_TACTICAL_PROFILE');
      if (saved) {
        const parsed = JSON.parse(saved);
        const parsedPreset: GraphicsPreset =
          parsed.graphicsPreset === 'potato' ||
          parsed.graphicsPreset === 'medium' ||
          parsed.graphicsPreset === 'high'
            ? parsed.graphicsPreset
            : savedPreset || DEFAULT_PROFILE.graphicsPreset;
        const slot4Choice: Slot4Choice =
          parsed.slot4Choice === 'nano_medkit' ? 'nano_medkit' : 'desert_python';
        let preferredSlot =
          typeof parsed.preferredSlot === 'number'
            ? Math.max(0, Math.min(3, Math.floor(parsed.preferredSlot)))
            : 0;
        if (slot4Choice === 'nano_medkit' && preferredSlot === 3) {
          preferredSlot = 0;
        }
        return {
          ...DEFAULT_PROFILE,
          ...parsed,
          preferredSlot,
          slot4Choice,
          crosshair: { ...DEFAULT_CROSSHAIR, ...(parsed.crosshair || {}) },
          graphicsPreset: parsedPreset,
          achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
          bossDefeatedCount: typeof parsed.bossDefeatedCount === 'number' ? parsed.bossDefeatedCount : 0,
        };
      }
    } catch {
      // ignore storage errors
    }
    return {
      ...DEFAULT_PROFILE,
      crosshair: { ...DEFAULT_CROSSHAIR },
      graphicsPreset: savedPreset || DEFAULT_PROFILE.graphicsPreset,
      achievements: [],
    };
  }

  public saveProfile(updates?: Partial<PlayerProfileData>) {
    if (updates) {
      this.profile = {
        ...this.profile,
        ...updates,
        crosshair: updates.crosshair
          ? { ...this.profile.crosshair, ...updates.crosshair }
          : this.profile.crosshair,
      };
      if (updates.mouseSensitivity !== undefined) {
        this.controls.pointerSpeed = this.profile.mouseSensitivity;
      }
      if (updates.masterVolume !== undefined) {
        soundSystem.setVolume(this.profile.masterVolume);
      }
      if (updates.baseFov !== undefined && !this.isAiming) {
        this.camera.fov = this.profile.baseFov;
        this.camera.updateProjectionMatrix();
      }
      if (updates.accentColor !== undefined) {
        this.lobby.setAccentColor(this.profile.accentColor);
      }
      if (updates.preferredSlot !== undefined || updates.slot4Choice !== undefined) {
        if (this.profile.slot4Choice === 'nano_medkit' && this.profile.preferredSlot === 3) {
          this.profile.preferredSlot = 0;
        } else {
          this.profile.preferredSlot = Math.max(0, Math.min(3, this.profile.preferredSlot || 0));
        }
        const loadout = buildFourSlotLoadout(this.profile.slot4Choice);
        const w = loadout[this.profile.preferredSlot] || loadout[0];
        this.lobby.setWeaponById(w.id);
        if (this.state.isInMenu) {
          this.state.weapons = loadout;
          this.state.activeWeaponIndex = this.profile.preferredSlot;
        }
      }
      if (updates.graphicsPreset !== undefined) {
        this.applyGraphicsPreset(this.profile.graphicsPreset);
      }
    }
    try {
      localStorage.setItem('GIS_SHOOTER_TACTICAL_PROFILE', JSON.stringify(this.profile));
      localStorage.setItem('GIS_SHOOTER_GRAPHICS_PRESET', this.profile.graphicsPreset);
    } catch {
      // ignore
    }
    this.onProfileChange({ ...this.profile });
  }

  // --- Graphics Preset & Live Potato Mode Optimization Engine ---
  private toLambert(mat: THREE.Material): THREE.Material {
    if (!(mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) return mat;
    const cached = this.lambertMaterials.get(mat);
    if (cached) return cached;
    const std = mat as THREE.MeshStandardMaterial;
    const lambert = new THREE.MeshLambertMaterial({
      color: std.color.clone(),
      map: std.map,
      emissive: std.emissive.clone(),
      emissiveMap: std.emissiveMap,
      emissiveIntensity: std.emissiveIntensity,
      transparent: std.transparent,
      opacity: std.opacity,
      side: std.side,
      wireframe: std.wireframe,
      depthWrite: std.depthWrite,
      depthTest: std.depthTest,
    });
    this.lambertMaterials.set(mat, lambert);
    return lambert;
  }

  private applyMaterialQuality(root: THREE.Object3D, preset: GraphicsPreset) {
    const useSimple = preset === 'potato';
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      if (useSimple) {
        if (!this.originalMaterials.has(mesh)) {
          this.originalMaterials.set(mesh, mesh.material);
        }
        const orig = this.originalMaterials.get(mesh)!;
        mesh.material = Array.isArray(orig)
          ? orig.map((m) => this.toLambert(m))
          : this.toLambert(orig);
      } else {
        const orig = this.originalMaterials.get(mesh);
        if (orig) {
          mesh.material = orig;
        }
      }
    });
  }

  private recreateRenderer(antialias: boolean) {
    if (antialias === this.currentAntialias) return;
    this.currentAntialias = antialias;

    const oldCanvas = this.renderer.domElement;
    oldCanvas.removeEventListener('webglcontextlost', this.onContextLost);
    oldCanvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    oldCanvas.removeEventListener('pointerdown', this.onLobbyPointerDown);
    oldCanvas.removeEventListener('wheel', this.onLobbyWheel);

    this.controls.removeEventListener('lock', this.onControlsLock);
    this.controls.removeEventListener('unlock', this.onControlsUnlock);
    this.controls.dispose();
    this.renderer.dispose();
    if (oldCanvas.parentElement === this.container) {
      this.container.removeChild(oldCanvas);
    }

    const nextRenderer = new THREE.WebGLRenderer({
      antialias,
      powerPreference: 'high-performance',
    });
    nextRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
    nextRenderer.outputColorSpace = THREE.SRGBColorSpace;
    nextRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    nextRenderer.toneMappingExposure = 1.15;
    nextRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer = nextRenderer;
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);
    this.renderer.domElement.addEventListener('pointerdown', this.onLobbyPointerDown);
    this.renderer.domElement.addEventListener('wheel', this.onLobbyWheel, { passive: true });

    this.controls = this.createPointerLockControls();

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scenePmremTex?.dispose();
    this.scenePmremTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }

  public applyGraphicsPreset(preset: GraphicsPreset) {
    const desiredAntialias = preset !== 'potato' && !this.isSoftwareGl;
    const recreated = desiredAntialias !== this.currentAntialias;
    if (recreated) {
      this.recreateRenderer(desiredAntialias);
    }

    if (preset === 'potato') {
      this.renderer.setPixelRatio(0.75);
      this.renderer.shadowMap.enabled = false;
      this.arenaSunLight.castShadow = false;
      this.arenaSunLight.intensity = 1.25;
      this.arenaAmbientLight.visible = true;
      this.arenaHemiLight.visible = false;
      this.arenaRimLight.visible = false;
      this.arenaPointLights.forEach((p) => {
        p.light.intensity = 0;
      });
      this.muzzleFlashLight.intensity = 0;
      this.bossAlarmLights.forEach((l) => {
        l.intensity = 0;
      });
      this.scene.environment = null;
      this.scene.fog = new THREE.Fog(0x0c1017, 14, 52);
      this.camera.far = 95;
    } else {
      const ratio =
        preset === 'medium' || this.isSoftwareGl ? 1.0 : Math.min(window.devicePixelRatio, 2);
      this.renderer.setPixelRatio(ratio);
      this.renderer.shadowMap.enabled = !this.isSoftwareGl;
      this.arenaSunLight.castShadow = !this.isSoftwareGl;
      this.arenaSunLight.intensity = 1.85;
      this.arenaAmbientLight.visible = false;
      this.arenaHemiLight.visible = true;
      this.arenaRimLight.visible = true;
      this.arenaPointLights.forEach((p) => {
        p.light.intensity = p.baseIntensity;
      });
      this.scene.environment = this.scenePmremTex;
      this.scene.fog = new THREE.FogExp2(0x0c1017, preset === 'medium' ? 0.015 : 0.014);
      this.camera.far = preset === 'medium' ? 300 : 500;
    }
    this.camera.updateProjectionMatrix();

    this.applyMaterialQuality(this.scene, preset);
    this.applyMaterialQuality(this.lobby.scene, preset);
    this.particles.setGraphicsPreset(preset);
    this.lobby.setGraphicsPreset(
      preset,
      this.isSoftwareGl,
      recreated ? this.renderer : undefined
    );
    this.emitState();
  }

  public setLobbyFocus(mode: LobbyFocusMode) {
    this.lobby.setFocusMode(mode);
  }

  public previewLobbyWeapon(slotIndex: number, overrideSlot4?: Slot4Choice) {
    const loadout = buildFourSlotLoadout(overrideSlot4 || this.profile.slot4Choice);
    const target = loadout[slotIndex] || loadout[0];
    if (target) {
      this.lobby.setWeaponById(target.id);
    }
  }

  public previewLobbyAccent(hex: string) {
    this.lobby.setAccentColor(hex);
  }

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
  };

  private onContextRestored = () => {
    this.contextLost = false;
  };

  private createPointerLockControls(): PointerLockControls {
    const ctrl = new PointerLockControls(this.camera, this.renderer.domElement);
    ctrl.pointerSpeed = this.profile.mouseSensitivity;
    const internalErrorListener = (ctrl as unknown as { _onPointerlockError?: EventListener })
      ._onPointerlockError;
    if (internalErrorListener) {
      this.renderer.domElement.ownerDocument.removeEventListener(
        'pointerlockerror',
        internalErrorListener
      );
    }
    ctrl.addEventListener('lock', this.onControlsLock);
    ctrl.addEventListener('unlock', this.onControlsUnlock);
    return ctrl;
  }

  private clearPointerLockNoticeTimer() {
    if (this.pointerLockNoticeTimer !== null) {
      window.clearTimeout(this.pointerLockNoticeTimer);
      this.pointerLockNoticeTimer = null;
    }
  }

  private handlePointerLockRejected(err?: unknown) {
    if (this.state.isInMenu || this.state.isDead || this.bossCutscene.isActive) return;
    const msg =
      err instanceof Error ? err.message : typeof err === 'string' ? err : '';
    const isCooldown =
      /exited|cooldown|immediately|security/i.test(msg);

    this.state.isInventoryOpen = false;
    this.state.isPaused = true;
    this.isMouseDown = false;
    this.isAiming = false;
    this.state.isAiming = false;
    this.state.isScoped = false;
    this.state.pointerLockNotice = isCooldown
      ? 'Pointer lock cooling down — wait 1s and click Resume.'
      : 'Click Resume to lock mouse aim.';

    this.clearPointerLockNoticeTimer();
    this.pointerLockNoticeTimer = window.setTimeout(() => {
      this.pointerLockNoticeTimer = null;
      if (this.state.pointerLockNotice) {
        this.state.pointerLockNotice = null;
        this.emitState();
      }
    }, 3000);

    this.emitState();
  }

  private onPointerLockError = (e: Event) => {
    e.stopImmediatePropagation();
    this.handlePointerLockRejected();
  };

  private requestPointerLockSafe() {
    if (this.contextLost) return;
    const el = this.renderer.domElement;
    if (!el || typeof el.requestPointerLock !== 'function') {
      this.handlePointerLockRejected();
      return;
    }
    if (document.pointerLockElement === el || this.controls.isLocked) {
      if (this.state.pointerLockNotice) {
        this.clearPointerLockNoticeTimer();
        this.state.pointerLockNotice = null;
        this.emitState();
      }
      return;
    }

    try {
      const maybePromise = el.requestPointerLock() as unknown as Promise<void> | undefined;
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch((err: unknown) => {
          this.handlePointerLockRejected(err);
        });
      }
    } catch (err) {
      this.handlePointerLockRejected(err);
    }
  }

  private unlockPointerSafe() {
    if (document.pointerLockElement || this.controls.isLocked) {
      try {
        this.controls.unlock();
      } catch {
        // ignore unlock failures when document is not locked
      }
    }
  }

  private onControlsLock = () => {
    this.clearPointerLockNoticeTimer();
    this.state.pointerLockNotice = null;
    this.state.isPaused = false;
    this.state.isInventoryOpen = false;
    this.state.isInMenu = false;
    this.weaponRig.visible = !this.bossCutscene.isActive;
    soundSystem.stopLobbyAmbient();
    this.emitState();
    soundSystem.resume();
  };

  private onControlsUnlock = () => {
    if (this.bossCutscene.isActive) return;
    if (!this.state.isDead && !this.state.isInventoryOpen && !this.state.isInMenu) {
      this.state.isPaused = true;
      this.isMouseDown = false;
      this.isAiming = false;
      this.state.isAiming = false;
      this.state.isScoped = false;
      this.emitState();
    }
  };

  // --- Input Binding ---
  private bindEvents() {
    document.addEventListener('pointerlockerror', this.onPointerLockError, true);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.onLobbyPointerDown);
    window.addEventListener('pointermove', this.onLobbyPointerMove);
    window.addEventListener('pointerup', this.onLobbyPointerUp);
    canvas.addEventListener('wheel', this.onLobbyWheel, { passive: true });

    window.addEventListener('wheel', this.onGameWheel, { passive: true });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('contextmenu', this.onContextMenu);
  }

  private onLobbyPointerDown = (e: PointerEvent) => {
    if (!this.state.isInMenu) return;
    soundSystem.startLobbyAmbient();
    if (e.button === 0) {
      this.lobby.handlePointerDown(e.clientX, e.clientY);
    }
  };

  private onLobbyPointerMove = (e: PointerEvent) => {
    if (!this.state.isInMenu) return;
    this.lobby.handlePointerMove(e.clientX, e.clientY);
  };

  private onLobbyPointerUp = () => {
    this.lobby.handlePointerUp();
  };

  private onLobbyWheel = (e: WheelEvent) => {
    if (!this.state.isInMenu) return;
    this.lobby.handleWheel(e.deltaY);
  };

  private onGameWheel = (e: WheelEvent) => {
    if (
      this.state.isInMenu ||
      this.state.isPaused ||
      this.state.isInventoryOpen ||
      this.state.isDead ||
      this.bossCutscene.isActive ||
      !this.controls.isLocked
    ) {
      return;
    }
    const now = performance.now();
    if (now - this.lastWheelSwapTime < 70 || Math.abs(e.deltaY) < 4) return;
    this.lastWheelSwapTime = now;

    const total = this.state.weapons.length;
    const baseIdx =
      this.swapPhase === 'unequip' ? this.pendingWeaponIndex : this.state.activeWeaponIndex;
    const dir = e.deltaY > 0 ? 1 : -1;
    const nextIdx = (baseIdx + dir + total) % total;
    this.equipWeapon(nextIdx);
  };

  private onContextMenu = (e: MouseEvent) => e.preventDefault();

  private onMouseMove = (e: MouseEvent) => {
    if (!this.controls.isLocked || this.bossCutscene.isActive) return;
    this.swayTargetX = THREE.MathUtils.clamp(-e.movementX * 0.0008, -0.045, 0.045);
    this.swayTargetY = THREE.MathUtils.clamp(e.movementY * 0.0008, -0.045, 0.045);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.state.isDead || this.state.isInMenu) return;

    if (this.bossCutscene.isActive) {
      if (e.code === 'Space' && !e.repeat && this.bossCutscene.elapsed > 0.25) {
        e.preventDefault();
        this.bossCutscene.skip();
      }
      return;
    }

    if (e.code === 'Tab' || e.code === 'KeyI') {
      e.preventDefault();
      this.toggleInventory();
      return;
    }

    if (this.state.isInventoryOpen || this.state.isPaused) return;

    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveForward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveBackward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.moveLeft = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.moveRight = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.isSprinting = true;
        this.isCrouching = false;
        this.state.isCrouching = false;
        break;
      case 'KeyC':
        if (!e.repeat) {
          this.isCrouching = !this.isCrouching;
          this.state.isCrouching = this.isCrouching;
        }
        break;
      case 'ControlLeft':
      case 'ControlRight':
        this.isCrouching = true;
        this.state.isCrouching = true;
        break;
      case 'Space':
        if (this.isGrounded) {
          this.isCrouching = false;
          this.state.isCrouching = false;
          this.playerVel.y = 7.6 * this.state.adminCheats.jumpMultiplier;
          this.isGrounded = false;
        }
        break;
      case 'KeyR':
        this.startReload();
        break;
      case 'KeyF':
        if (!e.repeat) {
          this.toggleFlashlight();
        }
        break;
      case 'KeyQ':
        if (!e.repeat) {
          this.equipWeapon(this.previousWeaponIndex);
        }
        break;
      case 'KeyG':
        if (!e.repeat && this.waveIntermissionTimer > 0) {
          this.skipPrepPhase();
        }
        break;
      case 'Digit1':
        this.equipWeapon(0);
        break;
      case 'Digit2':
        this.equipWeapon(1);
        break;
      case 'Digit3':
        this.equipWeapon(2);
        break;
      case 'Digit4':
        this.equipWeapon(3);
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveForward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveBackward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.moveLeft = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.moveRight = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.isSprinting = false;
        break;
      case 'ControlLeft':
      case 'ControlRight':
        this.isCrouching = false;
        this.state.isCrouching = false;
        break;
    }
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.state.isPaused || this.state.isInventoryOpen || this.state.isDead || this.state.isInMenu) {
      return;
    }
    if (this.bossCutscene.isActive) {
      if (!this.controls.isLocked && e.target === this.renderer.domElement) {
        this.requestPointerLockSafe();
      }
      return;
    }
    if (!this.controls.isLocked) {
      if (e.target === this.renderer.domElement) {
        this.requestPointerLockSafe();
      }
      return;
    }

    if (e.button === 0) {
      this.isMouseDown = true;
      this.tryShoot();
    } else if (e.button === 2) {
      this.isAiming = true;
      this.state.isAiming = true;
      const wep = this.state.weapons[this.state.activeWeaponIndex];
      this.state.isScoped = wep.type === 'sniper' && !this.isReloading;
      this.emitState();
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.isMouseDown = false;
    } else if (e.button === 2) {
      this.isAiming = false;
      this.state.isAiming = false;
      this.state.isScoped = false;
      this.emitState();
    }
  };

  private onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.lobby.camera.aspect = w / h;
    this.lobby.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  // --- Menu, Inventory & Combat Flow ---
  public enterMenuMode() {
    this.clearPointerLockNoticeTimer();
    this.state.pointerLockNotice = null;
    this.bossCutscene.resetAll();
    this.state.cutscene = null;
    soundSystem.stopCutsceneSiren();
    this.state.isInMenu = true;
    this.state.isPaused = true;
    this.state.isInventoryOpen = false;
    this.state.isAiming = false;
    this.state.isScoped = false;
    this.weaponRig.visible = false;
    soundSystem.stopBossMusic();
    this.setBossAtmosphere(false);
    const menuLoadout = buildFourSlotLoadout(this.profile.slot4Choice);
    const menuSlot = Math.max(0, Math.min(3, this.profile.preferredSlot || 0));
    this.lobby.setWeaponById(menuLoadout[menuSlot]?.id || 'ar_x7');
    this.lobby.setAccentColor(this.profile.accentColor);
    this.lobby.setFocusMode('overview');
    this.unlockPointerSafe();
    soundSystem.startLobbyAmbient();
    this.emitState();
  }

  public toggleInventory() {
    if (this.state.isDead || this.state.isInMenu || this.bossCutscene.isActive) return;
    this.state.isInventoryOpen = !this.state.isInventoryOpen;

    if (this.state.isInventoryOpen) {
      this.unlockPointerSafe();
      this.isMouseDown = false;
      this.isAiming = false;
      this.state.isAiming = false;
      this.state.isScoped = false;
    } else {
      this.requestPointerLockSafe();
    }
    this.emitState();
  }

  public toggleFlashlight() {
    this.flashlightOn = !this.flashlightOn;
    this.state.flashlightOn = this.flashlightOn;
    this.tacticalLight.intensity = this.flashlightOn ? 32 : 0;
    soundSystem.playFlashlightClick();
    this.emitState();
  }

  public equipWeapon(index: number, immediate = false) {
    if (index < 0 || index >= this.state.weapons.length) return;
    if (!immediate && index === this.state.activeWeaponIndex && this.swapPhase !== 'unequip') return;

    this.isReloading = false;
    this.reloadProgress = 0;
    this.state.isReloading = false;

    if (immediate || this.state.isInMenu) {
      this.swapPhase = 'idle';
      this.swapOffsetY = 0;
      this.swapVelY = 0;
      this.applyEquippedWeapon(index);
      return;
    }

    // Begin smooth Put-Away (unequip) -> Spring Rise (equip) transition
    if (this.swapPhase !== 'unequip') {
      this.previousWeaponIndex = this.state.activeWeaponIndex;
    }
    this.pendingWeaponIndex = index;
    this.swapPhase = 'unequip';
    this.swapTimer = 0;
    this.state.isScoped = false;
    soundSystem.playWeaponSwap();
    this.emitState();
  }

  private applyEquippedWeapon(index: number) {
    if (index !== this.state.activeWeaponIndex) {
      this.previousWeaponIndex = this.state.activeWeaponIndex;
    }
    this.state.activeWeaponIndex = index;
    const wep = this.state.weapons[index];

    Object.values(this.viewmodels).forEach((vm) => (vm.visible = false));
    this.activeViewmodel = this.viewmodels[wep.id] || null;
    if (this.activeViewmodel) {
      this.activeViewmodel.visible = true;
    }

    this.state.isScoped = this.isAiming && wep.type === 'sniper';
    this.emitState();
  }

  public useNanoMedkit(): boolean {
    const med = this.state.weapons.find((w) => w.type === 'medkit');
    if (!med || med.currentAmmo <= 0) return false;
    if (this.state.health >= this.state.maxHealth && this.state.armor >= this.state.maxArmor) {
      return false;
    }

    if (!this.state.adminCheats.infiniteAmmo) {
      med.currentAmmo--;
    }
    this.state.health = Math.min(this.state.maxHealth, this.state.health + 60);
    this.state.armor = Math.min(this.state.maxArmor, this.state.armor + 35);
    soundSystem.playHeal();
    this.emitState();
    return true;
  }

  private throwGrenade() {
    const wep = this.state.weapons[this.state.activeWeaponIndex];
    if (wep.type !== 'grenade' || (!this.state.adminCheats.infiniteAmmo && wep.currentAmmo <= 0)) {
      soundSystem.playDryFire();
      this.shootCooldown = 0.25;
      return;
    }

    if (!this.state.adminCheats.infiniteAmmo) {
      wep.currentAmmo--;
    }
    this.shootCooldown = wep.fireRate;
    this.recoilPitch = 0.08;
    this.recoilZ = 0.06;
    soundSystem.playGrenadeThrow();

    this.camera.getWorldDirection(this._camDir);
    const startPos = this.camera.position.clone().addScaledVector(this._camDir, 0.65);
    startPos.y -= 0.12;

    const vel = this._camDir.clone().multiplyScalar(19.5);
    vel.y += 4.6;
    vel.addScaledVector(this.playerVel, 0.35);

    const mesh = createGrenadeProjectileMesh();
    mesh.position.copy(startPos);
    this.scene.add(mesh);

    this.activeGrenades.push({
      mesh,
      position: startPos,
      velocity: vel,
      fuseTimer: 1.65,
      bounces: 0,
    });

    this.emitState();
  }

  private detonateFlashFrag(pos: THREE.Vector3) {
    soundSystem.playFlashFragExplosion();
    this.particles.addFlashFragExplosion(pos);

    const radius = 9.5;
    const maxDmg = 145;
    let hitAny = false;

    for (let i = 0; i < this.enemies.length; i++) {
      const bot = this.enemies[i];
      if (bot.isDead) continue;

      this._tmpCheckPos.set(bot.position.x, bot.position.y + 1.1, bot.position.z);
      const dist = this._tmpCheckPos.distanceTo(pos);
      if (dist <= radius) {
        const falloff = 1 - (dist / radius) * 0.68;
        const dmg = Math.max(25, Math.round(maxDmg * falloff));
        const res = bot.takeDamage(dmg, false);
        hitAny = true;
        this.particles.addFloatingDamage(this._tmpCheckPos, res.actualDmg, false);
        if (res.isDead) {
          this.handleEnemyEliminated(bot, false, 'FLASH-FRAG');
        } else {
          bot.stun(2.5);
        }
      }
    }

    if (this.boss && !this.boss.isDead) {
      this._tmpCheckPos.set(this.boss.position.x, this.boss.position.y + 1.4, this.boss.position.z);
      const bDist = this._tmpCheckPos.distanceTo(pos);
      if (bDist <= radius + 0.8) {
        const falloff = 1 - (bDist / (radius + 0.8)) * 0.65;
        const dmg = Math.max(40, Math.round(maxDmg * 1.15 * falloff));
        const res = this.boss.takeDamage(dmg, 'body');
        hitAny = true;
        this.particles.addFloatingDamage(this._tmpCheckPos, res.actualDmg, false);
        if (res.isDead) {
          this.handleBossDefeated('FLASH-FRAG');
        } else {
          this.boss.stun(2.5);
        }
      }
    }

    if (hitAny) {
      this.triggerHitmarker(false);
    }

    // Subtle self concussion glare & blast tremor if detonated close to player
    const pDist = this.playerPos.distanceTo(pos);
    if (pDist < 14.0) {
      this.screenShakeIntensity = Math.max(this.screenShakeIntensity, (1 - pDist / 14.0) * 0.08);
    }
    if (pDist < 7.0) {
      this.state.flashbangGlare = Math.max(this.state.flashbangGlare, (1 - pDist / 7.0) * 0.65);
    }
    this.emitState();
  }

  private updateGrenades(delta: number) {
    for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
      const g = this.activeGrenades[i];
      g.fuseTimer -= delta;
      g.velocity.y -= 18.5 * delta;

      const nextPos = this._grenadeNextPos.copy(g.position).addScaledVector(g.velocity, delta);

      // Wall/Crate collision bounce
      for (let cIdx = 0; cIdx < this.arena.collisions.length; cIdx++) {
        const col = this.arena.collisions[cIdx];
        if (col.type === 'ramp') continue;
        const pad = 0.14;
        if (
          nextPos.y >= col.box.min.y - pad &&
          nextPos.y <= col.box.max.y + pad &&
          nextPos.x >= col.box.min.x - pad &&
          nextPos.x <= col.box.max.x + pad &&
          nextPos.z >= col.box.min.z - pad &&
          nextPos.z <= col.box.max.z + pad
        ) {
          if (g.position.x < col.box.min.x - pad || g.position.x > col.box.max.x + pad) {
            g.velocity.x *= -0.52;
            nextPos.x = g.position.x;
          } else if (g.position.z < col.box.min.z - pad || g.position.z > col.box.max.z + pad) {
            g.velocity.z *= -0.52;
            nextPos.z = g.position.z;
          } else {
            g.velocity.y = Math.abs(g.velocity.y) * 0.45;
            nextPos.y = col.box.max.y + pad;
          }
          g.bounces++;
          break;
        }
      }

      // Ground bounce
      if (nextPos.y <= 0.1) {
        nextPos.y = 0.1;
        if (Math.abs(g.velocity.y) > 1.2) {
          g.velocity.y *= -0.46;
          g.velocity.x *= 0.68;
          g.velocity.z *= 0.68;
          if (g.bounces < 2) soundSystem.playShellClink();
          g.bounces++;
        } else {
          g.velocity.y = 0;
          g.velocity.x *= 0.85;
          g.velocity.z *= 0.85;
        }
      }

      g.position.copy(nextPos);
      g.mesh.position.copy(g.position);
      g.mesh.rotation.x += delta * 10;
      g.mesh.rotation.z += delta * 7;

      if (g.fuseTimer <= 0) {
        this.scene.remove(g.mesh);
        this.detonateFlashFrag(g.position);
        this.activeGrenades.splice(i, 1);
      }
    }
  }

  // --- Reloading ---
  private startReload() {
    if (this.swapPhase === 'unequip') return;
    const wep = this.state.weapons[this.state.activeWeaponIndex];
    if (wep.type === 'medkit' || wep.type === 'grenade') return;
    if (this.state.adminCheats.infiniteAmmo) {
      wep.currentAmmo = wep.magSize;
      this.isReloading = false;
      this.state.isReloading = false;
      this.emitState();
      return;
    }
    if (this.isReloading || wep.currentAmmo === wep.magSize || wep.reserveAmmo <= 0) return;

    this.isReloading = true;
    this.reloadProgress = 0;
    this.state.isReloading = true;
    this.state.isScoped = false;
    soundSystem.playReload(wep.reloadTime);
    this.emitState();
  }

  private finishReload() {
    const wep = this.state.weapons[this.state.activeWeaponIndex];
    const needed = wep.magSize - wep.currentAmmo;
    const toLoad = Math.min(needed, wep.reserveAmmo);
    wep.currentAmmo += toLoad;
    wep.reserveAmmo -= toLoad;

    this.isReloading = false;
    this.state.isReloading = false;
    if (this.isAiming && wep.type === 'sniper') {
      this.state.isScoped = true;
    }
    this.emitState();
  }

  // --- Shooting, Raycasting, Shell Ejection & Bullet Decals ---
  private tryShoot() {
    if (this.shootCooldown > 0 || this.isReloading || this.swapPhase === 'unequip') return;
    const wep = this.state.weapons[this.state.activeWeaponIndex];

    if (wep.type === 'medkit') {
      this.useNanoMedkit();
      this.shootCooldown = 0.6;
      return;
    }

    if (wep.type === 'grenade') {
      this.throwGrenade();
      return;
    }

    if (!this.state.adminCheats.infiniteAmmo && wep.currentAmmo <= 0) {
      soundSystem.playDryFire();
      this.shootCooldown = 0.25;
      return;
    }

    if (this.state.adminCheats.infiniteAmmo) {
      wep.currentAmmo = wep.magSize;
    } else {
      wep.currentAmmo--;
    }
    this.shootCooldown = wep.fireRate;
    this.boltKick = 1.0;
    const shotsFired = wep.pellets || 1;
    this.profile.totalShots += shotsFired;
    this.state.sessionShots += shotsFired;

    // Weapon-specific SFX, Recoil & Micro Screen Shake
    if (wep.type === 'shotgun') {
      soundSystem.playShotgunBlast();
      this.recoilPitch = 0.16;
      this.recoilZ = 0.13;
      this.pumpAnim = 1.0;
      this.screenShakeIntensity = Math.max(this.screenShakeIntensity, 0.065);
    } else if (wep.type === 'sniper') {
      soundSystem.playSniperShot();
      this.recoilPitch = 0.19;
      this.recoilZ = 0.14;
      this.screenShakeIntensity = Math.max(this.screenShakeIntensity, 0.058);
    } else if (wep.type === 'smg') {
      soundSystem.playSmgShot();
      this.recoilPitch = 0.036;
      this.recoilZ = 0.034;
      this.screenShakeIntensity = Math.max(this.screenShakeIntensity, 0.008);
    } else if (wep.type === 'pistol') {
      soundSystem.playMagnumShot();
      this.recoilPitch = 0.145;
      this.recoilZ = 0.11;
      this.screenShakeIntensity = Math.max(this.screenShakeIntensity, 0.046);
    } else {
      soundSystem.playRifleShot();
      this.recoilPitch = 0.055;
      this.recoilZ = 0.048;
      this.screenShakeIntensity = Math.max(this.screenShakeIntensity, 0.012);
    }

    // Muzzle Flash & Shell Casing Ejection
    this.triggerMuzzleFlash(wep.type === 'sniper' || wep.type === 'smg');

    this.camera.getWorldDirection(this._camDir);
    this._right.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    this._up.set(0, 1, 0).applyQuaternion(this.camera.quaternion);

    if (this.activeViewmodel) {
      const mAnchor = this.activeViewmodel.getObjectByName('muzzleAnchor');
      if (mAnchor) {
        mAnchor.getWorldPosition(this._muzzlePos);
      } else {
        this._muzzlePos.copy(this.camera.position).addScaledVector(this._camDir, 0.5);
      }

      const eAnchor = this.activeViewmodel.getObjectByName('ejectionAnchor');
      if (eAnchor) {
        eAnchor.getWorldPosition(this._ejectPos);
        this.particles.ejectShell(
          this._ejectPos,
          this._right,
          this._up,
          this._camDir,
          wep.type === 'shotgun'
        );
      }
    }

    // Collect raycast targets using pre-cached hitMeshes (zero scene-graph traversal per shot)
    const targetMeshes = this.raycastTargetsCache;
    targetMeshes.length = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const bot = this.enemies[i];
      if (!bot.isDead) {
        for (let m = 0; m < bot.hitMeshes.length; m++) {
          targetMeshes.push(bot.hitMeshes[m]);
        }
      }
    }
    if (this.boss && !this.boss.isDead) {
      for (let m = 0; m < this.boss.hitMeshes.length; m++) {
        targetMeshes.push(this.boss.hitMeshes[m]);
      }
    }
    for (let i = 0; i < this.arena.obstacleMeshes.length; i++) {
      targetMeshes.push(this.arena.obstacleMeshes[i]);
    }

    const pellets = wep.pellets || 1;
    const rawSpread = this.isAiming ? wep.adsSpread : wep.spread;
    const baseSpread = this.isCrouching && !this.isAiming ? rawSpread * 0.65 : rawSpread;
    const tracerColor = wep.type === 'shotgun' ? 0xf59e0b : wep.type === 'sniper' ? 0x38bdf8 : 0x06b6d4;

    let hitCount = 0;
    const damageAgg = new Map<object, { dmg: number; isCrit: boolean; pos: THREE.Vector3 }>();
    const headMult = wep.headshotMultiplier ?? 2.5;
    const bossHeadMult = wep.headshotMultiplier ?? 2.0;

    for (let p = 0; p < pellets; p++) {
      this._spreadDir.copy(this._camDir);
      if (baseSpread > 0) {
        const sx = (Math.random() - 0.5) * baseSpread;
        const sy = (Math.random() - 0.5) * baseSpread;
        this._spreadDir.addScaledVector(this._right, sx).addScaledVector(this._up, sy).normalize();
      }

      this._raycaster.set(this.camera.position, this._spreadDir);
      this._raycaster.near = 0.1;
      this._raycaster.far = wep.range;

      const intersects = this._raycaster.intersectObjects(targetMeshes, false);

      if (intersects.length > 0) {
        const hit = intersects[0];
        const hitPoint = hit.point;

        // Compute world-space surface normal
        this._worldNormal.set(0, 1, 0);
        if (hit.face) {
          this._normalMatrix.getNormalMatrix(hit.object.matrixWorld);
          this._worldNormal.copy(hit.face.normal).applyMatrix3(this._normalMatrix).normalize();
        }

        // Check if hit an EnemyBot or The Specialist Boss
        let hitBot: EnemyBot | null = null;
        let hitBoss = false;
        let bossZone: BossHitZone = 'body';
        let isHeadshot = false;

        let obj: THREE.Object3D | null = hit.object;
        while (obj && obj !== this.scene) {
          if (obj.name && obj.name.startsWith('ENEMY_')) {
            if (hit.object.name === 'ENEMY_WEAKSPOT') {
              bossZone = 'weakspot';
              isHeadshot = true;
            } else if (hit.object.name === 'ENEMY_HEAD') {
              bossZone = 'head';
              isHeadshot = true;
            }
            if (this.boss && obj === this.boss.group) {
              hitBoss = true;
              break;
            }
            const found = this.enemies.find((b) => b.group === obj);
            if (found) {
              hitBot = found;
              break;
            }
          }
          obj = obj.parent;
        }

        if (hitBoss && this.boss && !this.boss.isDead) {
          hitCount++;
          const res = this.boss.takeDamage(wep.damage, bossZone, bossHeadMult);
          const prev = damageAgg.get(this.boss);
          if (prev) {
            prev.dmg += res.actualDmg;
            prev.isCrit = prev.isCrit || res.isCrit;
            if (res.isCrit) prev.pos.copy(hitPoint);
          } else {
            damageAgg.set(this.boss, { dmg: res.actualDmg, isCrit: res.isCrit, pos: hitPoint.clone() });
          }
          this.triggerHitmarker(res.isCrit);
          this.particles.addImpactSparks(hitPoint, this._worldNormal, true);
          if (res.isDead) {
            this.handleBossDefeated(wep.shortName, bossZone);
          }
        } else if (hitBot && !hitBot.isDead) {
          hitCount++;
          const res = hitBot.takeDamage(wep.damage, isHeadshot, headMult);
          const prev = damageAgg.get(hitBot);
          if (prev) {
            prev.dmg += res.actualDmg;
            prev.isCrit = prev.isCrit || res.isHeadshot;
            if (res.isHeadshot) prev.pos.copy(hitPoint);
          } else {
            damageAgg.set(hitBot, { dmg: res.actualDmg, isCrit: res.isHeadshot, pos: hitPoint.clone() });
          }
          this.triggerHitmarker(res.isHeadshot);
          this.particles.addImpactSparks(hitPoint, this._worldNormal, true);

          if (res.isDead) {
            this.handleEnemyEliminated(hitBot, res.isHeadshot, wep.shortName);
          }
        } else {
          // Hit concrete/metal obstacle -> Sparks + Bullet Hole Decal
          this.particles.addImpactSparks(hitPoint, this._worldNormal, false);
          this.particles.addWallDecal(hitPoint, this._worldNormal);
        }

        this.particles.addTracer(this._muzzlePos, hitPoint, tracerColor);
      } else {
        this._farPt.copy(this.camera.position).addScaledVector(this._spreadDir, wep.range);
        this.particles.addTracer(this._muzzlePos, this._farPt, tracerColor);
      }
    }

    damageAgg.forEach((entry) => {
      this.particles.addFloatingDamage(entry.pos, entry.dmg, entry.isCrit);
    });

    if (hitCount > 0) {
      this.profile.totalHits += hitCount;
      this.state.sessionHits += hitCount;
    }

    this.saveProfile();
    if (!this.state.adminCheats.infiniteAmmo && wep.currentAmmo === 0 && wep.reserveAmmo > 0) {
      this.startReload();
    } else {
      this.emitState();
    }
  }

  private triggerMuzzleFlash(suppressed = false) {
    if (!this.activeViewmodel) return;
    const anchor = this.activeViewmodel.getObjectByName('muzzleAnchor');
    if (anchor) {
      this.muzzleFlashGroup.position.copy(anchor.position);
      this.muzzleFlashLight.position.copy(anchor.position);
    }

    this.muzzleFlashTimer = suppressed ? 0.03 : 0.055;
    const scale = suppressed ? 0.45 : 0.9 + Math.random() * 0.45;
    this.muzzleFlashGroup.scale.setScalar(scale);
    this.muzzleFlashGroup.rotation.z = Math.random() * Math.PI * 2;
    this.muzzleFlashGroup.children.forEach((c) => {
      ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = suppressed ? 0.45 : 0.95;
    });
    this.muzzleFlashLight.intensity =
      this.profile.graphicsPreset === 'potato' ? 0 : suppressed ? 5 : 18;
  }

  private triggerHitmarker(isHeadshot: boolean) {
    this.state.hitmarkerActive = true;
    this.state.hitmarkerHeadshot = isHeadshot;
    this.emitState();
    setTimeout(() => {
      this.state.hitmarkerActive = false;
      this.emitState();
    }, 130);
  }

  private resolveFullWeaponName(wepShortOrName: string): string {
    const matched = [...INITIAL_WEAPONS, ...SLOT4_OPTIONS].find(
      (w) => w.shortName === wepShortOrName || w.name === wepShortOrName
    );
    if (matched) return matched.name;
    const active = this.state.weapons[this.state.activeWeaponIndex];
    if (active && active.type !== 'medkit' && active.type !== 'grenade') {
      return active.name;
    }
    return 'AR-X7 Tactical';
  }

  private getMatchFavoriteWeapon(): string {
    let bestName = '';
    let bestKills = 0;
    for (const [name, count] of Object.entries(this.matchWeaponKills)) {
      if (count > bestKills) {
        bestKills = count;
        bestName = name;
      }
    }
    if (bestName) return bestName;
    const preferred = this.state.weapons[this.profile.preferredSlot || 0];
    if (preferred && preferred.type !== 'medkit' && preferred.type !== 'grenade') {
      return preferred.name;
    }
    return 'AR-X7 Tactical';
  }

  private applyVampireKillHeal(percent: number) {
    if (this.state.isDead) return;
    const healAmount = Math.max(1, Math.round(this.state.maxHealth * (percent / 100)));
    this.state.health = Math.min(this.state.maxHealth, this.state.health + healAmount);
    this.vampireHealSeq += 1;
    this.vampireHealTimer = 1.0;
    this.state.vampireHealEvent = {
      id: this.vampireHealSeq,
      amount: healAmount,
      percent,
      label: `+${percent}% HP`,
    };
    soundSystem.playVampireHeal();
  }

  private handleEnemyEliminated(bot: EnemyBot, isHeadshot: boolean, wepName: string) {
    this.particles.addExplosion(bot.position);

    const scoreGain = isHeadshot ? 250 : 100;
    const xpGain = isHeadshot ? 140 : 70;

    this.state.score += scoreGain;
    this.state.sessionXp += xpGain;
    this.state.sessionKills++;
    if (isHeadshot) {
      this.state.sessionHeadshots++;
    }

    const fullWep = this.resolveFullWeaponName(wepName);
    this.matchWeaponKills[fullWep] = (this.matchWeaponKills[fullWep] || 0) + 1;
    this.applyVampireKillHeal(10);

    this.profile.xp += xpGain;
    this.profile.totalKills++;
    if (isHeadshot) {
      this.profile.totalHeadshots++;
    }

    const neededXp = this.profile.level * 250;
    if (this.profile.xp >= neededXp) {
      this.profile.level++;
      this.profile.xp -= neededXp;
      soundSystem.playWaveComplete();
    }

    if (this.state.score > this.profile.highScore) {
      this.profile.highScore = this.state.score;
    }

    const entry = {
      id: Math.random().toString(36).substring(2, 9),
      text: `${this.profile.callsign} [${wepName}] ${bot.id}${isHeadshot ? ' · HEADSHOT' : ''}`,
      headshot: isHeadshot,
    };
    this.state.killFeed = [entry, ...this.state.killFeed.slice(0, 4)];

    const living = this.enemies.filter((b) => !b.isDead).length;
    this.state.enemiesRemaining = living;

    if (living === 0) {
      this.handleWaveCompleted();
    }

    this.saveProfile();
    this.emitState();
  }

  private handleWaveCompleted() {
    soundSystem.playWaveComplete();
    this.state.score += 500;
    this.state.sessionXp += 150;
    this.profile.xp += 150;
    while (this.profile.xp >= this.profile.level * 250) {
      this.profile.level++;
      this.profile.xp -= (this.profile.level - 1) * 250;
    }

    this.state.weapons.forEach((w) => {
      if (w.type === 'medkit' || w.type === 'grenade') {
        w.currentAmmo = Math.min(w.maxReserve, w.currentAmmo + 1);
      } else {
        w.reserveAmmo = Math.min(w.maxReserve, w.reserveAmmo + Math.floor(w.magSize * 1.5));
      }
    });

    if (this.state.wave > this.profile.highestWave) {
      this.profile.highestWave = this.state.wave;
    }
    this.saveProfile();

    // Immediately trigger Wave 10 Cinematic Boss Arrival Cutscene when Wave 9 is cleared
    if (this.state.wave === 9) {
      this.waveIntermissionTimer = 0;
      this.state.prepPhaseRemaining = 0;
      this.startNewWave(10);
      return;
    }

    this.waveIntermissionTimer = 15.0;
    this.state.prepPhaseRemaining = 15.0;
  }

  public skipPrepPhase() {
    if (
      this.waveIntermissionTimer <= 0 ||
      this.state.isDead ||
      this.state.isInMenu ||
      this.bossCutscene.isActive
    ) {
      return;
    }
    this.waveIntermissionTimer = 0;
    this.state.prepPhaseRemaining = 0;
    this.startNewWave(this.state.wave + 1);
  }

  private setBossAtmosphere(active: boolean) {
    this.bossAlarmGroup.visible = active;
    const isPotato = this.profile.graphicsPreset === 'potato';
    this.bossAlarmLights.forEach((l) => {
      l.intensity = active && !isPotato ? 22 : 0;
    });
  }

  private handleBossDefeated(wepName: string, zone: BossHitZone = 'body') {
    if (!this.boss) return;
    this.particles.addExplosion(this.boss.position);
    this.particles.addBossEntranceMist(this.boss.position);
    soundSystem.stopBossMusic();
    soundSystem.playBossDefeated();
    this.setBossAtmosphere(false);
    this.clearBossHazards();

    const scoreBonus = 5000;
    const xpBonus = 1500;
    this.state.score += scoreBonus;
    this.state.sessionXp += xpBonus;
    this.state.sessionKills++;
    if (zone !== 'body') {
      this.state.sessionHeadshots++;
      this.profile.totalHeadshots++;
    }

    this.profile.xp += xpBonus;
    this.profile.totalKills++;
    this.profile.bossDefeatedCount = (this.profile.bossDefeatedCount || 0) + 1;
    if (!this.profile.achievements.includes('SPECIALIST_SLAYER')) {
      this.profile.achievements = [...this.profile.achievements, 'SPECIALIST_SLAYER'];
    }

    const fullWep = this.resolveFullWeaponName(wepName);
    this.matchWeaponKills[fullWep] = (this.matchWeaponKills[fullWep] || 0) + 1;
    this.applyVampireKillHeal(25);

    while (this.profile.xp >= this.profile.level * 250) {
      this.profile.xp -= this.profile.level * 250;
      this.profile.level++;
    }

    // Automatically log #1 Global Leaderboard Victory Record
    const accuracy =
      this.state.sessionShots > 0
        ? Math.min(100, Math.round((this.state.sessionHits / this.state.sessionShots) * 100))
        : 100;
    const championScore = Math.max(26200, this.state.score);
    if (championScore > this.profile.highScore) {
      this.profile.highScore = championScore;
    }

    saveLocalScore({
      callsign: this.profile.callsign,
      countryCode: 'ID',
      flag: '🇮🇩',
      kills: this.state.sessionKills,
      headshots: this.state.sessionHeadshots,
      accuracy,
      survivalSec: Math.round(this.state.survivalTimeSec),
      wave: 10,
      score: championScore,
      xpEarned: this.state.sessionXp,
      level: this.profile.level,
      avatarColor: this.profile.accentColor,
      favoriteWeapon: this.getMatchFavoriteWeapon(),
    });

    const entry = {
      id: Math.random().toString(36).substring(2, 9),
      text: `${this.profile.callsign} [${wepName}] THE SPECIALIST ANESTESI · BOSS NEUTRALIZED`,
      headshot: true,
    };
    this.state.killFeed = [entry, ...this.state.killFeed.slice(0, 4)];
    this.state.enemiesRemaining = 0;
    this.state.bossState = null;
    this.state.bossBanner = {
      title: 'THE SPECIALIST NEUTRALIZED',
      subtitle: '+1,500 XP · +5,000 SCORE · ACHIEVEMENT UNLOCKED · #1 GLOBAL RECORD LOGGED',
      tone: 'emerald',
    };
    this.bossBannerTimer = 5.5;

    this.handleWaveCompleted();
    this.emitState();
  }

  public damagePlayer(amount: number) {
    if (this.state.isDead || this.state.adminCheats.godMode || this.bossCutscene.isActive) return;
    soundSystem.playPlayerHurt();
    this.state.damageVignette = 0.8;

    if (this.state.armor > 0) {
      const absorbed = Math.min(this.state.armor, amount * 0.65);
      this.state.armor -= absorbed;
      amount -= absorbed;
    }

    this.state.health = Math.max(0, this.state.health - amount);
    if (this.state.health <= 0) {
      this.state.isDead = true;
      this.state.isScoped = false;
      this.state.isAiming = false;
      soundSystem.stopBossMusic();
      this.setBossAtmosphere(false);
      // Add survival time bonus on mission termination
      const survivalBonus = Math.round(this.state.survivalTimeSec * 2);
      this.state.score += survivalBonus;
      if (this.state.score > this.profile.highScore) {
        this.profile.highScore = this.state.score;
      }
      this.profile.totalDeaths++;
      this.controls.unlock();
      this.saveProfile();
    }
    this.emitState();
  }

  public submitMatchScore(): {
    entry: LeaderboardEntry;
    rank: number;
    xpAwarded: number;
    leveledUp: boolean;
  } | null {
    if (!this.state.isDead || this.state.scoreSubmitted) return null;

    const accuracy =
      this.state.sessionShots > 0
        ? Math.min(100, Math.round((this.state.sessionHits / this.state.sessionShots) * 100))
        : 0;

    const xpBonus = 50 + this.state.wave * 15;
    this.state.sessionXp += xpBonus;
    this.profile.xp += xpBonus;

    let leveledUp = false;
    while (this.profile.xp >= this.profile.level * 250) {
      this.profile.xp -= this.profile.level * 250;
      this.profile.level++;
      leveledUp = true;
    }

    if (this.state.score > this.profile.highScore) {
      this.profile.highScore = this.state.score;
    }

    const { savedEntry } = saveLocalScore({
      callsign: this.profile.callsign,
      countryCode: 'ID',
      flag: '🇮🇩',
      kills: this.state.sessionKills,
      headshots: this.state.sessionHeadshots,
      accuracy,
      survivalSec: Math.round(this.state.survivalTimeSec),
      wave: this.state.wave,
      score: this.state.score,
      xpEarned: this.state.sessionXp,
      level: this.profile.level,
      avatarColor: this.profile.accentColor,
      favoriteWeapon: this.getMatchFavoriteWeapon(),
    });

    const board = getMergedLeaderboard('global', this.profile.callsign);
    const rankIndex = board.rows.findIndex((r) => r.id === savedEntry.id);
    const rank = rankIndex >= 0 ? rankIndex + 1 : board.activePlayerBestRank || 100;

    this.state.scoreSubmitted = true;
    this.state.submittedRank = rank;
    soundSystem.playScoreSubmit();
    this.saveProfile();
    this.emitState();

    return {
      entry: savedEntry,
      rank,
      xpAwarded: xpBonus,
      leveledUp,
    };
  }

  private clearBossHazards() {
    this.activeSyringeDarts.forEach((d) => this.scene.remove(d.mesh));
    this.activeSyringeDarts = [];
    this.activeGasClouds.forEach((g) => this.scene.remove(g.mesh));
    this.activeGasClouds = [];
    this.slowRemaining = 0;
    this.inGasHazard = false;
  }

  private finishBossCutscene(_skipped: boolean) {
    soundSystem.stopCutsceneSiren();
    this.state.cutscene = null;
    this.weaponRig.visible = true;

    if (this.boss && !this.boss.isDead) {
      this.boss.setCutscenePose('combat', 1);
      this.state.bossState = {
        name: this.boss.displayName,
        health: this.boss.health,
        maxHealth: this.boss.maxHealth,
        attackLabel: this.boss.attackLabel,
        active: true,
      };
      this.state.bossBanner = {
        title: 'THE SPECIALIST ANESTESI HAS ENTERED THE ARENA',
        subtitle: 'TARGET DORSAL BIO-TANK (2.2x) OR HEAD (2.0x)',
        tone: 'crimson',
      };
      this.bossBannerTimer = 3.8;
    }

    soundSystem.startBossMusic();

    if (!this.controls.isLocked && !this.state.isInMenu && !this.state.isDead) {
      this.state.isPaused = true;
      this.state.pointerLockNotice = 'Click Resume to lock mouse aim.';
    }

    this.emitState();
  }

  public startNewWave(waveNum: number) {
    this.state.wave = waveNum;
    this.waveIntermissionTimer = 0;
    this.state.prepPhaseRemaining = 0;

    this.enemies.forEach((b) => this.scene.remove(b.group));
    this.enemies = [];
    if (this.boss) {
      this.scene.remove(this.boss.group);
      this.boss = null;
    }
    this.bossCutscene.resetAll();
    this.state.cutscene = null;
    soundSystem.stopCutsceneSiren();
    this.clearBossHazards();

    if (waveNum === 10) {
      // Wave 10 Boss Encounter: 7.0s Cinematic Arrival Cutscene ("The Specialist Anestesi")
      this.boss = new BossSpecialist(BOSS_LANDING_POS);
      this.scene.add(this.boss.group);
      this.applyMaterialQuality(this.boss.group, this.profile.graphicsPreset);
      this.setBossAtmosphere(true);
      soundSystem.stopBossMusic();
      soundSystem.startCutsceneSiren();

      // Clear active combat inputs & protect view while cutscene runs
      this.moveForward = false;
      this.moveBackward = false;
      this.moveLeft = false;
      this.moveRight = false;
      this.isSprinting = false;
      this.isMouseDown = false;
      this.isAiming = false;
      this.state.isAiming = false;
      this.state.isScoped = false;
      this.isReloading = false;
      this.state.isReloading = false;
      this.weaponRig.visible = false;
      this.laserDot.visible = false;

      // Ensure player isn't standing inside crater impact radius when control returns, and faces the Boss
      const distToCrater = Math.hypot(
        this.playerPos.x - BOSS_LANDING_POS.x,
        this.playerPos.z - BOSS_LANDING_POS.z
      );
      if (distToCrater < 5.0) {
        this.playerPos.set(0, this.playerEyeHeight, -12.6);
        this.camera.position.copy(this.playerPos);
        this.camera.lookAt(BOSS_LANDING_POS.x, 1.65, BOSS_LANDING_POS.z);
      }

      this.state.isPaused = false;
      this.state.isInventoryOpen = false;
      this.state.isBossWave = true;
      this.state.enemiesRemaining = 1;
      this.state.bossState = null;
      this.state.bossBanner = null;
      this.bossBannerTimer = 0;

      this.bossCutscene.start(
        this.boss,
        this.playerPos,
        this.camera.quaternion,
        this.profile.baseFov,
        this.profile.graphicsPreset === 'potato'
      );
      this.state.cutscene = this.bossCutscene.getHudSnapshot();
      this.emitState();
      return;
    }

    this.setBossAtmosphere(false);
    soundSystem.stopBossMusic();
    this.state.isBossWave = false;
    this.state.bossState = null;

    const count = Math.min(8, 2 + Math.ceil((waveNum - 1) * 0.75));
    this.state.enemiesRemaining = count;

    for (let i = 0; i < count; i++) {
      const spawnNode = this.arena.enemySpawns[i % this.arena.enemySpawns.length].clone();
      spawnNode.x += (Math.random() - 0.5) * 3.5;
      spawnNode.z += (Math.random() - 0.5) * 3.5;
      spawnNode.y = 0;

      const bot = new EnemyBot(
        `UNIT-${i + 1 < 10 ? '0' : ''}${i + 1}`,
        spawnNode,
        this.arena.patrolNodes,
        waveNum
      );
      this.enemies.push(bot);
      this.scene.add(bot.group);
      this.applyMaterialQuality(bot.group, this.profile.graphicsPreset);
    }

    this.emitState();
  }

  public startGame(initialWave = 1, autoLock = true) {
    soundSystem.stopLobbyAmbient();
    soundSystem.stopBossMusic();
    soundSystem.stopCutsceneSiren();
    this.bossCutscene.resetAll();
    this.setBossAtmosphere(false);
    this.state.health = 100;
    this.state.armor = 100;
    this.state.score = 0;
    this.state.isDead = false;
    this.state.isPaused = initialWave === 10 ? false : !autoLock;
    this.state.isInMenu = false;
    this.state.isInventoryOpen = false;
    this.state.killFeed = [];
    this.state.sessionKills = 0;
    this.state.sessionHeadshots = 0;
    this.state.sessionShots = 0;
    this.state.sessionHits = 0;
    this.state.sessionXp = 0;
    this.state.survivalTimeSec = 0;
    this.state.scoreSubmitted = false;
    this.state.submittedRank = null;
    this.state.prepPhaseRemaining = 0;
    this.state.isBossWave = false;
    this.state.bossState = null;
    this.state.slowRemaining = 0;
    this.state.inGasHazard = false;
    this.state.bossBanner = null;
    this.state.cutscene = null;
    this.bossBannerTimer = 0;
    this.state.vampireHealEvent = null;
    this.vampireHealTimer = 0;
    this.matchWeaponKills = {};
    this.state.weapons = buildFourSlotLoadout(this.profile.slot4Choice);
    this.previousWeaponIndex = 3;

    this.activeGrenades.forEach((g) => this.scene.remove(g.mesh));
    this.activeGrenades = [];
    this.clearBossHazards();
    this.flashlightOn = false;
    this.state.flashlightOn = false;
    this.state.flashbangGlare = 0;
    this.tacticalLight.intensity = 0;
    this.laserDot.visible = false;

    const startIdx =
      this.profile.slot4Choice === 'nano_medkit' && this.profile.preferredSlot === 3
        ? 0
        : Math.max(0, Math.min(3, this.profile.preferredSlot || 0));
    this.equipWeapon(startIdx, true);
    this.weaponRig.visible = true;

    this.isCrouching = false;
    this.state.isCrouching = false;
    this.playerEyeHeight = 1.75;
    this.screenShakeIntensity = 0;
    this.playerPos.copy(this.arena.playerSpawn);
    this.playerVel.set(0, 0, 0);
    this.camera.position.copy(this.playerPos);
    this.camera.rotation.set(0, 0, 0);

    this.startNewWave(initialWave);
    if (autoLock) {
      this.requestPointerLockSafe();
    } else {
      this.emitState();
    }
  }

  public resumeGame() {
    if (this.state.isDead) return;
    this.requestPointerLockSafe();
  }

  // --- Secret Admin Panel Engine Controls ---
  public pauseForAdmin() {
    if (this.state.isInMenu || this.state.isDead) return;
    this.clearPointerLockNoticeTimer();
    this.state.pointerLockNotice = null;
    this.state.isPaused = true;
    this.state.isInventoryOpen = false;
    this.isMouseDown = false;
    this.isAiming = false;
    this.state.isAiming = false;
    this.state.isScoped = false;
    this.unlockPointerSafe();
    this.emitState();
  }

  public setAdminCheats(updates: Partial<AdminCheatsState>) {
    this.state.adminCheats = {
      ...this.state.adminCheats,
      ...updates,
    };
    if (updates.godMode) {
      this.state.health = this.state.maxHealth;
      this.state.armor = this.state.maxArmor;
    }
    if (updates.infiniteAmmo) {
      this.isReloading = false;
      this.state.isReloading = false;
      this.state.weapons.forEach((w) => {
        if (w.type === 'medkit' || w.type === 'grenade') {
          w.currentAmmo = w.maxReserve;
        } else {
          w.currentAmmo = w.magSize;
          w.reserveAmmo = w.maxReserve;
        }
      });
    }
    this.emitState();
  }

  public adminSkipWave() {
    if (this.state.isInMenu) {
      this.startGame(2, false);
      return;
    }
    if (this.state.isDead) return;
    if (this.state.wave + 1 === 10) {
      this.adminSummonBossWave();
      return;
    }
    this.waveIntermissionTimer = 0;
    this.state.prepPhaseRemaining = 0;
    this.startNewWave(this.state.wave + 1);
  }

  public adminSummonBossWave() {
    this.clearPointerLockNoticeTimer();
    this.state.pointerLockNotice = null;
    if (this.state.isInMenu) {
      this.startGame(10, true);
      return;
    }
    if (this.state.isDead) return;
    this.state.isPaused = false;
    this.state.isInventoryOpen = false;
    this.waveIntermissionTimer = 0;
    this.state.prepPhaseRemaining = 0;
    this.startNewWave(10);
    this.requestPointerLockSafe();
  }

  public adminKillAllHostiles(): number {
    if (this.state.isInMenu || this.state.isDead) return 0;
    let killedCount = 0;
    const livingBots = this.enemies.filter((b) => !b.isDead);
    for (let i = 0; i < livingBots.length; i++) {
      const bot = livingBots[i];
      bot.takeDamage(99999, true, 1);
      killedCount++;
      this.handleEnemyEliminated(bot, true, 'ADMIN-CMD');
    }
    if (this.boss && !this.boss.isDead) {
      this.boss.takeDamage(999999, 'weakspot', 1);
      killedCount++;
      this.handleBossDefeated('ADMIN-CMD', 'weakspot');
    }
    return killedCount;
  }

  public adminGrantMaxXpAndUnlockAll() {
    this.profile.xp += 50000;
    this.state.sessionXp += 50000;
    while (this.profile.xp >= this.profile.level * 250) {
      this.profile.xp -= this.profile.level * 250;
      this.profile.level++;
    }
    this.profile.allUnlocked = true;
    const allBadges = ['SPECIALIST_SLAYER', 'ARSENAL_MASTER', 'ADMIN_OVERDRIVE'];
    const merged = new Set([...(this.profile.achievements || []), ...allBadges]);
    this.profile.achievements = Array.from(merged);

    // Top off arsenal ammo & charges in active match
    this.state.weapons.forEach((w) => {
      if (w.type === 'medkit' || w.type === 'grenade') {
        w.currentAmmo = w.maxReserve;
      } else {
        w.currentAmmo = w.magSize;
        w.reserveAmmo = w.maxReserve;
      }
    });

    soundSystem.playWaveComplete();
    this.saveProfile();
    this.emitState();
  }

  private scheduleNextFrame = () => {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      if (this.softGlTimerId !== null) window.clearTimeout(this.softGlTimerId);
      this.softGlTimerId = window.setTimeout(() => {
        this.softGlTimerId = null;
        if (!this.disposed) {
          this.animFrameId = requestAnimationFrame(this.loop);
        }
      }, 16);
    } else {
      this.animFrameId = requestAnimationFrame(this.loop);
    }
  };

  // --- Main Render & Simulation Loop ---
  private loop = () => {
    if (this.disposed) return;
    if (!this.isSoftwareGl) {
      this.animFrameId = requestAnimationFrame(this.loop);
    }
    if (this.contextLost) {
      if (this.isSoftwareGl) this.scheduleNextFrame();
      return;
    }

    this.fpsFrames++;
    const now = performance.now();
    const fpsElapsed = now - this.fpsLastSample;
    if (fpsElapsed >= 250) {
      this.currentFps = Math.max(1, Math.round((this.fpsFrames * 1000) / fpsElapsed));
      this.fpsFrames = 0;
      this.fpsLastSample = now;
      this.state.fps = this.currentFps;
    }

    const delta = Math.min(this.clock.getDelta(), 0.1);

    if (this.state.isInMenu) {
      this.lobby.update(delta);
      this.renderer.render(this.lobby.scene, this.lobby.camera);
      if (this.isSoftwareGl) this.scheduleNextFrame();
      return;
    }

    // Subtle rotation on glowing energy cores in Combat Arena
    for (let i = 0; i < this.arena.energyCores.length; i++) {
      this.arena.energyCores[i].rotation.y += delta * 0.9;
    }

    // Pulse & rotate crimson emergency lights during Wave 10 Cutscene & Boss Fight (muted in Potato Mode)
    if (this.bossAlarmGroup.visible) {
      const spinSpeed = this.bossCutscene.isActive ? 6.2 : 3.8;
      if (!this.state.isPaused && !this.state.isDead) {
        for (let i = 0; i < this.bossAlarmRotors.length; i++) {
          this.bossAlarmRotors[i].rotation.y += delta * spinSpeed;
        }
      }
      if (this.profile.graphicsPreset === 'potato') {
        for (let i = 0; i < this.bossAlarmLights.length; i++) {
          this.bossAlarmLights[i].intensity = 0;
        }
        const bAlpha = this.bossCutscene.isActive ? 0.16 : 0.1;
        for (let i = 0; i < this.bossAlarmBeams.length; i++) {
          this.bossAlarmBeams[i].opacity = bAlpha;
        }
      } else {
        const pulse = 14 + Math.sin(now * 0.014) * 11;
        for (let i = 0; i < this.bossAlarmLights.length; i++) {
          this.bossAlarmLights[i].intensity = Math.max(5, pulse * (i % 2 === 0 ? 1 : 0.85));
        }
        const beamAlpha = this.bossCutscene.isActive
          ? 0.24 + 0.1 * Math.sin(now * 0.014)
          : 0.15 + 0.06 * Math.sin(now * 0.01);
        for (let i = 0; i < this.bossAlarmBeams.length; i++) {
          this.bossAlarmBeams[i].opacity = beamAlpha;
        }
      }
    }

    if (!this.state.isPaused && !this.state.isDead) {
      this.bossCutscene.update(delta);
      if (this.bossCutscene.isActive) {
        if (this.state.damageVignette > 0) {
          this.state.damageVignette = Math.max(0, this.state.damageVignette - delta * 1.6);
        }
        if (this.state.flashbangGlare > 0) {
          this.state.flashbangGlare = Math.max(0, this.state.flashbangGlare - delta * 1.4);
        }
        if (this.vampireHealTimer > 0) {
          this.vampireHealTimer = Math.max(0, this.vampireHealTimer - delta);
          if (this.vampireHealTimer <= 0) this.state.vampireHealEvent = null;
        }
        this.particles.update(delta);
        const snap = this.bossCutscene.getHudSnapshot();
        this.state.cutscene = snap;
        const csKey = snap ? `${snap.phase}|${snap.showTitleCard}|${snap.canSkip}` : '';
        this.hudEmitAccum += delta;
        if (csKey !== this.lastCutsceneEmitKey || this.hudEmitAccum >= 0.05) {
          this.lastCutsceneEmitKey = csKey;
          this.hudEmitAccum = 0;
          this.emitState();
        }
      } else {
        this.lastCutsceneEmitKey = '';
        this.updatePhysics(delta);
        this.updateWeapons(delta);
        this.updateGrenades(delta);
        this.updateBossHazards(delta);
        this.updateEnemies(delta);
        this.particles.update(delta);
        this.updateHUDState(delta);
      }
    }

    if (this.screenShakeIntensity > 0.0005 && !this.state.isPaused && !this.state.isDead) {
      this.screenShakeIntensity = Math.max(0, this.screenShakeIntensity - delta * 0.28);
      this.screenShakePhase += delta * 68;
      const sx = Math.sin(this.screenShakePhase * 1.13) * this.screenShakeIntensity;
      const sy = Math.cos(this.screenShakePhase * 1.47) * this.screenShakeIntensity;
      const sRoll = Math.sin(this.screenShakePhase * 0.89) * this.screenShakeIntensity * 0.35;
      const preShakeX = this.camera.position.x;
      const preShakeY = this.camera.position.y;
      const preShakeZ = this.camera.position.z;
      this._right.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
      this._up.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
      this.camera.position.addScaledVector(this._right, sx).addScaledVector(this._up, sy);
      const prevRotZ = this.camera.rotation.z;
      this.camera.rotation.z = prevRotZ + sRoll;
      this.renderer.render(this.scene, this.camera);
      this.camera.position.set(preShakeX, preShakeY, preShakeZ);
      this.camera.rotation.z = prevRotZ;
    } else {
      this.screenShakeIntensity = 0;
      this.renderer.render(this.scene, this.camera);
    }

    if (this.isSoftwareGl) {
      this.scheduleNextFrame();
    }
  };

  private updatePhysics(delta: number) {
    this.camera.getWorldDirection(this._forward);
    this._forward.y = 0;
    this._forward.normalize();

    this._right.crossVectors(this._forward, this._up).normalize();

    this._moveDir.set(0, 0, 0);
    if (this.moveForward) this._moveDir.add(this._forward);
    if (this.moveBackward) this._moveDir.sub(this._forward);
    if (this.moveRight) this._moveDir.add(this._right);
    if (this.moveLeft) this._moveDir.sub(this._right);

    const isMoving = this._moveDir.lengthSq() > 0.001;
    if (isMoving) this._moveDir.normalize();

    let targetSpeed = 5.6;
    if (this.isAiming) {
      targetSpeed = 3.1;
    } else if (this.isCrouching) {
      targetSpeed = 3.35;
    } else if (this.isSprinting && this.moveForward) {
      targetSpeed = 8.6;
    }

    if (this.slowRemaining > 0) {
      this.slowRemaining = Math.max(0, this.slowRemaining - delta);
      targetSpeed *= 0.62;
    }
    targetSpeed *= this.state.adminCheats.speedMultiplier;

    // Gentle tactical regeneration during 15s Prep Phase
    if (this.waveIntermissionTimer > 0 && this.state.health < this.state.maxHealth) {
      this.state.health = Math.min(this.state.maxHealth, this.state.health + 2.5 * delta);
    }

    const prevEye = this.playerEyeHeight;
    const targetEye = this.isCrouching ? 1.12 : 1.75;
    this.playerEyeHeight = THREE.MathUtils.damp(this.playerEyeHeight, targetEye, 14, delta);
    const eyeHeight = this.playerEyeHeight;
    const curGroundFeet = this.playerPos.y - prevEye;

    const accel = this.isGrounded ? 42 : 12;
    this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, this._moveDir.x * targetSpeed, accel, delta);
    this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, this._moveDir.z * targetSpeed, accel, delta);
    this.playerVel.y -= 20 * delta;

    const deltaX = this.playerVel.x * delta;
    const deltaZ = this.playerVel.z * delta;
    const deltaY = this.playerVel.y * delta;

    const playerRadius = 0.45;
    let groundHeight = 0;

    for (let i = 0; i < this.arena.collisions.length; i++) {
      const c = this.arena.collisions[i];
      if (c.type === 'ramp' && c.heightAt) {
        if (
          this.playerPos.x >= c.box.min.x &&
          this.playerPos.x <= c.box.max.x &&
          this.playerPos.z >= c.box.min.z &&
          this.playerPos.z <= c.box.max.z
        ) {
          const rh = c.heightAt(this.playerPos.x, this.playerPos.z);
          if (rh > groundHeight) groundHeight = rh;
        }
      } else if (c.type === 'platform') {
        if (
          this.playerPos.x >= c.box.min.x &&
          this.playerPos.x <= c.box.max.x &&
          this.playerPos.z >= c.box.min.z &&
          this.playerPos.z <= c.box.max.z
        ) {
          const ph = c.box.max.y;
          if (ph > groundHeight && curGroundFeet >= ph - 0.55) {
            groundHeight = ph;
          }
        }
      }
    }

    const nextX = this.playerPos.x + deltaX;
    const nextZ = this.playerPos.z + deltaZ;
    let canMoveX = true;
    let canMoveZ = true;
    const curFeet = curGroundFeet;

    for (let i = 0; i < this.arena.collisions.length; i++) {
      const c = this.arena.collisions[i];
      if (c.type === 'ramp') continue;
      if (c.type === 'platform' && curFeet >= c.box.max.y - 0.35) continue;

      const minX = c.box.min.x - playerRadius;
      const maxX = c.box.max.x + playerRadius;
      const minZ = c.box.min.z - playerRadius;
      const maxZ = c.box.max.z + playerRadius;

      if (curFeet < c.box.max.y && curFeet + eyeHeight > c.box.min.y) {
        if (nextX >= minX && nextX <= maxX && this.playerPos.z >= minZ && this.playerPos.z <= maxZ) {
          canMoveX = false;
        }
        if (this.playerPos.x >= minX && this.playerPos.x <= maxX && nextZ >= minZ && nextZ <= maxZ) {
          canMoveZ = false;
        }
      }
    }

    if (canMoveX) this.playerPos.x = nextX;
    if (canMoveZ) this.playerPos.z = nextZ;

    this.playerPos.y = curGroundFeet + eyeHeight + deltaY;
    const minCameraY = groundHeight + eyeHeight;
    if (this.playerPos.y <= minCameraY) {
      this.playerPos.y = minCameraY;
      this.playerVel.y = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    this.camera.position.copy(this.playerPos);

    // Speed-sensitive Footsteps
    if (isMoving && this.isGrounded) {
      const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
      this.stepDistanceAccum += horizSpeed * delta;
      const interval = this.isSprinting ? 2.25 : 1.65;
      if (this.stepDistanceAccum >= interval) {
        this.stepDistanceAccum = 0;
        soundSystem.playFootstep(this.isSprinting);
      }
    }

    // Low HP Warning Alert
    if (this.state.health > 0 && this.state.health <= 25) {
      this.lowHpAlertTimer -= delta;
      if (this.lowHpAlertTimer <= 0) {
        this.lowHpAlertTimer = 1.6;
        soundSystem.playLowHealthAlert();
      }
    }
  }

  private updateWeapons(delta: number) {
    if (this.shootCooldown > 0) this.shootCooldown -= delta;

    // 1. Equip / Unequip Transition Animation
    if (this.swapPhase === 'unequip') {
      this.swapTimer += delta;
      const p = Math.min(1, this.swapTimer / 0.13);
      this.swapOffsetY = -0.34 * p;
      if (p >= 1) {
        this.applyEquippedWeapon(this.pendingWeaponIndex);
        this.swapPhase = 'equip';
        this.swapTimer = 0;
        this.swapOffsetY = -0.34;
        this.swapVelY = 0;
      }
    } else if (this.swapPhase === 'equip') {
      this.swapTimer += delta;
      // Spring-damped rise into ready pose
      const force = -this.swapOffsetY * 260 - this.swapVelY * 24;
      this.swapVelY += force * delta;
      this.swapOffsetY += this.swapVelY * delta;
      if (this.swapTimer >= 0.24 && Math.abs(this.swapOffsetY) < 0.004) {
        this.swapPhase = 'idle';
        this.swapOffsetY = 0;
        this.swapVelY = 0;
      }
    }

    const wep = this.state.weapons[this.state.activeWeaponIndex];
    if (
      this.isMouseDown &&
      (wep.type === 'rifle' || wep.type === 'smg') &&
      this.shootCooldown <= 0 &&
      this.swapPhase !== 'unequip'
    ) {
      this.tryShoot();
    }

    if (this.isReloading) {
      this.reloadProgress += delta;
      if (this.reloadProgress >= wep.reloadTime) {
        this.finishReload();
      }
    }

    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= delta;
      if (this.muzzleFlashTimer <= 0) {
        this.muzzleFlashGroup.children.forEach((c) => {
          ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0;
        });
        this.muzzleFlashLight.intensity = 0;
      }
    }

    // Smooth FOV zoom for ADS
    const targetFov = this.isAiming && !this.isReloading && this.swapPhase !== 'unequip'
      ? wep.adsFov
      : this.profile.baseFov;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 13, delta);
    this.camera.updateProjectionMatrix();

    // Hide viewmodel when looking through SR-50 tactical scope overlay
    if (this.activeViewmodel) {
      this.activeViewmodel.visible = !this.state.isScoped;
    }

    // Mouse Sway decay
    this.swayTargetX = THREE.MathUtils.damp(this.swayTargetX, 0, 10, delta);
    this.swayTargetY = THREE.MathUtils.damp(this.swayTargetY, 0, 10, delta);
    this.swayX = THREE.MathUtils.damp(this.swayX, this.swayTargetX, 14, delta);
    this.swayY = THREE.MathUtils.damp(this.swayY, this.swayTargetY, 14, delta);

    // Walking / Sprinting Bob
    const speed = Math.hypot(this.playerVel.x, this.playerVel.z);
    const isMoving = speed > 0.5 && this.isGrounded;
    if (isMoving) {
      this.walkBobCycle += delta * (this.isSprinting ? 14 : 9);
    }
    const bobAmp = this.isAiming ? 0.0025 : this.isSprinting ? 0.018 : 0.011;
    const bobX = isMoving ? Math.sin(this.walkBobCycle * 0.5) * bobAmp : 0;
    const bobY = isMoving ? Math.abs(Math.sin(this.walkBobCycle)) * bobAmp : 0;

    // Recoil & Moving Parts Decay
    this.recoilPitch = THREE.MathUtils.damp(this.recoilPitch, 0, 14, delta);
    this.recoilZ = THREE.MathUtils.damp(this.recoilZ, 0, 16, delta);
    if (this.boltKick > 0) {
      this.boltKick = Math.max(0, this.boltKick - delta * 14);
    }

    // Shotgun Pump-Action Forend Animation
    if (this.pumpAnim > 0) {
      this.pumpAnim = Math.max(0, this.pumpAnim - delta * 2.8);
      const sgVm = this.viewmodels['sg_12'];
      const pumpSlide = sgVm?.getObjectByName('pumpSlide');
      if (pumpSlide) {
        const slideOffset = Math.sin(this.pumpAnim * Math.PI) * 0.095;
        pumpSlide.position.z = -0.34 + slideOffset;
      }
    }

    // Moving Parts: Bolt Carrier Recoil + Last-Shot Hold-Open & Charging Handle Reload Pull
    if (this.activeViewmodel) {
      const boltSlide = this.activeViewmodel.getObjectByName('boltSlide');
      if (boltSlide) {
        const baseZ = (boltSlide.userData.baseZ as number) ?? 0;
        const travelZ = (boltSlide.userData.travelZ as number) ?? 0.055;
        const holdOpen =
          wep.type !== 'grenade' && wep.type !== 'medkit' && wep.currentAmmo === 0 && !this.isReloading
            ? 0.86
            : 0;
        const factor = Math.max(holdOpen, Math.sin(this.boltKick * Math.PI));
        boltSlide.position.z = baseZ + travelZ * factor;
      }

      const chargingHandle = this.activeViewmodel.getObjectByName('chargingHandle');
      if (chargingHandle) {
        const baseZ = (chargingHandle.userData.baseZ as number) ?? 0;
        const travelZ = (chargingHandle.userData.travelZ as number) ?? 0.065;
        let pullFactor = 0;
        if (this.isReloading) {
          const rp = this.reloadProgress / Math.max(0.01, wep.reloadTime);
          if (rp > 0.62 && rp < 0.94) {
            pullFactor = Math.sin(((rp - 0.62) / 0.32) * Math.PI);
          }
        }
        chargingHandle.position.z = baseZ + travelZ * pullFactor;
      }

      // Flashlight Bezel Emissive Glow
      const flashLens = this.activeViewmodel.getObjectByName('flashlightLens') as THREE.Mesh | undefined;
      if (flashLens && flashLens.material) {
        (flashLens.material as THREE.MeshStandardMaterial).emissiveIntensity = this.flashlightOn ? 2.4 : 0.1;
      }

      // Dynamic Laser Sight Raycast (Active on ballistic guns when ready & not scoped)
      const showLaser =
        wep.type !== 'grenade' &&
        wep.type !== 'medkit' &&
        !this.isReloading &&
        !this.state.isScoped &&
        this.swapPhase === 'idle';
      setViewmodelLaserVisible(this.activeViewmodel, showLaser);

      const laserAnchor = this.activeViewmodel.getObjectByName('laserAnchor');
      const laserBeam = this.activeViewmodel.getObjectByName('laserBeam');
      if (showLaser && laserAnchor && laserBeam) {
        laserAnchor.getWorldPosition(this._laserStart);
        laserAnchor.getWorldQuaternion(this._laserQuat);
        this._laserDir.set(0, 0, -1).applyQuaternion(this._laserQuat).normalize();
        this._raycaster.set(this._laserStart, this._laserDir);
        this._raycaster.near = 0.1;
        this._raycaster.far = 28;
        const lHits = this._raycaster.intersectObjects(this.arena.obstacleMeshes, false);
        if (lHits.length > 0) {
          laserBeam.scale.z = Math.max(0.2, lHits[0].distance);
          this.laserDot.position.copy(lHits[0].point).addScaledVector(this._laserDir, -0.02);
          this.laserDot.visible = true;
        } else {
          laserBeam.scale.z = 22;
          this.laserDot.visible = false;
        }
      } else {
        this.laserDot.visible = false;
      }
    } else {
      this.laserDot.visible = false;
    }

    // Reload Dip & Cant Animation
    let reloadDropY = 0;
    let reloadRollZ = 0;
    let reloadPitchX = 0;
    if (this.isReloading) {
      const p = Math.sin((this.reloadProgress / wep.reloadTime) * Math.PI);
      reloadDropY = -0.14 * p;
      reloadRollZ = 0.35 * p;
      reloadPitchX = -0.28 * p;
    }

    const adsCenteredX = wep.type === 'medkit' || wep.type === 'grenade' ? 0.12 : 0;
    const adsCenteredY =
      wep.type === 'rifle'
        ? -0.155
        : wep.type === 'smg'
        ? -0.148
        : wep.type === 'shotgun'
        ? -0.135
        : wep.type === 'pistol'
        ? -0.12
        : -0.16;

    const targetX = (this.isAiming ? adsCenteredX : 0.22) + bobX + this.swayX;
    const targetY =
      (this.isAiming ? adsCenteredY : -0.22) + bobY + this.swayY + reloadDropY + this.swapOffsetY;
    const targetZ = (this.isAiming ? -0.31 : -0.42) + this.recoilZ;

    this.weaponRig.position.x = THREE.MathUtils.damp(this.weaponRig.position.x, targetX, 16, delta);
    this.weaponRig.position.y = THREE.MathUtils.damp(this.weaponRig.position.y, targetY, 18, delta);
    this.weaponRig.position.z = THREE.MathUtils.damp(this.weaponRig.position.z, targetZ, 18, delta);

    const swapTilt = this.swapOffsetY * 1.1;
    this.weaponRig.rotation.x = this.recoilPitch + reloadPitchX + swapTilt;
    this.weaponRig.rotation.y = bobX * 0.35 + this.swayX * 0.8;
    this.weaponRig.rotation.z = reloadRollZ - this.swapOffsetY * 0.45;
  }

  private spawnSyringeDart(origin: THREE.Vector3, dir: THREE.Vector3) {
    const dartGroup = new THREE.Group();
    const body = new THREE.Mesh(this.dartBodyGeo, this.dartBodyMat);
    dartGroup.add(body);
    const tip = new THREE.Mesh(this.dartTipGeo, this.dartTipMat);
    tip.position.z = 0.24;
    dartGroup.add(tip);

    dartGroup.position.copy(origin);
    this._dartAimPt.copy(origin).add(dir);
    dartGroup.lookAt(this._dartAimPt);
    this.scene.add(dartGroup);

    this.activeSyringeDarts.push({
      mesh: dartGroup,
      position: origin.clone(),
      velocity: dir.clone().multiplyScalar(30),
      life: 2.8,
    });
  }

  private spawnGasCloud(targetPos: THREE.Vector3) {
    const cloudGroup = new THREE.Group();
    const pos = targetPos.clone();
    pos.y = 0.08;
    cloudGroup.position.copy(pos);

    const radius = 4.8;
    const dome = new THREE.Mesh(this.gasDomeGeo, this.gasDomeMat);
    cloudGroup.add(dome);

    const ring = new THREE.Mesh(this.gasRingGeo, this.gasRingMat);
    ring.position.y = 0.05;
    cloudGroup.add(ring);

    this.scene.add(cloudGroup);
    this.activeGasClouds.push({
      mesh: cloudGroup,
      position: pos,
      life: 7.5,
      radius,
    });
  }

  private updateBossHazards(delta: number) {
    // 1. Toxic Syringe Darts
    for (let i = this.activeSyringeDarts.length - 1; i >= 0; i--) {
      const d = this.activeSyringeDarts[i];
      d.life -= delta;
      d.position.addScaledVector(d.velocity, delta);
      d.mesh.position.copy(d.position);

      let remove = d.life <= 0 || d.position.y <= 0.05;
      if (!remove && d.position.distanceTo(this.camera.position) < 0.85) {
        this.damagePlayer(6);
        this.slowRemaining = Math.max(this.slowRemaining, 2.2);
        remove = true;
      }
      if (!remove) {
        for (let cIdx = 0; cIdx < this.arena.collisions.length; cIdx++) {
          const c = this.arena.collisions[cIdx];
          if (c.type === 'ramp') continue;
          if (
            d.position.x >= c.box.min.x &&
            d.position.x <= c.box.max.x &&
            d.position.y >= c.box.min.y &&
            d.position.y <= c.box.max.y &&
            d.position.z >= c.box.min.z &&
            d.position.z <= c.box.max.z
          ) {
            remove = true;
            break;
          }
        }
      }

      if (remove) {
        this.scene.remove(d.mesh);
        this.activeSyringeDarts.splice(i, 1);
      }
    }

    // 2. Anesthetic Gas Clouds (area denial DoT)
    let insideGas = false;
    for (let i = this.activeGasClouds.length - 1; i >= 0; i--) {
      const g = this.activeGasClouds[i];
      g.life -= delta;
      g.mesh.rotation.y += delta * 0.6;
      const dist2D = Math.hypot(this.playerPos.x - g.position.x, this.playerPos.z - g.position.z);
      if (dist2D <= g.radius && this.playerPos.y < 3.6) {
        insideGas = true;
        this.damagePlayer(3.5 * delta);
        this.slowRemaining = Math.max(this.slowRemaining, 0.5);
      }
      if (g.life <= 0) {
        this.scene.remove(g.mesh);
        this.activeGasClouds.splice(i, 1);
      }
    }
    this.inGasHazard = insideGas;
  }

  private updateEnemies(delta: number) {
    if (this.boss) {
      this.boss.update(
        delta,
        this.playerPos,
        this.arena.collisions,
        this.arena.obstacleMeshes,
        {
          onFireSyringeDart: (origin, dir) => this.spawnSyringeDart(origin, dir),
          onSpawnGasCloud: (pos) => this.spawnGasCloud(pos),
          onScalpelStrike: (dmg) => this.damagePlayer(dmg),
        }
      );
    }

    if (this.waveIntermissionTimer > 0) {
      this.waveIntermissionTimer = Math.max(0, this.waveIntermissionTimer - delta);
      if (this.waveIntermissionTimer <= 0) {
        this.startNewWave(this.state.wave + 1);
      }
      return;
    }

    for (let i = 0; i < this.enemies.length; i++) {
      const bot = this.enemies[i];
      bot.update(
        delta,
        this.playerPos,
        this.arena.patrolNodes,
        this.arena.collisions,
        this.arena.obstacleMeshes,
        this.camera,
        (from, to, dmg) => {
          this.particles.addTracer(from, to, 0xff1e42);
          const dist = to.distanceTo(this.camera.position);
          if (dist < 0.72) {
            this.damagePlayer(dmg);
          }
        }
      );
    }
  }

  private updateHUDState(delta: number) {
    this.state.survivalTimeSec += delta;
    if (this.state.damageVignette > 0) {
      this.state.damageVignette = Math.max(0, this.state.damageVignette - delta * 1.6);
    }
    if (this.state.flashbangGlare > 0) {
      this.state.flashbangGlare = Math.max(0, this.state.flashbangGlare - delta * 1.4);
    }
    if (this.bossBannerTimer > 0) {
      this.bossBannerTimer = Math.max(0, this.bossBannerTimer - delta);
      if (this.bossBannerTimer <= 0) {
        this.state.bossBanner = null;
      }
    }
    if (this.vampireHealTimer > 0) {
      this.vampireHealTimer = Math.max(0, this.vampireHealTimer - delta);
      if (this.vampireHealTimer <= 0) {
        this.state.vampireHealEvent = null;
      }
    }

    this.state.prepPhaseRemaining = this.waveIntermissionTimer;
    this.state.slowRemaining = this.slowRemaining;
    this.state.inGasHazard = this.inGasHazard;
    if (this.boss && !this.boss.isDead) {
      this.state.bossState = {
        name: this.boss.displayName,
        health: this.boss.health,
        maxHealth: this.boss.maxHealth,
        attackLabel: this.boss.attackLabel,
        active: true,
      };
    } else if (this.state.bossState) {
      this.state.bossState = null;
    }

    const speed = Math.hypot(this.playerVel.x, this.playerVel.z);
    let spread = this.isCrouching ? 0.04 : 0.1;
    if (this.isAiming) spread = 0.02;
    else if (speed > 6.2) spread = 0.38;
    else if (speed > 0.5) spread = this.isCrouching ? 0.12 : 0.22;
    if (!this.isGrounded) spread += 0.18;
    if (this.recoilPitch > 0.015) spread += Math.min(0.32, this.recoilPitch * 2.2);
    this.state.isCrouching = this.isCrouching;
    this.state.crosshairSpread = THREE.MathUtils.damp(this.state.crosshairSpread, spread, 14, delta);

    // Throttle Radar geometry/position snapshots (~20 Hz)
    this.radarEmitAccum += delta;
    if (this.radarEmitAccum >= 0.05) {
      this.radarEmitAccum = 0;
      this.camera.getWorldDirection(this._camDir);
      const playerAngle = Math.atan2(this._camDir.x, this._camDir.z);

      const radarEnemies: { x: number; z: number; isDead: boolean; isBoss?: boolean }[] = [];
      for (let i = 0; i < this.enemies.length; i++) {
        const b = this.enemies[i];
        radarEnemies.push({
          x: b.position.x,
          z: b.position.z,
          isDead: b.isDead,
        });
      }
      if (this.boss && !this.boss.isDead) {
        radarEnemies.push({
          x: this.boss.position.x,
          z: this.boss.position.z,
          isDead: false,
          isBoss: true,
        });
      }

      this.state.radarData = {
        playerX: this.playerPos.x,
        playerZ: this.playerPos.z,
        playerAngle,
        enemies: radarEnemies,
        rects: this.arena.radarRects,
      };
    }

    // Immediate emission on discrete HUD state transitions; throttle continuous telemetry to ~24 Hz
    const discreteKey = `${this.state.wave}|${this.state.enemiesRemaining}|${this.state.fps}|${this.state.bossState ? Math.round(this.state.bossState.health) + ':' + this.state.bossState.attackLabel : 'none'}|${this.state.bossBanner ? this.state.bossBanner.title : ''}|${this.state.vampireHealEvent ? this.state.vampireHealEvent.id : 0}|${this.inGasHazard}|${this.isCrouching}|${this.slowRemaining > 0}|${Math.ceil(this.waveIntermissionTimer)}`;
    this.hudEmitAccum += delta;
    if (discreteKey !== this.lastDiscreteHudKey || this.hudEmitAccum >= 0.042) {
      this.lastDiscreteHudKey = discreteKey;
      this.hudEmitAccum = 0;
      this.emitState();
    }
  }

  private emitState() {
    this.onStateChange({ ...this.state });
  }

  public dispose() {
    this.disposed = true;
    this.clearPointerLockNoticeTimer();
    cancelAnimationFrame(this.animFrameId);
    if (this.softGlTimerId !== null) {
      window.clearTimeout(this.softGlTimerId);
      this.softGlTimerId = null;
    }
    soundSystem.stopLobbyAmbient();
    soundSystem.stopBossMusic();
    soundSystem.stopCutsceneSiren();
    this.bossCutscene.dispose();
    document.removeEventListener('pointerlockerror', this.onPointerLockError, true);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('webglcontextlost', this.onContextLost);
    canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    canvas.removeEventListener('pointerdown', this.onLobbyPointerDown);
    window.removeEventListener('pointermove', this.onLobbyPointerMove);
    window.removeEventListener('pointerup', this.onLobbyPointerUp);
    canvas.removeEventListener('wheel', this.onLobbyWheel);
    window.removeEventListener('wheel', this.onGameWheel);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('contextmenu', this.onContextMenu);

    this.activeGrenades.forEach((g) => this.scene.remove(g.mesh));
    this.clearBossHazards();
    this.dartBodyGeo.dispose();
    this.dartTipGeo.dispose();
    this.dartBodyMat.dispose();
    this.dartTipMat.dispose();
    this.gasDomeGeo.dispose();
    this.gasRingGeo.dispose();
    this.gasDomeMat.dispose();
    this.gasRingMat.dispose();
    this.scenePmremTex?.dispose();
    this.controls.removeEventListener('lock', this.onControlsLock);
    this.controls.removeEventListener('unlock', this.onControlsUnlock);
    this.controls.dispose();
    this.particles.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
