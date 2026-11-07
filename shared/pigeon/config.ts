/**
 * Every tuning number of Pigeon's Number Line in one place (docs/PIGEON-PLAN.md). Nothing else in shared/pigeon has a
 * number of its own: change the game's feel here. The simulator (scripts/pigeon-sim.mjs) reads the same numbers.
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
export const TOP_STEP = 7;
/** A new line length (the zoom lens at step 6, the long branch at step 7) starts with at least this much help. */
export const NEW_LINE_LEVEL = 3;
export const NEW_LINE_STEPS: readonly number[] = [6, 7];

/** A child who has most of the ten-and facts when they first play starts here (nothing else known). */
export const TEN_AND_KNOWN = 7;
export const TEN_AND_START = { step: 1, level: 4 } as const;
/** A child who has most of Ruru's one more and one less keys (`more1:` and `less1:`, 40 in all) starts here. */
export const RURU_KEYS_NEEDED = 30;
export const RURU_START = { step: 3, level: 2 } as const;

/** Wrong taps in a row on first goes that bring full help back for the rest of the challenge (the kit's rule). */
export const STRUGGLE_GOES = 3;
/** At the third wrong tap on one go, only the nearest posts and the arrow stay bright. */
export const BRIGHT_AT_WRONG = 3;

// ---------------------------------------------------------------- the line

/** The share of 'near ten' numbers (not halfway) that must be secure (box 2+) before halfway numbers (65) are asked. */
export const HALFWAY_UNLOCK_SHARE = 0.7;
/** "Where does it go?" is right within one twentieth of the line. */
export const PLACE_DIVISOR = 20;
/** Tens and hundreds as targets are tighter: one thirtieth. */
export const TARGET_DIVISOR = 30;
/** A 10-wide lens is right within 2; a wider lens within a twentieth of the lens. */
export const NARROW_LENS = 10;
export const NARROW_TOLERANCE = 2;
/** Cards for a read or ten-more-and-less go: the right one and this many wrong. */
export const WRONG_CARDS = 3;
/** The most two cards may share an ending (the kit's "tell" check). */
export const MAX_SHARE_TELL = 2;
/** Where a tap lands on the line, in parts of this many (1000 = permille). */
export const TAP_SCALE = 1000;
/** A tap's greatest card number (the long branch is 1000). */
export const MAX_NUMBER = 1000;

// ---------------------------------------------------------------- the days

export const BERRY_CLUSTERS = 10;

// ---------------------------------------------------------------- the quick-answer clock

/** A first tap is "quick" within this many milliseconds, from when the voice finished (junior value: shared/juniorQuick.ts). */
export { JUNIOR_QUICK_MS as QUICK_MS } from '../juniorQuick';

// ---------------------------------------------------------------- what a teacher sees

/** The latest place taps counted for the average distance. */
export const TEACHER_TAPS = 10;
/** Numbers over this share of the line count as "big" for the squash check. */
export const BIG_SHARE = 0.7;
/** Big numbers placed this many percent of the line too far along, on average, look squashed. */
export const SQUASH_PERCENT = 8;
