/**
 * A small random number generator whose whole state is one number, so a half-finished fight
 * can be saved as plain JSON and a fight can be replayed from its seed.
 */
export interface HasRng {
  rng: number;
}

/** A number from 0 up to (not including) 1. */
export function nextFloat(holder: HasRng): number {
  holder.rng = (holder.rng + 0x6d2b79f5) | 0;
  let t = holder.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A whole number from 0 up to (not including) n. */
export function roll(holder: HasRng, n: number): number {
  return Math.floor(nextFloat(holder) * n);
}
