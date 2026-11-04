/**
 * The ten big stones on the far bank at Weka's Stepping Stones: one stone changes on each NZ day a child finishes the
 * challenge, bronze for days 1 to 10, silver for 11 to 20 and gold for 21 to 30 (docs/WEKA-PLAN.md section 1). Days are
 * counted, not dates, so a missed day loses nothing. Everything here comes from the count of finished days alone. Copied
 * from shared/korora/progress.ts (docs/EARLY-GAMES-PLAN.md section 7).
 */

export const STONES = 10;
export const METALS = ['grey', 'bronze', 'silver', 'gold'] as const;
export type Metal = (typeof METALS)[number];
/** Ten stones, three changes each: thirty finished days to a Golden Picnic Basket. */
export const DAYS_PER_BASKET = STONES * (METALS.length - 1);

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

const wholeCount = (n: number) => {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`Bad day count ${n}`);
  return n;
};

export function streamAfter(daysDone: number): Stream {
  const baskets = Math.floor(wholeCount(daysDone) / DAYS_PER_BASKET);
  const day = daysDone % DAYS_PER_BASKET;
  const round = Math.floor(day / STONES);
  return {
    baskets,
    friend: FRIENDS[baskets % FRIENDS.length],
    day,
    stones: Array.from({ length: STONES }, (_, i) => METALS[round + (i < day % STONES ? 1 : 0)]),
    today: (['bronze', 'silver', 'gold'] as const)[round],
  };
}

/** NZ calendar day ('2026-11-04') of a moment, by the server clock. The same as Lord's `nzDate`. */
export const nzDate = (now: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

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
  if (lastStoneDay === today) return { daysDone: wholeCount(daysDone), lastStoneDay, stoneChanged: null, goldenBasket: false };
  const next = wholeCount(daysDone) + 1;
  return { daysDone: next, lastStoneDay: today, stoneChanged: daysDone % STONES, goldenBasket: next % DAYS_PER_BASKET === 0 };
}
