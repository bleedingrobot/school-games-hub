/**
 * One cell of the Progress table: where a pupil is in one game and what to show about it. The rules are the stuck flags' own
 * (shared/kit/teacherGrid.ts with the numbers in ../foundational/config.ts), so the table and the flags agree.
 */
import { daysAtLevel, schoolDaysSince } from '../../../shared/kit/teacherGrid';
import type { ProgressCell } from '../../games/types';
import { mastery, nzDay, type FactStats } from '../../../shared/maths/leitner';
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
import type { FoundationalGameId, GameProgress, QuickLooksProgress, RecentChallenge, StepMove } from '../../data/foundational';

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
  /** % right first try and usual time over the last rounds (P8); null or missing when the game saved neither. */
  firstTry?: FirstTry | null;
}

/** How a pupil goes at first tap over their last rounds. Either part can be missing; both missing is null instead. */
export interface FirstTry {
  /** Whole % of goes right at the first tap, from the rounds that say; null when none do. */
  percent: number | null;
  /** The median of the rounds' first-tap times, in ms; null when none say. */
  ms: number | null;
}

/** How many of the newest rounds count. */
export const FIRST_TRY_ROUNDS = 10;

const medianOf = (values: number[]): number => {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};

/**
 * % right first try (goes right first time over goes, in the rounds that say) and the median first-tap time, over the newest
 * {@link FIRST_TRY_ROUNDS} rounds. A round's goes are its taps less its wrong taps. Nothing to say: null, never a made-up number.
 */
export function firstTryOf(recent: readonly RecentChallenge[]): FirstTry | null {
  const newest = recent.slice(0, FIRST_TRY_ROUNDS);
  let right = 0;
  let goes = 0;
  for (const r of newest) {
    const n = r.taps - r.wrong;
    if (r.firstRight === undefined || n <= 0) continue;
    right += Math.min(r.firstRight, n);
    goes += n;
  }
  const times = newest.flatMap((r) => (r.ms !== undefined ? [r.ms] : []));
  const percent = goes > 0 ? Math.round((100 * right) / goes) : null;
  const ms = times.length > 0 ? Math.round(medianOf(times)) : null;
  return percent === null && ms === null ? null : { percent, ms };
}

/** "72% right first try · usually 3.1 s", or "" when there is nothing to say. */
export function firstTryWords(f: FirstTry | null | undefined): string {
  if (!f) return '';
  return [f.percent === null ? '' : `${f.percent}% right first try`, f.ms === null ? '' : `usually ${(f.ms / 1000).toFixed(1)} s`].filter(Boolean).join(' · ');
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
  const firstTry = firstTryOf(progress.recent);
  const quiet = progress.lastDay !== null && schoolDaysSince(progress.lastDay, today) >= FLAG_RULES.quietSchoolDays;
  if (quiet) return { state: 'quiet', step, daysOnStep, firstTry };
  if (progress.level !== null && progress.level === GAMES[game].top) return { state: 'top', step, daysOnStep, firstTry };
  if (progress.level !== null && daysOnStep >= FLAG_RULES.sameLevelDays) return { state: 'stuck', step, daysOnStep, firstTry };
  if (isNearly(game, progress, facts)) return { state: 'nearly', step, daysOnStep, firstTry };
  return { state: 'moving', step, daysOnStep, firstTry };
}

/** Quick looks: stages finished (0 to 7) as steps. No stuck rule. */
export function quickCellState(q: QuickLooksProgress | null | undefined, today: string): CellState {
  if (!q || (q.sessions === 0 && q.finished === 0 && !q.lastDay)) return none;
  const of = STAGES.length;
  const step = { n: q.finished, of, name: '' };
  if (q.lastDay && schoolDaysSince(q.lastDay, today) >= FLAG_RULES.quietSchoolDays) return { state: 'quiet', step, daysOnStep: 0 };
  return { state: q.finished >= of ? 'top' : 'moving', step, daysOnStep: 0 };
}

/**
 * An "Other games" cell (a game with levels that is not a stepped lesson): the number, and quiet after the same school days as
 * the other games. No stuck, nearly or top rule. `of` is the game's top, which draws a bar; without it there is just the number.
 */
export function otherCellState(cell: ProgressCell | undefined, today: string): CellState {
  if (!cell) return none;
  const step = { n: cell.value, of: cell.of ?? 0, name: '' };
  const last = cell.lastPlayed ? nzDay(Date.parse(cell.lastPlayed)) : null;
  if (last && schoolDaysSince(last, today) >= FLAG_RULES.quietSchoolDays) return { state: 'quiet', step, daysOnStep: 0 };
  return { state: 'moving', step, daysOnStep: 0 };
}

export { QUICK_LOOKS_ID };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "6 Nov" from an NZ day (YYYY-MM-DD). */
export function shortDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1] ?? ''}`.trim();
}

/** "up to step 4 on 6 Nov" for the newest move ("about 6 Nov" when it was worked out from old rounds); null when the game has none. */
export function lastMoveWords(game: FoundationalGameId, moves: readonly StepMove[] | undefined): string | null {
  const m = moves?.[0];
  const to = m ? stepOf(game, m.to) : null;
  if (!m || !to) return null;
  const from = m.from === null ? null : stepOf(game, m.from);
  const when = `${m.estimated ? 'about ' : 'on '}${shortDay(m.day)}`;
  if (!from) return `started on step ${to.n} ${when}`;
  return `${to.n > from.n ? 'up' : 'back'} to step ${to.n} ${when}`;
}

/** The small timeline, oldest first: "step 2 about 3 Nov → step 3 on 5 Nov"; null when the game has no moves. */
export function timelineWords(game: FoundationalGameId, moves: readonly StepMove[] | undefined): string | null {
  const parts = [...(moves ?? [])]
    .reverse()
    .map((m) => {
      const s = stepOf(game, m.to);
      return s ? `step ${s.n} ${m.estimated ? 'about' : 'on'} ${shortDay(m.day)}` : null;
    })
    .filter((x): x is string => x !== null);
  return parts.length > 0 ? parts.join(' → ') : null;
}
