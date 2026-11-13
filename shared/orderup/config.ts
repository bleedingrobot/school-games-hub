/** Every tuning number for Order Up! in one place (docs/ORDERUP-PLAN.md). */
export const ORDERUP = {
  /** Bags in a set. */
  setSize: 8,
  /** A set is passed with this many bags solved with no more than `passWrongPicks` wrong picks each. */
  passBags: 7,
  passWrongPicks: 1,
  /** A hard set (help steps back up one): this many good bags or fewer. */
  hardSetBags: 4,
  /** Short (fewer-step) bags in a set, on full help and otherwise. */
  shortBags: { full: 5, normal: 2 },
  /** Biggest number any step may make, per level. */
  maxValue: [0, 100, 100, 100, 150, 150, 100, 100],
  /** Biggest factor in a × step, and biggest divisor and answer in a ÷ step. */
  maxFactor: 12,
  /** Biggest base for a square and for a cube. */
  maxSquareBase: 12,
  maxCubeBase: 5,
  /** Tries before a problem maker gives up on a pattern (it then tries the next one). */
  tries: 400,
  levels: 7,
} as const;
