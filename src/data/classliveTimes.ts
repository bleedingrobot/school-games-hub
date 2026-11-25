/**
 * Class Live times (docs/plans/classlive-auto/PLAN.md): the times a school's Class Live games start by themselves. School admins only;
 * the database checks every call.
 */
import { supabase } from '../lib/supabase';
import { FriendlyError } from './profile';

/** Messages we wrote in the database are safe to show; anything else gets the fallback. */
function fail(error: { code?: string; message?: string } | null, fallback: string): never {
  if (error?.code && ['22023', '42501'].includes(error.code) && error.message && !error.message.includes('permission denied')) {
    throw new FriendlyError(error.message);
  }
  throw new FriendlyError(fallback);
}

export type ClassLiveActivity = 'serpent' | 'mural' | 'corners' | 'shark' | 'ghost' | 'clash' | 'thrones' | 'lava';

export interface ClassLiveTime {
  id: number | null;
  /** ISO weekdays: 1 Monday to 7 Sunday. */
  days: number[];
  /** 'HH:MM', NZ time. */
  at: string;
  activity: ClassLiveActivity;
  length: 2 | 3 | 5 | 10 | 15;
  /** Fewest players. */
  min: number;
  /** Minutes before the start that the pop-up opens. */
  open: number;
  host: string;
  level: string | null;
  on: boolean;
}

const LENGTHS = [2, 3, 5, 10, 15] as const;
const ACTIVITIES: ClassLiveActivity[] = ['serpent', 'mural', 'corners', 'shark', 'ghost', 'clash', 'thrones', 'lava'];
const clamp = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback;

/** One row, or null when it is too broken to show. */
function parseOne(raw: unknown): ClassLiveTime | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'number' || !Number.isInteger(r.id)) return null;
  if (typeof r.at !== 'string' || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(r.at)) return null;
  if (!ACTIVITIES.includes(r.activity as ClassLiveActivity)) return null;
  const days = [...new Set((Array.isArray(r.days) ? r.days : []).filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7))].sort();
  if (days.length === 0) return null;
  const length = LENGTHS.find((l) => l === r.length) ?? 5;
  return {
    id: r.id,
    days,
    at: r.at,
    activity: r.activity as ClassLiveActivity,
    length,
    min: clamp(r.min, 2, 40, 6),
    open: clamp(r.open, 1, 15, 3),
    host: typeof r.host === 'string' && r.host.trim() ? r.host.trim().slice(0, 30) : 'Games Hub',
    level: typeof r.level === 'string' && r.level ? r.level : null,
    on: r.on !== false,
  };
}

/** Every good row; bad rows are left out. */
export function parseClassLiveTimes(raw: unknown): ClassLiveTime[] {
  return (Array.isArray(raw) ? raw : []).map(parseOne).filter((t): t is ClassLiveTime => t !== null);
}

export async function fetchClassLiveTimes(): Promise<ClassLiveTime[]> {
  const { data, error } = await supabase.rpc('classlive_times_list');
  if (error) fail(error, 'We couldn’t load the times.');
  return parseClassLiveTimes(data);
}

export async function saveClassLiveTime(t: ClassLiveTime): Promise<number> {
  const { data, error } = await supabase.rpc('classlive_times_save', { one: t });
  if (error || typeof data !== 'number') fail(error, 'We couldn’t save that time.');
  return data as number;
}

export async function removeClassLiveTime(id: number): Promise<void> {
  const { error } = await supabase.rpc('classlive_times_remove', { target: id });
  if (error) fail(error, 'We couldn’t remove that time.');
}
