/**
 * Alle Geräusche werden live mit der Web Audio API erzeugt – keine Audiodateien nötig.
 * Kaminknistern, Umblättern, Trommelwirbel, Stempel, Glöckchen und „Wah-wah“-Posaune.
 */

type AC = AudioContext;

class Sfx {
  private ctx: AC | null = null;
  private master: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  enabled = true;

  /** Muss in einem Klick/Tap-Handler aufgerufen werden (Autoplay-Regeln) */
  unlock() {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.enabled ? 0.9 : 0;
        this.master.connect(this.ctx.destination);
        this.noise = this.makeNoise(2);
        this.startAmbience();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      /* kein Ton – egal */
    }
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
  }

  private ok() {
    return !!(this.ctx && this.master && this.enabled && this.ctx.state === 'running');
  }

  private makeNoise(seconds: number) {
    const ctx = this.ctx!;
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  private noiseBurst(at: number, dur: number, opts: { type?: BiquadFilterType; freq?: number; freqEnd?: number; q?: number; gain?: number; attack?: number }) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.setValueAtTime(opts.freq ?? 1500, at);
    if (opts.freqEnd) f.frequency.exponentialRampToValueAtTime(opts.freqEnd, at + dur);
    f.Q.value = opts.q ?? 0.8;
    const g = ctx.createGain();
    const peak = opts.gain ?? 0.4;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + (opts.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(at, Math.random() * 1.5);
    src.stop(at + dur + 0.05);
  }

  private tone(at: number, freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; freqEnd?: number; attack?: number; filter?: number }) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, at);
    if (opts.freqEnd) o.frequency.exponentialRampToValueAtTime(opts.freqEnd, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.3, at + (opts.attack ?? 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    let node: AudioNode = o;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.filter;
      node = o.connect(f);
    }
    node.connect(g).connect(this.master!);
    o.start(at);
    o.stop(at + dur + 0.05);
    return o;
  }

  /** Kaminknistern als Endlosschleife */
  private startAmbience() {
    const ctx = this.ctx!;
    const seconds = 6;
    const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = b.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < d.length; i++) {
      brown = (brown + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = brown * 2.2;
    }
    const pops = 70;
    for (let p = 0; p < pops; p++) {
      const start = Math.floor(Math.random() * (d.length - 4000));
      const len = 200 + Math.floor(Math.random() * 1600);
      const amp = 0.15 + Math.random() * (Math.random() < 0.15 ? 0.85 : 0.35);
      for (let i = 0; i < len; i++) d[start + i] += (Math.random() * 2 - 1) * amp * Math.exp((-i / len) * 6);
    }
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2600;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.16, ctx.currentTime, 1.5);
    src.connect(f).connect(g).connect(this.master!);
    src.start();
    this.ambienceGain = g;
  }

  setAmbienceLevel(v: number) {
    if (this.ambienceGain && this.ctx) this.ambienceGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.4);
  }

  flip() {
    if (!this.ok()) return;
    const t = this.ctx!.currentTime;
    this.noiseBurst(t, 0.42, { freq: 900, freqEnd: 3200, q: 0.7, gain: 0.32, attack: 0.06 });
    this.noiseBurst(t + 0.25, 0.16, { type: 'lowpass', freq: 700, gain: 0.18, attack: 0.01 });
  }

  openBook() {
    if (!this.ok()) return;
    const t = this.ctx!.currentTime;
    const o = this.tone(t, 82, 0.7, { type: 'sawtooth', gain: 0.07, filter: 380 });
    o.frequency.setValueAtTime(82, t);
    o.frequency.linearRampToValueAtTime(64, t + 0.3);
    o.frequency.linearRampToValueAtTime(96, t + 0.6);
    this.noiseBurst(t + 0.55, 0.5, { type: 'lowpass', freq: 500, gain: 0.35, attack: 0.02 });
    this.tone(t + 0.58, 90, 0.35, { gain: 0.35, freqEnd: 45 });
  }

  drumroll(duration = 1.6) {
    if (!this.ok()) return;
    const t0 = this.ctx!.currentTime;
    let t = 0;
    let i = 0;
    while (t < duration) {
      const k = t / duration;
      this.noiseBurst(t0 + t, 0.07, { freq: 1700 + (i % 2) * 250, q: 1.2, gain: 0.05 + 0.32 * k * k, attack: 0.003 });
      t += 0.075 - 0.035 * k;
      i++;
    }
  }

  thump() {
    if (!this.ok()) return;
    const t = this.ctx!.currentTime;
    this.tone(t, 150, 0.32, { gain: 0.9, freqEnd: 42, attack: 0.004 });
    this.noiseBurst(t, 0.12, { type: 'lowpass', freq: 1800, gain: 0.5, attack: 0.002 });
  }

  /** Glöckchen-Arpeggio */
  nice() {
    if (!this.ok()) return;
    const t = this.ctx!.currentTime + 0.05;
    const notes = [1046.5, 1318.5, 1568, 2093];
    notes.forEach((f, i) => {
      const at = t + i * 0.11;
      this.tone(at, f, 1.2, { gain: 0.16 });
      this.tone(at, f * 2.76, 0.5, { gain: 0.05 });
      this.tone(at, f * 5.4, 0.25, { gain: 0.025 });
    });
    for (let i = 0; i < 8; i++) this.noiseBurst(t + 0.5 + i * 0.09, 0.08, { type: 'highpass', freq: 7000, gain: 0.08, attack: 0.002 });
  }

  /** „Wah-wah-wah-waaah“ */
  naughty() {
    if (!this.ok()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.05;
    const notes = [392, 370, 349.2, 329.6];
    notes.forEach((f, i) => {
      const at = t + i * 0.42;
      const dur = i === 3 ? 1.3 : 0.38;
      const o = this.tone(at, f, dur, { type: 'sawtooth', gain: 0.13, filter: 1100, attack: 0.04 });
      if (i === 3) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5.5;
        const lg = ctx.createGain();
        lg.gain.value = 9;
        lfo.connect(lg).connect(o.frequency);
        lfo.start(at + 0.2);
        lfo.stop(at + dur);
        o.frequency.setValueAtTime(f, at);
        o.frequency.linearRampToValueAtTime(f * 0.94, at + dur);
      }
    });
  }
}

export const sfx = new Sfx();
