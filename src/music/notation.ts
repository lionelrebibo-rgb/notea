import type { Hand, Note, Rest, Song } from './types';
import { LETTERS, spelledToMidi } from './theory';

/**
 * Compact text notation used to write the built-in pieces.
 *
 *   token   := pitches duration ["." ] ["-" fingers]
 *   pitches := pitch ("+" pitch)*   |  "r" (rest)
 *   pitch   := letter [#|b] octave  e.g. C4, F#4, Bb3
 *   duration:= w (4) | h (2) | q (1) | e (1/2) | s (1/4)   "." = dotted
 *   fingers := digits, one per pitch, e.g. "-135"
 *   "|" bar lines are ignored (only for readability).
 *
 * Example: "C4q-1 D4q-2 E4h-3 | C4+E4+G4w"
 */
const DUR: Record<string, number> = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25, t: 1 / 3 };
const TOKEN = /^((?:[A-G](?:#|b)?\d\+?)+|r)([whqest])(\.{0,2})(?:-(\d+))?$/;
const PITCH = /([A-G])(#|b)?(\d)/g;

export function parseVoice(text: string, hand: Hand, offset = 0): { notes: Note[]; rests: Rest[]; length: number } {
  const notes: Note[] = [];
  const rests: Rest[] = [];
  let t = offset;
  const tokens = text.split(/\s+/).filter((x) => x && x !== '|');
  for (const tok of tokens) {
    const m = TOKEN.exec(tok);
    if (!m) throw new Error(`Notation invalide: "${tok}"`);
    let dur = DUR[m[2]];
    if (m[3] === '.') dur *= 1.5;
    if (m[3] === '..') dur *= 1.75;
    if (m[1] === 'r') {
      rests.push({ start: t, dur, hand });
    } else {
      const fingers = m[4] ? m[4].split('').map(Number) : [];
      let i = 0;
      for (const p of m[1].matchAll(PITCH)) {
        const step = LETTERS.indexOf(p[1]);
        const alter = p[2] === '#' ? 1 : p[2] === 'b' ? -1 : 0;
        const octave = parseInt(p[3], 10);
        notes.push({ midi: spelledToMidi(step, alter, octave), start: t, dur, hand, step, alter, finger: fingers[i] });
        i++;
      }
    }
    t += dur;
  }
  return { notes, rests, length: t - offset };
}

export interface SongDef {
  id: string;
  title: string;
  composer: string;
  level: number;
  bpm: number;
  timeSig?: [number, number];
  key?: number;
  pickup?: number;
  right?: string;
  left?: string;
  tags?: string[];
  description?: string;
}

export function buildSong(def: SongDef): Song {
  const notes: Note[] = [];
  const rests: Rest[] = [];
  if (def.right) {
    const v = parseVoice(def.right, 'R');
    notes.push(...v.notes);
    rests.push(...v.rests);
  }
  if (def.left) {
    const v = parseVoice(def.left, 'L');
    notes.push(...v.notes);
    rests.push(...v.rests);
  }
  notes.sort((a, b) => a.start - b.start || a.midi - b.midi);
  return {
    id: def.id,
    title: def.title,
    composer: def.composer,
    level: def.level,
    bpm: def.bpm,
    timeSig: def.timeSig ?? [4, 4],
    key: def.key ?? 0,
    pickup: def.pickup ?? 0,
    notes,
    rests,
    tags: def.tags,
    description: def.description,
  };
}

/** Extract a section of a song (beats [from, to)) re-based to 0. */
export function sliceSong(song: Song, from: number, to: number, id?: string): Song {
  const notes = song.notes
    .filter((n) => n.start >= from - 1e-6 && n.start < to - 1e-6)
    .map((n) => ({ ...n, start: n.start - from }));
  const rests = song.rests
    .filter((r) => r.start >= from - 1e-6 && r.start < to - 1e-6)
    .map((r) => ({ ...r, start: r.start - from }));
  // keep bar lines aligned: if from is inside the pickup or at a bar, compute pickup accordingly
  const bpb = (song.timeSig[0] * 4) / song.timeSig[1];
  let pickup = 0;
  if (from < song.pickup) pickup = song.pickup - from;
  else {
    const into = (from - song.pickup) % bpb;
    pickup = into > 1e-6 ? bpb - into : 0;
  }
  return { ...song, id: id ?? `${song.id}@${from}-${to}`, notes, rests, pickup };
}
