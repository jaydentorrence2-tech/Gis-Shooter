/**
 * Settings Side Drawer
 * Configures Mouse Sensitivity, Field of View (FOV), and Master Audio Volume without obstructing 3D Hangar.
 */

import React, { useState } from 'react';
import { GraphicsPreset, PlayerProfileData } from '../game/GameEngine';
import { X, Volume2, VolumeX } from 'lucide-react';
import { soundSystem } from '../audio/SoundSystem';

interface SettingsModalProps {
  profile: PlayerProfileData;
  onUpdate: (updates: Partial<PlayerProfileData>) => void;
  onClose: () => void;
}

const GRAPHICS_OPTIONS: {
  id: GraphicsPreset;
  label: string;
  sub: string;
  desc: string;
}[] = [
  {
    id: 'high',
    label: 'High',
    sub: 'Ultra Tactical',
    desc: 'Full Retina DPI, PCF soft shadows, PBR bump/metalness, and full particle VFX.',
  },
  {
    id: 'medium',
    label: 'Medium',
    sub: 'Balanced',
    desc: '1.0x native resolution, balanced particle count, and smooth 3-point lighting.',
  },
  {
    id: 'potato',
    label: 'Potato Mode',
    sub: 'Max FPS',
    desc: '0.75x scale, shadows & AA off, Lambert materials, reduced sparks, near fog.',
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  profile,
  onUpdate,
  onClose,
}) => {
  const [isMuted, setIsMuted] = useState(soundSystem.getMuted());
  const activePreset = GRAPHICS_OPTIONS.find((o) => o.id === profile.graphicsPreset) || GRAPHICS_OPTIONS[0];

  const handleToggleMute = () => {
    setIsMuted(soundSystem.toggleMute());
  };

  return (
    <div className="absolute inset-0 z-40 flex justify-end p-4 md:p-6 pointer-events-none select-none">
      <div className="max-w-sm w-full h-fit max-h-[92vh] overflow-y-auto my-auto bg-[#131A26]/95 border border-slate-700/80 rounded-2xl p-6 shadow-2xl relative text-slate-100 pointer-events-auto">
        <button
          onClick={onClose}
          aria-label="Close Settings"
          className="absolute top-5 right-5 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-5">
          <div className="text-xs font-mono-tech text-cyan-400 tracking-wider uppercase">
            System Preferences
          </div>
          <h2 className="text-2xl font-display font-bold tracking-tight text-white mt-0.5">
            Settings
          </h2>
        </div>

        <div className="space-y-4 mb-6">
          {/* Graphics Preset */}
          <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-4">
            <div className="flex justify-between items-center text-sm mb-2.5">
              <span className="font-medium text-slate-200">Graphics Preset</span>
              <span
                className={`font-mono-tech text-xs font-bold uppercase ${
                  profile.graphicsPreset === 'potato'
                    ? 'text-emerald-400'
                    : profile.graphicsPreset === 'medium'
                    ? 'text-amber-400'
                    : 'text-cyan-400'
                }`}
              >
                {activePreset.sub}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
              {GRAPHICS_OPTIONS.map((opt) => {
                const selected = profile.graphicsPreset === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdate({ graphicsPreset: opt.id })}
                    className={`px-2 py-2 rounded-md text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                      selected
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
            <p className="mt-2.5 text-[11px] text-slate-400 leading-relaxed">
              {activePreset.desc}
            </p>
          </div>

          {/* Mouse Sensitivity */}
          <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-4">
            <div className="flex justify-between items-center text-sm mb-2">
              <span className="font-medium text-slate-200">Mouse Sensitivity</span>
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
              onChange={(e) => onUpdate({ mouseSensitivity: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          {/* Field of View (FOV) */}
          <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-4">
            <div className="flex justify-between items-center text-sm mb-2">
              <span className="font-medium text-slate-200">Field of View (FOV)</span>
              <span className="font-mono-tech font-bold text-amber-400 tabular-nums">
                {profile.baseFov}°
              </span>
            </div>
            <input
              type="range"
              min="65"
              max="100"
              step="1"
              value={profile.baseFov}
              onChange={(e) => onUpdate({ baseFov: parseInt(e.target.value, 10) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
          </div>

          {/* Master Audio Volume */}
          <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-4">
            <div className="flex justify-between items-center text-sm mb-2">
              <span className="font-medium text-slate-200">Master Volume</span>
              <div className="flex items-center gap-3">
                <span className="font-mono-tech font-bold text-emerald-400 tabular-nums">
                  {isMuted ? 'MUTED' : `${Math.round(profile.masterVolume * 100)}%`}
                </span>
                <button
                  onClick={handleToggleMute}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                  aria-label="Toggle Mute"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                </button>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={profile.masterVolume}
              onChange={(e) => onUpdate({ masterVolume: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition cursor-pointer"
        >
          Save &amp; Close
        </button>
      </div>
    </div>
  );
};
