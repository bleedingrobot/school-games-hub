/**
 * What the browser will send the server when a game ends, and a replay that checks it. The deck
 * comes from the seed and the engine is pure, so the server rebuilds the game, plays the flips and
 * gets the same stars the player saw. (The server function and the database are a later stage.)
 */
import { findBondSet } from './bonds';
import { BOARD_SIZES, buildDeck, isSeed, type BoardSize } from './deck';
import { flip, newGame, type GameState } from './engine';
import { scoreGame, type Score } from './score';

export interface BondMatchSave {
  seed: number;
  bondId: string;
  size: BoardSize;
  /** Card indexes in the order they were flipped. */
  flips: number[];
  /** Seconds the game took, as a whole number. */
  seconds: number;
}

/** A game longer than a day is not a game. */
export const MAX_SECONDS = 86400;

export type ReplayResult = { ok: true; state: GameState; score: Score } | { ok: false; error: string };

export function replay(save: BondMatchSave): ReplayResult {
  if (!isSeed(save.seed)) return { ok: false, error: 'bad seed' };
  const set = findBondSet(save.bondId);
  if (!set) return { ok: false, error: 'unknown bond set' };
  if (!BOARD_SIZES.includes(save.size)) return { ok: false, error: 'unknown board size' };
  if (!Number.isInteger(save.seconds) || save.seconds < 0 || save.seconds > MAX_SECONDS) return { ok: false, error: 'bad time' };
  if (!Array.isArray(save.flips)) return { ok: false, error: 'bad flips' };

  let state = newGame(buildDeck(set, save.size, save.seed));
  for (const [n, index] of save.flips.entries()) {
    if (state.finished) return { ok: false, error: `flip ${n + 1} came after the game finished` };
    const result = flip(state, index);
    if (result.refused) return { ok: false, error: `flip ${n + 1} is illegal (${result.refused})` };
    state = result.state;
  }
  const score = scoreGame(state, save.seconds);
  if (!score) return { ok: false, error: 'the game did not finish' };
  return { ok: true, state, score };
}
