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
 *
 * The order follows the NZ Curriculum families (James, 18 Oct 2026): 2/5/10, then 3/4/8,
 * then 6/9, then 7, then 11/12. It used to put ×8 with ×6 and ×7 with ×9. Level numbers are
 * unchanged, so a student part-way through the old order keeps their level; the facts they
 * already know are in their records, so they show up as review and the new tables as focus.
 * Fact records are keyed by the fact ("mul:6x7"), not by the step, so none are lost.
 */
export const CAMPAIGN_STEPS: { levels: number[]; add: number[]; upTo?: number }[] = [
  { levels: [1, 2], add: [2, 5, 10], upTo: 10 },
  { levels: [3, 4], add: [3, 4, 8] },
  { levels: [5, 6], add: [6, 9] },
  { levels: [7, 8], add: [7] },
  { levels: [9, 10], add: [11, 12] },
];

/** In auto mode, review leans towards the hardest tables (the England Multiplication Tables Check finds these hardest). */
export const HARD_TABLES: readonly number[] = [6, 7, 8, 9, 12];
/** How much likelier a fact using a hard table is to be picked, on top of its box. */
export const HARD_TABLE_WEIGHT = 1.5;

/** Share of questions from the current focus tables, review of earlier tables, and stretch (next table up). */
export const MIX = { focus: 0.6, review: 0.3, stretch: 0.1 };

/** Missing-factor questions (? × 8 = 56) start at this campaign level. */
export const MISSING_FACTOR_FROM_LEVEL = 4;
/** When missing-factor questions are on, this share of questions are missing-factor. */
export const MISSING_FACTOR_SHARE = 0.3;
/** When division is switched on, this share of questions are division. */
export const DIVISION_SHARE = 0.3;

/**
 * The longest an answer is kept as taking. A student who looks away for ten minutes mid-question has not spent ten minutes on
 * the sum: kept as it is, one such answer would swamp the average time teachers see for that fact. Longer answers still count,
 * as this long (right or wrong is untouched, and anything this slow is far from quick).
 */
export const LONGEST_ANSWER_MS = 120_000;
/** An answer's time as it is kept: whole milliseconds, 0 to `LONGEST_ANSWER_MS`. */
export const keptMs = (ms: number) => Math.min(LONGEST_ANSWER_MS, Math.max(0, Math.round(ms)));

/** Answering correctly within this many milliseconds counts as quick. */
export const QUICK_MS = 5000;
/**
 * Packs whose questions take longer to think through have a longer quick time (James can change these): the generated
 * skills (rounding a 7-digit number, 2 + 3 × 4 − 1 with four choices) can't be answered in 5 seconds by a student who knows
 * them well, and a box only moves up on a quick answer, so with 5 seconds those skills would never be secure.
 */
export const QUICK_MS_BY_PACK: Readonly<Record<string, number>> = { generated: 8000 };
/** The quick time for the records of a pack ("times-tables", "generated"...). */
export const quickMsForPack = (pack: string | null | undefined): number => (pack && Object.hasOwn(QUICK_MS_BY_PACK, pack) ? QUICK_MS_BY_PACK[pack] : QUICK_MS);

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

/** The placement check asks this many questions. */
export const PLACEMENT_QUESTIONS = 10;
/**
 * How many skills the placement check jumps up after a right, quick answer (until the first miss, then one at a time). Two was
 * enough for 19 skills; with all 31 built, ten questions at two skills each cannot reach the top, so it is three. With 33 (M.5's
 * bond skills, 20 Oct 2026) a student who is right and quick throughout starts within the last 7.
 */
export const PLACEMENT_JUMP = 3;
