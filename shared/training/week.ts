/** The "this week" line on the Training home: how many facts turned bright green during the school week. */
import { TRAINING_CONFIG, type TrainingConfig } from './config';
import { daysBetween, type FactRecord } from './records';
import { factBandIndex, type Answer } from './speed';

/** The Monday of the week a "YYYY-MM-DD" day is in (weeks run Monday to Sunday). */
export function weekStart(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - sinceMonday);
  return d.toISOString().slice(0, 10);
}

/** Is `day` in the same Monday-to-Sunday week as `today`? */
export const inSameWeek = (day: string, today: string) => daysBetween(weekStart(today), day) >= 0 && daysBetween(weekStart(today), day) <= 6;

/**
 * Did this fact turn bright green during the week? It counts when an answer in the week took
 * its colour to bright green from something else (or from untried). A fact that was already
 * bright green on Monday and stayed there didn't turn green this week.
 *
 * A record only keeps its latest answers. When the list is full we can't see what came before the
 * first two, so those two can't be told apart from "already green" and aren't counted.
 */
export function turnedGreenInWeek(answers: readonly Answer[], today: string, config: TrainingConfig = TRAINING_CONFIG): boolean {
  const skip = answers.length >= config.historyLength ? config.colourFromLastAnswers - 1 : 0;
  for (let i = skip; i < answers.length; i++) {
    if (!inSameWeek(answers[i].day, today)) continue;
    const before = factBandIndex(answers.slice(0, i), config);
    if (factBandIndex(answers.slice(0, i + 1), config) === 0 && before !== 0) return true;
  }
  return false;
}

/** How many facts turned bright green this week. */
export function greenThisWeek(records: Record<string, FactRecord>, today: string, config: TrainingConfig = TRAINING_CONFIG): number {
  return Object.values(records).filter((r) => turnedGreenInWeek(r.answers, today, config)).length;
}

/** One friendly line. Never anything about getting slower. */
export function weekLine(count: number): string {
  if (count <= 0) return 'Every day you practise makes your facts stronger.';
  return count === 1 ? '1 fact turned green this week!' : `${count} facts turned green this week!`;
}
