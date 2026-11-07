/**
 * The ten berry baskets by Robin's nest: one changes on each NZ day a child finishes the challenge, plain for a start, then
 * bronze for days 1 to 10, silver for 11 to 20 and gold for 21 to 30 (docs/ROBIN-PLAN.md). Days are counted, not dates, so a
 * missed day loses nothing. Built on the kit's day arc (shared/kit/dayArc.ts). Also where a child's place moves.
 */
import { arcAfter, daysPerReward, finishDay, nzDate, type DayMetal } from '../kit/dayArc';
import { fadeAfter, type Place } from '../kit/help';
import { BASKETS, FRIENDS, PASS_GOOD, STEP_RULES, type Friend } from './config';

export { nzDate };
export const METALS = ['plain', 'bronze', 'silver', 'gold'] as const;
export type Metal = (typeof METALS)[number];
export const DAYS_PER_FEAST = daysPerReward(BASKETS);

export interface Row {
  /** Golden Berry Feasts won so far. */
  feasts: number;
  friend: Friend;
  day: number;
  baskets: Metal[];
  today: DayMetal;
}

export function basketsAfter(daysDone: number): Row {
  const a = arcAfter<'plain', Friend>(daysDone, { items: BASKETS, base: 'plain', friends: FRIENDS });
  return { feasts: a.rewards, friend: a.friend, day: a.day, baskets: a.row, today: a.today };
}

export interface FinishResult {
  daysDone: number;
  lastDay: string | null;
  /** Which basket changed (0 is the first), or null when one already changed today. */
  changed: number | null;
  feast: boolean;
}

export function finishChallenge(daysDone: number, lastDay: string | null, today: string): FinishResult {
  const f = finishDay(daysDone, lastDay, today, BASKETS);
  return { daysDone: f.daysDone, lastDay: f.lastDay, changed: f.changed, feast: f.reward };
}

/**
 * Where a child is after a counted challenge with `right` goes right at the first tap. Like the kit's `placeAfter`, except the
 * help fades on 7 or more right (FADE_GOOD) and a step is passed on 8 or more (PASS_GOOD), as the plan sets for four to six year olds.
 */
export function placeAfter(p: Place, right: number): Place {
  const rules = STEP_RULES;
  const fade = fadeAfter(p, right, rules);
  const goodAtStep = right >= PASS_GOOD ? p.goodAtStep + 1 : p.goodAtStep;
  if (goodAtStep < rules.goodToPass || p.step >= rules.topStep) return { step: p.step, level: fade.level, goodInRow: fade.goodInRow, goodAtStep };
  const level = Math.min(rules.topLevel, fade.faded ? fade.level : fade.level + rules.newStepHelp);
  return { step: p.step + 1, level: Math.max(rules.newStepLevel, level), goodInRow: 0, goodAtStep: 0 };
}
