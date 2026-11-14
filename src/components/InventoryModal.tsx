/**
 * Tactical Inventory Modal (Tab / I key)
 * Displays all 4 slots (AR-X7, SG-12, SR-50, Nano-Medkit) for mid-combat equipping or healing.
 */

import React from 'react';
import { GameState } from '../game/GameEngine';
import { X, Check } from 'lucide-react';

interface InventoryModalProps {
  state: GameState;
  onEquip: (index: number) => void;
  onUseMedkit: () => void;
  onClose: () => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  state,
  onEquip,
  onUseMedkit,
  onClose,
}) => {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/85 p-4 select-none">
      <div className="max-w-4xl w-full bg-[#131A26] border border-slate-700/80 rounded-2xl p-6 shadow-2xl relative text-slate-100">
        <button
          onClick={onClose}
          aria-label="Close Inventory"
          className="absolute top-5 right-5 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-5">
          <div className="text-xs font-mono-tech text-cyan-400 uppercase tracking-wider">
            Field Loadout · Scroll Wheel or 1–7 to Switch · Press Tab or I to return
          </div>
          <h2 className="text-2xl font-display font-bold text-white mt-0.5">
            Tactical Inventory
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5 max-h-[65vh] overflow-y-auto pr-1">
          {state.weapons.map((wep, idx) => {
            const isEquipped = state.activeWeaponIndex === idx;
            return (
              <div
                key={wep.id}
                className={`flex flex-col justify-between p-3.5 rounded-xl border transition ${
                  isEquipped
                    ? 'bg-slate-800/80 border-cyan-400'
                    : 'bg-[#0C1017] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center text-[11px] font-mono-tech text-slate-400 mb-1.5">
                    <span>SLOT {wep.slot}</span>
                    {isEquipped && (
                      <span className="text-cyan-400 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[3]" /> ACTIVE
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-display font-bold text-white mb-0.5">{wep.name}</h3>
                  <div className="text-[11px] font-mono-tech text-slate-500 mb-2">
                    {wep.caliber}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">{wep.description}</p>
                </div>

                <div>
                  {wep.type === 'medkit' ? (
                    <div className="space-y-1.5 mb-3 pt-2 border-t border-slate-800 text-xs font-mono-tech">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Restore</span>
                        <span className="text-emerald-400 font-bold">+60 HP / +35 AP</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Charges</span>
                        <span className="text-white font-bold">
                          {wep.currentAmmo} / {wep.maxReserve}
                        </span>
                      </div>
                    </div>
                  ) : wep.type === 'grenade' ? (
                    <div className="space-y-1.5 mb-3 pt-2 border-t border-slate-800 text-xs font-mono-tech">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Blast / Stun</span>
                        <span className="text-amber-400 font-bold">{wep.damage} HP · 2.5s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Count</span>
                        <span className="text-cyan-400 font-bold">
                          x{wep.currentAmmo} / {wep.maxReserve}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 mb-3 pt-2 border-t border-slate-800 text-xs font-mono-tech">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Damage</span>
                        <span className="text-white font-bold">
                          {wep.damage}
                          {wep.pellets ? ` x${wep.pellets}` : ''}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Ammo</span>
                        <span className="text-cyan-400 font-bold">
                          {wep.currentAmmo} / {wep.reserveAmmo}
                        </span>
                      </div>
                    </div>
                  )}

                  {wep.type === 'medkit' ? (
                    <button
                      onClick={onUseMedkit}
                      disabled={
                        wep.currentAmmo <= 0 ||
                        (state.health >= state.maxHealth && state.armor >= state.maxArmor)
                      }
                      className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs uppercase transition cursor-pointer"
                    >
                      {wep.currentAmmo <= 0 ? 'Depleted' : 'Use Medkit'}
                    </button>
                  ) : (
                    <button
                      onClick={() => onEquip(idx)}
                      disabled={isEquipped}
                      className={`w-full py-2 rounded-lg font-bold text-xs uppercase transition cursor-pointer ${
                        isEquipped
                          ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                          : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                      }`}
                    >
                      {isEquipped ? 'Equipped' : `Equip [${wep.slot}]`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition cursor-pointer"
          >
            Resume Combat
          </button>
        </div>
      </div>
    </div>
  );
};
