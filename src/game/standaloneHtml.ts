/**
 * Generates a 100% self-contained single-file HTML deliverable for:
 * "GIS Shooter: Tactical Edition"
 * Complete with Three.js r128 CDN, custom PointerLock mouse-look, layered Web Audio API,
 * normal/bump-mapped procedural Tactical Facility, 4 multi-component PBR weapons,
 * articulated walking AI bots (2.5x headshot hitbox, LOS, strafing, death collapse),
 * shell ejection, wall bullet decals, orbiting 3D main menu, Armory, Profile, Settings,
 * Inventory (Tab/I), Scope overlay, and map-aware 2D Radar.
 */

import firebaseConfig from '../../firebase-applet-config.json';

export function generateStandaloneHtml(): string {
  const safeFirebaseJson = JSON.stringify(firebaseConfig).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%230C1017'/%3E%3Ccircle cx='16' cy='16' r='8' fill='none' stroke='%2322d3ee' stroke-width='2'/%3E%3Cpath d='M16 4v6M16 22v6M4 16h6M22 16h6' stroke='%2322d3ee' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E" />
  <title>GIS Shooter: Tactical Edition</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=JetBrains+Mono:wght@500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; user-select: none; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #0C1017; color: #f8fafc; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
    .font-display { font-family: 'Chakra Petch', system-ui, sans-serif; }
    .font-mono { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
    #canvas-wrap { position: absolute; inset: 0; width: 100%; height: 100%; }

    /* HUD */
    #hud { position: absolute; inset: 0; pointer-events: none; display: none; }
    #damage-vignette { position: absolute; inset: 0; box-shadow: inset 0 0 110px rgba(239,68,68,0.88); opacity: 0; transition: opacity 0.14s; }
    #flash-glare { position: absolute; inset: 0; background: #ecfeff; opacity: 0; pointer-events: none; }
    #lowhp-vignette { position: absolute; inset: 0; box-shadow: inset 0 0 60px rgba(220,38,38,0.45); display: none; }
    #scope-overlay { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; }
    .scope-mask { position: absolute; inset: 0; background: radial-gradient(circle at center, transparent 28%, rgba(4,7,13,0.96) 40%); }
    .radar-panel { position: absolute; top: 16px; left: 16px; display: flex; gap: 12px; align-items: flex-start; }
    .radar-card { background: rgba(12,16,23,0.9); border: 1px solid rgba(6,182,212,0.45); border-radius: 12px; padding: 6px; }
    .wave-card { background: rgba(12,16,23,0.9); border: 1px solid rgba(51,65,85,0.85); border-radius: 12px; padding: 10px 16px; min-width: 155px; }
    #top-right-stack { position: absolute; top: 16px; right: 16px; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; max-width: 360px; }
    #fps-box { background: rgba(12,16,23,0.9); border: 1px solid rgba(51,65,85,0.85); border-radius: 8px; padding: 5px 11px; font-size: 12px; display: flex; align-items: center; gap: 8px; font-variant-numeric: tabular-nums; box-shadow: 0 6px 18px rgba(0,0,0,0.45); }
    #killfeed { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
    .kf-item { padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; border: 1px solid #334155; background: rgba(12,16,23,0.9); }
    .kf-item.hs { background: rgba(127,29,29,0.9); border-color: rgba(239,68,68,0.65); color: #fecaca; }
    .gfx-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; background: #090d14; padding: 4px; border-radius: 9px; border: 1px solid #1e293b; }
    .gfx-btn { padding: 7px 6px; border-radius: 6px; border: none; background: transparent; color: #cbd5e1; font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: background 0.12s, color 0.12s; }
    .gfx-btn:hover { background: #1e293b; color: #fff; }
    .gfx-btn.active { background: #06b6d4; color: #020617; font-weight: 700; }
    .gfx-btn.active.potato { background: #10b981; color: #020617; font-weight: 700; }

    #crosshair { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 128px; height: 128px; pointer-events: none; display: flex; align-items: center; justify-content: center; }
    #hitmarker { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); display: none; pointer-events: none; }
    @keyframes vampFloat {
      0% { opacity: 0; transform: translate(-50%, 6px) scale(0.92); }
      18% { opacity: 1; transform: translate(-50%, -2px) scale(1.06); }
      72% { opacity: 1; transform: translate(-50%, -22px) scale(1); }
      100% { opacity: 0; transform: translate(-50%, -34px) scale(0.96); }
    }
    .vamp-pop { position: absolute; top: calc(50% - 46px); left: 50%; transform: translate(-50%, 0); pointer-events: none; display: none; font-size: 14px; font-weight: 700; color: #34d399; letter-spacing: 0.04em; white-space: nowrap; text-shadow: 0 2px 10px rgba(6,78,59,0.95); }
    .vamp-pop.active { display: block; animation: vampFloat 0.95s cubic-bezier(0.22,1,0.36,1) forwards; }
    .ch-style-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; background: #0C1017; padding: 4px; border-radius: 10px; border: 1px solid #1e293b; }
    .ch-style-btn { padding: 7px 4px; border-radius: 7px; border: none; background: transparent; color: #94a3b8; font-size: 11px; font-weight: 600; cursor: pointer; }
    .ch-style-btn.active { background: #06b6d4; color: #020617; font-weight: 700; }
    .ch-preview-box { height: 116px; border-radius: 12px; border: 1px solid #334155; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; margin-bottom: 12px; background: radial-gradient(circle at center, #1a2436 0%, #090d14 100%); }
    .ch-preview-box.bright { background: linear-gradient(135deg, #e2e8f0 0%, #94a3b8 55%, #cbd5e1 100%); }

    .vitals { position: absolute; bottom: 24px; left: 24px; display: flex; flex-direction: column; gap: 8px; width: 272px; }
    .vital-card { background: rgba(12,16,23,0.9); border: 1px solid rgba(51,65,85,0.85); border-radius: 12px; padding: 10px 14px; }
    .bar-track { width: 100%; height: 9px; background: #020617; border-radius: 999px; overflow: hidden; margin-top: 5px; border: 1px solid #1e293b; }
    .bar-hp { height: 100%; width: 100%; background: linear-gradient(90deg, #dc2626, #f43f5e, #10b981); transition: width 0.15s; }
    .bar-ap { height: 100%; width: 100%; background: linear-gradient(90deg, #2563eb, #06b6d4); transition: width 0.15s; }

    .arsenal-hud { position: absolute; bottom: 24px; right: 24px; display: flex; align-items: flex-end; gap: 12px; }
    .slot-list { display: flex; flex-direction: column; gap: 6px; }
    .slot-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-width: 210px; padding: 6px 11px; border-radius: 10px; border: 1px solid #1e293b; background: rgba(12,16,23,0.92); font-size: 11px; color: #94a3b8; transition: all 0.15s; }
    .slot-row.active { border-color: #22d3ee; background: rgba(6,182,212,0.22); color: #ffffff; box-shadow: 0 0 16px rgba(6,182,212,0.28); }
    .slot-key { width: 20px; height: 20px; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px; background: #0f172a; border: 1px solid #334155; color: #94a3b8; flex-shrink: 0; }
    .slot-row.active .slot-key { background: #22d3ee; border-color: #22d3ee; color: #020617; }
    .ammo-card { background: rgba(12,16,23,0.9); border: 1px solid rgba(51,65,85,0.85); border-radius: 14px; padding: 14px 18px; min-width: 222px; text-align: right; }
    .flash-badge { font-size: 10px; padding: 2px 6px; border-radius: 5px; border: 1px solid #334155; color: #64748b; background: rgba(15,23,42,0.8); }
    .flash-badge.on { border-color: rgba(251,191,36,0.7); color: #fcd34d; background: rgba(245,158,11,0.16); }
    #slow-vignette { position: absolute; inset: 0; pointer-events: none; display: none; }
    #boss-hud { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); width: min(500px, calc(100% - 340px)); background: rgba(12,16,23,0.95); border: 1px solid rgba(244,63,94,0.6); border-radius: 12px; padding: 10px 14px; display: none; }
    #prep-hud { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); background: rgba(12,16,23,0.95); border: 1px solid rgba(6,182,212,0.6); border-radius: 12px; padding: 10px 18px; text-align: center; display: none; }
    #boss-banner { position: absolute; top: 96px; left: 50%; transform: translateX(-50%); padding: 11px 22px; border-radius: 12px; border: 1px solid rgba(244,63,94,0.7); background: rgba(76,5,25,0.94); text-align: center; display: none; }
    #boss-banner.emerald { border-color: rgba(52,211,153,0.75); background: rgba(6,78,59,0.94); }
    #hazard-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 2px; }
    .hz-chip { padding: 4px 10px; border-radius: 7px; font-size: 11px; font-weight: 700; border: 1px solid rgba(45,212,191,0.7); background: rgba(19,78,74,0.94); color: #99f6e4; }
    .hz-chip.gas { border-color: rgba(52,211,153,0.75); background: rgba(6,78,59,0.94); color: #a7f3d0; }
    .key-hint { position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); background: rgba(12,16,23,0.85); border: 1px solid #1e293b; border-radius: 8px; padding: 4px 14px; font-size: 11px; color: #94a3b8; white-space: nowrap; }

    /* Menu & Side Drawers (Leaves center 3D view clear & interactive) */
    #main-menu { position: absolute; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: space-between; padding: 36px 56px; pointer-events: none; background: linear-gradient(90deg, rgba(12,16,23,0.92) 0%, rgba(12,16,23,0.4) 42%, transparent 100%); }
    .menu-col { max-width: 400px; width: 100%; pointer-events: auto; }
    .orbit-hint { align-self: flex-end; padding: 7px 14px; border-radius: 8px; background: rgba(12,16,23,0.82); border: 1px solid #1e293b; font-size: 11px; color: #94a3b8; }
    .card { background: #131A26; border: 1px solid rgba(51,65,85,0.85); border-radius: 14px; padding: 16px; }
    .btn-primary { width: 100%; padding: 15px 24px; border-radius: 12px; border: none; background: #06b6d4; color: #020617; font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 18px; letter-spacing: 0.05em; text-transform: uppercase; cursor: pointer; transition: background 0.15s; }
    .btn-primary:hover { background: #22d3ee; }
    .btn-sec { padding: 10px 12px; border-radius: 10px; border: 1px solid #334155; background: #131A26; color: #e2e8f0; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
    .btn-sec:hover { background: #1e293b; }

    .drawer-backdrop { position: absolute; inset: 0; z-index: 40; display: none; justify-content: flex-end; align-items: center; padding: 24px; pointer-events: none; }
    .drawer-box { background: rgba(19,26,38,0.95); border: 1px solid #334155; border-radius: 16px; padding: 24px; width: 100%; max-width: 430px; max-height: 92vh; overflow-y: auto; position: relative; pointer-events: auto; }
    .modal-backdrop { position: absolute; inset: 0; z-index: 40; display: none; align-items: center; justify-content: center; background: rgba(2,6,23,0.85); padding: 16px; }
    .modal-box { background: #131A26; border: 1px solid #334155; border-radius: 16px; padding: 24px; width: 100%; max-width: 560px; position: relative; }
    .modal-box.wide { max-width: 820px; }
    .lb-box { background: rgba(15,22,35,0.96); border: 1px solid rgba(6,182,212,0.38); border-radius: 18px; width: 100%; max-width: 860px; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,0.65); }
    .lb-tabs { display: flex; gap: 4px; padding: 4px; border-radius: 10px; background: #0B101B; border: 1px solid #1e293b; }
    .lb-tab { padding: 7px 12px; border-radius: 7px; border: none; background: transparent; color: #cbd5e1; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .lb-tab.active { background: #06b6d4; color: #020617; font-weight: 700; }
    .lb-table { width: 100%; border-collapse: collapse; text-align: left; }
    .lb-table th { position: sticky; top: 0; background: #0F1623; padding: 10px 8px; font-size: 11px; color: #94a3b8; text-transform: uppercase; border-bottom: 1px solid #1e293b; }
    .lb-table td { padding: 9px 8px; font-size: 13px; border-bottom: 1px solid rgba(30,41,59,0.65); }
    .lb-row-btn { cursor: pointer; transition: background 0.12s; }
    .lb-row-btn:hover { background: rgba(30,41,59,0.75); }
    .lb-row-me { background: rgba(6,182,212,0.16); color: #fff; }
    .lb-row-me:hover { background: rgba(6,182,212,0.26); }
    .close-btn { position: absolute; top: 16px; right: 16px; background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; padding: 4px 10px; border-radius: 8px; }
    .close-btn:hover { background: #1e293b; color: #fff; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    input[type="range"] { width: 100%; accent-color: #06b6d4; cursor: pointer; }
    input[type="text"] { width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid #334155; background: #0C1017; color: #67e8f9; font-family: 'JetBrains Mono', monospace; font-weight: 700; outline: none; }
    input[type="text"]:focus { border-color: #06b6d4; }
    .patch-btn { position: absolute; top: 28px; right: 56px; pointer-events: auto; display: inline-flex; align-items: center; gap: 8px; padding: 9px 14px; border-radius: 11px; background: rgba(19,26,38,0.94); border: 1px solid rgba(6,182,212,0.42); color: #67e8f9; font-size: 12px; font-weight: 700; cursor: pointer; transition: background 0.15s; white-space: nowrap; }
    .patch-btn:hover { background: #1e293b; }
    .admin-corner-btn { padding: 7px 9px; border-radius: 8px; background: rgba(12,16,23,0.82); border: 1px solid #1e293b; color: #475569; font-size: 11px; cursor: pointer; transition: color 0.15s, background 0.15s; }
    .admin-corner-btn:hover { background: #1e293b; color: #fbbf24; }
    .adm-tabs { display: flex; gap: 4px; padding: 4px; border-radius: 10px; background: #0B101B; border: 1px solid #1e293b; }
    .adm-tab { padding: 7px 12px; border-radius: 7px; border: none; background: transparent; color: #cbd5e1; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .adm-tab.active { background: #f59e0b; color: #020617; font-weight: 700; }
    @media (max-width: 720px) {
      #main-menu { padding: 20px; }
      .patch-btn { top: 14px; right: 16px; }
      .orbit-hint { display: none; }
      .grid-4 { grid-template-columns: repeat(2, 1fr); }
      .grid-3 { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
</head>
<body>
  <div id="canvas-wrap"></div>

  <!-- IN-GAME HUD -->
  <div id="hud">
    <div id="damage-vignette"></div>
    <div id="flash-glare"></div>
    <div id="slow-vignette"></div>
    <div id="lowhp-vignette"></div>
    <div id="boss-hud">
      <div class="font-mono" style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:6px;">
        <span style="color:#fb7185;">THE SPECIALIST ANESTESI</span>
        <span id="boss-hp-text" style="color:#6ee7b7;">2200 / 2200 HP</span>
      </div>
      <div class="bar-track" style="height:11px;margin-top:0;"><div id="boss-hp-bar" style="height:100%;width:100%;background:linear-gradient(90deg,#e11d48,#f59e0b,#10b981);"></div></div>
      <div class="font-mono" style="display:flex;justify-content:space-between;font-size:10px;margin-top:6px;">
        <span id="boss-atk-lbl" style="color:#fcd34d;font-weight:700;">SYRINGE DART BARRAGE</span>
        <span style="color:#94a3b8;">WEAKSPOT: DORSAL TANK (2.2x) · HEAD (2.0x)</span>
      </div>
    </div>
    <div id="prep-hud">
      <div id="prep-title" class="font-mono" style="font-size:11px;color:#22d3ee;font-weight:700;letter-spacing:0.1em;">PREP PHASE · NEXT WAVE IN 15S</div>
      <div class="font-mono" style="font-size:12px;color:#e2e8f0;margin-top:2px;">AMMO &amp; GEAR RESUPPLIED · RECOVER HP · PRESS <strong style="color:#fcd34d;">[G]</strong> TO DEPLOY EARLY</div>
    </div>
    <div id="boss-banner">
      <div id="boss-banner-title" class="font-display" style="font-size:15px;font-weight:700;letter-spacing:0.06em;">WARNING · THE SPECIALIST ANESTESI</div>
      <div id="boss-banner-sub" class="font-mono" style="font-size:11px;opacity:0.9;margin-top:2px;">WAVE 10 BOSS ARRIVAL · TARGET DORSAL BIO-TANK OR HEAD</div>
    </div>
    <div id="scope-overlay">
      <div class="scope-mask"></div>
      <svg style="position:relative;width:58vh;height:58vh" viewBox="0 0 400 400">
        <circle cx="200" cy="200" r="192" fill="none" stroke="#0f172a" stroke-width="8"/>
        <circle cx="200" cy="200" r="186" fill="none" stroke="rgba(6,182,212,0.45)" stroke-width="1.5"/>
        <line x1="14" y1="200" x2="176" y2="200" stroke="rgba(226,232,240,0.75)" stroke-width="1.2"/>
        <line x1="224" y1="200" x2="386" y2="200" stroke="rgba(226,232,240,0.75)" stroke-width="1.2"/>
        <line x1="200" y1="14" x2="200" y2="176" stroke="rgba(226,232,240,0.75)" stroke-width="1.2"/>
        <line x1="200" y1="224" x2="200" y2="386" stroke="rgba(226,232,240,0.75)" stroke-width="1.2"/>
        <line x1="176" y1="200" x2="224" y2="200" stroke="rgba(6,182,212,0.85)" stroke-width="0.9"/>
        <line x1="200" y1="176" x2="200" y2="224" stroke="rgba(6,182,212,0.85)" stroke-width="0.9"/>
        <circle cx="200" cy="200" r="2.2" fill="#ef4444"/>
        <text x="215" y="185" fill="rgba(6,182,212,0.85)" font-size="10" font-family="monospace">8X OPTIC</text>
      </svg>
    </div>

    <div class="radar-panel">
      <div class="radar-card">
        <canvas id="radar-canvas" width="140" height="140"></canvas>
        <div class="font-mono" style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;padding:2px 4px 0;">
          <span style="color:#22d3ee;font-weight:700;">RADAR</span>
          <span id="hud-callsign">SPECTRE-01</span>
        </div>
      </div>
      <div class="wave-card">
        <div id="hud-wave" class="font-mono" style="font-size:11px;color:#22d3ee;font-weight:700;">WAVE 01</div>
        <div class="font-mono" style="font-size:20px;font-weight:700;margin-top:2px;"><span id="hud-hostiles">3</span> <span style="font-size:12px;color:#94a3b8;font-weight:400;">Hostiles</span></div>
        <div id="hud-score" class="font-mono" style="font-size:12px;color:#34d399;font-weight:600;margin-top:2px;">Score 0</div>
      </div>
    </div>

    <div id="top-right-stack" class="font-mono">
      <div id="fps-box">
        <span id="fps-val" style="font-weight:700;color:#34d399;">60 FPS</span>
        <span style="color:#475569;">·</span>
        <span id="fps-status" style="color:#cbd5e1;font-weight:600;">OPTIMAL</span>
        <span style="color:#475569;">·</span>
        <span id="fps-preset" style="color:#67e8f9;font-weight:700;text-transform:uppercase;">HIGH</span>
      </div>
      <div id="hud-cheat-bar" style="display:none;background:rgba(12,16,23,0.92);border:1px solid rgba(245,158,11,0.55);border-radius:8px;padding:4px 10px;font-size:11px;color:#fcd34d;gap:8px;align-items:center;"></div>
      <div id="killfeed"></div>
    </div>

    <div id="crosshair">
      <svg id="crosshair-svg" width="128" height="128" viewBox="0 0 128 128" style="overflow:visible;"></svg>
    </div>
    <div id="vamp-heal-pop" class="vamp-pop font-mono">+10% HP</div>
    <svg id="hitmarker" width="26" height="26" viewBox="0 0 24 24" stroke="#ffffff" stroke-width="2.5">
      <line x1="4" y1="4" x2="9" y2="9"/><line x1="20" y1="4" x2="15" y2="9"/>
      <line x1="4" y1="20" x2="9" y2="15"/><line x1="20" y1="20" x2="15" y2="15"/>
    </svg>

    <div class="vitals">
      <div id="hazard-badges" class="font-mono"></div>
      <div class="vital-card">
        <div class="font-mono" style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;">
          <span style="color:#fb7185;">HEALTH</span><span id="hp-val">100 / 100</span>
        </div>
        <div class="bar-track"><div id="hp-bar" class="bar-hp"></div></div>
      </div>
      <div class="vital-card">
        <div class="font-mono" style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;">
          <span style="color:#22d3ee;">ARMOR</span><span id="ap-val">100 / 100</span>
        </div>
        <div class="bar-track"><div id="ap-bar" class="bar-ap"></div></div>
      </div>
    </div>

    <div class="arsenal-hud">
      <div id="slot-list" class="slot-list font-mono"></div>
      <div class="ammo-card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <span id="flash-badge" class="flash-badge font-mono">[F] LIGHT OFF</span>
          <span id="wep-title" class="font-display" style="font-size:13px;font-weight:700;color:#22d3ee;">AR-X7 Tactical</span>
        </div>
        <div class="font-mono" style="margin-top:4px;">
          <span id="ammo-cur" style="font-size:34px;font-weight:700;">30</span>
          <span id="ammo-res" style="font-size:18px;color:#64748b;font-weight:600;">/ 120</span>
        </div>
        <div id="wep-sub" class="font-mono" style="font-size:11px;color:#94a3b8;margin-top:2px;">6.8MM SPC</div>
      </div>
    </div>

    <div class="key-hint font-mono">WASD Move · C Crouch · L-Click Fire · R-Click ADS · R Reload · F Light · 1–4 / Scroll Swap · Q Quick-Switch · Tab Inventory</div>
  </div>

  <!-- MAIN MENU -->
  <div id="main-menu">
    <div class="menu-col">
      <div class="font-mono" style="font-size:11px;color:#22d3ee;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:8px;">Three.js Tactical FPS · Deployment Bay</div>
      <h1 class="font-display" style="font-size:52px;font-weight:700;line-height:1;">GIS SHOOTER</h1>
      <div class="font-display" style="font-size:18px;font-weight:600;color:#fbbf24;margin:4px 0 14px;">TACTICAL EDITION</div>
      <p style="font-size:13px;color:#cbd5e1;line-height:1.55;margin-bottom:20px;">Inspect your operative inside the Tactical Hangar, customize your loadout and visor optics, and deploy into multi-level combat waves.</p>
      <div class="card" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div id="menu-avatar" class="font-display" style="width:40px;height:40px;border-radius:10px;background:#06b6d4;color:#020617;display:flex;align-items:center;justify-content:center;font-weight:700;">SP</div>
          <div>
            <div id="menu-callsign" class="font-mono" style="font-size:14px;font-weight:700;">SPECTRE-01</div>
            <div id="menu-meta" class="font-mono" style="font-size:11px;color:#94a3b8;">RECRUIT · Lvl 1 · 0% Acc</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:#94a3b8;">High Score</div>
          <div id="menu-hs" class="font-mono" style="font-size:14px;font-weight:700;color:#34d399;">0</div>
        </div>
      </div>
      <button id="btn-deploy" class="btn-primary" style="margin-bottom:10px;">Deploy</button>
      <div class="grid-2" style="gap:8px;margin-bottom:8px;">
        <button id="btn-armory" class="btn-sec">Armory</button>
        <button id="btn-profile" class="btn-sec">Profile</button>
        <button id="btn-settings" class="btn-sec">Settings</button>
        <button id="btn-crosshair" class="btn-sec" style="color:#34d399;">Crosshair Settings</button>
      </div>
      <button id="btn-leaderboard" class="btn-sec" style="width:100%;margin-bottom:14px;color:#fcd34d;border-color:rgba(245,158,11,0.4);">Leaderboard</button>
      <div class="font-mono" style="font-size:11px;color:#64748b;">WASD Move · C Crouch · Shift Sprint · Space Jump · L-Click Fire · R-Click Aim · R Reload · F Light · 1–4 / Scroll Swap · Q Quick-Switch · Tab Inventory</div>
    </div>
    <button id="btn-patch-notes" class="patch-btn font-mono">Patch Notes (v1.5)</button>
    <div style="position:absolute;bottom:24px;right:56px;pointer-events:auto;display:flex;align-items:center;gap:8px;">
      <div class="orbit-hint font-mono">Drag to Orbit Hangar · Scroll to Zoom</div>
      <button id="btn-menu-admin" class="admin-corner-btn font-mono" title="Developer Console">&gt;_</button>
    </div>
  </div>

  <!-- ARMORY SIDE DRAWER -->
  <div id="modal-armory" class="drawer-backdrop">
    <div class="drawer-box">
      <button class="close-btn" onclick="closeModals()">✕</button>
      <div class="font-mono" style="font-size:11px;color:#22d3ee;text-transform:uppercase;">Fixed 4-Slot Arsenal · Live Preview</div>
      <h2 class="font-display" style="font-size:24px;margin:2px 0 6px;">Armory &amp; Loadout</h2>
      <p style="font-size:12px;color:#94a3b8;margin-bottom:12px;">Operatives deploy with strictly 4 active loadout slots (Keys 1–4). Drag the 3D bay to inspect.</p>
      <div id="armory-grid" class="grid-2" style="margin-bottom:10px;"></div>
      <div id="armory-slot4-bar" class="card" style="background:#0C1017;padding:10px 12px;margin-bottom:12px;"></div>
      <div id="armory-detail" class="card" style="background:#0C1017;"></div>
    </div>
  </div>

  <!-- PROFILE SIDE DRAWER -->
  <div id="modal-profile" class="drawer-backdrop">
    <div class="drawer-box">
      <button class="close-btn" onclick="closeModals()">✕</button>
      <div class="font-mono" style="font-size:11px;color:#22d3ee;text-transform:uppercase;" id="prof-rank-label">RECRUIT · LEVEL 1</div>
      <h2 class="font-display" style="font-size:24px;margin:2px 0 12px;">Player Profile</h2>
      <div class="card" style="background:#0C1017;padding:11px 12px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div style="min-width:0;">
          <div id="prof-cloud-name" style="font-size:12px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Cloud Sync Offline</div>
          <div id="prof-cloud-sub" class="font-mono" style="font-size:10px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Sign in with Google to sync globally</div>
        </div>
        <button id="btn-prof-google" type="button" class="btn-sec" style="padding:6px 11px;font-size:11px;white-space:nowrap;flex-shrink:0;">Sign In</button>
      </div>
      <label style="font-size:12px;color:#cbd5e1;display:block;margin-bottom:6px;">Operative Callsign</label>
      <input type="text" id="prof-callsign-input" maxlength="16" style="margin-bottom:6px;" />
      <div id="prof-callsign-status" class="font-mono" style="font-size:10px;color:#94a3b8;margin-bottom:12px;">Checking global callsign registry...</div>
      <div id="prof-pin-wrap" style="display:none;margin-bottom:12px;">
        <label style="font-size:12px;color:#cbd5e1;display:block;margin-bottom:6px;">Operative PIN <span id="prof-pin-hint" class="font-mono" style="font-size:10px;color:#94a3b8;">(Optional 4–8 digits)</span></label>
        <input type="password" id="prof-pin-input" maxlength="8" inputmode="numeric" placeholder="Optional PIN for profile lock" style="width:100%;padding:9px 12px;border-radius:10px;border:1px solid #334155;background:#0C1017;color:#fcd34d;font-family:'JetBrains Mono',monospace;font-weight:700;outline:none;" />
      </div>
      <div id="prof-cloud-err" class="font-mono" style="display:none;margin-bottom:10px;padding:8px 10px;border-radius:8px;background:rgba(127,29,29,0.5);border:1px solid rgba(244,63,94,0.45);color:#fecdd3;font-size:11px;"></div>
      <label style="font-size:12px;color:#cbd5e1;display:block;margin-bottom:8px;">Helmet Visor &amp; HUD Accent</label>
      <div id="prof-colors" style="display:flex;gap:8px;margin-bottom:14px;"></div>
      <div class="card" style="background:#0C1017;margin-bottom:14px;">
        <div class="font-mono" style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;">
          <span>XP Progress</span><span id="prof-xp-text" style="color:#94a3b8;">0 / 250 XP</span>
        </div>
        <div class="bar-track"><div id="prof-xp-bar" style="height:100%;width:0%;background:#06b6d4;"></div></div>
      </div>
      <div id="prof-stats" class="grid-2 font-mono" style="margin-bottom:12px;"></div>
      <div id="prof-achievements" class="card" style="background:#0C1017;padding:10px;margin-bottom:14px;"></div>
      <button id="btn-save-prof" class="btn-primary" style="font-size:14px;padding:12px;">Save Profile</button>
    </div>
  </div>

  <!-- SETTINGS SIDE DRAWER -->
  <div id="modal-settings" class="drawer-backdrop">
    <div class="drawer-box" style="max-width:400px;">
      <button class="close-btn" onclick="closeModals()">✕</button>
      <div class="font-mono" style="font-size:11px;color:#22d3ee;text-transform:uppercase;">System Preferences</div>
      <h2 class="font-display" style="font-size:24px;margin:2px 0 14px;">Settings</h2>
      <div class="card" style="background:#0C1017;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:8px;">
          <span>Graphics Preset</span>
          <span id="set-gfx-tag" class="font-mono" style="font-size:11px;font-weight:700;color:#22d3ee;text-transform:uppercase;">ULTRA TACTICAL</span>
        </div>
        <div id="set-gfx-grid" class="gfx-grid"></div>
        <div id="set-gfx-desc" style="font-size:11px;color:#94a3b8;margin-top:8px;line-height:1.45;"></div>
      </div>
      <div class="card" style="background:#0C1017;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;"><span>Mouse Sensitivity</span><span id="set-sens-val" class="font-mono" style="color:#22d3ee;">1.0x</span></div>
        <input type="range" id="set-sens" min="0.2" max="3.0" step="0.1" value="1.0" />
      </div>
      <div class="card" style="background:#0C1017;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;"><span>Field of View (FOV)</span><span id="set-fov-val" class="font-mono" style="color:#fbbf24;">75°</span></div>
        <input type="range" id="set-fov" min="65" max="100" step="1" value="75" />
      </div>
      <div class="card" style="background:#0C1017;margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;"><span>Master Volume</span><span id="set-vol-val" class="font-mono" style="color:#34d399;">70%</span></div>
        <input type="range" id="set-vol" min="0" max="1" step="0.05" value="0.7" />
      </div>
      <button class="btn-primary" style="font-size:14px;padding:12px;" onclick="closeModals()">Save &amp; Close</button>
    </div>
  </div>

  <!-- CROSSHAIR SETTINGS SIDE DRAWER -->
  <div id="modal-crosshair" class="drawer-backdrop" style="z-index:50;">
    <div class="drawer-box">
      <button class="close-btn" id="ch-close-x">✕</button>
      <div class="font-mono" style="font-size:11px;color:#22d3ee;text-transform:uppercase;">Optics &amp; Reticle Calibration</div>
      <h2 class="font-display" style="font-size:24px;margin:2px 0 12px;">Crosshair Settings</h2>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;margin-bottom:6px;">
        <span style="color:#cbd5e1;font-weight:600;">Live Reticle Preview</span>
        <div style="display:flex;gap:5px;">
          <button type="button" id="ch-bg-toggle" class="btn-sec" style="padding:4px 8px;font-size:11px;">Bright Surface</button>
          <button type="button" id="ch-sim-toggle" class="btn-sec" style="padding:4px 8px;font-size:11px;">Test Spread</button>
          <button type="button" id="ch-hit-test" class="btn-sec" style="padding:4px 8px;font-size:11px;color:#fda4af;">Test Hit</button>
        </div>
      </div>
      <div id="ch-preview-box" class="ch-preview-box">
        <svg id="ch-preview-svg" width="128" height="128" viewBox="0 0 128 128" style="overflow:visible;"></svg>
      </div>
      <div style="font-size:12px;color:#cbd5e1;margin-bottom:6px;font-weight:600;">Crosshair Style</div>
      <div id="ch-styles" class="ch-style-grid" style="margin-bottom:12px;"></div>
      <div class="card" style="background:#0C1017;padding:12px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px;">
          <span>Reticle Color</span><span id="ch-color-hex" class="font-mono" style="color:#22d3ee;">#22C55E</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div id="ch-color-presets" style="display:flex;gap:6px;"></div>
          <label style="display:flex;align-items:center;gap:6px;font-size:11px;background:#1e293b;padding:4px 8px;border-radius:7px;cursor:pointer;">
            <span>Custom</span>
            <input type="color" id="ch-color-picker" value="#22C55E" style="width:22px;height:18px;border:none;background:transparent;cursor:pointer;" />
          </label>
        </div>
      </div>
      <div class="grid-2" style="margin-bottom:10px;">
        <div class="card" style="background:#0C1017;padding:10px;">
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span>Length / Scale</span><span id="ch-len-val" class="font-mono" style="color:#22d3ee;">9px</span></div>
          <input type="range" id="ch-length" min="4" max="24" step="1" value="9" />
        </div>
        <div class="card" style="background:#0C1017;padding:10px;">
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span>Thickness</span><span id="ch-thk-val" class="font-mono" style="color:#22d3ee;">2px</span></div>
          <input type="range" id="ch-thickness" min="1" max="6" step="1" value="2" />
        </div>
        <div class="card" style="background:#0C1017;padding:10px;">
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span>Center Gap</span><span id="ch-gap-val" class="font-mono" style="color:#fbbf24;">5px</span></div>
          <input type="range" id="ch-gap" min="0" max="18" step="1" value="5" />
        </div>
        <div class="card" style="background:#0C1017;padding:10px;">
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span>Dot Size</span><span id="ch-dot-val" class="font-mono" style="color:#34d399;">3px</span></div>
          <input type="range" id="ch-dot" min="1" max="8" step="1" value="3" />
        </div>
      </div>
      <div class="card" style="background:#0C1017;padding:10px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span>Opacity</span><span id="ch-opa-val" class="font-mono" style="color:#22d3ee;">95%</span></div>
        <input type="range" id="ch-opacity" min="0.2" max="1.0" step="0.05" value="0.95" />
      </div>
      <div class="grid-2" style="margin-bottom:14px;">
        <button type="button" id="ch-outline-btn" class="btn-sec" style="display:flex;justify-content:space-between;"><span>Black Outline</span><strong id="ch-outline-val">ON</strong></button>
        <button type="button" id="ch-dynamic-btn" class="btn-sec" style="display:flex;justify-content:space-between;"><span>Dynamic Spread</span><strong id="ch-dynamic-val">ON</strong></button>
      </div>
      <div style="display:flex;gap:8px;">
        <button type="button" id="ch-reset" class="btn-sec" style="padding:10px 14px;">Reset</button>
        <button type="button" id="ch-save" class="btn-primary" style="font-size:14px;padding:11px;flex:1;">Save &amp; Close</button>
      </div>
    </div>
  </div>

  <!-- INVENTORY MODAL -->
  <div id="modal-inventory" class="modal-backdrop">
    <div class="modal-box wide">
      <button class="close-btn" id="inv-close">✕</button>
      <div class="font-mono" style="font-size:11px;color:#22d3ee;text-transform:uppercase;">Fixed 4-Slot Loadout · Press 1–4 or Scroll Wheel to Switch · Tab or I to Return</div>
      <h2 class="font-display" style="font-size:24px;margin:2px 0 16px;">Tactical Inventory</h2>
      <div id="inv-grid" class="grid-4" style="max-height:66vh;overflow-y:auto;"></div>
    </div>
  </div>

  <!-- PAUSE MODAL -->
  <div id="modal-pause" class="modal-backdrop">
    <div class="modal-box" style="max-width:410px;text-align:center;">
      <h2 class="font-display" style="font-size:26px;margin-bottom:4px;">Paused</h2>
      <p style="font-size:12px;color:#94a3b8;margin-bottom:14px;">Combat suspended</p>
      <div class="card" style="background:#0C1017;margin-bottom:10px;text-align:left;">
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:8px;">
          <span>Graphics Preset</span>
          <span id="pause-gfx-tag" class="font-mono" style="font-size:11px;font-weight:700;color:#22d3ee;text-transform:uppercase;">ULTRA TACTICAL</span>
        </div>
        <div id="pause-gfx-grid" class="gfx-grid"></div>
      </div>
      <div class="card" style="background:#0C1017;margin-bottom:14px;text-align:left;">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;"><span>Mouse Sensitivity</span><span id="pause-sens-val" class="font-mono" style="color:#22d3ee;">1.0x</span></div>
        <input type="range" id="pause-sens" min="0.2" max="3.0" step="0.1" value="1.0" />
      </div>
      <div id="pause-lock-note" class="font-mono" style="display:none;margin-bottom:8px;padding:8px 10px;border-radius:8px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.45);color:#fcd34d;font-size:11px;"></div>
      <button id="btn-resume" class="btn-primary" style="font-size:14px;padding:12px;margin-bottom:8px;">Resume</button>
      <button id="btn-pause-crosshair" class="btn-sec" style="width:100%;margin-bottom:8px;color:#34d399;">Crosshair Settings</button>
      <button id="btn-restart" class="btn-sec" style="width:100%;margin-bottom:8px;">Restart Match</button>
      <button id="btn-tomenu" class="btn-sec" style="width:100%;">Main Menu</button>
    </div>
    <button id="btn-pause-admin" class="admin-corner-btn font-mono" style="position:absolute;bottom:18px;right:18px;" title="Developer Console">&gt;_</button>
  </div>

  <!-- LEADERBOARD CENTERED MODAL -->
  <div id="modal-leaderboard" class="modal-backdrop" style="z-index:55;background:rgba(2,6,23,0.78);">
    <div class="lb-box">
      <div style="padding:16px 24px;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div>
          <h2 class="font-display" style="font-size:22px;color:#fff;">Tactical Leaderboard</h2>
          <div id="lb-season" class="font-mono" style="font-size:11px;color:#94a3b8;">Global Cloud &amp; Local Operative Rankings</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button id="lb-google-btn" class="btn-primary" style="display:none;width:auto;font-size:11px;padding:7px 12px;">Sign In with Google</button>
          <button id="lb-close-x" class="close-btn" style="position:static;">✕</button>
        </div>
      </div>
      <div style="padding:12px 24px;background:#0B101B;border-bottom:1px solid #1e293b;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;">
        <div id="lb-tabs" class="lb-tabs"></div>
        <div id="lb-summary" class="font-mono" style="font-size:12px;color:#cbd5e1;"></div>
      </div>
      <div id="lb-auth-err" class="font-mono" style="display:none;margin:10px 24px 0;padding:10px 12px;border-radius:10px;background:rgba(136,19,55,0.45);border:1px solid rgba(244,63,94,0.45);color:#fecdd3;font-size:11px;line-height:1.5;"></div>
      <div id="lb-local-warn" class="font-mono" style="display:none;margin:10px 24px 0;padding:9px 12px;border-radius:10px;background:rgba(120,53,15,0.4);border:1px solid rgba(245,158,11,0.4);color:#fde68a;font-size:11px;line-height:1.45;">Skor berlabel <strong>LOCAL ONLY</strong> hanya tersimpan di browser ini. Klik <strong>Sign In with Google</strong> agar skor tersinkron ke Vercel &amp; perangkat lain.</div>
      <div id="lb-body" style="flex:1;overflow-y:auto;padding:8px 24px 16px;"></div>
      <div style="padding:12px 24px;border-top:1px solid #1e293b;background:#0B101B;display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <span id="lb-foot-note" class="font-mono" style="font-size:11px;color:#64748b;">Local scores persist in browser storage</span>
        <button id="lb-close-btn" class="btn-sec" style="padding:8px 18px;">Close</button>
      </div>
    </div>
  </div>

  <!-- OPERATOR PROFILE CARD POP-UP (ABOVE LEADERBOARD) -->
  <div id="modal-op-profile" class="modal-backdrop" style="z-index:60;">
    <div class="modal-box" style="max-width:440px;border-color:rgba(34,211,238,0.45);box-shadow:0 24px 60px rgba(0,0,0,0.72);">
      <button id="op-close-x" class="close-btn" aria-label="Close operator profile card">✕</button>
      <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:18px;padding-right:28px;">
        <div id="op-avatar" class="font-display" style="width:56px;height:56px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;color:#020617;border:1px solid rgba(255,255,255,0.28);position:relative;overflow:hidden;flex-shrink:0;"></div>
        <div style="min-width:0;">
          <div id="op-rank-lvl" class="font-mono" style="font-size:11px;color:#22d3ee;text-transform:uppercase;letter-spacing:0.06em;"></div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:2px;">
            <span id="op-flag" style="font-size:18px;line-height:1;"></span>
            <h3 id="op-callsign" class="font-display" style="font-size:20px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></h3>
          </div>
          <div id="op-sub" class="font-mono" style="font-size:11px;color:#94a3b8;margin-top:3px;"></div>
        </div>
      </div>
      <div id="op-metrics" class="grid-2 font-mono" style="margin-bottom:12px;"></div>
      <div class="card" style="background:#0C1017;padding:11px 14px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <span style="font-size:12px;color:#94a3b8;">Favorite Weapon</span>
        <strong id="op-fav-wep" class="font-display" style="font-size:14px;color:#fff;"></strong>
      </div>
      <button id="op-close-btn" class="btn-primary" style="font-size:13px;padding:11px;">Close</button>
    </div>
  </div>

  <!-- GAME OVER MODAL -->
  <div id="modal-gameover" class="modal-backdrop">
    <div class="modal-box" style="max-width:470px;text-align:center;border-color:rgba(239,68,68,0.45);">
      <h2 class="font-display" style="font-size:26px;color:#f87171;margin-bottom:4px;">Operative Eliminated</h2>
      <p id="go-sub" class="font-mono" style="font-size:12px;color:#94a3b8;margin-bottom:14px;">Mission terminated</p>
      <div id="go-stats" class="font-mono" style="margin-bottom:14px;text-align:left;"></div>
      <div id="go-submit-wrap" style="margin-bottom:10px;">
        <button id="btn-submit-score" class="btn-primary" style="font-size:13px;padding:12px;">Submit Score to Leaderboard</button>
      </div>
      <div class="grid-2" style="margin-bottom:8px;">
        <button id="btn-redeploy" class="btn-primary" style="background:#ef4444;color:#fff;font-size:13px;padding:11px;">Redeploy</button>
        <button id="btn-go-menu" class="btn-sec" style="width:100%;">Main Menu</button>
      </div>
      <button id="btn-go-leaderboard" class="btn-sec" style="width:100%;color:#fcd34d;">View Leaderboard</button>
    </div>
  </div>

  <!-- PATCH NOTES MODAL (v1.5) -->
  <div id="modal-patchnotes" class="modal-backdrop" style="z-index:62;">
    <div class="lb-box" style="max-width:740px;">
      <div style="padding:16px 24px;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div>
          <h2 class="font-display" style="font-size:22px;color:#fff;">Patch Notes</h2>
          <div class="font-mono" style="font-size:11px;color:#94a3b8;">GIS Shooter: Tactical Edition · Release v1.5 · Update History</div>
        </div>
        <button id="pn-close-x" class="close-btn" style="position:static;">✕</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:18px;">
        <div>
          <div class="font-mono" style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
            <span><strong style="font-size:17px;color:#34d399;">v1.5</strong> <span style="font-size:11px;color:#94a3b8;text-transform:uppercase;margin-left:8px;">Latest Update</span></span>
            <span style="font-size:11px;color:#64748b;">Nov 2026</span>
          </div>
          <h3 class="font-display" style="font-size:15px;color:#fff;margin-bottom:8px;">Performance Overhaul, Ballistic Rebalance &amp; Vampirism</h3>
          <div style="font-size:13px;color:#cbd5e1;line-height:1.55;display:flex;flex-direction:column;gap:6px;">
            <div><strong style="color:#fff;">Potato Mode (Max FPS):</strong> Added 3-tier Graphics Presets (High / Medium / Potato Mode) with 0.75x pixel scale, shadow/AA disable, Lambert material swap, close-range fog, and an always-on top-right FPS counter.</div>
            <div><strong style="color:#fff;">Weapon Damage Buff:</strong> Rebalanced AR-X7 (38 dmg), SG-12 (22x8 pellets), SR-50 (120 dmg), Vector-V9 (28 dmg), and .50 Desert Python (65 dmg / 3.0x headshot), plus floating damage numbers &amp; micro screen shake.</div>
            <div><strong style="color:#fff;">Vampire Kill-Heal:</strong> Eliminating hostile bots restores +10% Max HP (+25% on Wave 10 Boss) with floating green indicator and audio chime.</div>
            <div><strong style="color:#fff;">Developer Console &amp; Patch GUI:</strong> Added PIN-protected Secret Admin Panel (Shift+F12 / gisadmin) and Main Menu Patch Notes modal.</div>
          </div>
        </div>
        <div style="padding-top:16px;border-top:1px solid #1e293b;">
          <div class="font-mono" style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
            <span><strong style="font-size:17px;color:#fbbf24;">v1.4</strong> <span style="font-size:11px;color:#94a3b8;text-transform:uppercase;margin-left:8px;">Boss &amp; Combat Flow</span></span>
            <span style="font-size:11px;color:#64748b;">Oct 2026</span>
          </div>
          <h3 class="font-display" style="font-size:15px;color:#fff;margin-bottom:6px;">Wave 10 Boss Encounter &amp; Empty-Mag Auto-Reload</h3>
          <div style="font-size:13px;color:#cbd5e1;line-height:1.55;">Introduced Boss <strong style="color:#fff;">The Specialist Anestesi</strong> on Wave 10 with syringe darts, toxic gas hazards, scalpel dashes, plus automatic empty-mag reload.</div>
        </div>
        <div style="padding-top:16px;border-top:1px solid #1e293b;">
          <div class="font-mono" style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
            <span><strong style="font-size:17px;color:#22d3ee;">v1.3</strong> <span style="font-size:11px;color:#94a3b8;text-transform:uppercase;margin-left:8px;">Social &amp; Arsenal UX</span></span>
            <span style="font-size:11px;color:#64748b;">Sep 2026</span>
          </div>
          <h3 class="font-display" style="font-size:15px;color:#fff;margin-bottom:6px;">Interactive Leaderboard Profiles &amp; Scroll Wheel Swap</h3>
          <div style="font-size:13px;color:#cbd5e1;line-height:1.55;">Added clickable Operator Profile Cards inside the Global Leaderboard and smooth scroll-wheel weapon cycling.</div>
        </div>
        <div style="padding-top:16px;border-top:1px solid #1e293b;">
          <div class="font-mono" style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
            <span><strong style="font-size:17px;color:#94a3b8;">v1.2</strong> <span style="font-size:11px;color:#94a3b8;text-transform:uppercase;margin-left:8px;">Foundation Release</span></span>
            <span style="font-size:11px;color:#64748b;">Aug 2026</span>
          </div>
          <h3 class="font-display" style="font-size:15px;color:#fff;margin-bottom:6px;">3D Interactive Tactical Lobby &amp; Crosshair Studio</h3>
          <div style="font-size:13px;color:#cbd5e1;line-height:1.55;">Launched the 3D Hangar Deployment Bay with orbit controls and full custom crosshair studio.</div>
        </div>
      </div>
      <div style="padding:12px 24px;border-top:1px solid #1e293b;background:#0B101B;display:flex;justify-content:space-between;align-items:center;">
        <span class="font-mono" style="font-size:11px;color:#64748b;">Active Build: v1.5 Tactical Edition</span>
        <button id="pn-close-btn" class="btn-primary" style="width:auto;padding:8px 18px;font-size:12px;">Close</button>
      </div>
    </div>
  </div>

  <!-- ADMIN PIN GATE MODAL -->
  <div id="modal-admin-pin" class="modal-backdrop" style="z-index:70;">
    <div class="modal-box" style="max-width:380px;border-color:rgba(245,158,11,0.5);">
      <button id="adm-pin-close-x" class="close-btn">✕</button>
      <div class="font-mono" style="font-size:11px;color:#fbbf24;text-transform:uppercase;letter-spacing:0.08em;">Restricted Console</div>
      <h2 class="font-display" style="font-size:20px;color:#fff;margin:2px 0 8px;">Admin PIN Required</h2>
      <p style="font-size:12px;color:#94a3b8;margin-bottom:14px;">Enter developer PIN to unlock Wave/Boss testing, Combat Cheats, and Leaderboard moderation.</p>
      <form id="adm-pin-form">
        <input id="adm-pin-input" type="password" inputmode="numeric" maxlength="12" placeholder="Enter Developer PIN" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid #334155;background:#0C1017;color:#fcd34d;font-family:'JetBrains Mono',monospace;font-weight:700;letter-spacing:0.15em;outline:none;margin-bottom:8px;" />
        <div id="adm-pin-err" class="font-mono" style="font-size:11px;color:#fb7185;min-height:16px;margin-bottom:8px;"></div>
        <div style="display:flex;gap:8px;">
          <button type="button" id="adm-pin-cancel" class="btn-sec" style="padding:10px 16px;">Cancel</button>
          <button type="submit" class="btn-primary" style="background:#f59e0b;font-size:12px;padding:10px;">Unlock Console</button>
        </div>
      </form>
    </div>
  </div>

  <!-- SECRET DEVELOPER CONSOLE MODAL -->
  <div id="modal-admin" class="modal-backdrop" style="z-index:70;">
    <div class="lb-box" style="border-color:rgba(245,158,11,0.48);">
      <div style="padding:16px 24px;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div>
          <h2 class="font-display" style="font-size:21px;color:#fff;">Developer Console</h2>
          <div id="adm-subtitle" class="font-mono" style="font-size:11px;color:#94a3b8;">Admin Controls Active</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button id="adm-lock-btn" class="btn-sec" style="padding:6px 12px;color:#fcd34d;">Lock Console</button>
          <button id="adm-close-x" class="close-btn" style="position:static;">✕</button>
        </div>
      </div>
      <div style="padding:12px 24px;background:#0B101B;border-bottom:1px solid #1e293b;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;">
        <div id="adm-tabs" class="adm-tabs"></div>
        <div id="adm-notice" class="font-mono" style="font-size:12px;color:#34d399;font-weight:700;"></div>
      </div>
      <div id="adm-body" style="flex:1;overflow-y:auto;padding:20px 24px;"></div>
    </div>
  </div>

  <script type="module">
  window.__GIS_FIREBASE_CONFIG__ = ${safeFirebaseJson};
  window.__GIS_CLOUD__ = {
    status: 'connecting',
    user: null,
    entries: [],
    operativeAccount: null,
    signIn: async () => null,
    signOut: async () => {},
    lookupCallsign: async (cs) => ({ status: 'offline', callsignKey: String(cs || 'OPERATIVE').toUpperCase() }),
    saveOperative: async () => null,
    hashPin: async () => '',
    upsertScore: async () => ({ status: 'auth_required', message: 'Offline mode — saved locally.' }),
    deleteScore: async () => {}
  };
  try {
    const cfg = window.__GIS_FIREBASE_CONFIG__;
    const [appMod, authMod, fsMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js')
    ]);
    const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(cfg);
    const db = fsMod.getFirestore(app, cfg.firestoreDatabaseId);
    const auth = authMod.getAuth(app);
    const provider = new authMod.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    const normDisplay = (raw) => {
      const c = String(raw || '').trim().toUpperCase().replace(/\s+/g, ' ').slice(0, 16);
      return c.length < 2 ? 'OPERATIVE' : c;
    };
    const normKey = (raw) => {
      const k = String(raw || '').trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_\-]/g, '').slice(0, 16);
      return k.length < 2 ? 'OPERATIVE' : k;
    };
    const hexCol = (h) => (typeof h === 'string' && /^#[0-9a-fA-F]{6}$/.test(h)) ? h : '#06b6d4';
    const wkNow = () => {
      const n = new Date(), d = new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
      const dn = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - dn);
      const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const wn = Math.ceil(((d - ys) / 86400000 + 1) / 7);
      return d.getUTCFullYear() + '-W' + (wn < 10 ? '0' : '') + wn;
    };
    const hashPin = async (pin, uid) => {
      const cl = String(pin || '').trim();
      if (!cl) return '';
      const bytes = new TextEncoder().encode('gis_op_pin:' + uid + ':' + cl);
      const buf = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    };
    const notifyUpdate = () => window.dispatchEvent(new CustomEvent('gis-cloud-update'));
    const formatAuthErr = (err) => {
      const code = (err && err.code) ? String(err.code) : '';
      const raw = (err && err.message) ? String(err.message) : String(err || 'Google Sign-In failed.');
      const host = window.location.hostname || 'domain ini';
      if (code === 'auth/unauthorized-domain' || raw.includes('unauthorized-domain')) {
        return new Error('Domain "' + host + '" belum terdaftar di Firebase Authorized Domains. Tambahkan "' + host + '" di Firebase Console -> Authentication -> Settings -> Authorized domains (https://console.firebase.google.com/project/' + cfg.projectId + '/authentication/settings).');
      }
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return new Error('Popup login Google ditutup sebelum selesai. Klik Sign In lagi.');
      }
      if (code === 'auth/network-request-failed') {
        return new Error('Koneksi jaringan gagal saat menghubungi Google Auth.');
      }
      return new Error(raw);
    };

    try { await fsMod.getDocFromServer(fsMod.doc(db, 'test', 'connection')); } catch(e) {}
    try { await authMod.getRedirectResult(auth); } catch(e) {}

    authMod.onAuthStateChanged(auth, async (u) => {
      window.__GIS_CLOUD__.user = u || null;
      if (u) {
        try {
          const snap = await fsMod.getDoc(fsMod.doc(db, 'operatives', u.uid));
          window.__GIS_CLOUD__.operativeAccount = snap.exists() ? snap.data() : null;
        } catch(e) { window.__GIS_CLOUD__.operativeAccount = null; }
      } else {
        window.__GIS_CLOUD__.operativeAccount = null;
      }
      notifyUpdate();
    });

    const lbQuery = fsMod.query(
      fsMod.collection(db, 'leaderboard'),
      fsMod.where('score', '>=', 0),
      fsMod.orderBy('score', 'desc'),
      fsMod.limit(100)
    );
    fsMod.onSnapshot(lbQuery, (snap) => {
      window.__GIS_CLOUD__.entries = snap.docs.map((ds) => {
        const d = ds.data();
        return {
          id: 'cloud_' + ds.id,
          callsign: String(d.callsign || ds.id),
          countryCode: String(d.countryCode || 'ID'),
          flag: String(d.flag || '🇮🇩'),
          kills: Number(d.kills || 0),
          headshots: Number(d.headshots || 0),
          accuracy: Number(d.accuracy || 0),
          survivalSec: Number(d.survivalSec || 0),
          wave: Number(d.wave || 1),
          score: Number(d.score || 0),
          xpEarned: Number(d.xpEarned || 0),
          timestamp: d.updatedAt && d.updatedAt.toMillis ? d.updatedAt.toMillis() : Date.now(),
          isPlayer: true,
          isCloud: true,
          ownerUid: d.ownerUid || '',
          hasPin: !!d.hasPin,
          weekKey: d.weekKey || '',
          level: Number(d.level || 1),
          avatarColor: hexCol(d.avatarColor),
          favoriteWeapon: String(d.favoriteWeapon || 'AR-X7 Tactical')
        };
      });
      window.__GIS_CLOUD__.status = 'live';
      notifyUpdate();
    }, () => {
      window.__GIS_CLOUD__.status = 'offline';
      notifyUpdate();
    });

    window.__GIS_CLOUD__.hashPin = hashPin;
    window.__GIS_CLOUD__.signIn = async () => {
      if (document.pointerLockElement) { try { document.exitPointerLock(); } catch(e) {} }
      try {
        const r = await authMod.signInWithPopup(auth, provider);
        window.__GIS_CLOUD__.user = r.user;
        notifyUpdate();
        return r.user;
      } catch(err) {
        const code = (err && err.code) ? String(err.code) : '';
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
          try { await authMod.signInWithRedirect(auth, provider); } catch(re) { throw formatAuthErr(re); }
          throw new Error('Popup diblokir browser — mengalihkan ke halaman login Google...');
        }
        throw formatAuthErr(err);
      }
    };
    window.__GIS_CLOUD__.signOut = async () => {
      await authMod.signOut(auth);
      window.__GIS_CLOUD__.user = null;
      window.__GIS_CLOUD__.operativeAccount = null;
      notifyUpdate();
    };
    window.__GIS_CLOUD__.lookupCallsign = async (cs) => {
      const k = normKey(cs);
      try {
        const snap = await fsMod.getDoc(fsMod.doc(db, 'leaderboard', k));
        if (!snap.exists()) return { status: 'available', callsignKey: k };
        const d = snap.data();
        const u = window.__GIS_CLOUD__.user;
        if (u && d.ownerUid === u.uid) {
          return { status: 'owned_by_you', callsignKey: k, existingScore: d.score || 0 };
        }
        return { status: 'owned_by_other', callsignKey: k, existingScore: d.score || 0 };
      } catch(e) {
        return { status: 'offline', callsignKey: k };
      }
    };
    window.__GIS_CLOUD__.saveOperative = async (cs, accent, newPin) => {
      const u = window.__GIS_CLOUD__.user;
      if (!u) return null;
      const ref = fsMod.doc(db, 'operatives', u.uid);
      const ex = await fsMod.getDoc(ref);
      let pinHash = ex.exists() ? String(ex.data().pinHash || '') : '';
      if (newPin && String(newPin).trim()) pinHash = await hashPin(newPin, u.uid);
      const payload = {
        uid: u.uid,
        primaryCallsign: normKey(cs),
        pinHash,
        accentColor: hexCol(accent),
        createdAt: ex.exists() && ex.data().createdAt ? ex.data().createdAt : fsMod.serverTimestamp(),
        updatedAt: fsMod.serverTimestamp()
      };
      await fsMod.setDoc(ref, payload);
      window.__GIS_CLOUD__.operativeAccount = payload;
      return payload;
    };
    window.__GIS_CLOUD__.upsertScore = async (p, forceAdmin) => {
      const u = window.__GIS_CLOUD__.user;
      if (!u) return { status: 'auth_required', message: 'Sign in with Google to sync globally.' };
      const cs = normDisplay(p.callsign);
      const ck = normKey(cs);
      const kills = Math.max(0, Math.min(100000, Math.round(p.kills || 0)));
      const headshots = Math.max(0, Math.min(kills, Math.round(p.headshots || 0)));
      const data = {
        callsignKey: ck,
        callsign: cs,
        ownerUid: u.uid,
        countryCode: 'ID',
        flag: '🇮🇩',
        score: Math.max(0, Math.min(100000000, Math.round(p.score || 0))),
        wave: Math.max(1, Math.min(99, Math.round(p.wave || 1))),
        kills,
        headshots,
        accuracy: Math.max(0, Math.min(100, Math.round(p.accuracy || 0))),
        survivalSec: Math.max(0, Math.min(86400, Math.round(p.survivalSec || 0))),
        xpEarned: Math.max(0, Math.min(10000000, Math.round(p.xpEarned || 0))),
        level: Math.max(1, Math.min(999, Math.round(p.level || 1))),
        avatarColor: hexCol(p.avatarColor),
        favoriteWeapon: String(p.favoriteWeapon || 'AR-X7 Tactical').slice(0, 48),
        weekKey: /^[0-9]{4}-W[0-9]{2}$/.test(p.weekKey || '') ? p.weekKey : wkNow(),
        isPlayer: true,
        hasPin: !!p.hasPin
      };
      const ref = fsMod.doc(db, 'leaderboard', ck);
      try {
        return await fsMod.runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists()) {
            tx.set(ref, Object.assign({}, data, { createdAt: fsMod.serverTimestamp(), updatedAt: fsMod.serverTimestamp() }));
            return { status: 'created', message: 'Synced to Global Cloud (' + data.score.toLocaleString() + ')' };
          }
          const ex = snap.data();
          if (!forceAdmin && ex.ownerUid !== u.uid) {
            return { status: 'owned_by_other', message: 'Callsign protected by another Google account.' };
          }
          if (!forceAdmin && data.score <= (ex.score || 0)) {
            return { status: 'kept_pb', message: 'Cloud PB preserved (' + (ex.score || 0).toLocaleString() + ')' };
          }
          tx.update(ref, {
            callsign: data.callsign, countryCode: data.countryCode, flag: data.flag,
            score: data.score, wave: data.wave, kills: data.kills, headshots: data.headshots,
            accuracy: data.accuracy, survivalSec: data.survivalSec, xpEarned: data.xpEarned,
            level: data.level, avatarColor: data.avatarColor, favoriteWeapon: data.favoriteWeapon,
            weekKey: data.weekKey, hasPin: data.hasPin, updatedAt: fsMod.serverTimestamp()
          });
          return { status: 'updated_pb', message: 'New Cloud PB synced (' + data.score.toLocaleString() + ')' };
        });
      } catch(err) {
        return { status: 'error', message: 'Cloud sync error (saved locally)' };
      }
    };
    window.__GIS_CLOUD__.deleteScore = async (idOrCs) => {
      const raw = String(idOrCs || '').startsWith('cloud_') ? String(idOrCs).slice(6) : String(idOrCs);
      await fsMod.deleteDoc(fsMod.doc(db, 'leaderboard', normKey(raw)));
    };
  } catch(e) {
    window.__GIS_CLOUD__.status = 'offline';
  }
  </script>

  <script>
  (function() {
    // =========================================================================
    // 1. PROFILE & SETTINGS PERSISTENCE (localStorage)
    // =========================================================================
    const STORAGE_KEY = 'GIS_SHOOTER_TACTICAL_STANDALONE';
    const GFX_STORAGE_KEY = 'GIS_SHOOTER_GRAPHICS_PRESET';
    const DEFAULT_CH = {
      style: 'classic', color: '#22C55E', length: 9, thickness: 2,
      gap: 5, dotSize: 3, opacity: 0.95, outline: true, dynamic: true
    };
    const DEFAULT_PROF = {
      callsign: 'SPECTRE-01', level: 1, xp: 0, totalKills: 0, totalHeadshots: 0,
      totalShots: 0, totalHits: 0, highScore: 0, highestWave: 1,
      mouseSensitivity: 1.0, baseFov: 75, masterVolume: 0.7, accentColor: '#06b6d4', preferredSlot: 0, slot4Choice: 'desert_python',
      crosshair: Object.assign({}, DEFAULT_CH), graphicsPreset: 'high', achievements: [], bossDefeatedCount: 0, allUnlocked: false
    };
    let profile = Object.assign({}, DEFAULT_PROF, { crosshair: Object.assign({}, DEFAULT_CH), achievements: [] });
    try {
      const savedGfx = localStorage.getItem(GFX_STORAGE_KEY);
      if (savedGfx === 'high' || savedGfx === 'medium' || savedGfx === 'potato') profile.graphicsPreset = savedGfx;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        profile = Object.assign({}, DEFAULT_PROF, parsed);
        profile.crosshair = Object.assign({}, DEFAULT_CH, parsed.crosshair || {});
        profile.slot4Choice = profile.slot4Choice === 'nano_medkit' ? 'nano_medkit' : 'desert_python';
        profile.preferredSlot = Math.max(0, Math.min(3, typeof profile.preferredSlot === 'number' ? Math.floor(profile.preferredSlot) : 0));
        if (profile.slot4Choice === 'nano_medkit' && profile.preferredSlot === 3) profile.preferredSlot = 0;
        if (profile.graphicsPreset !== 'high' && profile.graphicsPreset !== 'medium' && profile.graphicsPreset !== 'potato') {
          profile.graphicsPreset = (savedGfx === 'medium' || savedGfx === 'potato') ? savedGfx : 'high';
        }
        if (!Array.isArray(profile.achievements)) profile.achievements = [];
        if (typeof profile.bossDefeatedCount !== 'number') profile.bossDefeatedCount = 0;
      }
    } catch(e) {}

    function saveProfile() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
        localStorage.setItem(GFX_STORAGE_KEY, profile.graphicsPreset || 'high');
      } catch(e) {}
      refreshMenuUI();
    }
    function getRankTitle(lvl) {
      if (lvl >= 15) return 'APEX COMMANDER';
      if (lvl >= 10) return 'PHANTOM ELITE';
      if (lvl >= 6) return 'VANGUARD';
      if (lvl >= 3) return 'SENTINEL';
      return 'RECRUIT';
    }

    // =========================================================================
    // 1B. HYBRID GLOBAL / LOCAL LEADERBOARD STORE
    // =========================================================================
    const LB_KEY = 'GIS_SHOOTER_LEADERBOARD_V1';
    function getWeekKey() {
      const n = new Date();
      const d = new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
      const dn = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - dn);
      const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const wn = Math.ceil(((d - ys) / 86400000 + 1) / 7);
      return d.getUTCFullYear() + '-W' + (wn < 10 ? '0' : '') + wn;
    }
    function fmtTime(sec) {
      const s = Math.max(0, Math.floor(sec));
      const m = Math.floor(s / 60), r = s % 60;
      return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
    }
    const LB_FLAGS = [['US','🇺🇸'],['JP','🇯🇵'],['KR','🇰🇷'],['DE','🇩🇪'],['ID','🇮🇩'],['SG','🇸🇬'],['GB','🇬🇧'],['CA','🇨🇦'],['SE','🇸🇪'],['FR','🇫🇷'],['AU','🇦🇺'],['BR','🇧🇷']];
    const LB_HEROES = ['Ghost_Rider','CyberNinja99','AlphaZero','Valkyrie_KR','SpectreOps','NovaStrike','ShadowViper','Kestrel_77','Phantom_ID','ZeroCool_X','ApexSniper','RoninBlade','CobaltWolf','Orion_Prime','Aegis_Unit4','VortexEcho','Hyperion_9','RaptorSeven','IceBreaker','DeltaWraith'];
    const LB_PRE = ['Kilo','Echo','Sierra','Tango','Razor','Titan','Nyx','Vector','Pulse','Omega','Frost','Blitz','Helios','Atlas','Vanguard','Striker'];
    const LB_SUF = ['01','07','13','24','42','88','99','X','Pro','Ops','HQ','Tac'];
    const OP_COLORS = ['#06b6d4','#f59e0b','#10b981','#ef4444','#38bdf8','#a855f7'];
    const OP_WEPS = ['AR-X7 Tactical','Vector-V9 Tactical','SG-12 Breach','SR-50 Marksman','.50 Desert Python'];
    function hashStr(s) {
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      return h >>> 0;
    }
    function lbRand(seed) {
      let a = seed >>> 0;
      return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }
    function buildRoster(cnt, seed, ceil, flr, wk) {
      const r = lbRand(seed), used = new Set(), out = [];
      for (let i = 0; i < cnt; i++) {
        let name = i < LB_HEROES.length ? LB_HEROES[i] : '';
        if (!name) {
          for (let k = 0; k < 15; k++) {
            const c = LB_PRE[Math.floor(r()*LB_PRE.length)] + '_' + LB_SUF[Math.floor(r()*LB_SUF.length)];
            if (!used.has(c)) { name = c; break; }
          }
          if (!name) name = 'Operative_' + (100 + i);
        }
        used.add(name);
        const t = i / Math.max(1, cnt - 1), curve = Math.pow(1 - t, 1.55), jit = (r() - 0.5) * 0.045;
        const score = Math.max(flr, Math.round((flr + (ceil - flr) * Math.max(0, Math.min(1, curve + jit))) / 10) * 10);
        const wave = Math.max(1, Math.min(18, Math.round(1 + (score / ceil) * 13 + (r() - 0.5) * 2)));
        const kills = Math.max(4, Math.round(score / (155 + r() * 35)));
        const headshots = Math.min(kills, Math.round(kills * (0.28 + r() * 0.34)));
        const accuracy = Math.min(89, Math.max(24, Math.round(32 + (1 - t) * 40 + (r() - 0.5) * 12)));
        const survivalSec = Math.max(45, Math.round(wave * 54 + kills * 4.5 + r() * 45));
        const fl = LB_FLAGS[Math.floor(r()*LB_FLAGS.length)];
        const level = Math.max(1, Math.min(25, Math.round(1 + (score / ceil) * 19 + r() * 3)));
        const avatarColor = OP_COLORS[Math.floor(r()*OP_COLORS.length)];
        const favoriteWeapon = OP_WEPS[Math.floor(r()*OP_WEPS.length)];
        out.push({ id: 'bot_'+(wk||'g')+'_'+i, callsign: name, countryCode: fl[0], flag: fl[1], kills, headshots, accuracy, survivalSec, wave, score, isPlayer: false, weekKey: wk, level, avatarColor, favoriteWeapon });
      }
      return out;
    }
    const GLOBAL_BOTS = buildRoster(96, 0x47495331, 24500, 620, null);
    function getWeeklyBots(wk) {
      return buildRoster(64, hashStr('WEEK_' + wk), 16800, 540, wk);
    }
    function loadLocalLb() {
      try { const raw = localStorage.getItem(LB_KEY); const arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr : []; } catch(e) { return []; }
    }
    function saveLocalLb(entry) {
      const wk = getWeekKey(), rec = Object.assign({}, entry, { id: 'plr_'+Date.now()+'_'+Math.random().toString(36).slice(2,6), timestamp: Date.now(), isPlayer: true, weekKey: wk });
      const next = [rec].concat(loadLocalLb()).sort((a,b) => b.score - a.score || b.kills - a.kills || b.accuracy - a.accuracy).slice(0, 60);
      try { localStorage.setItem(LB_KEY, JSON.stringify(next)); } catch(e) {}
      return rec;
    }
    const ADMIN_PIN = '2026';
    const BAN_KEY = 'GIS_SHOOTER_BANNED_CALLSIGNS_V1';
    const DEL_KEY = 'GIS_SHOOTER_DELETED_SCORES_V1';
    function loadBanned() { try { const r = localStorage.getItem(BAN_KEY); const a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a.map(s => String(s).trim().toUpperCase()) : []; } catch(e) { return []; } }
    function loadDeletedIds() { try { const r = localStorage.getItem(DEL_KEY); const a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : []; } catch(e) { return []; } }
    function banOrRemoveEntry(id, callsign) {
      const del = new Set(loadDeletedIds()); del.add(id);
      try { localStorage.setItem(DEL_KEY, JSON.stringify(Array.from(del))); } catch(e) {}
      const loc = loadLocalLb().filter(e => e.id !== id);
      try { localStorage.setItem(LB_KEY, JSON.stringify(loc)); } catch(e) {}
      if (callsign && callsign.trim()) {
        const b = new Set(loadBanned()); b.add(callsign.trim().toUpperCase());
        try { localStorage.setItem(BAN_KEY, JSON.stringify(Array.from(b))); } catch(e) {}
      }
    }
    function unbanEntryCallsign(cs) {
      const norm = cs.trim().toUpperCase();
      try { localStorage.setItem(BAN_KEY, JSON.stringify(loadBanned().filter(c => c !== norm))); } catch(e) {}
    }
    function clearAllBans() {
      try { localStorage.setItem(BAN_KEY, '[]'); localStorage.setItem(DEL_KEY, '[]'); } catch(e) {}
    }
    function addCustomLbScore(cs, sc, wv, kl, ac) {
      const cleanCs = (cs || 'OPERATIVE').trim().toUpperCase();
      unbanEntryCallsign(cleanCs);
      const loc = loadLocalLb(), wk = getWeekKey();
      const idx = loc.findIndex(e => e.callsign.trim().toUpperCase() === cleanCs);
      const rec = {
        id: idx >= 0 ? loc[idx].id : 'adm_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
        callsign: cleanCs, countryCode: 'ID', flag: '🇮🇩',
        kills: Math.max(0, Math.round(kl)), headshots: Math.round(Math.max(0, kl) * 0.45),
        accuracy: Math.max(0, Math.min(100, Math.round(ac))),
        survivalSec: Math.max(60, Math.round(wv) * 55 + Math.round(kl) * 4),
        wave: Math.max(1, Math.min(99, Math.round(wv))),
        score: Math.max(0, Math.round(sc)), xpEarned: Math.round(Math.max(0, sc) * 0.4),
        timestamp: Date.now(), isPlayer: true, weekKey: wk,
        level: Math.min(25, Math.max(1, Math.round(1 + wv * 1.2))), avatarColor: '#f59e0b', favoriteWeapon: 'AR-X7 Tactical'
      };
      if (idx >= 0) loc[idx] = Object.assign({}, loc[idx], rec); else loc.unshift(rec);
      const next = loc.sort((a,b) => b.score - a.score || b.kills - a.kills || b.accuracy - a.accuracy).slice(0, 60);
      try { localStorage.setItem(LB_KEY, JSON.stringify(next)); } catch(e) {}
      return rec;
    }
    function getMergedLb(tab) {
      const loc = loadLocalLb(), wk = getWeekKey(), me = profile.callsign.trim().toUpperCase();
      const banSet = new Set(loadBanned()), delSet = new Set(loadDeletedIds());
      const cloud = (window.__GIS_CLOUD__ && Array.isArray(window.__GIS_CLOUD__.entries)) ? window.__GIS_CLOUD__.entries : [];
      const cloudBest = {};
      cloud.forEach(c => {
        const k = (c.callsign || '').trim().toUpperCase();
        if (cloudBest[k] === undefined || c.score > cloudBest[k]) cloudBest[k] = c.score;
      });
      let pool = [];
      if (tab === 'personal') {
        pool = cloud.filter(c => (c.callsign || '').trim().toUpperCase() === me).concat(loc);
      } else if (tab === 'weekly') {
        const wCloud = cloud.filter(e => !e.weekKey || e.weekKey === wk);
        const wLoc = loc.filter(e => (!e.weekKey || e.weekKey === wk) && (cloudBest[(e.callsign || '').trim().toUpperCase()] === undefined || e.score > cloudBest[(e.callsign || '').trim().toUpperCase()]));
        pool = wCloud.concat(wLoc, getWeeklyBots(wk));
      } else {
        const uLoc = loc.filter(e => cloudBest[(e.callsign || '').trim().toUpperCase()] === undefined || e.score > cloudBest[(e.callsign || '').trim().toUpperCase()]);
        pool = cloud.concat(uLoc, GLOBAL_BOTS);
      }
      pool = pool.filter(e => !delSet.has(e.id) && !banSet.has((e.callsign || '').trim().toUpperCase()));
      pool.sort((a,b) => b.score - a.score || b.kills - a.kills || b.accuracy - a.accuracy);
      let bestRank = null;
      const rows = pool.slice(0, 100).map((r, i) => {
        const isMe = !!(r.isPlayer && r.callsign.trim().toUpperCase() === me);
        if (isMe && bestRank === null) bestRank = i + 1;
        return Object.assign({}, r, { rank: i + 1, isMe });
      });
      if (bestRank === null && tab !== 'personal') {
        const fi = pool.findIndex(r => r.isPlayer && r.callsign.trim().toUpperCase() === me);
        if (fi >= 0) bestRank = fi + 1;
      }
      return { rows, bestRank, localCount: loc.length, cloudCount: cloud.length, wk };
    }
    function resolveOpProfile(r) {
      const h = hashStr(r.callsign || r.id || 'OP');
      const isMe = !!(r.isPlayer && r.callsign && r.callsign.trim().toUpperCase() === profile.callsign.trim().toUpperCase());
      const level = r.level || (isMe ? profile.level : Math.max(1, Math.min(25, Math.round(1 + r.wave * 1.1))));
      const avatarColor = r.avatarColor || (isMe ? profile.accentColor : OP_COLORS[h % OP_COLORS.length]);
      const favoriteWeapon = r.favoriteWeapon || (isMe ? (OP_WEPS[(profile.preferredSlot || 0) % OP_WEPS.length] || OP_WEPS[0]) : OP_WEPS[h % OP_WEPS.length]);
      const hsRatio = r.kills > 0 ? Math.min(100, Math.round(((r.headshots || 0) / r.kills) * 100)) : 0;
      return {
        rank: r.rank, callsign: r.callsign, countryCode: r.countryCode, flag: r.flag,
        level, rankTitle: getRankTitle(level), avatarColor, favoriteWeapon,
        kills: r.kills, hsRatio, accuracy: r.accuracy, wave: r.wave, score: r.score, survivalSec: r.survivalSec
      };
    }

    // =========================================================================
    // 2. LAYERED PROCEDURAL WEB AUDIO SYNTHESIZER
    // =========================================================================
    const AudioSys = {
      ctx: null, master: null, lobbyGain: null, lobbyNodes: [], lobbyTimer: null, lobbyActive: false, noise: null,
      init() {
        if (this.ctx) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = profile.masterVolume;
        this.master.connect(this.ctx.destination);
        this.lobbyGain = this.ctx.createGain();
        this.lobbyGain.gain.value = 0;
        this.lobbyGain.connect(this.master);
        const len = Math.floor(this.ctx.sampleRate * 1.5);
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      },
      resume() { this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
      setVolume(v) { if (this.master && this.ctx) this.master.gain.setValueAtTime(v, this.ctx.currentTime); },
      startLobbyAmbient() {
        this.resume();
        if (!this.ctx || !this.lobbyGain || this.lobbyActive) return;
        this.lobbyActive = true;
        const t = this.ctx.currentTime;
        this.lobbyGain.gain.cancelScheduledValues(t);
        this.lobbyGain.gain.setValueAtTime(0, t);
        this.lobbyGain.gain.linearRampToValueAtTime(0.85, t + 0.7);
        const sub = this.ctx.createOscillator(), sg = this.ctx.createGain();
        sub.type = 'sine'; sub.frequency.setValueAtTime(54, t); sg.gain.setValueAtTime(0.06, t);
        sub.connect(sg); sg.connect(this.lobbyGain); sub.start(t);
        const hum = this.ctx.createOscillator(), hf = this.ctx.createBiquadFilter(), hg = this.ctx.createGain();
        hum.type = 'triangle'; hum.frequency.setValueAtTime(108, t); hf.type = 'lowpass'; hf.frequency.value = 190; hg.gain.value = 0.03;
        hum.connect(hf); hf.connect(hg); hg.connect(this.lobbyGain); hum.start(t);
        this.lobbyNodes = [sub, hum];
        if (this.lobbyTimer) clearInterval(this.lobbyTimer);
        this.lobbyTimer = setInterval(() => {
          if (!this.ctx || !this.lobbyActive || this.ctx.state !== 'running') return;
          const pt = this.ctx.currentTime, p = this.ctx.createOscillator(), pg = this.ctx.createGain();
          p.type = 'sine'; p.frequency.setValueAtTime(1180, pt); p.frequency.exponentialRampToValueAtTime(1135, pt + 0.45);
          pg.gain.setValueAtTime(0.001, pt); pg.gain.linearRampToValueAtTime(0.045, pt + 0.02); pg.gain.exponentialRampToValueAtTime(0.0008, pt + 0.5);
          p.connect(pg); pg.connect(this.lobbyGain); p.start(pt); p.stop(pt + 0.52);
        }, 3600);
      },
      stopLobbyAmbient() {
        if (!this.lobbyActive) return;
        this.lobbyActive = false;
        if (this.lobbyTimer) { clearInterval(this.lobbyTimer); this.lobbyTimer = null; }
        if (this.ctx && this.lobbyGain) {
          const t = this.ctx.currentTime;
          this.lobbyGain.gain.cancelScheduledValues(t);
          this.lobbyGain.gain.setValueAtTime(this.lobbyGain.gain.value, t);
          this.lobbyGain.gain.linearRampToValueAtTime(0, t + 0.25);
        }
        const nodes = this.lobbyNodes.slice(); this.lobbyNodes = [];
        setTimeout(() => nodes.forEach(n => { try { n.stop(); n.disconnect(); } catch(e){} }), 280);
      },
      playNoise(dur, type, freq, endFreq, q, gainStart, delay = 0) {
        if (!this.ctx || !this.noise) return;
        const t = this.ctx.currentTime + delay;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noise;
        const flt = this.ctx.createBiquadFilter();
        flt.type = type;
        flt.frequency.setValueAtTime(freq, t);
        if (endFreq) flt.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
        flt.Q.value = q;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(gainStart, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.connect(flt); flt.connect(g); g.connect(this.master);
        src.start(t); src.stop(t + dur + 0.02);
      },
      playTone(f1, f2, dur, wave, gainStart, delay = 0) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = wave;
        o.frequency.setValueAtTime(f1, t);
        if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
        g.gain.setValueAtTime(gainStart, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(this.master);
        o.start(t); o.stop(t + dur + 0.02);
      },
      rifle() {
        this.playTone(190, 42, 0.1, 'triangle', 0.7);
        this.playNoise(0.08, 'bandpass', 2400, null, 1.4, 0.85);
        this.playNoise(0.22, 'lowpass', 1200, 220, 1, 0.28, 0.02);
      },
      shotgun() {
        this.playTone(145, 28, 0.24, 'sine', 0.95);
        this.playNoise(0.34, 'lowpass', 3200, 240, 1, 0.95);
        setTimeout(() => {
          this.playNoise(0.07, 'bandpass', 1800, null, 4, 0.35);
          this.playNoise(0.07, 'bandpass', 2400, null, 5, 0.38, 0.12);
        }, 250);
      },
      sniper() {
        this.playTone(240, 38, 0.14, 'sine', 0.85);
        this.playNoise(0.16, 'bandpass', 3600, 900, 1.8, 0.6);
        setTimeout(() => this.playTone(1400, 950, 0.08, 'square', 0.1), 400);
      },
      reload(dur = 1.75) {
        const d = Math.max(0.8, dur);
        this.playTone(620, 210, 0.08, 'sine', 0.25);
        this.playTone(240, 95, 0.1, 'triangle', 0.38, d * 0.34);
        this.playTone(820, 320, 0.12, 'sawtooth', 0.32, d * 0.72);
      },
      hit(hs) {
        if (hs) {
          this.playTone(2600, 2500, 0.14, 'triangle', 0.34);
          this.playTone(3900, 3800, 0.14, 'sine', 0.24);
        } else {
          this.playTone(1650, 1100, 0.06, 'sine', 0.26);
        }
      },
      step(sprint) { this.playTone(sprint ? 110 : 80, 28, 0.08, 'sine', sprint ? 0.16 : 0.1); },
      clink() { this.playTone(3800 + Math.random()*900, 2600, 0.04, 'sine', 0.04); },
      hurt() { this.playTone(170, 52, 0.2, 'sawtooth', 0.42); },
      lowHp() { this.playTone(580, 440, 0.15, 'sine', 0.09); },
      heal() {
        this.playNoise(0.32, 'highpass', 2400, null, 1, 0.25);
        [440, 554, 659, 880].forEach((f, i) => this.playTone(f, f, 0.22, 'sine', 0.15, i * 0.07));
      },
      vampHeal() {
        [587.33, 880, 1174.66].forEach((f, i) => this.playTone(f, f * 1.01, i === 2 ? 0.2 : 0.13, 'sine', i === 2 ? 0.18 : 0.14, i * 0.055));
      },
      enemyShot() { this.playTone(920, 160, 0.13, 'sawtooth', 0.2); },
      enemyKill() { this.playTone(220, 36, 0.34, 'sawtooth', 0.4); },
      smg() {
        this.playTone(245, 55, 0.065, 'triangle', 0.45);
        this.playNoise(0.055, 'bandpass', 1750, null, 2.0, 0.42);
      },
      magnum() {
        this.playTone(260, 34, 0.19, 'sawtooth', 0.85);
        this.playNoise(0.24, 'bandpass', 3100, 480, 1.2, 0.92);
      },
      swap() {
        this.playNoise(0.085, 'bandpass', 900, null, 1.4, 0.18);
        this.playTone(1150, 520, 0.06, 'triangle', 0.2, 0.06);
      },
      flashClick() { this.playTone(1900, 900, 0.03, 'square', 0.14); },
      grenadeThrow() {
        this.playTone(2800, 1600, 0.05, 'sine', 0.2);
        this.playNoise(0.16, 'bandpass', 420, 1400, 1.2, 0.3, 0.02);
      },
      flashFrag() {
        this.playTone(160, 24, 0.42, 'sine', 0.95);
        this.playNoise(0.54, 'lowpass', 5200, 220, 1, 0.95);
        this.playTone(3400, 2900, 0.52, 'sine', 0.1, 0.03);
      },
      scoreSubmit() {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          this.playTone(f, f, i === 3 ? 0.42 : 0.2, i === 3 ? 'triangle' : 'sine', i === 3 ? 0.28 : 0.2, i * 0.075);
        });
      },
      bossTimer: null, bossActive: false, bossStep: 0,
      bossMusicStart() {
        this.resume();
        if (!this.ctx || this.bossActive) return;
        this.bossActive = true; this.bossStep = 0;
        const pat = [55, 55, 65.4, 55, 73.4, 55, 82.4, 73.4];
        if (this.bossTimer) clearInterval(this.bossTimer);
        this.bossTimer = setInterval(() => {
          if (!this.ctx || !this.bossActive || this.ctx.state !== 'running') return;
          const note = pat[this.bossStep % pat.length]; this.bossStep++;
          this.playTone(note, note * 0.96, 0.22, 'sawtooth', 0.14);
          if (this.bossStep % 2 === 1) this.playTone(110, 42, 0.14, 'sine', 0.2);
          if (this.bossStep % 4 === 0) this.playNoise(0.06, 'highpass', 3200, null, 1.2, 0.1);
        }, 230);
      },
      bossMusicStop() {
        this.bossActive = false;
        if (this.bossTimer) { clearInterval(this.bossTimer); this.bossTimer = null; }
      },
      bossAlarm() {
        [0, 0.36, 0.72].forEach(d => {
          this.playTone(460, 790, 0.16, 'sawtooth', 0.2, d);
          this.playTone(790, 460, 0.16, 'sawtooth', 0.18, d + 0.16);
        });
      },
      syringeShot() {
        this.playNoise(0.11, 'bandpass', 2800, 1400, 2.2, 0.25);
        this.playTone(980, 420, 0.1, 'triangle', 0.18);
      },
      gasHiss() { this.playNoise(0.55, 'bandpass', 1850, 750, 1.1, 0.28); },
      scalpelRush() { this.playTone(320, 1450, 0.24, 'sawtooth', 0.22); },
      bossDefeat() {
        this.bossMusicStop();
        [261.63, 329.63, 392, 523.25, 659.25].forEach((f, i) => {
          this.playTone(f, f, i === 4 ? 0.6 : 0.28, 'triangle', 0.24, i * 0.09);
        });
      }
    };

    // =========================================================================
    // 3. THREE.JS SCENE, RENDERER & PROCEDURAL TEXTURES + BUMP MAPS
    // =========================================================================
    const wrap = document.getElementById('canvas-wrap');
    let currentAntialias = profile.graphicsPreset !== 'potato';
    let renderer = new THREE.WebGLRenderer({ antialias: currentAntialias, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(profile.graphicsPreset === 'potato' ? 0.75 : profile.graphicsPreset === 'medium' ? 1.0 : Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = profile.graphicsPreset !== 'potato';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0C1017);
    scene.fog = new THREE.FogExp2(0x0C1017, 0.014);

    const camera = new THREE.PerspectiveCamera(profile.baseFov, window.innerWidth / window.innerHeight, 0.08, 500);
    scene.add(camera);

    // Lighting (+ Potato Mode Ambient Fallback)
    const arenaAmbient = new THREE.AmbientLight(0xdbeafe, 1.35);
    arenaAmbient.visible = false;
    scene.add(arenaAmbient);
    const arenaHemi = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.72);
    scene.add(arenaHemi);
    const sun = new THREE.DirectionalLight(0xfef3c7, 1.8);
    sun.position.set(32, 48, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -46; sun.shadow.camera.right = 46;
    sun.shadow.camera.top = 46; sun.shadow.camera.bottom = -46;
    sun.shadow.bias = -0.0004;
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x06b6d4, 0.55);
    rim.position.set(-35, 24, -30);
    scene.add(rim);
    const arenaPointLights = [];

    // Procedural Canvas Textures
    function makeFloorMaps() {
      const s = 512, ac = document.createElement('canvas'), bc = document.createElement('canvas');
      ac.width = bc.width = s; ac.height = bc.height = s;
      const ax = ac.getContext('2d'), bx = bc.getContext('2d');
      ax.fillStyle = '#181e28'; ax.fillRect(0, 0, s, s);
      bx.fillStyle = '#808080'; bx.fillRect(0, 0, s, s);
      for (let i = 0; i < 6000; i++) {
        const x = Math.random()*s, y = Math.random()*s, v = Math.random();
        ax.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.08)'; ax.fillRect(x, y, 2, 2);
        const bv = Math.floor(110 + v*36); bx.fillStyle = 'rgb('+bv+','+bv+','+bv+')'; bx.fillRect(x, y, 2, 2);
      }
      const tile = 128;
      for (let x = 0; x < s; x += tile) for (let y = 0; y < s; y += tile) {
        ax.strokeStyle = '#0c1017'; ax.lineWidth = 4; ax.strokeRect(x, y, tile, tile);
        bx.strokeStyle = '#202020'; bx.lineWidth = 4; bx.strokeRect(x, y, tile, tile);
        if ((x/tile + y/tile) % 2 === 0) {
          ax.fillStyle = 'rgba(6,182,212,0.35)'; ax.fillRect(x+14, y+tile-18, 34, 3);
        }
      }
      const map = new THREE.CanvasTexture(ac); map.encoding = THREE.sRGBEncoding; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(14, 14);
      const bump = new THREE.CanvasTexture(bc); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(14, 14);
      return { map, bump };
    }

    function makeWallMaps() {
      const s = 512, ac = document.createElement('canvas'), bc = document.createElement('canvas');
      ac.width = bc.width = s; ac.height = bc.height = s;
      const ax = ac.getContext('2d'), bx = bc.getContext('2d');
      ax.fillStyle = '#1b222e'; ax.fillRect(0, 0, s, s);
      bx.fillStyle = '#707070'; bx.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 128) {
        ax.fillStyle = y % 256 === 0 ? '#232c3b' : '#1e2634'; ax.fillRect(6, y+6, s-12, 116);
        bx.fillStyle = '#b0b0b0'; bx.fillRect(6, y+6, s-12, 116);
        ax.strokeStyle = '#090d14'; ax.lineWidth = 6; ax.strokeRect(0, y, s, 128);
        bx.strokeStyle = '#181818'; bx.lineWidth = 6; bx.strokeRect(0, y, s, 128);
      }
      ax.fillStyle = '#06b6d4'; ax.fillRect(16, 248, s-32, 4);
      const map = new THREE.CanvasTexture(ac); map.encoding = THREE.sRGBEncoding; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(4, 2);
      const bump = new THREE.CanvasTexture(bc); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(4, 2);
      return { map, bump };
    }

    function makeCrateMap(tint) {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#1d2330'; ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#2d3748'; ctx.fillRect(10, 10, 236, 236);
      ctx.fillStyle = '#161b24'; ctx.fillRect(28, 28, 200, 200);
      ctx.fillStyle = tint; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
      ctx.fillText('GIS TACTICAL', 128, 120);
      const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
      return tex;
    }

    function makeDecalTex() {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(32,32,3,32,32,30);
      g.addColorStop(0,'rgba(8,10,14,0.98)'); g.addColorStop(0.4,'rgba(20,24,30,0.75)'); g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0,0,64,64);
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
    }

    // Sky Dome
    const skyC = document.createElement('canvas'); skyC.width = 512; skyC.height = 256;
    const skyCtx = skyC.getContext('2d');
    const sg = skyCtx.createLinearGradient(0,0,0,256);
    sg.addColorStop(0,'#04070d'); sg.addColorStop(0.6,'#09111e'); sg.addColorStop(1,'#0c1017');
    skyCtx.fillStyle = sg; skyCtx.fillRect(0,0,512,256);
    for (let i = 0; i < 220; i++) { skyCtx.fillStyle = 'rgba(255,255,255,0.6)'; skyCtx.fillRect(Math.random()*512, Math.random()*150, 1.2, 1.2); }
    const skyTex = new THREE.CanvasTexture(skyC); skyTex.encoding = THREE.sRGBEncoding;
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(220, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })));

    // =========================================================================
    // 4. TACTICAL FACILITY MAP & COLLISIONS
    // =========================================================================
    const fMaps = makeFloorMaps(), wMaps = makeWallMaps();
    const floorMat = new THREE.MeshStandardMaterial({ map: fMaps.map, bumpMap: fMaps.bump, bumpScale: 0.04, roughness: 0.72, metalness: 0.25 });
    const wallMat = new THREE.MeshStandardMaterial({ map: wMaps.map, bumpMap: wMaps.bump, bumpScale: 0.06, roughness: 0.48, metalness: 0.58 });
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x263143, roughness: 0.32, metalness: 0.85 });
    const rampMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.45, metalness: 0.5 });

    const collisions = [], obstacleMeshes = [], radarRects = [], energyCores = [];

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI/2), floorMat);
    floor.receiveShadow = true;
    scene.add(floor); obstacleMeshes.push(floor);

    function addBox(x, y, z, w, h, d, mat, type, rotY = 0) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y + h/2, z); m.rotation.y = rotY;
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m); obstacleMeshes.push(m);
      m.updateMatrixWorld();
      collisions.push({ box: new THREE.Box3().setFromObject(m), type, mesh: m });
      if (y === 0 && (type === 'wall' || type === 'crate')) radarRects.push({ x, z, w, d, rotY, kind: type });
      return m;
    }

    // Perimeter Walls
    addBox(0, 0, -41, 84, 6.5, 2, wallMat, 'wall');
    addBox(0, 0, 41, 84, 6.5, 2, wallMat, 'wall');
    addBox(41, 0, 0, 2, 6.5, 80, wallMat, 'wall');
    addBox(-41, 0, 0, 2, 6.5, 80, wallMat, 'wall');

    // Tactical Cover Walls
    [[-13,-11,8,1.85,0],[13,-11,8,1.85,0],[-13,13,8,1.85,0],[13,13,8,1.85,0],
     [-24,0,7.5,2.2,Math.PI/2],[24,0,7.5,2.2,Math.PI/2],[0,-23,10,2.0,0],[0,23,10,2.0,0],
     [-18,-25,6.5,1.6,Math.PI/4],[18,-25,6.5,1.6,-Math.PI/4],[-18,25,6.5,1.6,-Math.PI/4],[18,25,6.5,1.6,Math.PI/4]
    ].forEach(([x,z,l,h,r]) => addBox(x, 0, z, l, h, 0.85, wallMat, 'wall', r));

    // Stacked Cargo Crates
    const cOrange = new THREE.MeshStandardMaterial({ map: makeCrateMap('#f59e0b'), roughness: 0.46, metalness: 0.5 });
    const cCyan = new THREE.MeshStandardMaterial({ map: makeCrateMap('#06b6d4'), roughness: 0.46, metalness: 0.5 });
    [[-18,0,-8,2.5,cOrange,0.08],[-15.2,0,-8,2.5,cCyan,-0.05],[-16.6,2.5,-8,2.35,cOrange,0.04],
     [18,0,-8,2.5,cCyan,0],[20.8,0,-8,2.5,cOrange,0.1],[19.4,2.5,-8,2.35,cCyan,0.14],
     [-20,0,16,2.5,cOrange,0.14],[-22.8,0,16,2.5,cCyan,-0.08],[20,0,16,2.5,cCyan,0.05],[17.2,0,16,2.5,cOrange,-0.1]
    ].forEach(([x,y,z,s,m,r]) => addBox(x, y, z, s, s, s, m, 'crate', r));

    // Central Catwalk Bridge (Y = 3.2m) & Access Ramps
    const platY = 3.2;
    const catwalk = new THREE.Mesh(new THREE.BoxGeometry(14, 0.42, 10), trussMat);
    catwalk.position.set(0, platY, 0); catwalk.castShadow = true; catwalk.receiveShadow = true;
    scene.add(catwalk); obstacleMeshes.push(catwalk);
    collisions.push({ box: new THREE.Box3(new THREE.Vector3(-7, platY-0.21, -5), new THREE.Vector3(7, platY+0.21, 5)), type: 'platform', mesh: catwalk });
    radarRects.push({ x: 0, z: 0, w: 14, d: 10, kind: 'platform' });

    const rLen = 9.5, rAng = Math.atan2(platY, rLen);
    const nRamp = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.3, rLen), rampMat);
    nRamp.rotation.x = -rAng; nRamp.position.set(0, platY/2, -5 - rLen/2);
    scene.add(nRamp); obstacleMeshes.push(nRamp);
    collisions.push({ box: new THREE.Box3(new THREE.Vector3(-1.9, 0, -5-rLen), new THREE.Vector3(1.9, platY, -5)), type: 'ramp', heightAt: (x,z) => Math.max(0, Math.min(platY, ((z - (-5-rLen))/rLen)*platY)) });

    const sRamp = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.3, rLen), rampMat);
    sRamp.rotation.x = rAng; sRamp.position.set(0, platY/2, 5 + rLen/2);
    scene.add(sRamp); obstacleMeshes.push(sRamp);
    collisions.push({ box: new THREE.Box3(new THREE.Vector3(-1.9, 0, 5), new THREE.Vector3(1.9, platY, 5+rLen)), type: 'ramp', heightAt: (x,z) => Math.max(0, Math.min(platY, (((5+rLen) - z)/rLen)*platY)) });

    // Energy Beacons + Colored PointLights
    [[-26,12,0x06b6d4,0],[26,-12,0xf59e0b,0],[0,0,0x06b6d4,platY+0.2]].forEach(([cx,cz,col,yb]) => {
      const g = new THREE.Group(); g.position.set(cx, yb, cz);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.32,3.0,14), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.6 }));
      rod.position.y = 1.8; g.add(rod); energyCores.push(rod);
      const pl = new THREE.PointLight(col, 18, 22, 1.4); pl.position.y = 2.5; g.add(pl);
      arenaPointLights.push({ light: pl, base: 18 });
      scene.add(g);
    });

    // =========================================================================
    // 5. STRICT 4-SLOT ARSENAL, ULTRA-DETAILED PBR VIEWMODELS & ATTACHMENTS
    // =========================================================================
    const WEAPON_BASE_SLOTS = [
      { id: 'ar_x7', name: 'AR-X7 Tactical', shortName: 'AR-X7', type: 'rifle', slot: 1, damage: 38, fireRate: 0.105, magSize: 30, maxReserve: 150, currentAmmo: 30, reserveAmmo: 120, reloadTime: 1.75, spread: 0.036, adsSpread: 0.006, adsFov: 54, range: 130, caliber: '6.8MM SPC', desc: 'Modular assault carbine with moving bolt carrier, charging handle, holographic reflex optic, laser sight, and tactical light.' },
      { id: 'sg_12', name: 'SG-12 Breach', shortName: 'SG-12', type: 'shotgun', slot: 2, damage: 22, pellets: 8, fireRate: 0.78, magSize: 8, maxReserve: 40, currentAmmo: 8, reserveAmmo: 32, reloadTime: 2.1, spread: 0.088, adsSpread: 0.048, adsFov: 60, range: 46, caliber: '12 GAUGE', desc: 'Pump-action tactical shotgun with ventilated barrel heat shield, animated pump forend, bolt carrier, and underbarrel torch.' },
      { id: 'sr_50', name: 'SR-50 Marksman', shortName: 'SR-50', type: 'sniper', slot: 3, damage: 120, fireRate: 1.05, magSize: 5, maxReserve: 25, currentAmmo: 5, reserveAmmo: 20, reloadTime: 2.35, spread: 0.055, adsSpread: 0.0008, adsFov: 26, range: 220, caliber: '.338 SUPP', desc: 'Long-range precision marksman rifle with integral suppressor, variable 8x reflective optic scope, bolt handle, and folding bipod.' }
    ];
    const SLOT4_OPTIONS = [
      { id: 'desert_python', name: '.50 Desert Python', shortName: '.50 PYTHON', type: 'pistol', slot: 4, damage: 65, hsMult: 3.0, fireRate: 0.34, magSize: 7, maxReserve: 42, currentAmmo: 7, reserveAmmo: 35, reloadTime: 1.35, spread: 0.026, adsSpread: 0.004, adsFov: 60, range: 95, caliber: '.50 AE MAG', desc: 'Heavy magnum sidearm featuring brushed steel reciprocating slide with last-shot hold-open, rib barrel, and underbarrel laser.' },
      { id: 'nano_medkit', name: 'Nano-Medkit', shortName: 'MEDKIT', type: 'medkit', slot: 4, damage: 0, fireRate: 1.0, magSize: 1, maxReserve: 3, currentAmmo: 2, reserveAmmo: 2, reloadTime: 0.5, spread: 0, adsSpread: 0, adsFov: 68, range: 0, caliber: 'BIO-GEL', desc: 'Pressurized nanite injector restoring +60 HP and +35 Armor immediately.' }
    ];
    function buildFourSlotLoadout(choice) {
      const c = choice || profile.slot4Choice || 'desert_python';
      const s4 = c === 'nano_medkit' ? SLOT4_OPTIONS[1] : SLOT4_OPTIONS[0];
      return JSON.parse(JSON.stringify([WEAPON_BASE_SLOTS[0], WEAPON_BASE_SLOTS[1], WEAPON_BASE_SLOTS[2], s4]));
    }
    const WEAPON_TEMPLATES = buildFourSlotLoadout('desert_python');

    function makeWearTextures() {
      const s = 256, rc = document.createElement('canvas'), bc = document.createElement('canvas');
      rc.width = rc.height = bc.width = bc.height = s;
      const rx = rc.getContext('2d'), bx = bc.getContext('2d');
      rx.fillStyle = '#545454'; rx.fillRect(0,0,s,s);
      bx.fillStyle = '#808080'; bx.fillRect(0,0,s,s);
      for (let i=0; i<750; i++) {
        const x = Math.random()*s, y = Math.random()*s, l = 8 + Math.random()*22;
        rx.strokeStyle = Math.random()>0.5 ? 'rgba(200,200,200,0.16)' : 'rgba(30,30,30,0.18)';
        rx.beginPath(); rx.moveTo(x,y); rx.lineTo(x+l,y); rx.stroke();
        bx.strokeStyle = Math.random()>0.5 ? 'rgba(180,180,180,0.18)' : 'rgba(65,65,65,0.18)';
        bx.beginPath(); bx.moveTo(x,y); bx.lineTo(x+l,y); bx.stroke();
      }
      for (let i=0; i<50; i++) {
        const x = Math.random()*s, y = Math.random()*s;
        rx.strokeStyle = 'rgba(235,235,235,0.25)'; rx.beginPath(); rx.moveTo(x,y); rx.lineTo(x+(Math.random()-0.5)*18, y+(Math.random()-0.5)*18); rx.stroke();
      }
      const rMap = new THREE.CanvasTexture(rc); rMap.wrapS = rMap.wrapT = THREE.RepeatWrapping; rMap.repeat.set(2,2);
      const bMap = new THREE.CanvasTexture(bc); bMap.wrapS = bMap.wrapT = THREE.RepeatWrapping; bMap.repeat.set(2,2);
      return { rMap, bMap };
    }
    function makeKnurlBump() {
      const s = 128, c = document.createElement('canvas'); c.width = c.height = s;
      const x = c.getContext('2d'); x.fillStyle = '#686868'; x.fillRect(0,0,s,s);
      x.strokeStyle = '#c8c8c8'; x.lineWidth = 2;
      for (let i=-s; i<s*2; i+=8) { x.beginPath(); x.moveTo(i,0); x.lineTo(i+s,s); x.stroke(); x.beginPath(); x.moveTo(i+s,0); x.lineTo(i,s); x.stroke(); }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3,3); return t;
    }
    const wMapsGun = makeWearTextures(), knurlBump = makeKnurlBump();
    const mGun = new THREE.MeshStandardMaterial({ color: 0x2a323f, roughness: 0.34, metalness: 0.88, roughnessMap: wMapsGun.rMap, bumpMap: wMapsGun.bMap, bumpScale: 0.004 });
    const mDark = new THREE.MeshStandardMaterial({ color: 0x161c26, roughness: 0.38, metalness: 0.85, roughnessMap: wMapsGun.rMap, bumpMap: wMapsGun.bMap, bumpScale: 0.003 });
    const mPoly = new THREE.MeshStandardMaterial({ color: 0x12151c, roughness: 0.78, metalness: 0.12, bumpMap: knurlBump, bumpScale: 0.005 });
    const mTan = new THREE.MeshStandardMaterial({ color: 0x3f4756, roughness: 0.65, metalness: 0.22, bumpMap: knurlBump, bumpScale: 0.004 });
    const mChrome = new THREE.MeshStandardMaterial({ color: 0xb8c4d4, roughness: 0.16, metalness: 0.96, roughnessMap: wMapsGun.rMap });
    const mCyan = new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 1.5 });
    const mAmber = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 1.3 });
    const mEmerald = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 1.5 });
    const mRed = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.8 });
    const mGlass = new THREE.MeshPhysicalMaterial({ color: 0x0ea5e9, metalness: 0.1, roughness: 0.05, clearcoat: 1.0, clearcoatRoughness: 0.04, reflectivity: 1.0, transparent: true, opacity: 0.42, side: THREE.DoubleSide });
    const mLaserBeam = new THREE.MeshBasicMaterial({ color: 0xff1e38, transparent: true, opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending });

    function attachLaserFlash(g, lx, ly, lz, fx, fy, fz) {
      const lu = new THREE.Group(); lu.position.set(lx, ly, lz);
      lu.add(new THREE.Mesh(new THREE.BoxGeometry(0.024,0.024,0.082), mDark));
      const led = new THREE.Mesh(new THREE.CircleGeometry(0.0045, 8), mRed); led.position.z = -0.043; lu.add(led);
      const la = new THREE.Object3D(); la.name = 'laserAnchor'; la.position.z = -0.046; lu.add(la);
      const bg = new THREE.CylinderGeometry(0.0011, 0.0011, 1, 6); bg.rotateX(Math.PI/2); bg.translate(0,0,-0.5);
      const beam = new THREE.Mesh(bg, mLaserBeam); beam.name = 'laserBeam'; beam.scale.z = 16; la.add(beam);
      g.add(lu);

      const fu = new THREE.Group(); fu.position.set(fx, fy, fz);
      fu.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.09,10).rotateX(Math.PI/2), mDark));
      const bez = new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.013,0.024,10).rotateX(Math.PI/2), mGun); bez.position.z = -0.05; fu.add(bez);
      const flMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, emissive: 0xfef3c7, emissiveIntensity: 0.1, roughness: 0.15 });
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.012, 12), flMat); lens.name = 'flashLens'; lens.position.z = -0.063; fu.add(lens);
      g.add(fu);
    }

    const weaponRig = new THREE.Group();
    weaponRig.position.set(0.22, -0.22, -0.42);
    weaponRig.visible = false;
    camera.add(weaponRig);

    const viewmodels = {};
    function buildARX7() {
      const g = new THREE.Group();
      const rec = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.085, 0.36), mGun); g.add(rec);
      const bolt = new THREE.Group(); bolt.name = 'bolt'; bolt.position.set(0.024, 0.024, -0.04); bolt.userData = { baseZ: -0.04, travel: 0.058 };
      bolt.add(new THREE.Mesh(new THREE.BoxGeometry(0.012,0.024,0.095), mChrome)); g.add(bolt);
      const ch = new THREE.Group(); ch.name = 'ch'; ch.position.set(0, 0.042, 0.175); ch.userData = { baseZ: 0.175, travel: 0.07 };
      ch.add(new THREE.Mesh(new THREE.BoxGeometry(0.046,0.011,0.026), mChrome)); g.add(ch);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.012, 0.5), mDark); rail.position.set(0, 0.05, -0.14); g.add(rail);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.44, 12).rotateX(Math.PI/2), mDark); barrel.position.set(0, 0.015, -0.44); g.add(barrel);
      const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.018, 0.07, 10).rotateX(Math.PI/2), mGun); brake.position.set(0, 0.015, -0.68); g.add(brake);
      const magShape = new THREE.Shape(); magShape.moveTo(0,0); magShape.lineTo(0.06,0); magShape.quadraticCurveTo(0.08,-0.09,0.11,-0.17); magShape.lineTo(0.045,-0.18); magShape.quadraticCurveTo(0.02,-0.1,0,0);
      const mag = new THREE.Mesh(new THREE.ExtrudeGeometry(magShape, { depth: 0.036, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002 }).rotateY(Math.PI/2).translate(-0.018,-0.04,-0.06), mPoly); g.add(mag);
      const holo = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.052, 0.07), mDark); holo.position.set(0, 0.082, -0.04); g.add(holo);
      const hg = new THREE.Mesh(new THREE.PlaneGeometry(0.036, 0.034), mGlass); hg.position.set(0, 0.085, -0.041); g.add(hg);
      const ret = new THREE.Mesh(new THREE.RingGeometry(0.003,0.0055,14), new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide })); ret.position.set(0, 0.085, -0.039); g.add(ret);
      const fg = new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.018,0.09,10), mPoly); fg.position.set(0, -0.065, -0.32); fg.rotation.x = 0.18; g.add(fg);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.13, 0.055), mPoly); grip.position.set(0, -0.09, 0.1); grip.rotation.x = -0.35; g.add(grip);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.12, 0.22), mTan); stock.position.set(0, -0.01, 0.28); g.add(stock);
      attachLaserFlash(g, 0.036, 0.016, -0.42, -0.036, -0.004, -0.42);
      const ma = new THREE.Object3D(); ma.name = 'muzzle'; ma.position.set(0, 0.015, -0.73); g.add(ma);
      const ea = new THREE.Object3D(); ea.name = 'eject'; ea.position.set(0.035, 0.02, -0.05); g.add(ea);
      return g;
    }
    function buildVectorV9() {
      const g = new THREE.Group();
      const up = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.046,0.34), mGun); up.position.set(0,0.022,-0.04); g.add(up);
      const lv = new THREE.Mesh(new THREE.BoxGeometry(0.046,0.075,0.18), mTan); lv.position.set(0,-0.03,-0.1); lv.rotation.x = 0.22; g.add(lv);
      const bolt = new THREE.Group(); bolt.name = 'bolt'; bolt.position.set(0.024,0.024,-0.05); bolt.userData = { baseZ: -0.05, travel: 0.044 };
      bolt.add(new THREE.Mesh(new THREE.BoxGeometry(0.01,0.02,0.07), mChrome)); g.add(bolt);
      const ch = new THREE.Group(); ch.name = 'ch'; ch.position.set(-0.032,0.026,-0.11); ch.userData = { baseZ: -0.11, travel: 0.058 };
      ch.add(new THREE.Mesh(new THREE.BoxGeometry(0.024,0.012,0.02), mChrome)); g.add(ch);
      const supp = new THREE.Mesh(new THREE.CylinderGeometry(0.023,0.023,0.22,8).rotateX(Math.PI/2), mDark); supp.position.set(0,0.012,-0.38); g.add(supp);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.028,12).rotateX(Math.PI/2), mCyan); col.position.set(0,0.012,-0.28); g.add(col);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.03,0.22,0.042), mPoly); mag.position.set(0,-0.135,-0.14); mag.rotation.x = 0.16; g.add(mag);
      const mb = new THREE.Mesh(new THREE.BoxGeometry(0.034,0.018,0.048), mCyan); mb.position.set(0,-0.24,-0.158); mb.rotation.x = 0.16; g.add(mb);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036,0.12,0.05), mPoly); grip.position.set(0,-0.075,0.09); grip.rotation.x = -0.32; g.add(grip);
      const stArm = new THREE.Mesh(new THREE.BoxGeometry(0.024,0.028,0.21), mGun); stArm.position.set(0,0.02,0.22); g.add(stArm);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.019,0.004,8,18), mGun); ring.position.set(0,0.082,-0.02); g.add(ring);
      const gl = new THREE.Mesh(new THREE.CircleGeometry(0.017,14), mGlass); gl.position.set(0,0.082,-0.021); g.add(gl);
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0028,8), mEmerald); dot.position.set(0,0.082,-0.019); g.add(dot);
      attachLaserFlash(g, 0.034, 0.014, -0.22, -0.034, -0.005, -0.22);
      const ma = new THREE.Object3D(); ma.name = 'muzzle'; ma.position.set(0,0.012,-0.5); g.add(ma);
      const ea = new THREE.Object3D(); ea.name = 'eject'; ea.position.set(0.032,0.024,-0.05); g.add(ea);
      return g;
    }
    function buildSG12() {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.095, 0.34), mGun));
      const bolt = new THREE.Group(); bolt.name = 'bolt'; bolt.position.set(0.031, 0.016, -0.03); bolt.userData = { baseZ: -0.03, travel: 0.062 };
      bolt.add(new THREE.Mesh(new THREE.BoxGeometry(0.012,0.028,0.088), mChrome)); g.add(bolt);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.021,0.56,14).rotateX(Math.PI/2), mDark); barrel.position.set(0,0.022,-0.42); g.add(barrel);
      for (let z = -0.2; z >= -0.5; z -= 0.06) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.024,0.003,6,14), mChrome); r.position.set(0,0.022,z); g.add(r); }
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.017,0.017,0.5,12).rotateX(Math.PI/2), mDark); tube.position.set(0,-0.018,-0.4); g.add(tube);
      const pump = new THREE.Group(); pump.name = 'pump'; pump.position.set(0,-0.018,-0.34);
      pump.add(new THREE.Mesh(new THREE.CylinderGeometry(0.031,0.031,0.19,12).rotateX(Math.PI/2), mPoly));
      g.add(pump);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.042,0.14,0.06), mPoly); grip.position.set(0,-0.095,0.12); grip.rotation.x = -0.32; g.add(grip);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.11,0.26), mPoly); stock.position.set(0,-0.02,0.28); g.add(stock);
      const sight = new THREE.Mesh(new THREE.SphereGeometry(0.004,8,8), mEmerald); sight.position.set(0,0.055,-0.67); g.add(sight);
      attachLaserFlash(g, 0.036, 0.018, -0.56, -0.036, -0.016, -0.56);
      const ma = new THREE.Object3D(); ma.name = 'muzzle'; ma.position.set(0,0.022,-0.72); g.add(ma);
      const ea = new THREE.Object3D(); ea.name = 'eject'; ea.position.set(0.04,0.018,-0.04); g.add(ea);
      return g;
    }
    function buildSR50() {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.084, 0.44), mGun));
      const bolt = new THREE.Group(); bolt.name = 'bolt'; bolt.position.set(0.024,0.024,0.01); bolt.userData = { baseZ: 0.01, travel: 0.068 };
      bolt.add(new THREE.Mesh(new THREE.CylinderGeometry(0.011,0.011,0.11,10).rotateX(Math.PI/2), mChrome)); g.add(bolt);
      const ch = new THREE.Group(); ch.name = 'ch'; ch.position.set(-0.028,0.028,-0.04); ch.userData = { baseZ: -0.04, travel: 0.068 };
      ch.add(new THREE.Mesh(new THREE.BoxGeometry(0.02,0.012,0.024), mChrome)); g.add(ch);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.013,0.016,0.5,14).rotateX(Math.PI/2), mDark); barrel.position.set(0,0.018,-0.48); g.add(barrel);
      const supp = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.26,16).rotateX(Math.PI/2), mTan); supp.position.set(0,0.018,-0.8); g.add(supp);
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.24,14).rotateX(Math.PI/2), mDark); scope.position.set(0,0.088,-0.04); g.add(scope);
      const obj = new THREE.Mesh(new THREE.CylinderGeometry(0.032,0.021,0.08,16).rotateX(Math.PI/2), mGun); obj.position.set(0,0.088,-0.19); g.add(obj);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.024,16), mGlass); lens.position.set(0,0.088,0.09); g.add(lens);
      const fLens = new THREE.Mesh(new THREE.CircleGeometry(0.026,16), mGlass); fLens.position.set(0,0.088,-0.232); g.add(fLens);
      [-0.024,0.024].forEach(bx => { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.2,8).rotateX(Math.PI/2), mChrome); leg.position.set(bx,-0.055,-0.25); g.add(leg); });
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.042,0.1,0.24), mTan); stock.position.set(0,-0.015,0.3); g.add(stock);
      attachLaserFlash(g, 0.034, 0.018, -0.4, -0.034, -0.01, -0.4);
      const ma = new THREE.Object3D(); ma.name = 'muzzle'; ma.position.set(0,0.018,-0.95); g.add(ma);
      const ea = new THREE.Object3D(); ea.name = 'eject'; ea.position.set(0.036,0.02,-0.03); g.add(ea);
      return g;
    }
    function buildDesertPython() {
      const g = new THREE.Group();
      const fr = new THREE.Mesh(new THREE.BoxGeometry(0.036,0.038,0.24), mDark); fr.position.set(0,-0.004,-0.02); g.add(fr);
      const bolt = new THREE.Group(); bolt.name = 'bolt'; bolt.position.set(0,0.032,-0.02); bolt.userData = { baseZ: -0.02, travel: 0.062 };
      bolt.add(new THREE.Mesh(new THREE.BoxGeometry(0.038,0.038,0.255), mChrome));
      const rs = new THREE.Mesh(new THREE.BoxGeometry(0.028,0.012,0.016), mDark); rs.position.set(0,0.024,0.105); bolt.add(rs);
      const fs = new THREE.Mesh(new THREE.SphereGeometry(0.003,6,6), mAmber); fs.position.set(0,0.028,-0.106); bolt.add(fs);
      g.add(bolt);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036,0.13,0.056), mPoly); grip.position.set(0,-0.072,0.062); grip.rotation.x = -0.26; g.add(grip);
      const bp = new THREE.Mesh(new THREE.BoxGeometry(0.038,0.014,0.06), mChrome); bp.position.set(0,-0.136,0.079); bp.rotation.x = -0.26; g.add(bp);
      attachLaserFlash(g, 0.024, -0.026, -0.09, -0.024, -0.026, -0.09);
      const ma = new THREE.Object3D(); ma.name = 'muzzle'; ma.position.set(0,0.028,-0.17); g.add(ma);
      const ea = new THREE.Object3D(); ea.name = 'eject'; ea.position.set(0.024,0.038,-0.01); g.add(ea);
      return g;
    }
    function buildFlashFrag() {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.038,0.036,0.115,12), mGun));
      const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.018,14), mCyan); tb.position.y = 0.028; g.add(tb);
      const bb = new THREE.Mesh(new THREE.CylinderGeometry(0.039,0.039,0.014,14), mAmber); bb.position.y = -0.03; g.add(bb);
      const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.024,0.035,12), mDark); nk.position.y = 0.072; g.add(nk);
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.014,0.088,0.012), mTan); sp.position.set(0.028,0.036,0); sp.rotation.z = -0.15; g.add(sp);
      const rng = new THREE.Mesh(new THREE.TorusGeometry(0.016,0.0028,8,16), mChrome); rng.position.set(-0.024,0.08,0.01); g.add(rng);
      return g;
    }
    function buildMedkit() {
      const g = new THREE.Group();
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.18,16), mEmerald); g.add(core);
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.042,0.042,0.18,16), mGlass); g.add(glass);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.04,14), mGun); top.position.y = 0.11; g.add(top);
      const bot = top.clone(); bot.position.y = -0.11; g.add(bot);
      const needle = new THREE.Mesh(new THREE.ConeGeometry(0.012,0.075,12), mChrome); needle.position.y = 0.165; g.add(needle);
      return g;
    }
    viewmodels['ar_x7'] = buildARX7(); viewmodels['vector_v9'] = buildVectorV9();
    viewmodels['sg_12'] = buildSG12(); viewmodels['sr_50'] = buildSR50();
    viewmodels['desert_python'] = buildDesertPython(); viewmodels['flash_frag'] = buildFlashFrag();
    viewmodels['nano_medkit'] = buildMedkit();
    Object.values(viewmodels).forEach(v => { v.visible = false; weaponRig.add(v); });

    const tacticalLight = new THREE.SpotLight(0xe0f2fe, 0, 42, Math.PI/6.5, 0.45, 1.35);
    tacticalLight.position.set(0.14, -0.14, -0.55);
    const tacticalTarget = new THREE.Object3D(); tacticalTarget.position.set(0, -0.05, -20);
    camera.add(tacticalLight); camera.add(tacticalTarget); tacticalLight.target = tacticalTarget;

    const laserDot = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2a48, depthWrite: false }));
    laserDot.visible = false; scene.add(laserDot);

    const flashLight = new THREE.PointLight(0xffaa33, 0, 10, 2);
    weaponRig.add(flashLight);
    const flashCone = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 6).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({ color: 0xffedd5, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }));
    weaponRig.add(flashCone);

    // =========================================================================
    // 6. VFX POOLS (TRACERS, SPARKS, SHELL CASINGS, BULLET DECALS)
    // =========================================================================
    const tracers = [], shells = [], decals = [];
    const shellGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.048, 8);
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.22, metalness: 0.92 });
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 });
    const decalMat = new THREE.MeshBasicMaterial({ map: makeDecalTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const decalGeo = new THREE.PlaneGeometry(0.16, 0.16);
    for (let i = 0; i < 48; i++) decals.push(Object.assign(new THREE.Mesh(decalGeo, decalMat), { visible: false }));
    decals.forEach(d => scene.add(d));
    let decalIdx = 0;

    function spawnTracer(a, b, col) {
      const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.9 }));
      scene.add(line);
      tracers.push({ line, life: 0.09 });
    }
    function spawnDecal(pt, norm) {
      const d = decals[decalIdx]; decalIdx = (decalIdx + 1) % decals.length;
      d.position.copy(pt).addScaledVector(norm, 0.012);
      d.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), norm);
      d.visible = true;
    }
    function ejectShell(pos, right, up, fwd, isSg) {
      if (profile.graphicsPreset === 'potato') return;
      const m = new THREE.Mesh(shellGeo, isSg ? hullMat : brassMat);
      m.position.copy(pos); scene.add(m);
      const vel = right.clone().multiplyScalar(2.5 + Math.random()).addScaledVector(up, 1.8).addScaledVector(fwd, -0.4);
      shells.push({ mesh: m, vel, life: 2.0, bounces: 0 });
    }

    // =========================================================================
    // 7. ARTICULATED 3D ENEMY BOTS & AI
    // =========================================================================
    let enemies = [];
    const SPAWNS = [[-28,0,-14],[28,0,-14],[-30,0,16],[30,0,16],[0,0,-32],[-21,0,-4],[21,0,-4]];
    const PATROL = [[-15,0,-16],[15,0,-16],[-15,0,16],[15,0,16],[0,0,-21],[-21,0,0],[21,0,0]];
    const mBotChassis = new THREE.MeshStandardMaterial({ color: 0x1e2530, roughness: 0.42, metalness: 0.82 });
    const mBotArmor = new THREE.MeshStandardMaterial({ color: 0x881337, roughness: 0.55, metalness: 0.35 });
    const mBotVisor = new THREE.MeshStandardMaterial({ color: 0xff1e42, emissive: 0xff0033, emissiveIntensity: 1.8 });

    function createBot(id, x, z, wave) {
      const g = new THREE.Group(); g.name = 'ENEMY_' + id; g.position.set(x, 0, z);
      const pivot = new THREE.Group(); g.add(pivot);
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.36), mBotChassis.clone()); torso.position.y = 1.24; torso.castShadow = true; torso.name = 'ENEMY_BODY'; pivot.add(torso);
      const vest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.46, 0.42), mBotArmor); vest.position.set(0, 0.08, 0.02); vest.name = 'ENEMY_BODY'; torso.add(vest);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.36), mBotChassis); head.position.y = 1.82; head.castShadow = true; head.name = 'ENEMY_HEAD'; pivot.add(head);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.06), mBotVisor); visor.position.set(0, 0.03, 0.17); visor.name = 'ENEMY_HEAD'; head.add(visor);
      const gunArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.65, 8).rotateX(Math.PI/2), mBotChassis); gunArm.position.set(0.38, 1.25, 0.35); gunArm.name = 'ENEMY_BODY'; pivot.add(gunArm);
      const lLeg = new THREE.Group(); lLeg.position.set(-0.16, 0.88, 0);
      const rLeg = new THREE.Group(); rLeg.position.set(0.16, 0.88, 0);
      [lLeg, rLeg].forEach(lg => {
        const limb = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.86, 0.2), mBotChassis); limb.position.y = -0.43; limb.name = 'ENEMY_BODY'; lg.add(limb);
        pivot.add(lg);
      });
      scene.add(g);
      return {
        id, group: g, pivot, torso, head, lLeg, rLeg, gunArm,
        pos: new THREE.Vector3(x, 0, z), hp: 90 + (wave-1)*20, maxHp: 90 + (wave-1)*20,
        isDead: false, dying: false, collapse: 0, walk: Math.random()*6, stunTimer: 0,
        patrol: new THREE.Vector3(...PATROL[Math.floor(Math.random()*PATROL.length)]),
        fireCd: 1.0 + Math.random(), strafeDir: Math.random() > 0.5 ? 1 : -1, strafeT: 0,
        speed: 3.9 + Math.min(2.5, wave*0.28), dmg: Math.min(14, Math.max(3, Math.round((6 + wave*1) * 0.6))), flash: 0
      };
    }

    // Wave 10 Boss: "The Specialist Anestesi" & Crimson Alarm Rig
    const bossAlarmGroup = new THREE.Group(); bossAlarmGroup.visible = false; scene.add(bossAlarmGroup);
    const bossAlarmLights = [];
    [[-15,9.2,-16],[15,9.2,-16]].forEach(([ax,ay,az]) => {
      const bc = new THREE.Group(); bc.position.set(ax,ay,az);
      bc.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.34,0.4,10), mGun));
      const blb = new THREE.Mesh(new THREE.SphereGeometry(0.26,10,10), new THREE.MeshBasicMaterial({ color: 0xff1e42 }));
      blb.position.y = -0.24; bc.add(blb);
      const pl = new THREE.PointLight(0xff1e42, 0, 42, 1.4); pl.position.y = -0.35; bc.add(pl);
      bossAlarmLights.push(pl); bossAlarmGroup.add(bc);
    });
    function setBossAtmo(on) {
      bossAlarmGroup.visible = on;
      const pot = profile.graphicsPreset === 'potato';
      bossAlarmLights.forEach(l => l.intensity = (on && !pot) ? 22 : 0);
    }

    function makeLabCoatTex() {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const x = c.getContext('2d'); x.fillStyle = '#dce3ec'; x.fillRect(0,0,256,256);
      x.strokeStyle = '#94a3b8'; x.lineWidth = 3; x.strokeRect(10,10,236,236);
      [[55,165,22,'rgba(16,185,129,0.55)'],[188,140,28,'rgba(6,182,212,0.45)'],[95,210,18,'rgba(185,28,28,0.52)'],[172,205,24,'rgba(16,185,129,0.48)']].forEach(([bx,by,r,col]) => {
        x.fillStyle = col; x.beginPath(); x.arc(bx,by,r,0,Math.PI*2); x.fill();
      });
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
    }
    const labCoatTex = makeLabCoatTex();
    let boss = null, activeDarts = [], activeGas = [];

    function createBoss(x, z) {
      const g = new THREE.Group(); g.name = 'ENEMY_BOSS'; g.position.set(x, 0, z);
      const pv = new THREE.Group(); pv.scale.setScalar(1.36); g.add(pv);
      const coatM = new THREE.MeshStandardMaterial({ map: labCoatTex, roughness: 0.72 });
      const scrubM = new THREE.MeshStandardMaterial({ color: 0x134e4a, roughness: 0.75 });
      const maskM = new THREE.MeshStandardMaterial({ color: 0x0b0f17, roughness: 0.85 });
      const tankM = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x00ffaa, emissiveIntensity: 2.2 });
      const eyeM = new THREE.MeshStandardMaterial({ color: 0xff1e42, emissive: 0xff0033, emissiveIntensity: 3.0 });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62,0.78,0.38), coatM); torso.position.y = 1.24; torso.name = 'ENEMY_BODY'; pv.add(torso);
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.44,0.56,10,1,true), coatM); skirt.position.y = -0.52; skirt.name = 'ENEMY_BODY'; torso.add(skirt);
      [-0.12, 0.12].forEach(tx => {
        const tk = new THREE.Mesh(new THREE.CylinderGeometry(0.095,0.095,0.52,10), tankM);
        tk.position.set(tx, 0.12, -0.34); tk.name = 'ENEMY_WEAKSPOT'; torso.add(tk);
      });
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.34,0.36,0.35), scrubM); head.position.y = 1.84; head.name = 'ENEMY_HEAD'; pv.add(head);
      const mask = new THREE.Mesh(new THREE.BoxGeometry(0.35,0.16,0.24), maskM); mask.position.set(0,-0.08,0.08); mask.name = 'ENEMY_HEAD'; head.add(mask);
      [-0.08,0.08].forEach(ex => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.036,8,8), eyeM); eye.position.set(ex,0.04,0.195); eye.name = 'ENEMY_HEAD'; head.add(eye);
      });
      const rArm = new THREE.Group(); rArm.position.set(0.42,1.44,0); pv.add(rArm);
      const vial = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.44,10).rotateX(Math.PI/2), tankM); vial.position.set(0,-0.18,0.68); vial.name = 'ENEMY_BODY'; rArm.add(vial);
      const muzzle = new THREE.Object3D(); muzzle.position.set(0,-0.18,1.1); rArm.add(muzzle);
      const lArm = new THREE.Group(); lArm.position.set(-0.42,1.44,0); pv.add(lArm);
      const scalpel = new THREE.Mesh(new THREE.BoxGeometry(0.025,0.09,0.68), eyeM); scalpel.position.set(0,-0.32,0.75); scalpel.name = 'ENEMY_BODY'; lArm.add(scalpel);
      const lLeg = new THREE.Group(); lLeg.position.set(-0.18,0.86,0);
      const rLeg = new THREE.Group(); rLeg.position.set(0.18,0.86,0);
      [lLeg,rLeg].forEach(lg => { const lm = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.86,0.22), scrubM); lm.position.y = -0.43; lm.name = 'ENEMY_BODY'; lg.add(lm); pv.add(lg); });
      scene.add(g);
      return {
        id: 'THE SPECIALIST', group: g, pv, torso, head, lArm, rArm, lLeg, rLeg, muzzle, tankM, coatM,
        pos: new THREE.Vector3(x,0,z), hp: 2200, maxHp: 2200, isDead: false, dying: false, collapse: 0,
        stunTimer: 0, flash: 0, walk: 0, strafeDir: 1, strafeT: 0,
        mode: 'stalk', label: 'SYRINGE BARRAGE READY', barCd: 1.8, burstLeft: 0, burstT: 0, gasCd: 5.5, rushCd: 6.0, rushT: 0, rushDir: new THREE.Vector3(), rushHit: false
      };
    }

    // =========================================================================
    // 8. GAME STATE & INPUT CONTROLS
    // =========================================================================
    let state = {
      inMenu: true, paused: true, invOpen: false, dead: false,
      hp: 100, ap: 100, score: 0, wave: 1, slot: Math.min(3, Math.max(0, profile.preferredSlot || 0)), prevSlot: 3,
      weapons: buildFourSlotLoadout(),
      reloading: false, reloadT: 0, aiming: false, scoped: false, crouching: false, eyeH: 1.75,
      flashlight: false, flashGlare: 0, slowT: 0, inGas: false, bannerT: 0, bannerTitle: '', bannerSub: '', bannerTone: 'crimson',
      shootCd: 0, recoilPitch: 0, recoilZ: 0, boltKick: 0, pumpAnim: 0, spread: 0.14, dmgVignette: 0,
      swapPhase: 'idle', pendingSlot: 0, swapT: 0, swapY: 0, swapVelY: 0, lastWheelT: 0,
      hitActive: false, hitHs: false,
      sKills: 0, sHs: 0, sShots: 0, sHits: 0, sXp: 0, survT: 0, submitted: false, subRank: null,
      wepKills: {}, killFeed: []
    };
    const adminCheats = { godMode: false, infiniteAmmo: false, speedMult: 1.0, jumpMult: 1.0 };
    let adminUnlocked = false, adminOpen = false, adminTab = 'wave', adminNotice = '';
    const keys = {}, euler = new THREE.Euler(0, 0, 0, 'YXZ');
    let playerPos = new THREE.Vector3(0, 1.75, 31), playerVel = new THREE.Vector3(), grounded = true;
    let isLocked = false, mouseDown = false, swayX = 0, swayY = 0, bobT = 0, stepDist = 0, lowHpT = 0, waveWait = 0;
    let activeGrenades = [];

    function clearBossHazards() {
      activeDarts.forEach(d => scene.remove(d.mesh)); activeDarts = [];
      activeGas.forEach(g => scene.remove(g.mesh)); activeGas = [];
      state.slowT = 0; state.inGas = false;
    }

    function applyEquipSlot(idx) {
      if (idx !== state.slot) state.prevSlot = state.slot;
      state.slot = idx;
      Object.values(viewmodels).forEach(v => v.visible = false);
      const w = state.weapons[idx];
      if (viewmodels[w.id]) viewmodels[w.id].visible = true;
      state.scoped = state.aiming && w.type === 'sniper';
      updateHUD();
    }

    function equipSlot(idx, immediate = false) {
      if (idx < 0 || idx >= state.weapons.length) return;
      if (!immediate && idx === state.slot && state.swapPhase !== 'unequip') return;
      state.reloading = false; state.reloadT = 0;
      if (immediate || state.inMenu) {
        state.swapPhase = 'idle'; state.swapY = 0; state.swapVelY = 0;
        applyEquipSlot(idx); return;
      }
      if (state.swapPhase !== 'unequip') state.prevSlot = state.slot;
      state.pendingSlot = idx; state.swapPhase = 'unequip'; state.swapT = 0; state.scoped = false;
      AudioSys.swap(); updateHUD();
    }

    function toggleFlashlight() {
      state.flashlight = !state.flashlight;
      tacticalLight.intensity = state.flashlight ? 32 : 0;
      AudioSys.flashClick(); updateHUD();
    }

    function useMedkit() {
      const med = state.weapons.find(wp => wp.type === 'medkit');
      if (!med || (!adminCheats.infiniteAmmo && med.currentAmmo <= 0) || (state.hp >= 100 && state.ap >= 100)) return;
      if (!adminCheats.infiniteAmmo) med.currentAmmo--;
      state.hp = Math.min(100, state.hp + 60);
      state.ap = Math.min(100, state.ap + 35);
      AudioSys.heal(); updateHUD();
    }

    function startWavePrep() {
      state.score += 500; state.sXp += 150; profile.xp += 150;
      while (profile.xp >= profile.level * 250) { profile.xp -= profile.level * 250; profile.level++; }
      waveWait = 15.0;
      if (state.wave > profile.highestWave) profile.highestWave = state.wave;
      state.weapons.forEach(wp => {
        if (wp.type === 'medkit' || wp.type === 'grenade') wp.currentAmmo = Math.min(wp.maxReserve, wp.currentAmmo + 1);
        else wp.reserveAmmo = Math.min(wp.maxReserve, wp.reserveAmmo + Math.floor(wp.magSize * 1.5));
      });
      saveProfile();
    }

    function resolveFullWepName(wepLabel) {
      const m = [...WEAPON_BASE_SLOTS, ...SLOT4_OPTIONS].find(w => w.shortName === wepLabel || w.name === wepLabel);
      if (m) return m.name;
      const cur = state.weapons[state.slot];
      if (cur && cur.type !== 'medkit' && cur.type !== 'grenade') return cur.name;
      return 'AR-X7 Tactical';
    }

    function getMatchFavWeapon() {
      let best = '', top = 0;
      Object.keys(state.wepKills || {}).forEach(k => {
        if (state.wepKills[k] > top) { top = state.wepKills[k]; best = k; }
      });
      if (best) return best;
      const pref = buildFourSlotLoadout()[profile.preferredSlot || 0];
      return (pref && pref.type !== 'medkit' && pref.type !== 'grenade') ? pref.name : 'AR-X7 Tactical';
    }

    let vampHideT = null;
    function triggerVampHeal(pct) {
      if (state.dead) return;
      const gain = Math.max(1, Math.round(100 * (pct / 100)));
      state.hp = Math.min(100, state.hp + gain);
      AudioSys.vampHeal();
      const el = document.getElementById('vamp-heal-pop');
      if (el) {
        el.innerText = '+' + pct + '% HP';
        el.classList.remove('active');
        void el.offsetWidth;
        el.classList.add('active');
        if (vampHideT) clearTimeout(vampHideT);
        vampHideT = setTimeout(() => { el.classList.remove('active'); }, 960);
      }
    }

    function eliminateBot(bot, isHs, wepLabel) {
      bot.isDead = true; bot.dying = true; AudioSys.enemyKill();
      const xpGain = isHs ? 140 : 70;
      state.score += isHs ? 250 : 100; state.sXp += xpGain; state.sKills++; if (isHs) state.sHs++;
      const fw = resolveFullWepName(wepLabel);
      state.wepKills[fw] = (state.wepKills[fw] || 0) + 1;
      triggerVampHeal(10);
      profile.xp += xpGain; profile.totalKills++; if (isHs) profile.totalHeadshots++;
      while (profile.xp >= profile.level * 250) { profile.xp -= profile.level * 250; profile.level++; }
      if (state.score > profile.highScore) profile.highScore = state.score;
      state.killFeed.unshift({ text: profile.callsign + ' [' + wepLabel + '] ' + bot.id + (isHs ? ' · HEADSHOT' : ''), hs: isHs });
      state.killFeed = state.killFeed.slice(0, 4);
      if (enemies.filter(b => !b.isDead).length === 0) {
        startWavePrep();
      }
    }

    function eliminateBoss(wepLabel, zone) {
      if (!boss || boss.isDead) return;
      boss.isDead = true; boss.dying = true;
      AudioSys.bossDefeat(); setBossAtmo(false); clearBossHazards();
      state.score += 5000; state.sXp += 1500; state.sKills++;
      if (zone !== 'body') { state.sHs++; profile.totalHeadshots++; }
      const fw = resolveFullWepName(wepLabel);
      state.wepKills[fw] = (state.wepKills[fw] || 0) + 1;
      triggerVampHeal(25);
      profile.xp += 1500; profile.totalKills++;
      profile.bossDefeatedCount = (profile.bossDefeatedCount || 0) + 1;
      if (!profile.achievements.includes('SPECIALIST_SLAYER')) profile.achievements.push('SPECIALIST_SLAYER');
      while (profile.xp >= profile.level * 250) { profile.xp -= profile.level * 250; profile.level++; }
      const acc = state.sShots > 0 ? Math.min(100, Math.round((state.sHits / state.sShots) * 100)) : 100;
      const topScore = Math.max(26200, state.score);
      if (topScore > profile.highScore) profile.highScore = topScore;
      saveLocalLb({ callsign: profile.callsign, countryCode: 'ID', flag: '🇮🇩', kills: state.sKills, headshots: state.sHs, accuracy: acc, survivalSec: Math.round(state.survT), wave: 10, score: topScore, xpEarned: state.sXp, level: profile.level, avatarColor: profile.accentColor, favoriteWeapon: getMatchFavWeapon() });
      state.killFeed.unshift({ text: profile.callsign + ' [' + wepLabel + '] THE SPECIALIST ANESTESI · BOSS NEUTRALIZED', hs: true });
      state.killFeed = state.killFeed.slice(0, 4);
      state.bannerTitle = 'THE SPECIALIST NEUTRALIZED';
      state.bannerSub = '+1,500 XP · +5,000 SCORE · ACHIEVEMENT UNLOCKED · #1 GLOBAL RECORD LOGGED';
      state.bannerTone = 'emerald'; state.bannerT = 5.5;
      startWavePrep();
      updateHUD();
    }

    function throwGrenade() {
      const w = state.weapons[state.slot];
      if (w.type !== 'grenade' || (!adminCheats.infiniteAmmo && w.currentAmmo <= 0)) { state.shootCd = 0.25; return; }
      if (!adminCheats.infiniteAmmo) w.currentAmmo--; state.shootCd = w.fireRate;
      state.recoilPitch = 0.08; state.recoilZ = 0.06;
      AudioSys.grenadeThrow();
      const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
      const pos = camera.position.clone().addScaledVector(dir, 0.65); pos.y -= 0.12;
      const vel = dir.clone().multiplyScalar(19.5).addScaledVector(playerVel, 0.35); vel.y += 4.6;
      const mesh = buildFlashFrag(); mesh.scale.setScalar(1.35); mesh.position.copy(pos); scene.add(mesh);
      activeGrenades.push({ mesh, pos, vel, fuse: 1.65, bounces: 0 });
      updateHUD();
    }

    let shakeInt = 0, shakePh = 0;
    const floatingDamages = [];
    function spawnDamageNumber(pos, amount, isCrit) {
      if (!amount || amount <= 0) return;
      if (floatingDamages.length >= 28) {
        const old = floatingDamages.shift();
        if (old) { scene.remove(old.sprite); old.tex.dispose(); old.mat.dispose(); }
      }
      const c = document.createElement('canvas'); c.width = 256; c.height = 128;
      const ctx = c.getContext('2d');
      const lbl = isCrit ? (Math.round(amount) + '!') : String(Math.round(amount));
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = isCrit ? '900 72px "JetBrains Mono", monospace' : '800 54px "JetBrains Mono", monospace';
      ctx.lineJoin = 'round'; ctx.lineWidth = isCrit ? 11 : 8;
      ctx.strokeStyle = isCrit ? 'rgba(69,10,10,0.96)' : 'rgba(2,6,23,0.92)';
      ctx.strokeText(lbl, 128, 64);
      if (isCrit) {
        const gr = ctx.createLinearGradient(0, 24, 0, 104);
        gr.addColorStop(0, '#fef08a'); gr.addColorStop(0.55, '#facc15'); gr.addColorStop(1, '#ef4444');
        ctx.fillStyle = gr;
      } else ctx.fillStyle = '#ffffff';
      ctx.fillText(lbl, 128, 64);
      const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
      const sp = new THREE.Sprite(mat);
      sp.position.set(pos.x + (Math.random()-0.5)*0.24, pos.y + 0.16, pos.z + (Math.random()-0.5)*0.24);
      const bsx = isCrit ? 1.55 : 1.05, bsy = isCrit ? 0.78 : 0.52;
      sp.scale.set(bsx, bsy, 1); sp.renderOrder = 1000;
      scene.add(sp);
      floatingDamages.push({
        sprite: sp, tex, mat,
        vel: new THREE.Vector3((Math.random()-0.5)*0.65, isCrit ? 2.15 : 1.65, (Math.random()-0.5)*0.65),
        life: 0, maxLife: isCrit ? 0.8 : 0.65, bsx, bsy
      });
    }

    function detonateGrenade(pos) {
      AudioSys.flashFrag();
      const rgGeo = new THREE.RingGeometry(0.25, 0.6, 28); rgGeo.rotateX(-Math.PI/2);
      const rgMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
      const ring = new THREE.Mesh(rgGeo, rgMat); ring.position.set(pos.x, Math.max(0.15, pos.y + 0.1), pos.z); scene.add(ring);
      const st = performance.now();
      (function expand() {
        const t = (performance.now() - st) / 400;
        if (t >= 1) { scene.remove(ring); rgGeo.dispose(); rgMat.dispose(); return; }
        ring.scale.setScalar(1 + t * 15); rgMat.opacity = (1 - t) * 0.9;
        requestAnimationFrame(expand);
      })();

      let hitAny = false;
      enemies.forEach(bot => {
        if (bot.isDead) return;
        const bc = bot.pos.clone().setY(bot.pos.y + 1.1);
        const d = bc.distanceTo(pos);
        if (d <= 9.5) {
          const dmg = Math.max(25, Math.round(145 * (1 - (d / 9.5) * 0.68)));
          bot.hp -= dmg; bot.flash = 0.14; hitAny = true;
          spawnDamageNumber(bc, dmg, false);
          if (bot.hp <= 0) eliminateBot(bot, false, 'FLASH-FRAG');
          else bot.stunTimer = Math.max(bot.stunTimer, 2.5);
        }
      });
      if (boss && !boss.isDead) {
        const bPos = boss.pos.clone().setY(boss.pos.y + 1.4);
        const bd = bPos.distanceTo(pos);
        if (bd <= 10.3) {
          const dmg = Math.max(40, Math.round(165 * (1 - (bd / 10.3) * 0.65)));
          boss.hp -= dmg; boss.flash = 0.14; hitAny = true;
          spawnDamageNumber(bPos, dmg, false);
          if (boss.hp <= 0) eliminateBoss('FLASH-FRAG', 'body');
          else boss.stunTimer = Math.max(boss.stunTimer, 1.4);
        }
      }
      if (hitAny) {
        const hm = document.getElementById('hitmarker'); hm.style.stroke = '#ffffff'; hm.style.display = 'block';
        setTimeout(() => { hm.style.display = 'none'; }, 140);
      }
      const pd = playerPos.distanceTo(pos);
      if (pd < 14.0) shakeInt = Math.max(shakeInt, (1 - pd/14.0) * 0.08);
      if (pd < 7.0) state.flashGlare = Math.max(state.flashGlare, (1 - pd/7.0) * 0.6);
      saveProfile(); updateHUD();
    }

    function spawnWave(wNum) {
      state.wave = wNum; waveWait = 0;
      enemies.forEach(e => scene.remove(e.group));
      enemies = [];
      if (boss) { scene.remove(boss.group); boss = null; }
      clearBossHazards();

      if (wNum === 10) {
        boss = createBoss(0, -24);
        applyMaterialQuality(boss.group, profile.graphicsPreset);
        setBossAtmo(true); AudioSys.bossAlarm(); AudioSys.bossMusicStart();
        state.bannerTitle = 'WARNING · THE SPECIALIST ANESTESI';
        state.bannerSub = 'WAVE 10 BOSS ARRIVAL · TARGET DORSAL BIO-TANK OR HEAD';
        state.bannerTone = 'crimson'; state.bannerT = 4.6;
        updateHUD();
        return;
      }

      setBossAtmo(false); AudioSys.bossMusicStop();
      const count = Math.min(8, 2 + Math.ceil((wNum - 1) * 0.75));
      for (let i = 0; i < count; i++) {
        const sp = SPAWNS[i % SPAWNS.length];
        const bt = createBot('UNIT-'+(i+1), sp[0] + (Math.random()-0.5)*3, sp[2] + (Math.random()-0.5)*3, wNum);
        applyMaterialQuality(bt.group, profile.graphicsPreset);
        enemies.push(bt);
      }
      updateHUD();
    }

    function startMatch(initWave = 1, autoLock = true) {
      AudioSys.stopLobbyAmbient();
      AudioSys.bossMusicStop();
      setBossAtmo(false);
      AudioSys.resume();
      closeModals();
      state.inMenu = false; state.paused = !autoLock; state.invOpen = false; state.dead = false;
      state.crouching = false; state.eyeH = 1.75; state.bannerT = 0;
      state.flashlight = false; tacticalLight.intensity = 0; state.flashGlare = 0; laserDot.visible = false;
      activeGrenades.forEach(g => scene.remove(g.mesh)); activeGrenades = [];
      clearBossHazards();
      state.hp = 100; state.ap = 100; state.score = 0; state.killFeed = []; state.wepKills = {}; shakeInt = 0;
      while (floatingDamages.length) { const fd = floatingDamages.pop(); scene.remove(fd.sprite); fd.tex.dispose(); fd.mat.dispose(); }
      const vp = document.getElementById('vamp-heal-pop'); if (vp) vp.classList.remove('active');
      state.sKills = 0; state.sHs = 0; state.sShots = 0; state.sHits = 0; state.sXp = 0; state.survT = 0; state.submitted = false; state.subRank = null;
      state.weapons = buildFourSlotLoadout();
      state.prevSlot = 3;
      playerPos.set(0, 1.75, 31); playerVel.set(0,0,0); euler.set(0,0,0,'YXZ');
      camera.position.copy(playerPos); camera.quaternion.setFromEuler(euler);
      weaponRig.visible = true;
      const startSlot = (profile.slot4Choice === 'nano_medkit' && profile.preferredSlot === 3) ? 0 : Math.min(3, Math.max(0, profile.preferredSlot || 0));
      equipSlot(startSlot, true);
      spawnWave(initWave);
      document.getElementById('main-menu').style.display = 'none';
      document.getElementById('hud').style.display = 'block';
      if (autoLock) requestPointerLockSafe();
      else { syncGraphicsUI(); document.getElementById('modal-pause').style.display = 'flex'; }
    }

    function triggerShoot() {
      if (state.shootCd > 0 || state.reloading || state.swapPhase === 'unequip') return;
      const w = state.weapons[state.slot];
      if (w.type === 'medkit') { useMedkit(); state.shootCd = 0.6; return; }
      if (w.type === 'grenade') { throwGrenade(); return; }
      if (!adminCheats.infiniteAmmo && w.currentAmmo <= 0) { state.shootCd = 0.25; return; }

      if (adminCheats.infiniteAmmo) w.currentAmmo = w.magSize;
      else w.currentAmmo--;
      state.shootCd = w.fireRate; state.boltKick = 1.0;
      const sf = w.pellets || 1; profile.totalShots += sf; state.sShots += sf;

      if (w.type === 'shotgun') { AudioSys.shotgun(); state.recoilPitch = 0.16; state.recoilZ = 0.13; state.pumpAnim = 1.0; shakeInt = Math.max(shakeInt, 0.065); }
      else if (w.type === 'sniper') { AudioSys.sniper(); state.recoilPitch = 0.19; state.recoilZ = 0.14; shakeInt = Math.max(shakeInt, 0.058); }
      else if (w.type === 'smg') { AudioSys.smg(); state.recoilPitch = 0.036; state.recoilZ = 0.034; shakeInt = Math.max(shakeInt, 0.008); }
      else if (w.type === 'pistol') { AudioSys.magnum(); state.recoilPitch = 0.145; state.recoilZ = 0.11; shakeInt = Math.max(shakeInt, 0.046); }
      else { AudioSys.rifle(); state.recoilPitch = 0.055; state.recoilZ = 0.048; shakeInt = Math.max(shakeInt, 0.012); }

      const vm = viewmodels[w.id];
      const mAnchor = vm && vm.getObjectByName('muzzle');
      const eAnchor = vm && vm.getObjectByName('eject');
      const muzzlePos = new THREE.Vector3();
      const supp = w.type === 'sniper' || w.type === 'smg';
      if (mAnchor) {
        mAnchor.getWorldPosition(muzzlePos);
        flashCone.position.copy(mAnchor.position);
        flashLight.position.copy(mAnchor.position);
        flashCone.material.opacity = supp ? 0.45 : 0.95;
        flashLight.intensity = profile.graphicsPreset === 'potato' ? 0 : (supp ? 5 : 18);
        setTimeout(() => { flashCone.material.opacity = 0; flashLight.intensity = 0; }, 50);
      } else muzzlePos.copy(camera.position);

      const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
      const right = new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
      const up = new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
      if (eAnchor) {
        const ep = new THREE.Vector3(); eAnchor.getWorldPosition(ep);
        ejectShell(ep, right, up, dir, w.type === 'shotgun');
      }

      const targets = obstacleMeshes.slice();
      enemies.forEach(b => { if (!b.isDead) b.group.traverse(c => { if (c.isMesh) targets.push(c); }); });
      if (boss && !boss.isDead) boss.group.traverse(c => { if (c.isMesh) targets.push(c); });

      const pellets = w.pellets || 1;
      const rawSpread = state.aiming ? w.adsSpread : w.spread;
      const spread = (state.crouching && !state.aiming) ? rawSpread * 0.65 : rawSpread;
      const rc = new THREE.Raycaster();
      let hits = 0;
      const dmgMap = new Map();
      const botHsMult = w.hsMult || 2.5;
      const bossHsMult = w.hsMult || 2.0;

      for (let p = 0; p < pellets; p++) {
        const sd = dir.clone();
        if (spread > 0) sd.addScaledVector(right, (Math.random()-0.5)*spread).addScaledVector(up, (Math.random()-0.5)*spread).normalize();
        rc.set(camera.position, sd); rc.far = w.range;
        const hitList = rc.intersectObjects(targets, false);
        if (hitList.length > 0) {
          const hit = hitList[0];
          let bot = null, hitBoss = false, bossZone = 'body', isHs = false, o = hit.object;
          while (o && o !== scene) {
            if (o.name && o.name.startsWith('ENEMY_')) {
              if (hit.object.name === 'ENEMY_WEAKSPOT') { bossZone = 'weakspot'; isHs = true; }
              else if (hit.object.name === 'ENEMY_HEAD') { bossZone = 'head'; isHs = true; }
              if (boss && o === boss.group) { hitBoss = true; break; }
              bot = enemies.find(b => b.group === o); break;
            }
            o = o.parent;
          }
          if (hitBoss && boss && !boss.isDead) {
            hits++;
            const mult = bossZone === 'weakspot' ? Math.max(2.2, bossHsMult) : bossZone === 'head' ? bossHsMult : 1.0;
            const dealt = Math.round(w.damage * mult);
            boss.hp -= dealt;
            boss.flash = 0.12;
            const prev = dmgMap.get(boss);
            if (prev) { prev.dmg += dealt; prev.isCrit = prev.isCrit || isHs; if (isHs) prev.pos.copy(hit.point); }
            else dmgMap.set(boss, { dmg: dealt, isCrit: isHs, pos: hit.point.clone() });
            AudioSys.hit(isHs);
            state.hitActive = true; state.hitHs = isHs;
            const hm = document.getElementById('hitmarker');
            hm.style.stroke = isHs ? '#ef4444' : '#ffffff';
            hm.style.display = 'block';
            setTimeout(() => { state.hitActive = false; hm.style.display = 'none'; }, 140);
            if (boss.hp <= 0) eliminateBoss(w.shortName, bossZone);
          } else if (bot && !bot.isDead) {
            hits++;
            const dealt = isHs ? Math.round(w.damage * botHsMult) : w.damage;
            bot.hp -= dealt;
            bot.flash = 0.14;
            const prev = dmgMap.get(bot);
            if (prev) { prev.dmg += dealt; prev.isCrit = prev.isCrit || isHs; if (isHs) prev.pos.copy(hit.point); }
            else dmgMap.set(bot, { dmg: dealt, isCrit: isHs, pos: hit.point.clone() });
            AudioSys.hit(isHs);
            state.hitActive = true; state.hitHs = isHs;
            const hm = document.getElementById('hitmarker');
            hm.style.stroke = isHs ? '#ef4444' : '#ffffff';
            hm.style.display = 'block';
            setTimeout(() => { state.hitActive = false; hm.style.display = 'none'; }, 140);
            if (bot.hp <= 0) eliminateBot(bot, isHs, w.shortName);
          } else if (hit.face) {
            const wn = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
            spawnDecal(hit.point, wn);
          }
          spawnTracer(muzzlePos, hit.point, w.type === 'shotgun' ? 0xf59e0b : 0x06b6d4);
        } else {
          spawnTracer(muzzlePos, camera.position.clone().addScaledVector(sd, w.range), w.type === 'shotgun' ? 0xf59e0b : 0x06b6d4);
        }
      }
      dmgMap.forEach(e => spawnDamageNumber(e.pos, e.dmg, e.isCrit));
      if (hits > 0) { profile.totalHits += hits; state.sHits += hits; }
      if (!adminCheats.infiniteAmmo && w.currentAmmo === 0 && w.reserveAmmo > 0 && !state.reloading) {
        state.reloading = true; state.reloadT = 0; state.scoped = false;
        AudioSys.reload(w.reloadTime);
      }
      saveProfile(); updateHUD();
    }

    let pauseLockTimer = null;
    function showPauseLockNotice(msg) {
      if (pauseLockTimer) { clearTimeout(pauseLockTimer); pauseLockTimer = null; }
      const el = document.getElementById('pause-lock-note');
      if (!el) return;
      el.textContent = msg || '';
      el.style.display = msg ? 'block' : 'none';
      if (msg) {
        pauseLockTimer = setTimeout(() => {
          pauseLockTimer = null;
          el.style.display = 'none';
        }, 3000);
      }
    }
    function handlePointerLockFail(err) {
      if (state.inMenu || state.dead) return;
      const msg = err && err.message ? err.message : '';
      const isCooldown = /exited|cooldown|immediately|security/i.test(msg);
      state.invOpen = false;
      state.paused = true;
      syncGraphicsUI();
      showPauseLockNotice(isCooldown ? 'Pointer lock cooling down — wait 1s and click Resume.' : 'Click Resume to lock mouse aim.');
      document.getElementById('modal-inventory').style.display = 'none';
      document.getElementById('modal-pause').style.display = 'flex';
    }
    function requestPointerLockSafe() {
      if (document.pointerLockElement === document.body) { showPauseLockNotice(''); return; }
      try {
        const p = document.body.requestPointerLock();
        if (p && typeof p.catch === 'function') p.catch(handlePointerLockFail);
      } catch (err) {
        handlePointerLockFail(err);
      }
    }
    document.addEventListener('pointerlockerror', () => {
      handlePointerLockFail();
    });

    // PointerLock, Wheel Swap & Keyboard Listeners
    document.addEventListener('pointerlockchange', () => {
      isLocked = document.pointerLockElement === document.body;
      if (isLocked) showPauseLockNotice('');
      if (!state.inMenu && !state.dead && !state.invOpen) {
        state.paused = !isLocked;
        if (state.paused) syncGraphicsUI();
        document.getElementById('modal-pause').style.display = state.paused ? 'flex' : 'none';
      }
    });

    window.addEventListener('wheel', e => {
      if (state.inMenu || state.paused || state.invOpen || state.dead || !isLocked) return;
      const now = performance.now();
      if (now - state.lastWheelT < 70 || Math.abs(e.deltaY) < 4) return;
      state.lastWheelT = now;
      const total = state.weapons.length;
      const base = state.swapPhase === 'unequip' ? state.pendingSlot : state.slot;
      equipSlot((base + (e.deltaY > 0 ? 1 : -1) + total) % total);
    }, { passive: true });

    window.addEventListener('mousemove', e => {
      if (!isLocked) return;
      const mult = 0.002 * profile.mouseSensitivity;
      euler.y -= e.movementX * mult;
      euler.x -= e.movementY * mult;
      euler.x = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, euler.x));
      camera.quaternion.setFromEuler(euler);
      swayX = Math.max(-0.04, Math.min(0.04, -e.movementX * 0.0007));
      swayY = Math.max(-0.04, Math.min(0.04, e.movementY * 0.0007));
    });

    window.addEventListener('keydown', e => {
      keys[e.code] = true;
      if (state.inMenu || state.dead) return;
      if (e.code === 'Tab' || e.code === 'KeyI') {
        e.preventDefault();
        state.invOpen = !state.invOpen;
        if (state.invOpen) { if (document.pointerLockElement) document.exitPointerLock(); renderInventory(); document.getElementById('modal-inventory').style.display = 'flex'; }
        else { document.getElementById('modal-inventory').style.display = 'none'; requestPointerLockSafe(); }
        return;
      }
      if (!isLocked) return;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { state.crouching = false; }
      if (e.code === 'KeyC' && !e.repeat) { state.crouching = !state.crouching; }
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') { state.crouching = true; }
      if (e.code === 'Space' && grounded) { state.crouching = false; playerVel.y = 7.6 * adminCheats.jumpMult; grounded = false; }
      if (e.code === 'KeyF' && !e.repeat) { toggleFlashlight(); }
      if (e.code === 'KeyQ' && !e.repeat) { equipSlot(state.prevSlot); }
      if (e.code === 'KeyG' && !e.repeat && waveWait > 0) { waveWait = 0; spawnWave(state.wave + 1); }
      if (e.code === 'KeyR' && state.swapPhase !== 'unequip') {
        const w = state.weapons[state.slot];
        if (adminCheats.infiniteAmmo && w.type !== 'medkit' && w.type !== 'grenade') {
          w.currentAmmo = w.magSize; state.reloading = false; updateHUD();
        } else if (!state.reloading && w.type !== 'medkit' && w.type !== 'grenade' && w.currentAmmo < w.magSize && w.reserveAmmo > 0) {
          state.reloading = true; state.reloadT = 0; state.scoped = false; AudioSys.reload(w.reloadTime); updateHUD();
        }
      }
      if (e.code === 'Digit1') equipSlot(0);
      if (e.code === 'Digit2') equipSlot(1);
      if (e.code === 'Digit3') equipSlot(2);
      if (e.code === 'Digit4') equipSlot(3);
    });
    window.addEventListener('keyup', e => {
      keys[e.code] = false;
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') { state.crouching = false; }
    });
    window.addEventListener('mousedown', e => {
      if (!isLocked) return;
      if (e.button === 0) { mouseDown = true; triggerShoot(); }
      else if (e.button === 2) { state.aiming = true; state.scoped = state.weapons[state.slot].type === 'sniper' && !state.reloading; updateHUD(); }
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) mouseDown = false;
      else if (e.button === 2) { state.aiming = false; state.scoped = false; updateHUD(); }
    });
    window.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      lobbyCam.aspect = window.innerWidth / window.innerHeight;
      lobbyCam.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // =========================================================================
    // 9. 3D INTERACTIVE TACTICAL HANGAR LOBBY & OPERATOR SHOWCASE
    // =========================================================================
    const lobbyScene = new THREE.Scene();
    lobbyScene.background = new THREE.Color(0x070b12);
    lobbyScene.fog = new THREE.FogExp2(0x070b12, 0.014);
    const lobbyCam = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 260);

    // Three-Point Studio Lighting (+ Potato Ambient Fallback)
    const lobbyAmbient = new THREE.AmbientLight(0xdbeafe, 1.25); lobbyAmbient.visible = false; lobbyScene.add(lobbyAmbient);
    const lobbyHemi = new THREE.HemisphereLight(0x38bdf8, 0x0b1019, 0.78); lobbyScene.add(lobbyHemi);
    const lobbyKey = new THREE.DirectionalLight(0xfde68a, 2.0);
    lobbyKey.position.set(4.5, 8.5, 5.5); lobbyKey.castShadow = true;
    lobbyKey.shadow.mapSize.set(2048, 2048);
    lobbyKey.shadow.camera.left = -10; lobbyKey.shadow.camera.right = 10; lobbyKey.shadow.camera.top = 10; lobbyKey.shadow.camera.bottom = -10;
    lobbyScene.add(lobbyKey);
    const lobbyRim = new THREE.DirectionalLight(0x38bdf8, 1.35);
    lobbyRim.position.set(-3.5, 5.2, -7.2); lobbyScene.add(lobbyRim);
    const lobbyPodLight = new THREE.PointLight(0x06b6d4, 5.5, 8, 2);
    lobbyPodLight.position.set(0, 0.55, 0); lobbyScene.add(lobbyPodLight);

    // Exterior Night Sky & Cyber-Night Megacity Skyline
    lobbyScene.add(new THREE.Mesh(new THREE.SphereGeometry(120, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })));
    function makeWinTex(hex) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 256;
      const x = c.getContext('2d'); x.fillStyle = '#070b14'; x.fillRect(0,0,128,256);
      for (let py=10; py<246; py+=12) for (let px=8; px<120; px+=14) {
        const r = Math.random();
        x.fillStyle = r > 0.65 ? (r > 0.85 ? hex : 'rgba(56,189,248,0.5)') : '#0f172a';
        x.fillRect(px, py, 8, 6);
      }
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
    }
    const winTexC = makeWinTex('#06b6d4'), winTexA = makeWinTex('#f59e0b');
    const lobbyBeacons = [];
    [[-30,-28,7,38,false],[-16,-40,10,60,false],[0,-46,12,72,false],[16,-38,9,54,true],[30,-26,7,40,true],[-28,6,7,42,false],[28,8,7,46,true]].forEach(([bx,bz,bw,bh,am]) => {
      const bMat = new THREE.MeshStandardMaterial({ map: am ? winTexA : winTexC, emissive: am ? 0x451a03 : 0x082f49, emissiveMap: am ? winTexA : winTexC, emissiveIntensity: 0.9, roughness: 0.4 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bw), bMat);
      b.position.set(bx, bh/2 - 14, bz); lobbyScene.add(b);
      const bc = new THREE.Mesh(new THREE.SphereGeometry(0.28,8,8), new THREE.MeshBasicMaterial({ color: am ? 0xf59e0b : 0x06b6d4 }));
      bc.position.set(bx, bh - 13.7, bz); lobbyScene.add(bc); lobbyBeacons.push(bc);
    });

    // Blast Door Texture ("GIS DEPLOYMENT BAY")
    function makeBlastDoorTex() {
      const c = document.createElement('canvas'); c.width = c.height = 1024;
      const x = c.getContext('2d');
      x.fillStyle = '#151c26'; x.fillRect(0,0,1024,1024);
      x.fillStyle = '#1f2937'; x.fillRect(24,24,976,976);
      x.fillStyle = '#101620'; x.fillRect(54,210,444,710); x.fillRect(526,210,444,710);
      for (let y=260; y<890; y+=110) { x.fillStyle='#1c2432'; x.fillRect(74,y,404,74); x.fillRect(546,y,404,74); }
      x.fillStyle = '#06b6d4'; x.fillRect(508,220,8,700);
      x.fillStyle = '#0c111a'; x.fillRect(54,52,916,132);
      x.strokeStyle = '#06b6d4'; x.lineWidth = 4; x.strokeRect(54,52,916,132);
      x.fillStyle = '#f8fafc'; x.font = '900 60px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('GIS DEPLOYMENT BAY', 512, 108);
      x.fillStyle = '#f59e0b'; x.font = 'bold 22px monospace'; x.fillText('SECTOR 07 // TACTICAL AIRLOCK READY', 512, 156);
      const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
    }

    // Hangar Floor, Blast Door, Side Walls, Angled Pillars & Panoramic Glass Windows
    const hFloor = new THREE.Mesh(new THREE.PlaneGeometry(24, 22).rotateX(-Math.PI/2), floorMat);
    hFloor.receiveShadow = true; lobbyScene.add(hFloor);
    const lSteel = new THREE.MeshStandardMaterial({ color: 0x1a2230, roughness: 0.35, metalness: 0.85 });
    const blastDoor = new THREE.Mesh(new THREE.BoxGeometry(7.6, 7.2, 0.45), new THREE.MeshStandardMaterial({ map: makeBlastDoorTex(), roughness: 0.4, metalness: 0.75 }));
    blastDoor.position.set(0, 3.6, -8.8); lobbyScene.add(blastDoor);
    const hBeam = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.85, 1.0), lSteel); hBeam.position.set(0, 7.6, -8.6); lobbyScene.add(hBeam);
    [-11, 11].forEach(wx => {
      const lw = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.2, 20), wallMat); lw.position.set(wx, 1.1, 0); lobbyScene.add(lw);
      const tb = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.3, 20), lSteel); tb.position.set(wx, 7.95, 0); lobbyScene.add(tb);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(19.2, 5.0), new THREE.MeshStandardMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }));
      gl.rotation.y = Math.PI/2; gl.position.set(wx, 4.85, 0); lobbyScene.add(gl);
    });
    [-6.5, -1.5, 3.5, 7.8].forEach(pz => {
      [-1, 1].forEach(s => {
        const pil = new THREE.Mesh(new THREE.BoxGeometry(0.55, 8.6, 0.65), lSteel);
        pil.position.set(s*9.8, 4.15, pz); pil.rotation.z = s*0.16; lobbyScene.add(pil);
      });
      const tr = new THREE.Mesh(new THREE.BoxGeometry(18.8, 0.45, 0.55), lSteel); tr.position.set(0, 8.45, pz); lobbyScene.add(tr);
      const ls = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.08, 0.18), new THREE.MeshBasicMaterial({ color: pz < 0 ? 0x67e8f9 : 0xfbbf24 })); ls.position.set(0, 8.2, pz); lobbyScene.add(ls);
    });

    // Rotating Turntable Podium + Dual Cyan/Amber LED Rings
    const turntable = new THREE.Group(); lobbyScene.add(turntable);
    const basePlinth = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.5, 0.14, 48), mDark); basePlinth.position.y = 0.07; lobbyScene.add(basePlinth);
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(1.98, 2.08, 0.12, 48), mGun); deck.position.y = 0.18; deck.receiveShadow = true; turntable.add(deck);
    const outerLed = new THREE.Mesh(new THREE.TorusGeometry(2.04, 0.024, 12, 64), new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 2 }));
    outerLed.rotation.x = Math.PI/2; outerLed.position.y = 0.21; turntable.add(outerLed);
    const accentLedMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(profile.accentColor), emissive: new THREE.Color(profile.accentColor), emissiveIntensity: 1.8 });
    const innerLed = new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.018, 10, 56), accentLedMat);
    innerLed.rotation.x = Math.PI/2; innerLed.position.y = 0.245; turntable.add(innerLed);

    // Articulated Third-Person 3D Operator Model on Turntable
    const opGroup = new THREE.Group(); opGroup.position.y = 0.245; turntable.add(opGroup);
    const opSuit = new THREE.MeshStandardMaterial({ color: 0x1b222e, roughness: 0.72, metalness: 0.2 });
    const opArmor = new THREE.MeshStandardMaterial({ color: 0x2c3647, roughness: 0.34, metalness: 0.78 });
    const opVisorMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(profile.accentColor), emissive: new THREE.Color(profile.accentColor), emissiveIntensity: 2.2 });
    [-0.17, 0.17].forEach((lx, i) => {
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.12,0.25), mDark); boot.position.set(lx, 0.06, i===0?0.05:-0.01); boot.castShadow = true; opGroup.add(boot);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.068,0.06,0.36,10), opSuit); shin.position.set(lx, 0.28, i===0?0.03:-0.03); shin.castShadow = true; opGroup.add(shin);
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.088,0.072,0.38,10), opSuit); thigh.position.set(lx, 0.68, i===0?0.03:-0.03); thigh.castShadow = true; opGroup.add(thigh);
    });
    const opPelvis = new THREE.Mesh(new THREE.BoxGeometry(0.38,0.16,0.24), mDark); opPelvis.position.y = 0.92; opGroup.add(opPelvis);
    const opTorso = new THREE.Group(); opTorso.position.y = 1.0; opGroup.add(opTorso);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.42,0.44,0.28), opArmor); chest.position.y = 0.24; chest.castShadow = true; opTorso.add(chest);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.28,0.34,0.14), mDark); pack.position.set(0,0.26,-0.18); opTorso.add(pack);
    [-0.27, 0.27].forEach(sx => {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.14,0.18), opArmor); sh.position.set(sx,0.42,0.02); opTorso.add(sh);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.095,0.28,0.095), opArmor); arm.position.set(sx*0.65,0.22,0.22); arm.rotation.x = -1.1; opTorso.add(arm);
    });
    const opHead = new THREE.Group(); opHead.position.set(0,0.52,0.01); opTorso.add(opHead);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.148,16,14), opArmor); helmet.position.y = 0.18; helmet.castShadow = true; opHead.add(helmet);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.21,0.068,0.11), opVisorMat); visor.position.set(0,0.195,0.108); opHead.add(visor);
    const opWeaponMount = new THREE.Group(); opWeaponMount.position.set(-0.04, 0.23, 0.34); opWeaponMount.rotation.set(0.14, -0.78, 0.08); opWeaponMount.scale.setScalar(1.08); opTorso.add(opWeaponMount);
    const opWeapons = [buildARX7(), buildSG12(), buildSR50(), buildDesertPython(), buildMedkit()];
    const opWeaponsById = { ar_x7: opWeapons[0], sg_12: opWeapons[1], sr_50: opWeapons[2], desert_python: opWeapons[3], nano_medkit: opWeapons[4] };
    opWeapons[3].scale.setScalar(1.22);
    opWeapons[4].rotation.x = Math.PI/2;
    opWeapons.forEach(w => {
      const lb = w.getObjectByName('laserBeam'); if (lb) lb.visible = false;
      w.visible = false; opWeaponMount.add(w);
    });
    function setLobbyWeapon(idx) {
      const loadout = buildFourSlotLoadout();
      const target = loadout[idx] || loadout[0];
      Object.values(opWeaponsById).forEach(w => w.visible = false);
      if (opWeaponsById[target.id]) opWeaponsById[target.id].visible = true;
    }
    function setLobbyAccent(hex) {
      const c = new THREE.Color(hex || '#06b6d4');
      opVisorMat.color.copy(c); opVisorMat.emissive.copy(c);
      accentLedMat.color.copy(c); accentLedMat.emissive.copy(c);
      lobbyPodLight.color.copy(c);
    }
    setLobbyWeapon(profile.preferredSlot || 0);

    // Wall Weapon Racks, Holo-Table, Supply Crates & Hovering Recon Drone
    [-7.2, 7.2].forEach((rx, ri) => {
      const rk = new THREE.Group(); rk.position.set(rx, 0, -2.2); rk.rotation.y = ri===0 ? Math.PI/3.4 : -Math.PI/3.4;
      const bb = new THREE.Mesh(new THREE.BoxGeometry(3.2,2.8,0.18), lSteel); bb.position.y = 1.6; rk.add(bb);
      const lb = new THREE.Mesh(new THREE.BoxGeometry(2.9,0.05,0.12), new THREE.MeshBasicMaterial({ color: 0x06b6d4 })); lb.position.set(0,2.92,0.38); rk.add(lb);
      const rackSet = ri === 0
        ? [[buildARX7(), 1.45], [buildSG12(), 1.45], [buildSR50(), 1.35]]
        : [[buildVectorV9(), 1.6], [buildDesertPython(), 2.2], [buildFlashFrag(), 2.4]];
      rackSet.forEach(([wm, sc], wi) => {
        const b = wm.getObjectByName('laserBeam'); if (b) b.visible = false;
        wm.rotation.y = Math.PI/2; wm.scale.setScalar(sc); wm.position.set(0, 2.3 - wi*0.7, 0.22); rk.add(wm);
      });
      lobbyScene.add(rk);
    });
    const holoTable = new THREE.Group(); holoTable.position.set(-3.45, 0, 1.45); holoTable.rotation.y = 0.42;
    const hTop = new THREE.Mesh(new THREE.BoxGeometry(1.7,0.12,1.15), lSteel); hTop.position.y = 0.92; holoTable.add(hTop);
    const hPed = new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.62,0.88,8), lSteel); hPed.position.y = 0.44; holoTable.add(hPed);
    const holoWire = new THREE.Group(); holoWire.position.y = 1.38;
    holoWire.add(new THREE.Mesh(new THREE.BoxGeometry(0.76,0.02,0.76), new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true })));
    const hBr = new THREE.Mesh(new THREE.BoxGeometry(0.62,0.08,0.14), new THREE.MeshBasicMaterial({ color: 0xf59e0b, wireframe: true })); hBr.position.y = 0.16; holoWire.add(hBr);
    holoTable.add(holoWire); lobbyScene.add(holoTable);
    [[4.5,0.55,2.4,1.1,cOrange],[-5.1,0.6,-5.6,1.2,cCyan]].forEach(([cx,cy,cz,cs,cm]) => {
      const cr = new THREE.Mesh(new THREE.BoxGeometry(cs,cs,cs), cm); cr.position.set(cx,cy,cz); cr.castShadow = true; lobbyScene.add(cr);
    });
    const drone = new THREE.Group(); drone.position.set(3.85, 2.85, -3.1);
    drone.add(new THREE.Mesh(new THREE.SphereGeometry(0.24,14,12), lSteel));
    const dEye = new THREE.Mesh(new THREE.SphereGeometry(0.075,10,10), new THREE.MeshBasicMaterial({ color: 0x06b6d4 })); dEye.position.set(0,-0.02,0.26); drone.add(dEye);
    const dRotors = [];
    [[-0.35,0.3],[0.35,0.3],[-0.35,-0.3],[0.35,-0.3]].forEach(([ax,az]) => {
      const rt = new THREE.Mesh(new THREE.RingGeometry(0.04,0.17,14), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
      rt.rotation.x = Math.PI/2; rt.position.set(ax,0.1,az); drone.add(rt); dRotors.push(rt);
    });
    lobbyScene.add(drone);

    // Floating Dust Particles
    const dGeo = new THREE.BufferGeometry(), dPos = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i++) { dPos[i*3] = (Math.random()-0.5)*16; dPos[i*3+1] = 0.3 + Math.random()*6; dPos[i*3+2] = (Math.random()-0.5)*14; }
    dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
    const lobbyDust = new THREE.Points(dGeo, new THREE.PointsMaterial({ color: 0x7dd3fc, size: 0.06, transparent: true, opacity: 0.5 }));
    lobbyScene.add(lobbyDust);

    // Lobby Drag-Orbit & Camera Focus Choreography
    const LOBBY_PRESETS = {
      overview: { az: 0.36, el: 0.16, dist: 6.1, tx: -0.65, ty: 1.32, tz: 0, fov: 48 },
      armory:   { az: 0.56, el: 0.09, dist: 2.55, tx: 0.45, ty: 1.32, tz: 0.12, fov: 40 },
      profile:  { az: 0.24, el: 0.11, dist: 1.9, tx: 0.32, ty: 1.8, tz: 0.06, fov: 38 },
      settings: { az: 0.42, el: 0.18, dist: 5.5, tx: 0.7, ty: 1.32, tz: 0, fov: 48 }
    };
    let lobbyMode = 'overview', lAz = 0.36, lEl = 0.16, lDist = 6.1, lTgt = new THREE.Vector3(-0.65, 1.32, 0);
    let uAzOff = 0, uElOff = 0, uDistOff = 0, lobbyDrag = false, lpx = 0, lpy = 0, lobbyTime = 0;
    function setLobbyMode(m) { if (lobbyMode !== m) { lobbyMode = m; uAzOff = uElOff = uDistOff = 0; } }

    function onCanvasPointerDown(e) {
      if (!state.inMenu) return;
      AudioSys.startLobbyAmbient();
      if (e.button === 0) { lobbyDrag = true; lpx = e.clientX; lpy = e.clientY; }
    }
    function onCanvasWheel(e) {
      if (!state.inMenu) return;
      uDistOff = Math.max(-1.2, Math.min(2.6, uDistOff + e.deltaY * 0.0025));
    }
    function bindCanvasListeners(cvs) {
      cvs.addEventListener('pointerdown', onCanvasPointerDown);
      cvs.addEventListener('wheel', onCanvasWheel, { passive: true });
    }
    bindCanvasListeners(renderer.domElement);
    window.addEventListener('pointermove', e => {
      if (!state.inMenu || !lobbyDrag) return;
      uAzOff -= (e.clientX - lpx) * 0.0075;
      uElOff = Math.max(-0.25, Math.min(0.55, uElOff + (e.clientY - lpy) * 0.005));
      lpx = e.clientX; lpy = e.clientY;
    });
    window.addEventListener('pointerup', () => { lobbyDrag = false; });

    // Graphics Preset & Potato Mode Engine
    const origMatMap = new WeakMap();
    const lambertCache = new WeakMap();
    function toLambertMat(mat) {
      if (!mat || !mat.isMeshStandardMaterial) return mat;
      const c = lambertCache.get(mat);
      if (c) return c;
      const lm = new THREE.MeshLambertMaterial({
        color: mat.color ? mat.color.clone() : new THREE.Color(0xffffff),
        map: mat.map || null,
        emissive: mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000),
        emissiveMap: mat.emissiveMap || null,
        emissiveIntensity: mat.emissiveIntensity !== undefined ? mat.emissiveIntensity : 1,
        transparent: !!mat.transparent,
        opacity: mat.opacity !== undefined ? mat.opacity : 1,
        side: mat.side !== undefined ? mat.side : THREE.FrontSide,
        wireframe: !!mat.wireframe,
        depthWrite: mat.depthWrite !== undefined ? mat.depthWrite : true,
        depthTest: mat.depthTest !== undefined ? mat.depthTest : true
      });
      lambertCache.set(mat, lm);
      return lm;
    }
    function applyMaterialQuality(root, preset) {
      const simple = preset === 'potato';
      root.traverse(obj => {
        if (!obj.isMesh || !obj.material) return;
        if (simple) {
          if (!origMatMap.has(obj)) origMatMap.set(obj, obj.material);
          const orig = origMatMap.get(obj);
          obj.material = Array.isArray(orig) ? orig.map(toLambertMat) : toLambertMat(orig);
        } else {
          const orig = origMatMap.get(obj);
          if (orig) obj.material = orig;
        }
      });
    }
    function recreateStandaloneRenderer(aa) {
      if (aa === currentAntialias) return;
      currentAntialias = aa;
      const oldCvs = renderer.domElement;
      oldCvs.removeEventListener('pointerdown', onCanvasPointerDown);
      oldCvs.removeEventListener('wheel', onCanvasWheel);
      renderer.dispose();
      if (oldCvs.parentElement === wrap) wrap.removeChild(oldCvs);
      const nr = new THREE.WebGLRenderer({ antialias: aa, powerPreference: 'high-performance' });
      nr.setSize(window.innerWidth, window.innerHeight);
      nr.outputEncoding = THREE.sRGBEncoding;
      nr.toneMapping = THREE.ACESFilmicToneMapping;
      nr.toneMappingExposure = 1.15;
      nr.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer = nr;
      wrap.appendChild(renderer.domElement);
      bindCanvasListeners(renderer.domElement);
    }
    const GFX_META = [
      { id: 'high', label: 'High', tag: 'ULTRA TACTICAL', desc: 'Full Retina DPI, soft shadows, PBR bump/metalness, and full VFX.' },
      { id: 'medium', label: 'Medium', tag: 'BALANCED', desc: '1.0x native resolution, balanced particles, and full 3-point lighting.' },
      { id: 'potato', label: 'Potato Mode', tag: 'MAX FPS', desc: '0.75x scale, shadows & AA off, Lambert materials, no shells/dust, near fog.' }
    ];
    function syncGraphicsUI() {
      const cur = profile.graphicsPreset || 'high';
      const meta = GFX_META.find(m => m.id === cur) || GFX_META[0];
      const tagCol = cur === 'potato' ? '#34d399' : cur === 'medium' ? '#fbbf24' : '#22d3ee';
      const stTag = document.getElementById('set-gfx-tag');
      if (stTag) { stTag.innerText = meta.tag; stTag.style.color = tagCol; }
      const stDesc = document.getElementById('set-gfx-desc');
      if (stDesc) stDesc.innerText = meta.desc;
      const pTag = document.getElementById('pause-gfx-tag');
      if (pTag) { pTag.innerText = meta.tag; pTag.style.color = tagCol; }
      const btnsHtml = GFX_META.map(m =>
        '<button type="button" onclick="setGfxPreset(\\''+m.id+'\\')" class="gfx-btn '+(cur===m.id ? ('active'+(m.id==='potato'?' potato':'')) : '')+'">'+m.label+'</button>'
      ).join('');
      const sg = document.getElementById('set-gfx-grid'); if (sg) sg.innerHTML = btnsHtml;
      const pg = document.getElementById('pause-gfx-grid'); if (pg) pg.innerHTML = btnsHtml;
      const fp = document.getElementById('fps-preset');
      if (fp) { fp.innerText = cur === 'potato' ? 'POTATO' : cur.toUpperCase(); fp.style.color = tagCol; }
    }
    function applyGraphicsPreset(preset) {
      const p = (preset === 'medium' || preset === 'potato') ? preset : 'high';
      const wantAA = p !== 'potato';
      if (wantAA !== currentAntialias) recreateStandaloneRenderer(wantAA);
      if (p === 'potato') {
        renderer.setPixelRatio(0.75);
        renderer.shadowMap.enabled = false;
        sun.castShadow = false; sun.intensity = 1.25;
        arenaAmbient.visible = true; arenaHemi.visible = false; rim.visible = false;
        arenaPointLights.forEach(pl => pl.light.intensity = 0);
        flashLight.intensity = 0;
        bossAlarmLights.forEach(l => l.intensity = 0);
        scene.fog = new THREE.Fog(0x0C1017, 14, 52);
        camera.far = 95;
        lobbyDust.visible = false;
        lobbyAmbient.visible = true; lobbyHemi.visible = false; lobbyRim.visible = false;
        lobbyKey.castShadow = false; lobbyKey.intensity = 1.35; lobbyPodLight.intensity = 0;
        lobbyScene.fog = new THREE.Fog(0x070b12, 8, 28);
        lobbyCam.far = 90;
        while (shells.length) { const sh = shells.pop(); scene.remove(sh.mesh); }
      } else {
        renderer.setPixelRatio(p === 'medium' ? 1.0 : Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        sun.castShadow = true; sun.intensity = 1.8;
        arenaAmbient.visible = false; arenaHemi.visible = true; rim.visible = true;
        arenaPointLights.forEach(pl => pl.light.intensity = pl.base);
        scene.fog = new THREE.FogExp2(0x0C1017, p === 'medium' ? 0.015 : 0.014);
        camera.far = p === 'medium' ? 300 : 500;
        lobbyDust.visible = true;
        lobbyAmbient.visible = false; lobbyHemi.visible = true; lobbyRim.visible = true;
        lobbyKey.castShadow = true; lobbyKey.intensity = 2.0; lobbyPodLight.intensity = 5.5;
        lobbyScene.fog = new THREE.FogExp2(0x070b12, 0.014);
        lobbyCam.far = p === 'medium' ? 180 : 260;
      }
      camera.updateProjectionMatrix();
      lobbyCam.updateProjectionMatrix();
      applyMaterialQuality(scene, p);
      applyMaterialQuality(lobbyScene, p);
      syncGraphicsUI();
    }
    window.setGfxPreset = p => {
      profile.graphicsPreset = p;
      applyGraphicsPreset(p);
      saveProfile();
    };
    applyGraphicsPreset(profile.graphicsPreset);

    // =========================================================================
    // 10. UI BINDINGS (MENU, SIDE DRAWERS, INVENTORY, RADAR)
    // =========================================================================
    window.closeModals = function() {
      ['modal-armory','modal-profile','modal-settings','modal-crosshair','modal-inventory','modal-pause','modal-gameover','modal-leaderboard'].forEach(id => {
        document.getElementById(id).style.display = 'none';
      });
      if (state.inMenu) {
        setLobbyMode('overview');
        setLobbyWeapon(profile.preferredSlot || 0);
        setLobbyAccent(profile.accentColor);
        document.getElementById('main-menu').style.display = 'flex';
      }
    };

    function refreshMenuUI() {
      const acc = profile.totalShots > 0 ? Math.round((profile.totalHits / profile.totalShots)*100) : 0;
      document.getElementById('menu-avatar').innerText = profile.callsign.substring(0,2);
      document.getElementById('menu-avatar').style.background = profile.accentColor;
      document.getElementById('menu-callsign').innerText = profile.callsign;
      document.getElementById('menu-meta').innerText = getRankTitle(profile.level) + ' · Lvl ' + profile.level + ' · ' + acc + '% Acc';
      document.getElementById('menu-hs').innerText = profile.highScore.toLocaleString();
      document.getElementById('hud-callsign').innerText = profile.callsign;
    }

    function updateHUD() {
      const w = state.weapons[state.slot];
      document.getElementById('hp-val').innerText = Math.round(state.hp) + ' / 100';
      document.getElementById('hp-bar').style.width = state.hp + '%';
      document.getElementById('ap-val').innerText = Math.round(state.ap) + ' / 100';
      document.getElementById('ap-bar').style.width = state.ap + '%';
      document.getElementById('lowhp-vignette').style.display = (state.hp > 0 && state.hp <= 25) ? 'block' : 'none';
      document.getElementById('hud-wave').innerText = 'WAVE ' + (state.wave < 10 ? '0'+state.wave : state.wave);
      const bossAlive = boss && !boss.isDead ? 1 : 0;
      document.getElementById('hud-hostiles').innerText = enemies.filter(e => !e.isDead).length + bossAlive;
      document.getElementById('hud-score').innerText = 'Score ' + state.score.toLocaleString();
      const bh = document.getElementById('boss-hud');
      if (boss && !boss.isDead) {
        bh.style.display = 'block';
        document.getElementById('boss-hp-text').innerText = Math.round(boss.hp) + ' / ' + boss.maxHp + ' HP';
        document.getElementById('boss-hp-bar').style.width = Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100)) + '%';
        document.getElementById('boss-atk-lbl').innerText = boss.label;
      } else bh.style.display = 'none';

      const ph = document.getElementById('prep-hud');
      if (waveWait > 0 && !bossAlive) {
        ph.style.display = 'block';
        const nw = state.wave + 1 === 10 ? '10 BOSS NEXT' : (state.wave + 1);
        document.getElementById('prep-title').innerText = 'PREP PHASE · WAVE ' + nw + ' IN ' + Math.ceil(waveWait) + 'S';
      } else ph.style.display = 'none';

      const bb = document.getElementById('boss-banner');
      if (state.bannerT > 0) {
        bb.style.display = 'block';
        bb.className = state.bannerTone === 'emerald' ? 'emerald' : '';
        document.getElementById('boss-banner-title').innerText = state.bannerTitle;
        document.getElementById('boss-banner-sub').innerText = state.bannerSub;
      } else bb.style.display = 'none';

      const sv = document.getElementById('slow-vignette');
      if (state.slowT > 0 || state.inGas) {
        sv.style.display = 'block';
        sv.style.boxShadow = state.inGas ? 'inset 0 0 110px rgba(16,185,129,0.55)' : 'inset 0 0 85px rgba(20,184,166,0.35)';
      } else sv.style.display = 'none';

      let hHtml = '';
      if (state.slowT > 0) hHtml += '<span class="hz-chip">ANESTHETIC SLOW · ' + state.slowT.toFixed(1) + 's</span>';
      if (state.inGas) hHtml += '<span class="hz-chip gas">TOXIC GAS · LEAVE ZONE</span>';
      document.getElementById('hazard-badges').innerHTML = hHtml;
      document.getElementById('wep-title').innerText = w.name;
      const fb = document.getElementById('flash-badge');
      fb.innerText = '[F] LIGHT ' + (state.flashlight ? 'ON' : 'OFF');
      fb.className = 'flash-badge font-mono' + (state.flashlight ? ' on' : '');
      const isItem = w.type === 'medkit' || w.type === 'grenade';
      document.getElementById('ammo-cur').innerText = isItem ? 'x'+w.currentAmmo : (state.reloading ? '--' : w.currentAmmo);
      document.getElementById('ammo-res').innerText = isItem ? '' : '/ ' + w.reserveAmmo;
      document.getElementById('wep-sub').innerText = w.type === 'grenade' ? 'L-CLICK THROW · STUNS 2.5S' : w.type === 'medkit' ? 'L-CLICK TO INJECT' : (state.reloading ? 'RELOADING...' : (w.currentAmmo === 0 && w.reserveAmmo <= 0 ? 'OUT OF AMMO' : w.caliber));
      document.getElementById('scope-overlay').style.display = state.scoped ? 'flex' : 'none';
      document.getElementById('crosshair').style.display = state.scoped ? 'none' : 'block';

      function slotMiniSvg(t, act) {
        const c = act ? '#67e8f9' : '#64748b';
        if (t === 'shotgun') return '<svg width="26" height="12" viewBox="0 0 28 12" fill="none" style="flex-shrink:0;"><path d="M2 5h19v2.2H9l-3 3.3H2V5zm21 0h3v2.2h-3V5zm-12 2.4h6.5v1.6H11V7.4z" fill="'+c+'"/></svg>';
        if (t === 'sniper') return '<svg width="28" height="12" viewBox="0 0 30 12" fill="none" style="flex-shrink:0;"><path d="M1 5.5h20v2H9l-3.5 3.3H1V5.5zm20 .4h8v1.2h-8V5.9zm-11-3.2h7v1.8h-7V2.7z" fill="'+c+'"/></svg>';
        if (t === 'pistol') return '<svg width="20" height="12" viewBox="0 0 22 12" fill="none" style="flex-shrink:0;"><path d="M3 2.5h15v3.2H9.5L8 10.5H4.2l1.2-4.8H3V2.5z" fill="'+c+'"/></svg>';
        if (t === 'medkit') return '<svg width="16" height="14" viewBox="0 0 18 14" fill="none" style="flex-shrink:0;"><rect x="2" y="2.5" width="14" height="9.5" rx="2" stroke="'+c+'" stroke-width="1.5"/><path d="M9 4.8v4.8M6.6 7.2h4.8" stroke="#34d399" stroke-width="1.6" stroke-linecap="round"/></svg>';
        return '<svg width="26" height="12" viewBox="0 0 28 12" fill="none" style="flex-shrink:0;"><path d="M2 4.5h18v2.5H13l-1.5 3.5H9L10 7H6L4 10H1.5l1-5.5zm19 .5h5v1.5h-5V5zm-11-2h6v1.2h-6V3z" fill="'+c+'"/></svg>';
      }
      document.getElementById('slot-list').innerHTML = state.weapons.slice(0, 4).map((wp, i) => {
        const act = i === state.slot;
        const isIt = wp.type === 'medkit' || wp.type === 'grenade';
        const ammoStr = isIt ? ('x' + wp.currentAmmo) : (wp.currentAmmo + '<span style="color:'+(act?'#a5f3fc':'#64748b')+';">/' + Math.max(0, wp.reserveAmmo) + '</span>');
        const emptyCol = (wp.currentAmmo === 0 && !isIt) ? '#fb7185' : (act ? '#ffffff' : '#cbd5e1');
        return '<div class="slot-row ' + (act ? 'active' : '') + '"><span class="slot-key font-mono">'+wp.slot+'</span>'+slotMiniSvg(wp.type, act)+'<span style="flex:1;font-weight:700;letter-spacing:0.02em;white-space:nowrap;">'+wp.shortName+'</span><span class="font-mono" style="font-weight:700;font-variant-numeric:tabular-nums;color:'+emptyCol+';">'+ammoStr+'</span></div>';
      }).join('');

      document.getElementById('killfeed').innerHTML = state.killFeed.map(k =>
        '<div class="kf-item ' + (k.hs ? 'hs' : '') + '">' + k.text + '</div>'
      ).join('');
      const cb = document.getElementById('hud-cheat-bar');
      if (cb) {
        const parts = [];
        if (adminCheats.godMode) parts.push('<strong style="color:#34d399;">GOD MODE</strong>');
        if (adminCheats.infiniteAmmo) parts.push('<strong style="color:#22d3ee;">INF AMMO</strong>');
        if (adminCheats.speedMult > 1.01 || adminCheats.jumpMult > 1.01) parts.push('<span>SPD ' + adminCheats.speedMult.toFixed(1) + 'x · JMP ' + adminCheats.jumpMult.toFixed(1) + 'x</span>');
        cb.style.display = parts.length ? 'flex' : 'none';
        cb.innerHTML = parts.join(' <span style="color:#475569;">·</span> ');
      }
    }

    function drawRadar() {
      const c = document.getElementById('radar-canvas'), ctx = c.getContext('2d');
      const w = c.width, h = c.height, cx = w/2, cy = h/2, r = w/2 - 4, sc = 1.65;
      ctx.clearRect(0,0,w,h);
      ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fillStyle = 'rgba(12,16,23,0.9)'; ctx.fill(); ctx.clip();
      ctx.fillStyle = 'rgba(6,182,212,0.12)'; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,-Math.PI/2-0.5,-Math.PI/2+0.5); ctx.closePath(); ctx.fill();
      const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
      const ang = Math.atan2(fwd.x, fwd.z);
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(ang - Math.PI); ctx.scale(sc,sc); ctx.translate(-playerPos.x, -playerPos.z);
      ctx.strokeStyle = 'rgba(148,163,184,0.35)'; ctx.lineWidth = 1/sc; ctx.strokeRect(-40,-40,80,80);
      radarRects.forEach(rc => {
        ctx.save(); ctx.translate(rc.x, rc.z); if (rc.rotY) ctx.rotate(-rc.rotY);
        ctx.fillStyle = rc.kind === 'platform' ? 'rgba(6,182,212,0.22)' : rc.kind === 'crate' ? 'rgba(245,158,11,0.38)' : 'rgba(148,163,184,0.45)';
        ctx.fillRect(-rc.w/2,-rc.d/2,rc.w,rc.d); ctx.restore();
      });
      enemies.forEach(e => { if (!e.isDead) { ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(e.pos.x, e.pos.z, 2.5/sc, 0, Math.PI*2); ctx.fill(); } });
      if (boss && !boss.isDead) {
        ctx.fillStyle = '#10b981'; ctx.beginPath(); ctx.arc(boss.pos.x, boss.pos.z, 4.8/sc, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(boss.pos.x, boss.pos.z, 2.7/sc, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = profile.accentColor; ctx.beginPath(); ctx.moveTo(cx,cy-6); ctx.lineTo(cx+5,cy+5); ctx.lineTo(cx,cy+2); ctx.lineTo(cx-5,cy+5); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    let armorySel = Math.min(3, Math.max(0, profile.preferredSlot || 0));
    function renderArmory() {
      const loadout = buildFourSlotLoadout();
      armorySel = Math.min(3, Math.max(0, armorySel));
      document.getElementById('armory-grid').innerHTML = loadout.map((w, i) =>
        '<button onclick="selectArmory('+i+')" class="btn-sec" style="text-align:left;padding:8px 10px;'+(armorySel===i?'border-color:#22d3ee;background:rgba(6,182,212,0.15);':'')+'"><div class="font-mono" style="font-size:10px;color:#94a3b8;">SLOT '+w.slot+(profile.preferredSlot===i?' · PRIMARY':'')+'</div><div class="font-display" style="font-size:13px;margin-top:2px;">'+w.shortName+'</div></button>'
      ).join('');
      const s4c = profile.slot4Choice === 'nano_medkit' ? 'nano_medkit' : 'desert_python';
      document.getElementById('armory-slot4-bar').innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
          '<span class="font-mono" style="font-size:10px;color:#94a3b8;text-transform:uppercase;">Slot 4 Tactical Reserve</span>' +
          '<div style="display:flex;gap:6px;">' +
            '<button onclick="setSlot4Choice(\\'desert_python\\')" class="btn-sec font-mono" style="padding:5px 10px;font-size:10px;'+(s4c==='desert_python'?'border-color:#22d3ee;background:rgba(6,182,212,0.18);color:#67e8f9;':'')+'">.50 PYTHON</button>' +
            '<button onclick="setSlot4Choice(\\'nano_medkit\\')" class="btn-sec font-mono" style="padding:5px 10px;font-size:10px;'+(s4c==='nano_medkit'?'border-color:#10b981;background:rgba(16,185,129,0.18);color:#6ee7b7;':'')+'">MEDKIT</button>' +
          '</div>' +
        '</div>';
      const cw = loadout[armorySel];
      const isUtil = cw.type === 'medkit' || cw.type === 'grenade';
      document.getElementById('armory-detail').innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><strong class="font-display" style="font-size:17px;">'+cw.name+'</strong><span class="font-mono" style="font-size:11px;color:#22d3ee;">'+cw.caliber+'</span></div><p style="font-size:12px;color:#94a3b8;margin-bottom:14px;">'+cw.desc+'</p>' +
        (!isUtil ? '<button onclick="setPrimarySlot('+armorySel+')" class="btn-primary" style="font-size:13px;padding:10px;">'+(profile.preferredSlot===armorySel?'Equipped as Starting Weapon':'Set Starting Weapon')+'</button>' : '<div class="font-mono" style="font-size:11px;color:#34d399;padding:8px;border:1px solid rgba(16,185,129,0.35);border-radius:8px;text-align:center;">Tactical Slot 4 Support Tool · Press [4] In Combat</div>');
    }
    window.selectArmory = i => { armorySel = Math.min(3, Math.max(0, i)); setLobbyWeapon(armorySel); renderArmory(); };
    window.setPrimarySlot = i => { profile.preferredSlot = Math.min(3, Math.max(0, i)); saveProfile(); setLobbyWeapon(profile.preferredSlot); renderArmory(); };
    window.setSlot4Choice = c => {
      profile.slot4Choice = c === 'nano_medkit' ? 'nano_medkit' : 'desert_python';
      if (profile.slot4Choice === 'nano_medkit' && profile.preferredSlot === 3) profile.preferredSlot = 0;
      saveProfile();
      armorySel = 3;
      setLobbyWeapon(3);
      renderArmory();
    };

    function renderInventory() {
      document.getElementById('inv-grid').innerHTML = state.weapons.slice(0, 4).map((w, i) =>
        '<div class="card" style="background:#0C1017;display:flex;flex-direction:column;justify-content:space-between;'+(state.slot===i?'border-color:#22d3ee;':'')+'"><div><div class="font-mono" style="font-size:11px;color:#94a3b8;">SLOT '+w.slot+'</div><h3 class="font-display" style="font-size:15px;margin:4px 0;">'+w.name+'</h3><p style="font-size:11px;color:#94a3b8;margin-bottom:10px;">'+w.desc+'</p></div>' +
        (w.type === 'medkit' ? '<button onclick="invUseMed()" class="btn-primary" style="background:#10b981;font-size:12px;padding:8px;">Use Medkit (x'+w.currentAmmo+')</button>' : '<button onclick="invEquip('+i+')" class="btn-primary" style="font-size:12px;padding:8px;">'+(state.slot===i?'Equipped':'Equip ['+w.slot+']')+'</button>') + '</div>'
      ).join('');
    }
    window.invEquip = i => { equipSlot(i); renderInventory(); };
    window.invUseMed = () => { useMedkit(); renderInventory(); };

    document.getElementById('btn-deploy').onclick = startMatch;
    document.getElementById('btn-armory').onclick = () => {
      AudioSys.startLobbyAmbient(); armorySel = profile.preferredSlot || 0; renderArmory();
      setLobbyMode('armory'); setLobbyWeapon(armorySel);
      document.getElementById('main-menu').style.display = 'none';
      document.getElementById('modal-armory').style.display = 'flex';
    };
    let profLookupTimer = null, profLookupStatus = 'checking';
    function refreshProfileCloudUI() {
      const cl = window.__GIS_CLOUD__;
      const u = cl && cl.user;
      const nm = document.getElementById('prof-cloud-name');
      const sb = document.getElementById('prof-cloud-sub');
      const bt = document.getElementById('btn-prof-google');
      const pw = document.getElementById('prof-pin-wrap');
      const ph = document.getElementById('prof-pin-hint');
      if (nm) nm.innerText = u ? (u.displayName || 'Google Operative') : 'Cloud Sync Offline';
      if (sb) sb.innerText = u ? (u.email || 'Verified Cloud Account') : 'Sign in with Google to sync globally';
      if (bt) bt.innerText = u ? 'Sign Out' : 'Sign In';
      if (pw) pw.style.display = u ? 'block' : 'none';
      if (ph) ph.innerText = (cl && cl.operativeAccount && cl.operativeAccount.pinHash) ? '(Required if changing callsign)' : '(Optional 4–8 digits)';
    }
    function runCallsignCheck() {
      const stEl = document.getElementById('prof-callsign-status');
      const val = (document.getElementById('prof-callsign-input').value || '').trim().toUpperCase();
      if (stEl) { stEl.style.color = '#94a3b8'; stEl.innerText = 'Checking global callsign registry...'; }
      if (profLookupTimer) clearTimeout(profLookupTimer);
      profLookupTimer = setTimeout(async () => {
        const res = await window.__GIS_CLOUD__.lookupCallsign(val || 'OPERATIVE');
        profLookupStatus = res.status;
        if (!stEl) return;
        if (res.status === 'available') { stEl.style.color = '#34d399'; stEl.innerText = 'Available · Unclaimed global callsign'; }
        else if (res.status === 'owned_by_you') { stEl.style.color = '#22d3ee'; stEl.innerText = 'Verified Owner · Cloud PB: ' + (res.existingScore || 0).toLocaleString(); }
        else if (res.status === 'owned_by_other') { stEl.style.color = '#fb7185'; stEl.innerText = 'Registered by another account (PB: ' + (res.existingScore || 0).toLocaleString() + ')'; }
        else { stEl.style.color = '#64748b'; stEl.innerText = 'Local mode · Cloud check unavailable'; }
      }, 280);
    }
    document.getElementById('prof-callsign-input').oninput = runCallsignCheck;
    document.getElementById('btn-prof-google').onclick = async () => {
      const cl = window.__GIS_CLOUD__;
      const errEl = document.getElementById('prof-cloud-err');
      if (errEl) errEl.style.display = 'none';
      try {
        if (cl.user) await cl.signOut(); else await cl.signIn();
        refreshProfileCloudUI();
        runCallsignCheck();
      } catch(e) {
        if (errEl) { errEl.innerText = e.message || 'Google Sign-In failed.'; errEl.style.display = 'block'; }
      }
    };
    document.getElementById('btn-profile').onclick = () => {
      AudioSys.startLobbyAmbient(); setLobbyMode('profile');
      document.getElementById('main-menu').style.display = 'none';
      document.getElementById('prof-rank-label').innerText = getRankTitle(profile.level) + ' · LEVEL ' + profile.level;
      document.getElementById('prof-callsign-input').value = profile.callsign;
      document.getElementById('prof-pin-input').value = '';
      document.getElementById('prof-cloud-err').style.display = 'none';
      refreshProfileCloudUI();
      runCallsignCheck();
      const nx = profile.level * 250;
      document.getElementById('prof-xp-text').innerText = profile.xp + ' / ' + nx + ' XP';
      document.getElementById('prof-xp-bar').style.width = Math.min(100, Math.round((profile.xp/nx)*100)) + '%';
      const acc = profile.totalShots > 0 ? Math.round((profile.totalHits/profile.totalShots)*100) : 0;
      const hsr = profile.totalKills > 0 ? Math.round((profile.totalHeadshots/profile.totalKills)*100) : 0;
      document.getElementById('prof-stats').innerHTML = [
        ['Kills', profile.totalKills], ['HS Ratio', hsr+'%'], ['Accuracy', acc+'%'], ['High Score', profile.highScore]
      ].map(([l,v]) => '<div class="card" style="background:#0C1017;padding:10px;"><div style="font-size:10px;color:#94a3b8;">'+l+'</div><div style="font-size:16px;font-weight:700;">'+v+'</div></div>').join('');
      const hasAch = (profile.achievements || []).includes('SPECIALIST_SLAYER');
      document.getElementById('prof-achievements').innerHTML =
        '<div class="font-mono" style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px;"><strong style="color:#e2e8f0;">SPECIAL ACHIEVEMENTS</strong><span style="color:#94a3b8;">Boss Kills: '+(profile.bossDefeatedCount||0)+'</span></div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 9px;border-radius:8px;border:1px solid '+(hasAch?'rgba(16,185,129,0.6)':'#1e293b')+';background:'+(hasAch?'rgba(6,78,59,0.45)':'#070a10')+';">' +
          '<div><div class="font-display" style="font-size:12px;font-weight:700;color:'+(hasAch?'#a7f3d0':'#64748b')+';">Anesthesia Neutralized</div><div style="font-size:10px;color:#94a3b8;">Defeat The Specialist Anestesi on Wave 10</div></div>' +
          '<span class="font-mono" style="font-size:10px;font-weight:700;color:'+(hasAch?'#34d399':'#64748b')+';">'+(hasAch?'UNLOCKED':'LOCKED')+'</span>' +
        '</div>';
      document.getElementById('prof-colors').innerHTML = ['#06b6d4','#f59e0b','#10b981','#ef4444','#38bdf8'].map(c =>
        '<button onclick="pickCol(\\''+c+'\\')" style="width:32px;height:32px;border-radius:8px;background:'+c+';border:'+(profile.accentColor===c?'2px solid #fff':'none')+';cursor:pointer;"></button>'
      ).join('');
      document.getElementById('modal-profile').style.display = 'flex';
    };
    window.pickCol = c => {
      profile.accentColor = c; saveProfile(); setLobbyAccent(c);
      document.getElementById('prof-colors').innerHTML = ['#06b6d4','#f59e0b','#10b981','#ef4444','#38bdf8'].map(col =>
        '<button onclick="pickCol(\\''+col+'\\')" style="width:32px;height:32px;border-radius:8px;background:'+col+';border:'+(profile.accentColor===col?'2px solid #fff':'none')+';cursor:pointer;"></button>'
      ).join('');
    };
    document.getElementById('btn-save-prof').onclick = async () => {
      const cl = window.__GIS_CLOUD__;
      const errEl = document.getElementById('prof-cloud-err');
      if (errEl) errEl.style.display = 'none';
      const rawCs = (document.getElementById('prof-callsign-input').value.trim() || 'OPERATIVE').toUpperCase().slice(0, 16);
      const cleanCs = rawCs.length < 2 ? 'OPERATIVE' : rawCs;
      if (cl.user && profLookupStatus === 'owned_by_other') {
        if (errEl) { errEl.innerText = 'Callsign belongs to another Google account. Choose another callsign.'; errEl.style.display = 'block'; }
        return;
      }
      const pinVal = (document.getElementById('prof-pin-input').value || '').trim();
      const opAcc = cl.operativeAccount;
      const normKey = cleanCs.replace(/\s+/g, '_').replace(/[^A-Z0-9_\-]/g, '');
      if (cl.user && opAcc && opAcc.pinHash && opAcc.primaryCallsign !== normKey) {
        if (!pinVal) { if (errEl) { errEl.innerText = 'Enter Operative PIN to authorize callsign change.'; errEl.style.display = 'block'; } return; }
        const h = await cl.hashPin(pinVal, cl.user.uid);
        if (h !== opAcc.pinHash) { if (errEl) { errEl.innerText = 'Incorrect Operative PIN.'; errEl.style.display = 'block'; } return; }
      }
      profile.callsign = cleanCs;
      saveProfile();
      if (cl.user) {
        try {
          const savedAcc = await cl.saveOperative(cleanCs, profile.accentColor, (!opAcc || !opAcc.pinHash) ? pinVal : '');
          if (profile.highScore > 0) {
            const accPct = profile.totalShots > 0 ? Math.round((profile.totalHits / profile.totalShots) * 100) : 0;
            await cl.upsertScore({ callsign: cleanCs, score: profile.highScore, wave: profile.highestWave || 1, kills: profile.totalKills, headshots: profile.totalHeadshots, accuracy: accPct, survivalSec: Math.max(60, (profile.highestWave || 1) * 55), xpEarned: profile.xp, level: profile.level, avatarColor: profile.accentColor, favoriteWeapon: 'AR-X7 Tactical', hasPin: !!(savedAcc && savedAcc.pinHash) });
          }
        } catch(e) {}
      }
      closeModals();
    };
    document.getElementById('btn-settings').onclick = () => {
      AudioSys.startLobbyAmbient(); setLobbyMode('settings');
      document.getElementById('main-menu').style.display = 'none';
      syncGraphicsUI();
      document.getElementById('set-sens').value = profile.mouseSensitivity;
      document.getElementById('set-sens-val').innerText = profile.mouseSensitivity.toFixed(1) + 'x';
      document.getElementById('set-fov').value = profile.baseFov;
      document.getElementById('set-fov-val').innerText = profile.baseFov + '°';
      document.getElementById('set-vol').value = profile.masterVolume;
      document.getElementById('set-vol-val').innerText = Math.round(profile.masterVolume*100) + '%';
      document.getElementById('modal-settings').style.display = 'flex';
    };
    document.getElementById('set-sens').oninput = e => { profile.mouseSensitivity = parseFloat(e.target.value); document.getElementById('set-sens-val').innerText = profile.mouseSensitivity.toFixed(1)+'x'; saveProfile(); };
    document.getElementById('set-fov').oninput = e => { profile.baseFov = parseInt(e.target.value,10); document.getElementById('set-fov-val').innerText = profile.baseFov+'°'; camera.fov = profile.baseFov; camera.updateProjectionMatrix(); saveProfile(); };
    document.getElementById('set-vol').oninput = e => { profile.masterVolume = parseFloat(e.target.value); document.getElementById('set-vol-val').innerText = Math.round(profile.masterVolume*100)+'%'; AudioSys.setVolume(profile.masterVolume); saveProfile(); };
    document.getElementById('pause-sens').oninput = e => { profile.mouseSensitivity = parseFloat(e.target.value); document.getElementById('pause-sens-val').innerText = profile.mouseSensitivity.toFixed(1)+'x'; saveProfile(); };

    // Crosshair Editor & SVG Reticle Renderer
    let chSimTimer = null, chSimSpread = 0.1, chSimHit = false, chReturnToPause = false;
    function renderCrosshairSvg(svgEl, ch, sp, aiming, hitAct, hitHs) {
      if (!svgEl) return;
      const cx = 64, cy = 64;
      const dyn = ch.dynamic ? (sp - 0.1) * 46 : 0;
      const aimComp = aiming ? -Math.min(ch.gap * 0.45, 3) : 0;
      const gap = Math.max(1, ch.gap + dyn + aimComp);
      const showL = ch.style === 'classic' || ch.style === 'cross_dot';
      const showD = ch.style === 'dot' || ch.style === 'cross_dot';
      const showC = ch.style === 'circle';
      const col = hitAct ? (hitHs ? '#EF4444' : '#F87171') : ch.color;
      const r = Math.max(6, gap + ch.length * 0.72);
      svgEl.style.opacity = String(ch.opacity);
      let html = '';
      if (ch.outline) {
        html += '<g stroke="rgba(2,6,23,0.92)" fill="rgba(2,6,23,0.92)" stroke-linecap="square">';
        if (showL) {
          html += '<g stroke-width="' + (ch.thickness + 2) + '">' +
            '<line x1="64" y1="' + (cy - gap - ch.length) + '" x2="64" y2="' + (cy - gap) + '"/>' +
            '<line x1="64" y1="' + (cy + gap) + '" x2="64" y2="' + (cy + gap + ch.length) + '"/>' +
            '<line x1="' + (cx - gap - ch.length) + '" y1="64" x2="' + (cx - gap) + '" y2="64"/>' +
            '<line x1="' + (cx + gap) + '" y1="64" x2="' + (cx + gap + ch.length) + '" y2="64"/>' +
          '</g>';
        }
        if (showC) html += '<circle cx="64" cy="64" r="' + r + '" fill="none" stroke-width="' + (ch.thickness + 2) + '"/>';
        if (showD) html += '<circle cx="64" cy="64" r="' + (ch.dotSize * 0.5 + 1) + '" stroke="none"/>';
        html += '</g>';
      }
      html += '<g stroke="' + col + '" fill="' + col + '" stroke-linecap="square">';
      if (showL) {
        html += '<g stroke-width="' + ch.thickness + '">' +
          '<line x1="64" y1="' + (cy - gap - ch.length) + '" x2="64" y2="' + (cy - gap) + '"/>' +
          '<line x1="64" y1="' + (cy + gap) + '" x2="64" y2="' + (cy + gap + ch.length) + '"/>' +
          '<line x1="' + (cx - gap - ch.length) + '" y1="64" x2="' + (cx - gap) + '" y2="64"/>' +
          '<line x1="' + (cx + gap) + '" y1="64" x2="' + (cx + gap + ch.length) + '" y2="64"/>' +
        '</g>';
      }
      if (showC) html += '<circle cx="64" cy="64" r="' + r + '" fill="none" stroke-width="' + ch.thickness + '"/>';
      if (showD) html += '<circle cx="64" cy="64" r="' + (ch.dotSize * 0.5) + '" stroke="none"/>';
      html += '</g>';
      if (hitAct) {
        const hh = hitHs ? 12 : 9, ih = hitHs ? 5 : 4;
        html += '<g stroke="' + (hitHs ? '#EF4444' : '#FFFFFF') + '" stroke-width="' + (hitHs ? 2.8 : 2.2) + '" stroke-linecap="round">' +
          '<line x1="'+(cx-hh)+'" y1="'+(cy-hh)+'" x2="'+(cx-ih)+'" y2="'+(cy-ih)+'"/>' +
          '<line x1="'+(cx+hh)+'" y1="'+(cy-hh)+'" x2="'+(cx+ih)+'" y2="'+(cy-ih)+'"/>' +
          '<line x1="'+(cx-hh)+'" y1="'+(cy+hh)+'" x2="'+(cx-ih)+'" y2="'+(cy+ih)+'"/>' +
          '<line x1="'+(cx+hh)+'" y1="'+(cy+hh)+'" x2="'+(cx+ih)+'" y2="'+(cy+ih)+'"/>' +
        '</g>';
      }
      svgEl.innerHTML = html;
    }

    const CH_STYLES = [['classic','Classic'],['dot','Dot Only'],['circle','Ring'],['cross_dot','Cross + Dot']];
    const CH_PRESETS = ['#22C55E','#FFFFFF','#FACC15','#06B6D4','#EF4444'];
    function syncCrosshairUI() {
      const ch = profile.crosshair;
      document.getElementById('ch-styles').innerHTML = CH_STYLES.map(([id, lbl]) =>
        '<button type="button" onclick="setChStyle(\\'' + id + '\\')" class="ch-style-btn ' + (ch.style === id ? 'active' : '') + '">' + lbl + '</button>'
      ).join('');
      document.getElementById('ch-color-presets').innerHTML = CH_PRESETS.map(c =>
        '<button type="button" onclick="setChColor(\\'' + c + '\\')" style="width:24px;height:24px;border-radius:6px;background:' + c + ';border:' + (ch.color.toUpperCase() === c ? '2px solid #fff' : '1px solid #334155') + ';cursor:pointer;"></button>'
      ).join('');
      document.getElementById('ch-color-hex').innerText = ch.color.toUpperCase();
      document.getElementById('ch-color-picker').value = ch.color;
      document.getElementById('ch-length').value = ch.length; document.getElementById('ch-len-val').innerText = ch.length + 'px';
      document.getElementById('ch-thickness').value = ch.thickness; document.getElementById('ch-thk-val').innerText = ch.thickness + 'px';
      document.getElementById('ch-gap').value = ch.gap; document.getElementById('ch-gap-val').innerText = ch.gap + 'px';
      document.getElementById('ch-dot').value = ch.dotSize; document.getElementById('ch-dot-val').innerText = ch.dotSize + 'px';
      document.getElementById('ch-opacity').value = ch.opacity; document.getElementById('ch-opa-val').innerText = Math.round(ch.opacity * 100) + '%';
      document.getElementById('ch-outline-val').innerText = ch.outline ? 'ON' : 'OFF';
      document.getElementById('ch-dynamic-val').innerText = ch.dynamic ? 'ON' : 'OFF';
      renderCrosshairSvg(document.getElementById('ch-preview-svg'), ch, chSimSpread, false, chSimHit, true);
      renderCrosshairSvg(document.getElementById('crosshair-svg'), ch, state.spread, state.aiming, state.hitActive, state.hitHs);
    }
    window.setChStyle = s => { profile.crosshair.style = s; saveProfile(); syncCrosshairUI(); };
    window.setChColor = c => { profile.crosshair.color = c; saveProfile(); syncCrosshairUI(); };

    function openCrosshairEditor(fromPause) {
      chReturnToPause = !!fromPause;
      if (state.inMenu) { AudioSys.startLobbyAmbient(); setLobbyMode('settings'); document.getElementById('main-menu').style.display = 'none'; }
      else { document.getElementById('modal-pause').style.display = 'none'; }
      const dr = document.getElementById('modal-crosshair');
      dr.style.background = fromPause ? 'rgba(2,6,23,0.75)' : 'transparent';
      dr.style.pointerEvents = fromPause ? 'auto' : 'none';
      dr.style.display = 'flex';
      syncCrosshairUI();
    }
    function closeCrosshairEditor() {
      if (chSimTimer) { clearInterval(chSimTimer); chSimTimer = null; chSimSpread = 0.1; document.getElementById('ch-sim-toggle').innerText = 'Test Spread'; }
      document.getElementById('modal-crosshair').style.display = 'none';
      if (chReturnToPause && !state.inMenu) { document.getElementById('modal-pause').style.display = 'flex'; }
      else { closeModals(); }
    }
    document.getElementById('btn-crosshair').onclick = () => openCrosshairEditor(false);
    document.getElementById('btn-pause-crosshair').onclick = () => openCrosshairEditor(true);
    document.getElementById('ch-close-x').onclick = closeCrosshairEditor;
    document.getElementById('ch-save').onclick = closeCrosshairEditor;
    document.getElementById('ch-reset').onclick = () => { profile.crosshair = Object.assign({}, DEFAULT_CH); saveProfile(); syncCrosshairUI(); };
    document.getElementById('ch-bg-toggle').onclick = () => {
      const box = document.getElementById('ch-preview-box');
      const isB = box.classList.toggle('bright');
      document.getElementById('ch-bg-toggle').innerText = isB ? 'Dark Bay' : 'Bright Surface';
    };
    document.getElementById('ch-sim-toggle').onclick = () => {
      if (chSimTimer) { clearInterval(chSimTimer); chSimTimer = null; chSimSpread = 0.1; document.getElementById('ch-sim-toggle').innerText = 'Test Spread'; syncCrosshairUI(); }
      else {
        let ph = 0;
        document.getElementById('ch-sim-toggle').innerText = 'Stop Motion';
        chSimTimer = setInterval(() => { ph += 0.18; chSimSpread = 0.1 + (Math.sin(ph)*0.5+0.5)*0.34; renderCrosshairSvg(document.getElementById('ch-preview-svg'), profile.crosshair, chSimSpread, false, chSimHit, true); }, 45);
      }
    };
    document.getElementById('ch-hit-test').onclick = () => { chSimHit = true; syncCrosshairUI(); setTimeout(() => { chSimHit = false; syncCrosshairUI(); }, 220); };
    document.getElementById('ch-color-picker').oninput = e => { profile.crosshair.color = e.target.value.toUpperCase(); saveProfile(); syncCrosshairUI(); };
    document.getElementById('ch-length').oninput = e => { profile.crosshair.length = parseInt(e.target.value,10); saveProfile(); syncCrosshairUI(); };
    document.getElementById('ch-thickness').oninput = e => { profile.crosshair.thickness = parseInt(e.target.value,10); saveProfile(); syncCrosshairUI(); };
    document.getElementById('ch-gap').oninput = e => { profile.crosshair.gap = parseInt(e.target.value,10); saveProfile(); syncCrosshairUI(); };
    document.getElementById('ch-dot').oninput = e => { profile.crosshair.dotSize = parseInt(e.target.value,10); saveProfile(); syncCrosshairUI(); };
    document.getElementById('ch-opacity').oninput = e => { profile.crosshair.opacity = parseFloat(e.target.value); saveProfile(); syncCrosshairUI(); };
    document.getElementById('ch-outline-btn').onclick = () => { profile.crosshair.outline = !profile.crosshair.outline; saveProfile(); syncCrosshairUI(); };
    document.getElementById('ch-dynamic-btn').onclick = () => { profile.crosshair.dynamic = !profile.crosshair.dynamic; saveProfile(); syncCrosshairUI(); };
    syncCrosshairUI();

    // Leaderboard UI & Game Over Debrief Handlers
    let lbTab = 'global', currentLbRows = [], cloudSyncMsg = '', cloudSyncStatus = 'idle', lastSavedMatchRec = null;
    let lastAutoCloudKey = '';
    async function tryAutoSyncLocalBest() {
      const cl = window.__GIS_CLOUD__;
      if (!cl || !cl.user || cl.status !== 'live') return;
      const activeCs = (profile.callsign || 'OPERATIVE').trim().toUpperCase();
      const activeKey = activeCs.replace(/\s+/g, '_').replace(/[^A-Z0-9_\-]/g, '').slice(0, 16) || 'OPERATIVE';
      const localBest = loadLocalLb().filter(e => (e.callsign || '').trim().toUpperCase() === activeCs).sort((a,b) => b.score - a.score)[0];
      const bestScore = Math.max(localBest ? localBest.score : 0, profile.highScore || 0);
      if (bestScore <= 0) return;
      const ex = (cl.entries || []).find(c => ((c.callsign || '').trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_\-]/g, '').slice(0, 16) === activeKey));
      if (ex && ((ex.ownerUid && ex.ownerUid !== cl.user.uid) || ex.score >= bestScore)) return;
      const syncTag = cl.user.uid + ':' + activeKey + ':' + bestScore;
      if (lastAutoCloudKey === syncTag) return;
      lastAutoCloudKey = syncTag;
      const accPct = localBest ? localBest.accuracy : (profile.totalShots > 0 ? Math.min(100, Math.round((profile.totalHits / profile.totalShots) * 100)) : 0);
      try {
        await cl.upsertScore({
          callsign: activeCs,
          countryCode: localBest ? localBest.countryCode : 'ID',
          flag: localBest ? localBest.flag : '🇮🇩',
          score: bestScore,
          wave: localBest ? localBest.wave : (profile.highestWave || 1),
          kills: localBest ? localBest.kills : profile.totalKills,
          headshots: localBest ? localBest.headshots : profile.totalHeadshots,
          accuracy: accPct,
          survivalSec: localBest ? localBest.survivalSec : Math.max(60, (profile.highestWave || 1) * 55),
          xpEarned: localBest ? localBest.xpEarned : profile.xp,
          level: localBest ? localBest.level : profile.level,
          avatarColor: localBest ? localBest.avatarColor : profile.accentColor,
          favoriteWeapon: localBest ? localBest.favoriteWeapon : 'AR-X7 Tactical',
          weekKey: localBest ? localBest.weekKey : undefined,
          hasPin: !!(cl.operativeAccount && cl.operativeAccount.pinHash)
        });
      } catch(e) {}
    }

    function renderLeaderboard() {
      const b = getMergedLb(lbTab), cl = window.__GIS_CLOUD__;
      currentLbRows = b.rows;
      const gBtn = document.getElementById('lb-google-btn');
      if (gBtn) gBtn.style.display = (cl && !cl.user) ? 'inline-flex' : 'none';
      const lw = document.getElementById('lb-local-warn');
      if (lw) lw.style.display = (cl && !cl.user && b.rows.some(r => r.isPlayer && !r.isCloud)) ? 'block' : 'none';
      const stTxt = cl && cl.status === 'live' ? ('Live Cloud (' + b.cloudCount + ' Players)') : (cl && cl.status === 'connecting' ? 'Connecting to Cloud...' : 'Offline Cache');
      document.getElementById('lb-season').innerText = 'Global Cloud & Local Operative Rankings · Season ' + b.wk + ' · ' + stTxt;
      document.getElementById('lb-tabs').innerHTML = [['global','Global Top 100'],['personal','Personal Best'],['weekly','Weekly Season']].map(([id, lbl]) =>
        '<button type="button" onclick="setLbTab(\\''+id+'\\')" class="lb-tab '+(lbTab===id?'active':'')+'">'+lbl+'</button>'
      ).join('');
      document.getElementById('lb-summary').innerHTML =
        (cl && cl.status === 'live' ? '<span style="color:#34d399;">Live</span> <span style="color:#475569;">·</span> ' : '') +
        '<span style="color:#94a3b8;">Operative:</span> <strong style="color:#22d3ee;">'+profile.callsign+'</strong>' +
        ' <span style="color:#475569;">·</span> <span style="color:#94a3b8;">Rank:</span> <strong style="color:#fbbf24;">'+(b.bestRank?'#'+b.bestRank:'Unranked')+'</strong>';
      document.getElementById('lb-foot-note').innerText = 'Click any operator row to inspect dossier · Showing top ' + b.rows.length + ' operatives';
      if (b.rows.length === 0) {
        document.getElementById('lb-body').innerHTML = '<div style="padding:44px 16px;text-align:center;"><div class="font-display" style="font-size:16px;font-weight:700;margin-bottom:4px;">No Personal Runs Submitted Yet</div><div style="font-size:12px;color:#94a3b8;">Deploy into combat and click Submit Score on the Game Over debrief to record your personal bests.</div></div>';
        return;
      }
      document.getElementById('lb-body').innerHTML = '<table class="lb-table font-mono"><thead><tr><th>Rank</th><th>Operator</th><th style="text-align:right;">Wave</th><th style="text-align:right;">Kills</th><th style="text-align:right;">Accuracy</th><th style="text-align:right;">Time</th><th style="text-align:right;">Score</th></tr></thead><tbody>' +
        b.rows.map((r, idx) => {
          const hl = r.isMe || (lbTab === 'personal' && r.isPlayer);
          const rc = r.rank===1 ? '#fbbf24' : r.rank===2 ? '#e2e8f0' : r.rank===3 ? '#d97706' : '#94a3b8';
          return '<tr class="lb-row-btn '+(hl?'lb-row-me':'')+'" onclick="openOpProfile('+idx+')" title="Inspect '+r.callsign+' Operator Profile"><td style="font-weight:700;color:'+rc+';">#'+r.rank+'</td>' +
            '<td><span>'+r.flag+'</span> <strong style="color:'+(hl?'#67e8f9':'#f8fafc')+';">'+r.callsign+'</strong>'+(r.isCloud?' <span style="font-size:10px;color:#34d399;">· CLOUD</span>':(r.isPlayer?' <span style="font-size:10px;color:#fbbf24;">· LOCAL ONLY</span>':''))+(r.isMe?' <span style="font-size:10px;color:#22d3ee;">· YOU</span>':'')+'</td>' +
            '<td style="text-align:right;color:#cbd5e1;">W'+r.wave+'</td>' +
            '<td style="text-align:right;font-weight:700;">'+r.kills+'</td>' +
            '<td style="text-align:right;color:#34d399;">'+r.accuracy+'%</td>' +
            '<td style="text-align:right;color:#94a3b8;">'+fmtTime(r.survivalSec)+'</td>' +
            '<td style="text-align:right;font-weight:700;color:#fbbf24;">'+r.score.toLocaleString()+'</td></tr>';
        }).join('') + '</tbody></table>';
    }
    window.setLbTab = t => { lbTab = t; closeOpProfile(); renderLeaderboard(); };
    document.getElementById('lb-google-btn').onclick = async () => {
      const errBox = document.getElementById('lb-auth-err');
      if (errBox) errBox.style.display = 'none';
      try {
        await window.__GIS_CLOUD__.signIn();
        renderLeaderboard();
      } catch(e) {
        if (errBox) { errBox.innerText = (e && e.message) ? e.message : 'Google Sign-In failed.'; errBox.style.display = 'block'; }
      }
    };
    window.addEventListener('gis-cloud-update', () => {
      void tryAutoSyncLocalBest();
      if (document.getElementById('modal-leaderboard').style.display === 'flex') renderLeaderboard();
      if (document.getElementById('modal-profile').style.display === 'flex') { refreshProfileCloudUI(); runCallsignCheck(); }
      if (document.getElementById('modal-admin').style.display === 'flex') renderAdminConsole();
    });
    window.openOpProfile = idx => {
      const r = currentLbRows[idx];
      if (!r) return;
      const d = resolveOpProfile(r);
      const av = document.getElementById('op-avatar');
      av.style.backgroundColor = d.avatarColor;
      av.innerHTML = '<span>' + d.callsign.substring(0, 2).toUpperCase() + '</span><span style="position:absolute;bottom:6px;left:8px;right:8px;height:4px;border-radius:999px;background:rgba(2,6,23,0.45);"></span>';
      document.getElementById('op-rank-lvl').innerText = d.rankTitle + ' · LEVEL ' + d.level + (r.isCloud ? ' · CLOUD VERIFIED' : '');
      document.getElementById('op-flag').innerText = d.flag;
      document.getElementById('op-callsign').innerText = d.callsign;
      document.getElementById('op-sub').innerText = 'Rank #' + d.rank + ' · Wave ' + d.wave + ' · ' + fmtTime(d.survivalSec);
      document.getElementById('op-metrics').innerHTML = [
        ['Total Kills', d.kills, '#ffffff'],
        ['Headshot Ratio', d.hsRatio + '%', '#fbbf24'],
        ['Accuracy', d.accuracy + '%', '#34d399'],
        ['Record Score', d.score.toLocaleString(), '#67e8f9']
      ].map(([l, v, c]) => '<div class="card" style="background:#0C1017;padding:11px;"><div style="font-size:11px;color:#94a3b8;">'+l+'</div><div style="font-size:18px;font-weight:700;color:'+c+';margin-top:2px;">'+v+'</div></div>').join('');
      document.getElementById('op-fav-wep').innerText = d.favoriteWeapon;
      document.getElementById('modal-op-profile').style.display = 'flex';
    };
    function closeOpProfile() {
      document.getElementById('modal-op-profile').style.display = 'none';
    }
    function openLeaderboard() {
      if (state.inMenu) { AudioSys.startLobbyAmbient(); document.getElementById('main-menu').style.display = 'none'; }
      closeOpProfile();
      renderLeaderboard();
      document.getElementById('modal-leaderboard').style.display = 'flex';
    }
    function closeLeaderboard() {
      closeOpProfile();
      document.getElementById('modal-leaderboard').style.display = 'none';
      if (state.inMenu) closeModals();
    }
    document.getElementById('btn-leaderboard').onclick = openLeaderboard;
    document.getElementById('btn-go-leaderboard').onclick = openLeaderboard;
    document.getElementById('lb-close-x').onclick = closeLeaderboard;
    document.getElementById('lb-close-btn').onclick = closeLeaderboard;
    document.getElementById('op-close-x').onclick = closeOpProfile;
    document.getElementById('op-close-btn').onclick = closeOpProfile;
    document.getElementById('modal-op-profile').onclick = e => { if (e.target.id === 'modal-op-profile') closeOpProfile(); };
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && document.getElementById('modal-op-profile').style.display === 'flex') closeOpProfile();
    });

    function renderGameOver() {
      const acc = state.sShots > 0 ? Math.min(100, Math.round((state.sHits / state.sShots) * 100)) : 0;
      document.getElementById('go-sub').innerText = profile.callsign + ' · Wave ' + state.wave + ' · Time ' + fmtTime(state.survT);
      document.getElementById('go-stats').innerHTML =
        '<div class="grid-2" style="margin-bottom:8px;">' +
          '<div class="card" style="background:#0C1017;padding:10px;"><div style="font-size:10px;color:#94a3b8;">Final Score</div><div style="font-size:20px;font-weight:700;color:#fbbf24;">'+state.score.toLocaleString()+'</div></div>' +
          '<div class="card" style="background:#0C1017;padding:10px;"><div style="font-size:10px;color:#94a3b8;">Total XP Earned</div><div style="font-size:20px;font-weight:700;color:#22d3ee;">+'+state.sXp.toLocaleString()+' XP</div></div>' +
        '</div>' +
        '<div class="grid-3">' +
          '<div class="card" style="background:#0C1017;padding:9px;"><div style="font-size:10px;color:#94a3b8;">Kills</div><div style="font-size:16px;font-weight:700;">'+state.sKills+'</div></div>' +
          '<div class="card" style="background:#0C1017;padding:9px;"><div style="font-size:10px;color:#94a3b8;">Headshots</div><div style="font-size:16px;font-weight:700;color:#fcd34d;">'+state.sHs+'</div></div>' +
          '<div class="card" style="background:#0C1017;padding:9px;"><div style="font-size:10px;color:#94a3b8;">Accuracy</div><div style="font-size:16px;font-weight:700;color:#34d399;">'+acc+'%</div></div>' +
        '</div>';
      const sw = document.getElementById('go-submit-wrap');
      const cl = window.__GIS_CLOUD__;
      if (!state.submitted) {
        sw.innerHTML = '<button id="btn-submit-score" class="btn-primary" style="font-size:13px;padding:12px;">'+(cl && cl.user ? 'Submit Score to Global Cloud' : 'Submit Score to Leaderboard')+'</button>';
        document.getElementById('btn-submit-score').onclick = submitScore;
      } else {
        let html = '<div class="card" style="background:rgba(16,185,129,0.12);border-color:rgba(16,185,129,0.45);padding:10px 14px;font-size:12px;color:#6ee7b7;font-weight:700;text-align:left;">' +
          '<div>Score Logged · Rank #'+(state.subRank||'—')+' · Level '+profile.level+'</div>' +
          (cloudSyncMsg ? '<div class="font-mono" style="font-size:11px;color:#94a3b8;margin-top:4px;font-weight:500;">'+cloudSyncMsg+'</div>' : '') +
          (cloudSyncStatus === 'auth_required' ? '<button id="btn-go-cloud-signin" class="btn-sec" style="width:100%;margin-top:8px;color:#67e8f9;border-color:rgba(6,182,212,0.45);">Sign In with Google &amp; Sync to Global Cloud</button><div id="go-auth-err" class="font-mono" style="display:none;margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(136,19,55,0.5);border:1px solid rgba(244,63,94,0.45);color:#fecdd3;font-size:11px;line-height:1.45;"></div>' : '') +
        '</div>';
        sw.innerHTML = html;
        const gBtn = document.getElementById('btn-go-cloud-signin');
        if (gBtn) {
          gBtn.onclick = async () => {
            const errBox = document.getElementById('go-auth-err');
            if (errBox) errBox.style.display = 'none';
            try {
              await cl.signIn();
              if (lastSavedMatchRec) {
                cloudSyncStatus = 'syncing'; cloudSyncMsg = 'Syncing to Global Cloud...'; renderGameOver();
                const res = await cl.upsertScore(lastSavedMatchRec);
                cloudSyncStatus = res.status; cloudSyncMsg = res.message; renderGameOver();
              }
            } catch(e) {
              if (errBox) { errBox.innerText = (e && e.message) ? e.message : 'Google Sign-In failed.'; errBox.style.display = 'block'; }
            }
          };
        }
      }
    }
    async function submitScore() {
      if (!state.dead || state.submitted) return;
      const acc = state.sShots > 0 ? Math.min(100, Math.round((state.sHits / state.sShots) * 100)) : 0;
      const xpB = 50 + state.wave * 15;
      state.sXp += xpB; profile.xp += xpB;
      while (profile.xp >= profile.level * 250) { profile.xp -= profile.level * 250; profile.level++; }
      if (state.score > profile.highScore) profile.highScore = state.score;
      const saved = saveLocalLb({ callsign: profile.callsign, countryCode: 'ID', flag: '🇮🇩', kills: state.sKills, headshots: state.sHs, accuracy: acc, survivalSec: Math.round(state.survT), wave: state.wave, score: state.score, xpEarned: state.sXp, level: profile.level, avatarColor: profile.accentColor, favoriteWeapon: getMatchFavWeapon() });
      lastSavedMatchRec = saved;
      const brd = getMergedLb('global');
      const ri = brd.rows.findIndex(r => r.id === saved.id);
      state.submitted = true; state.subRank = ri >= 0 ? ri + 1 : (brd.bestRank || 100);
      cloudSyncStatus = 'syncing'; cloudSyncMsg = 'Syncing to Global Cloud...';
      AudioSys.scoreSubmit(); saveProfile(); renderGameOver();
      const res = await window.__GIS_CLOUD__.upsertScore(saved);
      cloudSyncStatus = res.status; cloudSyncMsg = res.message;
      renderGameOver();
    }

    document.getElementById('inv-close').onclick = () => { state.invOpen = false; closeModals(); requestPointerLockSafe(); };
    document.getElementById('btn-resume').onclick = () => { closeModals(); requestPointerLockSafe(); };
    document.getElementById('btn-restart').onclick = () => startMatch(1, true);
    document.getElementById('btn-redeploy').onclick = () => startMatch(1, true);
    function goMainMenu() {
      AudioSys.bossMusicStop(); setBossAtmo(false); clearBossHazards();
      state.inMenu = true; state.paused = true; weaponRig.visible = false;
      document.getElementById('hud').style.display = 'none';
      closeModals(); AudioSys.startLobbyAmbient();
      refreshMenuUI();
    }
    document.getElementById('btn-tomenu').onclick = goMainMenu;
    document.getElementById('btn-go-menu').onclick = goMainMenu;

    // Patch Notes Modal Handlers
    function openPatchNotes() {
      if (state.inMenu) { AudioSys.startLobbyAmbient(); document.getElementById('main-menu').style.display = 'none'; }
      document.getElementById('modal-patchnotes').style.display = 'flex';
    }
    function closePatchNotes() {
      document.getElementById('modal-patchnotes').style.display = 'none';
      if (state.inMenu) closeModals();
    }
    document.getElementById('btn-patch-notes').onclick = openPatchNotes;
    document.getElementById('pn-close-x').onclick = closePatchNotes;
    document.getElementById('pn-close-btn').onclick = closePatchNotes;
    document.getElementById('modal-patchnotes').onclick = e => { if (e.target.id === 'modal-patchnotes') closePatchNotes(); };

    // Secret Admin Panel & PIN Gate Logic
    let admLbTab = 'global', admLbQuery = '';
    function setAdminNotice(msg) {
      adminNotice = msg;
      const el = document.getElementById('adm-notice');
      if (el) el.innerText = msg;
    }
    function openAdminGate() {
      if (!state.inMenu && !state.paused && !state.dead) {
        state.paused = true; mouseDown = false; state.aiming = false; state.scoped = false;
        if (document.pointerLockElement) document.exitPointerLock();
        syncGraphicsUI();
        document.getElementById('modal-pause').style.display = 'flex';
      }
      adminOpen = true;
      if (adminUnlocked) {
        document.getElementById('modal-admin-pin').style.display = 'none';
        renderAdminConsole();
        document.getElementById('modal-admin').style.display = 'flex';
      } else {
        document.getElementById('adm-pin-err').innerText = '';
        document.getElementById('adm-pin-input').value = '';
        document.getElementById('modal-admin-pin').style.display = 'flex';
        setTimeout(() => document.getElementById('adm-pin-input').focus(), 40);
      }
    }
    function closeAdminConsole() {
      adminOpen = false;
      document.getElementById('modal-admin-pin').style.display = 'none';
      document.getElementById('modal-admin').style.display = 'none';
    }
    function renderAdminConsole() {
      const sub = document.getElementById('adm-subtitle');
      const hostCnt = enemies.filter(e => !e.isDead).length + (boss && !boss.isDead ? 1 : 0);
      if (sub) sub.innerText = 'Operative: ' + profile.callsign + ' · Lvl ' + profile.level + ' · ' + (state.inMenu ? 'Hangar Lobby' : 'Wave ' + state.wave + ' (' + hostCnt + ' Hostiles)');
      document.getElementById('adm-tabs').innerHTML = [['wave','Wave & Boss'],['cheats','Player Cheats'],['leaderboard','Leaderboard & Ban']].map(([id, lbl]) =>
        '<button type="button" onclick="setAdmTab(\\'' + id + '\\')" class="adm-tab ' + (adminTab === id ? 'active' : '') + '">' + lbl + '</button>'
      ).join('');
      const body = document.getElementById('adm-body');
      if (adminTab === 'wave') {
        const disabledKill = (state.inMenu || state.dead) ? 'disabled style="opacity:0.45;cursor:not-allowed;"' : '';
        body.innerHTML =
          '<div class="grid-3" style="margin-bottom:16px;">' +
            '<button onclick="admSkipWave()" class="card" style="background:#0C1017;text-align:left;cursor:pointer;border-color:#334155;"><div class="font-display" style="font-size:14px;font-weight:700;color:#fff;margin-bottom:4px;">Skip Wave</div><div style="font-size:11px;color:#94a3b8;">Immediately jump to the next wave.</div></button>' +
            '<button onclick="admSummonBoss()" class="card" style="background:#0C1017;text-align:left;cursor:pointer;border-color:rgba(244,63,94,0.5);"><div class="font-display" style="font-size:14px;font-weight:700;color:#fda4af;margin-bottom:4px;">Summon Boss (Wave 10)</div><div style="font-size:11px;color:#94a3b8;">Spawn The Specialist Anestesi anytime.</div></button>' +
            '<button onclick="admKillAll()" ' + disabledKill + ' class="card" style="background:#0C1017;text-align:left;cursor:pointer;border-color:rgba(245,158,11,0.45);"><div class="font-display" style="font-size:14px;font-weight:700;color:#fcd34d;margin-bottom:4px;">Kill All Hostiles</div><div style="font-size:11px;color:#94a3b8;">Eliminate all living bots &amp; Boss on map.</div></button>' +
          '</div>' +
          '<div class="grid-4 font-mono">' +
            '<div class="card" style="background:#0C1017;padding:10px;"><div style="font-size:10px;color:#94a3b8;">Wave</div><div style="font-size:17px;font-weight:700;color:#22d3ee;">' + (state.inMenu ? 'LOBBY' : 'W' + state.wave) + '</div></div>' +
            '<div class="card" style="background:#0C1017;padding:10px;"><div style="font-size:10px;color:#94a3b8;">Hostiles</div><div style="font-size:17px;font-weight:700;">' + hostCnt + '</div></div>' +
            '<div class="card" style="background:#0C1017;padding:10px;"><div style="font-size:10px;color:#94a3b8;">Boss</div><div style="font-size:17px;font-weight:700;color:#fb7185;">' + (boss && !boss.isDead ? 'ACTIVE' : 'STANDBY') + '</div></div>' +
            '<div class="card" style="background:#0C1017;padding:10px;"><div style="font-size:10px;color:#94a3b8;">Score</div><div style="font-size:17px;font-weight:700;color:#34d399;">' + state.score.toLocaleString() + '</div></div>' +
          '</div>';
      } else if (adminTab === 'cheats') {
        body.innerHTML =
          '<div class="grid-2" style="margin-bottom:14px;">' +
            '<button onclick="admToggleGod()" class="card" style="background:' + (adminCheats.godMode ? 'rgba(6,78,59,0.45)' : '#0C1017') + ';border-color:' + (adminCheats.godMode ? 'rgba(16,185,129,0.65)' : '#1e293b') + ';text-align:left;cursor:pointer;display:flex;justify-content:space-between;align-items:center;"><div><div class="font-display" style="font-size:14px;font-weight:700;color:#fff;">God Mode (Invincible)</div><div style="font-size:11px;color:#94a3b8;">Zero HP &amp; Armor loss from attacks</div></div><strong class="font-mono" style="color:' + (adminCheats.godMode ? '#34d399' : '#64748b') + ';">' + (adminCheats.godMode ? 'ON' : 'OFF') + '</strong></button>' +
            '<button onclick="admToggleInf()" class="card" style="background:' + (adminCheats.infiniteAmmo ? 'rgba(8,47,73,0.55)' : '#0C1017') + ';border-color:' + (adminCheats.infiniteAmmo ? 'rgba(6,182,212,0.65)' : '#1e293b') + ';text-align:left;cursor:pointer;display:flex;justify-content:space-between;align-items:center;"><div><div class="font-display" style="font-size:14px;font-weight:700;color:#fff;">Infinite Ammo &amp; No Reload</div><div style="font-size:11px;color:#94a3b8;">Unlimited mags, grenades &amp; medkits</div></div><strong class="font-mono" style="color:' + (adminCheats.infiniteAmmo ? '#22d3ee' : '#64748b') + ';">' + (adminCheats.infiniteAmmo ? 'ON' : 'OFF') + '</strong></button>' +
          '</div>' +
          '<div class="card" style="background:#0C1017;margin-bottom:14px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><strong class="font-display" style="font-size:14px;">Speed &amp; Jump Multiplier</strong><button onclick="admResetMult()" class="btn-sec" style="padding:4px 10px;">Reset 1.0x</button></div>' +
            '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;"><span>Movement Speed</span><strong id="adm-spd-v" class="font-mono" style="color:#fbbf24;">' + adminCheats.speedMult.toFixed(1) + 'x</strong></div>' +
            '<input type="range" min="1.0" max="3.0" step="0.1" value="' + adminCheats.speedMult + '" oninput="admSetSpd(this.value)" style="margin-bottom:10px;"/>' +
            '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;"><span>Jump Height</span><strong id="adm-jmp-v" class="font-mono" style="color:#22d3ee;">' + adminCheats.jumpMult.toFixed(1) + 'x</strong></div>' +
            '<input type="range" min="1.0" max="2.5" step="0.1" value="' + adminCheats.jumpMult + '" oninput="admSetJmp(this.value)"/>' +
          '</div>' +
          '<div class="card" style="background:#0C1017;border-color:rgba(245,158,11,0.4);display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;">' +
            '<div><div class="font-display" style="font-size:14px;font-weight:700;color:#fff;">Max XP &amp; Unlock All</div><div class="font-mono" style="font-size:11px;color:#94a3b8;">Lvl ' + profile.level + ' (' + profile.xp.toLocaleString() + ' XP) · ' + (profile.allUnlocked ? 'All Unlocked' : 'Standard') + '</div></div>' +
            '<button onclick="admGrantMaxXp()" class="btn-primary" style="width:auto;background:#f59e0b;font-size:12px;padding:10px 16px;">+50,000 XP &amp; Unlock All</button>' +
          '</div>';
      } else {
        const brd = getMergedLb(admLbTab);
        const q = admLbQuery.trim().toUpperCase();
        const rows = (q ? brd.rows.filter(r => r.callsign.toUpperCase().includes(q)) : brd.rows).slice(0, 40);
        const banned = loadBanned();
        body.innerHTML =
          '<form onsubmit="admAddScore(event)" class="card" style="background:#0C1017;margin-bottom:12px;">' +
            '<div class="font-display" style="font-size:13px;font-weight:700;margin-bottom:8px;">Add / Edit Custom Score</div>' +
            '<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr auto;gap:8px;align-items:end;">' +
              '<div><div style="font-size:10px;color:#94a3b8;margin-bottom:3px;">Callsign</div><input id="adm-cs-in" type="text" maxlength="16" value="' + profile.callsign + '" style="padding:7px 10px;font-size:12px;"/></div>' +
              '<div><div style="font-size:10px;color:#94a3b8;margin-bottom:3px;">Score</div><input id="adm-sc-in" type="number" min="0" value="25000" style="width:100%;padding:7px 8px;border-radius:8px;border:1px solid #334155;background:#0C1017;color:#fcd34d;font-size:12px;"/></div>' +
              '<div><div style="font-size:10px;color:#94a3b8;margin-bottom:3px;">Wave</div><input id="adm-wv-in" type="number" min="1" max="99" value="10" style="width:100%;padding:7px 8px;border-radius:8px;border:1px solid #334155;background:#0C1017;color:#fff;font-size:12px;"/></div>' +
              '<div><div style="font-size:10px;color:#94a3b8;margin-bottom:3px;">Kills</div><input id="adm-kl-in" type="number" min="0" value="64" style="width:100%;padding:7px 8px;border-radius:8px;border:1px solid #334155;background:#0C1017;color:#fff;font-size:12px;"/></div>' +
              '<div><div style="font-size:10px;color:#94a3b8;margin-bottom:3px;">Acc%</div><input id="adm-ac-in" type="number" min="0" max="100" value="78" style="width:100%;padding:7px 8px;border-radius:8px;border:1px solid #334155;background:#0C1017;color:#34d399;font-size:12px;"/></div>' +
              '<button type="submit" class="btn-primary" style="width:auto;font-size:12px;padding:8px 14px;">Save</button>' +
            '</div>' +
          '</form>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;">' +
            '<div class="lb-tabs">' + ['global','weekly','personal'].map(t => '<button type="button" onclick="setAdmLbTab(\\'' + t + '\\')" class="lb-tab ' + (admLbTab === t ? 'active' : '') + '" style="text-transform:capitalize;">' + t + '</button>').join('') + '</div>' +
            '<input type="text" placeholder="Search callsign..." value="' + admLbQuery + '" oninput="setAdmLbQ(this.value)" style="max-width:210px;padding:7px 10px;font-size:12px;"/>' +
          '</div>' +
          '<div class="card" style="background:#0C1017;padding:0;overflow:hidden;margin-bottom:12px;"><div style="max-height:220px;overflow-y:auto;">' +
            '<table class="lb-table font-mono"><thead><tr><th>Rank</th><th>Callsign</th><th style="text-align:right;">Wave</th><th style="text-align:right;">Score</th><th style="text-align:right;">Action</th></tr></thead><tbody>' +
            (rows.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:#64748b;padding:24px;">No entries found.</td></tr>' :
              rows.map(r => '<tr><td style="color:#94a3b8;">#' + r.rank + '</td><td>' + r.flag + ' <strong>' + r.callsign + '</strong></td><td style="text-align:right;">W' + r.wave + '</td><td style="text-align:right;color:#fbbf24;font-weight:700;">' + r.score.toLocaleString() + '</td><td style="text-align:right;"><button onclick="admBanEntry(\\'' + r.id + '\\',\\'' + r.callsign.replace(/'/g,'') + '\\')" class="btn-sec" style="padding:4px 8px;font-size:11px;color:#fda4af;border-color:rgba(244,63,94,0.45);">Ban / Remove</button></td></tr>').join('')) +
            '</tbody></table></div></div>' +
          (banned.length > 0 ? '<div class="card" style="background:#0C1017;"><div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span class="font-mono" style="font-size:11px;color:#fb7185;font-weight:700;">BANNED CALLSIGNS (' + banned.length + ')</span><button onclick="admClearBans()" class="btn-sec" style="padding:3px 10px;font-size:11px;">Restore All</button></div><div style="display:flex;flex-wrap:wrap;gap:6px;">' + banned.map(b => '<button onclick="admUnban(\\'' + b + '\\')" class="btn-sec" style="padding:4px 10px;font-size:11px;">' + b + ' · Unban</button>').join('') + '</div></div>' : '');
      }
    }
    window.setAdmTab = t => { adminTab = t; renderAdminConsole(); };
    window.setAdmLbTab = t => { admLbTab = t; renderAdminConsole(); };
    window.setAdmLbQ = v => { admLbQuery = v; renderAdminConsole(); };
    window.admSkipWave = () => {
      if (state.inMenu) { startMatch(2, false); setAdminNotice('Deployed to Wave 2.'); }
      else if (!state.dead) { waveWait = 0; spawnWave(state.wave + 1); setAdminNotice('Skipped to Wave ' + state.wave + '.'); }
      renderAdminConsole();
    };
    window.admSummonBoss = () => {
      if (state.inMenu) startMatch(10, false);
      else if (!state.dead) { waveWait = 0; spawnWave(10); }
      setAdminNotice('Boss The Specialist Anestesi summoned.');
      renderAdminConsole();
    };
    window.admKillAll = () => {
      if (state.inMenu || state.dead) return 0;
      let cnt = 0;
      enemies.filter(b => !b.isDead).forEach(b => { cnt++; eliminateBot(b, true, 'ADMIN-CMD'); });
      if (boss && !boss.isDead) { cnt++; eliminateBoss('ADMIN-CMD', 'weakspot'); }
      updateHUD(); setAdminNotice('Eliminated ' + cnt + ' hostile(s).'); renderAdminConsole();
      return cnt;
    };
    window.nextWave = w => {
      if (typeof w === 'number' && isFinite(w) && w >= 1) {
        if (state.inMenu) startMatch(Math.floor(w), false);
        else if (!state.dead) { waveWait = 0; spawnWave(Math.floor(w)); }
      } else {
        window.admSkipWave();
      }
    };
    window.summonBoss = () => window.admSummonBoss();
    window.killAllHostiles = () => window.admKillAll();
    window.admToggleGod = () => {
      adminCheats.godMode = !adminCheats.godMode;
      if (adminCheats.godMode) { state.hp = 100; state.ap = 100; }
      updateHUD(); setAdminNotice('God Mode ' + (adminCheats.godMode ? 'ENABLED' : 'DISABLED')); renderAdminConsole();
    };
    window.admToggleInf = () => {
      adminCheats.infiniteAmmo = !adminCheats.infiniteAmmo;
      if (adminCheats.infiniteAmmo) { state.reloading = false; state.weapons.forEach(w => { w.currentAmmo = w.type==='medkit'||w.type==='grenade' ? w.maxReserve : w.magSize; if (w.maxReserve) w.reserveAmmo = w.maxReserve; }); }
      updateHUD(); setAdminNotice('Infinite Ammo ' + (adminCheats.infiniteAmmo ? 'ENABLED' : 'DISABLED')); renderAdminConsole();
    };
    window.admSetSpd = v => { adminCheats.speedMult = parseFloat(v); const el = document.getElementById('adm-spd-v'); if (el) el.innerText = adminCheats.speedMult.toFixed(1) + 'x'; updateHUD(); };
    window.admSetJmp = v => { adminCheats.jumpMult = parseFloat(v); const el = document.getElementById('adm-jmp-v'); if (el) el.innerText = adminCheats.jumpMult.toFixed(1) + 'x'; updateHUD(); };
    window.admResetMult = () => { adminCheats.speedMult = 1.0; adminCheats.jumpMult = 1.0; updateHUD(); setAdminNotice('Multipliers reset to 1.0x'); renderAdminConsole(); };
    window.admGrantMaxXp = () => {
      profile.xp += 50000; state.sXp += 50000;
      while (profile.xp >= profile.level * 250) { profile.xp -= profile.level * 250; profile.level++; }
      profile.allUnlocked = true;
      ['SPECIALIST_SLAYER','ARSENAL_MASTER','ADMIN_OVERDRIVE'].forEach(a => { if (!profile.achievements.includes(a)) profile.achievements.push(a); });
      state.weapons.forEach(w => { w.currentAmmo = w.type==='medkit'||w.type==='grenade' ? w.maxReserve : w.magSize; if (w.maxReserve) w.reserveAmmo = w.maxReserve; });
      saveProfile(); updateHUD(); setAdminNotice('+50,000 XP granted & all unlocked.'); renderAdminConsole();
    };
    window.admBanEntry = async (id, cs) => {
      banOrRemoveEntry(id, cs);
      if (String(id).startsWith('cloud_') && window.__GIS_CLOUD__ && window.__GIS_CLOUD__.user) {
        try { await window.__GIS_CLOUD__.deleteScore(id); } catch(e) {}
      }
      setAdminNotice('Banned & removed ' + cs); renderAdminConsole();
    };
    window.admUnban = cs => { unbanEntryCallsign(cs); setAdminNotice('Unbanned ' + cs); renderAdminConsole(); };
    window.admClearBans = () => { clearAllBans(); setAdminNotice('Restored all entries.'); renderAdminConsole(); };
    window.admAddScore = async e => {
      e.preventDefault();
      const rec = addCustomLbScore(document.getElementById('adm-cs-in').value, Number(document.getElementById('adm-sc-in').value)||0, Number(document.getElementById('adm-wv-in').value)||1, Number(document.getElementById('adm-kl-in').value)||0, Number(document.getElementById('adm-ac-in').value)||0);
      if (window.__GIS_CLOUD__ && window.__GIS_CLOUD__.user) {
        try {
          const res = await window.__GIS_CLOUD__.upsertScore(rec, true);
          setAdminNotice(res && res.status === 'error' ? ('Local saved · Cloud: ' + res.message) : ('Saved to Global Cloud & Local: ' + rec.callsign));
          renderAdminConsole();
          return;
        } catch(ex) {}
      }
      setAdminNotice('Saved locally only for ' + rec.callsign + ' (Sign in with Google to sync globally)'); renderAdminConsole();
    };

    document.getElementById('btn-menu-admin').onclick = openAdminGate;
    document.getElementById('btn-pause-admin').onclick = openAdminGate;
    document.getElementById('adm-pin-close-x').onclick = closeAdminConsole;
    document.getElementById('adm-pin-cancel').onclick = closeAdminConsole;
    document.getElementById('adm-close-x').onclick = closeAdminConsole;
    document.getElementById('adm-lock-btn').onclick = () => { adminUnlocked = false; closeAdminConsole(); openAdminGate(); };
    document.getElementById('modal-admin-pin').onclick = e => { if (e.target.id === 'modal-admin-pin') closeAdminConsole(); };
    document.getElementById('modal-admin').onclick = e => { if (e.target.id === 'modal-admin') closeAdminConsole(); };
    document.getElementById('adm-pin-form').onsubmit = e => {
      e.preventDefault();
      const inp = document.getElementById('adm-pin-input');
      if ((inp.value || '').trim() === ADMIN_PIN) {
        adminUnlocked = true; inp.value = '';
        document.getElementById('modal-admin-pin').style.display = 'none';
        renderAdminConsole();
        document.getElementById('modal-admin').style.display = 'flex';
      } else {
        document.getElementById('adm-pin-err').innerText = 'Invalid Admin PIN. Access denied.';
        inp.value = '';
      }
    };

    let adminKeyBuf = '';
    window.addEventListener('keydown', e => {
      const t = e.target;
      const inInput = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
      if (e.shiftKey && e.key === 'F12') {
        e.preventDefault();
        if (adminOpen) closeAdminConsole(); else openAdminGate();
        return;
      }
      if (e.key === 'Escape') {
        if (adminOpen) { closeAdminConsole(); return; }
        if (document.getElementById('modal-patchnotes').style.display === 'flex') { closePatchNotes(); return; }
      }
      if (inInput) return;
      if ((state.inMenu || state.paused) && e.key && e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
        adminKeyBuf = (adminKeyBuf + e.key.toLowerCase()).slice(-8);
        if (adminKeyBuf === 'gisadmin') { adminKeyBuf = ''; openAdminGate(); }
      } else if (e.key && e.key.length === 1) adminKeyBuf = '';
    }, true);

    refreshMenuUI();

    // =========================================================================
    // 11. MAIN SIMULATION & RENDER LOOP
    // =========================================================================
    const clock = new THREE.Clock();
    const rcLOS = new THREE.Raycaster();

    function hurtStandalonePlayer(dmgAmt) {
      if (state.dead || adminCheats.godMode) return;
      AudioSys.hurt(); state.dmgVignette = 0.8;
      let dmg = dmgAmt;
      if (state.ap > 0) { const ab = Math.min(state.ap, dmg*0.65); state.ap -= ab; dmg -= ab; }
      state.hp = Math.max(0, state.hp - dmg);
      if (state.hp <= 0) {
        state.dead = true; state.scoped = false;
        AudioSys.bossMusicStop(); setBossAtmo(false);
        document.exitPointerLock();
        state.score += Math.round(state.survT * 2);
        if (state.score > profile.highScore) profile.highScore = state.score;
        saveProfile(); renderGameOver();
        document.getElementById('modal-gameover').style.display = 'flex';
      }
    }

    let fpsFrames = 0, fpsLast = performance.now();
    function animate() {
      requestAnimationFrame(animate);
      fpsFrames++;
      const nowMs = performance.now();
      const fpsElap = nowMs - fpsLast;
      if (fpsElap >= 250) {
        const fpsVal = Math.max(1, Math.round((fpsFrames * 1000) / fpsElap));
        fpsFrames = 0; fpsLast = nowMs;
        const fvEl = document.getElementById('fps-val'), fsEl = document.getElementById('fps-status');
        if (fvEl && fsEl) {
          fvEl.innerText = fpsVal + ' FPS';
          if (fpsVal >= 50) { fvEl.style.color = '#34d399'; fsEl.innerText = 'OPTIMAL'; }
          else if (fpsVal >= 30) { fvEl.style.color = '#fbbf24'; fsEl.innerText = 'STABLE'; }
          else { fvEl.style.color = '#fb7185'; fsEl.innerText = 'LOW'; }
        }
      }
      const dt = Math.min(clock.getDelta(), 0.1);

      if (state.inMenu) {
        lobbyTime += dt;
        if (!lobbyDrag) turntable.rotation.y += dt * 0.18;
        const br = Math.sin(lobbyTime * 2.1);
        opTorso.position.y = 1.0 + br * 0.008;
        opHead.rotation.y = Math.sin(lobbyTime * 0.65) * 0.14;
        holoWire.rotation.y += dt * 0.45;
        drone.position.y = 2.85 + Math.sin(lobbyTime * 1.6) * 0.22;
        drone.position.x = 3.85 + Math.sin(lobbyTime * 0.7) * 0.35;
        dRotors.forEach(r => r.rotation.z += dt * 18);
        const bp = 0.85 + (0.6 + 0.4*Math.sin(lobbyTime*2.8))*0.35;
        lobbyBeacons.forEach(b => b.scale.setScalar(bp));

        const pr = LOBBY_PRESETS[lobbyMode];
        const a = 1 - Math.exp(-7.5 * dt);
        lAz = THREE.MathUtils.lerp(lAz, pr.az + uAzOff, a);
        lEl = THREE.MathUtils.lerp(lEl, Math.max(-0.05, Math.min(0.72, pr.el + uElOff)), a);
        lDist = THREE.MathUtils.lerp(lDist, Math.max(1.35, Math.min(9.2, pr.dist + uDistOff)), a);
        lTgt.lerp(new THREE.Vector3(pr.tx, pr.ty, pr.tz), a);
        lobbyCam.fov = THREE.MathUtils.lerp(lobbyCam.fov, pr.fov, a);
        lobbyCam.updateProjectionMatrix();
        const hz = Math.cos(lEl) * lDist;
        lobbyCam.position.set(lTgt.x + Math.sin(lAz)*hz, lTgt.y + Math.sin(lEl)*lDist, lTgt.z + Math.cos(lAz)*hz);
        lobbyCam.lookAt(lTgt);
        renderer.render(lobbyScene, lobbyCam);
        return;
      }

      energyCores.forEach(c => c.rotation.y += dt * 0.9);
      if (bossAlarmGroup.visible) {
        if (profile.graphicsPreset === 'potato') {
          bossAlarmLights.forEach(l => l.intensity = 0);
        } else {
          const bp = 12 + Math.sin(nowMs*0.012)*10;
          bossAlarmLights.forEach((l,i) => l.intensity = Math.max(4, bp*(i===0?1:0.85)));
        }
      }
      if (!state.paused && !state.dead && !state.invOpen) {
        state.survT += dt;
        if (state.bannerT > 0) state.bannerT = Math.max(0, state.bannerT - dt);
        // Movement Physics
        const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
        const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0,1,0)).normalize();
        const move = new THREE.Vector3();
        if (keys['KeyW']) move.add(fwd); if (keys['KeyS']) move.sub(fwd);
        if (keys['KeyD']) move.add(right); if (keys['KeyA']) move.sub(right);
        const moving = move.lengthSq() > 0.001; if (moving) move.normalize();
        const sprint = keys['ShiftLeft'] && keys['KeyW'] && !state.aiming && !state.crouching;
        let spd = state.aiming ? 3.1 : state.crouching ? 3.35 : sprint ? 8.6 : 5.6;
        if (state.slowT > 0) { state.slowT = Math.max(0, state.slowT - dt); spd *= 0.62; }
        spd *= adminCheats.speedMult;
        if (waveWait > 0 && state.hp < 100) state.hp = Math.min(100, state.hp + 2.5 * dt);
        const prevEye = state.eyeH;
        state.eyeH = THREE.MathUtils.lerp(state.eyeH, state.crouching ? 1.12 : 1.75, Math.min(1, dt * 14));
        const curFeet = playerPos.y - prevEye;

        playerVel.x = THREE.MathUtils.lerp(playerVel.x, move.x * spd, Math.min(1, dt * 15));
        playerVel.z = THREE.MathUtils.lerp(playerVel.z, move.z * spd, Math.min(1, dt * 15));
        playerVel.y -= 20 * dt;

        let gH = 0;
        collisions.forEach(c => {
          if (c.type === 'ramp' && c.heightAt && playerPos.x >= c.box.min.x && playerPos.x <= c.box.max.x && playerPos.z >= c.box.min.z && playerPos.z <= c.box.max.z) {
            gH = Math.max(gH, c.heightAt(playerPos.x, playerPos.z));
          } else if (c.type === 'platform' && playerPos.x >= c.box.min.x && playerPos.x <= c.box.max.x && playerPos.z >= c.box.min.z && playerPos.z <= c.box.max.z && curFeet >= c.box.max.y - 0.55) {
            gH = Math.max(gH, c.box.max.y);
          }
        });

        const nx = playerPos.x + playerVel.x * dt, nz = playerPos.z + playerVel.z * dt;
        let okX = true, okZ = true;
        collisions.forEach(c => {
          if (c.type === 'ramp' || (c.type === 'platform' && curFeet >= c.box.max.y - 0.35)) return;
          if (curFeet < c.box.max.y) {
            if (nx >= c.box.min.x-0.45 && nx <= c.box.max.x+0.45 && playerPos.z >= c.box.min.z-0.45 && playerPos.z <= c.box.max.z+0.45) okX = false;
            if (playerPos.x >= c.box.min.x-0.45 && playerPos.x <= c.box.max.x+0.45 && nz >= c.box.min.z-0.45 && nz <= c.box.max.z+0.45) okZ = false;
          }
        });
        if (okX) playerPos.x = nx; if (okZ) playerPos.z = nz;
        playerPos.y = curFeet + state.eyeH + playerVel.y * dt;
        if (playerPos.y <= gH + state.eyeH) { playerPos.y = gH + state.eyeH; playerVel.y = 0; grounded = true; } else grounded = false;
        camera.position.copy(playerPos);

        if (moving && grounded) {
          stepDist += Math.hypot(playerVel.x, playerVel.z) * dt;
          if (stepDist >= (sprint ? 2.25 : 1.65)) { stepDist = 0; AudioSys.step(sprint); }
        }
        if (state.hp > 0 && state.hp <= 25) { lowHpT -= dt; if (lowHpT <= 0) { lowHpT = 1.6; AudioSys.lowHp(); } }

        // Weapons, Swap Transition, Moving Parts & Laser Sight
        if (state.shootCd > 0) state.shootCd -= dt;
        if (state.swapPhase === 'unequip') {
          state.swapT += dt;
          const sp = Math.min(1, state.swapT / 0.13);
          state.swapY = -0.34 * sp;
          if (sp >= 1) {
            applyEquipSlot(state.pendingSlot);
            state.swapPhase = 'equip'; state.swapT = 0; state.swapY = -0.34; state.swapVelY = 0;
          }
        } else if (state.swapPhase === 'equip') {
          state.swapT += dt;
          const force = -state.swapY * 260 - state.swapVelY * 24;
          state.swapVelY += force * dt; state.swapY += state.swapVelY * dt;
          if (state.swapT >= 0.24 && Math.abs(state.swapY) < 0.004) { state.swapPhase = 'idle'; state.swapY = state.swapVelY = 0; }
        }

        const w = state.weapons[state.slot];
        if (mouseDown && (w.type === 'rifle' || w.type === 'smg') && state.shootCd <= 0 && state.swapPhase !== 'unequip') triggerShoot();
        if (state.reloading) {
          state.reloadT += dt;
          if (state.reloadT >= w.reloadTime) {
            const need = w.magSize - w.currentAmmo, take = Math.min(need, w.reserveAmmo);
            w.currentAmmo += take; w.reserveAmmo -= take; state.reloading = false;
            if (state.aiming && w.type === 'sniper') state.scoped = true;
            updateHUD();
          }
        }
        const tFov = (state.aiming && !state.reloading && state.swapPhase !== 'unequip') ? w.adsFov : profile.baseFov;
        camera.fov = THREE.MathUtils.lerp(camera.fov, tFov, Math.min(1, dt * 12));
        camera.updateProjectionMatrix();
        const actVm = viewmodels[w.id];
        if (actVm) actVm.visible = !state.scoped;

        swayX = THREE.MathUtils.lerp(swayX, 0, Math.min(1, dt * 10));
        swayY = THREE.MathUtils.lerp(swayY, 0, Math.min(1, dt * 10));
        if (moving && grounded) bobT += dt * (sprint ? 14 : 9);
        const bobX = (moving && grounded) ? Math.sin(bobT*0.5)*0.012 : 0;
        const bobY = (moving && grounded) ? Math.abs(Math.sin(bobT))*0.012 : 0;
        state.recoilPitch = THREE.MathUtils.lerp(state.recoilPitch, 0, Math.min(1, dt * 14));
        state.recoilZ = THREE.MathUtils.lerp(state.recoilZ, 0, Math.min(1, dt * 16));
        if (state.boltKick > 0) state.boltKick = Math.max(0, state.boltKick - dt * 14);
        if (state.pumpAnim > 0) {
          state.pumpAnim = Math.max(0, state.pumpAnim - dt * 2.8);
          const pSlide = viewmodels['sg_12'].getObjectByName('pump');
          if (pSlide) pSlide.position.z = -0.34 + Math.sin(state.pumpAnim * Math.PI) * 0.095;
        }
        if (actVm) {
          const boltObj = actVm.getObjectByName('bolt');
          if (boltObj) {
            const holdOpen = (w.type !== 'grenade' && w.type !== 'medkit' && w.currentAmmo === 0 && !state.reloading) ? 0.86 : 0;
            const bf = Math.max(holdOpen, Math.sin(state.boltKick * Math.PI));
            boltObj.position.z = boltObj.userData.baseZ + boltObj.userData.travel * bf;
          }
          const chObj = actVm.getObjectByName('ch');
          if (chObj) {
            let pf = 0;
            if (state.reloading) {
              const rp = state.reloadT / Math.max(0.01, w.reloadTime);
              if (rp > 0.62 && rp < 0.94) pf = Math.sin(((rp - 0.62) / 0.32) * Math.PI);
            }
            chObj.position.z = chObj.userData.baseZ + chObj.userData.travel * pf;
          }
          const fLens = actVm.getObjectByName('flashLens');
          if (fLens) fLens.material.emissiveIntensity = state.flashlight ? 2.4 : 0.1;

          const showLas = w.type !== 'grenade' && w.type !== 'medkit' && !state.reloading && !state.scoped && state.swapPhase === 'idle';
          const la = actVm.getObjectByName('laserAnchor'), lb = actVm.getObjectByName('laserBeam');
          if (lb) lb.visible = showLas;
          if (showLas && la && lb) {
            const ls = new THREE.Vector3(), lq = new THREE.Quaternion();
            la.getWorldPosition(ls); la.getWorldQuaternion(lq);
            const ld = new THREE.Vector3(0,0,-1).applyQuaternion(lq).normalize();
            rcLOS.set(ls, ld); rcLOS.far = 28;
            const lh = rcLOS.intersectObjects(obstacleMeshes, false);
            if (lh.length > 0) { lb.scale.z = Math.max(0.2, lh[0].distance); laserDot.position.copy(lh[0].point).addScaledVector(ld, -0.02); laserDot.visible = true; }
            else { lb.scale.z = 22; laserDot.visible = false; }
          } else laserDot.visible = false;
        } else laserDot.visible = false;

        const rDip = state.reloading ? Math.sin((state.reloadT/w.reloadTime)*Math.PI) : 0;
        const adsY = w.type === 'pistol' ? -0.12 : w.type === 'shotgun' ? -0.135 : -0.155;
        weaponRig.position.x = THREE.MathUtils.lerp(weaponRig.position.x, (state.aiming ? 0 : 0.22) + bobX + swayX, Math.min(1, dt*15));
        weaponRig.position.y = THREE.MathUtils.lerp(weaponRig.position.y, (state.aiming ? adsY : -0.22) + bobY + swayY - rDip*0.14 + state.swapY, Math.min(1, dt*18));
        weaponRig.position.z = THREE.MathUtils.lerp(weaponRig.position.z, (state.aiming ? -0.31 : -0.42) + state.recoilZ, Math.min(1, dt*16));
        weaponRig.rotation.x = state.recoilPitch - rDip*0.28 + state.swapY * 1.1;
        weaponRig.rotation.z = rDip*0.35 - state.swapY * 0.45;

        // Crosshair dynamic spread & SVG reticle update
        const hSpd = Math.hypot(playerVel.x, playerVel.z);
        let targetSp = state.crouching ? 0.04 : 0.1;
        if (state.aiming) targetSp = 0.02;
        else if (hSpd > 6.2) targetSp = 0.38;
        else if (hSpd > 0.5) targetSp = state.crouching ? 0.12 : 0.22;
        if (!grounded) targetSp += 0.18;
        if (state.recoilPitch > 0.015) targetSp += Math.min(0.32, state.recoilPitch * 2.2);
        state.spread = THREE.MathUtils.lerp(state.spread, targetSp, Math.min(1, dt*14));
        renderCrosshairSvg(document.getElementById('crosshair-svg'), profile.crosshair, state.spread, state.aiming, state.hitActive, state.hitHs);

        if (state.dmgVignette > 0) {
          state.dmgVignette = Math.max(0, state.dmgVignette - dt * 1.6);
          document.getElementById('damage-vignette').style.opacity = state.dmgVignette;
        }
        if (state.flashGlare > 0) {
          state.flashGlare = Math.max(0, state.flashGlare - dt * 1.4);
          document.getElementById('flash-glare').style.opacity = Math.min(0.65, state.flashGlare);
        }

        // Thrown Flash-Frag Grenades Update
        for (let gi = activeGrenades.length - 1; gi >= 0; gi--) {
          const g = activeGrenades[gi];
          g.fuse -= dt; g.vel.y -= 18.5 * dt;
          const np = g.pos.clone().addScaledVector(g.vel, dt);
          for (let ci = 0; ci < collisions.length; ci++) {
            const col = collisions[ci];
            if (col.type === 'ramp') continue;
            if (np.y >= col.box.min.y-0.14 && np.y <= col.box.max.y+0.14 && np.x >= col.box.min.x-0.14 && np.x <= col.box.max.x+0.14 && np.z >= col.box.min.z-0.14 && np.z <= col.box.max.z+0.14) {
              if (g.pos.x < col.box.min.x-0.14 || g.pos.x > col.box.max.x+0.14) { g.vel.x *= -0.52; np.x = g.pos.x; }
              else { g.vel.z *= -0.52; np.z = g.pos.z; }
              g.bounces++; break;
            }
          }
          if (np.y <= 0.1) {
            np.y = 0.1;
            if (Math.abs(g.vel.y) > 1.2) { g.vel.y *= -0.46; g.vel.x *= 0.68; g.vel.z *= 0.68; if (g.bounces < 2) AudioSys.clink(); g.bounces++; }
            else { g.vel.y = 0; g.vel.x *= 0.85; g.vel.z *= 0.85; }
          }
          g.pos.copy(np); g.mesh.position.copy(g.pos); g.mesh.rotation.x += dt*10; g.mesh.rotation.z += dt*7;
          if (g.fuse <= 0) { scene.remove(g.mesh); detonateGrenade(g.pos); activeGrenades.splice(gi, 1); }
        }

        // Boss Hazards Update (Syringe Darts & Anesthetic Gas Clouds)
        for (let di = activeDarts.length - 1; di >= 0; di--) {
          const d = activeDarts[di]; d.life -= dt;
          d.pos.addScaledVector(d.vel, dt); d.mesh.position.copy(d.pos);
          let rm = d.life <= 0 || d.pos.y <= 0.05;
          if (!rm && d.pos.distanceTo(camera.position) < 0.85) {
            hurtStandalonePlayer(6); state.slowT = Math.max(state.slowT, 2.2); rm = true;
          }
          if (!rm) {
            for (let ci = 0; ci < collisions.length; ci++) {
              const col = collisions[ci]; if (col.type === 'ramp') continue;
              if (d.pos.x >= col.box.min.x && d.pos.x <= col.box.max.x && d.pos.y <= col.box.max.y && d.pos.z >= col.box.min.z && d.pos.z <= col.box.max.z) { rm = true; break; }
            }
          }
          if (rm) { scene.remove(d.mesh); activeDarts.splice(di, 1); }
        }
        let inGasNow = false;
        for (let gi = activeGas.length - 1; gi >= 0; gi--) {
          const g = activeGas[gi]; g.life -= dt; g.mesh.rotation.y += dt * 0.6;
          if (Math.hypot(playerPos.x - g.pos.x, playerPos.z - g.pos.z) <= 4.8 && playerPos.y < 3.6) {
            inGasNow = true; hurtStandalonePlayer(3.5 * dt); state.slowT = Math.max(state.slowT, 0.5);
          }
          if (g.life <= 0) { scene.remove(g.mesh); activeGas.splice(gi, 1); }
        }
        state.inGas = inGasNow;

        // Boss AI Update
        if (boss) {
          if (boss.dying) {
            boss.collapse = Math.min(1, boss.collapse + dt * 1.4);
            boss.pv.rotation.x = boss.collapse * Math.PI/2;
            boss.pv.position.y = -boss.collapse * 0.8;
            if (boss.collapse >= 1) boss.dying = false;
          } else if (!boss.isDead) {
            if (boss.flash > 0) { boss.flash -= dt; boss.coatM.emissive.setHex(0xffffff); boss.coatM.emissiveIntensity = 0.4; }
            else if (boss.stunTimer > 0) {
              boss.stunTimer = Math.max(0, boss.stunTimer - dt);
              boss.coatM.emissive.setHex(0x38bdf8); boss.coatM.emissiveIntensity = 0.35;
              boss.head.rotation.y = Math.sin(boss.stunTimer*12)*0.4;
            } else {
              boss.coatM.emissive.setHex(0x000000); boss.coatM.emissiveIntensity = 0; boss.head.rotation.y = 0;
              boss.tankM.emissiveIntensity = 1.8 + Math.sin(performance.now()*0.008)*0.6;
              const dx = playerPos.x - boss.pos.x, dz = playerPos.z - boss.pos.z, dist = Math.hypot(dx, dz);
              if (boss.mode !== 'rush_lunge') boss.group.rotation.y = Math.atan2(dx, dz);
              const eye = new THREE.Vector3(boss.pos.x, 2.25, boss.pos.z);
              const toP = new THREE.Vector3().subVectors(playerPos, eye).normalize();
              rcLOS.set(eye, toP); rcLOS.far = Math.max(0.2, dist - 0.5);
              const los = rcLOS.intersectObjects(obstacleMeshes, false).length === 0;
              boss.barCd -= dt; boss.gasCd -= dt; boss.rushCd -= dt;
              if (boss.mode === 'rush_telegraph') {
                boss.rushT -= dt; boss.label = 'WARNING · SCALPEL RUSH INCOMING'; boss.lArm.rotation.x = -1.5;
                if (boss.rushT <= 0) { boss.mode = 'rush_lunge'; boss.rushT = 0.65; boss.rushHit = false; boss.rushDir.set(dx,0,dz).normalize(); AudioSys.scalpelRush(); }
              } else if (boss.mode === 'rush_lunge') {
                boss.rushT -= dt; boss.label = 'SCALPEL RUSH';
                boss.pos.addScaledVector(boss.rushDir, 14.5 * dt);
                boss.pos.x = Math.max(-37, Math.min(37, boss.pos.x)); boss.pos.z = Math.max(-37, Math.min(37, boss.pos.z));
                boss.group.position.copy(boss.pos);
                if (!boss.rushHit && dist < 2.65) { boss.rushHit = true; hurtStandalonePlayer(13); }
                if (boss.rushT <= 0) { boss.mode = 'stalk'; boss.rushCd = 7.2; boss.lArm.rotation.x = 0; }
              } else {
                if (los && dist < 8.5 && boss.rushCd <= 0 && boss.burstLeft <= 0) {
                  boss.mode = 'rush_telegraph'; boss.rushT = 0.55; boss.label = 'WARNING · SCALPEL RUSH';
                } else {
                  if (boss.gasCd <= 0 && dist < 36 && boss.burstLeft <= 0) {
                    boss.gasCd = 9.0; boss.label = 'ANESTHETIC GAS CLOUD DEPLOYED'; AudioSys.gasHiss();
                    const cg = new THREE.Group(); cg.position.set(playerPos.x, 0.08, playerPos.z);
                    cg.add(new THREE.Mesh(new THREE.SphereGeometry(4.8,16,10,0,Math.PI*2,0,Math.PI/2), new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide })));
                    scene.add(cg); activeGas.push({ mesh: cg, pos: cg.position.clone(), life: 7.5 });
                  }
                  if (boss.burstLeft > 0) {
                    boss.burstT -= dt; boss.label = 'SYRINGE DART BARRAGE';
                    if (boss.burstT <= 0) {
                      boss.burstT = 0.22; boss.burstLeft--;
                      const mp = new THREE.Vector3(); boss.muzzle.getWorldPosition(mp);
                      const ad = new THREE.Vector3().subVectors(playerPos, mp).add(new THREE.Vector3((Math.random()-0.5)*0.9, -0.08 + (Math.random()-0.5)*0.38, (Math.random()-0.5)*0.9)).normalize();
                      AudioSys.syringeShot();
                      const dg = new THREE.Group();
                      dg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.032,0.032,0.36,8).rotateX(Math.PI/2), new THREE.MeshBasicMaterial({ color: 0x10b981 })));
                      dg.position.copy(mp); dg.lookAt(mp.clone().add(ad)); scene.add(dg);
                      activeDarts.push({ mesh: dg, pos: mp, vel: ad.multiplyScalar(30), life: 2.8 });
                    }
                  } else if (los && boss.barCd <= 0) { boss.barCd = 3.2; boss.burstLeft = 4; boss.burstT = 0.05; boss.label = 'SYRINGE DART BARRAGE'; }
                  else boss.label = los ? 'PURSUING OPERATIVE' : 'TRACKING BEHIND COVER';

                  boss.strafeT += dt; if (boss.strafeT > 2.2) { boss.strafeT = 0; boss.strafeDir *= -1; }
                  const ff = new THREE.Vector3(dx,0,dz).normalize(), sv = new THREE.Vector3(-ff.z,0,ff.x).multiplyScalar(boss.strafeDir);
                  const mv = new THREE.Vector3().addScaledVector(ff, dist > 14 ? 0.8 : 0.35).addScaledVector(sv, 0.7).normalize().multiplyScalar(4.35*dt);
                  boss.pos.add(mv); boss.pos.x = Math.max(-37, Math.min(37, boss.pos.x)); boss.pos.z = Math.max(-37, Math.min(37, boss.pos.z));
                  boss.group.position.copy(boss.pos);
                  boss.walk += dt * 8.5; boss.lLeg.rotation.x = Math.sin(boss.walk)*0.5; boss.rLeg.rotation.x = -Math.sin(boss.walk)*0.5;
                }
              }
            }
          }
        }

        // Enemies Update
        if (waveWait > 0) { waveWait = Math.max(0, waveWait - dt); if (waveWait <= 0) spawnWave(state.wave + 1); }
        else enemies.forEach(b => {
          if (b.dying) {
            b.collapse = Math.min(1, b.collapse + dt * 2.4);
            b.pivot.rotation.x = b.collapse * Math.PI/2;
            b.pivot.position.y = -b.collapse * 0.65;
            if (b.collapse >= 1) b.dying = false;
            return;
          }
          if (b.isDead) return;
          if (b.flash > 0) { b.flash -= dt; b.torso.material.emissive.setHex(0xffffff); }
          else if (b.stunTimer > 0) {
            b.stunTimer = Math.max(0, b.stunTimer - dt);
            b.torso.material.emissive.setHex(0x38bdf8);
            b.head.rotation.y = Math.sin(b.stunTimer * 12) * 0.42;
            b.lLeg.rotation.x = b.rLeg.rotation.x = 0;
            return;
          } else {
            b.torso.material.emissive.setHex(0x000000);
            b.head.rotation.y = 0;
          }

          const dist = b.pos.distanceTo(playerPos);
          const eye = new THREE.Vector3(b.pos.x, 1.7, b.pos.z);
          const toP = new THREE.Vector3().subVectors(playerPos, eye).normalize();
          rcLOS.set(eye, toP); rcLOS.far = Math.max(0.1, dist - 0.6);
          const los = dist < 40 && rcLOS.intersectObjects(obstacleMeshes, false).length === 0;

          let bMoving = false;
          if (los && dist <= 26) {
            const dx = playerPos.x - b.pos.x, dz = playerPos.z - b.pos.z;
            b.group.rotation.y = Math.atan2(dx, dz);
            b.strafeT += dt; if (b.strafeT > 1.7) { b.strafeT = 0; b.strafeDir *= -1; }
            const st = new THREE.Vector3(-dz, 0, dx).normalize().multiplyScalar(b.strafeDir * b.speed * 0.65 * dt);
            b.pos.add(st); b.group.position.copy(b.pos); bMoving = true;
            b.fireCd -= dt;
            if (b.fireCd <= 0) {
              b.fireCd = Math.max(1.05, 1.95 - state.wave*0.08);
              AudioSys.enemyShot();
              const gp = new THREE.Vector3(); b.gunArm.getWorldPosition(gp);
              const aimP = playerPos.clone().add(new THREE.Vector3((Math.random()-0.5)*1.45, -0.15 + (Math.random()-0.5)*0.75, (Math.random()-0.5)*1.45));
              spawnTracer(gp, aimP, 0xff1e42);
              if (aimP.distanceTo(camera.position) < 0.72) {
                hurtStandalonePlayer(b.dmg);
              }
            }
          } else {
            const tgt = dist < 35 ? playerPos : b.patrol;
            const d = new THREE.Vector3().subVectors(tgt, b.pos); d.y = 0;
            if (d.length() < 1.5 && dist >= 35) b.patrol.set(...PATROL[Math.floor(Math.random()*PATROL.length)]);
            else {
              bMoving = true; d.normalize().multiplyScalar(b.speed * 0.7 * dt);
              b.pos.add(d); b.group.position.copy(b.pos);
              b.group.rotation.y = Math.atan2(d.x, d.z);
            }
          }
          if (bMoving) {
            b.walk += dt * 9;
            b.lLeg.rotation.x = Math.sin(b.walk) * 0.5;
            b.rLeg.rotation.x = -Math.sin(b.walk) * 0.5;
          } else { b.lLeg.rotation.x = b.rLeg.rotation.x = 0; }
        });

        updateHUD();
        drawRadar();
      }

      // VFX Update
      for (let i = tracers.length - 1; i >= 0; i--) {
        tracers[i].life -= dt;
        if (tracers[i].life <= 0) { scene.remove(tracers[i].line); tracers[i].line.geometry.dispose(); tracers.splice(i, 1); }
      }
      for (let i = shells.length - 1; i >= 0; i--) {
        const s = shells[i]; s.life -= dt; s.vel.y -= 13.5 * dt;
        s.mesh.position.addScaledVector(s.vel, dt); s.mesh.rotation.x += 12*dt; s.mesh.rotation.z += 9*dt;
        if (s.mesh.position.y <= 0.025) { s.mesh.position.y = 0.025; if (s.bounces === 0) AudioSys.clink(); s.bounces++; s.vel.y *= -0.4; s.vel.x *= 0.6; s.vel.z *= 0.6; }
        if (s.life <= 0) { scene.remove(s.mesh); shells.splice(i, 1); }
      }

      for (let i = floatingDamages.length - 1; i >= 0; i--) {
        const fd = floatingDamages[i]; fd.life += dt;
        if (fd.life >= fd.maxLife) { scene.remove(fd.sprite); fd.tex.dispose(); fd.mat.dispose(); floatingDamages.splice(i, 1); continue; }
        const t = fd.life / fd.maxLife;
        fd.vel.y = Math.max(0.45, fd.vel.y - dt * 1.4);
        fd.sprite.position.addScaledVector(fd.vel, dt);
        const pop = t < 0.16 ? 0.85 + (t / 0.16) * 0.35 : 1.2 - (t - 0.16) * 0.26;
        fd.sprite.scale.set(fd.bsx * pop, fd.bsy * pop, 1);
        fd.mat.opacity = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.4);
      }

      if (shakeInt > 0.0005 && !state.paused && !state.dead) {
        shakeInt = Math.max(0, shakeInt - dt * 0.28);
        shakePh += dt * 68;
        const sx = Math.sin(shakePh * 1.13) * shakeInt;
        const sy = Math.cos(shakePh * 1.47) * shakeInt;
        const sRoll = Math.sin(shakePh * 0.89) * shakeInt * 0.35;
        const sr = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const su = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
        camera.position.addScaledVector(sr, sx).addScaledVector(su, sy);
        const rz = camera.rotation.z; camera.rotation.z = rz + sRoll;
        renderer.render(scene, camera);
        camera.position.copy(playerPos); camera.rotation.z = rz;
      } else {
        shakeInt = 0;
        renderer.render(scene, camera);
      }
    }
    animate();
  })();
  </script>
</body>
</html>`;
}
