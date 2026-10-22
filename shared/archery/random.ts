/**
 * Seeded random numbers for Archery Challenge: land, wind and where the archers stand.
 * 32-bit integer maths only (mulberry32 with `Math.imul`), so the same seed gives exactly the same
 * numbers in every browser and on the server. Never `Math.random`.
 */

export interface Random {
  /** A whole number from 0 to 2³² − 1. */
  next(): number;
  /** A whole number from 0 to n − 1 (n ≥ 1). */
  int(n: number): number;
  /** A whole number from lo to hi, both included. */
  range(lo: number, hi: number): number;
  /** A number from 0 (included) to 1 (not included), made exactly from a whole number. */
  fraction(): number;
  /** The current state, to carry on later with `makeRandom(state)`. */
  state(): number;
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
  return {
    next,
    int: (n) => next() % n,
    range: (lo, hi) => lo + (next() % (hi - lo + 1)),
    fraction: () => next() / 4294967296,
    state: () => s,
  };
}

/** A new seed made from a seed and a number (a round, a retry), mixed so neighbours look unrelated. */
export function mixSeed(seed: number, n: number): number {
  let h = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
