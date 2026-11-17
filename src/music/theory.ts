import type { Song } from './types';

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const SOLFEGE = ['Do', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
const STEP_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

export type NameStyle = 'solfege' | 'letters';

export function spelledToMidi(step: number, alter: number, octave: number): number {
  return (octave + 1) * 12 + STEP_SEMITONES[step] + alter;
}

/** Spell a midi pitch, preferring flats if `flats` is true. */
export function spellMidi(midi: number, flats = false): { step: number; alter: number; octave: number } {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const natural = STEP_SEMITONES.indexOf(pc);
  if (natural >= 0) return { step: natural, alter: 0, octave };
  if (flats) {
    const step = STEP_SEMITONES.indexOf(pc + 1);
    return { step, alter: -1, octave };
  }
  const step = STEP_SEMITONES.indexOf(pc - 1);
  return { step, alter: 1, octave };
}

export function octaveOf(midi: number, step: number, alter: number): number {
  // octave such that spelledToMidi(step, alter, octave) === midi
  return Math.round((midi - STEP_SEMITONES[step] - alter) / 12) - 1;
}

export function accidentalSymbol(alter: number): string {
  return alter === 1 ? '♯' : alter === -1 ? '♭' : alter === 2 ? '𝄪' : alter === -2 ? '𝄫' : '';
}

export function noteName(step: number, alter: number, style: NameStyle = 'solfege'): string {
  const base = style === 'solfege' ? SOLFEGE[step] : LETTERS[step];
  return base + accidentalSymbol(alter);
}

export function midiName(midi: number, style: NameStyle = 'solfege', flats = false): string {
  const s = spellMidi(midi, flats);
  return noteName(s.step, s.alter, style);
}

export function midiNameWithOctave(midi: number, style: NameStyle = 'solfege'): string {
  const s = spellMidi(midi);
  return noteName(s.step, s.alter, style) + s.octave;
}

export function isBlack(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
}

/** Order in which sharps / flats appear in a key signature (letter indexes). */
export const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6]; // F C G D A E B
export const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3]; // B E A D G C F

/** Alteration applied by a key signature to each letter. */
export function keyAlterations(fifths: number): number[] {
  const alt = [0, 0, 0, 0, 0, 0, 0];
  if (fifths > 0) for (let i = 0; i < fifths; i++) alt[SHARP_ORDER[i]] = 1;
  if (fifths < 0) for (let i = 0; i < -fifths; i++) alt[FLAT_ORDER[i]] = -1;
  return alt;
}

const KEY_NAMES: Record<number, string> = {
  [-7]: 'Do♭ majeur', [-6]: 'Sol♭ majeur', [-5]: 'Ré♭ majeur', [-4]: 'La♭ majeur', [-3]: 'Mi♭ majeur',
  [-2]: 'Si♭ majeur', [-1]: 'Fa majeur', 0: 'Do majeur', 1: 'Sol majeur', 2: 'Ré majeur', 3: 'La majeur',
  4: 'Mi majeur', 5: 'Si majeur', 6: 'Fa♯ majeur', 7: 'Do♯ majeur',
};
export function keyName(fifths: number): string {
  return KEY_NAMES[fifths] ?? '';
}

/** Diatonic index (used for vertical placement on the staff). */
export function diatonic(step: number, octave: number): number {
  return octave * 7 + step;
}

export function beatsPerBar(song: Pick<Song, 'timeSig'>): number {
  return (song.timeSig[0] * 4) / song.timeSig[1];
}

/** Beat duration of one metronome click. */
export function clickBeats(song: Pick<Song, 'timeSig'>): number {
  const [num, den] = song.timeSig;
  // compound meters (6/8, 9/8, 12/8) click on dotted quarters
  if (den === 8 && num % 3 === 0 && num > 3) return 1.5;
  return 4 / den;
}

export function songEnd(song: Song): number {
  let end = 0;
  for (const n of song.notes) end = Math.max(end, n.start + n.dur);
  for (const r of song.rests) end = Math.max(end, r.start + r.dur);
  return end;
}

/** Start beat of bar `bar` (bar 1 = first full bar; bar 0 = pickup). */
export function barStart(song: Song, bar: number): number {
  const bpb = beatsPerBar(song);
  if (bar <= 0) return 0;
  return song.pickup + (bar - 1) * bpb;
}

export function barCount(song: Song): number {
  const bpb = beatsPerBar(song);
  return Math.max(1, Math.ceil((songEnd(song) - song.pickup - 1e-6) / bpb));
}

export function barAt(song: Song, beat: number): number {
  if (beat < song.pickup) return 0;
  return Math.floor((beat - song.pickup) / beatsPerBar(song) + 1e-9) + 1;
}
