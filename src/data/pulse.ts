/**
 * Games Hub Pulse for teachers (/teacher/:classId/pulse): how the whole school is using the hub, live, in one request
 * (teacher_pulse, migration 20261127074205_teacher_pulse.sql). Counts only: no pupil names.
 */
import { supabase } from '../lib/supabase';

export interface PulseKpis {
  pupils: number;
  activeToday: number;
  active7: number;
  activePrev7: number;
  active28: number;
  activeEver: number;
  playsToday: number;
  plays7: number;
  playsPrev7: number;
  playsEver: number;
  /** Goes in the last 7 days, Monday to Friday 9 am to 3 pm NZ. */
  schoolHours7: number;
  outsideHours7: number;
}

export interface PulseDay {
  d: string;
  plays: number;
  players: number;
  answered: number;
  correct: number;
}

/** One game's goes (see the migration for what one "go" is in each game). */
export interface PulseGame {
  id: string;
  today: number;
  plays7: number;
  playsPrev7: number;
  players7: number;
  plays28: number;
  playsEver: number;
  playersEver: number;
  firstAt: string | null;
  lastAt: string | null;
}

/** A Class Live game (its LIVE_GAMES id; Showdown arenas are `showdown-<arena>`). */
export interface PulseLive {
  id: string;
  sessions: number;
  sessions28: number;
  pupils: number;
  joins: number;
  lastAt: string | null;
}

export interface PulseClass {
  id: string;
  name: string;
  students: number;
  playing7: number;
  plays7: number;
  playsPrev7: number;
}

export interface PulseHour {
  h: number;
  weekday: number;
  weekend: number;
}

export interface PulseAnswers {
  source: string;
  answered: number;
  correct: number;
  week: number;
  weekCorrect: number;
  today: number;
}

export interface Pulse {
  asOf: string;
  today: string;
  kpis: PulseKpis;
  daily: PulseDay[];
  games: PulseGame[];
  live: PulseLive[];
  classes: PulseClass[];
  hours: PulseHour[];
  answers: PulseAnswers[];
}

export async function fetchPulse(): Promise<Pulse> {
  const { data, error } = await supabase.rpc('teacher_pulse');
  if (error || !data || typeof data !== 'object') throw new Error('We couldn’t load the Pulse.');
  const p = data as Pulse;
  return {
    ...p,
    daily: p.daily ?? [],
    games: p.games ?? [],
    live: p.live ?? [],
    classes: p.classes ?? [],
    hours: p.hours ?? [],
    answers: (p.answers ?? []).map((a) => ({ ...a, answered: Number(a.answered), correct: Number(a.correct), week: Number(a.week), weekCorrect: Number(a.weekCorrect), today: Number(a.today) })),
  };
}

/** answer_totals sources, in teachers' words. */
export const ANSWER_KINDS: Record<string, string> = {
  training: 'Basic facts training',
  'early-facts': 'Early number facts (Foundational games)',
  'add-sub': 'Adding and subtracting',
  'times-tables': 'Times tables',
  division: 'Division',
  generated: 'Maths ladder questions',
  'place-value': 'Place value',
  fractions: 'Fractions',
  decimals: 'Decimals',
  money: 'Money',
  patterns: 'Patterns',
  'clan-quest': 'Clan Quest questions',
};

export const answerKind = (source: string) => ANSWER_KINDS[source] ?? source.replace(/-/g, ' ');
