/**
 * Things every bot game shares, whatever the game: the bot levels, how a game can end,
 * and the rules about which games will earn points in Stage 7.
 */
export type BotLevel = 'very-easy' | 'easy' | 'medium';
export const BOT_LEVEL_IDS: readonly BotLevel[] = ['very-easy', 'easy', 'medium'];

/** What the student says happened. Only "resigned" and "abandoned" are taken on trust. */
export type ClaimedEnding = 'finished' | 'resigned' | 'abandoned';

export type Outcome = 'won' | 'lost' | 'drawn';

/** Games where the student made fewer moves than this earn nothing (Stage 7 points). */
export const MIN_MOVES_TO_COUNT = 10;
/** No real game is anywhere near this long; it stops junk being sent to the server. */
export const MAX_PLIES = 1000;

export function isClaimedEnding(value: unknown): value is ClaimedEnding {
  return value === 'finished' || value === 'resigned' || value === 'abandoned';
}

export function isBotLevelId(value: unknown): value is BotLevel {
  return BOT_LEVEL_IDS.includes(value as BotLevel);
}

/** A list of moves that came from outside: an array of short strings, not too long. */
export function isMoveList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_PLIES &&
    value.every((m) => typeof m === 'string' && m.length <= 64)
  );
}
