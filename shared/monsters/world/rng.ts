/** A small seeded random source (mulberry32). Same seed, same numbers: tests can repeat a walk. */
export class Dice {
  seed: number;
  constructor(seed: number) {
    this.seed = seed >>> 0;
  }
  /** A number from 0 up to (not including) 1. */
  next(): number {
    this.seed = (this.seed + 0x6d2b79f5) >>> 0;
    let t = this.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** A whole number from `low` to `high`, both included. */
  int(low: number, high: number): number {
    return low + Math.floor(this.next() * (high - low + 1));
  }
}
