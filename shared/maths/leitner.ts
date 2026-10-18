/**
 * Mastery boxes (the Leitner system). Every fact sits in box 0–4:
 * correct and quick moves it up one box, correct but slow keeps it where it is, and wrong
 * drops it to box 1. A fact only reaches box 4 ("fluent") once it has been answered
 * quickly and correctly on at least two different days, so one lucky lesson isn't enough.
 */
import { FLUENT_DAYS, QUICK_MS, TOP_BOX } from './config';

export interface FactStats {
  key: string;
  attempts: number;
  correct: number;
  /** Average time to answer, in milliseconds. */
  avgMs: number;
  box: number;
  /** When it was last asked (milliseconds since 1970). */
  lastSeen: number;
  /** The most recent New Zealand days (YYYY-MM-DD) it was answered quickly and correctly. */
  quickDays: string[];
}

/** One answer, as saved: the record is rebuilt from these on the server. */
export interface FactAnswer {
  key: string;
  correct: boolean;
  /** Time to answer, in milliseconds. */
  ms: number;
  /** When (milliseconds since 1970). */
  at: number;
}

export type Mastery = 'not-tried' | 'learning' | 'secure' | 'fluent';

export function newStats(key: string): FactStats {
  return { key, attempts: 0, correct: 0, avgMs: 0, box: 0, lastSeen: 0, quickDays: [] };
}

const nzDayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' });

/** The New Zealand date of a moment, as YYYY-MM-DD. */
export const nzDay = (at: number) => nzDayFormat.format(new Date(at));

/** The stats after one answer. Doesn't change the stats it's given. */
export function afterAnswer(stats: FactStats, correct: boolean, ms: number, at: number, quickMs: number = QUICK_MS): FactStats {
  const attempts = stats.attempts + 1;
  const next: FactStats = {
    ...stats,
    attempts,
    correct: stats.correct + (correct ? 1 : 0),
    avgMs: Math.round(stats.avgMs + (ms - stats.avgMs) / attempts),
    lastSeen: at,
    quickDays: [...stats.quickDays],
  };
  if (!correct) {
    next.box = 1;
    return next;
  }
  if (ms > quickMs) return next;
  const day = nzDay(at);
  if (!next.quickDays.includes(day)) next.quickDays = [...next.quickDays, day].slice(-FLUENT_DAYS);
  const canBeFluent = next.quickDays.length >= FLUENT_DAYS;
  next.box = Math.min(stats.box + 1, canBeFluent ? TOP_BOX : TOP_BOX - 1);
  return next;
}

/** In words, for the teacher's grid: never asked, learning (boxes 0–1), secure (2–3) or fluent (4). */
export function mastery(stats: FactStats | undefined): Mastery {
  if (!stats || stats.attempts === 0) return 'not-tried';
  if (stats.box >= TOP_BOX) return 'fluent';
  return stats.box >= 2 ? 'secure' : 'learning';
}
