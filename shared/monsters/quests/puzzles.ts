/**
 * The puzzles (docs/MONSTERS-QUESTS-PLAN.md section 7): quick logic and number-sense puzzles that open
 * from an object on the map (a rock pool, a lantern door, an ice hut, a stone door, the wharf). They are
 * not maths practice and make no answer records. The layouts are data (PUZZLES): EASY TO EDIT, and the
 * test checks every one can be solved.
 *
 * A puzzle's state lives only while its screen is open (leave and it starts again). Solving it once sets
 * the flag "solved:<id>" and gives its prize once (questWorld.solvePuzzle).
 *
 * Grids are rows of text, top row first:
 *  - stones: numbers split by spaces; you start on the left bank and must reach the right bank
 *  - slide:  '.' ice, '#' rock, 'S' start, 'C' the chest (sliding onto it stops you)
 *  - crates: '#' wall, '.' floor, 'P' you, 'B' a crate, 'x' a crate's place, 'X' a crate already in place
 */
import type { TypeId } from '../types';
import type { EggKind } from './types';

export type PuzzleKind = 'pods' | 'stones' | 'slide' | 'lanterns' | 'lock' | 'crates';

interface Base {
  id: string;
  title: string;
  /** What the screen says at the top. */
  says: string;
  /** Shown after 3 tries ("show me"). */
  hint: string;
  /** The prize the first time: a few bits of the area's type, or an egg (the bonus areas). */
  prize: { bits: TypeId; n: number } | { egg: EggKind };
}

export type Puzzle =
  | (Base & { kind: 'pods'; count: number })
  | (Base & { kind: 'stones'; grid: string[]; multipleOf: number })
  | (Base & { kind: 'slide'; grid: string[] })
  | (Base & { kind: 'lanterns'; numbers: number[] })
  | (Base & { kind: 'lock'; code: string; clues: string[] })
  | (Base & { kind: 'crates'; grid: string[] });

export const PUZZLES: readonly Puzzle[] = [
  {
    id: 'kauri-seeds', kind: 'pods', count: 3, title: 'Seed pods',
    says: 'The Hermit lost 3 seed pods somewhere in Kauri Bush. Look closely at the bushes!',
    hint: 'One is in a tree near the old kauri, one in a bush beside Tama on the west side, and one in the branches just north of the pond. Walk up to a tree and press Space to search it.',
    prize: { bits: 'leaf', n: 3 },
  },
  {
    id: 'shell-stones', kind: 'stones', multipleOf: 3, title: 'Stepping stones',
    says: 'Cross the rock pool. Count in 3s and only step on numbers in the 3 times table, or splash! Step up, down, left or right.',
    hint: 'Start on the 6, then look for 9, 12, 15, 18…',
    grid: ['8 14 20 10 25 4', '6 9 11 7 16 22', '13 12 15 18 2 26', '5 16 23 21 24 27'],
    prize: { bits: 'water', n: 3 },
  },
  {
    id: 'fire-lanterns', kind: 'lanterns', numbers: [12, 3, 18, 9, 6, 15], title: 'The lantern door',
    says: 'Light the lanterns counting up in threes, smallest first. Get one wrong and they all go out.',
    hint: 'Start with 3. The next one is 3 more.',
    prize: { bits: 'fire', n: 3 },
  },
  {
    id: 'snow-slide', kind: 'slide', title: 'The ice slide',
    says: 'Ice is slippery! You slide until you bump into a rock. Get to Ranger Fern’s chest.',
    hint: 'Slide down, then right, then down again.',
    grid: ['S....#.', '.#.....', '......#', '#..#...', '.....C.', '..#....', '....#..'],
    prize: { bits: 'ice', n: 3 },
  },
  {
    id: 'cave-count', kind: 'lock', code: '472', title: 'The stone door',
    says: 'The stone door has a 3-number lock. The glowworms show the code.',
    clues: ['The first group of glowworms: ✦✦✦✦', 'The second group: ✦✦✦✦✦✦✦', 'The last group: ✦✦'],
    hint: 'Count each group of glowworms. That count is one number of the code.',
    prize: { bits: 'spark', n: 3 },
  },
  {
    id: 'wharf-crates', kind: 'crates', title: 'The busy wharf',
    says: 'Push each crate onto a marked spot. You can push a crate, but you can’t pull it!',
    hint: 'Push the top crate down first. Use “Start again” if a crate gets stuck in a corner.',
    grid: ['#######', '#P....#', '#.B.x.#', '#..#..#', '#.xB..#', '#.....#', '#######'],
    prize: { bits: 'stone', n: 3 },
  },
  // The bonus areas: each puzzle there gives an egg of the area's kind.
  {
    id: 'lagoon-stones', kind: 'stones', multipleOf: 4, title: 'Lagoon stones',
    says: 'Cross the lagoon. Count in 4s and only step on numbers in the 4 times table! Step up, down, left or right.',
    hint: 'Start on the 8, then 12, 16, 20…',
    grid: ['5 9 14 6 10 15', '8 12 16 20 18 7', '11 22 13 24 21 30', '3 26 17 28 32 36'],
    prize: { egg: 'water' },
  },
  {
    id: 'aurora-slide', kind: 'slide', title: 'The frozen lake',
    says: 'Slide across the frozen lake to the chest under the lights.',
    hint: 'Slide down first.',
    grid: ['S#......', '....#.#.', '#.#...##', '##.#..#.', '......#.', '...#.C.#', '#.......', '..#.....'],
    prize: { egg: 'cold' },
  },
  {
    id: 'steam-lock', kind: 'lock', code: '473', title: 'The hot spring chest',
    says: 'A chest with a 3-number lock sits by the hot springs. The signs give clues.',
    clues: ['My first number is half of 8.', 'My second number is 3 more than my first.', 'My last number is how many sides a triangle has.'],
    hint: 'Half of 8 is 4. So the second number is 4 + 3.',
    prize: { egg: 'warm' },
  },
];

