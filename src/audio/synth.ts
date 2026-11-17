/**
 * Small Web Audio piano-like synthesizer + metronome.
 * Used for "Écouter", the accompaniment of the other hand, and the on-screen keyboard.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let comp: DynamicsCompressorNode | null = null;
const voices = new Map<number, { stop: (t?: number) => void }>();

export function audioCtx(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(comp);
    comp.connect(ctx.destination);
  }
  return ctx;
}

export async function unlockAudio() {
  const c = audioCtx();
  if (c.state !== 'running') {
    try {
      await c.resume();
    } catch {
      /* ignore */
    }
  }
}

export function setVolume(v: number) {
  audioCtx();
  if (master) master.gain.value = v;
}

const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** Start a note. Returns a stop function. */
export function noteOn(midi: number, velocity = 0.8, when = 0) {
  const c = audioCtx();
  noteOff(midi, when);
  const t = Math.max(c.currentTime, when || c.currentTime);
  const f = freq(midi);
  const out = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  // brighter attack that darkens over time, like a real string
  const bright = Math.min(12000, f * (6 + velocity * 10));
  lp.frequency.setValueAtTime(bright, t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(f * 2, 400), t + 1.2);
  lp.Q.value = 0.5;

  const vel = 0.18 + velocity * 0.35;
  // decay faster for high notes
  const decay = Math.max(0.8, 6 - (midi - 40) * 0.07);
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(vel, t + 0.006);
  out.gain.exponentialRampToValueAtTime(vel * 0.45, t + 0.25);
  out.gain.exponentialRampToValueAtTime(0.0005, t + decay);

  const partials: [number, number, OscillatorType][] = [
    [1, 1, 'triangle'],
    [2, 0.35, 'sine'],
    [3, 0.12, 'sine'],
    [4.02, 0.06, 'sine'],
  ];
  const oscs: OscillatorNode[] = [];
  for (const [mult, gain, type] of partials) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f * mult;
    o.detune.value = (Math.random() - 0.5) * 4;
    const g = c.createGain();
    g.gain.value = gain;
    o.connect(g);
    g.connect(lp);
    o.start(t);
    o.stop(t + decay + 0.1);
    oscs.push(o);
  }
  lp.connect(out);
  out.connect(master!);

  const stop = (at?: number) => {
    const s = Math.max(c.currentTime, at ?? c.currentTime);
    try {
      out.gain.cancelScheduledValues(s);
      out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), s);
      out.gain.exponentialRampToValueAtTime(0.0001, s + 0.12);
      for (const o of oscs) o.stop(s + 0.15);
    } catch {
      /* already stopped */
    }
  };
  voices.set(midi, { stop });
  return stop;
}

export function noteOff(midi: number, when = 0) {
  const v = voices.get(midi);
  if (v) {
    v.stop(when || undefined);
    voices.delete(midi);
  }
}

export function allNotesOff() {
  for (const [, v] of voices) v.stop();
  voices.clear();
}

/** Play a note for a duration in seconds. */
export function playNote(midi: number, durSec: number, velocity = 0.7) {
  const c = audioCtx();
  const stop = noteOn(midi, velocity);
  stop(c.currentTime + Math.max(0.1, durSec));
  // forget the voice so later noteOff calls don't cut a new note
  setTimeout(() => {
    const v = voices.get(midi);
    if (v && v.stop === stop) voices.delete(midi);
  }, durSec * 1000 + 50);
}

export function click(accent = false) {
  const c = audioCtx();
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'square';
  o.frequency.value = accent ? 1760 : 1175;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(accent ? 0.35 : 0.2, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g);
  g.connect(master!);
  o.start(t);
  o.stop(t + 0.06);
}

/** Cheerful arpeggio played on success. */
export function fanfare(stars: number) {
  const seq = stars >= 3 ? [72, 76, 79, 84] : stars === 2 ? [72, 76, 79] : [72, 76];
  seq.forEach((m, i) => setTimeout(() => playNote(m, 0.4, 0.6), i * 110));
}

export function errorBuzz() {
  const c = audioCtx();
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sawtooth';
  o.frequency.value = 110;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
  o.connect(g);
  g.connect(master!);
  o.start(t);
  o.stop(t + 0.2);
}
