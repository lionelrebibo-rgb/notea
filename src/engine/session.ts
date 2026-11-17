import type { HandSel, Note, Song } from '../music/types';
import { beatsPerBar, clickBeats, songEnd } from '../music/theory';

export type PlayMode = 'wait' | 'rhythm' | 'demo';
export type NoteState = 'pending' | 'hit' | 'assisted' | 'missed' | 'auto';

export interface PlayNote extends Note {
  idx: number;
  active: boolean; // must be played by the pupil
  state: NoteState;
  quality?: 'perfect' | 'good' | 'late' | 'early';
  firstTry: boolean;
  autoPlayed: boolean;
}

interface Group {
  start: number;
  notes: PlayNote[];
  since: number; // ms when the cursor started waiting on this group
  hinted: boolean;
  failed: boolean;
}

export interface SessionOptions {
  mode: PlayMode;
  hands: HandSel;
  tempo: number; // 0.3 .. 1.5 multiplier
  loop: { from: number; to: number } | null;
  metronome: boolean;
  countIn: boolean;
  /** accept any key (rhythm exercises) */
  anyKey?: boolean;
  /** delay (ms) before showing the keys on the keyboard in wait mode */
  hintDelayMs: number;
  latencyMs: number;
}

export interface SessionCallbacks {
  /** the app must play this note (other hand, demo) */
  autoNote?: (midi: number, durSec: number, velocity: number) => void;
  click?: (accent: boolean) => void;
  wrong?: (midi: number) => void;
  end?: (r: SessionResult) => void;
}

export interface SessionResult {
  accuracy: number; // 0..1
  timing: number | null; // 0..1 in rhythm mode
  stars: number;
  total: number;
  correct: number;
  assisted: number;
  missed: number;
  wrong: number;
  seconds: number;
  stats: { hits: Record<number, number>; missed: Record<number, number> };
}

const PERFECT_MS = 90;
const GOOD_MS = 190;
const WINDOW_MS = 280;

export class PlaySession {
  song: Song;
  opt: SessionOptions;
  cb: SessionCallbacks;
  notes: PlayNote[];
  groups: Group[] = [];
  groupIdx = 0;
  beat: number;
  startBeat: number;
  endBeat: number;
  playing = false;
  finished = false;
  waiting = false;
  wrongCount = 0;
  wrongFlash: { midi: number; t: number }[] = [];
  private lastNow = 0;
  private lastClick = -Infinity;
  private activeSeconds = 0;
  private stats = { hits: {} as Record<number, number>, missed: {} as Record<number, number> };
  private nextAuto = 0;

  constructor(song: Song, opt: SessionOptions, cb: SessionCallbacks = {}) {
    this.song = song;
    this.opt = opt;
    this.cb = cb;
    this.notes = song.notes.map((n, i) => ({
      ...n,
      idx: i,
      active: opt.mode !== 'demo' && (opt.hands === 'both' || opt.hands === n.hand),
      state: 'pending',
      firstTry: true,
      autoPlayed: false,
    }));
    const end = songEnd(song);
    const from = opt.loop ? opt.loop.from : 0;
    this.endBeat = opt.loop ? opt.loop.to : end;
    const bpb = beatsPerBar(song);
    this.startBeat = from - (opt.countIn ? Math.max(bpb, 2) : 0.5);
    this.beat = this.startBeat;
    this.buildGroups();
  }

  get bps() {
    return (this.song.bpm * this.opt.tempo) / 60;
  }

  private inRange(n: PlayNote) {
    if (!this.opt.loop) return true;
    return n.start >= this.opt.loop.from - 1e-6 && n.start < this.opt.loop.to - 1e-6;
  }

  private buildGroups() {
    this.groups = [];
    const act = this.notes.filter((n) => n.active && this.inRange(n));
    for (const n of act) {
      const g = this.groups[this.groups.length - 1];
      if (g && Math.abs(g.start - n.start) < 0.02) g.notes.push(n);
      else this.groups.push({ start: n.start, notes: [n], since: 0, hinted: false, failed: false });
    }
    this.groupIdx = 0;
    this.nextAuto = 0;
  }

