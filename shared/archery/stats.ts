/**
 * Archery Challenge's achievement counts (docs/ARCHERY-PLAN.md, section 8, Stage 7). The server function works out what
 * a finished fight or speed round adds (from the fight it replayed or the answers it marked, never from the browser)
 * and saves it in `archery_players.stats` through `archery_note()`, once per fight or round. The database's
 * `archery_counts()` turns the saved numbers into the achievements' measures. The achievements themselves are in the
 * Stage 7 migration (20261022000200_archery_hub.sql): change both together.
 */
import type { BotLevel } from './bot';
import type { ItemId, WorldId } from './types';

/** What's kept per pupil (counts only; a New Season deletes them with the rest of the Armory). */
export type StatKey =
  | 'win_forest' | 'win_desert' | 'win_snow' | 'win_city'
  /** Fights won with no arrow but the Plain Arrow (helpers are fine). */
  | 'plain_wins'
  /** Bot fights won against Hawk (Hard). */
  | 'hawk_wins'
  /** Speed rounds with every question right in time. */
  | 'perfect_rounds'
  /** Classmate fights won, and classmate fights played to the finish. */
  | 'duel_wins' | 'duels';

export type StatsAdd = Partial<Record<StatKey, number>>;

export const STAT_KEYS: readonly StatKey[] = [
  'win_forest', 'win_desert', 'win_snow', 'win_city', 'plain_wins', 'hawk_wins', 'perfect_rounds', 'duel_wins', 'duels',
];

const HELPERS: readonly ItemId[] = ['apple', 'umbrella'];

/** Did this player shoot nothing but Plain Arrows? (A Plain Arrow is never counted as used: it never runs out.) */
export const onlyPlain = (used: Partial<Record<ItemId, number>>) =>
  Object.entries(used).every(([id, n]) => HELPERS.includes(id as ItemId) || !n);

/** What a finished bot fight adds: a win in its world, a Plain-only win, a win against Hawk. Nothing if it was lost. */
export function botFightStats(world: WorldId, opponent: BotLevel, won: boolean, used: Partial<Record<ItemId, number>>): StatsAdd {
  if (!won) return {};
  return { [`win_${world}`]: 1, ...(onlyPlain(used) ? { plain_wins: 1 } : {}), ...(opponent === 'hard' ? { hawk_wins: 1 } : {}) };
}

/** What a classmate fight played to the finish adds for one player: one more fight, and if they won it, a win too. */
export function duelStats(world: WorldId, won: boolean, used: Partial<Record<ItemId, number>>): StatsAdd {
  return { duels: 1, ...(won ? { duel_wins: 1, [`win_${world}`]: 1, ...(onlyPlain(used) ? { plain_wins: 1 } : {}) } : {}) };
}

/** A speed round is perfect when every one of its questions earned its coins (right, and in time). */
export const perfectRound = (questions: number, earned: readonly number[]) =>
  questions > 0 && earned.length === questions && earned.every((c) => c > 0);
