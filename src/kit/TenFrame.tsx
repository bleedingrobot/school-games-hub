import { kitColor, type KitColors } from './colors';

/**
 * What one square of a frame shows:
 * - `filled`: a counter.
 * - `highlight`: a counter picked out (the ones that just moved, the part being talked about): accent colour and a ring.
 * - `extra`: a counter that is more than the frame was meant to hold (or an added part): its own colour and a dot inside.
 * - `empty`: a dashed space waiting for a counter.
 * - `faint`: a ghost counter, where one would go (help that fades).
 * Shape as well as colour tells them apart, so they still read in one colour.
 */
export type Square = 'filled' | 'highlight' | 'extra' | 'empty' | 'faint';

export type FrameColor = 'frame' | 'counter' | 'highlight' | 'extra' | 'faint';

export interface TenFrameProps {
  /** One entry per square, left to right, top row first. Shorter than rows x cols: the rest are left blank. */
  squares: readonly Square[];
  /** Default 2 rows of 5, the ten-frame. */
  rows?: number;
  cols?: number;
  /** The words a screen reader says. Required. Never give the answer away while it is still being worked out. */
  label: string;
  colors?: KitColors<FrameColor>;
  className?: string;
}

/** How many of each kind a frame should show, in the order: filled, highlight, extra, then empty, then faint. */
export interface SquareCounts {
  filled?: number;
  highlight?: number;
  extra?: number;
  empty?: number;
  faint?: number;
}

/**
 * Squares for the usual cases, in the order filled, highlight, extra, empty, faint (so a frame fills left to right and
 * the spaces come after). Anything beyond `size` is dropped; a game that needs another order builds its own array.
 */
export function frameSquares(counts: SquareCounts, size = 10): Square[] {
  const out: Square[] = [];
  const add = (kind: Square, n = 0) => {
    for (let i = 0; i < Math.max(0, Math.floor(n)); i++) out.push(kind);
  };
  add('filled', counts.filled);
  add('highlight', counts.highlight);
  add('extra', counts.extra);
  add('empty', counts.empty);
  add('faint', counts.faint);
  return out.slice(0, size);
}

const CELL = 40;
const PAD = 3;

export function TenFrame({ squares, rows = 2, cols = 5, label, colors, className }: TenFrameProps) {
  const frame = kitColor(colors, 'frame');
  const counter = kitColor(colors, 'counter');
  const highlight = kitColor(colors, 'highlight', counter);
  const extra = kitColor(colors, 'extra', counter);
  const faint = kitColor(colors, 'faint', counter);
  const w = cols * CELL + PAD * 2;
  const h = rows * CELL + PAD * 2;
  const r = CELL * 0.33;
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} style={{ color: 'inherit', maxWidth: '100%' }}>
      <g fill="none" stroke={frame} strokeWidth="2">
        {Array.from({ length: rows * cols }, (_, i) => (
          <rect key={i} x={PAD + (i % cols) * CELL} y={PAD + Math.floor(i / cols) * CELL} width={CELL} height={CELL} />
        ))}
      </g>
      {squares.slice(0, rows * cols).map((kind, i) => {
        const cx = PAD + (i % cols) * CELL + CELL / 2;
        const cy = PAD + Math.floor(i / cols) * CELL + CELL / 2;
        switch (kind) {
          case 'filled':
            return <circle key={i} cx={cx} cy={cy} r={r} fill={counter} />;
          case 'highlight':
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={r + 3} fill="none" stroke={highlight} strokeWidth="3" />
                <circle cx={cx} cy={cy} r={r} fill={highlight} />
              </g>
            );
          case 'extra':
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={r} fill={extra} />
                <circle cx={cx} cy={cy} r={r * 0.4} fill="none" stroke="var(--kit-extra-dot, #fff)" strokeWidth="3" />
              </g>
            );
          case 'empty':
            return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={frame} strokeWidth="2" strokeDasharray="4 4" />;
          case 'faint':
            return <circle key={i} cx={cx} cy={cy} r={r} fill={faint} opacity={0.3} />;
        }
      })}
    </svg>
  );
}
