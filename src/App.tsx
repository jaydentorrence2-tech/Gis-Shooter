/**
 * GIS Shooter: Tactical Edition — Main Application Shell
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  GameEngine,
  GameState,
  PlayerProfileData,
  DEFAULT_PROFILE,
} from './game/GameEngine';
import { LobbyFocusMode } from './game/lobby';
import { loadLocalScores, type LeaderboardEntry } from './game/leaderboard';
import { HUD } from './components/HUD';
import { MainMenu } from './components/MainMenu';
import { ArmoryModal } from './components/ArmoryModal';
import { ProfileModal } from './components/ProfileModal';
import { SettingsModal } from './components/SettingsModal';
import { CrosshairEditorModal } from './components/CrosshairEditorModal';
import { InventoryModal } from './components/InventoryModal';
import { PauseModal } from './components/PauseModal';
import { GameOverModal } from './components/GameOverModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { PatchNotesModal } from './components/PatchNotesModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { soundSystem } from './audio/SoundSystem';
import {
  auth,
  onAuthStateChanged,
  signInWithGoogleAccount,
  signOutGoogleAccount,
  type User,
} from './firebase/client';
import {
  type CloudUpsertResult,
  deleteCloudLeaderboardEntry,
  fetchOperativeAccount,
  normalizeCallsignKey,
  type OperativeAccountDoc,
  subscribeCloudLeaderboard,
  upsertCloudPersonalBest,
} from './firebase/cloudLeaderboard';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const lastSubmittedEntryRef = useRef<LeaderboardEntry | null>(null);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [profile, setProfile] = useState<PlayerProfileData>(DEFAULT_PROFILE);
  const [activeMenuModal, setActiveMenuModal] = useState<
    'none' | 'armory' | 'profile' | 'settings' | 'crosshair' | 'leaderboard' | 'patchnotes'
  >('none');
  const [showPostGameLeaderboard, setShowPostGameLeaderboard] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  // Cloud Firebase Auth & Real-Time Leaderboard State
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [operativeAccount, setOperativeAccount] = useState<OperativeAccountDoc | null>(null);
  const [cloudEntries, setCloudEntries] = useState<LeaderboardEntry[]>([]);
  const [cloudStatus, setCloudStatus] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const [cloudSyncState, setCloudSyncState] = useState<{
    status: 'idle' | 'syncing' | CloudUpsertResult['status'];
    message?: string;
  }>({ status: 'idle' });
  const autoSyncedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setCloudUser(user);
      if (user) {
        try {
          const acc = await fetchOperativeAccount(user.uid);
          setOperativeAccount(acc);
        } catch {
          setOperativeAccount(null);
        }
      } else {
        setOperativeAccount(null);
      }
    });

    const unsubBoard = subscribeCloudLeaderboard(
      (entries) => setCloudEntries(entries),
      (status) => setCloudStatus(status)
    );

    return () => {
      unsubAuth();
      unsubBoard();
    };
  }, []);

  // Automatically promote local-only Personal Best for active callsign to Global Cloud once signed in
  useEffect(() => {
    if (!cloudUser || cloudStatus !== 'live') return;
    const activeCs = (profile.callsign || 'OPERATIVE').trim().toUpperCase();
    const activeKey = normalizeCallsignKey(activeCs);
    const localBest = loadLocalScores()
      .filter((e) => e.callsign.trim().toUpperCase() === activeCs)
      .sort((a, b) => b.score - a.score)[0];

    const bestScore = Math.max(localBest?.score ?? 0, profile.highScore || 0);
    if (bestScore <= 0) return;

    const existingCloud = cloudEntries.find(
      (c) => normalizeCallsignKey(c.callsign) === activeKey
    );
    if (existingCloud) {
      if (existingCloud.ownerUid && existingCloud.ownerUid !== cloudUser.uid) return;
      if (existingCloud.score >= bestScore) return;
    }

    const syncTag = `${cloudUser.uid}:${activeKey}:${bestScore}`;
    if (autoSyncedKeysRef.current.has(syncTag)) return;
    autoSyncedKeysRef.current.add(syncTag);

    const acc =
      localBest?.accuracy ??
      (profile.totalShots > 0
        ? Math.min(100, Math.round((profile.totalHits / profile.totalShots) * 100))
        : 0);

    void upsertCloudPersonalBest(cloudUser, {
      callsign: activeCs,
      countryCode: localBest?.countryCode || 'ID',
      flag: localBest?.flag || '🇮🇩',
      score: bestScore,
      wave: localBest?.wave || profile.highestWave || 1,
      kills: localBest?.kills ?? profile.totalKills,
      headshots: localBest?.headshots ?? profile.totalHeadshots,
      accuracy: acc,
      survivalSec: localBest?.survivalSec ?? Math.max(60, (profile.highestWave || 1) * 55),
      xpEarned: localBest?.xpEarned ?? profile.xp,
      level: localBest?.level ?? profile.level,
      avatarColor: localBest?.avatarColor ?? profile.accentColor,
      favoriteWeapon: localBest?.favoriteWeapon ?? 'AR-X7 Tactical',
      weekKey: localBest?.weekKey,
      hasPin: Boolean(operativeAccount?.pinHash),
    });
  }, [cloudUser, cloudStatus, cloudEntries, profile, operativeAccount]);

  useEffect(() => {
    if (!canvasMountRef.current) return;

    soundSystem.init();

    const engine = new GameEngine(
      canvasMountRef.current,
      (updatedState) => setGameState(updatedState),
      (updatedProfile) => setProfile(updatedProfile)
    );

    engineRef.current = engine;
    setGameState(engine.state);
    setProfile(engine.profile);

    const win = window as unknown as {
      nextWave?: (wave?: number) => void;
      summonBoss?: () => void;
      killAllHostiles?: () => number;
    };
    win.nextWave = (wave?: number) => {
      if (typeof wave === 'number' && Number.isFinite(wave) && wave >= 1) {
        if (engine.state.isInMenu) {
          engine.startGame(Math.floor(wave), false);
        } else if (!engine.state.isDead) {
          engine.startNewWave(Math.floor(wave));
        }
      } else {
        engine.adminSkipWave();
      }
    };
    win.summonBoss = () => engine.adminSummonBossWave();
    win.killAllHostiles = () => engine.adminKillAllHostiles();

    return () => {
      delete win.nextWave;
      delete win.summonBoss;
      delete win.killAllHostiles;
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Sync 3D Lobby Camera Zoom Preset when active drawer changes
  useEffect(() => {
    const focusMap: Record<typeof activeMenuModal, LobbyFocusMode> = {
      none: 'overview',
      armory: 'armory',
      profile: 'profile',
      settings: 'settings',
      crosshair: 'settings',
      leaderboard: 'overview',
      patchnotes: 'overview',
    };
    engineRef.current?.setLobbyFocus(focusMap[activeMenuModal]);
  }, [activeMenuModal]);

  // Global Secret Admin Shortcuts: Shift+F12 (Menu/Pause/In-Game) & "gisadmin" keyword (Menu/Pause)
  useEffect(() => {
    let keywordBuffer = '';
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.shiftKey && e.key === 'F12') {
        e.preventDefault();
        const st = engineRef.current?.state;
        if (st && !st.isInMenu && !st.isPaused && !st.isDead) {
          engineRef.current?.pauseForAdmin();
        }
        setIsAdminOpen((prev) => !prev);
        return;
      }

      if (isTextInput) return;

      const st = engineRef.current?.state;
      const onMenuOrPause = !st || st.isInMenu || st.isPaused;
      if (onMenuOrPause && e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
        keywordBuffer = (keywordBuffer + e.key.toLowerCase()).slice(-8);
        if (keywordBuffer === 'gisadmin') {
          keywordBuffer = '';
          setIsAdminOpen(true);
        }
      } else if (e.key.length === 1) {
        keywordBuffer = '';
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const syncEntryToCloud = async (user: User | null, entry: LeaderboardEntry) => {
    setCloudSyncState({ status: 'syncing', message: 'Syncing to Global Cloud...' });
    const res = await upsertCloudPersonalBest(user, {
      callsign: entry.callsign,
      countryCode: entry.countryCode,
      flag: entry.flag,
      score: entry.score,
      wave: entry.wave,
      kills: entry.kills,
      headshots: entry.headshots,
      accuracy: entry.accuracy,
      survivalSec: entry.survivalSec,
      xpEarned: entry.xpEarned,
      level: entry.level ?? profile.level,
      avatarColor: entry.avatarColor ?? profile.accentColor,
      favoriteWeapon: entry.favoriteWeapon ?? 'AR-X7 Tactical',
      weekKey: entry.weekKey,
      hasPin: Boolean(operativeAccount?.pinHash),
    });
    setCloudSyncState({ status: res.status, message: res.message });
  };

  const handleSubmitMatchScore = () => {
    const result = engineRef.current?.submitMatchScore();
    if (!result) return;
    lastSubmittedEntryRef.current = result.entry;
    void syncEntryToCloud(cloudUser, result.entry);
  };

  const handleSignInAndSync = async () => {
    const signedInUser = await signInWithGoogleAccount();
    setCloudUser(signedInUser);
    if (lastSubmittedEntryRef.current) {
      await syncEntryToCloud(signedInUser, lastSubmittedEntryRef.current);
    }
  };

  const handleStartGame = () => {
    soundSystem.resume();
    setActiveMenuModal('none');
    setShowPostGameLeaderboard(false);
    setCloudSyncState({ status: 'idle' });
    lastSubmittedEntryRef.current = null;
    engineRef.current?.startGame();
  };

  const handleResumeGame = () => {
    soundSystem.resume();
    engineRef.current?.resumeGame();
  };

  const handleRestartGame = () => {
    soundSystem.resume();
    setShowPostGameLeaderboard(false);
    setCloudSyncState({ status: 'idle' });
    lastSubmittedEntryRef.current = null;
    engineRef.current?.startGame();
  };

  const handleReturnToMenu = () => {
    setActiveMenuModal('none');
    setShowPostGameLeaderboard(false);
    setCloudSyncState({ status: 'idle' });
    lastSubmittedEntryRef.current = null;
    engineRef.current?.enterMenuMode();
  };

  const handleUpdateProfile = (updates: Partial<PlayerProfileData>) => {
    engineRef.current?.saveProfile(updates);
  };

  const isInMenu = !gameState || gameState.isInMenu;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0C1017] select-none">
      {/* Isolated WebGL Viewport Container */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Live 3D Tactical Hangar Main Menu (Hidden cleanly while modal/drawer is active) */}
      {isInMenu && activeMenuModal === 'none' && (
        <MainMenu
          profile={profile}
          onPlay={handleStartGame}
          onOpenArmory={() => setActiveMenuModal('armory')}
          onOpenProfile={() => setActiveMenuModal('profile')}
          onOpenSettings={() => setActiveMenuModal('settings')}
          onOpenCrosshair={() => setActiveMenuModal('crosshair')}
          onOpenLeaderboard={() => setActiveMenuModal('leaderboard')}
          onOpenPatchNotes={() => setActiveMenuModal('patchnotes')}
          onOpenAdmin={() => setIsAdminOpen(true)}
        />
      )}

      {/* Non-Occluding Side Drawers with Live Camera Zoom & Operator Previews */}
      {isInMenu && activeMenuModal === 'armory' && (
        <ArmoryModal
          preferredSlot={profile.preferredSlot}
          slot4Choice={profile.slot4Choice || 'desert_python'}
          onPreviewSlot={(slotIndex, overrideSlot4) =>
            engineRef.current?.previewLobbyWeapon(slotIndex, overrideSlot4)
          }
          onSelectSlot={(slotIndex) => handleUpdateProfile({ preferredSlot: slotIndex })}
          onChangeSlot4={(choice) => handleUpdateProfile({ slot4Choice: choice })}
          onClose={() => setActiveMenuModal('none')}
        />
      )}

      {isInMenu && activeMenuModal === 'profile' && (
        <ProfileModal
          profile={profile}
          cloudUser={cloudUser}
          operativeAccount={operativeAccount}
          onSignInGoogle={async () => {
            await signInWithGoogleAccount();
          }}
          onSignOutGoogle={signOutGoogleAccount}
          onPreviewAccent={(hex) => engineRef.current?.previewLobbyAccent(hex)}
          onSave={handleUpdateProfile}
          onCloudAccountSaved={(acc) => setOperativeAccount(acc)}
          onClose={() => setActiveMenuModal('none')}
        />
      )}

      {isInMenu && activeMenuModal === 'settings' && (
        <SettingsModal
          profile={profile}
          onUpdate={handleUpdateProfile}
          onClose={() => setActiveMenuModal('none')}
        />
      )}

      {isInMenu && activeMenuModal === 'crosshair' && (
        <CrosshairEditorModal
          profile={profile}
          onUpdate={handleUpdateProfile}
          onClose={() => setActiveMenuModal('none')}
        />
      )}

      {isInMenu && activeMenuModal === 'leaderboard' && (
        <LeaderboardModal
          activeCallsign={profile.callsign}
          profile={profile}
          cloudEntries={cloudEntries}
          cloudStatus={cloudStatus}
          cloudUser={cloudUser}
          onSignInGoogle={async () => {
            await signInWithGoogleAccount();
          }}
          onClose={() => setActiveMenuModal('none')}
        />
      )}

      {isInMenu && activeMenuModal === 'patchnotes' && (
        <PatchNotesModal onClose={() => setActiveMenuModal('none')} />
      )}

      {/* In-Game Tactical HUD */}
      {!isInMenu && gameState && <HUD state={gameState} profile={profile} />}

      {/* Tactical Inventory Modal (Tab / I) */}
      {!isInMenu && gameState && gameState.isInventoryOpen && !gameState.isDead && (
        <InventoryModal
          state={gameState}
          onEquip={(idx) => engineRef.current?.equipWeapon(idx)}
          onUseMedkit={() => engineRef.current?.useNanoMedkit()}
          onClose={() => engineRef.current?.toggleInventory()}
        />
      )}

      {/* Tactical Pause Modal (ESC) */}
      {!isInMenu &&
        gameState &&
        gameState.isPaused &&
        !gameState.isInventoryOpen &&
        !gameState.isDead && (
          <PauseModal
            profile={profile}
            onResume={handleResumeGame}
            onRestart={handleRestartGame}
            onReturnToMenu={handleReturnToMenu}
            onUpdateProfile={handleUpdateProfile}
            onOpenAdmin={() => setIsAdminOpen(true)}
            pointerLockNotice={gameState.pointerLockNotice}
          />
        )}

      {/* Mission Debrief / Game Over Modal */}
      {!isInMenu && gameState && gameState.isDead && (
        <GameOverModal
          state={gameState}
          profile={profile}
          cloudUser={cloudUser}
          cloudSyncState={cloudSyncState}
          onSubmitScore={handleSubmitMatchScore}
          onSignInAndSync={handleSignInAndSync}
          onOpenLeaderboard={() => setShowPostGameLeaderboard(true)}
          onRestart={handleRestartGame}
          onReturnToMenu={handleReturnToMenu}
        />
      )}

      {/* Post-Match Leaderboard Overlay */}
      {!isInMenu && gameState && gameState.isDead && showPostGameLeaderboard && (
        <LeaderboardModal
          activeCallsign={profile.callsign}
          profile={profile}
          cloudEntries={cloudEntries}
          cloudStatus={cloudStatus}
          cloudUser={cloudUser}
          onSignInGoogle={handleSignInAndSync}
          onClose={() => setShowPostGameLeaderboard(false)}
        />
      )}

      {/* Secret Developer Console / PIN Verification Gate */}
      {isAdminOpen && (
        <AdminPanelModal
          isAuthenticated={isAdminAuthenticated}
          onAuthenticate={() => setIsAdminAuthenticated(true)}
          onLockConsole={() => setIsAdminAuthenticated(false)}
          onClose={() => setIsAdminOpen(false)}
          gameState={gameState}
          profile={profile}
          cloudEntries={cloudEntries}
          cloudUser={cloudUser}
          onCloudAdminSaveScore={async (entry) => {
            await upsertCloudPersonalBest(
              cloudUser,
              {
                callsign: entry.callsign,
                countryCode: entry.countryCode,
                flag: entry.flag,
                score: entry.score,
                wave: entry.wave,
                kills: entry.kills,
                headshots: entry.headshots,
                accuracy: entry.accuracy,
                survivalSec: entry.survivalSec,
                xpEarned: entry.xpEarned,
                level: entry.level ?? 10,
                avatarColor: entry.avatarColor ?? '#f59e0b',
                favoriteWeapon: entry.favoriteWeapon ?? 'AR-X7 Tactical',
                weekKey: entry.weekKey,
                hasPin: false,
              },
              true
            );
          }}
          onCloudAdminDelete={async (id, callsign) => {
            await deleteCloudLeaderboardEntry(id.startsWith('cloud_') ? id : callsign);
          }}
          onSkipWave={() => engineRef.current?.adminSkipWave()}
          onSummonBoss={() => engineRef.current?.adminSummonBossWave()}
          onKillAllHostiles={() => engineRef.current?.adminKillAllHostiles() ?? 0}
          onUpdateCheats={(updates) => engineRef.current?.setAdminCheats(updates)}
          onGrantMaxXp={() => engineRef.current?.adminGrantMaxXpAndUnlockAll()}
        />
      )}
    </div>
  );
}
