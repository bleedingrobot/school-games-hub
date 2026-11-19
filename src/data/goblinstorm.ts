/**
 * Goblin Storm's board on the 🎮 Game boards tab (docs/GOBLINSTORM-PLAN.md, stage 5): own school, pupils only, ranked by
 * bosses beaten and then the most monsters beaten in one run. Never maths.
 */
import { supabase } from '../lib/supabase';
import type { BoardScope } from './boards';
import { FriendlyError } from './profile';

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
