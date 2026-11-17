/**
 * Central place where every note played by the pupil arrives,
 * whatever the source: the real piano over MIDI, the microphone or the on-screen keyboard.
 */
export type InputSource = 'midi' | 'mic' | 'touch';

export interface NoteEvent {
  midi: number;
  velocity: number;
  /** performance.now() based timestamp */
  time: number;
  source: InputSource;
}

type Listener = (e: NoteEvent) => void;

const onListeners = new Set<Listener>();
const offListeners = new Set<Listener>();
export const held = new Set<number>();

export function onNoteOn(fn: Listener) {
  onListeners.add(fn);
  return () => { onListeners.delete(fn); };
}
export function onNoteOff(fn: Listener) {
  offListeners.add(fn);
  return () => { offListeners.delete(fn); };
}

export function emitNoteOn(e: NoteEvent) {
  held.add(e.midi);
  for (const l of onListeners) l(e);
}
export function emitNoteOff(e: NoteEvent) {
  held.delete(e.midi);
  for (const l of offListeners) l(e);
}