const BY_ID = new Map(PUZZLES.map((p) => [p.id, p]));
export const puzzleById = (id: string) => BY_ID.get(id);

// ---- Stepping stones ----

export interface StonesState {
  /** Where you stand: null on the start bank. */
  at: [number, number] | null;
  tries: number;
  done: boolean;
  /** Just fell in (the screen shows a splash). */
  splash?: boolean;
  /** The last tap did nothing because that stone is not next to you (the screen says why). */
  miss?: 'start' | 'far';
}

export const stonesGrid = (p: Extract<Puzzle, { kind: 'stones' }>) => p.grid.map((r) => r.split(' ').map(Number));

/**
 * Step onto the stone at row `r`, column `c`, or off the far side with c = the width. You step up, down,
 * left or right; a tap on a stone that is not next to you does nothing but says why (`miss`).
 */
export function stepStone(p: Extract<Puzzle, { kind: 'stones' }>, s: StonesState, r: number, c: number): StonesState {
  if (s.done) return s;
  const grid = stonesGrid(p);
  const width = grid[0].length;
  if (r < 0 || r >= grid.length || c < 0 || c > width) return { ...s, splash: false, miss: undefined };
  const next = s.at ? Math.abs(s.at[0] - r) + Math.abs(s.at[1] - c) === 1 : c === 0;
  if (!next) return { ...s, splash: false, miss: s.at ? 'far' : 'start' };
  if (c === width) return { ...s, at: null, done: true, splash: false, miss: undefined };
  if (grid[r][c] % p.multipleOf !== 0) return { at: null, tries: s.tries + 1, done: false, splash: true };
  return { ...s, at: [r, c], splash: false, miss: undefined };
}

// ---- Ice slide ----

export interface SlideState {
  at: [number, number];
  moves: number;
  tries: number;
  done: boolean;
}

export const slideStart = (p: Extract<Puzzle, { kind: 'slide' }>): SlideState => {
  const r = p.grid.findIndex((row) => row.includes('S'));
  return { at: [r, p.grid[r].indexOf('S')], moves: 0, tries: 0, done: false };
};

const STEP = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] } as const;
export type SlideDir = keyof typeof STEP;

