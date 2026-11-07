/**
 * The ten bundles in Lizard's den at Lizard's Bundles: one bundle changes on each NZ day a child finishes the challenge,
 * bronze for days 1 to 10, silver for 11 to 20 and gold for 21 to 30 (docs/LIZARD-PLAN.md). Days are counted, not dates,
 * so a missed day loses nothing. Everything here comes from the count of finished days alone. The rules are the game
 * kit's day arc (shared/kit/dayArc.ts), in Lizard's words.
 */
import { arcAfter, daysPerReward, finishDay } from '../kit/dayArc';
import { DEN_BUNDLES } from './config';

export { nzDate } from '../kit/dayArc';

export const BUNDLES = DEN_BUNDLES;
export const METALS = ['twine', 'bronze', 'silver', 'gold'] as const;
export type Metal = (typeof METALS)[number];
/** Ten bundles, three changes each: thirty finished days to a Golden Raft. */
export const DAYS_PER_RAFT = daysPerReward(BUNDLES);

/** Whose den it is, in order: Lizard first, then a new friend's den after each Golden Raft. */
export const FRIENDS = ['lizard', 'kiwi', 'fantail', 'bellbird', 'kea'] as const;
export type Friend = (typeof FRIENDS)[number];

export const FRIEND_NAMES: Record<Friend, string> = { lizard: 'Lizard', kiwi: 'Kiwi', fantail: 'Fantail', bellbird: 'Bellbird', kea: 'Kea' };

export interface Den {
  /** Golden Rafts won so far. */
  prizes: number;
  friend: Friend;
  /** Finished days on this den, 0 to 29. */
  day: number;
  /** Each bundle's colour, first bundle first. */
  bundles: Metal[];
  /** The kind of day the next challenge is: it sets the light (dawn, noon, golden evening). */
  today: Exclude<Metal, 'twine'>;
}

export function denAfter(daysDone: number): Den {
  const { rewards, friend, day, row, today } = arcAfter<'twine', Friend>(daysDone, { items: BUNDLES, base: 'twine', friends: FRIENDS });
  return { prizes: rewards, friend, day, bundles: row, today };
}

export interface FinishResult {
  daysDone: number;
  /** The NZ day the last bundle changed. */
  lastDay: string | null;
  /** Which bundle changed (0 is the first), or null when one already changed today. */
  bundleChanged: number | null;
  /** True when this finish turned the last bundle gold: a Golden Raft. */
  goldenRaft: boolean;
}

/** A finished challenge: one bundle changes on the first finish of each NZ day; playing again the same day is just for fun. */
export function finishChallenge(daysDone: number, lastDay: string | null, today: string): FinishResult {
  const { daysDone: done, lastDay: last, changed, reward } = finishDay(daysDone, lastDay, today, BUNDLES);
  return { daysDone: done, lastDay: last, bundleChanged: changed, goldenRaft: reward };
}
