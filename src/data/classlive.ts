/** Class Live's teacher settings (docs/CLASSLIVE-PLAN.md): the on/off switch and first names on the projector. */
import { supabase } from '../lib/supabase';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

export async function fetchClassLiveEnabled(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['classlive_enabled'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Class Live setting.');
  return row.classlive_enabled === true;
}

export async function fetchClassLiveNames(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['classlive_names'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Class Live setting.');
  return row.classlive_names !== false;
}

async function save(args: { enabled?: boolean; names?: boolean }, classId: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_classlive', { enabled: args.enabled ?? null, names: args.names ?? null, target_class: classId });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

export const saveClassLiveEnabled = (enabled: boolean, classId: string) => save({ enabled }, classId);
export const saveClassLiveNames = (names: boolean, classId: string) => save({ names }, classId);