/** Slide one way until a rock or the edge stops you, or you reach the chest. */
export function slide(p: Extract<Puzzle, { kind: 'slide' }>, s: SlideState, dir: SlideDir): SlideState {
  if (s.done) return s;
  let [r, c] = s.at;
  const [dr, dc] = STEP[dir];
  for (;;) {
    const nr = r + dr;
    const nc = c + dc;
    const t = p.grid[nr]?.[nc];
    if (t === undefined || t === '#') break;
    [r, c] = [nr, nc];
    if (t === 'C') return { ...s, at: [r, c], moves: s.moves + 1, done: true };
  }
  return { ...s, at: [r, c], moves: s.moves + 1 };
}

// ---- Lanterns ----

export interface LanternState {
  lit: number[];
  tries: number;
  done: boolean;
}

/** Light lantern `i`: the next one in order stays lit, a wrong one puts them all out. */
export function light(p: Extract<Puzzle, { kind: 'lanterns' }>, s: LanternState, i: number): LanternState {
  if (s.done || s.lit.includes(i)) return s;
  const order = [...p.numbers].sort((a, b) => a - b);
  if (p.numbers[i] !== order[s.lit.length]) return { lit: [], tries: s.tries + 1, done: false };
  const lit = [...s.lit, i];
  return { lit, tries: s.tries, done: lit.length === order.length };
}

// ---- Number lock ----

export interface LockState {
  digits: number[];
  tries: number;
  done: boolean;
}

export const lockStart = (p: Extract<Puzzle, { kind: 'lock' }>): LockState => ({ digits: p.code.split('').map(() => 0), tries: 0, done: false });

export const turnDial = (s: LockState, i: number, by: 1 | -1): LockState => ({ ...s, digits: s.digits.map((d, j) => (j === i ? (d + by + 10) % 10 : d)) });

export function tryLock(p: Extract<Puzzle, { kind: 'lock' }>, s: LockState): LockState {
  if (s.done) return s;
  return s.digits.join('') === p.code ? { ...s, done: true } : { ...s, tries: s.tries + 1 };
}

// ---- Crates ----

export interface CratesState {
  you: [number, number];
  crates: [number, number][];
  moves: number;
  tries: number;
  done: boolean;
}

const cellsOf = (grid: string[], chars: string) => grid.flatMap((row, r) => [...row].flatMap((ch, c): [number, number][] => (chars.includes(ch) ? [[r, c]] : [])));

export const cratesStart = (p: Extract<Puzzle, { kind: 'crates' }>, tries = 0): CratesState => ({
  you: cellsOf(p.grid, 'P')[0],
  crates: cellsOf(p.grid, 'BX'),
  moves: 0,
  tries,
  done: false,
});

export const crateSpots = (p: Extract<Puzzle, { kind: 'crates' }>) => cellsOf(p.grid, 'xX');

/** Walk one way, pushing a crate if there is one in front and room behind it. */
export function push(p: Extract<Puzzle, { kind: 'crates' }>, s: CratesState, dir: SlideDir): CratesState {
  if (s.done) return s;
  const [dr, dc] = STEP[dir];
  const wall = (r: number, c: number) => (p.grid[r]?.[c] ?? '#') === '#';
  const crateAt = (r: number, c: number) => s.crates.findIndex(([cr, cc]) => cr === r && cc === c);
  const [r, c] = [s.you[0] + dr, s.you[1] + dc];
  if (wall(r, c)) return s;
  const k = crateAt(r, c);
  let crates = s.crates;
  if (k >= 0) {
    const [br, bc] = [r + dr, c + dc];
    if (wall(br, bc) || crateAt(br, bc) >= 0) return s;
    crates = crates.map((x, j): [number, number] => (j === k ? [br, bc] : x));
  }
  const spots = crateSpots(p);
  const done = crates.every(([cr, cc]) => spots.some(([sr, sc]) => sr === cr && sc === cc));
  return { ...s, you: [r, c], crates, moves: s.moves + 1, done };
}

// ---- Seed pods (found one at a time on the map) ----

/** The flag a found pod sets: "pod:<puzzle>:<thing id>". */
export const podFlag = (puzzle: string, thingId: string) => `pod:${puzzle}:${thingId}`;
export const podsFound = (flags: readonly string[], puzzle: string) => flags.filter((f) => f.startsWith(`pod:${puzzle}:`)).length;
