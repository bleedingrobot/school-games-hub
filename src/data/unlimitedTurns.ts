/**
 * Unlimited turns today (James, 4 Nov 2026): the teacher's switch for each game with a daily turn limit, on the Today page.
 * On, it lifts that game's limit for the class until midnight (NZ), then turns itself off. Each game's server reads it;
 * extra turns earn no hub points (shared/unlimited.ts).
 */
import { supabase } from '../lib/supabase';
import { isUnlimitedFor, UNLIMITED_GAMES, type UnlimitedGame } from '../../shared/unlimited';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

/** Which games' switches are on today for the class. */
export async function fetchUnlimitedToday(classId?: string | null): Promise<Record<UnlimitedGame, boolean>> {
  const row = await readSettings(['unlimited_days'], classId);
  if (!row) throw new Error('We couldn’t load this setting.');
  return Object.fromEntries(UNLIMITED_GAMES.map((g) => [g.id, isUnlimitedFor(row.unlimited_days, g.id)])) as Record<UnlimitedGame, boolean>;
}

export async function saveUnlimitedToday(game: UnlimitedGame, enabled: boolean, classId: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_unlimited_today', { game, enabled, target_class: classId });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}
