/**
 * Every tuning number of Swamp Hen's Reed Rows in one place (docs/SWAMPHEN-PLAN.md). Nothing else in shared/swamphen has a
 * number of its own: change the game's feel here. The simulator (scripts/swamphen-sim.mjs) reads the same numbers.
 */

// ---------------------------------------------------------------- a challenge

export const GOES_PER_ROUND = 10;
/** From step 2 on, this many goes are from earlier steps (the rest are today's step). */
export const REVIEW_GOES = 3;

// ---------------------------------------------------------------- steps and help (the kit's rule 5 numbers)

/** Right at the first tap on this many goes (of 10) or more makes a good challenge. */
export const GOOD = 8;
/** This many or fewer makes a hard one. */
export const HARD = 4;
/** Good challenges at a step that pass it (two, as Tūī). */
export const GOOD_TO_PASS = 2;
/** Good challenges in a row that take the help down one level. */
export const GOOD_TO_FADE = 2;
/** Levels of help a new step brings back (up two), unless the help faded on that same go. */
export const NEW_STEP_HELP = 2;
export const TOP_LEVEL = 5;
export const TOP_STEP = 6;

/** A child who has most of the 3 to 8 times tables when they first play starts here. */
export const TABLES_SECURE = 0.7;
export const TABLES_START = { step: 5, level: 2 } as const;
/** A child who has most of Hop's counting in fives and tens starts here. */
export const SKIP_SECURE = 0.7;
export const SKIP_START = { step: 2, level: 5 } as const;


// ---------------------------------------------------------------- the cards

/** Cards for a go: the right one and this many wrong. */
export const WRONG_CARDS = 3;
/** The most two cards may share an ending (the kit's "tell" check). */
export const MAX_SHARE_TELL = 2;
/** The shoots in a row at step 1 (2, 5 and 10), as the plan's first rung. */
export const STEP_ONE_ROW_SIZES: readonly number[] = [2, 5, 10];
/** A picture card's code is rows times this plus columns (a scatter has no rows: the code is its count). */
export const CODE = 100;

// ---------------------------------------------------------------- the days

export const REED_ROWS = 10;

// ---------------------------------------------------------------- the quick-answer clock

/** A first tap is "quick" within this many milliseconds, from when the voice finished (junior value: shared/juniorQuick.ts). */
export { JUNIOR_QUICK_MS as QUICK_MS } from '../juniorQuick';

// ---------------------------------------------------------------- what a teacher sees

/** The latest challenges counted for the slip a child makes most. */
export const TEACHER_ROUNDS = 5;
/** A slip must show this many times to be named. */
export const SLIP_MIN = 2;
