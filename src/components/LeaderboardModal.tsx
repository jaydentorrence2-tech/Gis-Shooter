/**
 * Centered Hybrid Global / Local Leaderboard Modal with Interactive Operator Profile Inspection
 * Clicking any operator row opens a centered "Operator Profile Card" pop-up showing visor avatar,
 * rank & level, total kills, headshot ratio, accuracy, and favorite weapon.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Trophy, X, Medal, Calendar, UserCheck, Globe, Crosshair, ChevronRight } from 'lucide-react';
import {
  formatSurvivalTime,
  getMergedLeaderboard,
  LeaderboardTab,
  RankedLeaderboardRow,
  resolveOperatorProfileDetails,
} from '../game/leaderboard';
import type { PlayerProfileData } from '../game/GameEngine';

interface LeaderboardModalProps {
  activeCallsign: string;
  profile?: PlayerProfileData;
  initialTab?: LeaderboardTab;
  onClose: () => void;
}

const TABS: { id: LeaderboardTab; label: string; icon: React.ReactNode }[] = [
  { id: 'global', label: 'Global Top 100', icon: <Globe className="w-3.5 h-3.5" /> },
  { id: 'personal', label: 'Personal Best', icon: <UserCheck className="w-3.5 h-3.5" /> },
  { id: 'weekly', label: 'Weekly Season', icon: <Calendar className="w-3.5 h-3.5" /> },
];

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  activeCallsign,
  profile,
  initialTab = 'global',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>(initialTab);
  const [selectedRow, setSelectedRow] = useState<RankedLeaderboardRow | null>(null);

  const board = useMemo(
    () => getMergedLeaderboard(activeTab, activeCallsign),
    [activeTab, activeCallsign]
  );

  const selectedOperator = useMemo(
    () => (selectedRow ? resolveOperatorProfileDetails(selectedRow, profile) : null),
    [selectedRow, profile]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedRow) {
          e.stopPropagation();
          setSelectedRow(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedRow, onClose]);

  const renderRankCell = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="inline-flex items-center gap-1 font-mono-tech font-bold text-amber-400 tabular-nums">
          <Medal className="w-3.5 h-3.5 text-amber-400" />
          #1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="inline-flex items-center gap-1 font-mono-tech font-bold text-slate-200 tabular-nums">
          <Medal className="w-3.5 h-3.5 text-slate-300" />
          #2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="inline-flex items-center gap-1 font-mono-tech font-bold text-amber-600 tabular-nums">
          <Medal className="w-3.5 h-3.5 text-amber-600" />
          #3
        </span>
      );
    }
    return (
      <span className="font-mono-tech font-semibold text-slate-400 tabular-nums">
        #{rank}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 md:p-6 select-none">
      <div className="max-w-4xl w-full max-h-[88vh] flex flex-col bg-[#0F1623]/95 border border-cyan-500/35 rounded-2xl shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800/90 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/35 flex items-center justify-center text-cyan-400 shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-display font-bold text-white leading-tight truncate">
                Tactical Leaderboard
              </h2>
              <p className="text-xs font-mono-tech text-slate-400 truncate">
                Hybrid Global &amp; Local Operative Rankings · Season {board.weekKey}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close leaderboard"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Operative Rank Strip + Tab Controls */}
        <div className="px-6 py-3.5 border-b border-slate-800/80 bg-[#0B101B]/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 border border-slate-800">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setSelectedRow(null);
                    setActiveTab(tab.id);
                  }}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2.5 text-xs font-mono-tech text-slate-300 tabular-nums">
            <span className="text-slate-400">Operative:</span>
            <span className="font-bold text-cyan-400">{activeCallsign}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-slate-400">Rank:</span>
            <span className="font-bold text-amber-400">
              {board.activePlayerBestRank ? `#${board.activePlayerBestRank}` : 'Unranked'}
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-slate-400">Runs:</span>
            <span className="font-bold text-white">{board.localRunCount}</span>
          </div>
        </div>

        {/* Scrollable Rankings Table */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {board.rows.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto mb-3">
                <Trophy className="w-6 h-6" />
              </div>
              <div className="text-base font-display font-semibold text-white mb-1">
                No Personal Runs Submitted Yet
              </div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Deploy into the combat arena and click Submit Score on the Mission Debrief screen to record your personal bests here.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#0F1623] z-10 border-b border-slate-800">
                <tr className="text-[11px] font-mono-tech uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 pr-3 font-semibold w-16">Rank</th>
                  <th className="py-2.5 px-3 font-semibold">Operator</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Wave</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Kills</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Accuracy</th>
                  <th className="py-2.5 px-3 font-semibold text-right hidden sm:table-cell">Time</th>
                  <th className="py-2.5 pl-3 font-semibold text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {board.rows.map((row) => {
                  const highlight = row.isActivePlayer || (activeTab === 'personal' && row.isPlayer);
                  return (
                    <tr
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedRow(row)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedRow(row);
                        }
                      }}
                      title={`Inspect ${row.callsign} Operator Profile`}
                      className={`group transition-colors cursor-pointer focus:outline-none focus-visible:bg-cyan-500/20 ${
                        highlight
                          ? 'bg-cyan-500/15 hover:bg-cyan-500/25 text-white'
                          : 'hover:bg-slate-800/60 text-slate-200'
                      }`}
                    >
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        {renderRankCell(row.rank)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base leading-none shrink-0" title={row.countryCode}>
                            {row.flag}
                          </span>
                          <span
                            className={`font-mono-tech font-semibold truncate group-hover:text-cyan-300 transition-colors ${
                              highlight ? 'text-cyan-300' : 'text-slate-100'
                            }`}
                          >
                            {row.callsign}
                          </span>
                          {row.isPlayer && (
                            <span className="text-[10px] font-mono-tech font-semibold text-cyan-400 shrink-0">
                              · YOU
                            </span>
                          )}
                          <ChevronRight className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tech text-slate-300 tabular-nums whitespace-nowrap">
                        W{row.wave}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tech font-semibold text-white tabular-nums whitespace-nowrap">
                        {row.kills}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tech text-emerald-400 tabular-nums whitespace-nowrap">
                        {row.accuracy}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tech text-slate-400 tabular-nums whitespace-nowrap hidden sm:table-cell">
                        {formatSurvivalTime(row.survivalSec)}
                      </td>
                      <td className="py-2.5 pl-3 text-right font-mono-tech font-bold text-amber-400 tabular-nums whitespace-nowrap">
                        {row.score.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800/90 bg-[#0B101B]/90 flex items-center justify-between gap-4 shrink-0">
          <span className="text-[11px] font-mono-tech text-slate-400">
            Click any operator row to inspect dossier · Showing top {board.rows.length} operatives
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            Close
          </button>
        </div>
      </div>

      {/* Centered "Operator Profile Card" Pop-Up Sub-Modal */}
      {selectedRow && selectedOperator && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-4"
          onClick={() => setSelectedRow(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedOperator.callsign} Operator Profile Card`}
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full bg-[#131A26] border border-cyan-400/45 rounded-2xl p-6 shadow-2xl text-slate-100"
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3.5 min-w-0">
                {/* Tactical Avatar / Visor Accent Swatch */}
                <div
                  className="w-14 h-14 rounded-xl flex flex-col items-center justify-center font-display font-bold text-slate-950 text-xl shrink-0 border border-white/25 relative overflow-hidden"
                  style={{ backgroundColor: selectedOperator.avatarColor }}
                >
                  <span>{selectedOperator.callsign.substring(0, 2).toUpperCase()}</span>
                  <span
                    aria-hidden="true"
                    className="absolute bottom-1.5 inset-x-2 h-1 rounded-full bg-slate-950/45"
                  />
                </div>

                <div className="min-w-0">
                  <div className="text-[11px] font-mono-tech text-cyan-400 uppercase tracking-wider truncate">
                    {selectedOperator.rankTitle} · Level {selectedOperator.level}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-lg leading-none shrink-0" title={selectedOperator.countryCode}>
                      {selectedOperator.flag}
                    </span>
                    <h3 className="text-xl font-display font-bold text-white truncate">
                      {selectedOperator.callsign}
                    </h3>
                  </div>
                  <div className="text-[11px] font-mono-tech text-slate-400 mt-0.5 tabular-nums">
                    Rank #{selectedRow.rank} · Wave {selectedOperator.wave} · {formatSurvivalTime(selectedOperator.survivalSec)}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                aria-label="Close operator profile card"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Detail Combat Metrics */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3">
                <div className="text-[11px] text-slate-400">Total Kills</div>
                <div className="text-lg font-mono-tech font-bold text-white mt-0.5 tabular-nums">
                  {selectedOperator.kills}
                </div>
              </div>

              <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3">
                <div className="text-[11px] text-slate-400">Headshot Ratio</div>
                <div className="text-lg font-mono-tech font-bold text-amber-400 mt-0.5 tabular-nums">
                  {selectedOperator.headshotRatio}%
                </div>
              </div>

              <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3">
                <div className="text-[11px] text-slate-400">Accuracy</div>
                <div className="text-lg font-mono-tech font-bold text-emerald-400 mt-0.5 tabular-nums">
                  {selectedOperator.accuracy}%
                </div>
              </div>

              <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3">
                <div className="text-[11px] text-slate-400">Record Score</div>
                <div className="text-lg font-mono-tech font-bold text-cyan-300 mt-0.5 tabular-nums">
                  {selectedOperator.score.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Favorite Weapon Strip */}
            <div className="bg-[#0C1017] border border-slate-800 rounded-xl px-4 py-3 mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Crosshair className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Favorite Weapon</span>
              </div>
              <span className="font-display font-bold text-sm text-white truncate">
                {selectedOperator.favoriteWeapon}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedRow(null)}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
