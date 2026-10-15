/**
 * Shuffling for 101. The rules engine never makes up its own random numbers: every
 * shuffle comes from a `Dice` passed in from outside. Bot games use a seeded generator
 * (so the server can replay them exactly). Classmates games use `secureDice`, the
 * computer's cryptographic randomness, on the server only. Tests use a fixed pack.
 *
 * The seeded generator and Fisher–Yates shuffle are the space game's (shared/space/random.ts).
 */
import { type Dice } from '../space/random';

export { randomFromSeed, seededDice, shuffled, type Dice } from '../space/random';

/**
 * Dice from secure randomness (crypto.getRandomValues, in Deno, browsers and Node).
 * Uses "rejection sampling", so every side is exactly as likely as every other.
 */
export const secureDice: Dice = (sides) => {
  if (!Number.isInteger(sides) || sides < 1 || sides > 2 ** 32) throw new Error('secureDice: bad number of sides');
  const limit = 2 ** 32 - (2 ** 32 % sides);
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < limit) return 1 + (buffer[0] % sides);
  }
};
