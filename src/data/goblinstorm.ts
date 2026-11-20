/**
 * Goblin Storm's board on the 🎮 Game boards tab (docs/GOBLINSTORM-PLAN.md, stage 5): own school, pupils only, ranked by
 * bosses beaten and then the most monsters beaten in one run. Never maths.
 */
import { supabase } from '../lib/supabase';
import type { BoardScope } from './boards';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

export interface GoblinStormRow {
  place: number;
  name: string;
  avatar: unknown;
  bosses: number;
  /** The most monsters beaten in one run. */
  best: number;
  is_me: boolean;
}

/** The top 10, and the caller if they are further down. */
export async function fetchGoblinStormBoard(scope: BoardScope): Promise<GoblinStormRow[]> {
  const { data, error } = await supabase.rpc('goblinstorm_board', { scope });
  if (error || !data) throw new FriendlyError('We couldn’t load the leaderboard.');
  return data as GoblinStormRow[];
}

export async function fetchGoblinStormEnabled(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['goblinstorm_enabled'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Goblin Storm setting.');
  return row.goblinstorm_enabled === true;
}

export async function saveGoblinStormEnabled(enabled: boolean, classId: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_goblinstorm', { enabled, target_class: classId });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}
