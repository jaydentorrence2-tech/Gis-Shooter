/**
 * Game Over & Mission Debrief Modal
 * Displays per-match combat stats (Total Kills, Headshots, Accuracy, Survival Time, XP Earned)
 * and provides explicit Submit Score & Cloud Global Sync actions.
 */

import React, { useState } from 'react';
import { GameState, PlayerProfileData } from '../game/GameEngine';
import { formatSurvivalTime } from '../game/leaderboard';
import { RotateCcw, Home, Skull, Trophy, Upload, CheckCircle2, Cloud, LogIn } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { CloudUpsertResult } from '../firebase/cloudLeaderboard';
import { AuthErrorNotice } from './AuthErrorNotice';

interface GameOverModalProps {
  state: GameState;
  profile: PlayerProfileData;
  cloudUser: User | null;
  cloudSyncState: {
    status: 'idle' | 'syncing' | CloudUpsertResult['status'];
    message?: string;
  };
  onSubmitScore: () => void;
  onSignInAndSync: () => Promise<void>;
  onOpenLeaderboard: () => void;
  onRestart: () => void;
  onReturnToMenu: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  state,
  profile,
  cloudUser,
  cloudSyncState,
  onSubmitScore,
  onSignInAndSync,
  onOpenLeaderboard,
  onRestart,
  onReturnToMenu,
}) => {
  const [syncBusy, setSyncBusy] = useState(false);
  const [authError, setAuthError] = useState<unknown>(null);
  const accuracy =
    state.sessionShots > 0
      ? Math.min(100, Math.round((state.sessionHits / state.sessionShots) * 100))
      : 0;

  const handleSignInSync = async () => {
    setSyncBusy(true);
    setAuthError(null);
    try {
      await onSignInAndSync();
    } catch (err) {
      setAuthError(err);
    } finally {
      setSyncBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/90 p-4 select-none">
      <div className="max-w-lg w-full bg-[#131A26] border border-red-500/40 rounded-2xl p-6 md:p-7 shadow-2xl text-slate-100 text-center">
        <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto mb-3">
          <Skull className="w-6 h-6" />
        </div>

        <h2 className="text-2xl font-display font-bold text-red-400 mb-1">
          Operative Eliminated
        </h2>
        <p className="text-xs font-mono-tech text-slate-400 mb-5">
          {profile.callsign} · Wave {state.wave} · Time {formatSurvivalTime(state.survivalTimeSec)}
        </p>

        {/* Primary Match Score & XP Strip */}
        <div className="grid grid-cols-2 gap-3 mb-3 text-left">
          <div className="bg-[#0C1017] p-3.5 rounded-xl border border-slate-800">
            <div className="text-[11px] text-slate-400">Final Score</div>
            <div className="text-2xl font-mono-tech font-bold text-amber-400 tabular-nums mt-0.5">
              {state.score.toLocaleString()}
            </div>
          </div>

          <div className="bg-[#0C1017] p-3.5 rounded-xl border border-slate-800">
            <div className="text-[11px] text-slate-400">Total XP Earned</div>
            <div className="text-2xl font-mono-tech font-bold text-cyan-400 tabular-nums mt-0.5">
              +{state.sessionXp.toLocaleString()} XP
            </div>
          </div>
        </div>

        {/* Combat Breakdown Grid */}
        <div className="grid grid-cols-3 gap-2.5 mb-5 text-left">
          <div className="bg-[#0C1017] p-3 rounded-xl border border-slate-800">
            <div className="text-[11px] text-slate-400">Total Kills</div>
            <div className="text-lg font-mono-tech font-bold text-white tabular-nums mt-0.5">
              {state.sessionKills}
            </div>
          </div>

          <div className="bg-[#0C1017] p-3 rounded-xl border border-slate-800">
            <div className="text-[11px] text-slate-400">Headshots</div>
            <div className="text-lg font-mono-tech font-bold text-amber-300 tabular-nums mt-0.5">
              {state.sessionHeadshots}
            </div>
          </div>

          <div className="bg-[#0C1017] p-3 rounded-xl border border-slate-800">
            <div className="text-[11px] text-slate-400">Accuracy</div>
            <div className="text-lg font-mono-tech font-bold text-emerald-400 tabular-nums mt-0.5">
              {accuracy}%
            </div>
          </div>
        </div>

        {/* Score Submission & Leaderboard Actions */}
        <div className="space-y-2.5">
          {!state.scoreSubmitted ? (
            <button
              type="button"
              onClick={onSubmitScore}
              className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              <Upload className="w-4 h-4" />
              {cloudUser ? 'Submit Score to Global Cloud' : 'Submit Score to Leaderboard'}
            </button>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-500/12 border border-emerald-500/40 space-y-2.5 text-left">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-emerald-300 truncate tabular-nums">
                      Score Logged · Rank #{state.submittedRank ?? '—'}
                    </div>
                    <div className="text-[11px] font-mono-tech text-slate-400 truncate flex items-center gap-1.5">
                      <Cloud className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span>
                        {cloudSyncState.status === 'syncing'
                          ? 'Syncing to Global Cloud...'
                          : cloudSyncState.message || `Operative Level ${profile.level}`}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenLeaderboard}
                  className="px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Trophy className="w-3.5 h-3.5" /> Leaderboard
                </button>
              </div>

              {!cloudUser && cloudSyncState.status === 'auth_required' && (
                <button
                  type="button"
                  disabled={syncBusy}
                  onClick={handleSignInSync}
                  className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  {syncBusy ? 'Signing In...' : 'Sign In with Google & Sync to Global Cloud'}
                </button>
              )}

              {authError !== null && <AuthErrorNotice error={authError} />}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onRestart}
              className="py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" /> Redeploy
            </button>

            <button
              type="button"
              onClick={onReturnToMenu}
              className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
            >
              <Home className="w-4 h-4 text-slate-400" /> Main Menu
            </button>
          </div>

          {!state.scoreSubmitted && (
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="w-full py-2.5 rounded-xl bg-[#0C1017] hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" /> View Leaderboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
