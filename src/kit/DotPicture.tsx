import { kitColor, type KitColors } from './colors';

/** One dot, placed in the picture's own units. `tone` picks a colour from `tones` (default the first); `group` is for outlining. */
export interface PictureDot {
  x: number;
  y: number;
  tone?: number;
  group?: number;
}

/** A grid of squares the dots can sit in (a ten-frame or a rekenrek-style layout drawn behind them). */
export interface PictureFrame {
  x: number;
  y: number;
  rows: number;
  cols: number;
  cell: number;
}

export type PictureColor = 'edge' | 'frame' | 'outline' | 'gap' | 'ghost' | 'ink';

export interface DotPictureProps {
  dots: readonly PictureDot[];
  /** The picture's size in its own units; the picture scales to fit. */
  width: number;
  height: number;
  radius?: number;
  frame?: PictureFrame;
  /** Colours for `tone` 0, 1, 2 and so on. Default: the text colour for all. */
  tones?: readonly string[];
  /**
   * `plain`: dots as given. `groups`: each `group` outlined, and coloured by its number rather than its `tone` (help that
   * shows the natural groups).
   */
  mode?: 'plain' | 'groups';
  /** Frame squares with no dot are tinted so the gaps stand out. */
  tintGaps?: boolean;
  /** Frame squares with no dot get a ghost dot (after the answer). */
  ghosts?: boolean;
  /** The words a screen reader says. Required. Never give the number while the answer is still being worked out. */
  label: string;
  colors?: KitColors<PictureColor>;
  className?: string;
}

/** Dot places for `rows` rows of `cols`, in neat rows (an array), centred in a box. Gives a game the places without its own sums. */
export function gridDots(rows: number, cols: number, width: number, height: number, gap: number): PictureDot[] {
  const out: PictureDot[] = [];
  const x0 = (width - (cols - 1) * gap) / 2;
  const y0 = (height - (rows - 1) * gap) / 2;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: x0 + c * gap, y: y0 + r * gap, group: r });
  return out;
}

export function DotPicture({ dots, width, height, radius = 11, frame, tones = [], mode = 'plain', tintGaps = false, ghosts = false, label, colors, className }: DotPictureProps) {
  const ink = kitColor(colors, 'ink');
  const edge = kitColor(colors, 'edge', ink);
  const frameC = kitColor(colors, 'frame', ink);
  const outline = kitColor(colors, 'outline', ink);
  const gap = kitColor(colors, 'gap', 'transparent');
  const ghost = kitColor(colors, 'ghost', ink);
  const tone = (i: number) => tones[i % Math.max(1, tones.length)] ?? ink;
  const colourOf = (d: PictureDot) => tone(mode === 'groups' ? d.group ?? 0 : d.tone ?? 0);

  const taken = new Set(dots.map((d) => `${Math.round(d.x)},${Math.round(d.y)}`));
  const cells: Array<{ i: number; x: number; y: number; empty: boolean }> = [];
  if (frame) {
    for (let i = 0; i < frame.rows * frame.cols; i++) {
      const x = frame.x + (i % frame.cols) * frame.cell;
      const y = frame.y + Math.floor(i / frame.cols) * frame.cell;
      cells.push({ i, x, y, empty: !taken.has(`${Math.round(x + frame.cell / 2)},${Math.round(y + frame.cell / 2)}`) });
    }
  }

  const pad = radius + 7;
  const groups = new Map<number, PictureDot[]>();
  if (mode === 'groups') for (const d of dots) groups.set(d.group ?? 0, [...(groups.get(d.group ?? 0) ?? []), d]);

  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} style={{ maxWidth: '100%' }}>
      <rect x="1" y="1" width={width - 2} height={height - 2} rx="14" fill="none" stroke={edge} strokeWidth="2" opacity={0.5} />
      {frame && (
        <g stroke={frameC} strokeWidth="3" fill="none">
          {cells.map((c) => (
            <rect key={c.i} x={c.x} y={c.y} width={frame.cell} height={frame.cell} fill={tintGaps && c.empty ? gap : 'none'} />
          ))}
        </g>
      )}
      {[...groups.entries()].map(([g, list]) => {
        const xs = list.map((d) => d.x);
        const ys = list.map((d) => d.y);
        const x0 = Math.min(...xs) - pad;
        const y0 = Math.min(...ys) - pad;
        return <rect key={`g${g}`} x={x0} y={y0} width={Math.max(...xs) + pad - x0} height={Math.max(...ys) + pad - y0} rx="14" fill="none" stroke={outline} strokeWidth="2" strokeDasharray="6 4" />;
      })}
      {ghosts &&
        frame &&
        cells.filter((c) => c.empty).map((c) => <circle key={`h${c.i}`} cx={c.x + frame.cell / 2} cy={c.y + frame.cell / 2} r={radius} fill="none" stroke={ghost} strokeWidth="2" strokeDasharray="4 4" />)}
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={radius} fill={colourOf(d)} />
      ))}
    </svg>
  );
}
