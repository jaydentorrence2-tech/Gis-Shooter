/**
 * Player Profile Dossier Side Drawer
 * - Integrates Google Sign-In Cloud Identity & real-time Callsign ownership verification
 * - Supports optional 4–6 digit Operative PIN protection stored privately in /operatives/{uid}
 * - Leaves left/center 3D viewport completely open so camera zoom-in highlights the Operator's helmet & visor.
 */

import React, { useEffect, useState } from 'react';
import { getRankTitle, PlayerProfileData } from '../game/GameEngine';
import { X, Check, Cloud, LogIn, LogOut, ShieldCheck, AlertTriangle, KeyRound } from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  type CallsignLookupResult,
  hashOperativePin,
  lookupCloudCallsign,
  migrateCloudCallsignEntry,
  normalizeCallsignDisplay,
  normalizeCallsignKey,
  type OperativeAccountDoc,
  saveOperativeAccount,
  upsertCloudPersonalBest,
} from '../firebase/cloudLeaderboard';
import { migrateLocalCallsign } from '../game/leaderboard';
import { AuthErrorNotice } from './AuthErrorNotice';

interface ProfileModalProps {
  profile: PlayerProfileData;
  cloudUser: User | null;
  operativeAccount: OperativeAccountDoc | null;
  onSignInGoogle: () => Promise<void>;
  onSignOutGoogle: () => Promise<void>;
  onPreviewAccent: (hex: string) => void;
  onSave: (updated: Partial<PlayerProfileData>) => void;
  onCloudAccountSaved?: (acc: OperativeAccountDoc) => void;
  onClose: () => void;
}

