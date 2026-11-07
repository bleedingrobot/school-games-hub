/**
 * The ten shiny things on Parrot's bell rope: one changes on each NZ day a child finishes the challenge, bronze for days 1
 * to 10, silver for 11 to 20 and gold for 21 to 30 (docs/PARROT-PLAN.md). Days are counted, not dates, so a missed day loses
 * nothing. Built on the kit's day arc (shared/kit/dayArc.ts).
 */
import { arcAfter, daysPerReward, finishDay, nzDate, type DayMetal } from '../kit/dayArc';
import { FRIENDS, THINGS, type Friend } from './config';

export { nzDate };
export const METALS = ['bud', 'bronze', 'silver', 'gold'] as const;
export type Metal = (typeof METALS)[number];
export const DAYS_PER_BELL = daysPerReward(THINGS);

export interface Rope {
  /** Golden Bells won so far. */
  bells: number;
  friend: Friend;
  day: number;
  things: Metal[];
  today: DayMetal;
}

export function ropeAfter(daysDone: number): Rope {
  const a = arcAfter<'bud', Friend>(daysDone, { items: THINGS, base: 'bud', friends: FRIENDS });
  return { bells: a.rewards, friend: a.friend, day: a.day, things: a.row, today: a.today };
}

export interface FinishResult {
  daysDone: number;
  lastDay: string | null;
  /** Which shiny thing changed (0 is the first), or null when one already changed today. */
  changed: number | null;
  goldenBell: boolean;
}

export function finishChallenge(daysDone: number, lastDay: string | null, today: string): FinishResult {
  const f = finishDay(daysDone, lastDay, today, THINGS);
  return { daysDone: f.daysDone, lastDay: f.lastDay, changed: f.changed, goldenBell: f.reward };
}
