/**
 * The teacher's Foundational views (docs/plans/maths-review/R7-teacher-foundational-view.md): one class's progress in the six
 * junior games, Quick looks, and every pupil's facts (the skill map's own call). All three are checked on the server, which
 * refuses anyone who does not teach the class (migration 20261107000100). `foundationalClass` asks them together and shares
 * the answer for a few seconds, so Today's alerts and "Hardest right now" make one set of requests, not one for each game.
 */
import { quickAnswersFrom, unpackSettings } from '../../shared/subitising/saved';
import { supabase } from '../lib/supabase';
import { shortCache } from '../teacher/shortCache';
import { FriendlyError } from './profile';
import { fetchClassMap, type ClassMap } from './skillMap';

export const GAME_IDS = ['beanstalk', 'hop', 'korora', 'pipi', 'tui', 'weka', 'pigeon', 'parrot', 'lizard', 'swamphen', 'robin'] as const;
export type FoundationalGameId = (typeof GAME_IDS)[number];

/** One finished challenge. */
export interface RecentChallenge {
  /** The NZ day, YYYY-MM-DD. */
  day: string;
  wrong: number;
  taps: number;
  level: number | null;
}

/** One pupil in one game. */
export interface GameProgress {
  daysDone: number;
  lastDay: string | null;
  /** Reached level or step; null for Beanstalk. */
  level: number | null;
  /** Latest first, at most 10. */
  recent: RecentChallenge[];
}

/** Quick looks for one pupil, from the Training student row and the counted answers. */
export interface QuickLooksProgress {
  /** Stages finished, 0 to 7. */
  finished: number;
  placed: boolean;
  guided: boolean;
  sessions: number;
  answered: number;
  correct: number;
  last30: number;
  lastDay: string | null;
}

export interface FoundationalPupil {
  games: Partial<Record<FoundationalGameId, GameProgress>>;
  quickLooks: QuickLooksProgress | null;
}

export interface FoundationalClass {
  map: ClassMap;
  /** By pupil id: every pupil of the class. One who has played nothing has no games and no Quick looks. */
  pupils: Map<string, FoundationalPupil>;
}

const whole = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const day = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const object = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** One game's progress as the database sends it, or null if it isn't one. */
export function parseGame(raw: unknown): GameProgress | null {
  const r = object(raw);
  if (!('daysDone' in r)) return null;
  const recent = (Array.isArray(r.recent) ? r.recent : []).map((c): RecentChallenge | null => {
    const o = object(c);
    const d = day(o.d);
    return d ? { day: d, wrong: whole(o.m), taps: whole(o.t), level: typeof o.l === 'number' ? o.l : null } : null;
  });
  return {
    daysDone: whole(r.daysDone),
    lastDay: day(r.lastDay),
    level: typeof r.level === 'number' ? r.level : null,
    recent: recent.filter((c): c is RecentChallenge => c !== null),
  };
}

/** One pupil's Quick looks as the database sends it, or null if they have not used it. */
export function parseQuickLooks(raw: unknown): QuickLooksProgress | null {
  const r = object(raw);
  if (Object.keys(r).length === 0) return null;
  const q = object(r.q);
  const recent = object(r.recent);
  return {
    finished: Math.min(whole(q.f), 7),
    placed: q.p === 1,
    guided: q.g === 1,
    sessions: whole(r.sessions),
    answered: whole(recent.answered),
    correct: whole(recent.correct),
    last30: whole(r.last30),
    lastDay: day(r.lastDay),
  };
}

/** The two new calls' answers put together by pupil. */
export function parseFoundational(games: unknown, quick: unknown): Map<string, FoundationalPupil> {
  const g = object(games);
  const q = object(quick);
  const pupils = new Map<string, FoundationalPupil>();
  for (const id of new Set([...Object.keys(g), ...Object.keys(q)])) {
    const mine = object(g[id]);
    const played: FoundationalPupil['games'] = {};
    for (const game of GAME_IDS) {
      const progress = parseGame(mine[game]);
      if (progress) played[game] = progress;
    }
    pupils.set(id, { games: played, quickLooks: parseQuickLooks(q[id]) });
  }
  return pupils;
}

const message = 'We couldn’t load the Foundational skills for this class.';

async function call(fn: 'teacher_foundational_class' | 'teacher_quick_looks_class', classId: string): Promise<unknown> {
  const { data, error } = await supabase.rpc(fn, { target: classId });
  if (error || !data) {
    if (error?.code === '42501' && error.message && !error.message.includes('permission denied')) throw new FriendlyError(error.message);
    throw new FriendlyError(message);
  }
  return data;
}

/** The skill map's own call (every pupil's facts), shared for a few seconds with whoever else asks. */
export const classFacts = (classId: string): Promise<ClassMap> => shortCache(`skill-map:${classId}`, () => fetchClassMap(classId));

/** The six games' progress alone (no pupils' facts), for a page that needs only that: Beanstalk's Games table line. */
export const classGames = (classId: string): Promise<unknown> => shortCache(`foundational-games:${classId}`, () => call('teacher_foundational_class', classId));

export async function fetchFoundationalClass(classId: string): Promise<FoundationalClass> {
  const [map, games, quick] = await Promise.all([classFacts(classId), classGames(classId), call('teacher_quick_looks_class', classId)]);
  return { map, pupils: parseFoundational(games, quick) };
}

/** The same answer for everyone who asks within a few seconds (Today asks once for each game). */
export const foundationalClass = (classId: string): Promise<FoundationalClass> => shortCache(`foundational:${classId}`, () => fetchFoundationalClass(classId));

/** One pupil's Quick looks for their page: the settings that follow them, and how the last counted pictures went. */
export interface QuickLooksStudent {
  /** Never used it: no settings saved and no pictures answered. */
  used: boolean;
  placed: boolean;
  startStage: number;
  /** Stages finished in a row, 0 to 7. */
  finished: number;
  /** "Keeps the picture on the screen" (no flashing). */
  guided: boolean;
  sessions: number;
  /** The newest counted pictures (up to `recent`), not counting ones the pupil was helped with. */
  answered: number;
  correct: number;
}

/** From `teacher_training_student`'s answer. Pure, so it is tested without a database. */
export function parseQuickLooksStudent(raw: unknown, recent: number): QuickLooksStudent {
  const r = object(raw);
  const student = object(r.student);
  const settings = unpackSettings(object(student.typing).q);
  const answers = quickAnswersFrom(
    (Array.isArray(r.answers) ? r.answers : []).map((a) => {
      const o = object(a);
      return { key: typeof o.key === 'string' ? o.key : '', correct: o.correct === true, at: whole(o.at) };
    }),
  ).filter((a) => !a.helped);
  const newest = answers.slice(-recent);
  return {
    used: settings !== null || answers.length > 0,
    placed: settings?.placed ?? false,
    startStage: settings?.startStage ?? 1,
    finished: settings?.finished ?? 0,
    guided: settings?.guided ?? false,
    sessions: whole(student.sessionsDone),
    answered: newest.length,
    correct: newest.filter((a) => a.correct).length,
  };
}

/** The teacher's read of one pupil's Quick looks (the existing `teacher_training_student`, which checks the teacher teaches them). */
export async function fetchQuickLooksStudent(studentId: string, recent: number): Promise<QuickLooksStudent> {
  const { data, error } = await supabase.rpc('teacher_training_student', { student: studentId });
  if (error) throw new FriendlyError('We couldn’t load Quick looks for this student.');
  return parseQuickLooksStudent(data, recent);
}
