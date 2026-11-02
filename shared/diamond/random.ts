/**
 * Seeded random numbers for Diamond Drop: where things are buried, which catches slip and where dropped gems land.
 * 32-bit integer maths only (mulberry32 with `Math.imul`), so the same seed gives exactly the same numbers in every
 * browser and on the server. Never `Math.random`.
 */

export interface Random {
  /** A whole number from 0 to n − 1 (n ≥ 1). */
  int(n: number): number;
  /** A number from 0 (included) to 1 (not included), made exactly from a whole number. */
  fraction(): number;
  /** A number from lo to hi. */
  between(lo: number, hi: number): number;
}

export function makeRandom(seed: number): Random {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  const fraction = () => next() / 4294967296;
  return {
    int: (n) => next() % n,
    fraction,
    between: (lo, hi) => lo + (hi - lo) * fraction(),
  };
}

/** A new seed made from a seed and a number (a catch, a slot, a try), mixed so neighbours look unrelated. */
export function mixSeed(seed: number, n: number): number {
  let h = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Streams of the level seed, kept apart so a new kind of random draw never shifts another. */
export const STREAM = { field: 0, catch: 1000, landing: 5000 } as const;
