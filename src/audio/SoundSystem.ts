/**
 * Layered Procedural Web Audio API Sound Synthesizer for GIS Shooter: Tactical Edition
 * 100% self-contained: No external audio assets required.
 */

class SoundSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private lobbyGain: GainNode | null = null;
  private lobbyNodes: AudioNode[] = [];
  private lobbyRadarTimer: number | null = null;
  private lobbyAmbientActive = false;
  private bossMusicTimer: number | null = null;
  private bossMusicActive = false;
  private bossBeatStep = 0;
  private isMuted = false;
  private volume = 0.7;
  private noiseBuffer: AudioBuffer | null = null;

  public init() {
    if (this.ctx) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.lobbyGain = this.ctx.createGain();

      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
      this.sfxGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.lobbyGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

      this.sfxGain.connect(this.masterGain);
      this.lobbyGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // Pre-generate 1.5s reusable white noise buffer
      const size = Math.floor(this.ctx.sampleRate * 1.5);
      this.noiseBuffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < size; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
    }
  }

  public resume() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public startLobbyAmbient() {
    if (!this.ctx) this.init();
    if (!this.ctx || !this.lobbyGain) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.lobbyAmbientActive) return;
    this.lobbyAmbientActive = true;

    const t = this.ctx.currentTime;
    this.lobbyGain.gain.cancelScheduledValues(t);
    this.lobbyGain.gain.setValueAtTime(this.lobbyGain.gain.value, t);
    this.lobbyGain.gain.linearRampToValueAtTime(0.85, t + 0.8);

    // 1. Deep Hangar Reactor / Turbine Sub Hum
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(54, t);
    subGain.gain.setValueAtTime(0.065, t);
    subOsc.connect(subGain);
    subGain.connect(this.lobbyGain);
    subOsc.start(t);

    // 2. Warm Harmonic Ventilation Drone
    const humOsc = this.ctx.createOscillator();
    const humFilter = this.ctx.createBiquadFilter();
    const humGain = this.ctx.createGain();
    humOsc.type = 'triangle';
    humOsc.frequency.setValueAtTime(108, t);
    humFilter.type = 'lowpass';
    humFilter.frequency.setValueAtTime(190, t);
    humGain.gain.setValueAtTime(0.032, t);
    humOsc.connect(humFilter);
    humFilter.connect(humGain);
    humGain.connect(this.lobbyGain);
    humOsc.start(t);

    // 3. Soft Air Circulation Noise Bed
    const airNodes: AudioNode[] = [subOsc, subGain, humOsc, humFilter, humGain];
    const air = this.createNoiseSource(2.0);
    if (air) {
      air.loop = true;
      const airBp = this.ctx.createBiquadFilter();
      airBp.type = 'bandpass';
      airBp.frequency.setValueAtTime(320, t);
      airBp.Q.setValueAtTime(1.1, t);
      const airGain = this.ctx.createGain();
      airGain.gain.setValueAtTime(0.022, t);
      air.connect(airBp);
      airBp.connect(airGain);
      airGain.connect(this.lobbyGain);
      air.start(t);
      airNodes.push(air, airBp, airGain);
    }

    this.lobbyNodes = airNodes;

    // 4. Periodic Soft Radar Sonar Ping
    if (this.lobbyRadarTimer !== null) {
      window.clearInterval(this.lobbyRadarTimer);
    }
    this.lobbyRadarTimer = window.setInterval(() => {
      if (!this.ctx || !this.lobbyGain || !this.lobbyAmbientActive || this.isMuted) return;
      if (this.ctx.state !== 'running') return;
      const pt = this.ctx.currentTime;
      const ping = this.ctx.createOscillator();
      const pg = this.ctx.createGain();
      ping.type = 'sine';
      ping.frequency.setValueAtTime(1180, pt);
      ping.frequency.exponentialRampToValueAtTime(1135, pt + 0.45);
      pg.gain.setValueAtTime(0.001, pt);
      pg.gain.linearRampToValueAtTime(0.045, pt + 0.02);
      pg.gain.exponentialRampToValueAtTime(0.0008, pt + 0.52);
      ping.connect(pg);
      pg.connect(this.lobbyGain);
      ping.start(pt);
      ping.stop(pt + 0.55);
    }, 3600);
  }

  public stopLobbyAmbient() {
    if (!this.lobbyAmbientActive) return;
    this.lobbyAmbientActive = false;

    if (this.lobbyRadarTimer !== null) {
      window.clearInterval(this.lobbyRadarTimer);
      this.lobbyRadarTimer = null;
    }

    if (this.ctx && this.lobbyGain) {
      const t = this.ctx.currentTime;
      this.lobbyGain.gain.cancelScheduledValues(t);
      this.lobbyGain.gain.setValueAtTime(this.lobbyGain.gain.value, t);
      this.lobbyGain.gain.linearRampToValueAtTime(0.0, t + 0.25);
    }

    const nodesToStop = this.lobbyNodes;
    this.lobbyNodes = [];
    window.setTimeout(() => {
      nodesToStop.forEach((node) => {
        try {
          if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
            (node as AudioScheduledSourceNode).stop();
          }
          node.disconnect();
        } catch {
          // ignore already stopped
        }
      });
    }, 280);
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  private createNoiseSource(duration: number): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noiseBuffer) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = duration > 1.4;
    return src;
  }

  /**
   * AR-X7 Tactical Shot:
   * Layer 1: Low-end sub punch (180Hz -> 42Hz)
   * Layer 2: High-end supersonic crack (bandpass noise burst)
   * Layer 3: Acoustic chamber tail
   */
  public playRifleShot() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;

    // Layer 1: Low-end punch
    const lowOsc = this.ctx.createOscillator();
    const lowGain = this.ctx.createGain();
    lowOsc.type = 'triangle';
    lowOsc.frequency.setValueAtTime(190, t);
    lowOsc.frequency.exponentialRampToValueAtTime(42, t + 0.09);
    lowGain.gain.setValueAtTime(0.75, t);
    lowGain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    lowOsc.connect(lowGain);
    lowGain.connect(this.sfxGain);
    lowOsc.start(t);
    lowOsc.stop(t + 0.12);

    // Layer 2: High-end transient crack
    const crack = this.createNoiseSource(0.09);
    if (crack) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2400, t);
      bp.Q.setValueAtTime(1.4, t);
      const cg = this.ctx.createGain();
      cg.gain.setValueAtTime(0.95, t);
      cg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      crack.connect(bp);
      bp.connect(cg);
      cg.connect(this.sfxGain);
      crack.start(t);
      crack.stop(t + 0.09);
    }

    // Layer 3: Reverberant noise tail
    const tail = this.createNoiseSource(0.24);
    if (tail) {
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1200, t);
      lp.frequency.exponentialRampToValueAtTime(220, t + 0.22);
      const tg = this.ctx.createGain();
      tg.gain.setValueAtTime(0.32, t + 0.02);
      tg.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      tail.connect(lp);
      lp.connect(tg);
      tg.connect(this.sfxGain);
      tail.start(t);
      tail.stop(t + 0.24);
    }
  }

  /**
   * SG-12 Breach Tactical Shotgun Blast + Delayed Pump Action Rack
   */
  public playShotgunBlast() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;

    // Layer 1: Heavy chest thump
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(145, t);
    sub.frequency.exponentialRampToValueAtTime(28, t + 0.24);
    subGain.gain.setValueAtTime(1.0, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(t);
    sub.stop(t + 0.27);

    // Layer 2: Wide explosive burst
    const boom = this.createNoiseSource(0.36);
    if (boom) {
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3200, t);
      lp.frequency.exponentialRampToValueAtTime(240, t + 0.34);
      const bg = this.ctx.createGain();
      bg.gain.setValueAtTime(1.0, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      boom.connect(lp);
      lp.connect(bg);
      bg.connect(this.sfxGain);
      boom.start(t);
      boom.stop(t + 0.36);
    }

    // Delayed pump-action mechanical cycle
    setTimeout(() => this.playPumpAction(), 260);
  }

  public playPumpAction() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Slide back click
    const n1 = this.createNoiseSource(0.08);
    if (n1) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1800, t);
      bp.Q.setValueAtTime(4.0, t);
      const g1 = this.ctx.createGain();
      g1.gain.setValueAtTime(0.35, t);
      g1.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      n1.connect(bp);
      bp.connect(g1);
      g1.connect(this.sfxGain);
      n1.start(t);
      n1.stop(t + 0.08);
    }

    // Slide forward clack
    const n2 = this.createNoiseSource(0.08);
    if (n2) {
      const t2 = t + 0.12;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2400, t2);
      bp.Q.setValueAtTime(5.0, t2);
      const g2 = this.ctx.createGain();
      g2.gain.setValueAtTime(0.4, t2);
      g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.07);
      n2.connect(bp);
      bp.connect(g2);
      g2.connect(this.sfxGain);
      n2.start(t2);
      n2.stop(t2 + 0.08);
    }
  }

  /**
   * SR-50 Marksman Suppressed Sniper Shot + Bolt Cycle
   */
  public playSniperShot() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;

    // Suppressed subsonic thump
    const thump = this.ctx.createOscillator();
    const tg = this.ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(240, t);
    thump.frequency.exponentialRampToValueAtTime(38, t + 0.14);
    tg.gain.setValueAtTime(0.9, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    thump.connect(tg);
    tg.connect(this.sfxGain);
    thump.start(t);
    thump.stop(t + 0.17);

    // Filtered suppressor air-snap
    const hiss = this.createNoiseSource(0.18);
    if (hiss) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(3600, t);
      bp.frequency.exponentialRampToValueAtTime(900, t + 0.15);
      bp.Q.setValueAtTime(1.8, t);
      const hg = this.ctx.createGain();
      hg.gain.setValueAtTime(0.65, t);
      hg.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
      hiss.connect(bp);
      bp.connect(hg);
      hg.connect(this.sfxGain);
      hiss.start(t);
      hiss.stop(t + 0.18);
    }

    // Precision bolt action metallic click after shot
    setTimeout(() => {
      if (!this.ctx || !this.sfxGain || this.isMuted) return;
      const bt = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const bg = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1400, bt);
      osc.frequency.setValueAtTime(950, bt + 0.04);
      bg.gain.setValueAtTime(0.12, bt);
      bg.gain.exponentialRampToValueAtTime(0.001, bt + 0.09);
      osc.connect(bg);
      bg.connect(this.sfxGain);
      osc.start(bt);
      osc.stop(bt + 0.1);
    }, 420);
  }

  public playDryFire() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(860, t);
    osc.frequency.setValueAtTime(420, t + 0.015);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  public playReload(reloadDuration = 1.75) {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const dur = Math.max(0.9, reloadDuration);

    // 1. Mag latch release
    const c1 = this.ctx.createOscillator();
    const g1 = this.ctx.createGain();
    c1.type = 'sine';
    c1.frequency.setValueAtTime(640, t);
    c1.frequency.exponentialRampToValueAtTime(210, t + 0.08);
    g1.gain.setValueAtTime(0.28, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    c1.connect(g1);
    g1.connect(this.sfxGain);
    c1.start(t);
    c1.stop(t + 0.09);

    // 2. Fresh mag insertion thud (scaled to weapon duration)
    const t2 = t + dur * 0.34;
    const c2 = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    c2.type = 'triangle';
    c2.frequency.setValueAtTime(240, t2);
    c2.frequency.exponentialRampToValueAtTime(95, t2 + 0.11);
    g2.gain.setValueAtTime(0.42, t2);
    g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.11);
    c2.connect(g2);
    g2.connect(this.sfxGain);
    c2.start(t2);
    c2.stop(t2 + 0.12);

    // 3. Bolt release metallic snap
    const t3 = t + dur * 0.72;
    const c3 = this.ctx.createOscillator();
    const g3 = this.ctx.createGain();
    c3.type = 'sawtooth';
    c3.frequency.setValueAtTime(820, t3);
    c3.frequency.exponentialRampToValueAtTime(1350, t3 + 0.05);
    c3.frequency.exponentialRampToValueAtTime(320, t3 + 0.12);
    g3.gain.setValueAtTime(0.38, t3);
    g3.gain.exponentialRampToValueAtTime(0.001, t3 + 0.14);
    c3.connect(g3);
    g3.connect(this.sfxGain);
    c3.start(t3);
    c3.stop(t3 + 0.15);
  }

  public playHitmarker(headshot = false) {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;

    if (headshot) {
      // Crisp metallic critical ding
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(2600, t);
      osc2.frequency.setValueAtTime(3900, t);
      g.gain.setValueAtTime(0.36, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc1.connect(g);
      osc2.connect(g);
      g.connect(this.sfxGain);
      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.15);
      osc2.stop(t + 0.15);
    } else {
      // Tight tactile bodyshot tick
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1650, t);
      osc.frequency.exponentialRampToValueAtTime(1100, t + 0.05);
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.07);
    }
  }

  public playShellClink() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const f = 3600 + Math.random() * 1200;
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.035);
    g.gain.setValueAtTime(0.045, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.045);
  }

  public playEnemyKilled() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.36);
    gain.gain.setValueAtTime(0.42, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.38);
  }

  public playEnemyShot() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(920, t);
    osc.frequency.exponentialRampToValueAtTime(160, t + 0.14);
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  public playFootstep(isSprinting = false) {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const baseFreq = isSprinting ? 105 + Math.random() * 25 : 78 + Math.random() * 18;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.08);
    gain.gain.setValueAtTime(isSprinting ? 0.18 : 0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  public playPlayerHurt() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(170, t);
    osc.frequency.exponentialRampToValueAtTime(52, t + 0.22);
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  public playLowHealthAlert() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(580, t);
    osc.frequency.setValueAtTime(440, t + 0.08);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  public playHeal() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;

    const hiss = this.createNoiseSource(0.35);
    if (hiss) {
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(2400, t);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      hiss.connect(hp);
      hp.connect(gain);
      gain.connect(this.sfxGain);
      hiss.start(t);
      hiss.stop(t + 0.36);
    }

    [440, 554.37, 659.25, 880].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const st = t + i * 0.07;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, st);
      gain.gain.setValueAtTime(0.16, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.24);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(st);
      osc.stop(st + 0.26);
    });
  }

  public playVampireHeal() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;

    [587.33, 880, 1174.66].forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const st = t + idx * 0.045;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx === 2 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, st);
      gain.gain.setValueAtTime(0.001, st);
      gain.gain.linearRampToValueAtTime(idx === 2 ? 0.2 : 0.15, st + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.22);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(st);
      osc.stop(st + 0.24);
    });
  }

  public playWaveComplete() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const st = t + idx * 0.11;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, st);
      gain.gain.setValueAtTime(0.22, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.34);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(st);
      osc.stop(st + 0.36);
    });
  }

  public playSmgShot() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;

    // Suppressed crisp bolt snap + punchy sub transient
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240 + Math.random() * 25, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.065);
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.075);

    const noise = this.createNoiseSource(0.06);
    if (noise) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1750, t);
      bp.Q.value = 2.0;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.42, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
      noise.connect(bp);
      bp.connect(nGain);
      nGain.connect(this.sfxGain);
      noise.start(t);
      noise.stop(t + 0.065);
    }
  }

  public playMagnumShot() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;

    // Massive .50 caliber hand-cannon crack & low boom
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(34, t + 0.19);
    gain.gain.setValueAtTime(0.85, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.21);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.22);

    const crack = this.createNoiseSource(0.24);
    if (crack) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(3100, t);
      bp.frequency.exponentialRampToValueAtTime(480, t + 0.22);
      bp.Q.value = 1.2;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.95, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      crack.connect(bp);
      bp.connect(nGain);
      nGain.connect(this.sfxGain);
      crack.start(t);
      crack.stop(t + 0.25);
    }
  }

  public playWeaponSwap() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;

    // Tactile fabric rustle + crisp latch click
    const rustle = this.createNoiseSource(0.09);
    if (rustle) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(900, t);
      bp.Q.value = 1.4;
      const rg = this.ctx.createGain();
      rg.gain.setValueAtTime(0.18, t);
      rg.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
      rustle.connect(bp);
      bp.connect(rg);
      rg.connect(this.sfxGain);
      rustle.start(t);
      rustle.stop(t + 0.095);
    }

    const latch = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    latch.type = 'triangle';
    latch.frequency.setValueAtTime(1150, t + 0.06);
    latch.frequency.exponentialRampToValueAtTime(520, t + 0.11);
    lg.gain.setValueAtTime(0.2, t + 0.06);
    lg.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    latch.connect(lg);
    lg.connect(this.sfxGain);
    latch.start(t + 0.06);
    latch.stop(t + 0.13);
  }

  public playFlashlightClick() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1900, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.03);
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.032);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.035);
  }

  public playGrenadeThrow() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;

    // Pin pull + whoosh
    const pin = this.ctx.createOscillator();
    const pg = this.ctx.createGain();
    pin.type = 'sine';
    pin.frequency.setValueAtTime(2800, t);
    pin.frequency.exponentialRampToValueAtTime(1600, t + 0.05);
    pg.gain.setValueAtTime(0.2, t);
    pg.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    pin.connect(pg);
    pg.connect(this.sfxGain);
    pin.start(t);
    pin.stop(t + 0.06);

    const whoosh = this.createNoiseSource(0.16);
    if (whoosh) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(420, t + 0.02);
      bp.frequency.exponentialRampToValueAtTime(1400, t + 0.16);
      bp.Q.value = 1.2;
      const wg = this.ctx.createGain();
      wg.gain.setValueAtTime(0.32, t + 0.02);
      wg.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
      whoosh.connect(bp);
      bp.connect(wg);
      wg.connect(this.sfxGain);
      whoosh.start(t + 0.02);
      whoosh.stop(t + 0.18);
    }
  }

  public playFlashFragExplosion() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;

    // Concussion thump
    const boom = this.ctx.createOscillator();
    const bg = this.ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(160, t);
    boom.frequency.exponentialRampToValueAtTime(24, t + 0.42);
    bg.gain.setValueAtTime(1.0, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.44);
    boom.connect(bg);
    bg.connect(this.sfxGain);
    boom.start(t);
    boom.stop(t + 0.45);

    // High-energy blast noise
    const blast = this.createNoiseSource(0.55);
    if (blast) {
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(5200, t);
      lp.frequency.exponentialRampToValueAtTime(220, t + 0.52);
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(1.0, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      blast.connect(lp);
      lp.connect(ng);
      ng.connect(this.sfxGain);
      blast.start(t);
      blast.stop(t + 0.56);
    }

    // Brief stun whine shimmer
    const ring = this.ctx.createOscillator();
    const rg = this.ctx.createGain();
    ring.type = 'sine';
    ring.frequency.setValueAtTime(3400, t + 0.03);
    ring.frequency.exponentialRampToValueAtTime(2900, t + 0.55);
    rg.gain.setValueAtTime(0.11, t + 0.03);
    rg.gain.exponentialRampToValueAtTime(0.001, t + 0.56);
    ring.connect(rg);
    rg.connect(this.sfxGain);
    ring.start(t + 0.03);
    ring.stop(t + 0.57);
  }

  public playScoreSubmit() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const start = t + i * 0.075;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = i === notes.length - 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(i === notes.length - 1 ? 0.28 : 0.2, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + (i === notes.length - 1 ? 0.42 : 0.2));
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(start);
      osc.stop(start + 0.44);
    });
  }

  // --- Wave 10 Boss Audio & Combat Loop ---
  public startBossMusic() {
    if (!this.ctx) this.init();
    if (!this.ctx || !this.sfxGain) return;
    this.resume();
    if (this.bossMusicActive) return;
    this.bossMusicActive = true;
    this.bossBeatStep = 0;

    if (this.bossMusicTimer !== null) {
      window.clearInterval(this.bossMusicTimer);
    }

    const bassPattern = [55, 55, 65.41, 55, 73.42, 55, 61.74, 48.99];
    this.bossMusicTimer = window.setInterval(() => {
      if (!this.ctx || !this.sfxGain || !this.bossMusicActive || this.isMuted) return;
      if (this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime;
      const step = this.bossBeatStep % 8;
      this.bossBeatStep++;

      // Driving industrial sub-bass pulse
      const bass = this.ctx.createOscillator();
      const lp = this.ctx.createBiquadFilter();
      const bg = this.ctx.createGain();
      bass.type = 'sawtooth';
      bass.frequency.setValueAtTime(bassPattern[step], t);
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(step % 2 === 0 ? 340 : 210, t);
      bg.gain.setValueAtTime(0.001, t);
      bg.gain.linearRampToValueAtTime(0.16, t + 0.015);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      bass.connect(lp);
      lp.connect(bg);
      bg.connect(this.sfxGain);
      bass.start(t);
      bass.stop(t + 0.25);

      // Tension metallic percussive tick on off-beats
      if (step % 2 === 1) {
        const tick = this.createNoiseSource(0.05);
        if (tick) {
          const hp = this.ctx.createBiquadFilter();
          hp.type = 'highpass';
          hp.frequency.setValueAtTime(3600, t);
          const tg = this.ctx.createGain();
          tg.gain.setValueAtTime(0.08, t);
          tg.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
          tick.connect(hp);
          hp.connect(tg);
          tg.connect(this.sfxGain);
          tick.start(t);
          tick.stop(t + 0.05);
        }
      }

      // High-tension dissonant synth pulse every bar
      if (step === 0 || step === 4) {
        const st = this.ctx.createOscillator();
        const sg = this.ctx.createGain();
        st.type = 'triangle';
        st.frequency.setValueAtTime(step === 0 ? 220 : 233.08, t);
        sg.gain.setValueAtTime(0.001, t);
        sg.gain.linearRampToValueAtTime(0.075, t + 0.03);
        sg.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
        st.connect(sg);
        sg.connect(this.sfxGain);
        st.start(t);
        st.stop(t + 0.44);
      }
    }, 235);
  }

  public stopBossMusic() {
    this.bossMusicActive = false;
    if (this.bossMusicTimer !== null) {
      window.clearInterval(this.bossMusicTimer);
      this.bossMusicTimer = null;
    }
  }

  public playBossEntranceAlarm() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;

    for (let i = 0; i < 3; i++) {
      const s = t + i * 0.52;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, s);
      osc.frequency.linearRampToValueAtTime(860, s + 0.24);
      osc.frequency.linearRampToValueAtTime(420, s + 0.48);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(950, s);
      g.gain.setValueAtTime(0.001, s);
      g.gain.linearRampToValueAtTime(0.24, s + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.49);
      osc.connect(bp);
      bp.connect(g);
      g.connect(this.sfxGain);
      osc.start(s);
      osc.stop(s + 0.5);
    }
  }

  public playSyringeShot() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1150, t);
    osc.frequency.exponentialRampToValueAtTime(340, t + 0.09);
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.1);

    const hiss = this.createNoiseSource(0.08);
    if (hiss) {
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(2200, t);
      const hg = this.ctx.createGain();
      hg.gain.setValueAtTime(0.24, t);
      hg.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      hiss.connect(hp);
      hp.connect(hg);
      hg.connect(this.sfxGain);
      hiss.start(t);
      hiss.stop(t + 0.08);
    }
  }

  public playGasCanisterHiss() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const hiss = this.createNoiseSource(0.65);
    if (hiss) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1800, t);
      bp.frequency.exponentialRampToValueAtTime(650, t + 0.62);
      bp.Q.value = 1.6;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.38, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.64);
      hiss.connect(bp);
      bp.connect(g);
      g.connect(this.sfxGain);
      hiss.start(t);
      hiss.stop(t + 0.65);
    }
  }

  public playScalpelRush() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(980, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.22);
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.23);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  public playBossDefeated() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();
    const t = this.ctx.currentTime;
    const fanfare = [392.0, 493.88, 587.33, 783.99, 987.77];
    fanfare.forEach((f, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const s = t + idx * 0.095;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = idx === fanfare.length - 1 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(f, s);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2600, s);
      g.gain.setValueAtTime(0.001, s);
      g.gain.linearRampToValueAtTime(0.24, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, s + (idx === fanfare.length - 1 ? 0.85 : 0.35));
      osc.connect(lp);
      lp.connect(g);
      g.connect(this.sfxGain);
      osc.start(s);
      osc.stop(s + 0.9);
    });
  }
}

export const soundSystem = new SoundSystem();
