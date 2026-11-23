/** Class Showdown's teacher settings (docs/SHOWDOWN-PLAN.md): the on/off switch and first names on the projector. */
import { supabase } from '../lib/supabase';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

export async function fetchShowdownEnabled(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['showdown_enabled'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Class Showdown setting.');
  return row.showdown_enabled === true;
}

export async function fetchShowdownNames(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['showdown_names'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Class Showdown setting.');
  return row.showdown_names !== false;
}

async function save(args: { enabled?: boolean; names?: boolean }, classId: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_showdown', { enabled: args.enabled ?? null, names: args.names ?? null, target_class: classId });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

export const saveShowdownEnabled = (enabled: boolean, classId: string) => save({ enabled }, classId);
export const saveShowdownNames = (names: boolean, classId: string) => save({ names }, classId);
