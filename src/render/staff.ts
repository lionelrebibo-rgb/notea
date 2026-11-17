import type { PlayNote, PlaySession } from '../engine/session';
import type { Song } from '../music/types';
import { beatsPerBar, diatonic, keyAlterations, noteName, octaveOf, spellMidi, type NameStyle } from '../music/theory';

/**
 * Scrolling grand-staff renderer (sheet music moves right-to-left, cursor fixed).
 */
const TREBLE_BASE = 30; // E4 bottom line
const BASS_BASE = 18; // G2 bottom line

export interface StaffOpts {
  names: boolean;
  nameStyle: NameStyle;
  fingers: boolean;
  dark: boolean;
}

interface Layout {
  sp: number;
  treble: { yBottom: number } | null;
  bass: { yBottom: number } | null;
  headerW: number;
  cursorX: number;
  pxPerBeat: number;
}

const INK = '#2a2150';
const INK_SOFT = '#b4aecb';
const C_TARGET = '#3f7bff';
const C_HIT = '#1fae5b';
const C_ASSIST = '#f0a500';
const C_MISS = '#e8374f';
const C_AUTO = '#8e9bd0';

export class StaffRenderer {
  private layoutCache: { key: string; l: Layout } | null = null;
  private song: Song;
  private hasR: boolean;
  private hasL: boolean;
  private dRange: { tMin: number; tMax: number; bMin: number; bMax: number };
  private minDur: number;
  private keyAlt: number[];

  constructor(song: Song) {
    this.song = song;
    this.hasR = song.notes.some((n) => n.hand === 'R');
    this.hasL = song.notes.some((n) => n.hand === 'L');
    if (!this.hasR && !this.hasL) this.hasR = true;
    let tMin = TREBLE_BASE - 4,
      tMax = TREBLE_BASE + 13,
      bMin = BASS_BASE - 4,
      bMax = BASS_BASE + 12;
    let minDur = 1;
    for (const n of song.notes) {
      const d = diatonic(n.step, octaveOf(n.midi, n.step, n.alter));
      // room for stems, finger numbers and note names
      if (n.hand === 'R') {
        tMin = Math.min(tMin, d - 4);
        tMax = Math.max(tMax, d + 6);
      } else {
        bMin = Math.min(bMin, d - 5);
        bMax = Math.max(bMax, d + 4);
      }
      minDur = Math.min(minDur, n.dur);
    }
    this.dRange = { tMin, tMax, bMin, bMax };
    this.minDur = Math.max(0.25, minDur);
    this.keyAlt = keyAlterations(song.key);
  }

