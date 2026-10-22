import { BOX, DOT_R, type Dot, type Picture } from '../../shared/subitising/patterns';

/** How to draw a picture: plain, with the natural groups outlined and coloured (help), or as a right answer (a green edge). */
export type PictureMode = 'plain' | 'help' | 'right';

interface Props {
  picture: Picture;
  mode?: PictureMode;
  /** Draw ghost counters in the empty squares of a frame (Missing Spots, after the answer). */
  ghosts?: boolean;
  /** The words a screen reader says. Never the number while the answer is still being worked out. */
  label: string;
}

const COLOURS = ['#2f6fb5', '#e0891a'] as const;
const INK = '#1f2a37';
const HELP_LOOP = '#6d7d93';

const pad = DOT_R + 7;

/** A rounded box round every dot of one group. */
function groupBoxes(dots: readonly Dot[]) {
  const groups = new Map<number, Dot[]>();
  for (const d of dots) groups.set(d.group, [...(groups.get(d.group) ?? []), d]);
  return [...groups.entries()].map(([group, list]) => {
    const xs = list.map((d) => d.x);
    const ys = list.map((d) => d.y);
    return { group, x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + 2 * pad, h: Math.max(...ys) - Math.min(...ys) + 2 * pad };
  });
}

export function PictureSvg({ picture, mode = 'plain', ghosts = false, label }: Props) {
  const { dots, frame, die } = picture;
  const colourOf = (d: Dot) => COLOURS[mode === 'help' ? d.group % 2 : d.color];
  const empty: Array<{ x: number; y: number }> = [];
  if (ghosts && frame) {
    const taken = new Set(dots.map((d) => `${Math.round(d.x)},${Math.round(d.y)}`));
    for (let row = 0; row < frame.rows; row++) {
      for (let col = 0; col < frame.cols; col++) {
        const x = frame.x + (col + 0.5) * frame.cell;
        const y = frame.y + (row + 0.5) * frame.cell;
        if (!taken.has(`${Math.round(x)},${Math.round(y)}`)) empty.push({ x, y });
      }
    }
  }
  return (
    <svg className={`sb-picture sb-picture-${mode}`} viewBox={`0 0 ${BOX.width} ${BOX.height}`} role="img" aria-label={label}>
      <rect x="1" y="1" width={BOX.width - 2} height={BOX.height - 2} rx="14" className="sb-picture-edge" />
      {die && (
        <rect
          x={die.x - die.size / 2}
          y={die.y - die.size / 2}
          width={die.size}
          height={die.size}
          rx="12"
          fill="#fff"
          stroke={INK}
          strokeWidth="3"
          transform={`rotate(${die.turn} ${die.x} ${die.y})`}
        />
      )}
      {frame && (
        <g stroke={INK} strokeWidth="3" fill="#fff">
          {Array.from({ length: frame.rows * frame.cols }, (_, i) => (
            <rect key={i} x={frame.x + (i % frame.cols) * frame.cell} y={frame.y + Math.floor(i / frame.cols) * frame.cell} width={frame.cell} height={frame.cell} />
          ))}
        </g>
      )}
      {mode === 'help' &&
        groupBoxes(dots).map((b) => <rect key={b.group} x={b.x} y={b.y} width={b.w} height={b.h} rx="14" className="sb-loop" stroke={HELP_LOOP} />)}
      {empty.map((e, i) => (
        <circle key={`g${i}`} cx={e.x} cy={e.y} r={DOT_R} className="sb-ghost" />
      ))}
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={DOT_R} fill={colourOf(d)} />
      ))}
    </svg>
  );
}

/** A blank box the same size, for when the picture has gone. */
export function BlankPicture({ label }: { label: string }) {
  return (
    <svg className="sb-picture sb-picture-blank" viewBox={`0 0 ${BOX.width} ${BOX.height}`} role="img" aria-label={label}>
      <rect x="1" y="1" width={BOX.width - 2} height={BOX.height - 2} rx="14" className="sb-picture-edge" />
    </svg>
  );
}
