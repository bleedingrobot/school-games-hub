/**
 * Glyph Gates: every tuning number in one place (docs/GLYPH-PLAN.md). Pupils light the fraction tiles equal to the gold
 * stone, then pick the glyph their lit tiles make. 9 walls make a temple, 6 temples go deeper into the jungle.
 */

/** Tiles in a row and rows on a wall (a 4 × 4 grid, cells numbered 0 to 15 left to right, top to bottom). */
export const GRID = 4;
export const CELLS = GRID * GRID;

export const WALLS_PER_TEMPLE = 9;
/** Walls opened at the first go that pass a temple. */
export const PASS_FIRST_GO = 7;
/** Goes at one wall before it opens with the answer shown (no star). */
export const GOES_PER_WALL = 2;
/** Glyphs offered after "Light the runes": the right one and three made by mistakes. */
export const GLYPH_CHOICES = 4;
/** Every tile number stays at or under this, so it fits a tile. */
export const MAX_NUMBER = 99;
/** One wall in this many (walls 3, 6 and 9) reviews an earlier temple's kind, from temple 2 on. */
export const REVIEW_EVERY = 3;

/** Hub points for a finished temple go, and how many temple goes a day earn them (points stop at 40 a day anyway). */
export const POINTS_PASS = 5;
export const POINTS_TRY = 2;
export const POINT_GOES_A_DAY = 4;
/** Walls a pupil can't open faster than (ms from the wall showing to the go), so a sent go must be real. */
export const MIN_GO_MS = 600;

/** The kinds of wrong tile, each from a real misconception (plan, mistakes table). */
export type TrapKind = 'add-same' | 'top-only' | 'bottom-only' | 'same-bottom' | 'same-top' | 'near-miss' | 'diff-mult';

export interface TempleSpec {
  id: number;
  name: string;
  /** Bottom numbers of the gold stone (in simplest form, unless `unsimplified`). */
  bottoms: readonly number[];
  /** Multipliers for the right tiles (and for the gold stone itself in temple 4). */
  times: readonly [number, number];
  /** The gold stone is not in its simplest form (6/8): right tiles include the simplest one. */
  unsimplified?: boolean;
  traps: readonly TrapKind[];
  /** Right tiles on a wall (the glyph's size): from, to. */
  size: readonly [number, number];
}

/** In research order: doubling families, any multiplier, simplifying, big numbers, everything. */
export const TEMPLES: readonly TempleSpec[] = [
  { id: 1, name: 'Mossy Gate', bottoms: [2, 3, 4], times: [2, 4], traps: ['add-same', 'same-bottom', 'same-top'], size: [4, 4] },
  { id: 2, name: 'Snake Hall', bottoms: [5, 6], times: [2, 6], traps: ['add-same', 'top-only', 'bottom-only', 'same-bottom'], size: [4, 5] },
  { id: 3, name: 'Waterfall Shrine', bottoms: [8, 10], times: [2, 9], traps: ['add-same', 'bottom-only', 'near-miss'], size: [4, 5] },
  { id: 4, name: 'Root Tunnel', bottoms: [3, 4, 5, 6], times: [2, 5], unsimplified: true, traps: ['add-same', 'diff-mult', 'near-miss'], size: [4, 5] },
  { id: 5, name: 'Bat Cave', bottoms: [7, 9, 12], times: [2, 8], traps: ['near-miss', 'diff-mult', 'add-same'], size: [5, 6] },
  { id: 6, name: 'Golden Sanctum', bottoms: [3, 4, 5, 6, 8, 9, 10, 12], times: [2, 9], traps: ['add-same', 'top-only', 'bottom-only', 'near-miss', 'diff-mult', 'same-bottom'], size: [5, 6] },
];

export const TOP_TEMPLE = TEMPLES.length;
export const templeById = (id: number): TempleSpec | undefined => TEMPLES.find((t) => t.id === id);

/**
 * Help (docs/GLYPH-PLAN.md, learning design): 0 none until a wrong go, 1 the fraction bar under the gold stone, 2 the bar
 * and the lens, 3 the bar, the lens and the ×-arrows. After a wrong go the lens and arrows are always there for that wall.
 * It fades after good temple goes and comes back after a hard one (shared/kit/help.ts `fadeAfter`).
 */
export const HELP_TOP = 3;
export const HELP_START = 2;
export const HELP_RULES = { good: 8, hard: 5, goodToFade: 2, topLevel: HELP_TOP } as const;
/** A wall counts as right for the maths records only if opened at the first go without the lens or the arrows. */
export const RIGHT_MAX_HELP = 1;

/** The maths record every first go counts under (the Skill map's equivalent fractions row). */
export const FACT_KEY = 'equiv:same-as';
