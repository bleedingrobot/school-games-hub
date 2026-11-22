/** Circuit Racer's teacher switch (docs/CIRCUIT-PLAN.md): read through the class settings, saved by teacher_set_circuit. */
import { supabase } from '../lib/supabase';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

export async function fetchCircuitEnabled(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['circuit_enabled'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Circuit Racer setting.');
  return row.circuit_enabled === true;
}

export async function saveCircuitEnabled(enabled: boolean, classId: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_circuit', { enabled, target_class: classId });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}
