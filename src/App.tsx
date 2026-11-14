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
import { soundSystem } from './audio/SoundSystem';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [profile, setProfile] = useState<PlayerProfileData>(DEFAULT_PROFILE);
  const [activeMenuModal, setActiveMenuModal] = useState<
    'none' | 'armory' | 'profile' | 'settings' | 'crosshair' | 'leaderboard'
  >('none');
  const [showPostGameLeaderboard, setShowPostGameLeaderboard] = useState(false);

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

    return () => {
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
    };
    engineRef.current?.setLobbyFocus(focusMap[activeMenuModal]);
  }, [activeMenuModal]);

  const handleStartGame = () => {
    soundSystem.resume();
    setActiveMenuModal('none');
    setShowPostGameLeaderboard(false);
    engineRef.current?.startGame();
  };

  const handleResumeGame = () => {
    soundSystem.resume();
    engineRef.current?.resumeGame();
  };

  const handleRestartGame = () => {
    soundSystem.resume();
    setShowPostGameLeaderboard(false);
    engineRef.current?.startGame();
  };

  const handleReturnToMenu = () => {
    setActiveMenuModal('none');
    setShowPostGameLeaderboard(false);
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
        />
      )}

      {/* Non-Occluding Side Drawers with Live Camera Zoom & Operator Previews */}
      {isInMenu && activeMenuModal === 'armory' && (
        <ArmoryModal
          preferredSlot={profile.preferredSlot}
          onPreviewSlot={(slotIndex) => engineRef.current?.previewLobbyWeapon(slotIndex)}
          onSelectSlot={(slotIndex) => handleUpdateProfile({ preferredSlot: slotIndex })}
          onClose={() => setActiveMenuModal('none')}
        />
      )}

      {isInMenu && activeMenuModal === 'profile' && (
        <ProfileModal
          profile={profile}
          onPreviewAccent={(hex) => engineRef.current?.previewLobbyAccent(hex)}
          onSave={handleUpdateProfile}
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
          onClose={() => setActiveMenuModal('none')}
        />
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
          />
        )}

      {/* Mission Debrief / Game Over Modal */}
      {!isInMenu && gameState && gameState.isDead && (
        <GameOverModal
          state={gameState}
          profile={profile}
          onSubmitScore={() => engineRef.current?.submitMatchScore()}
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
          onClose={() => setShowPostGameLeaderboard(false)}
        />
      )}
    </div>
  );
}
