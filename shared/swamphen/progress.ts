/**
 * The ten rows of the Swamp Hen's reed garden: one row changes on each NZ day a child finishes the challenge, bronze for days
 * 1 to 10, silver for 11 to 20 and gold for 21 to 30 (docs/SWAMPHEN-PLAN.md). Days are counted, not dates, so a missed day
 * loses nothing. Everything here comes from the count of finished days alone. The rules are the game kit's day arc
 * (shared/kit/dayArc.ts), in the Swamp Hen's words.
 */
import { arcAfter, daysPerReward, finishDay } from '../kit/dayArc';
import { REED_ROWS } from './config';

export { nzDate } from '../kit/dayArc';

export const ROWS = REED_ROWS;
export const METALS = ['mud', 'bronze', 'silver', 'gold'] as const;
export type Metal = (typeof METALS)[number];
/** Ten rows, three changes each: thirty finished days to a Golden Reed Garden. */
export const DAYS_PER_GARDEN = daysPerReward(ROWS);

/** Whose garden it is, in order: Swamp Hen first, then a new friend's garden after each Golden Reed Garden. */
export const FRIENDS = ['swamphen', 'pigeon', 'kea', 'weka', 'tui', 'heron'] as const;
export type Friend = (typeof FRIENDS)[number];

export const FRIEND_NAMES: Record<Friend, string> = { swamphen: 'Swamp Hen', pigeon: 'Pigeon', kea: 'Kea', weka: 'Weka', tui: 'Tui', heron: 'White Heron' };

export interface Garden {
  /** Golden Reed Gardens won so far. */
  prizes: number;
  friend: Friend;
  /** Finished days in this garden, 0 to 29. */
  day: number;
  /** Each row's colour, first row first. */
  rows: Metal[];
  /** The kind of day the next challenge is: it sets the light (dawn, noon, golden evening). */
  today: Exclude<Metal, 'mud'>;
}

export function gardenAfter(daysDone: number): Garden {
  const { rewards, friend, day, row, today } = arcAfter<'mud', Friend>(daysDone, { items: ROWS, base: 'mud', friends: FRIENDS });
  return { prizes: rewards, friend, day, rows: row, today };
}

export interface FinishResult {
  daysDone: number;
  /** The NZ day the last row changed. */
  lastDay: string | null;
  /** Which row changed (0 is the first), or null when one already changed today. */
  rowChanged: number | null;
  /** True when this finish turned the last row gold: a Golden Reed Garden. */
  goldenGarden: boolean;
}

/** A finished challenge: one row changes on the first finish of each NZ day; playing again the same day is just for fun. */
export function finishChallenge(daysDone: number, lastDay: string | null, today: string): FinishResult {
  const { daysDone: done, lastDay: last, changed, reward } = finishDay(daysDone, lastDay, today, ROWS);
  return { daysDone: done, lastDay: last, rowChanged: changed, goldenGarden: reward };
}
