/**
 * A pupil's place in Order Up!: the highest level passed and, per level, how much help they get (docs/ORDERUP-PLAN.md,
 * "Help that follows the child", LEARNING-DESIGN rule 5). Pure, so the server and the preview agree.
 */
import { ORDERUP } from './config';

/** 'full': the order card points to each step's rule first. 'plain': the ladder only. 'hints': hints, never the glow. */
export type Help = 'full' | 'plain' | 'hints';
/** The teacher's setting: help fades (default), always full, or hints only. */
export type HelpSetting = 'fade' | 'always' | 'hints';
export const HELP_SETTINGS: readonly HelpSetting[] = ['fade', 'always', 'hints'];

export interface LevelState {
  /** Fading help: 'full' or 'plain'. */
  help: 'full' | 'plain';
  /** NZ days with a passed set since help last stepped up. */
  goodDays: string[];
  /** Hard sets in a row (the teacher's "stuck" mark at 3). */
  hardInRow: number;
}

export interface Progress {
  /** The highest level passed (0: none yet). */
  passed: number;
  levels: Record<string, LevelState>;
}

export const unplayed = (): Progress => ({ passed: 0, levels: {} });

export const levelState = (p: Progress, level: number): LevelState => p.levels[String(level)] ?? { help: 'full', goodDays: [], hardInRow: 0 };

/** The help for a new set at this level, after the teacher's setting. */
export function helpFor(p: Progress, level: number, setting: HelpSetting): Help {
  if (setting === 'always') return 'full';
  if (setting === 'hints') return 'hints';
  return levelState(p, level).help;
}

/** The levels a pupil may open: every one passed, and the next (up to the levels that are live). */
export const openUpTo = (p: Progress, live: number) => Math.min(Math.max(1, p.passed + 1), live);

export interface SetResult {
  progress: Progress;
  passedSet: boolean;
  newLevel: boolean;
}

/**
 * After a finished set: passing moves `passed` on (replays never move it down); help steps down after passed sets on
 * two different days and back up after a hard set.
 */
export function afterSet(p: Progress, level: number, goodBags: number, today: string): SetResult {
  const passedSet = goodBags >= ORDERUP.passBags;
  const hard = goodBags <= ORDERUP.hardSetBags;
  const s = levelState(p, level);
  let next: LevelState = { ...s, goodDays: [...s.goodDays] };
  if (passedSet && !next.goodDays.includes(today)) next.goodDays.push(today);
  if (next.goodDays.length >= 2) next.help = 'plain';
  if (hard) next = { help: 'full', goodDays: [], hardInRow: s.hardInRow + 1 };
  else next.hardInRow = 0;
  const passed = passedSet ? Math.max(p.passed, level) : p.passed;
  return { progress: { passed, levels: { ...p.levels, [String(level)]: next } }, passedSet, newLevel: passed > p.passed };
}
