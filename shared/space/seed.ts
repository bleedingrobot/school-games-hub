/**
 * The seeds a server hands out for a game played against bots (shared/space/save.ts explains how they are used).
 * They live apart from the rest of the space game's saving so that Wormholes & Black Holes' game rules and maths checking
 * aren't pulled into every other game's server function just to make a seed.
 */

/** How long a seed can be used for. A real game takes minutes; a forgotten tab, hours. */
export const SEED_LIFETIME_SECONDS = 12 * 60 * 60;

const SEED_PATTERN = /^s1-(\d{10})-[0-9a-f]{24}$/;

/** A new seed: when it was made and 12 random bytes. */
export function makeSeed(nowSeconds: number, randomHex: string): string {
  return `s1-${String(Math.floor(nowSeconds)).padStart(10, '0')}-${randomHex}`;
}

/** What the server signs: the seed and who it was given to, so a seed can't be shared. */
export function stampText(player: string, seed: string): string {
  return `space-seed:v1:${player}:${seed}`;
}

/** Null if the seed is well made and still fresh, else what's wrong. */
export function seedProblem(seed: string, nowSeconds: number): string | null {
  const match = SEED_PATTERN.exec(seed);
  if (!match) return 'not a server seed';
  const age = nowSeconds - Number(match[1]);
  if (age < -300) return 'seed from the future';
  if (age > SEED_LIFETIME_SECONDS) return 'seed too old';
  return null;
}