  /** Notes the pupil should play now (used to highlight keys). */
  currentTargets(now: number): { midis: number[]; hint: boolean } {
    if (this.opt.mode === 'wait') {
      const g = this.groups[this.groupIdx];
      if (!g) return { midis: [], hint: false };
      const pend = g.notes.filter((n) => n.state === 'pending').map((n) => n.midi);
      const hint = this.waiting && now - g.since > this.opt.hintDelayMs;
      if (hint && !g.hinted) g.hinted = true;
      return { midis: pend, hint: g.hinted };
    }
    // rhythm: notes within the next 1/4 beat
    const midis = this.notes
      .filter((n) => n.active && n.state === 'pending' && Math.abs(n.start - this.beat) < 0.25)
      .map((n) => n.midi);
    return { midis, hint: false };
  }

  start(now: number) {
    this.playing = true;
    this.lastNow = now;
  }

  pause() {
    this.playing = false;
  }

  restart(now: number) {
    for (const n of this.notes) {
      n.state = 'pending';
      n.firstTry = true;
      n.autoPlayed = false;
      n.quality = undefined;
    }
    this.wrongCount = 0;
    this.finished = false;
    this.waiting = false;
    this.beat = this.startBeat;
    this.lastClick = -Infinity;
    this.activeSeconds = 0;
    this.stats = { hits: {}, missed: {} };
    this.buildGroups();
    this.start(now);
  }

  update(now: number) {
    const dt = Math.min(0.1, Math.max(0, (now - this.lastNow) / 1000));
    this.lastNow = now;
    if (!this.playing || this.finished) return;
    this.activeSeconds += dt;

    let next = this.beat + dt * this.bps;

    if (this.opt.mode === 'wait') {
      const g = this.groups[this.groupIdx];
      if (g && next >= g.start) {
        next = g.start;
        if (!this.waiting) {
          this.waiting = true;
          g.since = now;
        }
      }
    }

    // metronome
    if (this.opt.metronome || (this.opt.countIn && this.beat < (this.opt.loop?.from ?? 0))) {
      const cb = clickBeats(this.song);
      const k = Math.floor((next - this.song.pickup) / cb + 1e-6);
      const kPrev = Math.floor((this.beat - this.song.pickup) / cb + 1e-6);
      if (k !== kPrev && k !== this.lastClick && (this.opt.metronome || next < (this.opt.loop?.from ?? 0))) {
        this.lastClick = k;
        const perBar = Math.round(beatsPerBar(this.song) / cb);
        this.cb.click?.(((k % perBar) + perBar) % perBar === 0);
      }
    }

    // auto-play notes (other hand, demo) when the cursor passes them
    while (this.nextAuto < this.notes.length && this.notes[this.nextAuto].start <= next + 1e-6) {
      const n = this.notes[this.nextAuto++];
      if (!this.inRange(n) || n.start < this.beat - 0.5) continue;
      if (!n.active) {
        n.state = 'auto';
        n.autoPlayed = true;
        this.cb.autoNote?.(n.midi, n.dur / this.bps, this.opt.mode === 'demo' ? 0.7 : 0.45);
      }
    }

    // rhythm mode: notes that went past the window are missed
    if (this.opt.mode === 'rhythm') {
      const lateBeats = (WINDOW_MS / 1000) * this.bps;
      for (const n of this.notes) {
        if (n.active && n.state === 'pending' && this.inRange(n) && n.start + lateBeats < next) {
          n.state = 'missed';
          this.stats.missed[n.midi] = (this.stats.missed[n.midi] || 0) + 1;
        }
      }
    }

    this.beat = next;

    if (this.beat >= this.endBeat + 0.25) {
      if (this.opt.loop) {
        this.loopAgain(now);
      } else {
        this.finish();
      }
    }
  }

  private loopAgain(now: number) {
    for (const n of this.notes) {
      if (this.inRange(n)) {
        n.state = 'pending';
        n.firstTry = true;
        n.autoPlayed = false;
        n.quality = undefined;
      }
    }
    this.beat = this.opt.loop!.from - Math.min(1, beatsPerBar(this.song));
    this.lastClick = -Infinity;
    this.waiting = false;
    this.buildGroups();
  }

