/**
 * Interactive 3D Hangar Main Menu for GIS Shooter: Tactical Edition
 * Anchored cleanly on the left so the right-center 3D Operator Turntable & Hangar remain unobstructed.
 */

import React from 'react';
import { getRankTitle, PlayerProfileData } from '../game/GameEngine';
import { Play, User, Sliders, Download, Crosshair, Target, Trophy } from 'lucide-react';
import { generateStandaloneHtml } from '../game/standaloneHtml';
import { soundSystem } from '../audio/SoundSystem';

interface MainMenuProps {
  profile: PlayerProfileData;
  onPlay: () => void;
  onOpenArmory: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenCrosshair: () => void;
  onOpenLeaderboard: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  profile,
  onPlay,
  onOpenArmory,
  onOpenProfile,
  onOpenSettings,
  onOpenCrosshair,
  onOpenLeaderboard,
}) => {
  const handleDownloadStandalone = () => {
    soundSystem.startLobbyAmbient();
    const htmlContent = generateStandaloneHtml();
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gis-shooter-tactical-edition.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const accuracy =
    profile.totalShots > 0
      ? Math.round((profile.totalHits / profile.totalShots) * 100)
      : 0;
  const rank = getRankTitle(profile.level);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-between px-6 md:px-14 py-8 pointer-events-none select-none bg-gradient-to-r from-[#0C1017]/90 via-[#0C1017]/35 to-transparent">
      {/* Left Tactical Command Column */}
      <div className="max-w-[400px] w-full pointer-events-auto">
        <div className="text-xs font-mono-tech text-cyan-400 tracking-widest uppercase mb-2">
          Three.js Tactical FPS · Deployment Bay
        </div>

        <h1 className="text-5xl md:text-6xl font-display font-bold tracking-tight text-white leading-none">
          GIS SHOOTER
        </h1>
        <div className="text-lg font-display font-semibold text-amber-400 tracking-wide mt-1 mb-4">
          TACTICAL EDITION
        </div>

        <p className="text-sm text-slate-300 leading-relaxed mb-6">
          Inspect your operative inside the Tactical Hangar, customize your loadout and visor optics, and deploy into multi-level combat waves.
        </p>

        {/* Operative Summary Bar */}
        <div className="bg-[#131A26]/95 border border-slate-700/80 rounded-xl p-4 mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center font-display font-bold text-slate-950 text-base shrink-0"
              style={{ backgroundColor: profile.accentColor || '#06b6d4' }}
            >
              {profile.callsign.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-mono-tech font-bold text-white text-sm truncate">
                {profile.callsign}
              </div>
              <div className="text-xs font-mono-tech text-slate-400">
                {rank} · Lvl {profile.level} · {accuracy}% Acc
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] text-slate-400">High Score</div>
            <div className="font-mono-tech font-bold text-emerald-400 text-sm">
              {profile.highScore.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Primary Deploy Action */}
        <button
          onClick={onPlay}
          className="w-full py-4 px-6 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-bold text-lg tracking-wide uppercase shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2.5 transition cursor-pointer mb-3"
        >
          <Play className="w-5 h-5 fill-slate-950" />
          Deploy
        </button>

        {/* Secondary Actions */}
        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
          <button
            onClick={() => {
              soundSystem.startLobbyAmbient();
              onOpenArmory();
            }}
            className="py-2.5 px-3 rounded-xl bg-[#131A26]/95 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-700/80 flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
          >
            <Crosshair className="w-4 h-4 text-amber-400" />
            Armory
          </button>

          <button
            onClick={() => {
              soundSystem.startLobbyAmbient();
              onOpenProfile();
            }}
            className="py-2.5 px-3 rounded-xl bg-[#131A26]/95 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-700/80 flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
          >
            <User className="w-4 h-4 text-cyan-400" />
            Profile
          </button>

          <button
            onClick={() => {
              soundSystem.startLobbyAmbient();
              onOpenSettings();
            }}
            className="py-2.5 px-3 rounded-xl bg-[#131A26]/95 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-700/80 flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
          >
            <Sliders className="w-4 h-4 text-slate-300" />
            Settings
          </button>

          <button
            onClick={() => {
              soundSystem.startLobbyAmbient();
              onOpenCrosshair();
            }}
            className="py-2.5 px-3 rounded-xl bg-[#131A26]/95 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-700/80 flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
          >
            <Target className="w-4 h-4 text-emerald-400" />
            Crosshair Settings
          </button>
        </div>

        <button
          onClick={() => {
            soundSystem.startLobbyAmbient();
            onOpenLeaderboard();
          }}
          className="w-full py-2.5 px-4 rounded-xl bg-[#131A26]/95 hover:bg-slate-800 text-amber-300 text-xs font-semibold border border-amber-500/35 flex items-center justify-center gap-2 transition cursor-pointer mb-2.5 whitespace-nowrap"
        >
          <Trophy className="w-4 h-4 text-amber-400" />
          Leaderboard
        </button>

        <button
          onClick={handleDownloadStandalone}
          className="w-full py-2.5 px-4 rounded-xl bg-[#131A26]/95 hover:bg-slate-800 text-slate-300 text-xs font-mono-tech font-semibold border border-slate-800 flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          Export Single-File HTML
        </button>

        <div className="mt-5 text-xs font-mono-tech text-slate-500">
          WASD Move · C Crouch · Shift Sprint · Space Jump · L-Click Fire · R-Click Aim · R Reload · F Light · 1–7 / Scroll Swap · Q Quick-Switch · Tab Inventory
        </div>
      </div>

      {/* Subtle Hangar Orbit Hint on bottom-right */}
      <div className="hidden md:block self-end px-3.5 py-2 rounded-lg bg-[#0C1017]/80 border border-slate-800 text-[11px] font-mono-tech text-slate-400">
        Drag to Orbit Hangar · Scroll to Zoom
      </div>
    </div>
  );
};
