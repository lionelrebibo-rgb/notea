import type { Hand, Note, Song } from '../music/types';
import { spellMidi } from '../music/theory';
import { parseVoice } from '../music/notation';

/** Deterministic random generator (so a lesson step stays the same between tries). */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function mk(id: string, title: string, notes: Note[], opts: Partial<Song> = {}): Song {
  return {
    id,
    title,
    composer: 'Exercice',
    level: 1,
    bpm: 80,
    timeSig: [4, 4],
    key: 0,
    pickup: 0,
    notes,
    rests: [],
    ...opts,
  };
}

function note(midi: number, start: number, dur: number, hand: Hand, finger?: number, flats = false): Note {
  const s = spellMidi(midi, flats);
  return { midi, start, dur, hand, finger, step: s.step, alter: s.alter };
}

/** Five-finger pattern up and down (e.g. Do Ré Mi Fa Sol Fa Mi Ré Do). */
export function fiveFinger(hand: Hand, root = hand === 'R' ? 60 : 48, upTo = 5): Song {
  const scale = [0, 2, 4, 5, 7];
  const seq: number[] = [];
  for (let i = 0; i < upTo; i++) seq.push(i);
  for (let i = upTo - 2; i >= 0; i--) seq.push(i);
  const notes = seq.map((i, k) =>
    note(root + scale[i], k, k === seq.length - 1 ? 2 : 1, hand, hand === 'R' ? i + 1 : 5 - i),
  );
  return mk(`ex-five-${hand}-${root}-${upTo}`, hand === 'R' ? 'Position de Do – main droite' : 'Position de Do – main gauche', notes);
}

/** Both hands, same pattern, an octave apart. */
export function fiveFingerBoth(): Song {
  const r = fiveFinger('R');
  const l = fiveFinger('L');
  return mk('ex-five-both', 'Les deux mains ensemble', [...r.notes, ...l.notes].sort((a, b) => a.start - b.start || a.midi - b.midi), {
    bpm: 70,
  });
}

/** Note reading: random notes from a pool, one at a time. */
export function noteQuiz(pool: number[], count: number, hand: Hand, seed: number, flats = false): Song {
  const r = rng(seed);
  const notes: Note[] = [];
  let prev = -1;
  for (let i = 0; i < count; i++) {
    let m = pool[Math.floor(r() * pool.length)];
    if (pool.length > 1) while (m === prev) m = pool[Math.floor(r() * pool.length)];
    prev = m;
    notes.push(note(m, i * 2, 1, hand, undefined, flats));
  }
  const rests = notes.map((n) => ({ start: n.start + 1, dur: 1, hand }));
  return { ...mk(`ex-quiz-${seed}`, 'Lecture de notes', notes, { bpm: 90 }), rests };
}

/** Find the key: the same note name in several octaves. */
export function findNote(pc: number, octaves: number[]): Song {
  const notes = octaves.map((o, i) => note((o + 1) * 12 + pc, i * 2, 2, o >= 4 ? 'R' : 'L'));
  return mk(`ex-find-${pc}`, 'Trouve la note', notes, { bpm: 70 });
}

/** Repeated note (very first exercise). */
export function repeatNote(midi: number, count: number, finger: number, hand: Hand = 'R'): Song {
  const notes: Note[] = [];
  for (let i = 0; i < count; i++) notes.push(note(midi, i, 1, hand, finger));
  return mk(`ex-rep-${midi}`, 'Le Do central', notes, { bpm: 70 });
}

const SCALES: Record<string, { root: number; key: number; fr: number[]; fl: number[] }> = {
  C: { root: 60, key: 0, fr: [1, 2, 3, 1, 2, 3, 4, 5], fl: [5, 4, 3, 2, 1, 3, 2, 1] },
  G: { root: 55, key: 1, fr: [1, 2, 3, 1, 2, 3, 4, 5], fl: [5, 4, 3, 2, 1, 3, 2, 1] },
  F: { root: 53, key: -1, fr: [1, 2, 3, 4, 1, 2, 3, 4], fl: [5, 4, 3, 2, 1, 3, 2, 1] },
  D: { root: 62, key: 2, fr: [1, 2, 3, 1, 2, 3, 4, 5], fl: [5, 4, 3, 2, 1, 3, 2, 1] },
};
const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];

/** One-octave major scale up and down with standard fingering. */
export function scale(name: keyof typeof SCALES, hand: Hand): Song {
  const sc = SCALES[name];
  const root = hand === 'R' ? sc.root : sc.root - 12;
  const fingers = hand === 'R' ? sc.fr : sc.fl;
  const idx = [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0];
  const flats = sc.key < 0;
  const notes = idx.map((i, k) => {
    // fingering going down mirrors going up
    return note(root + MAJOR[i], k, k === idx.length - 1 ? 2 : 1, hand, fingers[i], flats);
  });
  const fr = { C: 'Do', G: 'Sol', F: 'Fa', D: 'Ré' }[name];
  return mk(`ex-scale-${name}-${hand}`, `Gamme de ${fr} majeur – ${hand === 'R' ? 'main droite' : 'main gauche'}`, notes, {
    key: sc.key,
    bpm: 72,
  });
}

/** Rhythm exercise: any key is accepted, only timing counts. Pattern uses the compact notation on C. */
export function rhythm(id: string, pattern: string, bpm = 80): Song {
  const v = parseVoice(pattern, 'R');
  return { ...mk(`ex-rhythm-${id}`, 'Exercice de rythme', v.notes, { bpm }), rests: v.rests };
}

/** Block chords. */
export function chords(id: string, title: string, text: string, hand: Hand, bpm = 70): Song {
  const v = parseVoice(text, hand);
  return { ...mk(`ex-chords-${id}`, title, v.notes, { bpm }), rests: v.rests };
}

/** Same melody played by the left hand one octave lower (fingers mirrored in 5-finger position). */
export function toLeftHand(song: Song, id?: string): Song {
  return {
    ...song,
    id: id ?? `${song.id}-mg`,
    title: `${song.title} (main gauche)`,
    notes: song.notes
      .filter((n) => n.hand === 'R')
      .map((n) => ({ ...n, midi: n.midi - 12, hand: 'L' as Hand, finger: n.finger ? 6 - n.finger : undefined })),
    rests: song.rests.filter((r) => r.hand === 'R').map((r) => ({ ...r, hand: 'L' as Hand })),
  };
}

/** Pools for note reading quizzes. */
export const POOLS = {
  trebleC: [60, 62, 64, 65, 67],
  trebleLines: [64, 67, 71, 74, 77],
  trebleSpaces: [65, 69, 72, 76],
  trebleAll: [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79],
  bassC: [48, 50, 52, 53, 55],
  bassAll: [43, 45, 47, 48, 50, 52, 53, 55, 57, 59, 60],
  black: [61, 63, 66, 68, 70],
};
