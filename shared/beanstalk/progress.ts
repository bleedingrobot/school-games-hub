/**
 * The beanstalk's magic leaves: one leaf changes on each NZ day a child finishes the challenge, bronze for days 1 to 10,
 * silver for 11 to 20 and gold for 21 to 30 (docs/BEANSTALK-PLAN.md section 1). Days are counted, not dates, so a missed
 * day loses nothing. Everything here comes from the count of finished days alone.
 */
import { fadeAfter, helpWithSetting, ROUND_OF_TEN } from '../kit/help';
import { TARGETS, type Target } from './round';

export const LEAVES_ON_STALK = 10;
export const METALS = ['green', 'bronze', 'silver', 'gold'] as const;
export type Metal = (typeof METALS)[number];
/** Ten leaves, three changes each: thirty finished days to a Golden Egg. */
export const DAYS_PER_EGG = LEAVES_ON_STALK * (METALS.length - 1);

/** Who is stuck on top of each beanstalk, in order: Kiwi first, then a new New Zealand friend after each egg (James, 4 Nov 2026). */
export const FRIENDS = ['kiwi', 'tui', 'kereru', 'weta', 'ruru', 'takahe'] as const;
export type Friend = (typeof FRIENDS)[number];

/** What this beanstalk's pairs add up to: 10, 100, 1000, then round again with the next friends (James, 4 Nov 2026). */
export const targetFor = (eggs: number): Target => TARGETS[eggs % TARGETS.length];

/** How much the leaves' ten-frame dots help: full, small, or none. Since maths review R6 each child has their own (`placeAfter`). */
export type Dots = 'full' | 'small' | 'none';

/** A child's dots as it is saved: 0 full, 1 small, 2 none (more help is a lower number). */
export type HelpLevel = 0 | 1 | 2;
export const HELP_LEVELS = ['full', 'small', 'none'] as const satisfies readonly Dots[];
export const isHelpLevel = (n: unknown): n is HelpLevel => n === 0 || n === 1 || n === 2;
export const dotsFor = (help: HelpLevel): Dots => HELP_LEVELS[help];

/** The dots a child sees: their own help, unless the teacher turned the dots off for the class (then none). */
export const shownDots = (help: HelpLevel, teacherDots: boolean): Dots =>
  helpWithSetting<Dots>(dotsFor(help), teacherDots ? 'fade' : 'off', { always: 'full', off: 'none' });

export interface Stalk {
  /** Golden Eggs won so far. */
  eggs: number;
  friend: Friend;
  /** What the pairs add up to on this beanstalk. */
  target: Target;
  /** Finished days on this beanstalk, 0 to 29. */
  day: number;
  /** Each leaf's colour, bottom leaf first. */
  leaves: Metal[];
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
  return { eggs, friend: FRIENDS[eggs % FRIENDS.length], target: targetFor(eggs), day, leaves };
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

/** Where a child is with the dots: their help level and the good challenges in a row (two take the help down a step). */
export interface Place {
  help: HelpLevel;
  goodInRow: number;
}

/** First challenge: full dots. */
export const START_PLACE: Place = { help: 0, goodInRow: 0 };

/** Right at the first tap on this many pairs of 10 or more makes a good challenge, this many or fewer a hard one (shared/kit/help.ts). */
const RULES = { ...ROUND_OF_TEN, topLevel: 2 };

/**
 * The dots after a finished challenge with `right` pairs right at the first tap (R6). It moves only on the day's first
 * finish (`leafChanged` is null on a replay, so playing again for fun changes nothing). Two good challenges in a row
 * (8 or more of 10 pairs) take one step off the dots; a hard one (4 or fewer) brings a step back. A new sum (the finish that
 * wins the egg) starts again at full dots, because 70 + 30 is new. The kit counts help up from none, so its level is 2 - help.
 */
export function placeAfter(place: Place, right: number, result: Pick<FinishResult, 'leafChanged' | 'egg'>): Place {
  if (result.leafChanged === null) return place;
  if (result.egg) return START_PLACE;
  const { level, goodInRow } = fadeAfter({ level: 2 - place.help, goodInRow: place.goodInRow }, right, RULES);
  return { help: (2 - level) as HelpLevel, goodInRow };
}
