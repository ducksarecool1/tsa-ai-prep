// Sound effects, synthesized with the Web Audio API: no audio files, works offline.
// The audio context is created on the first sound, which always follows a click or key press,
// so browsers allow it to play.

export type SoundName =
  | 'tap'
  | 'correct'
  | 'wrong'
  | 'almost'
  | 'combo'
  | 'flip'
  | 'round'
  | 'perfect'
  | 'complete'
  | 'levelup'
  | 'achievement'
  | 'goal';

let enabled = true;
let volume = 0.6;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function configureSound(on: boolean, vol: number): void {
  enabled = on;
  volume = Math.max(0, Math.min(1, vol));
  if (master && ctx) master.gain.setValueAtTime(volume * 0.5, ctx.currentTime);
}

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = volume * 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, out: master! };
}

interface Note {
  freq: number;
  /** Seconds after the sound starts. */
  at: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  /** Glide to this frequency by the end of the note. */
  slideTo?: number;
}

function playNotes(notes: Note[]): void {
  const a = audio();
  if (!a) return;
  const t0 = a.ctx.currentTime + 0.01;
  for (const n of notes) {
    const osc = a.ctx.createOscillator();
    const env = a.ctx.createGain();
    osc.type = n.type ?? 'sine';
    const start = t0 + n.at;
    const end = start + n.dur;
    osc.frequency.setValueAtTime(n.freq, start);
    if (n.slideTo) osc.frequency.exponentialRampToValueAtTime(n.slideTo, end);
    const peak = n.gain ?? 0.5;
    // Short attack and smooth decay avoid clicks.
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(env).connect(a.out);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

function playNoise(dur: number, from: number, to: number, gain = 0.25): void {
  const a = audio();
  if (!a) return;
  const t0 = a.ctx.currentTime + 0.01;
  const buffer = a.ctx.createBuffer(1, Math.floor(a.ctx.sampleRate * dur), a.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = a.ctx.createBufferSource();
  src.buffer = buffer;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(env).connect(a.out);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

// Note frequencies (Hz).
const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880, B5 = 987.77;
const C6 = 1046.5, E6 = 1318.51, G6 = 1567.98, C7 = 2093;

function arpeggio(freqs: number[], step: number, dur: number, type: OscillatorType = 'triangle', gain = 0.35): Note[] {
  return freqs.map((freq, i) => ({ freq, at: i * step, dur, type, gain }));
}

const SOUNDS: Record<SoundName, () => void> = {
  tap: () => playNotes([{ freq: 1400, at: 0, dur: 0.035, type: 'sine', gain: 0.15 }]),
  // Bright rising two-note chime.
  correct: () =>
    playNotes([
      { freq: E6, at: 0, dur: 0.12, type: 'triangle', gain: 0.4 },
      { freq: A5 * 2, at: 0.09, dur: 0.22, type: 'triangle', gain: 0.4 },
      { freq: A5 * 4, at: 0.09, dur: 0.16, type: 'sine', gain: 0.06 },
    ]),
  // Soft, low, falling tone: clear but not harsh.
  wrong: () =>
    playNotes([
      { freq: 311, at: 0, dur: 0.16, type: 'triangle', gain: 0.35, slideTo: 262 },
      { freq: 233, at: 0.13, dur: 0.24, type: 'triangle', gain: 0.35, slideTo: 196 },
    ]),
  almost: () => playNotes([{ freq: G5, at: 0, dur: 0.1, type: 'sine', gain: 0.3 }, { freq: A5, at: 0.08, dur: 0.12, type: 'sine', gain: 0.25 }]),
  // Quick rising arpeggio for combo milestones.
  combo: () => playNotes([...arpeggio([C6, E6, G6, C7], 0.055, 0.14, 'triangle', 0.32), { freq: C7, at: 0.22, dur: 0.3, type: 'sine', gain: 0.12 }]),
  flip: () => playNoise(0.12, 900, 2400, 0.18),
  round: () => playNotes(arpeggio([C5, E5, G5, C6], 0.08, 0.2)),
  perfect: () =>
    playNotes([
      ...arpeggio([C5, E5, G5, C6, E6], 0.07, 0.2, 'triangle', 0.32),
      { freq: G6, at: 0.36, dur: 0.4, type: 'sine', gain: 0.15 },
    ]),
  // Short fanfare ending on a held chord.
  complete: () =>
    playNotes([
      ...arpeggio([G5, C6, E6], 0.1, 0.16, 'square', 0.12),
      { freq: C6, at: 0.32, dur: 0.6, type: 'triangle', gain: 0.3 },
      { freq: E6, at: 0.32, dur: 0.6, type: 'triangle', gain: 0.25 },
      { freq: G6, at: 0.32, dur: 0.6, type: 'triangle', gain: 0.22 },
    ]),
  levelup: () =>
    playNotes([
      ...arpeggio([C5, E5, G5, C6, E6, G6], 0.06, 0.16, 'triangle', 0.3),
      { freq: C7, at: 0.36, dur: 0.5, type: 'sine', gain: 0.14 },
    ]),
  // Bell-like: a fundamental plus a quiet inharmonic overtone.
  achievement: () =>
    playNotes([
      { freq: B5, at: 0, dur: 0.5, type: 'sine', gain: 0.35 },
      { freq: B5 * 2.76, at: 0, dur: 0.3, type: 'sine', gain: 0.06 },
      { freq: E6, at: 0.14, dur: 0.6, type: 'sine', gain: 0.35 },
      { freq: E6 * 2.76, at: 0.14, dur: 0.35, type: 'sine', gain: 0.06 },
    ]),
  goal: () => playNotes([...arpeggio([D5, G5, B5, D5 * 2, G6], 0.07, 0.22, 'triangle', 0.3)]),
};

export function playSound(name: SoundName): void {
  if (!enabled || volume <= 0) return;
  try {
    SOUNDS[name]();
  } catch {
    // Audio is a nice-to-have; never let it break the app.
  }
}
