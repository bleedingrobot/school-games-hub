/**
 * The beanstalk's magic leaves: one leaf changes on each NZ day a child finishes the challenge, bronze for days 1 to 10,
 * silver for 11 to 20 and gold for 21 to 30 (docs/BEANSTALK-PLAN.md section 1). Days are counted, not dates, so a missed
 * day loses nothing. Everything here comes from the count of finished days alone.
 */

export const LEAVES_ON_STALK = 10;
export const METALS = ['green', 'bronze', 'silver', 'gold'] as const;
export type Metal = (typeof METALS)[number];
/** Ten leaves, three changes each: thirty finished days to a Golden Egg. */
export const DAYS_PER_EGG = LEAVES_ON_STALK * (METALS.length - 1);

/** Who is stuck on top of each beanstalk, in order: Kiwi first, then a new New Zealand friend after each egg (James, 4 Nov 2026). */
export const FRIENDS = ['kiwi', 'tui', 'kereru', 'weta', 'ruru', 'takahe'] as const;
export type Friend = (typeof FRIENDS)[number];

/** How much the leaves' ten-frame dots help: full on bronze days, small on silver days, none on gold days (James, 4 Nov 2026). */
export type Dots = 'full' | 'small' | 'none';

export interface Stalk {
  /** Golden Eggs won so far. */
  eggs: number;
  friend: Friend;
  /** Finished days on this beanstalk, 0 to 29. */
  day: number;
  /** Each leaf's colour, bottom leaf first. */
  leaves: Metal[];
  /** The dots for the next challenge. */
  dots: Dots;
}

const wholeCount = (n: number) => {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`Bad day count ${n}`);
  return n;
};

export function stalkAfter(daysDone: number): Stalk {
  const eggs = Math.floor(wholeCount(daysDone) / DAYS_PER_EGG);
  const day = daysDone % DAYS_PER_EGG;
  const round = Math.floor(day / LEAVES_ON_STALK);
  // Leaves change from the bottom up: in each round of ten days the lowest leaves change first.
  const leaves = Array.from({ length: LEAVES_ON_STALK }, (_, i) => METALS[round + (i < day % LEAVES_ON_STALK ? 1 : 0)]);
  return { eggs, friend: FRIENDS[eggs % FRIENDS.length], day, leaves, dots: (['full', 'small', 'none'] as const)[round] };
}

/** NZ calendar day ('2026-11-04') of a moment, by the server clock. The same as Lord's `nzDate`. */
export const nzDate = (now: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

export interface FinishResult {
  daysDone: number;
  /** The NZ day the last leaf changed. */
  lastLeafDay: string | null;
  /** Which leaf changed (0 is the bottom), or null when a leaf already changed today. */
  leafChanged: number | null;
  /** True when this finish turned the last leaf gold. */
  egg: boolean;
}

/** A finished challenge: one leaf changes on the first finish of each NZ day; playing again the same day is just for fun. */
export function finishChallenge(daysDone: number, lastLeafDay: string | null, today: string): FinishResult {
  if (lastLeafDay === today) return { daysDone: wholeCount(daysDone), lastLeafDay, leafChanged: null, egg: false };
  const next = wholeCount(daysDone) + 1;
  return { daysDone: next, lastLeafDay: today, leafChanged: daysDone % LEAVES_ON_STALK, egg: next % DAYS_PER_EGG === 0 };
}
