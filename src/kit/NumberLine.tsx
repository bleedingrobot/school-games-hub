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
  /** Which colour part the dot uses. Default `point`. A game that shows a guess and a true place gives one of them `landmark` or `arc`. */
  tone?: LineColor;
  /** Written beside the dot, for example `?` or a name. */
  label?: string;
  /** `ring` is an empty circle (a guess, a place still to fill); `dot` is solid; `arrow` is a down-pointing arrow above the line, tip on the value, with the label above it ("what number is at the arrow?"). Default `dot`. */
  look?: 'dot' | 'ring' | 'arrow';
}

/**
 * A zoom lens: a second, bigger line under the first that shows only the part between `from` and `to`. The part is
 * marked on the first line and joined to the lens by two guide lines. The lens has its own marks, landmarks and points.
 */
export interface Lens {
  from: number;
  to: number;
  step?: number;
  labelEvery?: number;
  landmarks?: readonly Landmark[];
  points?: readonly LinePoint[];
  /** Jumps drawn on the lens line, the same as the first line's `arcs`. */
  arcs?: readonly Arc[];
  /** Height kept above the lens line, in picture units, so it does not move when arcs appear later. */
  room?: number;
  /** Height kept below the lens line's labels. */
  roomBelow?: number;
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
  /** Height kept above the line, in picture units. A game that will draw arcs or an arrow later passes it now, so the line never moves. */
  room?: number;
  /** Height kept below the line's labels (for arcs drawn below later). */
  roomBelow?: number;
  /** A zoom lens under the line (see `Lens`). */
  lens?: Lens;
  /**
   * Makes the line tappable: called with the value under the tap, as a number in the line's own units (not rounded), held
   * between its two ends. With a lens, the tap is on the lens line unless `pickOn` is `line`. A game decides what counts
   * as close enough.
   */
  onPick?: (value: number) => void;
  pickOn?: 'line' | 'lens';
  /** The words a screen reader says. Required. Never give the answer away while it is still being worked out. */
  label: string;
  colors?: KitColors<LineColor>;
  className?: string;
}

const W = 600;
const SIDE = 28;
const LINE_W = W - SIDE * 2;
/** The height of the lens line below the first line's labels. */
const LENS_GAP = 56;
/** How far either side of the line a tap still counts as on it. */
const TAP_REACH = 30;

/** The value under a tap, from where it landed along the line (`x` in the picture's own 0 to 600 units). Held between the ends. */
export function valueAtX(x: number, min: number, max: number, width = LINE_W, side = SIDE): number {
  if (!(max > min)) return min;
  const t = Math.min(Math.max((x - side) / width, 0), 1);
  return min + t * (max - min);
}
const LABEL_H = 38;
const POINT_R = 8;
/** How far above the line an arrow point's stem starts. */
const ARROW_LEN = 38;
/** Height an arrow point needs above the line (stem plus a label). */
const ARROW_ROOM = ARROW_LEN + 26;

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

const upArcs = (arcs: readonly Arc[]) => arcs.filter((a) => (a.side ?? 'above') === 'above');
const downArcs = (arcs: readonly Arc[]) => arcs.filter((a) => a.side === 'below');
const arcSpan = (a: Arc, min: number, max: number) => Math.abs(lineX(a.to, min, max) - lineX(a.from, min, max));
/** Height needed above a line for its arcs above and any arrow point. */
const roomAbove = (arcs: readonly Arc[], points: readonly LinePoint[], min: number, max: number) =>
  Math.max(0, ...upArcs(arcs).map((a) => arcHeight(arcSpan(a, min, max)) + (a.label ? 32 : 6)), ...(points.some((p) => p.look === 'arrow') ? [ARROW_ROOM] : []));
/** Height needed below a line's labels for its arcs below. */
const roomUnder = (arcs: readonly Arc[], min: number, max: number) =>
  Math.max(0, ...downArcs(arcs).map((a) => arcHeight(arcSpan(a, min, max)) + (a.label ? 30 : 6)));

/** The jumps of one line, drawn above or below it. Used for the main line and for the lens. */
function Arcs({ arcs, min, max, y, colors }: { arcs: readonly Arc[]; min: number; max: number; y: number; colors?: KitColors<LineColor> }) {
  const arcC = kitColor(colors, 'arc');
  const textC = kitColor(colors, 'text');
  const x = (v: number) => SIDE + lineX(v, min, max);
  return (
    <g>
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
    </g>
  );
}

