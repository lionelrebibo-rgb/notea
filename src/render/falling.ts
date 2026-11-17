import type { PlaySession } from '../engine/session';
import { beatsPerBar, noteName, type NameStyle } from '../music/theory';
import { COLORS, roundRect, type KeyLayout } from './keyboard';

/** "Falling notes" view: coloured bars come down towards the keyboard. */
export function drawFalling(
  ctx: CanvasRenderingContext2D,
  layout: KeyLayout,
  w: number,
  h: number,
  s: PlaySession,
  opts: { names: boolean; nameStyle: NameStyle; fingers: boolean },
  now: number,
) {
  const beat = s.beat;
  const visibleBeats = Math.max(3, 4.5 * Math.max(0.6, s.opt.tempo));
  const ppb = h / visibleBeats;
  const yOf = (b: number) => h - (b - beat) * ppb;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#2a0820');
  grad.addColorStop(1, '#5a1846');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // lanes for black keys
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (const k of layout.keys.values()) if (k.black) ctx.fillRect(k.x, 0, k.w, h);
  // C lines
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (const k of layout.keys.values()) {
    if (k.midi % 12 === 0) {
      ctx.beginPath();
      ctx.moveTo(k.x, 0);
      ctx.lineTo(k.x, h);
      ctx.stroke();
    }
  }

  // bar lines
  const bpb = beatsPerBar(s.song);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  for (let b = s.song.pickup; yOf(b) > -10; b += bpb) {
    const y = yOf(b);
    if (y > h) continue;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  if (s.opt.loop) {
    ctx.fillStyle = 'rgba(255,61,154,0.14)';
    const y0 = yOf(s.opt.loop.to);
    const y1 = yOf(s.opt.loop.from);
    ctx.fillRect(0, Math.max(0, y0), w, Math.min(h, y1) - Math.max(0, y0));
  }

  const targetSet = new Set<number>();
  if (s.opt.mode === 'wait') {
    const g = s.groups[s.groupIdx];
    if (g) for (const n of g.notes) if (n.state === 'pending') targetSet.add(n.idx);
  }

  for (const n of s.notes) {
    const yTop = yOf(n.start + n.dur);
    const yBot = yOf(n.start);
    if (yBot < -5 || yTop > h + 5) continue;
    const k = layout.keys.get(n.midi);
    if (!k) continue;
    let color = n.hand === 'R' ? COLORS.right : COLORS.left;
    let alpha = 1;
    if (!n.active) {
      color = '#6c6a8a';
      alpha = 0.55;
    }
    if (n.state === 'hit') color = '#36d07e';
    else if (n.state === 'assisted') color = '#f5b52e';
    else if (n.state === 'missed') color = '#e8374f';
    ctx.globalAlpha = alpha;
    const pad = k.black ? 1 : 3;
    const x = k.x + pad;
    const bw = k.w - pad * 2;
    const hh = Math.max(6, yBot - yTop - 2);
    if (targetSet.has(n.idx)) {
      ctx.shadowColor = '#ffcf33';
      ctx.shadowBlur = 16;
    }
    ctx.fillStyle = color;
    roundRect2(ctx, x, yTop + 1, bw, hh, Math.min(8, bw / 2.5));
    ctx.shadowBlur = 0;
    if (opts.names && bw > 14 && hh > 14) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = `700 ${Math.round(Math.min(13, bw * 0.42))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(noteName(n.step, n.alter, opts.nameStyle), x + bw / 2, yBot - 4);
      if (opts.fingers && n.finger && hh > 30) {
        ctx.textBaseline = 'top';
        ctx.fillText(String(n.finger), x + bw / 2, yTop + 4);
      }
    }
    ctx.globalAlpha = 1;
  }

  // hit line
  ctx.fillStyle = s.waiting ? '#ffcf33' : 'rgba(255,255,255,0.5)';
  ctx.fillRect(0, h - 3, w, 3);

  // wrong flashes
  for (const f of s.wrongFlash) {
    const age = now - f.t;
    const k = layout.keys.get(f.midi);
    if (age > 500 || !k) continue;
    ctx.fillStyle = `rgba(255,90,110,${0.6 * (1 - age / 500)})`;
    ctx.fillRect(k.x, h - 60, k.w, 60);
  }
}

function roundRect2(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : roundRect(ctx, x, y, w, h, r, false);
  ctx.fill();
}