  noteOn(midi: number, time: number, now: number) {
    if (!this.playing || this.finished || this.opt.mode === 'demo') return;
    const t = time - this.opt.latencyMs;

    if (this.opt.mode === 'wait') {
      const g = this.groups[this.groupIdx];
      if (!g) return;
      // allow pressing slightly early (half a beat before the cursor reaches it)
      if (!this.waiting && g.start - this.beat > 0.5) {
        this.registerWrong(midi, now);
        return;
      }
      const n = g.notes.find((x) => x.state === 'pending' && (x.midi === midi || this.opt.anyKey));
      if (n) {
        // keys always shown (hintDelayMs = 0) is part of the exercise, not "help"
        n.state = (g.hinted && this.opt.hintDelayMs > 0) || !n.firstTry ? 'assisted' : 'hit';
        if (g.failed) n.firstTry = false;
        this.stats.hits[n.midi] = (this.stats.hits[n.midi] || 0) + 1;
        if (g.notes.every((x) => x.state !== 'pending')) {
          this.groupIdx++;
          this.waiting = false;
          // when the next group starts right now (chords played as arpeggio), keep moving
        }
      } else if (!g.notes.some((x) => x.midi === midi)) {
        g.failed = true;
        for (const x of g.notes) {
          if (x.state === 'pending' && x.firstTry) {
            x.firstTry = false;
            this.stats.missed[x.midi] = (this.stats.missed[x.midi] || 0) + 1;
          }
        }
        this.registerWrong(midi, now);
      }
      return;
    }

    // rhythm mode: find the closest pending note with that pitch inside the window
    const pressBeat = this.beat - ((now - t) / 1000) * this.bps;
    const windowBeats = (WINDOW_MS / 1000) * this.bps;
    let best: PlayNote | null = null;
    let bestD = Infinity;
    for (const n of this.notes) {
      if (!n.active || n.state !== 'pending' || !this.inRange(n)) continue;
      if (!(n.midi === midi || this.opt.anyKey)) continue;
      const d = Math.abs(n.start - pressBeat);
      if (d < windowBeats && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    if (best) {
      const ms = (bestD / this.bps) * 1000;
      best.state = 'hit';
      best.quality = ms <= PERFECT_MS ? 'perfect' : ms <= GOOD_MS ? 'good' : pressBeat < best.start ? 'early' : 'late';
      this.stats.hits[best.midi] = (this.stats.hits[best.midi] || 0) + 1;
    } else {
      this.registerWrong(midi, now);
    }
  }

  private registerWrong(midi: number, now: number) {
    this.wrongCount++;
    this.wrongFlash.push({ midi, t: now });
    if (this.wrongFlash.length > 8) this.wrongFlash.shift();
    this.cb.wrong?.(midi);
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.playing = false;
    this.cb.end?.(this.result());
  }

  result(): SessionResult {
    const act = this.notes.filter((n) => n.active && this.inRange(n));
    const total = act.length;
    let correct = 0;
    let assisted = 0;
    let missed = 0;
    let timingSum = 0;
    for (const n of act) {
      if (n.state === 'hit') {
        if (this.opt.mode === 'wait' && !n.firstTry) assisted++;
        else correct++;
      } else if (n.state === 'assisted') assisted++;
      else missed++;
      if (this.opt.mode === 'rhythm') {
        timingSum += n.quality === 'perfect' ? 1 : n.quality === 'good' ? 0.75 : n.quality ? 0.4 : 0;
      }
    }
    let accuracy: number;
    let timing: number | null = null;
    if (this.opt.mode === 'wait') {
      accuracy = total ? (correct + assisted * 0.5) / total : 1;
      accuracy = Math.max(0, accuracy - Math.max(0, this.wrongCount - total * 0.05) * 0.01);
    } else {
      const played = correct + assisted;
      timing = total ? timingSum / total : 1;
      accuracy = total ? played / total : 1;
      accuracy = Math.max(0, accuracy - Math.max(0, this.wrongCount - total * 0.05) * 0.015);
    }
    const score = timing === null ? accuracy : accuracy * 0.6 + timing * 0.4;
    const stars = this.opt.mode === 'demo' ? 0 : score >= 0.9 ? 3 : score >= 0.7 ? 2 : score >= 0.4 ? 1 : 0;
    return {
      accuracy,
      timing,
      stars,
      total,
      correct,
      assisted,
      missed,
      wrong: this.wrongCount,
      seconds: Math.round(this.activeSeconds),
      stats: this.stats,
    };
  }

  /** Live progress 0..1 */
  progress() {
    const from = this.opt.loop?.from ?? 0;
    const span = Math.max(0.001, this.endBeat - from);
    return Math.min(1, Math.max(0, (this.beat - from) / span));
  }
}
