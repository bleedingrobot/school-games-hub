/**
 * Draws a picture as plain data: where each dot goes, which natural group it belongs to, and the
 * frame or die it sits in. Pure functions of (type, n, random), so a seed always makes the same
 * picture and the tests can check that dots never touch.
 *
 * All pictures live in a 240 x 140 box. The screen scales it.
 */
import { FRAME_CAPACITY, type PictureType } from './config';

export const BOX = { width: 240, height: 140 } as const;
/** Dot radius, and the least gap left between two dots. */
export const DOT_R = 11;
export const MIN_GAP = 6;

export interface Dot {
  x: number;
  y: number;
  /** 0 or 1: the colour used when the dots are split into two colours (scaffolding and two-colour pictures). */
  color: 0 | 1;
  /** Dots with the same group number belong together: the "5 and 3" loops in the help view. */
  group: number;
}

export interface Frame {
  x: number;
  y: number;
  cols: number;
  rows: number;
  cell: number;
}

export interface Die {
  x: number;
  y: number;
  size: number;
  /** Degrees the whole die is turned. */
  turn: number;
}

export interface Picture {
  type: PictureType;
  n: number;
  dots: Dot[];
  frame?: Frame;
  die?: Die;
  /** The colours in the picture are meaningful (a two-colour picture): the screen always shows them. */
  twoColour: boolean;
}

/** A random number between 0 and 1. */
export type Random = () => number;

const pick = <T>(rng: Random, items: readonly T[]): T => items[Math.floor(rng() * items.length)];
const between = (rng: Random, lo: number, hi: number) => lo + rng() * (hi - lo);

function rotate(points: ReadonlyArray<readonly [number, number]>, degrees: number): Array<[number, number]> {
  const a = (degrees * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return points.map(([x, y]) => [x * c - y * s, x * s + y * c]);
}

const place = (points: ReadonlyArray<readonly [number, number]>, cx: number, cy: number, color: 0 | 1, group: number): Dot[] =>
  points.map(([x, y]) => ({ x: cx + x, y: cy + y, color, group }));

/** Small tidy arrangements of 1 to 5 dots, the way a person would place them. */
const TEMPLATES: Record<number, ReadonlyArray<readonly [number, number]>> = {
  1: [[0, 0]],
  2: [[-14, -10], [14, 10]],
  3: [[-18, 12], [18, 12], [0, -16]],
  4: [[-15, -15], [15, -15], [-15, 15], [15, 15]],
  5: [[-20, -20], [20, -20], [0, 0], [-20, 20], [20, 20]],
};

const cluster = (k: number, cx: number, cy: number, color: 0 | 1, group: number, flip = false): Dot[] => {
  const base = TEMPLATES[k].map(([x, y]): [number, number] => [flip ? -x : x, y]);
  return place(base, cx, cy, color, group);
};

/** Two clusters side by side, with a clear gap between them: "4 and 3". */
function twoClusters(a: number, b: number, rng: Random, twoColour: boolean): Dot[] {
  const flip = rng() < 0.5;
  const left = cluster(a, 62, 70 + between(rng, -6, 6), 0, 0, flip);
  const right = cluster(b, 178, 70 + between(rng, -6, 6), twoColour ? 1 : 0, 1, !flip);
  return [...left, ...right];
}

/** Pip positions on a die face, on a 3 x 3 grid (-1, 0 or 1 each way), with the group each pip is in. */
const PIPS: Record<number, ReadonlyArray<readonly [number, number, number]>> = {
  1: [[0, 0, 0]],
  2: [[-1, -1, 0], [1, 1, 0]],
  3: [[-1, -1, 0], [0, 0, 0], [1, 1, 0]],
  4: [[-1, -1, 0], [1, -1, 0], [-1, 1, 1], [1, 1, 1]],
  5: [[-1, -1, 0], [1, -1, 0], [0, 0, 1], [-1, 1, 0], [1, 1, 0]],
  6: [[-1, -1, 0], [-1, 0, 0], [-1, 1, 0], [1, -1, 1], [1, 0, 1], [1, 1, 1]],
};
const PIP_GAP = 30;

function dieFace(n: number, turn: number): { dots: Dot[]; die: Die } {
  const rotated = rotate(PIPS[n].map(([x, y]) => [x * PIP_GAP, y * PIP_GAP] as const), turn);
  const dots = rotated.map(([x, y], i) => ({
    x: BOX.width / 2 + x,
    y: BOX.height / 2 + y,
    color: (PIPS[n][i][2] === 1 ? 1 : 0) as 0 | 1,
    group: PIPS[n][i][2],
  }));
  return { dots, die: { x: BOX.width / 2, y: BOX.height / 2, size: 2 * PIP_GAP + 2 * DOT_R + 14, turn } };
}

/** A frame of `cols` x `rows` squares, centred in the box. */
function frameOf(cols: number, rows: number, cell: number): Frame {
  return { x: (BOX.width - cols * cell) / 2, y: (BOX.height - rows * cell) / 2, cols, rows, cell };
}
const cellCentre = (f: Frame, col: number, row: number) => ({ x: f.x + (col + 0.5) * f.cell, y: f.y + (row + 0.5) * f.cell });

/**
 * Which squares of a frame hold a counter. Rows: left to right along the top, then the bottom.
 * Pairs: down each column, top then bottom, then the next column. Mixed: squares picked at random.
 */
function filledCells(type: PictureType, n: number, rng: Random): Array<[number, number]> {
  if (type === 'five') return Array.from({ length: n }, (_, i) => [i, 0] as [number, number]);
  if (type === 'ten') return Array.from({ length: n }, (_, i) => [i % 5, Math.floor(i / 5)] as [number, number]);
  if (type === 'tenpair') return Array.from({ length: n }, (_, i) => [Math.floor(i / 2), i % 2] as [number, number]);
  const all: Array<[number, number]> = [];
  for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) all.push([col, row]);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, n);
}

