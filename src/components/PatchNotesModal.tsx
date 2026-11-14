/**
 * GUI Patch Notes Modal (v1.5 Changelog)
 * Displays structured release history from v1.2 through v1.5 in a high-contrast tactical modal.
 */

import React, { useEffect } from 'react';
import { FileText, X } from 'lucide-react';

interface PatchNotesModalProps {
  onClose: () => void;
}

interface PatchRelease {
  version: string;
  tag: string;
  date: string;
  title: string;
  accent: 'emerald' | 'cyan' | 'amber' | 'slate';
  highlights: { label: string; detail: string }[];
}

const PATCH_RELEASES: PatchRelease[] = [
  {
    version: 'v1.5',
    tag: 'Latest Update',
    date: 'Nov 2026',
    title: 'Performance Overhaul, Ballistic Rebalance & Vampirism',
    accent: 'emerald',
    highlights: [
      {
        label: 'Potato Mode (Max FPS)',
        detail:
          'Added 3-tier Graphics Presets (High / Medium / Potato Mode) with 0.75x pixel scale, shadow/AA disable, Lambert material swap, close-range fog, and an always-on top-right FPS counter.',
      },
      {
        label: 'Weapon Damage Buff',
        detail:
          'Rebalanced arsenal damage across AR-X7 (38 dmg), SG-12 Breach (22x8 pellets), SR-50 (120 dmg), Vector-V9 (28 dmg), and .50 Desert Python (65 dmg / 3.0x headshot), plus floating damage numbers & micro screen shake.',
      },
      {
        label: 'Vampire Kill-Heal System',
        detail:
          'Eliminating hostile bots restores +10% Max HP (+25% on Wave 10 Boss) with a floating green heal indicator and audio chime.',
      },
      {
        label: 'Developer Console & Patch GUI',
        detail:
          'Added PIN-protected Secret Admin Panel (Shift+F12 / gisadmin) and Main Menu Patch Notes changelog modal.',
      },
    ],
  },
  {
    version: 'v1.4',
    tag: 'Boss & Combat Flow',
    date: 'Oct 2026',
    title: 'Wave 10 Boss Encounter & Empty-Mag Auto-Reload',
    accent: 'amber',
    highlights: [
      {
        label: 'Boss: The Specialist Anestesi',
        detail:
          'Wave 10 introduces an armored bio-hazard Boss equipped with anesthetic syringe darts, toxic gas clouds, scalpel dashes, and 2.2x dorsal weakspot multipliers.',
      },
      {
        label: 'Empty-Mag Auto-Reload',
        detail:
          'Weapons automatically initiate procedural reload animations and Web Audio SFX when hitting 0 rounds (cancelable on weapon swap).',
      },
    ],
  },
  {
    version: 'v1.3',
    tag: 'Social & Arsenal UX',
    date: 'Sep 2026',
    title: 'Interactive Leaderboard Profiles & Scroll Wheel Swap',
    accent: 'cyan',
    highlights: [
      {
        label: 'Operator Profile Inspection',
        detail:
          'Clicking any operative row in the Global, Weekly, or Personal Leaderboard opens their Operator Profile Card with visor avatar, rank, headshot ratio, accuracy, and favorite weapon.',
      },
      {
        label: 'Scroll Wheel Weapon Cycling',
        detail:
          'Smooth mouse-wheel cycling across all 7 arsenal slots plus Q quick-switch support.',
      },
    ],
  },
  {
    version: 'v1.2',
    tag: 'Foundation Release',
    date: 'Aug 2026',
    title: '3D Interactive Tactical Lobby & Crosshair Studio',
    accent: 'slate',
    highlights: [
      {
        label: '3D Hangar Deployment Bay',
        detail:
          'Orbitable 3D operative turntable with live visor accent preview, weapon inspection zoom, and procedural ambient soundscape.',
      },
      {
        label: 'Full Crosshair Customizer',
        detail:
          'Real-time editor for Classic, Dot, Circle, and Cross-Dot reticles with dynamic spread, outline, gap, and color controls.',
      },
    ],
  },
];

export const PatchNotesModal: React.FC<PatchNotesModalProps> = ({ onClose }) => {
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

  const versionColor = (accent: PatchRelease['accent']) => {
    switch (accent) {
      case 'emerald':
        return 'text-emerald-400';
      case 'amber':
        return 'text-amber-400';
      case 'cyan':
        return 'text-cyan-400';
      default:
        return 'text-slate-300';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 md:p-6 select-none"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Patch Notes v1.5"
        onClick={(e) => e.stopPropagation()}
        className="max-w-3xl w-full max-h-[86vh] flex flex-col bg-[#0F1623] border border-cyan-500/35 rounded-2xl shadow-2xl text-slate-100 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/35 flex items-center justify-center text-cyan-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-display font-bold text-white leading-tight truncate">
                Patch Notes
              </h2>
              <p className="text-xs font-mono-tech text-slate-400 truncate tabular-nums">
                GIS Shooter: Tactical Edition · Release v1.5 · Update History
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Patch Notes"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Changelog Timeline */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {PATCH_RELEASES.map((release, idx) => (
            <section
              key={release.version}
              className={idx > 0 ? 'pt-5 border-t border-slate-800/80' : ''}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
                <div className="flex items-baseline gap-2.5">
                  <span
                    className={`text-lg font-mono-tech font-bold tabular-nums ${versionColor(
                      release.accent
                    )}`}
                  >
                    {release.version}
                  </span>
                  <span className="text-xs font-mono-tech text-slate-400 uppercase tracking-wider">
                    {release.tag}
                  </span>
                </div>
                <span className="text-xs font-mono-tech text-slate-500 tabular-nums">
                  {release.date}
                </span>
              </div>

              <h3 className="text-base font-display font-semibold text-white mb-3">
                {release.title}
              </h3>

              <ul className="space-y-2.5">
                {release.highlights.map((item) => (
                  <li
                    key={item.label}
                    className="text-sm leading-relaxed text-slate-300 pl-3 border-b border-slate-800/40 pb-2.5 last:border-b-0 last:pb-0"
                  >
                    <span className="font-semibold text-white">{item.label}: </span>
                    <span className="text-slate-300">{item.detail}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-[#0B101B] flex items-center justify-between gap-4 shrink-0">
          <span className="text-xs font-mono-tech text-slate-400 tabular-nums">
            Active Build: v1.5 Tactical Edition
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
