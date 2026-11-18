/**
 * Percentages and "who needs help" for a focus's results table. Kept apart from the screen so the rules are easy to test and change.
 */
import type { FocusResultRow } from '../data/skillMap';

/** Fewer answers than this is too few to tell, so nobody is flagged on a bad start. */
export const HELP_MIN_ANSWERS = 8;
/** Getting fewer than this share right, after enough answers, means they are clearly stuck. */
export const HELP_BELOW = 0.5;

/** Whole-number percentage of `part` out of `whole`; null when there is nothing to divide. */
export function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

export function needsHelp(s: Pick<FocusResultRow, 'answers' | 'correct'>): boolean {
  return s.answers >= HELP_MIN_ANSWERS && s.correct / s.answers < HELP_BELOW;
}

/** Students who clearly need help, lowest share right first (more answers first when tied). */
export function studentsNeedingHelp<T extends Pick<FocusResultRow, 'answers' | 'correct'>>(students: T[]): T[] {
  return students.filter(needsHelp).sort((a, b) => a.correct / a.answers - b.correct / b.answers || b.answers - a.answers);
}
