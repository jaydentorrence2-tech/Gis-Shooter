/**
 * Dedicated Crosshair Customization & Advanced Settings Drawer
 * Accessible from both Main Menu (non-occluding right drawer) and Pause Modal (ESC).
 * Includes real-time Live Preview Box with dark/bright test backdrops and simulated dynamic spread/hitmarker.
 */

import React, { useEffect, useState } from 'react';
import {
  CrosshairConfig,
  CrosshairStyle,
  DEFAULT_CROSSHAIR,
  PlayerProfileData,
} from '../game/GameEngine';
import { CrosshairReticle } from './CrosshairReticle';
import { X, RotateCcw, Sun, Moon, Activity } from 'lucide-react';

interface CrosshairEditorModalProps {
  profile: PlayerProfileData;
  onUpdate: (updates: Partial<PlayerProfileData>) => void;
  onClose: () => void;
  isOverlay?: boolean;
}

const STYLE_OPTIONS: { id: CrosshairStyle; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'dot', label: 'Dot Only' },
  { id: 'circle', label: 'Ring' },
  { id: 'cross_dot', label: 'Cross + Dot' },
];

const COLOR_PRESETS: { label: string; hex: string }[] = [
  { label: 'Neon Green', hex: '#22C55E' },
  { label: 'Pure White', hex: '#FFFFFF' },
  { label: 'Gold Amber', hex: '#FACC15' },
  { label: 'Tactical Cyan', hex: '#06B6D4' },
  { label: 'Crimson Red', hex: '#EF4444' },
];

