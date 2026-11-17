/**
 * Every tuning number of Swamp Hen's Reed Rows in one place (docs/SWAMPHEN-PLAN.md). Nothing else in shared/swamphen has a
 * number of its own: change the game's feel here. The simulator (scripts/swamphen-sim.mjs) reads the same numbers.
 */

// ---------------------------------------------------------------- a challenge

export const GOES_PER_ROUND = 10;
/** From step 2 on, this many goes are from earlier steps once a step is settled (the rest are today's step). */
export const REVIEW_GOES = 3;
/**
 * New goes ease in: on the first counted day at a step only this many of the ten are the new step, then more, then the
 * usual ten less REVIEW_GOES (index = counted days at the step so far; the last number stays).
 */
export const NEW_GOES_BY_DAY: readonly number[] = [3, 5, 7];
/** At most this many kinds of go in one day's challenge, so it never feels like a jumble. */
export const MAX_KINDS = 2;

// ---------------------------------------------------------------- steps and help (the kit's rule 5 numbers)

/** Right at the first tap on this many goes (of 10) or more makes a good challenge. */
export const GOOD = 8;
/** This many or fewer makes a hard one. */
export const HARD = 4;
/** Good challenges at a step that pass it (three: the plan of 18 Nov 2026, two was too fast for 6-year-olds). */
export const GOOD_TO_PASS = 3;
/** Hard challenges in a row that take the child back one step, quietly. */
export const HARD_TO_DROP = 2;
/** Good challenges in a row that take the help down one level. */
export const GOOD_TO_FADE = 2;
/** Levels of help a new step brings back (up two), unless the help faded on that same go. */
export const NEW_STEP_HELP = 2;
export const TOP_LEVEL = 5;
export const TOP_STEP = 9;
/** The Big Garden: steps from here on (6s to 9s built from facts the child knows), only after every earlier step is passed. */
export const BIG_GARDEN_STEP = 8;

/** A child who has most of the 2 to 5 times tables when they first play starts here (under the mat, not the Big Garden). */
export const TABLES_SECURE = 0.7;
export const TABLES_START = { step: 7, level: 3 } as const;
/** A child who has most of Hop's counting in fives and tens starts here (rows of 10 and 5). */
export const SKIP_SECURE = 0.7;
export const SKIP_START = { step: 3, level: 5 } as const;


// ---------------------------------------------------------------- the cards

/** Cards for a go: the right one and this many wrong. */
export const WRONG_CARDS = 3;
/** The most two cards may share an ending (the kit's "tell" check). */
export const MAX_SHARE_TELL = 2;
/** The biggest garden in an "equal rows or not?" go (step 1): small enough to see at a glance. */
export const EQUAL_MAX = 12;
/** Sharing at step 4 stays at 20 shoots or fewer. */
export const SHARE_MAX = 20;
/** Turning at step 5: rows and shoots in a row 2 to 5, 15 shoots or fewer. */
export const TURN_MAX = 15;
/** A picture card's code is rows times this plus columns (a scatter has no rows: the code is its count). */
export const CODE = 100;
/** An uneven garden's code adds this times its way of being uneven (1 last row short, 2 first row long). */
export const UNEVEN = 1000;

// ---------------------------------------------------------------- the days

export const REED_ROWS = 10;

// ---------------------------------------------------------------- the quick-answer clock

/** A first tap is "quick" within this many milliseconds, from when the voice finished (junior value: shared/juniorQuick.ts). */
export { JUNIOR_QUICK_MS as QUICK_MS } from '../juniorQuick';

// ---------------------------------------------------------------- what a teacher sees

/** The latest challenges counted for the slip a child makes most. */
export const TEACHER_ROUNDS = 5;
