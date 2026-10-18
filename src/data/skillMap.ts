/**
 * The teacher's maths views: a class's records for the skill map, one student's placement, and the focus history. Every
 * function is checked on the server, which refuses anyone who does not teach the class or the student.
 */
import { parseLadderInfo, type LadderInfo } from '../../shared/maths/place';
import type { FactStats } from '../../shared/maths/leitner';
import { supabase } from '../lib/supabase';
import { FriendlyError } from './profile';
import type { FocusBatch } from './focus';

/** Messages we wrote in the database are safe to show; anything else gets the fallback. */
function fail(error: { code?: string; message?: string } | null, fallback: string): never {
  if (error?.code && ['22023', '42501'].includes(error.code) && error.message && !error.message.includes('permission denied')) {
    throw new FriendlyError(error.message);
  }
  throw new FriendlyError(fallback);
}

export interface MapStudent {
  id: string;
  name: string;
  /** The part of their school email before the @. Teachers already see this on their other pages. */
  realName: string | null;
  ladder: LadderInfo;
  enabledTables: number[] | undefined;
  division: boolean;
  facts: FactStats[];
}

export interface ClassMap {
  classId: string;
  className: string;
  yearLevel: number | null;
  auto: boolean;
  students: MapStudent[];
}

const asNumbers = (v: unknown): number[] | undefined =>
  Array.isArray(v) && v.every((n) => Number.isInteger(n) && n >= 1 && n <= 12) ? (v as number[]) : undefined;

function parseFact(raw: unknown): FactStats | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.key !== 'string') return null;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    key: r.key,
    attempts: n(r.attempts),
    correct: n(r.correct),
    avgMs: n(r.avgMs),
    box: n(r.box),
    lastSeen: n(r.lastSeen),
    quickDays: Array.isArray(r.quickDays) ? r.quickDays.filter((d): d is string => typeof d === 'string') : [],
  };
}

/** What the database sends for a class, tidied. Anything odd is dropped rather than shown. */
export function parseClassMap(raw: unknown): ClassMap {
  const r = (raw ?? {}) as {
    class?: Record<string, unknown>;
    students?: unknown;
  };
  const c = r.class ?? {};
  const students = Array.isArray(r.students) ? r.students : [];
  return {
    classId: String(c.id ?? ''),
    className: String(c.name ?? ''),
    yearLevel: typeof c.yearLevel === 'number' ? c.yearLevel : null,
    auto: c.auto === true,
    students: students.map((s: Record<string, unknown>) => {
      const settings = (s.settings ?? {}) as Record<string, unknown>;
      return {
        id: String(s.id),
        name: String(s.name ?? ''),
        realName: typeof s.realName === 'string' && s.realName ? s.realName : null,
        ladder: parseLadderInfo(s.ladder),
        enabledTables: asNumbers(settings.enabledTables),
        division: settings.division !== false,
        facts: (Array.isArray(s.facts) ? s.facts : []).map(parseFact).filter((f): f is FactStats => f !== null),
      };
    }),
  };
}

export async function fetchClassMap(classId: string): Promise<ClassMap> {
  const { data, error } = await supabase.rpc('teacher_class_skill_map', {
    target: classId,
  });
  if (error || !data) fail(error, 'We couldn’t load the skill map.');
  return parseClassMap(data);
}

/** One student's warm-up and furthest place, for the student card. */
export async function fetchStudentLadder(student: string): Promise<LadderInfo> {
  const { data, error } = await supabase.rpc('teacher_student_ladder', {
    student,
  });
  if (error || !data) fail(error, 'We couldn’t load that student’s maths place.');
  return parseLadderInfo(data);
}

/** Clears the warm-up so it is offered again. The furthest place is kept. Returns false when there was nothing to clear. */
export async function resetPlacement(student: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('teacher_reset_placement', {
    student,
  });
  if (error) fail(error, 'We couldn’t reset that. Please try again.');
  return data === true;
}

export interface HistoryBatch extends Omit<FocusBatch, 'classId' | 'className'> {
  /** Who set it (their player name), and the part of their school email before the @. */
  setBy: string;
  setByReal: string | null;
}

/** The focuses that have ended, newest first. `since` keeps only those that ended on or after it. */
export async function fetchFocusHistory(classId: string, since: Date | null): Promise<HistoryBatch[]> {
  const { data, error } = await supabase.rpc('teacher_maths_focus_history', {
    target_class: classId,
    since: since ? since.toISOString() : null,
  });
  if (error || !Array.isArray(data)) fail(error, 'We couldn’t load the focus history.');
  return data as HistoryBatch[];
}

export interface FocusResultRow {
  id: string;
  name: string;
  /** The part of their school email before the @. Teachers already see this on their other pages. */
  realName: string | null;
  answers: number;
  correct: number;
  quick: number;
}

export interface FocusResults {
  /** The day the database began counting. Focuses that ended before it have no results, which is not the same as zero. */
  since: Date | null;
  students: FocusResultRow[];
  total: { answers: number; correct: number; quick: number };
}

const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

/** What the database sends for one focus, tidied. */
export function parseFocusResults(raw: unknown): FocusResults {
  const r = (raw ?? {}) as { since?: unknown; students?: unknown; total?: Record<string, unknown> };
  const since = typeof r.since === 'string' && !Number.isNaN(Date.parse(r.since)) ? new Date(r.since) : null;
  const students = (Array.isArray(r.students) ? r.students : []).map((s: Record<string, unknown>) => ({
    id: String(s.id),
    name: String(s.name ?? ''),
    realName: typeof s.realName === 'string' && s.realName ? s.realName : null,
    answers: count(s.answers),
    correct: count(s.correct),
    quick: count(s.quick),
  }));
  const t = r.total ?? {};
  return { since, students, total: { answers: count(t.answers), correct: count(t.correct), quick: count(t.quick) } };
}

/** How the students of one focus did while it ran. Teachers of the class only. */
export async function fetchFocusResults(batch: string): Promise<FocusResults> {
  const { data, error } = await supabase.rpc('teacher_maths_focus_results', { batch });
  if (error || !data) fail(error, 'We couldn’t load the results for this focus.');
  return parseFocusResults(data);
}
