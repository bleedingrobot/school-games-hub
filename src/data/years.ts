/**
 * Each pupil's school year (migration 20261113000200_pupil_years.sql). The pupil picks it once on their first visit
 * (components/YearQuestion.tsx); a teacher changes it on the Students tab. It replaces the class's year level.
 * Never shown to classmates.
 */
import { supabase } from '../lib/supabase';
import { FriendlyError } from './profile';

function fail(error: { code?: string; message?: string } | null, fallback: string): never {
  if (error?.code && ['22023', '42501'].includes(error.code) && error.message && !error.message.includes('permission denied')) {
    throw new FriendlyError(error.message);
  }
  throw new FriendlyError(fallback);
}

/** The years a pupil can pick: 1 to 8. A teacher can also pick 0 (new entrants). */
export const PUPIL_YEARS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export const TEACHER_YEARS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

const wholeYear = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 13 ? v : null);

export interface MyYear {
  student: boolean;
  year: number | null;
}

export function parseMyYear(raw: unknown): MyYear {
  const r = (raw ?? {}) as { student?: unknown; year?: unknown };
  return { student: r.student === true, year: wholeYear(r.year) };
}

export async function fetchMyYear(): Promise<MyYear> {
  const { data, error } = await supabase.rpc('my_year');
  if (error) fail(error, 'We couldn’t check your year.');
  return parseMyYear(data);
}

export async function saveMyYear(level: number): Promise<void> {
  const { error } = await supabase.rpc('set_my_year', { level });
  if (error) fail(error, 'We couldn’t save that. Please try again.');
}

export interface StudentYear {
  year: number;
  by: 'pupil' | 'teacher';
}

export function parseStudentYears(raw: unknown): Record<string, StudentYear> {
  const out: Record<string, StudentYear> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const r = (v ?? {}) as { year?: unknown; by?: unknown };
    const year = wholeYear(r.year);
    if (year !== null) out[id] = { year, by: r.by === 'teacher' ? 'teacher' : 'pupil' };
  }
  return out;
}

export async function fetchStudentYears(classId: string): Promise<Record<string, StudentYear>> {
  const { data, error } = await supabase.rpc('teacher_student_years', {
    target_class: classId,
  });
  if (error) fail(error, 'We couldn’t load the students’ years.');
  return parseStudentYears(data);
}

/** `null` clears it, so the pupil is asked again next time. */
export async function setStudentYear(student: string, level: number | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_student_year', {
    student,
    level,
  });
  if (error) fail(error, 'We couldn’t save that year. Please try again.');
}

export interface ClassYears {
  low: number | null;
  high: number | null;
  unknown: number;
}

export function parseClassYears(raw: unknown): Record<string, ClassYears> {
  const out: Record<string, ClassYears> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const r = (v ?? {}) as { low?: unknown; high?: unknown; unknown?: unknown };
    out[id] = {
      low: wholeYear(r.low),
      high: wholeYear(r.high),
      unknown: typeof r.unknown === 'number' && r.unknown > 0 ? Math.floor(r.unknown) : 0,
    };
  }
  return out;
}

/** The years of the class's pupils for a teacher's list. */
export async function fetchClassYears(): Promise<Record<string, ClassYears>> {
  const { data, error } = await supabase.rpc('class_years');
  if (error) fail(error, 'We couldn’t load the class years.');
  return parseClassYears(data);
}

/** "Year 0" reads as "New entrant". */
export const yearName = (year: number): string => (year === 0 ? 'New entrant' : `Year ${year}`);

/** "Year 5", "Years 4–6", or '' when nobody has a year yet. */
export function yearsText(y: ClassYears | undefined): string {
  if (!y || y.low === null || y.high === null) return '';
  return y.low === y.high ? yearName(y.low) : `Years ${y.low}–${y.high}`;
}