function framePicture(type: PictureType, n: number, rng: Random): Picture {
  const rows = type === 'five' ? 1 : 2;
  const cols = 5;
  const frame = frameOf(cols, rows, type === 'five' ? 44 : 40);
  const dots = filledCells(type, n, rng).map(([col, row]) => ({ ...cellCentre(frame, col, row), color: 0 as const, group: row }));
  return { type, n, dots, frame, twoColour: false };
}

/** Splits n into two parts, the bigger first, both at least 1 and at most 5. */
function split(n: number, rng: Random): [number, number] {
  const options: Array<[number, number]> = [];
  for (let a = 1; a <= 5; a++) {
    const b = n - a;
    if (b >= 1 && b <= a) options.push([a, b]);
  }
  return pick(rng, options);
}

/** A picture of `n` things in the style of `type`. Throws for a number the type can't make. */
export function makePicture(type: PictureType, n: number, rng: Random): Picture {
  switch (type) {
    case 'line': {
      const dots = Array.from({ length: n }, (_, i) => ({ x: BOX.width / 2 + (i - (n - 1) / 2) * 44, y: BOX.height / 2, color: 0 as const, group: 0 }));
      return { type, n, dots, twoColour: false };
    }
    case 'clus': {
      const jitter = between(rng, -4, 4);
      return { type, n, dots: place(TEMPLATES[n].map(([x, y]) => [x * 1.4, y * 1.4 + jitter] as const), BOX.width / 2, BOX.height / 2, 0, 0), twoColour: false };
    }
    case 'angl': {
      const turn = pick(rng, [-50, -35, -20, 20, 35, 50]);
      const along: ReadonlyArray<readonly [number, number]> = n === 1 ? [[0, 0]] : n === 2 ? [[-26, 0], [26, 0]] : [[-44, 0], [0, 0], [44, 0]];
      return { type, n, dots: place(rotate(along, turn), BOX.width / 2, BOX.height / 2, 0, 0), twoColour: false };
    }
    case 'dice':
    case 'dicet': {
      const { dots, die } = dieFace(n, type === 'dicet' ? 45 : 0);
      return { type, n, dots, die, twoColour: false };
    }
    case 'dots': {
      const [a, b] = split(n, rng);
      return { type, n, dots: twoClusters(a, b, rng, false), twoColour: false };
    }
    case 'pair': {
      const [a, b] = split(n, rng);
      return { type, n, dots: twoClusters(a, b, rng, true), twoColour: true };
    }
    case 'fiveplus': {
      const five = place(TEMPLATES[5], 72, 70, 0, 0);
      const extra = place(TEMPLATES[n - 5], 176, 70, 1, 1);
      return { type, n, dots: [...five, ...extra], twoColour: true };
    }
    case 'five':
    case 'ten':
    case 'tenpair':
    case 'tenmix':
      return framePicture(type, n, rng);
  }
}

/** For Missing Spots: a frame with `filled` counters in it. */
export function makeGapPicture(type: PictureType, filled: number, rng: Random): Picture {
  const capacity = FRAME_CAPACITY[type];
  if (!capacity || filled < 1 || filled >= capacity) throw new Error(`No Missing Spots picture for ${type} with ${filled}`);
  return framePicture(type, filled, rng);
}

/** Smallest distance between two dot centres (Infinity for fewer than two dots). */
export function closestPair(dots: readonly Dot[]): number {
  let best = Infinity;
  for (let i = 0; i < dots.length; i++) {
    for (let j = i + 1; j < dots.length; j++) best = Math.min(best, Math.hypot(dots[i].x - dots[j].x, dots[i].y - dots[j].y));
  }
  return best;
}

/** The sizes of the natural groups, biggest first: [5, 3] for "5 and 3". */
export function groupSizes(picture: Picture): number[] {
  const counts = new Map<number, number>();
  for (const d of picture.dots) counts.set(d.group, (counts.get(d.group) ?? 0) + 1);
  return [...counts.values()].sort((a, b) => b - a);
}
