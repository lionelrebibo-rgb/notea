export type Hand = 'R' | 'L';

/** A note of a piece. Times are in beats (1 beat = 1 quarter note). */
export interface Note {
  midi: number;
  start: number;
  dur: number;
  hand: Hand;
  finger?: number;
  /** Spelling: letter index 0..6 (C..B) and alteration (-1, 0, 1). */
  step: number;
  alter: number;
}

export interface Rest {
  start: number;
  dur: number;
  hand: Hand;
}

export interface Song {
  id: string;
  title: string;
  composer: string;
  /** 1 (very easy) .. 5 */
  level: number;
  bpm: number;
  /** [numerator, denominator] */
  timeSig: [number, number];
  /** Key signature, in fifths: -7..7 (e.g. 1 = G major / one sharp). */
  key: number;
  /** Length of the pickup bar, in beats (0 if none). */
  pickup: number;
  notes: Note[];
  rests: Rest[];
  tags?: string[];
  imported?: boolean;
  /** Optional short text shown before playing. */
  description?: string;
}

export type HandSel = 'R' | 'L' | 'both';
