/**
 * Reading the basic facts check (shared/training/check.ts, docs/FACTS-CHECK-PLAN.md). Saving goes through the training queue
 * (enqueueCheck in ./training.ts), so a check finished with the Wi-Fi down is not lost.
 */
import { CHECK_CONFIG, CHECK_VERSION, type CheckSummary } from '../../shared/training/check';
import { supabase } from '../lib/supabase';

export interface MyFactsCheck {
  due: boolean;
  count: number;
  last: { at: string; right: number; quick: number } | null;
}

/** For the pupil: is a check due? If it can't be asked (offline, no school), no check is due. */
export async function fetchMyFactsCheck(): Promise<MyFactsCheck> {
  const { data, error } = await supabase.rpc('my_facts_check', {
    version: CHECK_VERSION,
    every_days: CHECK_CONFIG.everyDays,
    from_year: CHECK_CONFIG.fromYear,
  });
  if (error || !data) return { due: false, count: 0, last: null };
  return data as MyFactsCheck;
}

export interface CheckPupil {
  id: string;
  name: string;
  realName: string;
  year: number | null;
  /** Oldest first. */
  checks: CheckSummary[];
}

/** For the teacher: every pupil in the class with their checks. */
export async function fetchClassFactsChecks(classId: string): Promise<CheckPupil[]> {
  const { data, error } = await supabase.rpc('teacher_facts_checks', { target_class: classId, version: CHECK_VERSION });
  if (error) throw error;
  return (data ?? []) as CheckPupil[];
}