const ACCENT_COLORS = [
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Crimson', hex: '#ef4444' },
  { name: 'Sky', hex: '#38bdf8' },
  { name: 'Slate', hex: '#e2e8f0' },
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  profile,
  cloudUser,
  operativeAccount,
  onSignInGoogle,
  onSignOutGoogle,
  onPreviewAccent,
  onSave,
  onCloudAccountSaved,
  onClose,
}) => {
  const [callsign, setCallsign] = useState(profile.callsign);
  const [selectedColor, setSelectedColor] = useState(profile.accentColor || '#06b6d4');
  const [operativePin, setOperativePin] = useState('');
  const [pinError, setPinError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [cloudNotice, setCloudNotice] = useState<unknown>(null);
  const [lookup, setLookup] = useState<CallsignLookupResult>({
    status: 'checking',
    callsignKey: profile.callsign,
  });

  const accuracy =
    profile.totalShots > 0
      ? Math.round((profile.totalHits / profile.totalShots) * 100)
      : 0;

  const headshotRatio =
    profile.totalKills > 0
      ? Math.round((profile.totalHeadshots / profile.totalKills) * 100)
      : 0;

  const rankTitle = getRankTitle(profile.level);
  const neededXp = profile.level * 250;
  const xpPercent = Math.min(100, Math.round((profile.xp / neededXp) * 100));

  useEffect(() => {
    let cancelled = false;
    const trimmed = callsign.trim();
    if (trimmed.length < 2) {
      setLookup({ status: 'available', callsignKey: 'OPERATIVE' });
      return;
    }
    setLookup((prev) => ({ ...prev, status: 'checking' }));
    const timer = setTimeout(async () => {
      try {
        const res = await lookupCloudCallsign(trimmed, cloudUser?.uid ?? null);
        if (!cancelled) setLookup(res);
      } catch {
        if (!cancelled) {
          setLookup({ status: 'offline', callsignKey: trimmed.toUpperCase() });
        }
      }
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [callsign, cloudUser?.uid]);

  const handlePickColor = (hex: string) => {
    setSelectedColor(hex);
    onPreviewAccent(hex);
  };

  const handleCancel = () => {
    onPreviewAccent(profile.accentColor || '#06b6d4');
    onClose();
  };

  const handleGoogleAuth = async () => {
    setAuthBusy(true);
    setCloudNotice(null);
    try {
      if (cloudUser) {
        await onSignOutGoogle();
      } else {
        await onSignInGoogle();
      }
    } catch (err) {
      setCloudNotice(err);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    setCloudNotice(null);
    const cleanCallsign = normalizeCallsignDisplay(callsign);

    if (cloudUser && lookup.status === 'owned_by_other') {
      setCloudNotice(
        `Callsign "${cleanCallsign}" belongs to another Google account. Pick another callsign or sign in as owner.`
      );
      return;
    }

    // If operative already has a PIN set and is changing primary callsign, require PIN verification
    const hasExistingPin = Boolean(operativeAccount?.pinHash);
    const changingCallsign =
      operativeAccount &&
      operativeAccount.primaryCallsign !== cleanCallsign.replace(/\s+/g, '_').replace(/[^A-Z0-9_\-]/g, '');

    if (cloudUser && hasExistingPin && changingCallsign) {
      if (!operativePin.trim()) {
        setPinError('Enter your Operative PIN to authorize callsign change.');
        return;
      }
      const enteredHash = await hashOperativePin(operativePin.trim(), cloudUser.uid);
      if (enteredHash !== operativeAccount.pinHash) {
        setPinError('Incorrect Operative PIN.');
        return;
      }
    }

    setSaving(true);
    try {
      const oldCallsign = profile.callsign;
      const oldKey = operativeAccount?.primaryCallsign || normalizeCallsignKey(oldCallsign);
      const newKey = normalizeCallsignKey(cleanCallsign);

      migrateLocalCallsign(oldCallsign, cleanCallsign);

      onSave({
        callsign: cleanCallsign,
        accentColor: selectedColor,
      });

      if (cloudUser) {
        const savedAcc = await saveOperativeAccount({
          uid: cloudUser.uid,
          callsign: cleanCallsign,
          accentColor: selectedColor,
          newPin: !hasExistingPin && operativePin.trim() ? operativePin.trim() : undefined,
          keepExistingPin: true,
        });
        onCloudAccountSaved?.(savedAcc);

        const scorePayload = {
          callsign: cleanCallsign,
          score: profile.highScore,
          wave: profile.highestWave || 1,
          kills: profile.totalKills,
          headshots: profile.totalHeadshots,
          accuracy,
          survivalSec: Math.max(60, (profile.highestWave || 1) * 55),
          xpEarned: profile.xp,
          level: profile.level,
          avatarColor: selectedColor,
          favoriteWeapon: 'AR-X7 Tactical',
          hasPin: Boolean(savedAcc.pinHash),
        };

        let migrated = null;
        if (oldKey !== newKey) {
          migrated = await migrateCloudCallsignEntry(cloudUser, oldKey, scorePayload);
          if (!migrated && normalizeCallsignKey(oldCallsign) !== oldKey) {
            migrated = await migrateCloudCallsignEntry(cloudUser, oldCallsign, scorePayload);
          }
        }
        if (!migrated && profile.highScore > 0) {
          await upsertCloudPersonalBest(cloudUser, scorePayload);
        }
      }

      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 420);
    } catch (err) {
      setCloudNotice(err instanceof Error ? err.message : 'Failed to sync cloud profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex justify-end p-4 md:p-6 pointer-events-none select-none">
      <div className="max-w-md w-full h-full max-h-[720px] my-auto bg-[#131A26]/95 border border-slate-700/80 rounded-2xl p-6 shadow-2xl relative text-slate-100 flex flex-col justify-between pointer-events-auto overflow-y-auto">
        <div>
          <button
            onClick={handleCancel}
            aria-label="Close Profile"
            className="absolute top-5 right-5 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Operative Header */}
          <div className="flex items-center gap-3.5 mb-4">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center font-display font-bold text-slate-950 text-lg shrink-0"
              style={{ backgroundColor: selectedColor }}
            >
              {callsign.substring(0, 2).toUpperCase() || 'OP'}
            </div>
            <div>
              <div className="text-xs font-mono-tech text-cyan-400 uppercase tracking-wider">
                {rankTitle} · Level {profile.level}
              </div>
              <h2 className="text-2xl font-display font-bold tracking-tight text-white">
                Player Profile
              </h2>
            </div>
          </div>

          {/* Cloud Identity Card */}
          <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3.5 mb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Cloud
                  className={`w-4 h-4 shrink-0 ${
                    cloudUser ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">
                    {cloudUser ? cloudUser.displayName || 'Google Operative' : 'Cloud Sync Offline'}
                  </div>
                  <div className="text-[11px] font-mono-tech text-slate-400 truncate">
                    {cloudUser
                      ? cloudUser.email || 'Verified Cloud Account'
                      : 'Sign in with Google to sync global scores'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={authBusy}
                onClick={handleGoogleAuth}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 ${
                  cloudUser
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold'
                }`}
              >
                {cloudUser ? (
                  <>
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </>
                ) : (
                  <>
                    <LogIn className="w-3.5 h-3.5" /> Sign In
                  </>
                )}
              </button>
            </div>
          </div>

          <form id="profile-form" onSubmit={handleSave}>
            {/* Callsign + Real-time Cloud Ownership Check */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Operative Callsign
              </label>
              <input
                type="text"
                maxLength={16}
                value={callsign}
                onChange={(e) => setCallsign(e.target.value.toUpperCase())}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0C1017] border border-slate-700 text-cyan-300 font-mono-tech font-bold tracking-wider focus:outline-none focus:border-cyan-400 transition"
                placeholder="Enter callsign..."
              />
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-mono-tech">
                {lookup.status === 'checking' && (
                  <span className="text-slate-400">Checking global callsign registry...</span>
                )}
                {lookup.status === 'available' && (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    Available · Unclaimed global callsign
                  </span>
                )}
                {lookup.status === 'owned_by_you' && (
                  <span className="text-cyan-400 flex items-center gap-1 tabular-nums">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    Verified Owner · Cloud PB: {(lookup.existingScore ?? 0).toLocaleString()}
                  </span>
                )}
                {lookup.status === 'owned_by_other' && (
                  <span className="text-rose-400 flex items-center gap-1 tabular-nums">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Registered by another account (PB: {(lookup.existingScore ?? 0).toLocaleString()})
                  </span>
                )}
                {lookup.status === 'offline' && (
                  <span className="text-slate-500">Local mode · Cloud check unavailable</span>
                )}
              </div>
            </div>

            {/* Optional Operative PIN */}
            {cloudUser && (
              <div className="mb-4">
                <label className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    Operative PIN {operativeAccount?.pinHash ? '(Configured)' : '(Optional)'}
                  </span>
                  <span className="text-[10px] font-mono-tech text-slate-400">
                    {operativeAccount?.pinHash ? 'Required if changing callsign' : '4–8 digits'}
                  </span>
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={operativePin}
                  onChange={(e) => {
                    setOperativePin(e.target.value);
                    if (pinError) setPinError('');
                  }}
                  placeholder={
                    operativeAccount?.pinHash
                      ? 'Enter PIN to confirm callsign change'
                      : 'Optional PIN for profile verification'
                  }
                  className="w-full px-4 py-2 rounded-xl bg-[#0C1017] border border-slate-700 text-amber-300 font-mono-tech text-xs tracking-widest focus:outline-none focus:border-amber-400 transition"
                />
                {pinError && (
                  <div className="mt-1.5 text-[11px] font-mono-tech text-rose-400">{pinError}</div>
                )}
              </div>
            )}

            {cloudNotice !== null && <AuthErrorNotice error={cloudNotice} className="mb-3" />}

            {/* Visor Color */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Helmet Visor &amp; HUD Accent
              </label>
              <div className="grid grid-cols-3 gap-2">
                {ACCENT_COLORS.map((col) => (
                  <button
                    key={col.hex}
                    type="button"
                    onClick={() => handlePickColor(col.hex)}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-xs transition cursor-pointer ${
                      selectedColor === col.hex
                        ? 'border-white bg-slate-800/90 text-white'
                        : 'border-slate-800 bg-[#0C1017] text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-md shrink-0" style={{ backgroundColor: col.hex }} />
                    <span className="text-[11px]">{col.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* XP Progress */}
            <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3.5 mb-4">
              <div className="flex justify-between items-center text-xs font-mono-tech mb-2 tabular-nums">
                <span className="font-bold text-slate-200">{rankTitle}</span>
                <span className="text-slate-400">
                  {profile.xp} / {neededXp} XP ({xpPercent}%)
                </span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${xpPercent}%`, backgroundColor: selectedColor }}
                />
              </div>
            </div>

            {/* Combat Metrics */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3">
                <div className="text-[11px] text-slate-400">Total Kills</div>
                <div className="text-base font-mono-tech font-bold text-white mt-0.5 tabular-nums">
                  {profile.totalKills}
                </div>
              </div>

              <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3">
                <div className="text-[11px] text-slate-400">Headshot Ratio</div>
                <div className="text-base font-mono-tech font-bold text-amber-400 mt-0.5 tabular-nums">
                  {headshotRatio}%
                </div>
              </div>

              <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3">
                <div className="text-[11px] text-slate-400">Accuracy</div>
                <div className="text-base font-mono-tech font-bold text-cyan-400 mt-0.5 tabular-nums">
                  {accuracy}%
                </div>
              </div>

              <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3">
                <div className="text-[11px] text-slate-400">High Score · Best Wave</div>
                <div className="text-base font-mono-tech font-bold text-emerald-400 mt-0.5 tabular-nums">
                  {profile.highScore.toLocaleString()} · W{profile.highestWave}
                </div>
              </div>
            </div>

            {/* Special Achievements */}
            <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3.5 mb-3">
              <div className="flex items-center justify-between text-xs font-mono-tech mb-2 tabular-nums">
                <span className="font-bold text-slate-200 uppercase tracking-wider">Special Achievements</span>
                <span className="text-slate-400">Boss Kills: {profile.bossDefeatedCount || 0}</span>
              </div>
              {(() => {
                const unlocked = (profile.achievements || []).includes('SPECIALIST_SLAYER');
                return (
                  <div
                    className={`rounded-lg border px-3 py-2 flex items-center justify-between gap-2 ${
                      unlocked
                        ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-200'
                        : 'bg-slate-950/70 border-slate-800 text-slate-500'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-display font-bold">
                        Anesthesia Neutralized
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Defeat &ldquo;The Specialist Anestesi&rdquo; on Wave 10
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-mono-tech font-bold shrink-0 ${
                        unlocked ? 'text-emerald-300' : 'text-slate-500'
                      }`}
                    >
                      {unlocked ? 'UNLOCKED' : 'LOCKED'}
                    </span>
                  </div>
                );
              })()}
            </div>
          </form>
        </div>

        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition cursor-pointer whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="profile-form"
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" /> Saved
              </>
            ) : saving ? (
              'Syncing...'
            ) : (
              'Save Profile'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
