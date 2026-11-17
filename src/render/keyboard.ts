import { isBlack } from '../music/theory';

export interface KeyRect {
  midi: number;
  x: number;
  w: number;
  black: boolean;
}

export interface KeyLayout {
  lo: number;
  hi: number;
  keys: Map<number, KeyRect>;
  whiteW: number;
}

/** Snap a range to white keys and compute key rectangles for a given width. */
export function makeLayout(lo: number, hi: number, width: number): KeyLayout {
  while (isBlack(lo)) lo--;
  while (isBlack(hi)) hi++;
  let whites = 0;
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites++;
  const whiteW = width / whites;
  const blackW = whiteW * 0.62;
  const keys = new Map<number, KeyRect>();
  let x = 0;
  for (let m = lo; m <= hi; m++) {
    if (!isBlack(m)) {
      keys.set(m, { midi: m, x, w: whiteW, black: false });
      x += whiteW;
    } else {
      // offset black keys slightly like on a real piano
      const pc = m % 12;
      const off = pc === 1 || pc === 6 ? -0.08 : pc === 3 || pc === 10 ? 0.08 : 0;
      keys.set(m, { midi: m, x: x - blackW / 2 + off * whiteW, w: blackW, black: true });
    }
  }
  return { lo, hi, keys, whiteW };
}

/** Comfortable range for a list of pitches, at least `minWhite` white keys wide. */
export function rangeFor(midis: number[], minSpan = 24): [number, number] {
  if (!midis.length) return [48, 72];
  let lo = Math.min(...midis) - 2;
  let hi = Math.max(...midis) + 2;
  // align to C .. C when possible
  lo = lo - (((lo % 12) + 12) % 12) + 0;
  if (hi % 12 !== 0) hi = hi + (12 - (hi % 12));
  while (hi - lo < minSpan) {
    if (lo > 36) lo -= 12;
    else hi += 12;
  }
  return [Math.max(21, lo), Math.min(108, hi)];
}

export interface KeyPaint {
  /** pressed by the pupil */
  pressed: Set<number>;
  /** expected now */
  targets: Set<number>;
  /** whether to colour targets (hint) */
  showTargets: boolean;
  wrong: Set<number>;
  /** midi -> label */
  labels?: Map<number, string>;
  /** midi -> finger number to show on target */
  fingers?: Map<number, number>;
  auto: Set<number>;
}

export const COLORS = {
  target: '#ffcf33',
  pressed: '#4dd88a',
  wrong: '#ff5a6e',
  auto: '#9db4ff',
  right: '#4f8cff',
  left: '#ff8a3d',
};

export function drawKeyboard(ctx: CanvasRenderingContext2D, layout: KeyLayout, y: number, h: number, paint: KeyPaint) {
  const bh = h * 0.62;
  ctx.save();
  // whites
  for (const k of layout.keys.values()) {
    if (k.black) continue;
    let fill = '#fbfaff';
    if (paint.wrong.has(k.midi)) fill = COLORS.wrong;
    else if (paint.pressed.has(k.midi)) fill = paint.targets.has(k.midi) || !paint.showTargets ? COLORS.pressed : '#c9f2da';
    else if (paint.showTargets && paint.targets.has(k.midi)) fill = COLORS.target;
    else if (paint.auto.has(k.midi)) fill = '#dfe6ff';
    ctx.fillStyle = fill;
    roundRect(ctx, k.x + 1, y, k.w - 2, h - 2, Math.min(8, k.w * 0.2), true);
    if (k.midi === 60) {
      ctx.fillStyle = 'rgba(80,60,160,0.35)';
      ctx.beginPath();
      ctx.arc(k.x + k.w / 2, y + h - Math.min(14, k.w * 0.4), Math.min(4, k.w * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }
    drawLabel(ctx, k, y + bh + (h - bh) * 0.45, paint, '#3a2f63');
  }
  // blacks
  for (const k of layout.keys.values()) {
    if (!k.black) continue;
    let fill = '#1c1633';
    if (paint.wrong.has(k.midi)) fill = COLORS.wrong;
    else if (paint.pressed.has(k.midi)) fill = COLORS.pressed;
    else if (paint.showTargets && paint.targets.has(k.midi)) fill = COLORS.target;
    else if (paint.auto.has(k.midi)) fill = '#5d6fb5';
    ctx.fillStyle = fill;
    roundRect(ctx, k.x, y, k.w, bh, Math.min(5, k.w * 0.2), true);
    drawLabel(ctx, k, y + bh * 0.72, paint, fill === '#1c1633' ? '#fff' : '#1c1633');
  }
  ctx.restore();
}

function drawLabel(ctx: CanvasRenderingContext2D, k: KeyRect, cy: number, paint: KeyPaint, color: string) {
  const isTarget = paint.showTargets && paint.targets.has(k.midi);
  const finger = isTarget ? paint.fingers?.get(k.midi) : undefined;
  const label = paint.labels?.get(k.midi);
  if (finger) {
    const r = Math.min(k.w * 0.38, 13);
    ctx.fillStyle = '#2a1f55';
    ctx.beginPath();
    ctx.arc(k.x + k.w / 2, cy - r * 1.6, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.round(r * 1.2)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(finger), k.x + k.w / 2, cy - r * 1.6 + 1);
  }
  if (label && k.w > 14) {
    ctx.fillStyle = color;
    ctx.font = `600 ${Math.round(Math.min(13, k.w * 0.36))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, k.x + k.w / 2, cy);
  }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill = true) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.closePath();
  if (fill) ctx.fill();
}

export function keyAt(layout: KeyLayout, x: number, y: number, top: number, h: number): number | null {
  const bh = h * 0.62;
  if (y < top || y > top + h) return null;
  if (y <= top + bh) {
    for (const k of layout.keys.values()) if (k.black && x >= k.x && x <= k.x + k.w) return k.midi;
  }
  for (const k of layout.keys.values()) if (!k.black && x >= k.x && x <= k.x + k.w) return k.midi;
  return null;
}
