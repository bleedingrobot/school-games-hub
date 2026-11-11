/**
 * One cell of the Progress table: where a pupil is in one game and what to show about it. The rules are the stuck flags' own
 * (shared/kit/teacherGrid.ts with the numbers in ../foundational/config.ts), so the table and the flags agree.
 */
import { daysAtLevel, schoolDaysSince } from '../../../shared/kit/teacherGrid';
import { mastery, type FactStats } from '../../../shared/maths/leitner';
import { QUICK_LOOKS_ID, FLAG_RULES, GAMES, NEARLY_SHARE, stepOf } from '../foundational/config';
import { stepKeys as hopKeys, type HopStep } from '../../../shared/hop/round';
import { levelKeys as keroraKeys, type Level as KeroraLevel } from '../../../shared/korora/round';
import { levelKeys as wekaKeys, type Level as WekaLevel } from '../../../shared/weka/round';
import { levelKeys as pipiKeys, type Level as PipiLevel } from '../../../shared/pipi/round';
import { GOOD_TO_PASS as TUI_GOOD } from '../../../shared/tui/round';
import { STEP_RULES as ROBIN_RULES } from '../../../shared/robin/config';
import { STEP_RULES as PARROT_RULES } from '../../../shared/parrot/config';
import { GOOD_TO_PASS as LIZARD_GOOD } from '../../../shared/lizard/config';
import { GOOD_TO_PASS as PIGEON_GOOD } from '../../../shared/pigeon/config';
import { GOOD_TO_PASS as SWAMPHEN_GOOD } from '../../../shared/swamphen/config';
import { STAGES } from '../../../shared/subitising/config';
import type { FoundationalGameId, GameProgress, QuickLooksProgress } from '../../data/foundational';

export type CellStateName = 'moving' | 'nearly' | 'stuck' | 'top' | 'quiet' | 'none';

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

/** Good goes at a step that pass it, for the games that count them (each game's own shared setting). */
const GOOD_TO_PASS: Partial<Record<FoundationalGameId, number>> = {
  tui: TUI_GOOD,
  robin: ROBIN_RULES.goodToPass,
  parrot: PARROT_RULES.goodToPass,
  lizard: LIZARD_GOOD,
  pigeon: PIGEON_GOOD,
  swamphen: SWAMPHEN_GOOD,
};

/** The fact keys that decide a step, for the games that move up on fact mastery. */
const STEP_KEYS: Partial<Record<FoundationalGameId, (level: number) => string[]>> = {
  hop: (l) => hopKeys(l as HopStep),
  korora: (l) => keroraKeys(l as KeroraLevel),
  weka: (l) => wekaKeys(l as WekaLevel),
  pipi: (l) => pipiKeys(l as PipiLevel),
};

/** One good go (or, for the mastery games, a few facts) from the next step. Beanstalk has no 'nearly'. */
function isNearly(game: FoundationalGameId, progress: GameProgress, facts: readonly FactStats[] | undefined): boolean {
  const pass = GOOD_TO_PASS[game];
  if (pass !== undefined) return progress.good !== null && progress.good >= pass - 1;
  const keys = progress.level === null ? undefined : STEP_KEYS[game]?.(progress.level);
  if (!keys || keys.length === 0 || !facts) return false;
  const byKey = new Map(facts.map((f) => [f.key, f]));
  const strong = keys.filter((k) => {
    const m = mastery(byKey.get(k));
    return m === 'secure' || m === 'fluent';
  }).length;
  return strong / keys.length >= NEARLY_SHARE;
}

/** Calendar days from `since` to `today`, counting both (started today is 1). */
function daysSince(since: string, today: string): number {
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${since}T00:00:00Z`);
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/** One game for one pupil. `today` is the NZ day, YYYY-MM-DD. `facts` are the pupil's facts, used for the mastery games' 'nearly'. */
export function cellState(game: FoundationalGameId, progress: GameProgress | undefined, today: string, facts?: readonly FactStats[]): CellState {
  if (!progress || (progress.daysDone === 0 && progress.level === null && !progress.lastDay)) return none;
  const step = stepOf(game, progress.level);
  // A game that saved no step the table knows has nothing to draw.
  if (!step) return none;
  const daysOnStep = progress.level === null ? 0 : progress.since ? daysSince(progress.since, today) : daysAtLevel(progress.recent, progress.level);
  const quiet = progress.lastDay !== null && schoolDaysSince(progress.lastDay, today) >= FLAG_RULES.quietSchoolDays;
  if (quiet) return { state: 'quiet', step, daysOnStep };
  if (progress.level !== null && progress.level === GAMES[game].top) return { state: 'top', step, daysOnStep };
  if (progress.level !== null && daysOnStep >= FLAG_RULES.sameLevelDays) return { state: 'stuck', step, daysOnStep };
  if (isNearly(game, progress, facts)) return { state: 'nearly', step, daysOnStep };
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
