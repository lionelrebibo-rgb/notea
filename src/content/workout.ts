import type { Profile } from '../store/store';
import { today } from '../store/store';
import { COURSES, lessonStars, type PlayStep } from './curriculum';
import * as ex from './exercises';
import { LIBRARY } from './songs';
import { barCount } from '../music/theory';

function daySeed() {
  return parseInt(today().replace(/-/g, ''), 10);
}

function completed(p: Profile, courseId: string) {
  const c = COURSES.find((x) => x.id === courseId)!;
  return c.lessons.filter((l) => lessonStars(l, p.lessonSteps).complete).length;
}

function randomRhythm(seed: number): string {
  const r = ex.rng(seed);
  const cells = ['C4q C4q', 'C4h', 'C4e C4e C4q', 'C4q C4e C4e', 'C4q rq', 'C4e C4e C4e C4e'];
  const bars: string[] = [];
  for (let b = 0; b < 3; b++) {
    bars.push(cells[Math.floor(r() * cells.length)] + ' ' + cells[Math.floor(r() * cells.length)]);
  }
  bars.push('C4w');
  return bars.join(' | ');
}

/** The personalised ~5 minute daily workout. */
export function buildWorkout(p: Profile): PlayStep[] {
  const seed = daySeed();
  const steps: PlayStep[] = [];
  const knowsLeft = completed(p, 'c3') > 0 || p.startLevel >= 4;
  const knowsReading = completed(p, 'c2') > 0 || p.startLevel >= 3;
  const knowsScales = completed(p, 'c5') > 1 || p.startLevel >= 6;

  const base: Partial<PlayStep> = { kind: 'play', mode: 'wait', hints: 'auto', names: true, hands: 'R' };

  // 1. warm-up
  if (knowsScales) {
    const sc = (['C', 'G'] as const)[seed % 2];
    steps.push({ ...base, title: 'Échauffement : gamme', song: () => ex.scale(sc, 'R'), mode: 'rhythm', tempo: 0.8, metronome: true } as PlayStep);
  } else {
    steps.push({ ...base, title: 'Échauffement : 5 doigts', song: () => ex.fiveFinger('R'), mode: 'rhythm', tempo: 0.8, metronome: true } as PlayStep);
  }
  if (knowsLeft) {
    steps.push({ ...base, title: 'Échauffement main gauche', song: () => ex.fiveFinger('L'), hands: 'L', mode: 'rhythm', tempo: 0.8, metronome: true } as PlayStep);
  }

  // 2. note reading
  const pool = knowsReading ? ex.POOLS.trebleAll : ex.POOLS.trebleC;
  steps.push({ ...base, title: 'Lecture express', song: () => ex.noteQuiz(pool, 10, 'R', seed), names: false } as PlayStep);
  if (knowsLeft) {
    steps.push({ ...base, title: 'Lecture en clé de fa', song: () => ex.noteQuiz(ex.POOLS.bassAll, 8, 'L', seed + 7), hands: 'L', names: false } as PlayStep);
  }

  // 3. tricky notes (most frequently missed)
  const tricky = Object.entries(p.missed)
    .map(([m, n]) => ({ m: +m, n, ratio: n / ((p.hits[+m] || 0) + n) }))
    .filter((x) => x.n >= 3 && x.ratio > 0.15)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 5)
    .map((x) => x.m);
  if (tricky.length >= 2) {
    const hand = tricky.every((m) => m < 60) ? 'L' : 'R';
    const pool2 = tricky.filter((m) => (hand === 'L' ? m < 60 : m >= 55));
    if (pool2.length >= 2) {
      steps.push({ ...base, title: 'Tes notes difficiles', song: () => ex.noteQuiz(pool2, 8, hand, seed + 3), hands: hand, names: false } as PlayStep);
    }
  }

  // 4. rhythm
  steps.push({
    ...base,
    title: 'Rythme du jour',
    song: () => ex.rhythm(`w${seed}`, randomRhythm(seed), 80),
    mode: 'rhythm',
    anyKey: true,
    metronome: true,
    names: false,
  } as PlayStep);

  // 5. review: a played song with the fewest stars (or a first easy song)
  const played = Object.entries(p.songs)
    .map(([id, r]) => ({ id: id.split('@')[0], ...r }))
    .filter((x) => LIBRARY.some((s) => s.id === x.id));
  played.sort((a, b) => a.stars - b.stars || a.last - b.last);
  const reviewId = played[0]?.id ?? 'marie';
  const song = LIBRARY.find((s) => s.id === reviewId)!;
  const bars = Math.min(8, barCount(song));
  steps.push({
    ...base,
    title: `Révision : ${song.title}`,
    song: () => song,
    bars: [song.pickup > 0 ? 0 : 1, bars],
    mode: 'rhythm',
    tempo: 0.85,
  } as PlayStep);

  return steps;
}
