/** Clan Quest's teacher switch, apart from the rest of src/data/clans.ts so the games list doesn't bring the clan rules onto the
 * home page (dashboard plan D7). */
import { supabase } from '../lib/supabase';
import { readSettings } from './classSettings';
import { forgetSettings } from './settingsMemory';
import { FriendlyError } from './profile';

/** Is Clan Quest switched on for the class? (The dashboard hides the card when it isn't.) */
export async function fetchClansEnabled(classId?: string | null): Promise<boolean> {
  const data = await readSettings(['clans_enabled'], classId);
  if (!data) throw new FriendlyError('We couldn’t load the Clan Quest setting.');
  return data.clans_enabled === true;
}

export async function saveClansEnabled(enabled: boolean, classId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('teacher_set_clans', { enabled, target_class: classId });
  forgetSettings();
  if (error || typeof data !== 'boolean') throw new FriendlyError('We couldn’t save the Clan Quest setting.');
  return data;
}
