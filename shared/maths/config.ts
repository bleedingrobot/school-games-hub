/**
 * Tuning numbers for the maths engine, in one place. Nothing here knows about any game.
 */

/** Times tables 1–12. */
export const TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * The campaign's focus tables: each step adds tables, and the tables from earlier steps
 * become review. Edit freely; levels not listed use the last step. `upTo` is the biggest
 * number any fact uses in that step (default 12): the first levels stop at × 10 so they're
 * super easy (James, 16 Oct 2026).
 */
export const CAMPAIGN_STEPS: { levels: number[]; add: number[]; upTo?: number }[] = [
  { levels: [1, 2], add: [2, 5, 10], upTo: 10 },
  { levels: [3, 4], add: [3, 4] },
  { levels: [5, 6], add: [6, 8] },
  { levels: [7, 8], add: [7, 9] },
  { levels: [9, 10], add: [11, 12] },
];

/** Share of questions from the current focus tables, review of earlier tables, and stretch (next table up). */
export const MIX = { focus: 0.6, review: 0.3, stretch: 0.1 };

/** Missing-factor questions (? × 8 = 56) start at this campaign level. */
export const MISSING_FACTOR_FROM_LEVEL = 4;
/** When missing-factor questions are on, this share of questions are missing-factor. */
export const MISSING_FACTOR_SHARE = 0.3;
/** When division is switched on, this share of questions are division. */
export const DIVISION_SHARE = 0.3;

/** Answering correctly within this many milliseconds counts as quick. */
export const QUICK_MS = 5000;

/** Mastery boxes 0–4 (Leitner). How likely each box is to be picked: lower boxes come up more. */
export const BOX_WEIGHTS = [6, 5, 3, 2, 1];
export const TOP_BOX = 4;
/** A fact only reaches the top box ("fluent") after quick, correct answers on this many different days. */
export const FLUENT_DAYS = 2;

/** A fact answered wrongly comes back after this many other questions (a random number in this range). */
export const REPEAT_AFTER = { min: 3, max: 6 };
/** Facts asked in the last this-many questions aren't asked again (unless they're a planned repeat). */
export const AVOID_RECENT = 3;

/** How many choices in multiple-choice mode. */
export const CHOICES = 4;