/** The marks of one line: small marks, the ends, landmarks, then points. Used for the main line and for the lens. */
function Marks({ min, max, step, labelEvery, landmarks, points, y, colors }: {
  min: number; max: number; step?: number; labelEvery?: number; landmarks: readonly Landmark[]; points: readonly LinePoint[]; y: number; colors?: KitColors<LineColor>;
}) {
  const lineC = kitColor(colors, 'line');
  const landC = kitColor(colors, 'landmark', lineC);
  const textC = kitColor(colors, 'text');
  const x = (v: number) => SIDE + lineX(v, min, max);
  const ticks = lineTicks(min, max, step ?? 0);
  const landValues = new Set(landmarks.map((l) => l.value));
  return (
    <g>
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
      {points.map((p, i) => {
        const c = kitColor(colors, p.tone ?? 'point');
        if (p.look === 'arrow') {
          const px = x(p.value);
          return (
            <g key={`p${i}`} fill={c} stroke={c} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <line x1={px} y1={y - ARROW_LEN} x2={px} y2={y - 14} />
              <path d={`M ${px - 9} ${y - 19} L ${px} ${y - 6} L ${px + 9} ${y - 19} Z`} strokeWidth="2" />
              {p.label && (
                <text x={px} y={y - ARROW_LEN - 8} textAnchor="middle" fontSize="22" fontWeight="700" fill={textC} stroke="none">
                  {p.label}
                </text>
              )}
            </g>
          );
        }
        return (
          <g key={`p${i}`}>
            <circle cx={x(p.value)} cy={y} r={POINT_R} fill={p.look === 'ring' ? 'var(--kit-fill, transparent)' : c} stroke={c} strokeWidth="3" />
            {p.label && (
              <text x={x(p.value)} y={y - 18} textAnchor="middle" fontSize="22" fontWeight="700" fill={textC}>
                {p.label}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

export function NumberLine({ min, max, step, labelEvery, landmarks = [], arcs = [], points = [], room, roomBelow, lens, onPick, pickOn, label, colors, className }: NumberLineProps) {
  const lineC = kitColor(colors, 'line');
  const x = (v: number) => SIDE + lineX(v, min, max);
  const top = Math.max(24, room ?? 0, roomAbove(arcs, points, min, max));
  const bottomMain = LABEL_H + 14 + Math.max(0, roomBelow ?? 0, roomUnder(arcs, min, max));
  const y = top;
  // The lens line sits below everything on the first line, with room for its own labels and arcs.
  const lensArcs = lens?.arcs ?? [];
  const lensTop = lens ? Math.max(0, lens.room ?? 0, roomAbove(lensArcs, lens.points ?? [], lens.from, lens.to)) : 0;
  const lensBottom = lens ? Math.max(0, lens.roomBelow ?? 0, roomUnder(lensArcs, lens.from, lens.to)) : 0;
  const lensY = y + bottomMain - 14 + LENS_GAP + lensTop;
  const H = lens ? lensY + LABEL_H + 14 + lensBottom : y + bottomMain;
  const tapOn = onPick ? (lens && pickOn !== 'line' ? 'lens' : 'line') : null;
  const tap = (e: React.PointerEvent<SVGRectElement>) => {
    if (!onPick) return;
    const svg = e.currentTarget.ownerSVGElement;
    const box = svg?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const px = ((e.clientX - box.left) / box.width) * W;
    onPick(tapOn === 'lens' && lens ? valueAtX(px, lens.from, lens.to) : valueAtX(px, min, max));
  };
  const tapY = tapOn === 'lens' ? lensY : y;
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ maxWidth: '100%', touchAction: onPick ? 'none' : undefined }}>
      <Marks min={min} max={max} step={step} labelEvery={labelEvery} landmarks={landmarks} points={points} y={y} colors={colors} />
      {lens && (
        <g>
          <rect x={x(lens.from)} y={y - 9} width={Math.max(3, x(lens.to) - x(lens.from))} height="18" rx="4" fill={kitColor(colors, 'landmark', lineC)} opacity="0.35" />
          <g stroke={lineC} strokeWidth="2" strokeDasharray="5 5" opacity="0.7">
            <line x1={x(lens.from)} y1={y + 10} x2={SIDE} y2={lensY - 12} />
            <line x1={x(lens.to)} y1={y + 10} x2={W - SIDE} y2={lensY - 12} />
          </g>
          <Marks min={lens.from} max={lens.to} step={lens.step} labelEvery={lens.labelEvery} landmarks={lens.landmarks ?? []} points={lens.points ?? []} y={lensY} colors={colors} />
          <Arcs arcs={lensArcs} min={lens.from} max={lens.to} y={lensY} colors={colors} />
        </g>
      )}
      <Arcs arcs={arcs} min={min} max={max} y={y} colors={colors} />
      {onPick && <rect data-pick={tapOn} x={0} y={tapY - TAP_REACH} width={W} height={TAP_REACH * 2 + 20} fill="transparent" style={{ cursor: 'pointer' }} onPointerDown={tap} />}
    </svg>
  );
}
