/**
 * Small drawing pieces used to build every monster: eyes, leaves, flames, spikes, crystals and
 * bolts. Each is a bit of SVG in a 120 × 120 picture; the families in MonsterArt put them together.
 */
import type { ReactNode } from 'react';
import type { TypeId } from '../../../../shared/monsters/types';

export interface Palette {
  /** The main body colour. */
  main: string;
  /** Shadows, outlines and the darker parts. */
  dark: string;
  /** Bellies and highlights. */
  light: string;
  /** A little colour to pop: flames, flower middles, gems. */
  accent: string;
}

export const PALETTES: Record<TypeId, Palette> = {
  leaf: { main: '#4ade80', dark: '#15803d', light: '#dcfce7', accent: '#facc15' },
  water: { main: '#38bdf8', dark: '#0369a1', light: '#e0f2fe', accent: '#f0f9ff' },
  fire: { main: '#fb923c', dark: '#b45309', light: '#fed7aa', accent: '#fde047' },
  ice: { main: '#a5f3fc', dark: '#0e7490', light: '#ecfeff', accent: '#3b82f6' },
  spark: { main: '#fde047', dark: '#a16207', light: '#fef9c3', accent: '#a855f7' },
  stone: { main: '#a8a29e', dark: '#44403c', light: '#e7e5e4', accent: '#f59e0b' },
};

/** The rare "shiny" colours: same drawing, a different colour. */
export const SHINY_PALETTES: Record<TypeId, Palette> = {
  leaf: { main: '#f472b6', dark: '#9d174d', light: '#fce7f3', accent: '#a3e635' },
  water: { main: '#a78bfa', dark: '#5b21b6', light: '#ede9fe', accent: '#f9a8d4' },
  fire: { main: '#2dd4bf', dark: '#0f766e', light: '#ccfbf1', accent: '#bfdbfe' },
  ice: { main: '#fda4af', dark: '#9f1239', light: '#fff1f2', accent: '#facc15' },
  spark: { main: '#60a5fa', dark: '#1d4ed8', light: '#dbeafe', accent: '#f472b6' },
  stone: { main: '#fbbf24', dark: '#92400e', light: '#fef3c7', accent: '#38bdf8' },
};

export const OUTLINE = '#1e293b';

export interface PartProps {
  c: Palette;
}

/** A pair of eyes. First forms have big, round, cute eyes; last forms narrow, angry ones. */
export function Eyes({ x, y, gap, stage, size = 1 }: { x: number; y: number; gap: number; stage: 1 | 2 | 3; size?: number }) {
  const r = (stage === 1 ? 7 : stage === 2 ? 6 : 5.2) * size;
  const eye = (cx: number, side: -1 | 1) => (
    <g key={side}>
      <ellipse cx={cx} cy={y} rx={r} ry={stage === 3 ? r * 0.85 : r * 1.1} fill="#fff" stroke={OUTLINE} strokeWidth="1.6" />
      <circle cx={cx + side * 0.8} cy={y + 0.6} r={r * 0.55} fill={OUTLINE} />
      <circle cx={cx + side * 0.8 - r * 0.2} cy={y - r * 0.2} r={r * 0.18} fill="#fff" />
      {stage === 3 && <path d={`M${cx - r * 1.2} ${y - r * 1.3 + (side === -1 ? 0 : 3)} L${cx + r * 1.2} ${y - r * 1.3 + (side === -1 ? 3 : 0)}`} stroke={OUTLINE} strokeWidth="2.4" strokeLinecap="round" />}
    </g>
  );
  return (
    <g>
      {eye(x - gap, -1)}
      {eye(x + gap, 1)}
    </g>
  );
}

/** A small smile (or a toothy grin on grown forms). */
export function Mouth({ x, y, stage }: { x: number; y: number; stage: 1 | 2 | 3 }) {
  if (stage === 3) {
    return (
      <g>
        <path d={`M${x - 8} ${y} Q${x} ${y + 7} ${x + 8} ${y} Z`} fill={OUTLINE} />
        <path d={`M${x - 4} ${y} l2 3 l2 -3 M${x + 1} ${y} l2 3 l2 -3`} stroke="#fff" strokeWidth="1.4" fill="none" />
      </g>
    );
  }
  return <path d={`M${x - 5} ${y} Q${x} ${y + (stage === 1 ? 5 : 4)} ${x + 5} ${y}`} stroke={OUTLINE} strokeWidth="2" fill="none" strokeLinecap="round" />;
}

