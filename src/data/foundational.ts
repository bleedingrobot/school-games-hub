/**
 * The teacher's Foundational views (docs/plans/maths-review/R7-teacher-foundational-view.md): one class's progress in the six
 * junior games, Quick looks, and every pupil's facts (the skill map's own call). All three are checked on the server, which
 * refuses anyone who does not teach the class (migration 20261107000100). `foundationalClass` asks them together and shares
 * the answer for a few seconds, so Today's alerts and "Hardest right now" make one set of requests, not one for each game.
 */
import { parseKey } from '../../shared/subitising/keys';
import { quickAnswersFrom, unpackSettings } from '../../shared/subitising/saved';
import { supabase } from '../lib/supabase';
import { shortCache } from '../teacher/shortCache';
import { FriendlyError } from './profile';
import { fetchClassMap, type ClassMap } from './skillMap';

export const GAME_IDS = ['robin', 'pipi', 'beanstalk', 'korora', 'tui', 'weka', 'parrot', 'hop', 'lizard', 'pigeon', 'swamphen'] as const;
export type FoundationalGameId = (typeof GAME_IDS)[number];

/** One finished challenge. */
export interface RecentChallenge {
  /** The NZ day, YYYY-MM-DD. */
  day: string;
  wrong: number;
  taps: number;
  level: number | null;
  /** Goes right at the first tap (P8); left out when the game can't say. */
  firstRight?: number;
  /** The median time to the first tap of a go, in milliseconds (P8); left out when it can't be told. */
  ms?: number;
}

/** One move to a new step, from the step history (P9). The steps are the game's saved values (Hop's 10/5/2/3/4/200); turn them with stepOf. */
export interface StepMove {
  /** The saved value before; null when there was none (a first step). */
  from: number | null;
  to: number;
  /** The NZ day, YYYY-MM-DD. */
  day: string;
  /** Worked out from old rounds, not seen as it happened, so the day is about right. */
  estimated: boolean;
}

/** One pupil in one game. */
export interface GameProgress {
  daysDone: number;
  lastDay: string | null;
  /** Reached level or step; null for Beanstalk. */
  level: number | null;
  /** Good goes so far at this step (step games only; the next step comes at the game's goodToPass), else null. */
  good: number | null;
  /** The NZ day (YYYY-MM-DD) the current step began, from all the rounds kept; null when not known. */
  since: string | null;
  /** Latest first, at most 10. */
  recent: RecentChallenge[];
  /** The last 5 moves to a new step, newest first (P9); empty or missing before step history started. */
  moves?: StepMove[];
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
    if (!d) return null;
    const challenge: RecentChallenge = { day: d, wrong: whole(o.m), taps: whole(o.t), level: typeof o.l === 'number' ? o.l : null };
    if (typeof o.f === 'number' && Number.isFinite(o.f) && o.f >= 0) challenge.firstRight = Math.floor(o.f);
    if (typeof o.ms === 'number' && Number.isFinite(o.ms) && o.ms > 0) challenge.ms = o.ms;
    return challenge;
  });
  const moves = (Array.isArray(r.moves) ? r.moves : []).map((m): StepMove | null => {
    const o = object(m);
    const d = day(o.at);
    if (!d || typeof o.to !== 'number') return null;
    return { from: typeof o.from === 'number' ? o.from : null, to: o.to, day: d, estimated: o.est === true };
  });
  return {
    daysDone: whole(r.daysDone),
    lastDay: day(r.lastDay),
    level: typeof r.level === 'number' ? r.level : null,
    good: typeof r.good === 'number' && Number.isFinite(r.good) && r.good >= 0 ? Math.floor(r.good) : null,
    since: day(r.since),
    recent: recent.filter((c): c is RecentChallenge => c !== null),
    moves: moves.filter((m): m is StepMove => m !== null),
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
  /** The usual slip among the newest wrong pictures: 'over' (too many), 'under' (too few) or 'near' (one away); null until one was seen {@link SLIP_MIN} times. */
  slip: QuickSlip | null;
}

export type QuickSlip = 'over' | 'under' | 'near';
/** How many times a slip must show among the newest counted pictures before it is called usual. */
export const SLIP_MIN = 3;
/** The teacher's words for each slip. */
export const QUICK_SLIP_WORDS: Record<QuickSlip, string> = { over: 'says too many', under: 'says too few', near: 'is one away' };

/** The kind of a wrong answer: one away beats too many or too few. Null for a key that is not a picture, or a right answer. */
export function quickSlipOf(key: string, given: number): QuickSlip | null {
  const parsed = parseKey(key);
  if (!parsed || given === parsed.answer) return null;
  return Math.abs(given - parsed.answer) === 1 ? 'near' : given > parsed.answer ? 'over' : 'under';
}

/** The commonest slip, only when seen at least `min` times (the same idea as shared/kit/slips.ts topSlip, kept inline here). */
export function commonest(slips: QuickSlip[], min = SLIP_MIN): QuickSlip | null {
  const counts = new Map<QuickSlip, number>();
  for (const s of slips) counts.set(s, (counts.get(s) ?? 0) + 1);
  const [top] = [...counts].sort((a, b) => b[1] - a[1]);
  return top && top[1] >= min ? top[0] : null;
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
  // The newest counted pictures (not helped ones) that were wrong, with the number each child gave.
  const counted = (Array.isArray(r.answers) ? r.answers : [])
    .map((x, i) => ({ o: object(x), i }))
    .filter(({ o }) => typeof o.key === 'string' && parseKey(o.key) && !parseKey(o.key)!.helped)
    .sort((p, q) => whole(p.o.at) - whole(q.o.at) || p.i - q.i)
    .slice(-recent);
  const slips = counted
    .filter(({ o }) => o.correct !== true && typeof o.given === 'number')
    .map(({ o }) => quickSlipOf(o.key as string, o.given as number))
    .filter((x): x is QuickSlip => x !== null);
  return {
    used: settings !== null || answers.length > 0,
    placed: settings?.placed ?? false,
    startStage: settings?.startStage ?? 1,
    finished: settings?.finished ?? 0,
    guided: settings?.guided ?? false,
    sessions: whole(student.sessionsDone),
    answered: newest.length,
    correct: newest.filter((a) => a.correct).length,
    slip: commonest(slips),
  };
}

/** The teacher's read of one pupil's Quick looks (the existing `teacher_training_student`, which checks the teacher teaches them). */
export async function fetchQuickLooksStudent(studentId: string, recent: number): Promise<QuickLooksStudent> {
  const { data, error } = await supabase.rpc('teacher_training_student', { student: studentId });
  if (error) throw new FriendlyError('We couldn’t load Quick looks for this student.');
  return parseQuickLooksStudent(data, recent);
}
