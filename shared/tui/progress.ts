/**
 * The ten kōwhai flowers on Tūī's Ten Tree: one flower changes on each NZ day a child finishes the challenge, bronze
 * for days 1 to 10, silver for 11 to 20 and gold for 21 to 30 (docs/TUI-PLAN.md section 1). Days are counted, not
 * dates, so a missed day loses nothing. The colours mark days, not skill: the help follows the child (round.ts).
 * Copied from shared/weka/progress.ts (docs/EARLY-GAMES-PLAN.md section 7).
 */

export const FLOWERS = 10;
export const METALS = ['bud', 'bronze', 'silver', 'gold'] as const;
export type Metal = (typeof METALS)[number];
/** Ten flowers, three changes each: thirty finished days to a Golden Nest. */
export const DAYS_PER_NEST = FLOWERS * (METALS.length - 1);

/** Whose tree it is, in order: Tūī first, then a new friend's tree after each Golden Nest (plan section 1). */
export const FRIENDS = ['tui', 'kereru', 'piwakawaka', 'korimako', 'kaka'] as const;
export type Friend = (typeof FRIENDS)[number];
export const FRIEND_NAMES: Record<Friend, string> = { tui: 'Tūī', kereru: 'Kererū', piwakawaka: 'Pīwakawaka', korimako: 'Korimako', kaka: 'Kākā' };

export interface Tree {
  /** Golden Nests won so far. */
  nests: number;
  friend: Friend;
  /** Finished days at this tree, 0 to 29. */
  day: number;
  /** Each flower's colour, first flower first. */
  flowers: Metal[];
  /** The kind of day the next challenge is: it sets the light (spring, misty silver, golden evening). */
  today: Exclude<Metal, 'bud'>;
}

const wholeCount = (n: number) => {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`Bad day count ${n}`);
  return n;
};

export function treeAfter(daysDone: number): Tree {
  const nests = Math.floor(wholeCount(daysDone) / DAYS_PER_NEST);
  const day = daysDone % DAYS_PER_NEST;
  const round = Math.floor(day / FLOWERS);
  return {
    nests,
    friend: FRIENDS[nests % FRIENDS.length],
    day,
    flowers: Array.from({ length: FLOWERS }, (_, i) => METALS[round + (i < day % FLOWERS ? 1 : 0)]),
    today: (['bronze', 'silver', 'gold'] as const)[round],
  };
}

/** NZ calendar day ('2026-11-04') of a moment, by the server clock. The same as Lord's `nzDate`. */
export const nzDate = (now: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

export interface FinishResult {
  daysDone: number;
  /** The NZ day the last flower changed. */
  lastFlowerDay: string | null;
  /** Which flower changed (0 is the first), or null when a flower already changed today. */
  flowerChanged: number | null;
  /** True when this finish turned the last flower gold: a Golden Nest. */
  goldenNest: boolean;
}

/** A finished challenge: one flower changes on the first finish of each NZ day; playing again the same day is just for fun. */
export function finishChallenge(daysDone: number, lastFlowerDay: string | null, today: string): FinishResult {
  if (lastFlowerDay === today) return { daysDone: wholeCount(daysDone), lastFlowerDay, flowerChanged: null, goldenNest: false };
  const next = wholeCount(daysDone) + 1;
  return { daysDone: next, lastFlowerDay: today, flowerChanged: daysDone % FLOWERS, goldenNest: next % DAYS_PER_NEST === 0 };
}
