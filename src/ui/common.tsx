import { useEffect, useState } from 'react';
import { isBlack, midiName } from '../music/theory';

/* ---------------- tiny hash router ---------------- */
export function useRoute(): string[] {
  const get = () => (location.hash.replace(/^#\/?/, '') || 'home').split('/').map(decodeURIComponent);
  const [r, setR] = useState(get);
  useEffect(() => {
    const f = () => setR(get());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}

export function go(path: string) {
  location.hash = '#/' + path;
}

export function back(fallback = 'home') {
  if (history.length > 1) history.back();
  else go(fallback);
}

/* ---------------- stars ---------------- */
export function Stars({ n, of = 3, size = 16 }: { n: number; of?: number; size?: number }) {
  return (
    <span className="stars" style={{ fontSize: size }}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={i < n ? 'star-on' : 'star-off'}>
          ★
        </span>
      ))}
    </span>
  );
}

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <div className="row" style={{ marginBottom: 14 }}>
      {onBack && (
        <button className="icon-btn" onClick={onBack} aria-label="Retour">
          ←
        </button>
      )}
      <h1 className="title-l grow">{title}</h1>
      {right}
    </div>
  );
}

/* ---------------- illustrative keyboard (SVG) ---------------- */
export function MiniKeyboard({ lo = 48, hi = 72, highlight = [], names = true }: { lo?: number; hi?: number; highlight?: number[]; names?: boolean }) {
  const whites: number[] = [];
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
  const W = 30;
  const H = 120;
  const width = whites.length * W;
  const hl = new Set(highlight);
  const blacks: { m: number; x: number }[] = [];
  whites.forEach((m, i) => {
    if (m + 1 <= hi && isBlack(m + 1)) blacks.push({ m: m + 1, x: (i + 1) * W - 9 });
  });
  return (
    <svg className="mini-kbd" viewBox={`0 0 ${width} ${H + 4}`} role="img" aria-label="Clavier">
      {whites.map((m, i) => (
        <g key={m}>
          <rect x={i * W + 1} y={1} width={W - 2} height={H} rx={5} fill={hl.has(m) ? '#ffcf33' : '#fbfaff'} />
          {names && (hl.has(m) || m % 12 === 0) && (
            <text x={i * W + W / 2} y={H - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill="#3a2f63">
              {midiName(m)}
            </text>
          )}
          {m === 60 && <circle cx={i * W + W / 2} cy={H - 26} r={3} fill="#ff3d9a" />}
        </g>
      ))}
      {blacks.map(({ m, x }) => (
        <g key={m}>
          <rect x={x} y={1} width={18} height={H * 0.62} rx={3} fill={hl.has(m) ? '#ffcf33' : '#1c1633'} />
          {names && hl.has(m) && (
            <text x={x + 9} y={H * 0.62 - 8} textAnchor="middle" fontSize="8" fontWeight="700" fill="#1c1633">
              {midiName(m)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function fmtMinutes(min: number) {
  if (min < 1) return `${Math.round(min * 60)} s`;
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h} h ${m.toString().padStart(2, '0')}`;
}

export function Ring({ value, size = 64, stroke = 7, children }: { value: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.18)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={v >= 1 ? '#36d07e' : '#ffcf33'}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13 }}>{children}</div>
    </div>
  );
}
