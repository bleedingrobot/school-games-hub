/**
 * The ten big stones on the far bank at Weka's Stepping Stones: one stone changes on each NZ day a child finishes the
 * challenge, bronze for days 1 to 10, silver for 11 to 20 and gold for 21 to 30 (docs/WEKA-PLAN.md section 1). Days are
 * counted, not dates, so a missed day loses nothing. Everything here comes from the count of finished days alone. The
 * rules are the game kit's day arc (shared/kit/dayArc.ts), in Weka's words.
 */
import { arcAfter, daysPerReward, finishDay } from '../kit/dayArc';

export { nzDate } from '../kit/dayArc';

export const STONES = 10;
export const METALS = ['grey', 'bronze', 'silver', 'gold'] as const;
export type Metal = (typeof METALS)[number];
/** Ten stones, three changes each: thirty finished days to a Golden Picnic Basket. */
export const DAYS_PER_BASKET = daysPerReward(STONES);

/**
 * Who crosses the stream, in order: Weka first, then a new New Zealand bird friend at a fresh stream after each Golden
 * Picnic Basket. Birds that walk more than they fly, so stepping stones make sense. The friends after Weka are painted
 * later.
 */
export const FRIENDS = ['weka', 'kiwi', 'takahe', 'kakapo', 'pukeko', 'kea'] as const;
export type Friend = (typeof FRIENDS)[number];

export interface Stream {
  /** Golden Picnic Baskets won so far. */
  baskets: number;
  friend: Friend;
  /** Finished days at this stream, 0 to 29. */
  day: number;
  /** Each stone's colour, first stone first. */
  stones: Metal[];
  /** The kind of day the next challenge is: it sets the light (morning, sparkling silver, golden evening) and the goes. */
  today: Exclude<Metal, 'grey'>;
}

export function streamAfter(daysDone: number): Stream {
  const { rewards, friend, day, row, today } = arcAfter<'grey', Friend>(daysDone, { items: STONES, base: 'grey', friends: FRIENDS });
  return { baskets: rewards, friend, day, stones: row, today };
}

export interface FinishResult {
  daysDone: number;
  /** The NZ day the last stone changed. */
  lastStoneDay: string | null;
  /** Which stone changed (0 is the first), or null when a stone already changed today. */
  stoneChanged: number | null;
  /** True when this finish turned the last stone gold: a Golden Picnic Basket. */
  goldenBasket: boolean;
}

/** A finished challenge: one stone changes on the first finish of each NZ day; playing again the same day is just for fun. */
export function finishChallenge(daysDone: number, lastStoneDay: string | null, today: string): FinishResult {
  const { daysDone: done, lastDay, changed, reward } = finishDay(daysDone, lastStoneDay, today, STONES);
  return { daysDone: done, lastStoneDay: lastDay, stoneChanged: changed, goldenBasket: reward };
}
