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
  // the little two-note hop that Frogger is known for
  hop: (s, t) => { s.tone(t, { type: 'square', f0: 330, f1: 660, dur: 0.05, vol: 0.09 }); s.tone(t + 0.05, { type: 'square', f0: 880, dur: 0.05, vol: 0.07 }); },
  tick: (s, t) => s.tone(t, { f0: 1100, dur: 0.04, vol: 0.07 }),
  ladypickup: (s, t) => s.tune(t, [76, 81], 0.07, 'triangle', 0.18),
  home: (s, t, e) => {
    s.tune(t, [72, 76, 79, 84], 0.06, 'triangle', 0.18);
    if (e?.fly) s.tune(t + 0.26, [88, 91], 0.07, 'square', 0.14);
    if (e?.lady) s.tune(t + 0.26, [79, 83, 86, 91], 0.07, 'triangle', 0.16);
  },
  life: (s, t) => s.tune(t, [72, 76, 79, 84, 79, 84], 0.07),
  level: (s, t) => s.tune(t, [60, 64, 67, 72, 0, 72, 67, 64, 67], 0.1, 'triangle', 0.16),
  clear: (s, t) => {
    // the "all five frogs home" tune
    s.tune(t, [72, 74, 76, 77, 79, 0, 79, 81, 83, 84], 0.11, 'square', 0.1);
    s.tune(t, [48, 0, 55, 0, 52, 0, 55, 0, 53, 55], 0.11, 'triangle', 0.17);
  },
  gameover: (s, t) => s.tune(t, [67, 66, 64, 62, 60, 55, 0, 48], 0.17, 'triangle', 0.2),
  die: (s, t, e) => {
    switch (e?.cause) {
      case 'drown': s.noise(t, { dur: 0.5, vol: 0.5, type: 'bandpass', f0: 1800, f1: 250, q: 2 }); s.tone(t, { type: 'sine', f0: 500, f1: 120, dur: 0.4, vol: 0.14 }); break;
      case 'time': s.tone(t, { type: 'sine', f0: 523, f1: 110, dur: 1.0, vol: 0.22 }); break;
      case 'squish': s.noise(t, { dur: 0.35, vol: 0.6, f0: 1500, f1: 150 }); s.tone(t, { type: 'sawtooth', f0: 300, f1: 60, dur: 0.35, vol: 0.14 }); break;
      case 'croc': // the chomp of the jaws
        s.noise(t, { dur: 0.08, vol: 0.5, type: 'lowpass', f0: 900 });
        s.noise(t + 0.09, { dur: 0.1, vol: 0.6, type: 'lowpass', f0: 500 });
        s.tone(t, { type: 'sawtooth', f0: 180, f1: 60, dur: 0.3, vol: 0.16 });
        break;
      default: s.tone(t, { type: 'square', f0: 400, f1: 80, dur: 0.5, vol: 0.18 }); // hedge / occupied bay
    }
  },
};
