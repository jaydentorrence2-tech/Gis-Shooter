/**
 * Player Profile Dossier Side Drawer
 * Leaves left/center 3D viewport completely open so camera zoom-in highlights the Operator's helmet & visor.
 */

import React, { useState } from 'react';
import { getRankTitle, PlayerProfileData } from '../game/GameEngine';
import { X, Check } from 'lucide-react';

interface ProfileModalProps {
  profile: PlayerProfileData;
  onPreviewAccent: (hex: string) => void;
  onSave: (updated: Partial<PlayerProfileData>) => void;
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
  onPreviewAccent,
  onSave,
  onClose,
}) => {
  const [callsign, setCallsign] = useState(profile.callsign);
  const [selectedColor, setSelectedColor] = useState(profile.accentColor || '#06b6d4');
  const [savedSuccess, setSavedSuccess] = useState(false);

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

  const handlePickColor = (hex: string) => {
    setSelectedColor(hex);
    onPreviewAccent(hex);
  };

  const handleCancel = () => {
    onPreviewAccent(profile.accentColor || '#06b6d4');
    onClose();
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCallsign = callsign.trim().toUpperCase() || 'OPERATIVE';
    onSave({
      callsign: cleanCallsign,
      accentColor: selectedColor,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 400);
  };

  return (
    <div className="absolute inset-0 z-40 flex justify-end p-4 md:p-6 pointer-events-none select-none">
      <div className="max-w-md w-full h-full max-h-[680px] my-auto bg-[#131A26]/95 border border-slate-700/80 rounded-2xl p-6 shadow-2xl relative text-slate-100 flex flex-col justify-between pointer-events-auto overflow-y-auto">
        <div>
          <button
            onClick={handleCancel}
            aria-label="Close Profile"
            className="absolute top-5 right-5 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Operative Header */}
          <div className="flex items-center gap-3.5 mb-5">
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

          <form id="profile-form" onSubmit={handleSave}>
            {/* Callsign */}
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
            </div>

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
              <div className="flex justify-between items-center text-xs font-mono-tech mb-2">
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
                <div className="text-base font-mono-tech font-bold text-white mt-0.5">
                  {profile.totalKills}
                </div>
              </div>

              <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3">
                <div className="text-[11px] text-slate-400">Headshot Ratio</div>
                <div className="text-base font-mono-tech font-bold text-amber-400 mt-0.5">
                  {headshotRatio}%
                </div>
              </div>

              <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3">
                <div className="text-[11px] text-slate-400">Accuracy</div>
                <div className="text-base font-mono-tech font-bold text-cyan-400 mt-0.5">
                  {accuracy}%
                </div>
              </div>

              <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3">
                <div className="text-[11px] text-slate-400">High Score · Best Wave</div>
                <div className="text-base font-mono-tech font-bold text-emerald-400 mt-0.5">
                  {profile.highScore.toLocaleString()} · W{profile.highestWave}
                </div>
              </div>
            </div>

            {/* Special Achievements */}
            <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3.5 mb-3">
              <div className="flex items-center justify-between text-xs font-mono-tech mb-2">
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
                      className={`text-[10px] font-mono-tech font-bold px-2 py-0.5 rounded border shrink-0 ${
                        unlocked
                          ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                          : 'bg-slate-900 border-slate-700 text-slate-500'
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
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="profile-form"
            className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" /> Saved
              </>
            ) : (
              'Save Profile'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