export const CrosshairEditorModal: React.FC<CrosshairEditorModalProps> = ({
  profile,
  onUpdate,
  onClose,
  isOverlay = false,
}) => {
  const cfg = profile.crosshair || DEFAULT_CROSSHAIR;
  const [brightPreview, setBrightPreview] = useState(false);
  const [simActive, setSimActive] = useState(false);
  const [simSpread, setSimSpread] = useState(0.1);
  const [simHit, setSimHit] = useState(false);

  const updateCrosshair = (patch: Partial<CrosshairConfig>) => {
    onUpdate({ crosshair: { ...cfg, ...patch } });
  };

  // Optional live motion & burst simulation inside preview box
  useEffect(() => {
    if (!simActive) {
      setSimSpread(0.1);
      return;
    }
    let phase = 0;
    const id = window.setInterval(() => {
      phase += 0.16;
      setSimSpread(0.1 + (Math.sin(phase) * 0.5 + 0.5) * 0.34);
    }, 45);
    return () => window.clearInterval(id);
  }, [simActive]);

  const triggerTestHitmarker = () => {
    setSimHit(true);
    window.setTimeout(() => setSimHit(false), 220);
  };

  return (
    <div
      className={`absolute inset-0 z-50 flex justify-end p-4 md:p-6 select-none ${
        isOverlay ? 'bg-slate-950/75 pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      <div className="max-w-md w-full h-fit max-h-[94vh] overflow-y-auto my-auto bg-[#131A26]/95 border border-slate-700/80 rounded-2xl p-6 shadow-2xl relative text-slate-100 pointer-events-auto">
        <button
          onClick={onClose}
          aria-label="Close Crosshair Settings"
          className="absolute top-5 right-5 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-4 pr-8">
          <div className="text-xs font-mono-tech text-cyan-400 tracking-wider uppercase">
            Optics &amp; Reticle Calibration
          </div>
          <h2 className="text-2xl font-display font-bold tracking-tight text-white mt-0.5">
            Crosshair Settings
          </h2>
        </div>

        {/* Live Preview Box */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium text-slate-300">Live Reticle Preview</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setBrightPreview((v) => !v)}
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap"
                title="Switch backdrop contrast"
              >
                {brightPreview ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
                {brightPreview ? 'Dark Bay' : 'Bright Surface'}
              </button>
              <button
                type="button"
                onClick={() => setSimActive((v) => !v)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap border ${
                  simActive
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-slate-800 border-transparent hover:bg-slate-700 text-slate-200'
                }`}
              >
                <Activity className="w-3 h-3" />
                {simActive ? 'Stop Motion' : 'Test Spread'}
              </button>
              <button
                type="button"
                onClick={triggerTestHitmarker}
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-rose-300 text-[11px] font-medium cursor-pointer whitespace-nowrap"
              >
                Test Hit
              </button>
            </div>
          </div>

          <div
            className="relative h-32 rounded-xl border border-slate-700/80 flex items-center justify-center overflow-hidden transition-colors"
            style={{
              background: brightPreview
                ? 'linear-gradient(135deg, #e2e8f0 0%, #94a3b8 55%, #cbd5e1 100%)'
                : 'radial-gradient(circle at center, #1a2436 0%, #090d14 100%)',
            }}
          >
            {/* Subtle calibration grid */}
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(148,163,184,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.25) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />
            <CrosshairReticle
              config={cfg}
              spread={simSpread}
              hitmarkerActive={simHit}
              hitmarkerHeadshot={true}
            />
          </div>
        </div>

        {/* Crosshair Style Segmented Selector */}
        <div className="mb-4">
          <div className="text-xs font-medium text-slate-300 mb-2">Crosshair Style</div>
          <div className="grid grid-cols-4 gap-1.5 bg-[#0C1017] p-1 rounded-xl border border-slate-800">
            {STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => updateCrosshair({ style: opt.id })}
                className={`py-2 px-2 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                  cfg.style === opt.id
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Color Presets + Custom RGB/Hex Picker */}
        <div className="mb-4 bg-[#0C1017] border border-slate-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-xs mb-2.5">
            <span className="font-medium text-slate-200">Reticle Color</span>
            <span className="font-mono-tech font-bold text-cyan-400 uppercase">{cfg.color}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  title={preset.label}
                  onClick={() => updateCrosshair({ color: preset.hex })}
                  className={`w-7 h-7 rounded-lg transition cursor-pointer ${
                    cfg.color.toUpperCase() === preset.hex.toUpperCase()
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0C1017] scale-105'
                      : 'opacity-85 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: preset.hex }}
                />
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700">
              <span>Custom</span>
              <input
                type="color"
                value={cfg.color}
                onChange={(e) => updateCrosshair({ color: e.target.value.toUpperCase() })}
                className="w-6 h-5 bg-transparent border-0 cursor-pointer p-0"
              />
            </label>
          </div>
        </div>

        {/* Sliders: Length, Thickness, Gap, Center Dot Size, Opacity */}
        <div className="space-y-3 mb-4">
          {cfg.style !== 'dot' && (
            <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300">
                  {cfg.style === 'circle' ? 'Ring Scale' : 'Line Length'}
                </span>
                <span className="font-mono-tech font-bold text-cyan-400">{cfg.length} px</span>
              </div>
              <input
                type="range"
                min="4"
                max="24"
                step="1"
                value={cfg.length}
                onChange={(e) => updateCrosshair({ length: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          )}

          {cfg.style !== 'dot' && (
            <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300">Line Thickness</span>
                <span className="font-mono-tech font-bold text-cyan-400">{cfg.thickness} px</span>
              </div>
              <input
                type="range"
                min="1"
                max="6"
                step="1"
                value={cfg.thickness}
                onChange={(e) => updateCrosshair({ thickness: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          )}

          {cfg.style !== 'dot' && (
            <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300">
                  {cfg.style === 'circle' ? 'Ring Radius' : 'Center Gap'}
                </span>
                <span className="font-mono-tech font-bold text-amber-400">{cfg.gap} px</span>
              </div>
              <input
                type="range"
                min="0"
                max="18"
                step="1"
                value={cfg.gap}
                onChange={(e) => updateCrosshair({ gap: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>
          )}

          {(cfg.style === 'dot' || cfg.style === 'cross_dot') && (
            <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300">Center Dot Size</span>
                <span className="font-mono-tech font-bold text-emerald-400">{cfg.dotSize} px</span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={cfg.dotSize}
                onChange={(e) => updateCrosshair({ dotSize: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
            </div>
          )}

          <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300">Opacity</span>
              <span className="font-mono-tech font-bold text-cyan-400">
                {Math.round(cfg.opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.2"
              max="1.0"
              step="0.05"
              value={cfg.opacity}
              onChange={(e) => updateCrosshair({ opacity: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>
        </div>

        {/* Toggles: Black Outline & Dynamic Spread */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <button
            type="button"
            onClick={() => updateCrosshair({ outline: !cfg.outline })}
            className={`py-2.5 px-3 rounded-xl border text-xs font-medium flex items-center justify-between cursor-pointer transition ${
              cfg.outline
                ? 'bg-cyan-500/15 border-cyan-500/70 text-white'
                : 'bg-[#0C1017] border-slate-800 text-slate-400'
            }`}
          >
            <span>Black Outline</span>
            <span className="font-mono-tech font-bold text-[11px]">
              {cfg.outline ? 'ON' : 'OFF'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => updateCrosshair({ dynamic: !cfg.dynamic })}
            className={`py-2.5 px-3 rounded-xl border text-xs font-medium flex items-center justify-between cursor-pointer transition ${
              cfg.dynamic
                ? 'bg-cyan-500/15 border-cyan-500/70 text-white'
                : 'bg-[#0C1017] border-slate-800 text-slate-400'
            }`}
          >
            <span>Dynamic Spread</span>
            <span className="font-mono-tech font-bold text-[11px]">
              {cfg.dynamic ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => updateCrosshair({ ...DEFAULT_CROSSHAIR })}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition cursor-pointer"
          >
            Save &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};
