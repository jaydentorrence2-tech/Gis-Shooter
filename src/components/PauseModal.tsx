/**
 * Tactical Pause Modal (ESC key)
 * Exposes Resume, Restart, Return to Main Menu, plus real-time Sensitivity, FOV, and Volume sliders.
 */

import React, { useState } from 'react';
import { GraphicsPreset, PlayerProfileData } from '../game/GameEngine';
import { Play, Volume2, VolumeX, RotateCcw, Home, Target, Terminal } from 'lucide-react';
import { soundSystem } from '../audio/SoundSystem';
import { CrosshairEditorModal } from './CrosshairEditorModal';

interface PauseModalProps {
  profile: PlayerProfileData;
  onResume: () => void;
  onRestart: () => void;
  onReturnToMenu: () => void;
  onUpdateProfile: (updates: Partial<PlayerProfileData>) => void;
  onOpenAdmin?: () => void;
  pointerLockNotice?: string | null;
}

const PRESET_TABS: { id: GraphicsPreset; label: string; tag: string }[] = [
  { id: 'high', label: 'High', tag: 'Ultra Tactical' },
  { id: 'medium', label: 'Medium', tag: 'Balanced' },
  { id: 'potato', label: 'Potato Mode', tag: 'Max FPS' },
];

export const PauseModal: React.FC<PauseModalProps> = ({
  profile,
  onResume,
  onRestart,
  onReturnToMenu,
  onUpdateProfile,
  onOpenAdmin,
  pointerLockNotice,
}) => {
  const [isMuted, setIsMuted] = useState(soundSystem.getMuted());
  const [isCrosshairOpen, setIsCrosshairOpen] = useState(false);

  const handleToggleMute = () => {
    setIsMuted(soundSystem.toggleMute());
  };

  if (isCrosshairOpen) {
    return (
      <CrosshairEditorModal
        profile={profile}
        onUpdate={onUpdateProfile}
        onClose={() => setIsCrosshairOpen(false)}
        isOverlay={true}
      />
    );
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/85 p-4 select-none">
      <div className="max-w-md w-full max-h-[92vh] overflow-y-auto bg-[#131A26] border border-slate-700/80 rounded-2xl p-6 shadow-2xl text-slate-100">
        <div className="text-center mb-5">
          <div className="text-xs font-mono-tech text-cyan-400 uppercase tracking-wider">
            Combat Suspended
          </div>
          <h2 className="text-2xl font-display font-bold text-white mt-0.5">Paused</h2>
        </div>

        <div className="space-y-3 mb-5">
          {/* Graphics Preset */}
          <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3.5">
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="text-slate-300 font-medium">Graphics Preset</span>
              <span
                className={`font-mono-tech font-bold uppercase ${
                  profile.graphicsPreset === 'potato'
                    ? 'text-emerald-400'
                    : profile.graphicsPreset === 'medium'
                    ? 'text-amber-400'
                    : 'text-cyan-400'
                }`}
              >
                {PRESET_TABS.find((t) => t.id === profile.graphicsPreset)?.tag || 'Ultra Tactical'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
              {PRESET_TABS.map((opt) => {
                const active = profile.graphicsPreset === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateProfile({ graphicsPreset: opt.id })}
                    className={`px-2 py-1.5 rounded-md text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? opt.id === 'potato'
                          ? 'bg-emerald-500 text-slate-950 shadow-sm'
                          : 'bg-cyan-500 text-slate-950 shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sensitivity */}
          <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3.5">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300 font-medium">Mouse Sensitivity</span>
              <span className="font-mono-tech font-bold text-cyan-400 tabular-nums">
                {profile.mouseSensitivity.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min="0.2"
              max="3.0"
              step="0.1"
              value={profile.mouseSensitivity}
              onChange={(e) => onUpdateProfile({ mouseSensitivity: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          {/* Field of View */}
          <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3.5">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300 font-medium">Field of View (FOV)</span>
              <span className="font-mono-tech font-bold text-amber-400 tabular-nums">{profile.baseFov}°</span>
            </div>
            <input
              type="range"
              min="65"
              max="100"
              step="1"
              value={profile.baseFov}
              onChange={(e) => onUpdateProfile({ baseFov: parseInt(e.target.value, 10) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
          </div>

          {/* Volume */}
          <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3.5">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-slate-300 font-medium">Master Volume</span>
              <div className="flex items-center gap-2">
                <span className="font-mono-tech font-bold text-emerald-400 tabular-nums">
                  {isMuted ? 'MUTED' : `${Math.round(profile.masterVolume * 100)}%`}
                </span>
                <button
                  onClick={handleToggleMute}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer"
                  aria-label="Toggle Mute"
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                </button>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={profile.masterVolume}
              onChange={(e) => onUpdateProfile({ masterVolume: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
          </div>
        </div>

        <div className="space-y-2.5">
          {pointerLockNotice && (
            <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-mono-tech text-center">
              {pointerLockNotice}
            </div>
          )}
          <button
            onClick={onResume}
            className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Play className="w-4 h-4 fill-slate-950" /> Resume
          </button>
          <button
            onClick={() => setIsCrosshairOpen(true)}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Target className="w-4 h-4 text-emerald-400" /> Crosshair Settings
          </button>
          <button
            onClick={onRestart}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-amber-400" /> Restart Match
          </button>
          <button
            onClick={onReturnToMenu}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Home className="w-4 h-4 text-slate-400" /> Main Menu
          </button>
        </div>
      </div>

      {onOpenAdmin && (
        <button
          type="button"
          onClick={onOpenAdmin}
          title="Developer Console"
          aria-label="Open Developer Console"
          className="absolute bottom-5 right-5 p-2 rounded-lg bg-[#0C1017]/80 hover:bg-slate-800 border border-slate-800 text-slate-600 hover:text-amber-400 transition cursor-pointer"
        >
          <Terminal className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
