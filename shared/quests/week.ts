/**
 * A quest week, worked out the same way as the database (dates are New Zealand dates, 'YYYY-MM-DD').
 * Pure: the bar and the teacher's table both draw from this.
 */
import { DAYS_IN_QUEST } from './kinds';

export type DayState = 'done' | 'today' | 'missed' | 'later';

export interface QuestWeek {
  /** Each of the 7 days, in order. */
  days: { date: string; state: DayState }[];
  done: number;
  needed: number;
  /** Days still to play, today included when it isn't done yet. */
  left: number;
  /** Today is one of the quest's days. */
  running: boolean;
  /** No longer possible to reach `needed` (only said while the quest is running). */
  outOfReach: boolean;
}

/** 'YYYY-MM-DD' plus n days. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function questWeek(startsOn: string, today: string, doneDates: string[], needed: number): QuestWeek {
  const done = new Set(doneDates);
  const days = Array.from({ length: DAYS_IN_QUEST }, (_, n) => {
    const date = addDays(startsOn, n);
    const state: DayState = done.has(date) ? 'done' : date === today ? 'today' : date < today ? 'missed' : 'later';
    return { date, state };
  });
  const count = days.filter((d) => d.state === 'done').length;
  const left = days.filter((d) => d.state === 'today' || d.state === 'later').length;
  const running = days.some((d) => d.date === today);
  return { days, done: count, needed, left, running, outOfReach: running && count + left < needed };
}

/** Short weekday name for a date ('Mon'). */
export function weekday(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}
