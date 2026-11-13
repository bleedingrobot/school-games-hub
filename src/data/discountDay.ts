/**
 * Discount day (James, 13 Nov 2026): the teacher's switch on the Today page that makes a game's shop cheaper for the
 * class until midnight (NZ), then turns itself off. The game's server reads it (shared/discountDay.ts).
 */
import { supabase } from '../lib/supabase';
import { DISCOUNT_GAMES, isDiscountFor, type DiscountGame } from '../../shared/discountDay';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

/** Which games' Discount day is on today for the class. */
export async function fetchDiscountToday(classId?: string | null): Promise<Record<DiscountGame, boolean>> {
  const row = await readSettings(['discount_days'], classId);
  if (!row) throw new Error('We couldn’t load this setting.');
  return Object.fromEntries(DISCOUNT_GAMES.map((g) => [g.id, isDiscountFor(row.discount_days, g.id)])) as Record<DiscountGame, boolean>;
}

export async function saveDiscountToday(game: DiscountGame, enabled: boolean, classId: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_discount_today', { game, enabled, target_class: classId });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}
