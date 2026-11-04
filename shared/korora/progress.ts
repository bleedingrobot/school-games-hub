/**
 * Two-Shoes' stepping stones at Penguin Pairs: ten magic stones across the water, and one changes on each NZ day a child
 * finishes the challenge, bronze for days 1 to 10, silver for 11 to 20 and gold for 21 to 30 (docs/KORORA-PLAN.md
 * section 1). Each crossing wins a pair of dancing shoes: bronze, then silver, then dazzling gold. Days are counted, not dates,
 * so a missed day loses nothing. Everything here comes from the count of finished days alone. Copied from
 * shared/hop/progress.ts (docs/EARLY-GAMES-PLAN.md section 7).
 */

export const PEBBLES = 10;
export const METALS = ['grey', 'bronze', 'silver', 'gold'] as const;
export type Metal = (typeof METALS)[number];
/** Ten stones, three changes each: thirty finished days to the dazzling gold dancing shoes. */
export const DAYS_PER_FISH = PEBBLES * (METALS.length - 1);

/**
 * Who crosses the stones, in order: Two-Shoes the penguin first (id korora), then a new New Zealand bird friend at a
 * fresh pool after each pair of gold shoes.
 * All birds, so the two little ones are always "chicks". The friends after Kororā are painted later.
 */
export const FRIENDS = ['korora', 'hoiho', 'kiwi', 'pukeko', 'kereru', 'takahe'] as const;
export type Friend = (typeof FRIENDS)[number];

/**
 * How much the pictures help: on bronze days a clear reflection with each fish joined to its mirror fish, and halves
 * shared out one by one; on silver days a faint rippled reflection and the pile only; on gold days only the words and
 * numbers (plan section 4). Gold days also end with "fair or not?".
 */
export type Help = 'full' | 'faint' | 'none';

export interface Pool {
  /** Pairs of dazzling gold dancing shoes won so far (one per pool; "fish" in the database, from before the shoes). */
  fish: number;
  /** The best dancing shoes won at this pool so far: bronze after one crossing, silver after two. */
  shoes: 'bronze' | 'silver' | null;
  friend: Friend;
  /** Finished days at this pool, 0 to 29. */
  day: number;
  /** Each pebble's colour, first pebble first. */
  pebbles: Metal[];
  /** The kind of day the next challenge is: it sets the light (day, sparkling silver, golden evening). */
  today: Exclude<Metal, 'grey'>;
  help: Help;
  /** True when the next challenge is a gold day: it ends with "fair or not?". */
  gold: boolean;
}

const wholeCount = (n: number) => {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`Bad day count ${n}`);
  return n;
};

export function poolAfter(daysDone: number): Pool {
  const fish = Math.floor(wholeCount(daysDone) / DAYS_PER_FISH);
  const day = daysDone % DAYS_PER_FISH;
  const round = Math.floor(day / PEBBLES);
  const pebbles = Array.from({ length: PEBBLES }, (_, i) => METALS[round + (i < day % PEBBLES ? 1 : 0)]);
  return {
    fish,
    friend: FRIENDS[fish % FRIENDS.length],
    day,
    pebbles,
    shoes: round === 0 ? null : round === 1 ? 'bronze' : 'silver',
    today: (['bronze', 'silver', 'gold'] as const)[round],
    help: (['full', 'faint', 'none'] as const)[round],
    gold: round === 2,
  };
}

/** NZ calendar day ('2026-11-04') of a moment, by the server clock. The same as Lord's `nzDate`. */
export const nzDate = (now: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

export interface FinishResult {
  daysDone: number;
  /** The NZ day the last pebble changed. */
  lastPebbleDay: string | null;
  /** Which pebble changed (0 is the first), or null when a pebble already changed today. */
  pebbleChanged: number | null;
  /** True when this finish turned the last stone gold: the dazzling gold dancing shoes. */
  goldenFish: boolean;
  /** The dancing shoes this finish won, when it turned the last stone of a crossing. */
  shoesWon: Exclude<Metal, 'grey'> | null;
}

/** A finished challenge: one pebble changes on the first finish of each NZ day; playing again the same day is just for fun. */
export function finishChallenge(daysDone: number, lastPebbleDay: string | null, today: string): FinishResult {
  if (lastPebbleDay === today) return { daysDone: wholeCount(daysDone), lastPebbleDay, pebbleChanged: null, goldenFish: false, shoesWon: null };
  const next = wholeCount(daysDone) + 1;
  const crossed = next % PEBBLES === 0;
  const shoesWon = crossed ? (['gold', 'bronze', 'silver'] as const)[(next / PEBBLES) % 3] : null;
  return { daysDone: next, lastPebbleDay: today, pebbleChanged: daysDone % PEBBLES, goldenFish: next % DAYS_PER_FISH === 0, shoesWon };
}
