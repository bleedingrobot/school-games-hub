/**
 * Scoring: flips (a pair of flips is one), time in whole seconds (passed in by the caller, the
 * engine has no clock) and stars. A perfect game clears every pair on its first try, which takes
 * one flip per pair; stars are how close you got to that.
 */
import type { GameState } from './engine';

/** The star thresholds, in one place. Gold: flips within goldWithin x the minimum. Silver: within silverWithin x. Finishing is bronze. */
export const STAR_CONFIG = { goldWithin: 1.5, silverWithin: 2.5 };

export type Stars = 1 | 2 | 3;

export interface Score {
  flips: number;
  seconds: number;
  minFlips: number;
  /** 3 gold, 2 silver, 1 bronze. */
  stars: Stars;
}

/** The fewest flips that can clear this deck: one per pair. */
export const minFlips = (state: GameState): number => state.deck.pairCount;

export function starsFor(flips: number, min: number, config = STAR_CONFIG): Stars {
  if (flips <= min * config.goldWithin) return 3;
  if (flips <= min * config.silverWithin) return 2;
  return 1;
}

/** The score of a finished game, or null if it isn't finished. `seconds` is rounded down to a whole number. */
export function scoreGame(state: GameState, seconds: number): Score | null {
  if (!state.finished) return null;
  const min = minFlips(state);
  return { flips: state.flips, seconds: Math.max(0, Math.floor(seconds)), minFlips: min, stars: starsFor(state.flips, min) };
}
