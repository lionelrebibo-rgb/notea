import { useSyncExternalStore } from 'react';
import type { Song } from '../music/types';

/* ---------------------------------------------------------------- types */

export interface Settings {
  input: 'midi' | 'mic' | 'touch';
  /** play the demo / accompaniment on the real piano over MIDI */
  midiOut: boolean;
  /** play app sounds (accompaniment, demo) through the device speaker */
  appSound: boolean;
  noteNames: 'solfege' | 'letters';
  showNoteNames: boolean;
  showFingers: boolean;
  view: 'staff' | 'falling';
  latencyMs: number;
  volume: number;
}

export interface SessionLog {
  date: string; // YYYY-MM-DD
  ts: number;
  seconds: number;
  kind: 'lesson' | 'song' | 'workout' | 'free';
  ref: string;
  title: string;
  accuracy?: number;
  stars?: number;
}

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  createdAt: number;
  startLevel: number;
  dailyGoalMin: number;
  settings: Settings;
  /** best stars per lesson step: lessonId -> stars per step index */
  lessonSteps: Record<string, number[]>;
  /** best result per song: songId -> {stars, accuracy, plays} */
  songs: Record<string, { stars: number; accuracy: number; plays: number; last: number }>;
  sessions: SessionLog[];
  xp: number;
  /** midi -> number of mistakes when that note was expected */
  missed: Record<number, number>;
  /** midi -> number of correct hits */
  hits: Record<number, number>;
  badges: Record<string, number>;
  /** set from the parent area: every lesson is open */
  unlockAll?: boolean;
}

interface Root {
  version: 1;
  activeProfile: string | null;
  profiles: Record<string, Profile>;
  parentPin: string | null;
  imported: Song[];
}

/* ---------------------------------------------------------------- defaults */

export const defaultSettings: Settings = {
  input: 'midi',
  midiOut: true,
  appSound: true,
  noteNames: 'solfege',
  showNoteNames: true,
  showFingers: true,
  view: 'staff',
  latencyMs: 0,
  volume: 0.7,
};

const KEY = 'notea.v1';

function load(): Root {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const r = JSON.parse(raw) as Root;
      for (const p of Object.values(r.profiles)) p.settings = { ...defaultSettings, ...p.settings };
      r.imported ??= [];
      return r;
    }
  } catch {
    /* corrupted / unavailable storage */
  }
  return { version: 1, activeProfile: null, profiles: {}, parentPin: null, imported: [] };
}

let root: Root = load();
const subs = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(root));
  } catch {
    /* storage full or blocked */
  }
}

function commit(next: Root) {
  root = next;
  persist();
  for (const s of subs) s();
}

function subscribe(fn: () => void) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function useRoot(): Root {
  return useSyncExternalStore(subscribe, () => root);
}

export function getRoot() {
  return root;
}

export function useProfile(): Profile | null {
  const r = useRoot();
  return r.activeProfile ? r.profiles[r.activeProfile] ?? null : null;
}

export function getProfile(): Profile | null {
  return root.activeProfile ? root.profiles[root.activeProfile] ?? null : null;
}

export function updateProfile(fn: (p: Profile) => Profile) {
  const p = getProfile();
  if (!p) return;
  commit({ ...root, profiles: { ...root.profiles, [p.id]: fn(p) } });
}

