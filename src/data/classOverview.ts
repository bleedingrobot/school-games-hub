/**
 * The Students tab and the student page (docs/TEACHER-VIEW-PLAN.md, section 4.3, stage 4). Both are checked on the server, which
 * refuses a class the teacher doesn't teach, or a student who isn't in one of their classes.
 */
import { AUTO_FOCUS, parseFocus, type MathsFocus } from '../../shared/maths/focus';
import { supabase } from '../lib/supabase';
import { FriendlyError } from './profile';

/** Messages we wrote in the database are safe to show; anything else gets the fallback. */
function fail(error: { code?: string; message?: string } | null, fallback: string): never {
  if (error?.code && ['22023', '42501'].includes(error.code) && error.message && !error.message.includes('permission denied')) {
    throw new FriendlyError(error.message);
  }
  throw new FriendlyError(fallback);
}

export interface RosterStudent {
  id: string;
  name: string;
  /** The part of their school email before the @. */
  realName: string | null;
  avatar: unknown;
  hidden: boolean;
  /** Finished games against bots and against classmates. */
  games: number;
  points: number;
  lastPlayed: string | null;
  /** The later of their last finished game and the last question they were shown (last 7 days only). */
  lastActive: string | null;
  /** Questions shown and skipped in the last 7 days. */
  shown: number;
  skipped: number;
  /** Their maths focus now, with their ladder place. */
  focus: MathsFocus;
}

const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const time = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);
const text = (v: unknown) => (typeof v === 'string' && v ? v : null);

/** What the database sends for a class, tidied. A row without an id is dropped rather than shown. */
export function parseOverview(raw: unknown): RosterStudent[] {
  const r = (raw ?? {}) as { students?: unknown };
  const rows = Array.isArray(r.students) ? r.students : [];
  return rows
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object' && typeof (s as { id?: unknown }).id === 'string')
    .map((s) => ({
      id: s.id as string,
      name: String(s.name ?? ''),
      realName: text(s.realName),
      avatar: s.avatar ?? {},
      hidden: s.hidden === true,
      games: count(s.games),
      points: count(s.points),
      lastPlayed: time(s.lastPlayed),
      lastActive: time(s.lastActive),
      shown: count(s.shown),
      skipped: count(s.skipped),
      focus: s.focus ? parseFocus(s.focus) : AUTO_FOCUS,
    }));
}

/** Every student in one class, with their week and their maths. */
export async function fetchClassOverview(classId: string): Promise<RosterStudent[]> {
  const { data, error } = await supabase.rpc('teacher_class_overview', { target_class: classId });
  if (error || !data) fail(error, 'We couldn’t load this class’s students.');
  return parseOverview(data);
}

export interface StudentCard {
  id: string;
  name: string;
  realName: string | null;
  avatar: unknown;
  role: 'student' | 'teacher';
  hidden: boolean;
  classes: { id: string; name: string }[];
  /** Null for a teacher. */
  focus: MathsFocus | null;
  week: { shown: number; skipped: number };
}

export function parseStudentCard(raw: unknown): StudentCard | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string') return null;
  const week = (r.week ?? {}) as Record<string, unknown>;
  return {
    id: r.id,
    name: String(r.name ?? ''),
    realName: text(r.realName),
    avatar: r.avatar ?? {},
    role: r.role === 'teacher' ? 'teacher' : 'student',
    hidden: r.hidden === true,
    classes: (Array.isArray(r.classes) ? r.classes : [])
      .filter((c): c is { id: string; name: unknown } => !!c && typeof c === 'object' && typeof (c as { id?: unknown }).id === 'string')
      .map((c) => ({ id: c.id, name: String(c.name ?? '') })),
    focus: r.role === 'teacher' ? null : r.focus ? parseFocus(r.focus) : AUTO_FOCUS,
    week: { shown: count(week.shown), skipped: count(week.skipped) },
  };
}

/** The top of the student page. */
export async function fetchStudentCard(student: string): Promise<StudentCard> {
  const { data, error } = await supabase.rpc('teacher_student_card', { student });
  const card = error ? null : parseStudentCard(data);
  if (!card) fail(error, 'We couldn’t load that student.');
  return card;
}
