import { PitchDetector } from 'pitchy';
import { emitNoteOff, emitNoteOn } from './hub';

/**
 * Microphone note detection (fallback for iPad, where Web MIDI is not available).
 * Monophonic: works well for melodies, not for chords.
 *
 * iOS Safari notes:
 *  - the mic gets its own AudioContext, created after getUserMedia so its sample rate
 *    matches the microphone (a mismatched context gives pure silence on iOS);
 *  - the analyser is routed to the output through a muted gain, otherwise WebKit may
 *    not pull audio through the graph;
 *  - the context is resumed on the next touch if iOS suspends/interrupts it.
 */
let stream: MediaStream | null = null;
let ctx: AudioContext | null = null;
let raf = 0;
let current: number | null = null;
let candidate: number | null = null;
let candidateFrames = 0;
let lowRms = 1;
let lastOnset = 0;
let level = 0;
let lastError: string | null = null;

export function supportsMic() {
  return !!navigator.mediaDevices?.getUserMedia;
}

export function micActive() {
  return !!stream;
}

/** Current input level, 0..1 (for a VU meter). */
export function micLevel() {
  return level;
}

/** Technical state, shown in the settings to diagnose problems. */
export function micDiag() {
  const t = stream?.getAudioTracks()[0];
  return {
    active: !!stream,
    audio: ctx?.state ?? 'none',
    rate: ctx?.sampleRate ?? 0,
    track: t ? (t.muted ? 'muted' : t.readyState) : 'none',
    level,
  };
}

/** Last error, as a French message ready to show. */
export function micError() {
  return lastError;
}

const resumeOnTouch = () => {
  if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
};

function explain(e: unknown): string {
  const name = (e as { name?: string })?.name ?? '';
  if (!window.isSecureContext) return 'Le micro demande une connexion sécurisée (https).';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Accès au micro refusé. Sur iPad : Réglages → Safari → Microphone → Autoriser, puis relance l’appli.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Aucun micro trouvé sur cet appareil.';
  if (name === 'NotReadableError') return 'Le micro est déjà utilisé par une autre appli. Ferme-la et réessaie.';
  return 'Impossible de démarrer le micro (' + (name || 'erreur inconnue') + ').';
}

async function getStream(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') throw e;
    // some devices reject the constraints: retry with the defaults
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  }
}

export async function startMic(): Promise<boolean> {
  if (stream) return true;
  lastError = null;
  if (!supportsMic()) {
    lastError = window.isSecureContext ? 'Ce navigateur ne donne pas accès au micro.' : 'Le micro demande une connexion sécurisée (https).';
    return false;
  }
  try {
    // Safari 17+: allow recording and playback at the same time
    const as = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (as) as.type = 'play-and-record';
  } catch {
    /* ignore */
  }
  try {
    stream = await getStream();
  } catch (e) {
    stream = null;
    lastError = explain(e);
    return false;
  }

  const AC = window.AudioContext || (window as any).webkitAudioContext;
  const rate = stream.getAudioTracks()[0]?.getSettings?.().sampleRate;
  try {
    ctx = rate ? new AC({ sampleRate: rate }) : new AC();
  } catch {
    ctx = new AC();
  }
  await ctx.resume().catch(() => {});
  document.addEventListener('pointerdown', resumeOnTouch, true);
  document.addEventListener('touchend', resumeOnTouch, true);
  ctx.onstatechange = () => {
    if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {});
  };

  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  const mute = ctx.createGain();
  mute.gain.value = 0;
  src.connect(analyser);
  analyser.connect(mute);
  mute.connect(ctx.destination);

  const buf = new Float32Array(analyser.fftSize);
  const detector = PitchDetector.forFloat32Array(analyser.fftSize);
  detector.minVolumeDecibels = -60;
  const sampleRate = ctx.sampleRate;

  const tick = () => {
    analyser.getFloatTimeDomainData(buf);
    let rms = 0;
    for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / buf.length);
    level = Math.min(1, Math.sqrt(rms) * 2.5);
    const now = performance.now();

    // onset detection: a sudden jump of energy re-triggers the same note
    lowRms = Math.min(lowRms * 1.02 + 0.0003, rms);
    const onset = rms > 0.01 && rms > lowRms * 2.2 && now - lastOnset > 120;
    if (onset) lastOnset = now;

    const [pitch, clarity] = detector.findPitch(buf, sampleRate);
    let midi: number | null = null;
    if (clarity > 0.85 && rms > 0.003 && pitch > 25 && pitch < 4200) {
      midi = Math.round(69 + 12 * Math.log2(pitch / 440));
    }

    if (midi === null) {
      if (current !== null && rms < 0.0025) {
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
        emitNoteOn({ midi, velocity: Math.min(1, rms * 12), time: now - 30, source: 'mic' });
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
  document.removeEventListener('pointerdown', resumeOnTouch, true);
  document.removeEventListener('touchend', resumeOnTouch, true);
  if (ctx) {
    ctx.onstatechange = null;
    ctx.close().catch(() => {});
    ctx = null;
  }
  if (current !== null) emitNoteOff({ midi: current, velocity: 0, time: performance.now(), source: 'mic' });
  current = null;
  level = 0;
}
