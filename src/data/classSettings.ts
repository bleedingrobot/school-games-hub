/**
 * Reading the settings of one class for the Teacher page's class picker.
 *
 * A student (or a teacher with no picker) reads the one settings row that applies to them straight from the table; the
 * database only lets them see that one. That row is read whole (a signed-in person may read every column) and remembered
 * for 5 minutes (settingsMemory.ts), so every switch on every page shares one request. A teacher who has picked a class
 * reads that class's row fresh each time, through a function that checks they teach it. Either way the caller gets the
 * row, or null if it could not be read.
 */
import { supabase } from '../lib/supabase';
import { forgetSettings, rememberedSettings, type SettingsRow } from './settingsMemory';

export type { SettingsRow };

/** `columns` are the ones the caller uses; with no class picked the whole row comes back (it is shared by every caller). */
export async function readSettings(_columns: string[], classId?: string | null): Promise<SettingsRow | null> {
  if (classId) {
    const { data, error } = await supabase.rpc('teacher_class_settings', { target_class: classId });
    if (error || !data || typeof data !== 'object') return null;
    return data as SettingsRow;
  }
  return rememberedSettings(async () => {
    const { data, error } = await supabase.from('app_settings').select('*').maybeSingle();
    if (error || !data) return null;
    return data as unknown as SettingsRow;
  });
}

/** Whether students in this class may pick their own maths focus (the switch is on unless it was turned off). */
export async function fetchStudentsChooseFocus(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['students_choose_focus'], classId);
  return row?.students_choose_focus !== false;
}

export async function saveStudentsChooseFocus(enabled: boolean, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_students_choose_focus', { enabled, target_class: classId ?? null });
  forgetSettings();
  if (error) throw new Error(error.message);
}

/** Whether the games pick the maths from the whole ladder (auto) for students with no focus. Off unless the teacher turned it on. */
export async function fetchMathsAuto(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['maths_auto'], classId);
  return row?.maths_auto === true;
}

export async function saveMathsAuto(enabled: boolean, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_maths_auto', { enabled, target_class: classId ?? null });
  forgetSettings();
  if (error) throw new Error(error.message);
}