  private layout(w: number, h: number): Layout {
    const key = `${w}x${h}`;
    if (this.layoutCache?.key === key) return this.layoutCache.l;
    const { tMin, tMax, bMin, bMax } = this.dRange;
    let halfSteps = 0;
    if (this.hasR) halfSteps += tMax - tMin;
    if (this.hasL) halfSteps += bMax - bMin;
    if (this.hasR && this.hasL) halfSteps += 1;
    const sp = Math.max(6, Math.min(18, (2 * h) / (halfSteps + 2)));
    const used = (halfSteps * sp) / 2;
    let y = (h - used) / 2;
    let treble: Layout['treble'] = null;
    let bass: Layout['bass'] = null;
    if (this.hasR) {
      treble = { yBottom: y + ((tMax - TREBLE_BASE) * sp) / 2 };
      y += ((tMax - tMin) * sp) / 2 + (this.hasL ? sp / 2 : 0);
    }
    if (this.hasL) {
      bass = { yBottom: y + ((bMax - BASS_BASE) * sp) / 2 };
    }
    const nAcc = Math.abs(this.song.key);
    const headerW = sp * 4.2 + nAcc * sp * 0.9 + sp * 2.2;
    const pxPerBeat = Math.max(sp * 6.5, (sp * 2.6) / this.minDur);
    const l: Layout = { sp, treble, bass, headerW, cursorX: headerW + Math.max(sp * 4, (w - headerW) * 0.18), pxPerBeat };
    this.layoutCache = { key, l };
    return l;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, s: PlaySession, opts: StaffOpts, now: number) {
    const L = this.layout(w, h);
    const { sp } = L;
    const song = this.song;
    const beat = s.beat;
    const xOf = (b: number) => L.cursorX + (b - beat) * L.pxPerBeat;

    ctx.save();
    ctx.fillStyle = '#fffdf8';
    ctx.fillRect(0, 0, w, h);

    // loop region
    if (s.opt.loop) {
      ctx.fillStyle = 'rgba(124,77,255,0.08)';
      const x0 = Math.max(L.headerW, xOf(s.opt.loop.from));
      const x1 = xOf(s.opt.loop.to);
      if (x1 > x0) ctx.fillRect(x0, 0, x1 - x0, h);
    }

    const staves: { yBottom: number; base: number; clef: 'G' | 'F' }[] = [];
    if (L.treble) staves.push({ yBottom: L.treble.yBottom, base: TREBLE_BASE, clef: 'G' });
    if (L.bass) staves.push({ yBottom: L.bass.yBottom, base: BASS_BASE, clef: 'F' });

    // staff lines
    ctx.strokeStyle = '#8f88aa';
    ctx.lineWidth = Math.max(1, sp * 0.08);
    for (const st of staves) {
      for (let i = 0; i < 5; i++) {
        const y = st.yBottom - i * sp;
        ctx.beginPath();
        ctx.moveTo(4, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }

    // bar lines
    const bpb = beatsPerBar(song);
    const top = staves.length ? staves[0].yBottom - 4 * sp : 0;
    const bottom = staves.length ? staves[staves.length - 1].yBottom : h;
    ctx.lineWidth = Math.max(1, sp * 0.1);
    let barNo = song.pickup > 0 ? 1 : 1;
    for (let b = song.pickup; xOf(b) < w + 10; b += bpb, barNo++) {
      const x = xOf(b);
      if (b === 0 && song.pickup === 0) continue;
      if (x < L.headerW - 2) continue;
      ctx.strokeStyle = '#8f88aa';
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      ctx.fillStyle = '#a49fbd';
      ctx.font = `${Math.round(sp * 0.9)}px system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(String(barNo), x + 2, top - sp * 0.6);
    }

    // notes (clip so they disappear under the header)
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.headerW, 0, w - L.headerW, h);
    ctx.clip();

    // rests
    for (const r of song.rests) {
      const x = xOf(r.start + r.dur / 2) - sp * 0.4;
      if (x < L.headerW - sp * 4 || x > w + sp * 2) continue;
      const st = r.hand === 'R' ? L.treble : L.bass;
      if (!st) continue;
      const active = s.opt.hands === 'both' || s.opt.hands === r.hand;
      this.drawRest(ctx, x, st.yBottom, sp, r.dur, active ? '#6b6390' : INK_SOFT);
    }

    // group notes by (start, hand) into chords
    const groups = new Map<string, PlayNote[]>();
    for (const n of s.notes) {
      const x = xOf(n.start);
      if (x < L.headerW - sp * 6 || x > w + sp * 3) continue;
      const k = `${n.start.toFixed(3)}|${n.hand}`;
      let g = groups.get(k);
      if (!g) groups.set(k, (g = []));
      g.push(n);
    }

    const target = new Set<PlayNote>();
    if (s.opt.mode === 'wait') {
      const g = s.groups[s.groupIdx];
      if (g) for (const n of g.notes) if (n.state === 'pending') target.add(n);
    }

    for (const chord of groups.values()) {
      this.drawChord(ctx, chord, xOf(chord[0].start), L, opts, target);
    }

    // wrong-note ghosts at the cursor
    for (const f of s.wrongFlash) {
      const age = now - f.t;
      if (age > 700) continue;
      const sp2 = spellMidi(f.midi, song.key < 0);
      const d = diatonic(sp2.step, sp2.octave);
      const st = L.treble && (d >= 28 || !L.bass) ? { ...L.treble, base: TREBLE_BASE } : L.bass ? { ...L.bass, base: BASS_BASE } : null;
      if (!st) continue;
      const y = st.yBottom - ((d - st.base) * sp) / 2;
      ctx.globalAlpha = 1 - age / 700;
      this.ledgers(ctx, L.cursorX + sp * 1.2, d, st.base, st.yBottom, sp, C_MISS);
      this.head(ctx, L.cursorX + sp * 1.2, y, sp, true, C_MISS);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // header (clefs, key, time signature) on top
    ctx.fillStyle = '#fffdf8';
    ctx.fillRect(0, 0, L.headerW, h);
    ctx.strokeStyle = '#8f88aa';
    ctx.lineWidth = Math.max(1, sp * 0.08);
    for (const st of staves) {
      for (let i = 0; i < 5; i++) {
        const y = st.yBottom - i * sp;
        ctx.beginPath();
        ctx.moveTo(4, y);
        ctx.lineTo(L.headerW, y);
        ctx.stroke();
      }
      this.drawClef(ctx, st.clef, sp * 0.6, st.yBottom, sp);
      this.drawKeySig(ctx, st.clef, sp * 3.9, st.yBottom, sp);
      this.drawTimeSig(ctx, sp * 3.9 + Math.abs(song.key) * sp * 0.9 + sp * 0.3, st.yBottom, sp);
    }
    if (staves.length === 2) {
      ctx.lineWidth = Math.max(1.5, sp * 0.15);
      ctx.beginPath();
      ctx.moveTo(4, top);
      ctx.lineTo(4, bottom);
      ctx.stroke();
    }

    // cursor
    ctx.strokeStyle = s.waiting ? 'rgba(63,123,255,0.85)' : 'rgba(124,77,255,0.55)';
    ctx.lineWidth = Math.max(2, sp * 0.25);
    ctx.beginPath();
    ctx.moveTo(L.cursorX, top - sp * 1.5);
    ctx.lineTo(L.cursorX, bottom + sp * 1.5);
    ctx.stroke();
    ctx.restore();
  }

  private yFor(n: { midi: number; step: number; alter: number; hand: 'R' | 'L' }, L: Layout) {
    const d = diatonic(n.step, octaveOf(n.midi, n.step, n.alter));
    const st = n.hand === 'R' ? L.treble ?? L.bass! : L.bass ?? L.treble!;
    const base = n.hand === 'R' ? (L.treble ? TREBLE_BASE : BASS_BASE) : L.bass ? BASS_BASE : TREBLE_BASE;
    return { y: st.yBottom - ((d - base) * L.sp) / 2, d, base, yBottom: st.yBottom };
  }

  private colorFor(n: PlayNote, target: Set<PlayNote>, s?: boolean) {
    if (!n.active) return n.state === 'auto' ? C_AUTO : INK_SOFT;
    switch (n.state) {
      case 'hit':
        return C_HIT;
      case 'assisted':
        return C_ASSIST;
      case 'missed':
        return C_MISS;
      default:
        return target.has(n) ? C_TARGET : INK;
    }
  }

  private drawChord(ctx: CanvasRenderingContext2D, chord: PlayNote[], x: number, L: Layout, opts: StaffOpts, target: Set<PlayNote>) {
    const sp = L.sp;
    chord.sort((a, b) => a.midi - b.midi);
    const pos = chord.map((n) => ({ n, ...this.yFor(n, L) }));
    const dur = chord[0].dur;
    const filled = dur < 1.99;
    const middle = pos[0].base + 4;
    const avg = pos.reduce((a, p) => a + p.d, 0) / pos.length;
    const stemUp = avg < middle;
    const allActive = chord.every((n) => n.active);

    // ledger lines
    for (const p of pos) this.ledgers(ctx, x, p.d, p.base, p.yBottom, sp, allActive ? '#6b6390' : INK_SOFT);

    // heads (+ accidentals, names)
    let prevD = -999;
    let shifted = false;
    for (const p of pos) {
      const color = this.colorFor(p.n, target);
      let hx = x;
      if (p.d - prevD === 1 && !shifted) {
        hx = x + (stemUp ? sp * 1.15 : -sp * 1.15);
        shifted = true;
      } else shifted = false;
      prevD = p.d;
      if (target.has(p.n)) {
        ctx.fillStyle = 'rgba(63,123,255,0.18)';
        ctx.beginPath();
        ctx.arc(hx, p.y, sp * 1.25, 0, Math.PI * 2);
        ctx.fill();
      }
      this.head(ctx, hx, p.y, sp, filled, color);
      if (isDotted(dur)) {
        ctx.fillStyle = color;
        ctx.beginPath();
        const dy = (p.d - p.base) % 2 === 0 ? -sp / 2 : 0;
        ctx.arc(hx + sp * 1.05, p.y + dy, sp * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
      const keyAlt = this.keyAlt[p.n.step];
      if (p.n.alter !== keyAlt) {
        const sym = p.n.alter === 1 ? '♯' : p.n.alter === -1 ? '♭' : '♮';
        ctx.fillStyle = color;
        ctx.font = `${Math.round(sp * 1.6)}px "Segoe UI Symbol", "Noto Sans Symbols", system-ui, serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(sym, hx - sp * 0.75, p.y);
      }
      if (opts.names) {
        ctx.fillStyle = color === INK ? '#5b4fa0' : color;
        ctx.font = `700 ${Math.round(Math.max(9, sp * 0.95))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = noteName(p.n.step, p.n.alter, opts.nameStyle);
        const ly = stemUp ? p.y + sp * 1.25 : p.y - sp * 1.25;
        if (pos.length === 1) ctx.fillText(label, hx, ly);
        else ctx.fillText(label, hx - sp * 2.1, p.y);
      }
    }

    // stem
    const color = this.colorFor(chord[chord.length - 1], target);
    if (dur < 3.99) {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.2, sp * 0.12);
      const lowY = pos[0].y;
      const highY = pos[pos.length - 1].y;
      const len = sp * 3.4;
      const sx = stemUp ? x + sp * 0.58 : x - sp * 0.58;
      const y0 = stemUp ? lowY : highY;
      const y1 = stemUp ? highY - len : lowY + len;
      ctx.beginPath();
      ctx.moveTo(sx, y0);
      ctx.lineTo(sx, y1);
      ctx.stroke();
      const flags = dur <= 0.26 ? 2 : dur <= 0.76 ? 1 : 0;
      ctx.fillStyle = color;
      for (let i = 0; i < flags; i++) {
        const fy = y1 + (stemUp ? i * sp * 0.8 : -i * sp * 0.8);
        ctx.beginPath();
        ctx.moveTo(sx, fy);
        if (stemUp) {
          ctx.bezierCurveTo(sx + sp * 0.2, fy + sp * 1.0, sx + sp * 1.3, fy + sp * 1.2, sx + sp * 0.9, fy + sp * 2.6);
          ctx.bezierCurveTo(sx + sp * 1.0, fy + sp * 1.6, sx + sp * 0.4, fy + sp * 1.2, sx, fy + sp * 1.0);
        } else {
          ctx.bezierCurveTo(sx + sp * 0.2, fy - sp * 1.0, sx + sp * 1.3, fy - sp * 1.2, sx + sp * 0.9, fy - sp * 2.6);
          ctx.bezierCurveTo(sx + sp * 1.0, fy - sp * 1.6, sx + sp * 0.4, fy - sp * 1.2, sx, fy - sp * 1.0);
        }
        ctx.fill();
      }
      // finger numbers at the end of the stem
      if (opts.fingers) {
        const fingers = (stemUp ? [...chord].reverse() : chord).map((n) => n.finger).filter(Boolean);
        if (fingers.length) {
          ctx.fillStyle = '#7c4dff';
          ctx.font = `700 ${Math.round(Math.max(9, sp * 0.95))}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          fingers.forEach((f, i) => {
            const fy = stemUp ? y1 - sp * 0.8 - i * sp : y1 + sp * 0.8 + i * sp;
            ctx.fillText(String(f), sx, fy);
          });
        }
      }
    } else if (opts.fingers) {
      const f = chord.map((n) => n.finger).filter(Boolean);
      if (f.length) {
        ctx.fillStyle = '#7c4dff';
        ctx.font = `700 ${Math.round(Math.max(9, sp * 0.95))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(f.join(''), x, pos[pos.length - 1].y - sp * 1.6);
      }
    }
  }

  private head(ctx: CanvasRenderingContext2D, x: number, y: number, sp: number, filled: boolean, color: string) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.33);
    ctx.beginPath();
    ctx.ellipse(0, 0, sp * 0.64, sp * 0.45, 0, 0, Math.PI * 2);
    if (filled) {
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.5, sp * 0.18);
      ctx.stroke();
    }
    ctx.restore();
  }

  private ledgers(ctx: CanvasRenderingContext2D, x: number, d: number, base: number, yBottom: number, sp: number, color: string) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, sp * 0.1);
    const lw = sp * 0.95;
    for (let ld = base - 2; ld >= d; ld -= 2) {
      const y = yBottom - ((ld - base) * sp) / 2;
      ctx.beginPath();
      ctx.moveTo(x - lw, y);
      ctx.lineTo(x + lw, y);
      ctx.stroke();
    }
    for (let ld = base + 10; ld <= d; ld += 2) {
      const y = yBottom - ((ld - base) * sp) / 2;
      ctx.beginPath();
      ctx.moveTo(x - lw, y);
      ctx.lineTo(x + lw, y);
      ctx.stroke();
    }
  }

  private drawRest(ctx: CanvasRenderingContext2D, x: number, yBottom: number, sp: number, dur: number, color: string) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    const mid = yBottom - 2 * sp;
    if (dur >= 3.9) {
      ctx.fillRect(x - sp * 0.5, yBottom - 3 * sp, sp * 1.1, sp * 0.5);
    } else if (dur >= 1.9) {
      ctx.fillRect(x - sp * 0.5, mid - sp * 0.5, sp * 1.1, sp * 0.5);
    } else if (dur >= 0.9) {
      ctx.lineWidth = Math.max(1.5, sp * 0.22);
      ctx.beginPath();
      ctx.moveTo(x - sp * 0.2, mid - sp * 1.5);
      ctx.lineTo(x + sp * 0.35, mid - sp * 0.8);
      ctx.lineTo(x - sp * 0.25, mid - sp * 0.1);
      ctx.lineTo(x + sp * 0.35, mid + sp * 0.6);
      ctx.quadraticCurveTo(x - sp * 0.5, mid + sp * 0.3, x, mid + sp * 1.3);
      ctx.stroke();
    } else {
      ctx.lineWidth = Math.max(1.2, sp * 0.14);
      ctx.beginPath();
      ctx.arc(x - sp * 0.2, mid - sp * 0.4, sp * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - sp * 0.2, mid - sp * 0.2);
      ctx.quadraticCurveTo(x + sp * 0.2, mid - sp * 0.1, x + sp * 0.45, mid - sp * 0.6);
      ctx.lineTo(x - sp * 0.05, mid + sp * 1.0);
      ctx.stroke();
      if (dur <= 0.3) {
        ctx.beginPath();
        ctx.arc(x - sp * 0.35, mid + sp * 0.35, sp * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawClef(ctx: CanvasRenderingContext2D, clef: 'G' | 'F', x: number, yBottom: number, sp: number) {
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
    if (clef === 'G') {
      // stylised treble clef drawn with curves (no font dependency)
      const cx = x + sp * 1.2;
      const g = yBottom - sp; // G line (2nd line)
      ctx.lineWidth = Math.max(1.6, sp * 0.2);
      ctx.beginPath();
      ctx.moveTo(cx + sp * 0.15, yBottom + sp * 1.4);
      ctx.quadraticCurveTo(cx + sp * 0.5, yBottom + sp * 1.9, cx - sp * 0.2, yBottom + sp * 1.9);
      ctx.moveTo(cx + sp * 0.15, yBottom + sp * 1.4);
      ctx.lineTo(cx + sp * 0.05, yBottom - sp * 5.2);
      ctx.quadraticCurveTo(cx + sp * 1.1, yBottom - sp * 4.0, cx - sp * 0.7, yBottom - sp * 2.0);
      ctx.bezierCurveTo(cx - sp * 1.5, yBottom - sp * 1.0, cx - sp * 0.9, g + sp * 1.5, cx + sp * 0.2, g + sp * 1.2);
      ctx.bezierCurveTo(cx + sp * 1.4, g + sp * 0.9, cx + sp * 1.1, g - sp * 1.0, cx + sp * 0.1, g - sp * 0.9);
      ctx.bezierCurveTo(cx - sp * 0.6, g - sp * 0.8, cx - sp * 0.6, g + sp * 0.3, cx + sp * 0.1, g + sp * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - sp * 0.2, yBottom + sp * 1.7, sp * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const cx = x + sp * 0.7;
      const f = yBottom - 3 * sp; // F line (4th line)
      ctx.lineWidth = Math.max(1.6, sp * 0.22);
      ctx.beginPath();
      ctx.arc(cx + sp * 0.1, f + sp * 0.05, sp * 0.33, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - sp * 0.15, f + sp * 0.05);
      ctx.bezierCurveTo(cx - sp * 0.1, f - sp * 1.2, cx + sp * 2.2, f - sp * 1.0, cx + sp * 1.8, f + sp * 0.9);
      ctx.quadraticCurveTo(cx + sp * 1.4, f + sp * 2.3, cx - sp * 0.4, f + sp * 3.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + sp * 2.5, f - sp * 0.5, sp * 0.17, 0, Math.PI * 2);
      ctx.arc(cx + sp * 2.5, f + sp * 0.5, sp * 0.17, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawKeySig(ctx: CanvasRenderingContext2D, clef: 'G' | 'F', x: number, yBottom: number, sp: number) {
    const k = this.song.key;
    if (!k) return;
    // diatonic offsets (from bottom line) for sharps/flats on the treble staff
    const sharpsT = [8, 5, 9, 6, 3, 7, 4];
    const flatsT = [4, 7, 3, 6, 2, 5, 1];
    const shift = clef === 'F' ? -2 : 0;
    const list = k > 0 ? sharpsT : flatsT;
    ctx.fillStyle = INK;
    ctx.font = `${Math.round(sp * 1.7)}px "Segoe UI Symbol", "Noto Sans Symbols", system-ui, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < Math.abs(k); i++) {
      const pos = list[i] + shift;
      ctx.fillText(k > 0 ? '♯' : '♭', x + i * sp * 0.9, yBottom - (pos * sp) / 2 - (k < 0 ? sp * 0.3 : 0));
    }
  }

  private drawTimeSig(ctx: CanvasRenderingContext2D, x: number, yBottom: number, sp: number) {
    const [num, den] = this.song.timeSig;
    ctx.fillStyle = INK;
    ctx.font = `800 ${Math.round(sp * 2.1)}px Georgia, "Times New Roman", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(num), x + sp, yBottom - 3 * sp);
    ctx.fillText(String(den), x + sp, yBottom - sp);
  }
}

function isDotted(d: number) {
  return [3, 1.5, 0.75, 0.375].some((x) => Math.abs(d - x) < 0.01);
}