export function updateSettings(patch: Partial<Settings>) {
  updateProfile((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
}

export function createProfile(name: string, avatar: string, startLevel: number, dailyGoalMin: number) {
  const id = Math.random().toString(36).slice(2, 10);
  const p: Profile = {
    id,
    name,
    avatar,
    createdAt: Date.now(),
    startLevel,
    dailyGoalMin,
    settings: { ...defaultSettings },
    lessonSteps: {},
    songs: {},
    sessions: [],
    xp: 0,
    missed: {},
    hits: {},
    badges: {},
  };
  commit({ ...root, activeProfile: id, profiles: { ...root.profiles, [id]: p } });
}

export function switchProfile(id: string | null) {
  commit({ ...root, activeProfile: id });
}

export function deleteProfile(id: string) {
  const profiles = { ...root.profiles };
  delete profiles[id];
  commit({ ...root, profiles, activeProfile: root.activeProfile === id ? Object.keys(profiles)[0] ?? null : root.activeProfile });
}

export function setParentPin(pin: string | null) {
  commit({ ...root, parentPin: pin });
}

export function addImported(song: Song) {
  commit({ ...root, imported: [...root.imported.filter((s) => s.id !== song.id), song] });
}

export function removeImported(id: string) {
  commit({ ...root, imported: root.imported.filter((s) => s.id !== id) });
}

export function exportBackup(): string {
  return JSON.stringify(root, null, 1);
}

export function importBackup(json: string) {
  const r = JSON.parse(json) as Root;
  if (!r || r.version !== 1 || typeof r.profiles !== 'object') throw new Error('Fichier de sauvegarde invalide');
  for (const p of Object.values(r.profiles)) p.settings = { ...defaultSettings, ...p.settings };
  r.imported ??= [];
  commit(r);
}

/* ---------------------------------------------------------------- helpers */

export function today(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function minutesOn(p: Profile, date: string): number {
  return p.sessions.filter((s) => s.date === date).reduce((a, s) => a + s.seconds, 0) / 60;
}

/** Consecutive days (ending today or yesterday) with at least one session. */
export function streak(p: Profile): number {
  const days = new Set(p.sessions.filter((s) => s.seconds >= 30).map((s) => s.date));
  let n = 0;
  const d = new Date();
  if (!days.has(today(d))) d.setDate(d.getDate() - 1);
  while (days.has(today(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export interface NoteStats {
  hits: Record<number, number>;
  missed: Record<number, number>;
}

export const BADGES: Record<string, { icon: string; title: string; desc: string }> = {
  first: { icon: '🎹', title: 'Première note', desc: 'Tu as joué ton premier exercice' },
  streak3: { icon: '🔥', title: '3 jours de suite', desc: 'Pratiquer 3 jours d’affilée' },
  streak7: { icon: '🌟', title: 'Une semaine !', desc: 'Pratiquer 7 jours d’affilée' },
  streak30: { icon: '🏆', title: 'Un mois entier', desc: 'Pratiquer 30 jours d’affilée' },
  perfect: { icon: '💎', title: 'Sans faute', desc: 'Obtenir 100 % de notes justes' },
  songs5: { icon: '🎵', title: '5 morceaux', desc: 'Réussir 5 morceaux différents' },
  songs15: { icon: '🎼', title: '15 morceaux', desc: 'Réussir 15 morceaux différents' },
  hour: { icon: '⏱️', title: '1 heure de piano', desc: 'Cumuler 60 minutes de pratique' },
  tenhours: { icon: '👑', title: '10 heures de piano', desc: 'Cumuler 10 heures de pratique' },
  workout: { icon: '💪', title: 'Échauffement', desc: 'Terminer un entraînement du jour' },
  twohands: { icon: '🙌', title: 'Deux mains', desc: 'Réussir un morceau à deux mains' },
};

/** Record the result of an activity, update XP, stats and badges. Returns newly earned badges. */
export function recordActivity(log: Omit<SessionLog, 'date' | 'ts'>, stats?: NoteStats, extra?: { twoHands?: boolean }): string[] {
  const p = getProfile();
  if (!p) return [];
  const entry: SessionLog = { ...log, date: today(), ts: Date.now() };
  const earned: string[] = [];
  updateProfile((q) => {
    const sessions = [...q.sessions, entry].slice(-3000);
    const missed = { ...q.missed };
    const hits = { ...q.hits };
    if (stats) {
      for (const [k, v] of Object.entries(stats.missed)) missed[+k] = (missed[+k] || 0) + v;
      for (const [k, v] of Object.entries(stats.hits)) hits[+k] = (hits[+k] || 0) + v;
    }
    const xp = q.xp + Math.round(log.seconds / 6) + (log.stars ?? 0) * 10;
    const next: Profile = { ...q, sessions, missed, hits, xp, badges: { ...q.badges } };
    const give = (id: string) => {
      if (!next.badges[id]) {
        next.badges[id] = Date.now();
        earned.push(id);
      }
    };
    give('first');
    const st = streak(next);
    if (st >= 3) give('streak3');
    if (st >= 7) give('streak7');
    if (st >= 30) give('streak30');
    if ((log.accuracy ?? 0) >= 0.999 && (log.stars ?? 0) > 0) give('perfect');
    const total = sessions.reduce((a, s) => a + s.seconds, 0) / 60;
    if (total >= 60) give('hour');
    if (total >= 600) give('tenhours');
    if (log.kind === 'workout') give('workout');
    if (extra?.twoHands && (log.stars ?? 0) >= 1) give('twohands');
    const succeeded = Object.values(next.songs).filter((s) => s.stars >= 1).length;
    if (succeeded >= 5) give('songs5');
    if (succeeded >= 15) give('songs15');
    return next;
  });
  return earned;
}

export function recordSongResult(songId: string, stars: number, accuracy: number) {
  updateProfile((p) => {
    const prev = p.songs[songId];
    return {
      ...p,
      songs: {
        ...p.songs,
        [songId]: {
          stars: Math.max(prev?.stars ?? 0, stars),
          accuracy: Math.max(prev?.accuracy ?? 0, accuracy),
          plays: (prev?.plays ?? 0) + 1,
          last: Date.now(),
        },
      },
    };
  });
}

export function recordLessonStep(lessonId: string, stepIdx: number, stars: number) {
  updateProfile((p) => {
    const arr = [...(p.lessonSteps[lessonId] ?? [])];
    arr[stepIdx] = Math.max(arr[stepIdx] ?? 0, stars);
    return { ...p, lessonSteps: { ...p.lessonSteps, [lessonId]: arr } };
  });
}
