/**
 * The beanstalk's magic leaves: one leaf changes on each NZ day a child finishes the challenge, bronze for days 1 to 10,
 * silver for 11 to 20 and gold for 21 to 30 (docs/BEANSTALK-PLAN.md section 1). Days are counted, not dates, so a missed
 * day loses nothing. Everything here comes from the count of finished days alone.
 */
import { fadeAfter, helpWithSetting, ROUND_OF_TEN, type FadeRules } from '../kit/help';
import { mastery, type FactStats } from '../maths/leitner';
import { factKeys, MISSING_GOES, PAIRS_PER_ROUND, TARGETS, type Stage, type Target } from './round';

export const LEAVES_ON_STALK = 10;
export const METALS = ['green', 'bronze', 'silver', 'gold'] as const;
export type Metal = (typeof METALS)[number];
/** Ten leaves, three changes each: thirty finished days to a Golden Egg. */
export const DAYS_PER_EGG = LEAVES_ON_STALK * (METALS.length - 1);

/** Who is stuck on top of each beanstalk, in order: Kiwi first, then a new New Zealand friend after each egg (James, 4 Nov 2026). */
export const FRIENDS = ['kiwi', 'tui', 'kereru', 'weta', 'ruru', 'takahe'] as const;
export type Friend = (typeof FRIENDS)[number];

/**
 * The sum a child is on (S21): their saved stage, not the calendar. The calendar only gives eggs and friends now.
 * Back-fill for children saved before stages: the stage the egg count had them on.
 */
export const stageTarget = (p: { stage: Stage }): Target => TARGETS[p.stage];
export const stageForEggs = (eggs: number): Stage => (eggs % TARGETS.length) as Stage;

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
  return { eggs, friend: FRIENDS[eggs % FRIENDS.length], day, leaves };
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

/** Where a child is with the dots of one kind of go: their help level and the good challenges in a row (two take the help down a step). */
export interface Place {
  help: HelpLevel;
  goodInRow: number;
}

/** First challenge: full dots. */
export const START_PLACE: Place = { help: 0, goodInRow: 0 };

/** The two kinds of go (S35): a pair of leaves, or the missing leaf ("7 + ? = 10"). Each has its own dots. */
export type GoKind = 'pair' | 'missing';
/** Goes of each kind in a round: 7 pairs and 3 missing-leaf goes (round.ts: MISSING_GOES). */
export const GOES_OF_KIND: Record<GoKind, number> = { pair: PAIRS_PER_ROUND - MISSING_GOES.length, missing: MISSING_GOES.length };

/**
 * Right at the first tap on this many goes of a kind or more makes a good challenge, this many or fewer a hard one: the
 * kit's 8 and 4 of 10 scaled to the goes of the kind (ceil of 0.8 and floor of 0.4 of them): 6 and 2 of 7 pairs, 3 and 1 of 3 missing-leaf goes.
 */
const RULES: Record<GoKind, FadeRules> = {
  pair: { good: Math.ceil(0.8 * GOES_OF_KIND.pair), hard: Math.floor(0.4 * GOES_OF_KIND.pair), goodToFade: ROUND_OF_TEN.goodToFade, topLevel: 2 },
  missing: { good: Math.ceil(0.8 * GOES_OF_KIND.missing), hard: Math.floor(0.4 * GOES_OF_KIND.missing), goodToFade: ROUND_OF_TEN.goodToFade, topLevel: 2 },
};

/**
 * The dots of one kind after a finished challenge with `right` of that kind's goes right at the first tap (R6, S35). It moves
 * only on the day's first finish (`leafChanged` is null on a replay, so playing again for fun changes nothing). Two good
 * challenges in a row take one step off the dots; a hard one brings a step back. A new sum (the finish that moves the child up
 * or back a stage) starts again at full dots for both kinds, because 70 + 30 is new. The kit counts help up from none, so its level is 2 - help.
 */
export function placeAfter(
  place: Place,
  right: number,
  result: Pick<FinishResult, 'leafChanged'> & { stageChanged: boolean },
  kind: GoKind = 'pair',
): Place {
  if (result.leafChanged === null) return place;
  if (result.stageChanged) return START_PLACE;
  const { level, goodInRow } = fadeAfter({ level: 2 - place.help, goodInRow: place.goodInRow }, right, RULES[kind]);
  return { help: (2 - level) as HelpLevel, goodInRow };
}

/** Where a child is on the sums, and how their days have gone (S21). Saved with the progress. */
export interface Steps {
  stage: Stage;
  /** Good days in a row (8 or more of 10 pairs right at the first tap), counted on each NZ day's first finish. */
  goodDays: number;
  /** Hard days in a row (4 or fewer right). */
  hardDays: number;
  /** Finished days since the stage last changed. 0 means the child has just arrived on it (the bridge line shows). */
  stageDays: number;
}

export const START_STEPS: Steps = { stage: 0, goodDays: 0, hardDays: 0, stageDays: 0 };

/** The counts stay small: a child who is good but not yet secure can stay on 2 or more good days for a while. */
export const COUNT_CAP = 9;
export const STAGE_DAYS_CAP = 100;
/** Good days in a row, with the sum secure, to move up; hard days in a row to step back. */
export const DAYS_TO_MOVE = 2;

/** 70 percent of a sum's facts in box 2 or more makes it secure (the rule the teacher's skill map uses). */
export const SECURE_SHARE = 0.7;

/** Is at least 70 percent of this sum's facts secure (box 2 or more) in these records? */
export function sumSecure(facts: readonly FactStats[], target: Target): boolean {
  const keys = factKeys(target);
  const byKey = new Map(facts.map((f) => [f.key, f]));
  const secure = keys.filter((k) => ['secure', 'fluent'].includes(mastery(byKey.get(k)))).length;
  return secure / keys.length >= SECURE_SHARE;
}

/**
 * The stage after a finished challenge with `right` pairs right at the first tap (S21). It moves only on the NZ day's first
 * finish (`leafChanged` null on a replay changes nothing). 8 or more right: a good day (and the hard days start again); 4 or
 * fewer: a hard day; between: both start again. Two good days in a row with the sum secure move the child up one stage (never
 * past 1000); two hard days in a row step them back one (never below bonds to 10). The stage does not go round to 10 again. A
 * change resets the counts. `moved` is 1 up, -1 back, 0 stayed.
 */
export function afterDay(steps: Steps, right: number, firstFinish: boolean, secure: boolean): Steps & { moved: -1 | 0 | 1 } {
  if (!firstFinish) return { ...steps, moved: 0 };
  const good = right >= ROUND_OF_TEN.good;
  const hard = right <= ROUND_OF_TEN.hard;
  const goodDays = good ? Math.min(steps.goodDays + 1, COUNT_CAP) : 0;
  const hardDays = hard ? Math.min(steps.hardDays + 1, COUNT_CAP) : 0;
  const stageDays = Math.min(steps.stageDays + 1, STAGE_DAYS_CAP);
  if (goodDays >= DAYS_TO_MOVE && secure && steps.stage < 3) return { stage: (steps.stage + 1) as Stage, goodDays: 0, hardDays: 0, stageDays: 0, moved: 1 };
  if (hardDays >= DAYS_TO_MOVE && steps.stage > 0) return { stage: (steps.stage - 1) as Stage, goodDays: 0, hardDays: 0, stageDays: 0, moved: -1 };
  return { stage: steps.stage, goodDays, hardDays, stageDays, moved: 0 };
}
