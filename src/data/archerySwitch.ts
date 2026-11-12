/** Archery Challenge's teacher switches, apart from the rest of src/data/archery.ts so the games list doesn't bring the archery
 * rules onto the home page (dashboard plan D7). */
import { supabase } from '../lib/supabase';
import { readSettings } from './classSettings';
import { forgetSettings } from './settingsMemory';
import { FriendlyError } from './profile';

/** Is Archery Challenge switched on for this pupil's class (or, for a teacher, the class picked)? */
export async function fetchArcheryEnabled(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['archery_enabled'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Archery Challenge setting.');
  return row.archery_enabled === true;
}

export async function saveArcheryEnabled(enabled: boolean, classId: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_archery', { enabled, target_class: classId });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

/** Are classmate fights switched on for this class (Stage 7)? On unless a teacher switched them off. */
export async function fetchArcheryDuels(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['archery_duels'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Archery Challenge setting.');
  return row.archery_duels !== false;
}

export async function saveArcheryDuels(enabled: boolean, classId: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_archery_duels', { enabled, target_class: classId });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}
