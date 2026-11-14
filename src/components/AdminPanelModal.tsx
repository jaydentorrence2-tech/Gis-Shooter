/**
 * Secret Admin Panel (Developer Console) & PIN Authentication Gate
 * - Triggered via Shift+F12, typing "gisadmin", or discreet corner developer button
 * - Default configurable ADMIN_PIN = '2026'
 * - Exposes Wave/Boss Controller, Player Cheats (God Mode, Infinite Ammo, Speed/Jump, Max XP),
 *   and Leaderboard Ban / Delete / Add Custom Score moderation.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Lock,
  ShieldAlert,
  Skull,
  SkipForward,
  Sparkles,
  Terminal,
  Trash2,
  Unlock,
  UserPlus,
  X,
  Zap,
  RotateCcw,
} from 'lucide-react';
import type { AdminCheatsState, GameState, PlayerProfileData } from '../game/GameEngine';
import {
  addOrUpdateCustomScore,
  banOrRemoveLeaderboardEntry,
  clearAllModerationFilters,
  getMergedLeaderboard,
  LeaderboardTab,
  loadBannedCallsigns,
  unbanCallsign,
} from '../game/leaderboard';

export const ADMIN_PIN = '2026';

type AdminTab = 'wave' | 'cheats' | 'leaderboard';

interface AdminPanelModalProps {
  isAuthenticated: boolean;
  onAuthenticate: () => void;
  onLockConsole: () => void;
  onClose: () => void;
  gameState: GameState | null;
  profile: PlayerProfileData;
  onSkipWave: () => void;
  onSummonBoss: () => void;
  onKillAllHostiles: () => number;
  onUpdateCheats: (updates: Partial<AdminCheatsState>) => void;
  onGrantMaxXp: () => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isAuthenticated,
  onAuthenticate,
  onLockConsole,
  onClose,
  gameState,
  profile,
  onSkipWave,
  onSummonBoss,
  onKillAllHostiles,
  onUpdateCheats,
  onGrantMaxXp,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('wave');
  const [statusNotice, setStatusNotice] = useState('');

  // Leaderboard moderation state
  const [boardTab, setBoardTab] = useState<LeaderboardTab>('global');
  const [searchQuery, setSearchQuery] = useState('');
  const [boardRevision, setBoardRevision] = useState(0);

  // Custom Score Form
  const [customCallsign, setCustomCallsign] = useState(profile.callsign || 'SPECTRE-01');
  const [customScore, setCustomScore] = useState('25000');
  const [customWave, setCustomWave] = useState('10');
  const [customKills, setCustomKills] = useState('64');
  const [customAcc, setCustomAcc] = useState('78');

  const notify = (msg: string) => {
    setStatusNotice(msg);
  };

  useEffect(() => {
    if (!statusNotice) return;
    const t = setTimeout(() => setStatusNotice(''), 3200);
    return () => clearTimeout(t);
  }, [statusNotice]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === ADMIN_PIN) {
      setPinError('');
      setPinInput('');
      onAuthenticate();
    } else {
      setPinError('Invalid Admin PIN. Access denied.');
      setPinInput('');
    }
  };

  const board = useMemo(
    () => getMergedLeaderboard(boardTab, profile.callsign),
    [boardTab, profile.callsign, boardRevision]
  );

  const bannedList = useMemo(() => loadBannedCallsigns(), [boardRevision]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    if (!q) return board.rows.slice(0, 45);
    return board.rows.filter((r) => r.callsign.toUpperCase().includes(q)).slice(0, 45);
  }, [board.rows, searchQuery]);

  const cheats = gameState?.adminCheats || {
    godMode: false,
    infiniteAmmo: false,
    speedMultiplier: 1.0,
    jumpMultiplier: 1.0,
  };

  // --- Phase 1: PIN Authentication Gate ---
  if (!isAuthenticated) {
    return (
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 p-4 select-none"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Admin PIN Verification"
          onClick={(e) => e.stopPropagation()}
          className="max-w-sm w-full bg-[#0F1623] border border-amber-500/45 rounded-2xl p-6 shadow-2xl text-slate-100"
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-mono-tech text-amber-400 uppercase tracking-wider">
                  Restricted Console
                </div>
                <h2 className="text-lg font-display font-bold text-white">
                  Admin PIN Required
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close PIN prompt"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Enter developer PIN to unlock Wave/Boss testing, Combat Cheats, and Leaderboard moderation.
          </p>

          <form onSubmit={handlePinSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="admin-pin-input"
                className="block text-xs font-mono-tech text-slate-300 mb-1.5"
              >
                Developer PIN
              </label>
              <input
                id="admin-pin-input"
                type="password"
                autoFocus
                inputMode="numeric"
                maxLength={12}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  if (pinError) setPinError('');
                }}
                placeholder="Enter Developer PIN"
                className="w-full px-4 py-2.5 rounded-xl bg-[#0C1017] border border-slate-700 text-amber-300 font-mono-tech font-bold tracking-widest focus:outline-none focus:border-amber-400 tabular-nums"
              />
              {pinError && (
                <div className="mt-2 text-xs font-mono-tech text-rose-400 font-semibold">
                  {pinError}
                </div>
              )}
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition cursor-pointer whitespace-nowrap shrink-0"
              >
                Unlock Console
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // --- Phase 2: Unlocked Developer Console ---
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 p-4 md:p-6 select-none"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Secret Admin Panel"
        onClick={(e) => e.stopPropagation()}
        className="max-w-4xl w-full max-h-[88vh] flex flex-col bg-[#0F1623] border border-amber-500/45 rounded-2xl shadow-2xl text-slate-100 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
              <Terminal className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-display font-bold text-white leading-tight truncate">
                Developer Console
              </h2>
              <p className="text-xs font-mono-tech text-slate-400 truncate tabular-nums">
                Operative: {profile.callsign} · Lvl {profile.level} ·{' '}
                {gameState?.isInMenu
                  ? 'Hangar Lobby'
                  : `Wave ${gameState?.wave ?? 1} (${gameState?.enemiesRemaining ?? 0} Hostiles)`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onLockConsole}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <Lock className="w-3.5 h-3.5" />
              Lock Console
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Developer Console"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs + Status Toast */}
        <div className="px-6 py-3 border-b border-slate-800 bg-[#0B101B] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('wave')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'wave'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <SkipForward className="w-3.5 h-3.5" />
              Wave &amp; Boss
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cheats')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'cheats'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Player Cheats
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('leaderboard')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'leaderboard'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Leaderboard &amp; Ban
            </button>
          </div>

          {statusNotice && (
            <div className="text-xs font-mono-tech font-semibold text-emerald-400">
              {statusNotice}
            </div>
          )}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'wave' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onSkipWave();
                    notify(
                      gameState?.isInMenu
                        ? 'Deployed directly into Wave 2 (paused).'
                        : `Skipped to Wave ${(gameState?.wave || 1) + 1}.`
                    );
                  }}
                  className="p-4 rounded-xl bg-[#0C1017] hover:bg-slate-800/80 border border-slate-700/80 text-left transition cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-display font-bold text-sm text-white">
                      Skip Wave
                    </span>
                    <SkipForward className="w-4 h-4 text-cyan-400 shrink-0" />
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Immediately clear the current wave or prep phase and deploy into the next wave.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSummonBoss();
                    notify('Wave 10 Boss: The Specialist Anestesi summoned.');
                  }}
                  className="p-4 rounded-xl bg-[#0C1017] hover:bg-rose-950/40 border border-rose-500/45 text-left transition cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-display font-bold text-sm text-rose-300">
                      Summon Boss (Wave 10)
                    </span>
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Launch directly into Wave 10 to test The Specialist Anestesi encounter anytime.
                  </p>
                </button>

                <button
                  type="button"
                  disabled={!gameState || gameState.isInMenu || gameState.isDead}
                  onClick={() => {
                    const count = onKillAllHostiles();
                    notify(
                      count > 0
                        ? `Eliminated ${count} active hostile(s).`
                        : 'No active hostiles on map.'
                    );
                  }}
                  className="p-4 rounded-xl bg-[#0C1017] hover:bg-amber-950/35 disabled:opacity-45 disabled:cursor-not-allowed border border-amber-500/40 text-left transition cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-display font-bold text-sm text-amber-300">
                      Kill All Hostiles
                    </span>
                    <Skull className="w-4 h-4 text-amber-400 shrink-0" />
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Instantly eliminate all active bots and Boss units currently spawned in the arena.
                  </p>
                </button>
              </div>

              {/* Telemetry Snapshot */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800">
                <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3">
                  <div className="text-[11px] text-slate-400">Current Wave</div>
                  <div className="text-lg font-mono-tech font-bold text-cyan-400 mt-0.5 tabular-nums">
                    {gameState?.isInMenu ? 'LOBBY' : `W${gameState?.wave ?? 1}`}
                  </div>
                </div>
                <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3">
                  <div className="text-[11px] text-slate-400">Hostiles Active</div>
                  <div className="text-lg font-mono-tech font-bold text-white mt-0.5 tabular-nums">
                    {gameState?.enemiesRemaining ?? 0}
                  </div>
                </div>
                <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3">
                  <div className="text-[11px] text-slate-400">Boss Status</div>
                  <div className="text-lg font-mono-tech font-bold text-rose-400 mt-0.5 tabular-nums">
                    {gameState?.bossState?.active ? 'ACTIVE' : 'STANDBY'}
                  </div>
                </div>
                <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3">
                  <div className="text-[11px] text-slate-400">Match Score</div>
                  <div className="text-lg font-mono-tech font-bold text-emerald-400 mt-0.5 tabular-nums">
                    {(gameState?.score ?? 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cheats' && (
            <div className="space-y-5">
              {/* Toggle Cheats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const next = !cheats.godMode;
                    onUpdateCheats({ godMode: next });
                    notify(`God Mode ${next ? 'ENABLED' : 'DISABLED'}.`);
                  }}
                  className={`p-4 rounded-xl border text-left transition cursor-pointer flex items-center justify-between gap-3 ${
                    cheats.godMode
                      ? 'bg-emerald-950/45 border-emerald-500/60 text-white'
                      : 'bg-[#0C1017] border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-display font-bold text-sm text-white">
                      God Mode (Invincible)
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Zero HP &amp; Armor damage from bots, darts, and hazards.
                    </div>
                  </div>
                  <span
                    className={`font-mono-tech text-xs font-bold shrink-0 ${
                      cheats.godMode ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {cheats.godMode ? 'ON' : 'OFF'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = !cheats.infiniteAmmo;
                    onUpdateCheats({ infiniteAmmo: next });
                    notify(`Infinite Ammo & No Reload ${next ? 'ENABLED' : 'DISABLED'}.`);
                  }}
                  className={`p-4 rounded-xl border text-left transition cursor-pointer flex items-center justify-between gap-3 ${
                    cheats.infiniteAmmo
                      ? 'bg-cyan-950/45 border-cyan-500/60 text-white'
                      : 'bg-[#0C1017] border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-display font-bold text-sm text-white">
                      Infinite Ammo &amp; No Reload
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Bottomless magazines, grenades, and medkits with zero reload delay.
                    </div>
                  </div>
                  <span
                    className={`font-mono-tech text-xs font-bold shrink-0 ${
                      cheats.infiniteAmmo ? 'text-cyan-400' : 'text-slate-500'
                    }`}
                  >
                    {cheats.infiniteAmmo ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>

              {/* Speed & Jump Multipliers */}
              <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-display font-semibold text-white">
                    Speed &amp; Jump Multiplier
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateCheats({ speedMultiplier: 1.0, jumpMultiplier: 1.0 });
                      notify('Speed & Jump reset to 1.0x.');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset 1.0x
                  </button>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono-tech mb-1.5">
                    <span className="text-slate-300">Movement Speed Multiplier</span>
                    <span className="font-bold text-amber-400 tabular-nums">
                      {cheats.speedMultiplier.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="3.0"
                    step="0.1"
                    value={cheats.speedMultiplier}
                    onChange={(e) =>
                      onUpdateCheats({ speedMultiplier: parseFloat(e.target.value) })
                    }
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono-tech mb-1.5">
                    <span className="text-slate-300">Jump Height Multiplier</span>
                    <span className="font-bold text-cyan-400 tabular-nums">
                      {cheats.jumpMultiplier.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="2.5"
                    step="0.1"
                    value={cheats.jumpMultiplier}
                    onChange={(e) =>
                      onUpdateCheats({ jumpMultiplier: parseFloat(e.target.value) })
                    }
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>
              </div>

              {/* Max XP & Unlock All */}
              <div className="bg-[#0C1017] border border-amber-500/35 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="font-display font-bold text-sm text-white">
                    Max XP &amp; Unlock All
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 tabular-nums">
                    Current: Level {profile.level} ({profile.xp.toLocaleString()} XP) ·{' '}
                    {profile.allUnlocked ? 'All Arsenal & Achievements Unlocked' : 'Standard Progression'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onGrantMaxXp();
                    notify('+50,000 XP granted & all arsenal presets unlocked.');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Sparkles className="w-4 h-4" />
                  Max XP &amp; Unlock All (+50,000 XP)
                </button>
              </div>
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div className="space-y-5">
              {/* Add Custom Score Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const entry = addOrUpdateCustomScore({
                    callsign: customCallsign,
                    score: Number(customScore) || 0,
                    wave: Number(customWave) || 1,
                    kills: Number(customKills) || 0,
                    accuracy: Number(customAcc) || 0,
                  });
                  setBoardRevision((r) => r + 1);
                  notify(`Saved custom score for ${entry.callsign} (${entry.score.toLocaleString()}).`);
                }}
                className="bg-[#0C1017] border border-slate-800 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center gap-2 text-sm font-display font-semibold text-white">
                  <UserPlus className="w-4 h-4 text-cyan-400 shrink-0" />
                  Add / Edit Custom Score
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-7 gap-2.5">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-mono-tech text-slate-400 mb-1">
                      Callsign
                    </label>
                    <input
                      type="text"
                      maxLength={16}
                      value={customCallsign}
                      onChange={(e) => setCustomCallsign(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono-tech text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono-tech text-slate-400 mb-1">
                      Score
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={customScore}
                      onChange={(e) => setCustomScore(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono-tech text-amber-300 tabular-nums focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono-tech text-slate-400 mb-1">
                      Wave
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={customWave}
                      onChange={(e) => setCustomWave(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono-tech text-white tabular-nums focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono-tech text-slate-400 mb-1">
                      Kills
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={customKills}
                      onChange={(e) => setCustomKills(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono-tech text-white tabular-nums focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono-tech text-slate-400 mb-1">
                      Acc %
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={customAcc}
                      onChange={(e) => setCustomAcc(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono-tech text-emerald-300 tabular-nums focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Save Score
                    </button>
                  </div>
                </div>
              </form>

              {/* Filter & Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800">
                  {(['global', 'weekly', 'personal'] as LeaderboardTab[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setBoardTab(t)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition cursor-pointer whitespace-nowrap shrink-0 ${
                        boardTab === t
                          ? 'bg-cyan-500 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search operator callsign..."
                  className="px-3 py-1.5 rounded-lg bg-[#0C1017] border border-slate-700 text-xs font-mono-tech text-slate-200 focus:outline-none focus:border-cyan-400 w-56"
                />
              </div>

              {/* Recorded Entries Table */}
              <div className="bg-[#0C1017] border border-slate-800 rounded-xl overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-[#0C1017] border-b border-slate-800 text-[11px] font-mono-tech uppercase text-slate-400">
                      <tr>
                        <th className="py-2 px-3">Rank</th>
                        <th className="py-2 px-3">Callsign</th>
                        <th className="py-2 px-3 text-right">Wave</th>
                        <th className="py-2 px-3 text-right">Score</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 text-xs">
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500 font-mono-tech">
                            No matching leaderboard entries.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-800/40">
                            <td className="py-2 px-3 font-mono-tech text-slate-400 tabular-nums">
                              #{row.rank}
                            </td>
                            <td className="py-2 px-3 font-mono-tech font-semibold text-white">
                              {row.flag} {row.callsign}
                              {row.isPlayer && (
                                <span className="ml-2 text-[10px] text-cyan-400">LOCAL</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-mono-tech text-slate-300 tabular-nums">
                              W{row.wave}
                            </td>
                            <td className="py-2 px-3 text-right font-mono-tech font-bold text-amber-400 tabular-nums">
                              {row.score.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  banOrRemoveLeaderboardEntry(row.id, row.callsign, true);
                                  setBoardRevision((r) => r + 1);
                                  notify(`Banned & removed ${row.callsign}.`);
                                }}
                                className="px-2.5 py-1 rounded-md bg-rose-950/70 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 text-[11px] font-semibold inline-flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0"
                              >
                                <Trash2 className="w-3 h-3" />
                                Ban / Remove
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Banned Callsigns Restore List */}
              {bannedList.length > 0 && (
                <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <span className="text-xs font-mono-tech font-bold text-rose-400 uppercase">
                      Banned Callsigns ({bannedList.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        clearAllModerationFilters();
                        setBoardRevision((r) => r + 1);
                        notify('Cleared all leaderboard bans & deletions.');
                      }}
                      className="text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
                    >
                      Restore All
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {bannedList.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          unbanCallsign(name);
                          setBoardRevision((r) => r + 1);
                          notify(`Unbanned ${name}.`);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono-tech text-slate-200 inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <span>{name}</span>
                        <Unlock className="w-3 h-3 text-emerald-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
