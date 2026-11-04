/**
 * Hop's magic lily pads: one pad changes on each NZ day a child finishes the challenge, bronze for days 1 to 10, silver
 * for 11 to 20 and gold for 21 to 30 (docs/HOP-PLAN.md section 1). Days are counted, not dates, so a missed day loses
 * nothing. Everything here comes from the count of finished days alone.
 *
 * Copied from Kiwi's Beanstalk (shared/beanstalk/progress.ts on the `beanstalk` branch), which isn't live yet. Once it is,
 * the two can share one file (plan section 9).
 */

export const PADS = 10;
export const METALS = ['green', 'bronze', 'silver', 'gold'] as const;
export type Metal = (typeof METALS)[number];
/** Ten pads, three changes each: thirty finished days to a Golden Glow Jar. */
export const DAYS_PER_JAR = PADS * (METALS.length - 1);

/**
 * Who crosses the pond, in order: Hop first, then a new New Zealand friend on a fresh pond after each jar (James, 4 Nov
 * 2026). The friends after Hop are painted later, so these names can still change.
 */
export const FRIENDS = ['hop', 'gecko', 'weta', 'tuatara', 'kiwi', 'ruru'] as const;
export type Friend = (typeof FRIENDS)[number];

/**
 * How much the hop arc helps: its step ("+2") shown on bronze days, faint on silver days, gone on gold days (plan section
 * 2). Gold days also bring the counting-back hops.
 */
export type Help = 'full' | 'faint' | 'none';

export interface Pond {
  /** Golden Glow Jars won so far. */
  jars: number;
  friend: Friend;
  /** Finished days on this pond, 0 to 29. */
  day: number;
  /** Each pad's colour, nearest pad first. */
  pads: Metal[];
  /** The kind of day the next challenge is: it sets the scenery (silver river, lit forest). */
  today: Exclude<Metal, 'green'>;
  /** The step label for the next challenge. */
  help: Help;
  /** True when the next challenge is a gold day: it ends with hops counting back. */
  gold: boolean;
}

const wholeCount = (n: number) => {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`Bad day count ${n}`);
  return n;
};

export function pondAfter(daysDone: number): Pond {
  const jars = Math.floor(wholeCount(daysDone) / DAYS_PER_JAR);
  const day = daysDone % DAYS_PER_JAR;
  const round = Math.floor(day / PADS);
  // Pads change from the nearest one out: in each round of ten days the nearest pads change first.
  const pads = Array.from({ length: PADS }, (_, i) => METALS[round + (i < day % PADS ? 1 : 0)]);
  return {
    jars,
    friend: FRIENDS[jars % FRIENDS.length],
    day,
    pads,
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
  /** The NZ day the last pad changed. */
  lastPadDay: string | null;
  /** Which pad changed (0 is the nearest), or null when a pad already changed today. */
  padChanged: number | null;
  /** True when this finish turned the last pad gold. */
  jar: boolean;
}

/** A finished challenge: one pad changes on the first finish of each NZ day; playing again the same day is just for fun. */
export function finishChallenge(daysDone: number, lastPadDay: string | null, today: string): FinishResult {
  if (lastPadDay === today) return { daysDone: wholeCount(daysDone), lastPadDay, padChanged: null, jar: false };
  const next = wholeCount(daysDone) + 1;
  return { daysDone: next, lastPadDay: today, padChanged: daysDone % PADS, jar: next % DAYS_PER_JAR === 0 };
}
