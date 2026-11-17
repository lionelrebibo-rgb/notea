import { emitNoteOff, emitNoteOn } from './hub';

/**
 * Web MIDI connection to the digital piano (e.g. Clavinova via USB TO HOST + OTG cable).
 * Works in Chrome on Android / Windows / macOS. Not available in Safari on iPad.
 */
export type MidiStatus = 'unsupported' | 'idle' | 'denied' | 'no-device' | 'connected';

interface MidiState {
  status: MidiStatus;
  inputs: string[];
  outputs: string[];
  error?: string;
}

let access: MIDIAccess | null = null;
let state: MidiState = { status: supportsMidi() ? 'idle' : 'unsupported', inputs: [], outputs: [] };
const listeners = new Set<(s: MidiState) => void>();
let lastActivity = 0;

export function supportsMidi(): boolean {
  return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
}

export function midiState() {
  return state;
}

export function onMidiState(fn: (s: MidiState) => void) {
  listeners.add(fn);
  fn(state);
  return () => { listeners.delete(fn); };
}

function setState(s: Partial<MidiState>) {
  state = { ...state, ...s };
  for (const l of listeners) l(state);
}

export function lastMidiActivity() {
  return lastActivity;
}

function handleMessage(ev: MIDIMessageEvent) {
  const data = ev.data;
  if (!data || data.length < 2) return;
  const cmd = data[0] & 0xf0;
  const note = data[1];
  const vel = data.length > 2 ? data[2] : 0;
  // MIDI timestamps share the performance.now() clock
  const time = ev.timeStamp || performance.now();
  lastActivity = performance.now();
  if (cmd === 0x90 && vel > 0) {
    emitNoteOn({ midi: note, velocity: vel / 127, time, source: 'midi' });
  } else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) {
    emitNoteOff({ midi: note, velocity: 0, time, source: 'midi' });
  }
}

function refresh() {
  if (!access) return;
  const inputs: string[] = [];
  const outputs: string[] = [];
  access.inputs.forEach((input) => {
    inputs.push(input.name || 'Clavier MIDI');
    input.onmidimessage = handleMessage;
  });
  access.outputs.forEach((o) => outputs.push(o.name || 'Sortie MIDI'));
  setState({ inputs, outputs, status: inputs.length ? 'connected' : 'no-device' });
}

export async function connectMidi(): Promise<MidiStatus> {
  if (!supportsMidi()) {
    setState({ status: 'unsupported' });
    return 'unsupported';
  }
  try {
    access = await navigator.requestMIDIAccess({ sysex: false });
    access.onstatechange = () => refresh();
    refresh();
    return state.status;
  } catch (e: any) {
    setState({ status: 'denied', error: String(e?.message || e) });
    return 'denied';
  }
}

/* ---------- output: make the real piano play (Écouter / accompaniment) ---------- */

function outputs(): MIDIOutput[] {
  const list: MIDIOutput[] = [];
  access?.outputs.forEach((o) => list.push(o));
  return list;
}

export function hasMidiOut() {
  return outputs().length > 0;
}

export function midiOutNote(midi: number, durMs: number, velocity = 0.6, channel = 0) {
  const outs = outputs();
  if (!outs.length) return;
  const now = performance.now();
  const v = Math.max(1, Math.min(127, Math.round(velocity * 127)));
  for (const o of outs) {
    try {
      o.send([0x90 | channel, midi, v], now);
      o.send([0x80 | channel, midi, 0], now + Math.max(60, durMs - 15));
    } catch {
      /* port closed */
    }
  }
}

export function midiAllOff() {
  for (const o of outputs()) {
    try {
      for (let ch = 0; ch < 2; ch++) o.send([0xb0 | ch, 123, 0]);
    } catch {
      /* ignore */
    }
  }
}
