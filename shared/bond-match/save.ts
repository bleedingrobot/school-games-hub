/**
 * What the browser will send the server when a game ends, and a replay that checks it. The deck
 * comes from the seed and the engine is pure, so the server rebuilds the game, plays the flips and
 * gets the same stars the player saw. (The server function that uses this is supabase/functions/bond-match.)
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

// ---------------------------------------------------------------------------
// What the website sends the bond-match server function
// ---------------------------------------------------------------------------

/**
 * The numbers the server and the website share, in one place.
 * - minSecondsPerCardFlip: a game faster than this is not a human (one flip of a card, not of a pair).
 * - pointsPerGame: small taking-part points for a finished game, whatever the stars. Grinding easy decks earns little.
 * - pointsGamesPerDay: only this many finished games a day earn points. They also share the hub's daily cap with the bot games.
 * - maxGamesPerDay: more finished games than this in a day are refused (a stuck loop, not a child).
 */
export const BOND_MATCH_SAVE = {
  minSecondsPerCardFlip: 0.5,
  pointsPerGame: 2,
  pointsGamesPerDay: 10,
  maxGamesPerDay: 100,
} as const;

/**
 * Who played: one student alone ('solo'), two on one Chromebook ('pass') or one against the computer ('bot'). All three
 * are replayed and earn the same small points; only solo games change bests and stars, because a shared board's flips
 * aren't one person's memory.
 */
export type GameMode = 'solo' | 'pass' | 'bot';
export const GAME_MODES: readonly GameMode[] = ['solo', 'pass', 'bot'];

/** One finished game to save: the game itself plus the id of this run, so a save sent twice is kept once. */
export interface BondMatchItem extends BondMatchSave {
  /** Made when the game starts (a UUID). */
  runId: string;
  /** Left out by queues saved before two-player games existed: those were all solo. */
  mode?: GameMode;
}

/** The server's answer for one game. */
export type SaveResult =
  | {
      status: 'saved' | 'duplicate';
      points: number | null;
      stars: 1 | 2 | 3;
      /** The student's solo best for this bond and size; null after a two-player or computer game when they have none yet. */
      best: { flips: number; seconds: number; stars: number } | null;
    }
  | { status: 'invalid'; problem: string };

export interface SaveResponse {
  /** How many items from the front of the list are dealt with. */
  handled: number;
  results: SaveResult[];
}

/** The most games in one request. */
export const MAX_ITEMS = 20;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The fewest seconds a game with this many card flips can honestly take. */
export const minSecondsFor = (cardFlips: number): number => cardFlips * BOND_MATCH_SAVE.minSecondsPerCardFlip;

export type Checked = { ok: true; item: BondMatchItem & { mode: GameMode }; score: Score } | { ok: false; problem: string };

/**
 * Checks one item from the website: the right shape, then the replay (the server's own stars, flips
 * and deck, never the browser's), then that the time is possible for a human.
 */
export function checkItem(raw: unknown): Checked {
  if (typeof raw !== 'object' || raw === null) return { ok: false, problem: 'not an object' };
  const r = raw as Record<string, unknown>;
  if (typeof r.runId !== 'string' || !UUID.test(r.runId)) return { ok: false, problem: 'bad run id' };
  if (typeof r.bondId !== 'string' || typeof r.size !== 'string') return { ok: false, problem: 'bad bond or size' };
  if (!Number.isInteger(r.seed) || !Number.isInteger(r.seconds)) return { ok: false, problem: 'bad numbers' };
  if (!Array.isArray(r.flips) || r.flips.length > 400 || !r.flips.every((n) => Number.isInteger(n))) return { ok: false, problem: 'bad flips' };
  if (r.mode !== undefined && !GAME_MODES.includes(r.mode as GameMode)) return { ok: false, problem: 'bad mode' };
  const item: BondMatchItem & { mode: GameMode } = {
    runId: r.runId,
    mode: (r.mode as GameMode | undefined) ?? 'solo',
    seed: r.seed as number,
    bondId: r.bondId,
    size: r.size as BoardSize,
    flips: r.flips as number[],
    seconds: r.seconds as number,
  };
  const played = replay(item);
  if (!played.ok) return { ok: false, problem: played.error };
  if (item.seconds < minSecondsFor(item.flips.length)) return { ok: false, problem: 'too fast' };
  return { ok: true, item, score: played.score };
}
