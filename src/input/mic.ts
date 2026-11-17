import { PitchDetector } from 'pitchy';
import { audioCtx } from '../audio/synth';
import { emitNoteOff, emitNoteOn } from './hub';

/**
 * Microphone note detection (fallback for iPad, where Web MIDI is not available).
 * Monophonic: works well for melodies, not for chords.
 */
let stream: MediaStream | null = null;
let raf = 0;
let current: number | null = null;
let candidate: number | null = null;
let candidateFrames = 0;
let lowRms = 1;
let lastOnset = 0;

export function supportsMic() {
  return !!navigator.mediaDevices?.getUserMedia;
}

export function micActive() {
  return !!stream;
}

export async function startMic(): Promise<boolean> {
  if (stream) return true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch {
    stream = null;
    return false;
  }
  const ctx = audioCtx();
  await ctx.resume().catch(() => {});
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  src.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const detector = PitchDetector.forFloat32Array(analyser.fftSize);
  detector.minVolumeDecibels = -45;

  const tick = () => {
    analyser.getFloatTimeDomainData(buf);
    let rms = 0;
    for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / buf.length);
    const now = performance.now();

    // onset detection: a sudden jump of energy re-triggers the same note
    lowRms = Math.min(lowRms * 1.02 + 0.0005, rms);
    const onset = rms > 0.02 && rms > lowRms * 2.2 && now - lastOnset > 120;
    if (onset) lastOnset = now;

    const [pitch, clarity] = detector.findPitch(buf, ctx.sampleRate);
    let midi: number | null = null;
    if (clarity > 0.88 && rms > 0.008 && pitch > 25 && pitch < 4200) {
      midi = Math.round(69 + 12 * Math.log2(pitch / 440));
    }

    if (midi === null) {
      if (current !== null && rms < 0.006) {
        emitNoteOff({ midi: current, velocity: 0, time: now, source: 'mic' });
        current = null;
      }
      candidate = null;
      candidateFrames = 0;
    } else if (midi !== current || (onset && midi === current)) {
      if (midi === candidate) candidateFrames++;
      else {
        candidate = midi;
        candidateFrames = 1;
      }
      if (candidateFrames >= 2) {
        if (current !== null) emitNoteOff({ midi: current, velocity: 0, time: now, source: 'mic' });
        current = midi;
        emitNoteOn({ midi, velocity: Math.min(1, rms * 8), time: now - 30, source: 'mic' });
        candidate = null;
        candidateFrames = 0;
        lowRms = rms;
      }
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return true;
}

export function stopMic() {
  cancelAnimationFrame(raf);
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  current = null;
}
