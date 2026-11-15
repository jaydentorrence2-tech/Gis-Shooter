/**
 * Tactical In-Game HUD for GIS Shooter: Tactical Edition
 * - SR-50 Optical Sniper Scope Overlay when ADS
 * - Dynamic Reactive Crosshair + White/Red Hitmarker X
 * - Map-Aware Real-Time 2D Radar Minimap (arena floorplan + FOV cone + enemy blips)
 * - Health, Armor, 4-Slot Arsenal Strip, Ammo Counter & Kill Feed
 */

import React, { useEffect, useRef } from 'react';
import { DEFAULT_CROSSHAIR, GameState, PlayerProfileData } from '../game/GameEngine';
import { CrosshairReticle } from './CrosshairReticle';
import { Shield, Heart } from 'lucide-react';

interface HUDProps {
  state: GameState;
  profile: PlayerProfileData;
}

const WeaponMiniIcon: React.FC<{ type: string; active: boolean }> = ({ type, active }) => {
  const stroke = active ? '#22d3ee' : '#94a3b8';
  switch (type) {
    case 'rifle':
      return (
        <svg width="26" height="12" viewBox="0 0 36 14" fill="none" aria-hidden="true" className="shrink-0">
          <path d="M2 5h24l2 2h6v2h-6l-2 1H19l-1 3h-3l1-3H9l-3 3H2l1-4H2V5z" fill={stroke} />
          <rect x="13" y="2" width="7" height="2" rx="0.5" fill={stroke} />
        </svg>
      );
    case 'shotgun':
      return (
        <svg width="26" height="12" viewBox="0 0 36 14" fill="none" aria-hidden="true" className="shrink-0">
          <path d="M2 6h28v2H19l-1 2h-5l1-2H8l-4 4H1l2-4H2V6z" fill={stroke} />
          <rect x="18" y="8" width="8" height="2.2" rx="0.6" fill={active ? '#fbbf24' : '#64748b'} />
        </svg>
      );
    case 'sniper':
      return (
        <svg width="26" height="12" viewBox="0 0 36 14" fill="none" aria-hidden="true" className="shrink-0">
          <path d="M1 6h33v1.8H21l-1 2.2h-4l1-2.2H8l-4 3.7H1l1.5-3.7H1V6z" fill={stroke} />
          <rect x="10" y="2.2" width="11" height="2.2" rx="0.8" fill={active ? '#38bdf8' : '#cbd5e1'} />
          <path d="M25 8l3 4M25 8l-2 4" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case 'pistol':
      return (
        <svg width="22" height="12" viewBox="0 0 28 14" fill="none" aria-hidden="true" className="shrink-0">
          <path d="M4 3h19v3.5H12l-2 6H6l1.5-6H4V3z" fill={stroke} />
        </svg>
      );
    case 'medkit':
    default:
      return (
        <svg width="18" height="12" viewBox="0 0 20 14" fill="none" aria-hidden="true" className="shrink-0">
          <rect x="3" y="2" width="14" height="10" rx="2" stroke={active ? '#34d399' : stroke} strokeWidth="1.5" />
          <path d="M10 4.5v5M7.5 7h5" stroke={active ? '#34d399' : stroke} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
  }
};

export const HUD: React.FC<HUDProps> = React.memo(({ state, profile }) => {
  const radarCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeWep = state.weapons[state.activeWeaponIndex] || state.weapons[0];

  // Draw Map-Aware 2D Real-Time Radar Minimap
  useEffect(() => {
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radarRadius = w / 2 - 4;
    const scale = 1.65; // pixels per world meter

    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12, 16, 23, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.clip();

    const { playerX, playerZ, playerAngle, enemies, rects } = state.radarData;

    // Range Rings
    [15, 30].forEach((rMeters) => {
      ctx.beginPath();
      ctx.arc(cx, cy, rMeters * scale, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.14)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Player Heading FOV Cone (points straight up on radar)
    ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radarRadius, -Math.PI / 2 - 0.52, -Math.PI / 2 + 0.52);
    ctx.closePath();
    ctx.fill();

    // Rotate & draw arena floorplan geometry relative to player position & look yaw
    ctx.save();
    ctx.translate(cx, cy);
    // In Three.js forward is (sin(playerAngle), cos(playerAngle)) where playerAngle = atan2(dir.x, dir.z)
    // Rotate world so player heading points Up (-Y on canvas)
    ctx.rotate(playerAngle - Math.PI);
    ctx.scale(scale, scale);
    ctx.translate(-playerX, -playerZ);

    // Arena outer boundary (80x80)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1 / scale;
    ctx.strokeRect(-40, -40, 80, 80);

    // Obstacles & Platforms
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      ctx.save();
      ctx.translate(r.x, r.z);
      if (r.rotY) ctx.rotate(-r.rotY);

      if (r.kind === 'platform') {
        ctx.fillStyle = 'rgba(6, 182, 212, 0.18)';
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
        ctx.lineWidth = 0.8 / scale;
        ctx.fillRect(-r.w / 2, -r.d / 2, r.w, r.d);
        ctx.strokeRect(-r.w / 2, -r.d / 2, r.w, r.d);
      } else if (r.kind === 'crate') {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.38)';
        ctx.fillRect(-r.w / 2, -r.d / 2, r.w, r.d);
      } else {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.fillRect(-r.w / 2, -r.d / 2, r.w, r.d);
      }
      ctx.restore();
    }

    // Active Enemies & Wave 10 Boss
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.isDead) continue;
      if (e.isBoss) {
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(e.x, e.z, 4.8 / scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(e.x, e.z, 2.7 / scale, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(e.x, e.z, 2.5 / scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // Player Chevron at Radar Center
    ctx.fillStyle = profile.accentColor || '#06b6d4';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx + 5, cy + 5);
    ctx.lineTo(cx, cy + 2);
    ctx.lineTo(cx - 5, cy + 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }, [state.radarData, profile.accentColor]);

  const cs = state.cutscene;
  const inCutscene = Boolean(cs && cs.active);

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
      {/* 0. Module 19: Cinematic Boss Arrival Cutscene Layer */}
      {inCutscene && cs && (
        <div className="absolute inset-0 pointer-events-none z-30">
          {/* Slow Crimson Alert Pulse Vignette (CSS composited) */}
          <div
            className="animate-cutscene-pulse absolute inset-0"
            style={{
              boxShadow: 'inset 0 0 155px rgba(225, 29, 72, 0.78)',
              background:
                'radial-gradient(circle at center, transparent 52%, rgba(127, 29, 29, 0.22) 100%)',
            }}
          />

          {/* Glitch Horizontal Scan Bands (Impact / Alert / Reveal) */}
          {cs.glitchIntensity > 0.04 && (
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ opacity: cs.glitchIntensity }}
            >
              <div
                className="animate-glitch-strip absolute left-0 right-0 h-2 bg-rose-500/35"
                style={{ top: '22%' }}
              />
              <div
                className="animate-glitch-strip absolute left-0 right-0 h-3 bg-cyan-400/25"
                style={{ top: '48%', animationDelay: '0.06s' }}
              />
              <div
                className="animate-glitch-strip absolute left-0 right-0 h-1.5 bg-rose-400/45"
                style={{ top: '74%', animationDelay: '0.11s' }}
              />
            </div>
          )}

          {/* 2.39:1 Cinematic Letterbox Framing */}
          <div className="absolute top-0 left-0 right-0 h-[10vh] max-h-20 bg-[#05070c] border-b border-rose-500/35 flex items-center justify-between px-6">
            <span className="font-mono-tech text-[11px] font-bold tracking-[0.2em] text-rose-400 uppercase">
              ALERT CODE 10 · FACILITY CONTAINMENT BREACH
            </span>
            <span className="font-mono-tech text-[11px] text-slate-400 uppercase tabular-nums">
              WAVE 10 // T+{cs.elapsed.toFixed(1)}S
            </span>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-[10vh] max-h-20 bg-[#05070c] border-t border-rose-500/35 flex items-center justify-between px-6">
            <span className="font-mono-tech text-[11px] text-rose-300/90 uppercase tracking-wider">
              HOSTILE CLASS: HIGH-PRESSURE ANESTHETIC UNIT
            </span>
            {cs.canSkip && (
              <span className="font-mono-tech text-xs font-bold tracking-wider text-amber-300 uppercase">
                [SPACE] SKIP CUTSCENE
              </span>
            )}
          </div>

          {/* Futuristic Center Title Card */}
          {cs.showTitleCard && (
            <div className="animate-cutscene-title absolute inset-x-0 bottom-[14vh] flex justify-center px-4">
              <div
                className="relative max-w-4xl w-full bg-[#090d16]/92 border border-rose-500/80 px-8 py-5 text-center shadow-[0_0_55px_rgba(225,29,72,0.42)]"
                style={{
                  clipPath:
                    'polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)',
                }}
              >
                <div className="font-mono-tech text-[11px] font-bold tracking-[0.28em] text-amber-300 uppercase mb-1.5">
                  PRIORITY THREAT INTERCEPT
                </div>
                <div className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-[0.08em] text-white uppercase">
                  [ WARNING: BOSS BATTLE — THE SPECIALIST ANESTESI ]
                </div>
                <div className="mt-2.5 flex items-center justify-center gap-4 font-mono-tech text-xs text-rose-300 uppercase tracking-widest">
                  <span>SYRINGE BLASTER</span>
                  <span className="text-slate-600" aria-hidden="true">/</span>
                  <span>ANESTHETIC GAS</span>
                  <span className="text-slate-600" aria-hidden="true">/</span>
                  <span className="text-emerald-300">WEAKSPOT: DORSAL TANK</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 1. Damage Vignette & Flash-Frag Concussion Glare */}
      <div
        className="absolute inset-0 transition-opacity duration-150 pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 110px rgba(239, 68, 68, 0.88)',
          opacity: state.damageVignette,
        }}
      />
      {state.flashbangGlare > 0.01 && (
        <div
          className="absolute inset-0 pointer-events-none bg-cyan-50"
          style={{ opacity: Math.min(0.65, state.flashbangGlare) }}
        />
      )}

      {/* Anesthetic Slow / Gas Cloud Teal Vignette */}
      {(state.slowRemaining > 0 || state.inGasHazard) && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: state.inGasHazard
              ? 'inset 0 0 110px rgba(16, 185, 129, 0.55)'
              : 'inset 0 0 85px rgba(20, 184, 166, 0.35)',
          }}
        />
      )}

      {/* Low Health Border Warning */}
      {state.health > 0 && state.health <= 25 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ boxShadow: 'inset 0 0 60px rgba(220, 38, 38, 0.45)' }}
        />
      )}

      {/* Top-Center: Wave 10 Boss Health Bar OR 15s Prep Phase Countdown */}
      {state.bossState && state.bossState.active && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[min(520px,calc(100%-340px))] bg-[#0C1017]/95 border border-rose-500/60 rounded-xl px-4 py-2.5 shadow-xl">
          <div className="flex items-center justify-between text-xs font-mono-tech font-bold mb-1.5">
            <span className="text-rose-400 tracking-wider uppercase">{state.bossState.name}</span>
            <span className="text-emerald-300">
              {Math.round(state.bossState.health)} / {state.bossState.maxHealth} HP
            </span>
          </div>
          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-rose-600 via-amber-500 to-emerald-400 transition-all duration-100"
              style={{
                width: `${Math.max(0, Math.min(100, (state.bossState.health / state.bossState.maxHealth) * 100))}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono-tech mt-1.5">
            <span className="text-amber-300 font-semibold">{state.bossState.attackLabel}</span>
            <span className="text-slate-400">WEAKSPOT: DORSAL TANK (2.2x) · HEAD (2.0x)</span>
          </div>
        </div>
      )}

      {state.prepPhaseRemaining > 0 && !state.bossState && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#0C1017]/95 border border-cyan-500/60 rounded-xl px-5 py-2.5 text-center shadow-xl">
          <div className="text-[11px] font-mono-tech text-cyan-400 font-bold tracking-widest uppercase">
            PREP PHASE · WAVE {state.wave + 1 === 10 ? '10 BOSS NEXT' : state.wave + 1} IN{' '}
            {Math.ceil(state.prepPhaseRemaining)}S
          </div>
          <div className="text-xs font-mono-tech text-slate-200 mt-0.5">
            AMMO &amp; GEAR RESUPPLIED · RECOVER HP · PRESS <span className="text-amber-300 font-bold">[G]</span> TO DEPLOY EARLY
          </div>
        </div>
      )}

      {/* Boss Arrival / Defeated Banner */}
      {state.bossBanner && (
        <div
          className={`absolute top-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl border text-center shadow-2xl ${
            state.bossBanner.tone === 'emerald'
              ? 'bg-emerald-950/95 border-emerald-400/70 text-emerald-100'
              : 'bg-rose-950/95 border-rose-500/70 text-rose-100'
          }`}
        >
          <div className="text-sm font-display font-bold tracking-wider uppercase">
            {state.bossBanner.title}
          </div>
          <div className="text-[11px] font-mono-tech opacity-90 mt-0.5">
            {state.bossBanner.subtitle}
          </div>
        </div>
      )}

      {/* 2. SR-50 Tactical Sniper Scope Overlay */}
      {!inCutscene && state.isScoped && !state.isInventoryOpen && !state.isPaused && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {/* Darkened outer peripheral mask */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at center, transparent 28%, rgba(4, 7, 13, 0.96) 40%)',
            }}
          />
          <svg className="relative w-[58vh] h-[58vh]" viewBox="0 0 400 400">
            <circle cx="200" cy="200" r="192" fill="none" stroke="#0f172a" strokeWidth="8" />
            <circle cx="200" cy="200" r="186" fill="none" stroke="rgba(6, 182, 212, 0.4)" strokeWidth="1.5" />
            {/* Crosshair Lines */}
            <line x1="14" y1="200" x2="176" y2="200" stroke="rgba(226, 232, 240, 0.75)" strokeWidth="1.2" />
            <line x1="224" y1="200" x2="386" y2="200" stroke="rgba(226, 232, 240, 0.75)" strokeWidth="1.2" />
            <line x1="200" y1="14" x2="200" y2="176" stroke="rgba(226, 232, 240, 0.75)" strokeWidth="1.2" />
            <line x1="200" y1="224" x2="200" y2="386" stroke="rgba(226, 232, 240, 0.75)" strokeWidth="1.2" />
            {/* Thin inner stadia */}
            <line x1="176" y1="200" x2="224" y2="200" stroke="rgba(6, 182, 212, 0.85)" strokeWidth="0.9" />
            <line x1="200" y1="176" x2="200" y2="224" stroke="rgba(6, 182, 212, 0.85)" strokeWidth="0.9" />
            {/* Mil-dots */}
            {[-48, -32, -16, 16, 32, 48].map((offset) => (
              <g key={offset}>
                <circle cx={200 + offset} cy="200" r="1.8" fill="#06b6d4" />
                <circle cx="200" cy={200 + offset} r="1.8" fill="#06b6d4" />
              </g>
            ))}
            {/* Center Illuminated Red/Cyan Reticle Dot */}
            <circle cx="200" cy="200" r="2.2" fill="#ef4444" />
            <text x="215" y="185" fill="rgba(6, 182, 212, 0.8)" fontSize="10" fontFamily="monospace">
              8X OPTIC
            </text>
          </svg>
        </div>
      )}

      {/* 3. Top-Left: Map-Aware Radar & Wave Info */}
      {!inCutscene && (
        <div className="absolute top-4 left-4 flex items-start gap-3">
        <div className="relative bg-[#0C1017]/90 p-1.5 rounded-xl border border-cyan-500/40 shadow-lg">
          <canvas ref={radarCanvasRef} width={140} height={140} className="rounded-lg" />
          <div className="mt-1 px-1.5 flex justify-between text-[10px] font-mono-tech text-slate-400">
            <span className="text-cyan-400 font-semibold">RADAR</span>
            <span>{profile.callsign}</span>
          </div>
        </div>

        <div className="bg-[#0C1017]/90 border border-slate-700/80 rounded-xl px-4 py-2.5 min-w-[155px] text-white">
          <div className="text-[11px] font-mono-tech text-cyan-400 font-semibold tracking-wider uppercase">
            Wave {state.wave < 10 ? `0${state.wave}` : state.wave}
          </div>
          <div className="text-xl font-mono-tech font-bold text-white mt-0.5">
            {state.enemiesRemaining}{' '}
            <span className="text-xs font-normal text-slate-400">Hostiles</span>
          </div>
          <div className="text-xs font-mono-tech text-emerald-400 mt-1 font-semibold">
            Score {state.score.toLocaleString()}
          </div>
        </div>
      </div>
      )}

      {/* 4. Top-Right: Real-Time FPS Counter & Kill Feed */}
      {!inCutscene && (
        <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5 max-w-sm">
        <div className="bg-[#0C1017]/90 border border-slate-700/80 rounded-lg px-3 py-1.5 flex items-center gap-2.5 text-xs font-mono-tech tabular-nums shadow-lg">
          <span
            className={`font-bold ${
              state.fps >= 50
                ? 'text-emerald-400'
                : state.fps >= 30
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            {state.fps} FPS
          </span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span className="text-slate-300 font-semibold">
            {state.fps >= 50 ? 'OPTIMAL' : state.fps >= 30 ? 'STABLE' : 'LOW'}
          </span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span
            className={`font-semibold uppercase ${
              profile.graphicsPreset === 'potato'
                ? 'text-emerald-300'
                : profile.graphicsPreset === 'medium'
                ? 'text-amber-300'
                : 'text-cyan-300'
            }`}
          >
            {profile.graphicsPreset === 'potato' ? 'POTATO' : profile.graphicsPreset}
          </span>
        </div>

        {(state.adminCheats?.godMode ||
          state.adminCheats?.infiniteAmmo ||
          (state.adminCheats?.speedMultiplier ?? 1) > 1.01 ||
          (state.adminCheats?.jumpMultiplier ?? 1) > 1.01) && (
          <div className="bg-[#0C1017]/90 border border-amber-500/50 rounded-lg px-3 py-1 flex items-center gap-2 text-[11px] font-mono-tech text-amber-300 tabular-nums shadow">
            {state.adminCheats.godMode && <span className="font-bold text-emerald-400">GOD MODE</span>}
            {state.adminCheats.infiniteAmmo && <span className="font-bold text-cyan-400">INF AMMO</span>}
            {(state.adminCheats.speedMultiplier > 1.01 || state.adminCheats.jumpMultiplier > 1.01) && (
              <span className="text-amber-300">
                SPD {state.adminCheats.speedMultiplier.toFixed(1)}x · JMP {state.adminCheats.jumpMultiplier.toFixed(1)}x
              </span>
            )}
          </div>
        )}

        {state.killFeed.map((item) => (
          <div
            key={item.id}
            className={`px-3 py-1 rounded-lg text-xs font-mono-tech font-semibold border ${
              item.headshot
                ? 'bg-red-950/90 border-red-500/60 text-red-200'
                : 'bg-[#0C1017]/90 border-slate-700 text-slate-200'
            }`}
          >
            {item.text}
          </div>
        ))}
      </div>
      )}

      {/* 5. Center Customizable Dynamic Crosshair, Hitmarker & Vampire Kill-Heal Popup */}
      {!inCutscene && !state.isInventoryOpen && !state.isPaused && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
          {state.vampireHealEvent && (
            <div
              key={state.vampireHealEvent.id}
              className="animate-vampire-float absolute -top-12 left-1/2 pointer-events-none whitespace-nowrap font-mono-tech text-sm font-bold text-emerald-400 tracking-wide"
              style={{ textShadow: '0 2px 10px rgba(6, 78, 59, 0.95)' }}
            >
              {state.vampireHealEvent.label}
            </div>
          )}
          {!state.isScoped ? (
            <CrosshairReticle
              config={profile.crosshair || DEFAULT_CROSSHAIR}
              spread={state.crosshairSpread}
              isAiming={state.isAiming}
              hitmarkerActive={state.hitmarkerActive}
              hitmarkerHeadshot={state.hitmarkerHeadshot}
            />
          ) : (
            state.hitmarkerActive && (
              <div
                className={`pointer-events-none ${
                  state.hitmarkerHeadshot ? 'text-red-500 scale-125' : 'text-white'
                }`}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" className="stroke-current stroke-[2.5]">
                  <line x1="4" y1="4" x2="9" y2="9" />
                  <line x1="20" y1="4" x2="15" y2="9" />
                  <line x1="4" y1="20" x2="9" y2="15" />
                  <line x1="20" y1="20" x2="15" y2="15" />
                </svg>
              </div>
            )
          )}
        </div>
      )}

      {/* 6. Bottom-Left: Hazard Status + Health & Armor */}
      {!inCutscene && (
        <div className="absolute bottom-6 left-6 flex flex-col gap-2">
        {(state.slowRemaining > 0 || state.inGasHazard) && (
          <div className="flex flex-wrap gap-1.5">
            {state.slowRemaining > 0 && (
              <div className="px-2.5 py-1 rounded-lg bg-teal-950/95 border border-teal-400/70 text-[11px] font-mono-tech font-bold text-teal-200">
                ANESTHETIC SLOW · {state.slowRemaining.toFixed(1)}s
              </div>
            )}
            {state.inGasHazard && (
              <div className="px-2.5 py-1 rounded-lg bg-emerald-950/95 border border-emerald-400/70 text-[11px] font-mono-tech font-bold text-emerald-200">
                TOXIC GAS · LEAVE ZONE
              </div>
            )}
          </div>
        )}
        <div className="bg-[#0C1017]/90 border border-slate-700/80 rounded-xl px-4 py-2.5 w-68">
          <div className="flex justify-between items-center text-xs font-mono-tech font-bold mb-1">
            <span className="flex items-center gap-1.5 text-rose-400">
              <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" /> HEALTH
            </span>
            <span className="text-white">
              {Math.round(state.health)} / {state.maxHealth}
            </span>
          </div>
          <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full rounded-full transition-all duration-150 bg-gradient-to-r from-red-600 via-rose-500 to-emerald-400"
              style={{ width: `${(state.health / state.maxHealth) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-[#0C1017]/90 border border-slate-700/80 rounded-xl px-4 py-2.5 w-68">
          <div className="flex justify-between items-center text-xs font-mono-tech font-bold mb-1">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <Shield className="w-3.5 h-3.5 fill-cyan-500 text-cyan-500" /> ARMOR
            </span>
            <span className="text-white">
              {Math.round(state.armor)} / {state.maxArmor}
            </span>
          </div>
          <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full rounded-full transition-all duration-150 bg-gradient-to-r from-blue-600 to-cyan-400"
              style={{ width: `${(state.armor / state.maxArmor) * 100}%` }}
            />
          </div>
        </div>
      </div>
      )}

      {/* 7. Bottom-Right: Fixed 4-Slot Loadout Indicator Cards, Flashlight & Ammo Counter */}
      {!inCutscene && (
        <div className="absolute bottom-6 right-6 flex items-end gap-3">
        <div className="flex flex-col gap-1.5">
          {state.weapons.slice(0, 4).map((w, idx) => {
            const isActive = state.activeWeaponIndex === idx;
            const isUtility = w.type === 'medkit' || w.type === 'grenade';
            const isEmpty = w.currentAmmo === 0 && (isUtility || w.reserveAmmo <= 0);
            return (
              <div
                key={w.id}
                className={`px-3 py-1.5 rounded-xl border text-[11px] font-mono-tech flex items-center justify-between gap-3 min-w-[208px] transition-all tabular-nums ${
                  isActive
                    ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-[0_0_16px_rgba(6,182,212,0.28)]'
                    : 'bg-[#0C1017]/90 border-slate-800 text-slate-400'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 ${
                    isActive
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-slate-900 border border-slate-700 text-slate-400'
                  }`}
                >
                  {w.slot}
                </span>
                <WeaponMiniIcon type={w.type} active={isActive} />
                <span
                  className={`flex-1 truncate font-display font-bold tracking-wide ${
                    isActive ? 'text-white' : 'text-slate-300'
                  }`}
                >
                  {w.shortName}
                </span>
                <span
                  className={`font-bold shrink-0 ${
                    isEmpty
                      ? 'text-rose-400'
                      : isActive
                      ? w.type === 'medkit'
                        ? 'text-emerald-300'
                        : 'text-cyan-300'
                      : 'text-slate-300'
                  }`}
                >
                  {isUtility ? `x${w.currentAmmo}` : `${w.currentAmmo}/${w.reserveAmmo}`}
                </span>
              </div>
            );
          })}
        </div>

        <div className="bg-[#0C1017]/90 border border-slate-700/80 rounded-2xl p-4 min-w-[220px] text-right">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-[10px] font-mono-tech px-1.5 py-0.5 rounded border ${
                state.flashlightOn
                  ? 'border-amber-400/70 text-amber-300 bg-amber-500/15'
                  : 'border-slate-700 text-slate-500 bg-slate-900/70'
              }`}
            >
              [F] LIGHT {state.flashlightOn ? 'ON' : 'OFF'}
            </span>
            <span className="text-xs font-display font-bold text-cyan-400 tracking-wide uppercase">
              {activeWep.name}
            </span>
          </div>

          {activeWep.type === 'medkit' ? (
            <div className="mt-1">
              <div className="text-3xl font-mono-tech font-bold text-emerald-400">
                x{activeWep.currentAmmo}
              </div>
              <div className="text-[11px] font-mono-tech text-slate-400 mt-1">
                L-CLICK TO INJECT
              </div>
            </div>
          ) : activeWep.type === 'grenade' ? (
            <div className="mt-1">
              <div className="text-3xl font-mono-tech font-bold text-amber-400">
                x{activeWep.currentAmmo}
              </div>
              <div className="text-[11px] font-mono-tech text-slate-400 mt-1">
                L-CLICK TO THROW · STUNS 2.5S
              </div>
            </div>
          ) : (
            <div className="mt-1">
              <div className="flex items-baseline justify-end gap-2 font-mono-tech">
                <span className="text-4xl font-bold text-white">
                  {state.isReloading ? '--' : activeWep.currentAmmo}
                </span>
                <span className="text-lg font-semibold text-slate-500">
                  / {activeWep.reserveAmmo}
                </span>
              </div>
              <div className="text-[11px] font-mono-tech mt-1">
                {state.isReloading ? (
                  <span className="text-amber-400 font-bold">RELOADING...</span>
                ) : activeWep.currentAmmo === 0 && activeWep.reserveAmmo <= 0 ? (
                  <span className="text-red-400 font-bold">OUT OF AMMO</span>
                ) : activeWep.currentAmmo === 0 ? (
                  <span className="text-red-400 font-bold">PRESS [R] TO RELOAD</span>
                ) : (
                  <span className="text-slate-400">{activeWep.caliber}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* 8. Subtle Bottom Key Hint */}
      {!inCutscene && (
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-lg bg-[#0C1017]/85 border border-slate-800/80 text-[11px] font-mono-tech text-slate-400 whitespace-nowrap">
          WASD Move · C Crouch · L-Click Fire · R-Click ADS · R Reload · F Light · 1–4 / Scroll Swap · Q Quick-Switch · Tab Inventory
        </div>
      )}
    </div>
  );
});
