/**
 * Every tuning number of Lizard's Bundles in one place (docs/LIZARD-PLAN.md). Nothing else in shared/lizard has a
 * number of its own: change the game's feel here. The simulator (scripts/lizard-sim.mjs) reads the same numbers.
 */

// ---------------------------------------------------------------- a challenge

export const GOES_PER_ROUND = 10;
/** From step 2 on, this many goes are from earlier steps (the rest are today's step). */
export const REVIEW_GOES = 3;

// ---------------------------------------------------------------- steps and help (the kit's rule 5 numbers)

/** Right at the first try on this many goes (of 10) or more makes a good challenge. */
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
export const TOP_STEP = 7;
/** The hundreds (step 6) start with at least this much help: the raft is a new thing. */
export const NEW_THING_LEVEL = 3;
export const NEW_THING_STEPS: readonly number[] = [6];

/** A child with all nine of Tūī's "ten and" facts secure (box 2 or more) starts at step 3, help level 3. */
export const TEN_AND_ALL = 9;
export const TEN_AND_ALL_START = { step: 3, level: 3 } as const;
/** A child with this many of them secure starts at step 2, help level 4. */
export const TEN_AND_SOME = 5;
export const TEN_AND_SOME_START = { step: 2, level: 4 } as const;


// ---------------------------------------------------------------- the cards

/** Cards for a read or more-and-less go: the right one and this many wrong. */
export const WRONG_CARDS = 3;
/** The most two cards may share an ending (the kit's "tell" check). */
export const MAX_SHARE_TELL = 2;
/** The biggest number a card, or a built answer, can be. */
export const MAX_PICK = 9999;
/** The most sticks a child can put on the mat (a stick button held down is still at most this many taps). */
export const MAX_ONES = 19;

// ---------------------------------------------------------------- the days

export const DEN_BUNDLES = 10;

// ---------------------------------------------------------------- the quick-answer clock

/** A first try is "quick" within this many milliseconds, from when the voice finished (junior value: shared/juniorQuick.ts). */
export { JUNIOR_QUICK_MS as QUICK_MS } from '../juniorQuick';

// ---------------------------------------------------------------- what a teacher sees

/** The latest first tries counted for the slip most often made. */
export const TEACHER_TAPS = 30;
