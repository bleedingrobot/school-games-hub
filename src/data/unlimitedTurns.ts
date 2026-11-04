/**
 * Unlimited turns today (James, 4 Nov 2026): the teacher's class switch on the Today page. On, it lifts the daily turn
 * limit in Dragon Maths, Clan Quest, Maths Monsters, Diamond Drop, Star Trader and Sky Isles until midnight (NZ), then
 * turns itself off. Each game's server reads it; extra turns earn no hub points (shared/unlimited.ts).
 */
import { supabase } from '../lib/supabase';
import { isUnlimitedDay } from '../../shared/unlimited';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

export async function fetchUnlimitedToday(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['unlimited_day'], classId);
  if (!row) throw new Error('We couldn’t load this setting.');
  return isUnlimitedDay(row.unlimited_day);
}

export async function saveUnlimitedToday(enabled: boolean, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_unlimited_today', { enabled, target_class: classId ?? null });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}
