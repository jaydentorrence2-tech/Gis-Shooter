/**
 * Armory & Loadout Side Drawer
 * Leaves left/center 3D viewport completely open so camera zoom-in highlights the Operator's weapon.
 */

import React, { useState } from 'react';
import {
  buildFourSlotLoadout,
  SLOT4_OPTIONS,
  Slot4Choice,
  WeaponDef,
} from '../game/weapons';
import { X, Check, Crosshair } from 'lucide-react';

interface ArmoryModalProps {
  preferredSlot: number;
  slot4Choice: Slot4Choice;
  onPreviewSlot: (slotIndex: number, overrideSlot4?: Slot4Choice) => void;
  onSelectSlot: (slotIndex: number) => void;
  onChangeSlot4: (choice: Slot4Choice) => void;
  onClose: () => void;
}

export const ArmoryModal: React.FC<ArmoryModalProps> = ({
  preferredSlot,
  slot4Choice,
  onPreviewSlot,
  onSelectSlot,
  onChangeSlot4,
  onClose,
}) => {
  const safePreferred = Math.max(0, Math.min(3, preferredSlot || 0));
  const [selectedIdx, setSelectedIdx] = useState<number>(safePreferred);
  const loadout = buildFourSlotLoadout(slot4Choice);
  const current: WeaponDef = loadout[selectedIdx] || loadout[0];

  const handleSelectTab = (idx: number) => {
    setSelectedIdx(idx);
    onPreviewSlot(idx, slot4Choice);
  };

  const handleChangeSlot4 = (choice: Slot4Choice) => {
    onChangeSlot4(choice);
    setSelectedIdx(3);
    onPreviewSlot(3, choice);
  };

  const handleSetPrimary = () => {
    onSelectSlot(selectedIdx);
    onClose();
  };

  const handleCancel = () => {
    onPreviewSlot(safePreferred, slot4Choice);
    onClose();
  };

  const isUtility = current.type === 'medkit' || current.type === 'grenade';
  const damagePct = isUtility
    ? 0
    : Math.min(100, Math.round(((current.damage * (current.pellets || 1)) / 176) * 100));
  const ratePct = isUtility
    ? 0
    : Math.min(100, Math.round(((1 / current.fireRate) / 16) * 100));
  const rangePct = isUtility ? 0 : Math.min(100, Math.round((current.range / 220) * 100));
  const precisionPct = isUtility
    ? 100
    : Math.max(10, Math.min(100, Math.round((1 - current.adsSpread / 0.06) * 100)));

  return (
    <div className="absolute inset-0 z-40 flex justify-end p-4 md:p-6 pointer-events-none select-none">
      <div className="max-w-md w-full h-full max-h-[720px] my-auto bg-[#131A26]/95 border border-slate-700/80 rounded-2xl p-6 shadow-2xl relative text-slate-100 flex flex-col justify-between pointer-events-auto overflow-y-auto">
        <div>
          <button
            onClick={handleCancel}
            aria-label="Close Armory"
            className="absolute top-5 right-5 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mb-4">
            <div className="text-xs font-mono-tech text-cyan-400 tracking-wider uppercase">
              Fixed 4-Slot Arsenal · Live Preview
            </div>
            <h2 className="text-2xl font-display font-bold tracking-tight text-white mt-0.5">
              Armory &amp; Loadout
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Operatives deploy with strictly 4 active loadout slots (Keys 1–4). Drag the 3D bay to inspect.
            </p>
          </div>

          {/* 4-Slot Selector Grid */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {loadout.map((wep, idx) => {
              const active = selectedIdx === idx;
              const isDefault = safePreferred === idx;
              return (
                <button
                  key={`${wep.id}-${idx}`}
                  onClick={() => handleSelectTab(idx)}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    active
                      ? 'bg-cyan-500/15 border-cyan-400 text-white'
                      : 'bg-[#0C1017] border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono-tech text-slate-400 mb-0.5">
                    <span>SLOT {wep.slot}</span>
                    {isDefault && <span className="text-amber-400 font-semibold">PRIMARY</span>}
                  </div>
                  <div className="font-display font-bold text-xs truncate">{wep.shortName}</div>
                </button>
              );
            })}
          </div>

          {/* Slot 4 Reserve Selector (.50 Desert Python vs Nano-Medkit) */}
          <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-3 mb-4">
            <div className="flex items-center justify-between text-[11px] font-mono-tech mb-2">
              <span className="text-slate-300 font-semibold">Slot 4 Tactical Reserve</span>
              <span className="text-amber-400">Sidearm or Medkit</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
              {SLOT4_OPTIONS.map((opt) => {
                const chosen = slot4Choice === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleChangeSlot4(opt.id as Slot4Choice)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                      chosen
                        ? opt.id === 'nano_medkit'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-cyan-500 text-slate-950'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {opt.shortName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Item Detail Panel */}
          <div className="bg-[#0C1017] border border-slate-800 rounded-xl p-4 mb-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
              <h3 className="text-lg font-display font-bold text-white">{current.name}</h3>
              <span className="text-[11px] font-mono-tech text-cyan-400">
                {current.caliber}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">{current.description}</p>

            {current.type === 'medkit' ? (
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800/80 font-mono-tech text-xs tabular-nums">
                <div>
                  <div className="text-slate-500">Health</div>
                  <div className="text-emerald-400 font-bold mt-0.5">+60 HP</div>
                </div>
                <div>
                  <div className="text-slate-500">Armor</div>
                  <div className="text-cyan-400 font-bold mt-0.5">+35 AP</div>
                </div>
                <div>
                  <div className="text-slate-500">Capacity</div>
                  <div className="text-white font-bold mt-0.5">2 / {current.maxReserve}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-3 border-t border-slate-800/80 tabular-nums">
                <div>
                  <div className="flex justify-between text-xs font-mono-tech mb-1">
                    <span className="text-slate-400">Damage Output</span>
                    <span className="text-white font-bold">
                      {current.damage}
                      {current.pellets ? ` x${current.pellets}` : ''}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${damagePct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-mono-tech mb-1">
                    <span className="text-slate-400">Fire Rate</span>
                    <span className="text-white font-bold">{Math.round(60 / current.fireRate)} RPM</span>
                  </div>
                  <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${ratePct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-mono-tech mb-1">
                    <span className="text-slate-400">Effective Range</span>
                    <span className="text-white font-bold">{current.range} m</span>
                  </div>
                  <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-400 rounded-full" style={{ width: `${rangePct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-mono-tech mb-1">
                    <span className="text-slate-400">ADS Precision</span>
                    <span className="text-white font-bold">{current.magSize} / {current.reserveAmmo} rds</span>
                  </div>
                  <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${precisionPct}%` }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            onClick={handleCancel}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition cursor-pointer"
          >
            Back
          </button>
          {!isUtility && (
            <button
              onClick={handleSetPrimary}
              className="flex-1 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
            >
              {safePreferred === selectedIdx ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" /> Equipped Primary
                </>
              ) : (
                <>
                  <Crosshair className="w-4 h-4" /> Set Starting Weapon
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
