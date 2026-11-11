/**
 * One cell of the Progress table: where a pupil is in one game and what to show about it. The rules are the stuck flags' own
 * (shared/kit/teacherGrid.ts with the numbers in ../foundational/config.ts), so the table and the flags agree.
 */
import { daysAtLevel, schoolDaysSince } from '../../../shared/kit/teacherGrid';
import { QUICK_LOOKS_ID, FLAG_RULES, GAMES, stepOf } from '../foundational/config';
import { STAGES } from '../../../shared/subitising/config';
import type { FoundationalGameId, GameProgress, QuickLooksProgress } from '../../data/foundational';

export type CellStateName = 'moving' | 'stuck' | 'top' | 'quiet' | 'none';

export interface Step {
  n: number;
  of: number;
  name: string;
}

export interface CellState {
  state: CellStateName;
  step: Step | null;
  daysOnStep: number;
}

const none: CellState = { state: 'none', step: null, daysOnStep: 0 };

/** One game for one pupil. `today` is the NZ day, YYYY-MM-DD. */
export function cellState(game: FoundationalGameId, progress: GameProgress | undefined, today: string): CellState {
  if (!progress || (progress.daysDone === 0 && progress.level === null && !progress.lastDay)) return none;
  const step = stepOf(game, progress.level);
  // A game that saved no step the table knows has nothing to draw.
  if (!step) return none;
  const daysOnStep = progress.level === null ? 0 : daysAtLevel(progress.recent, progress.level);
  const quiet = progress.lastDay !== null && schoolDaysSince(progress.lastDay, today) >= FLAG_RULES.quietSchoolDays;
  if (quiet) return { state: 'quiet', step, daysOnStep };
  if (progress.level !== null && progress.level === GAMES[game].top) return { state: 'top', step, daysOnStep };
  if (progress.level !== null && daysOnStep >= FLAG_RULES.sameLevelDays) return { state: 'stuck', step, daysOnStep };
  return { state: 'moving', step, daysOnStep };
}

/** Quick looks: stages finished (0 to 7) as steps. No stuck rule. */
export function quickCellState(q: QuickLooksProgress | null | undefined, today: string): CellState {
  if (!q || (q.sessions === 0 && q.finished === 0 && !q.lastDay)) return none;
  const of = STAGES.length;
  const step = { n: q.finished, of, name: '' };
  if (q.lastDay && schoolDaysSince(q.lastDay, today) >= FLAG_RULES.quietSchoolDays) return { state: 'quiet', step, daysOnStep: 0 };
  return { state: q.finished >= of ? 'top' : 'moving', step, daysOnStep: 0 };
}

export { QUICK_LOOKS_ID };