/** Rosy cheeks, only on cute first forms. */
export function Cheeks({ x, y, gap }: { x: number; y: number; gap: number }) {
  return (
    <g fill="#fb7185" opacity="0.5">
      <ellipse cx={x - gap} cy={y} rx="4.5" ry="3" />
      <ellipse cx={x + gap} cy={y} rx="4.5" ry="3" />
    </g>
  );
}

/** A leaf growing from (x, y), pointing `rot` degrees (0 = right, -90 = up). */
export function Leaf({ x, y, len, rot, c }: { x: number; y: number; len: number; rot: number; c: Palette }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d={`M0 0 Q${len * 0.5} ${-len * 0.45} ${len} 0 Q${len * 0.5} ${len * 0.45} 0 0Z`} fill={c.main} stroke={c.dark} strokeWidth="1.8" strokeLinejoin="round" />
      <path d={`M2 0 L${len * 0.85} 0`} stroke={c.dark} strokeWidth="1.2" opacity="0.6" />
    </g>
  );
}

/** A flame with its base at (x, y). */
export function Flame({ x, y, h, c, rot = 0 }: { x: number; y: number; h: number; c: Palette; rot?: number }) {
  const w = h * 0.34;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d={`M0 0 C${-w * 1.3} ${-h * 0.2} ${-w} ${-h * 0.6} 0 ${-h} C${w * 0.3} ${-h * 0.6} ${w * 1.2} ${-h * 0.5} ${w * 1.1} ${-h * 0.2} C${w} ${-h * 0.05} ${w * 0.4} 0 0 0Z`} fill={c.main} stroke={c.dark} strokeWidth="1.6" strokeLinejoin="round" />
      <path d={`M0 ${-h * 0.05} C${-w * 0.6} ${-h * 0.2} ${-w * 0.4} ${-h * 0.45} 0 ${-h * 0.6} C${w * 0.5} ${-h * 0.4} ${w * 0.5} ${-h * 0.15} 0 ${-h * 0.05}Z`} fill={c.accent} />
    </g>
  );
}

/** A triangle spike with its base centred at (x, y) pointing `rot` degrees (0 = up). */
export function Spike({ x, y, w, h, rot = 0, fill, stroke }: { x: number; y: number; w: number; h: number; rot?: number; fill: string; stroke: string }) {
  return <path transform={`translate(${x} ${y}) rotate(${rot})`} d={`M${-w / 2} 0 L0 ${-h} L${w / 2} 0Z`} fill={fill} stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />;
}

/** A pointed crystal (ice, gems), base centred at (x, y). */
export function Crystal({ x, y, w, h, rot = 0, fill, stroke, shine }: { x: number; y: number; w: number; h: number; rot?: number; fill: string; stroke: string; shine: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d={`M${-w / 2} 0 L${-w / 2} ${-h * 0.6} L0 ${-h} L${w / 2} ${-h * 0.6} L${w / 2} 0Z`} fill={fill} stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
      <path d={`M${-w * 0.18} ${-h * 0.15} L${-w * 0.18} ${-h * 0.6} L0 ${-h * 0.82}`} fill="none" stroke={shine} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

/** A lightning bolt with its top-left at (x, y). */
export function Bolt({ x, y, s, fill, stroke, rot = 0 }: { x: number; y: number; s: number; fill: string; stroke: string; rot?: number }) {
  return <polygon transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} points="4,0 -6,13 -1,13 -4,24 7,9 2,9" fill={fill} stroke={stroke} strokeWidth={1.6 / s} strokeLinejoin="round" />;
}

/** A little four-point sparkle. */
export function Sparkle({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  return <path transform={`translate(${x} ${y})`} d={`M0 ${-r} Q0 0 ${r} 0 Q0 0 0 ${r} Q0 0 ${-r} 0 Q0 0 0 ${-r}Z`} fill={fill} className="mon-sparkle" />;
}

/** The soft shadow on the ground. */
export function Shadow({ rx = 34 }: { rx?: number }) {
  return <ellipse cx="60" cy="109" rx={rx} ry="6" fill="#0f172a" opacity="0.22" />;
}

/** Layers a drawing: a plain <g> that keeps the order readable in MonsterArt. */
export function Layer({ children }: { children: ReactNode }) {
  return <g>{children}</g>;
}
