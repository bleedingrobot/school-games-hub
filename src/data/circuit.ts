/** Circuit Racer's teacher switches (docs/CIRCUIT-PLAN.md): on/off and the maths, read through the class settings. */
import { parseMathsSwitch, type MathsSwitch } from '../../shared/space/mathsSwitch';
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

/** The class's Circuit Racer maths ('off' | 'choose' | 'on'). A teacher reading a class is told when it fails. */
export async function fetchCircuitMaths(classId?: string | null): Promise<MathsSwitch> {
  const row = await readSettings(['circuit_maths'], classId);
  if (!row && classId) throw new FriendlyError('We couldn’t load this setting.');
  return parseMathsSwitch(row?.circuit_maths);
}

export async function saveCircuitMaths(mode: MathsSwitch, classId: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_circuit_maths', { mode, target_class: classId });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

/** Starts a pupil's Circuit Racer again: roads, racer and Volt's tips (teacher_reset_circuit). Points and achievements stay. */
export async function resetCircuitStudent(student: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_reset_circuit', { student });
  if (error) throw new FriendlyError('We couldn’t start them again. Please try again.');
}
