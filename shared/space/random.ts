/**
 * Dice for Wormholes & Black Holes. The rules engine never makes up its own random
 * numbers: every roll, item draw and mystery card comes from a `Dice` passed in from
 * outside. Bot games use a seeded generator (so the server can replay them exactly),
 * the server uses secure randomness, and tests use a fixed list.
 */

/** Returns a whole number from 1 to `sides`. */
export type Dice = (sides: number) => number;

/** Turns any text into four 32-bit numbers (cyrb128), to seed the generator below. */
function hashSeed(text: string): [number, number, number, number] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** A repeatable random number generator (sfc32): the same seed always gives the same numbers. */
export function randomFromSeed(seed: string): () => number {
  let [a, b, c, d] = hashSeed(seed);
  return () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** Dice from a 0–1 random number source. */
export function diceFrom(random: () => number): Dice {
  return (sides) => 1 + Math.floor(random() * sides);
}

/** Dice from a seed, for bot games and simulations. */
export function seededDice(seed: string): Dice {
  return diceFrom(randomFromSeed(seed));
}

/** Dice that give exactly these numbers in order, for tests. Runs out loudly. */
export function fixedDice(values: number[]): Dice {
  let i = 0;
  return (sides) => {
    if (i >= values.length) throw new Error(`fixedDice ran out after ${values.length} numbers`);
    const value = values[i++];
    if (!Number.isInteger(value) || value < 1 || value > sides) {
      throw new Error(`fixedDice: ${value} isn't a number from 1 to ${sides}`);
    }
    return value;
  };
}

/** Wraps dice so every number they give is written down (the server keeps this list). */
export function recordingDice(dice: Dice): { dice: Dice; used: number[] } {
  const used: number[] = [];
  return {
    used,
    dice: (sides) => {
      const value = dice(sides);
      used.push(value);
      return value;
    },
  };
}

/** Picks one entry, with each entry's chance in proportion to its weight. */
export function pickWeighted<T>(dice: Dice, entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let n = dice(total);
  for (const [value, weight] of entries) {
    n -= weight;
    if (n <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

/** A shuffled copy (Fisher–Yates), using the dice. */
export function shuffled<T>(dice: Dice, list: readonly T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = dice(i + 1) - 1;
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
