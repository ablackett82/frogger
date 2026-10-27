// Sound effects and jingles, made on the spot with WebAudio oscillators and
// noise — no sound files.

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.noiseBuf = null; }

  /** Must be called from a user gesture on iOS. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.5;
      this.out.connect(this.ctx.destination);
      const n = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, n, n);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  play(name, arg) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    SOUNDS[name]?.(this, this.ctx.currentTime + 0.01, arg);
  }

  tone(t, { type = 'square', f0, f1 = f0, dur, vol = 0.15 }) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(t, { dur, vol = 0.3, type = 'lowpass', f0 = 2000, f1 = f0, q = 1 }) {
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noiseBuf;
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.out);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  tune(t, notes, step, type = 'square', vol = 0.12) {
    notes.forEach((n, i) => { if (n) this.tone(t + i * step, { type, f0: midi(n), dur: step * 0.95, vol }); });
  }
}

const SOUNDS = {
  hop: (s, t) => s.tone(t, { f0: 420, f1: 700, dur: 0.05, vol: 0.06 }),
  ding: (s, t) => s.tone(t, { type: 'triangle', f0: 1320, dur: 0.3, vol: 0.18 }),
  train: (s, t) => {
    s.tone(t, { type: 'sawtooth', f0: 233, dur: 0.8, vol: 0.06 });
    s.tone(t, { type: 'sawtooth', f0: 294, dur: 0.8, vol: 0.06 });
    s.noise(t, { dur: 1.4, vol: 0.25, f0: 300, f1: 120 });
  },
  pickup: (s, t) => s.tune(t, [72, 76, 79], 0.06),
  deliver: (s, t) => s.tune(t, [67, 71, 74, 79, 83], 0.07, 'triangle', 0.2),
  munch: (s, t) => { s.noise(t, { dur: 0.06, vol: 0.4, type: 'highpass', f0: 2500 }); s.noise(t + 0.1, { dur: 0.06, vol: 0.4, type: 'highpass', f0: 2500 }); },
  yelp: (s, t) => { s.tone(t, { type: 'triangle', f0: 900, f1: 1600, dur: 0.08, vol: 0.2 }); s.tone(t + 0.08, { type: 'triangle', f0: 1500, f1: 600, dur: 0.15, vol: 0.2 }); },
  tick: (s, t) => s.tone(t, { f0: 1000, dur: 0.04, vol: 0.06 }),
  life: (s, t) => s.tune(t, [72, 76, 79, 84, 79, 84], 0.07),
  level: (s, t, e) => s.tune(t, e?.night ? [57, 60, 64, 62, 60, 57, 0, 64] : [60, 64, 67, 72, 0, 67, 72, 76], 0.1, 'triangle', 0.18),
  clear: (s, t) => {
    s.tune(t, [67, 72, 76, 74, 72, 76, 79, 0, 81, 79, 76, 84], 0.11, 'square', 0.1);
    s.tune(t, [48, 0, 55, 0, 52, 0, 55, 0, 53, 0, 55, 48], 0.11, 'triangle', 0.18);
  },
  gameover: (s, t) => s.tune(t, [67, 66, 64, 62, 60, 55, 0, 48], 0.17, 'triangle', 0.2),
  die: (s, t, e) => {
    switch (e?.cause) {
      case 'splash': s.noise(t, { dur: 0.6, vol: 0.5, type: 'bandpass', f0: 2400, f1: 300, q: 2 }); break;
      case 'hunger': s.tone(t, { type: 'sine', f0: 600, f1: 140, dur: 1.0, vol: 0.25 }); break;
      case 'fox': s.noise(t, { dur: 0.25, vol: 0.5, f0: 1800, f1: 400 }); s.tone(t, { type: 'sawtooth', f0: 220, f1: 90, dur: 0.3, vol: 0.12 }); break;
      default: s.noise(t, { dur: 0.35, vol: 0.6, f0: 1400, f1: 150 }); s.tone(t, { type: 'sawtooth', f0: 320, f1: 60, dur: 0.35, vol: 0.12 });
    }
  },
};
