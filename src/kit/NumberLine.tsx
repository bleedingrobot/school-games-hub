import { kitColor, type KitColors } from './colors';

export type LineColor = 'line' | 'landmark' | 'arc' | 'point' | 'text';

export interface Landmark {
  value: number;
  /** Shown under the line. Default: the number. `null` shows a mark with no label (an unmarked spot to read). */
  label?: string | null;
}

export interface Arc {
  from: number;
  to: number;
  /** Written on the arc, for example the size of the jump. */
  label?: string;
  /** Default `above`. Below is for a second set of jumps (back again, or a different way). */
  side?: 'above' | 'below';
}

export interface LinePoint {
  value: number;
  /** Written beside the dot, for example `?` or a name. */
  label?: string;
  /** `ring` is an empty circle (a guess, a place still to fill); `dot` is solid. Default `dot`. */
  look?: 'dot' | 'ring';
}

export interface NumberLineProps {
  min: number;
  max: number;
  /** Small marks every `step` from `min`. Default: none (only landmarks and the two ends). */
  step?: number;
  /** With `step`: label every nth small mark. Default: only the two ends. */
  labelEvery?: number;
  /** Bigger marks that are always there: the middle, the tens, a rock at 10. */
  landmarks?: readonly Landmark[];
  arcs?: readonly Arc[];
  points?: readonly LinePoint[];
  /** The words a screen reader says. Required. Never give the answer away while it is still being worked out. */
  label: string;
  colors?: KitColors<LineColor>;
  className?: string;
}

const W = 600;
const SIDE = 28;
const LINE_W = W - SIDE * 2;
const LABEL_H = 38;
const POINT_R = 8;

/** Where a value sits along the line, 0 at the left end and `width` at the right. Values outside the line are held at its ends. */
export function lineX(value: number, min: number, max: number, width = LINE_W): number {
  if (!(max > min)) return 0;
  const t = (Math.min(Math.max(value, min), max) - min) / (max - min);
  return t * width;
}

/** The small marks the line would draw for `step`: a count cap keeps a huge range from making thousands of elements. */
export function lineTicks(min: number, max: number, step: number): number[] {
  if (!(step > 0) || !(max > min) || (max - min) / step > 400) return [];
  const out: number[] = [];
  const n = Math.round((max - min) / step);
  for (let i = 0; i <= n; i++) out.push(min + i * step);
  return out;
}

/** An arc's height grows with its span but stays inside the picture. */
const arcHeight = (span: number) => 18 + Math.min(span, LINE_W) * 0.18;

export function NumberLine({ min, max, step, labelEvery, landmarks = [], arcs = [], points = [], label, colors, className }: NumberLineProps) {
  const lineC = kitColor(colors, 'line');
  const landC = kitColor(colors, 'landmark', lineC);
  const arcC = kitColor(colors, 'arc');
  const pointC = kitColor(colors, 'point');
  const textC = kitColor(colors, 'text');
  const x = (v: number) => SIDE + lineX(v, min, max);
  const span = (a: Arc) => Math.abs(x(a.to) - x(a.from));
  const up = arcs.filter((a) => (a.side ?? 'above') === 'above');
  const down = arcs.filter((a) => a.side === 'below');
  const top = Math.max(24, ...up.map((a) => arcHeight(span(a)) + (a.label ? 32 : 6)));
  const bottom = LABEL_H + 14 + Math.max(0, ...down.map((a) => arcHeight(span(a)) + (a.label ? 30 : 6)));
  const y = top;
  const H = y + bottom;
  const ticks = lineTicks(min, max, step ?? 0);
  const landValues = new Set(landmarks.map((l) => l.value));
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ maxWidth: '100%' }}>
      <line x1={SIDE} y1={y} x2={W - SIDE} y2={y} stroke={lineC} strokeWidth="3" strokeLinecap="round" />
      {ticks.map((t, i) => {
        const named = labelEvery ? i % labelEvery === 0 : i === 0 || i === ticks.length - 1;
        return (
          <g key={`t${t}`}>
            <line x1={x(t)} y1={y - 6} x2={x(t)} y2={y + 6} stroke={lineC} strokeWidth="2" />
            {named && !landValues.has(t) && (
              <text x={x(t)} y={y + 30} textAnchor="middle" fontSize="21" fill={textC}>
                {t}
              </text>
            )}
          </g>
        );
      })}
      {ticks.length === 0 &&
        [min, max].map((t) => (
          <g key={`e${t}`}>
            <line x1={x(t)} y1={y - 6} x2={x(t)} y2={y + 6} stroke={lineC} strokeWidth="2" />
            {!landValues.has(t) && (
              <text x={x(t)} y={y + 30} textAnchor="middle" fontSize="21" fill={textC}>
                {t}
              </text>
            )}
          </g>
        ))}
      {landmarks.map((l) => (
        <g key={`l${l.value}`}>
          <line x1={x(l.value)} y1={y - 11} x2={x(l.value)} y2={y + 11} stroke={landC} strokeWidth="4" strokeLinecap="round" />
          {l.label !== null && (
            <text x={x(l.value)} y={y + 36} textAnchor="middle" fontSize="23" fontWeight="700" fill={textC}>
              {l.label ?? l.value}
            </text>
          )}
        </g>
      ))}
      {arcs.map((a, i) => {
        const x1 = x(a.from);
        const x2 = x(a.to);
        const dir = (a.side ?? 'above') === 'above' ? -1 : 1;
        const h = arcHeight(Math.abs(x2 - x1)) * dir;
        const mid = (x1 + x2) / 2;
        const startY = y + dir * 4;
        // The arrow head sits at the end of the curve, turned to follow it.
        const tx = x2 - mid;
        const ty = -h * 2;
        const len = Math.hypot(tx, ty) || 1;
        const barb = (turn: number) => {
          const c = Math.cos(turn);
          const s = Math.sin(turn);
          const ux = -tx / len;
          const uy = -ty / len;
          return `${x2 + (ux * c - uy * s) * 10} ${startY + (ux * s + uy * c) * 10}`;
        };
        return (
          <g key={`a${i}`} fill="none" stroke={arcC} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d={`M ${x1} ${startY} Q ${mid} ${startY + h * 2} ${x2} ${startY}`} />
            <path d={`M ${barb(0.5)} L ${x2} ${startY} L ${barb(-0.5)}`} />
            {a.label && (
              <text x={mid} y={startY + h + (dir === -1 ? -8 : 24)} textAnchor="middle" fontSize="22" fontWeight="700" fill={textC} stroke="none">
                {a.label}
              </text>
            )}
          </g>
        );
      })}
      {points.map((p, i) => (
        <g key={`p${i}`}>
          <circle cx={x(p.value)} cy={y} r={POINT_R} fill={p.look === 'ring' ? 'var(--kit-fill, transparent)' : pointC} stroke={pointC} strokeWidth="3" />
          {p.label && (
            <text x={x(p.value)} y={y - 18} textAnchor="middle" fontSize="22" fontWeight="700" fill={textC}>
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
