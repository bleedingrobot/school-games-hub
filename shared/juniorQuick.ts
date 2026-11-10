import { afterAnswer, type FactStats } from './maths/leitner';

/**
 * How quickly a young child (the Foundational games: Hop, Penguin Pairs, Pipi, Beanstalk, Tūī, Weka) must answer a
 * fact correctly for it to move up a box. Longer than the 5 seconds everyone else gets (shared/maths/config.ts), and
 * the clock only starts once the question has been read aloud. docs/plans/maths-review/R2-fair-step-up.md.
 */
export const JUNIOR_QUICK_MS = 10_000;

/**
 * The least time a right answer must take to count as a thought (S14: a lucky guess is not a quick answer). A right
 * first tap faster than this is still saved, with its time, but never moves a box, adds a quick day or counts towards a
 * good round. The quick window for juniors is therefore 0.6 to 10 seconds.
 */
export const JUNIOR_MIN_THINK_MS = 600;
/** True when the answer had time to be a thought. */
export const thoughtOf = (ms: number): boolean => ms >= JUNIOR_MIN_THINK_MS;

/** `afterAnswer` with the junior quick time and the think floor. A quick time of -1 can never be met, so a too-fast right answer is counted but not quick. */
export function juniorAfterAnswer(stats: FactStats, correct: boolean, ms: number, at: number): FactStats {
  return afterAnswer(stats, correct, ms, at, thoughtOf(ms) ? JUNIOR_QUICK_MS : -1);
}
