import { supabase } from '../lib/supabase';
import type { Achievement } from './progress';

/**
 * Achievements the pupil hasn't been shown yet (docs/ACHIEVEMENTS-PLAN.md, stage 3). The server keeps a "seen" mark on
 * each one: a game's result screen shows its own (AchievementPop) and the hub pages show the rest (NewAchievementMoment).
 */
export interface NewAchievement {
  id: string;
  game: string;
  name: string;
  emoji: string;
  how: string | null;
  tier: 1 | 2 | 3;
  earnedAt: string;
}

/** Bonus points per achievement (the server's achievement_points(); How points work shows the same number). */
export const ACHIEVEMENT_POINTS = 10;

/** My achievements not shown yet, newest first. Empty if they can't be read: the moment just waits for next time. */
export async function fetchMyNewAchievements(): Promise<NewAchievement[]> {
  const { data, error } = await supabase.rpc('my_new_achievements');
  if (error || !Array.isArray(data)) return [];
  return data as NewAchievement[];
}

/** Tell the server these were shown (all of mine when `ids` is left out). A failure only means they show once more. */
export async function markMyAchievementsSeen(ids?: string[]): Promise<void> {
  await supabase.rpc('mark_my_achievements_seen', ids ? { ids } : {});
}

/** A new achievement as the Hall's Medallion draws it: earned, so it shines. */
export function asEarned(a: NewAchievement): Achievement {
  return { id: a.id, game: a.game, name: a.name, emoji: a.emoji, how: a.how, tier: a.tier ?? 2, measure: '', goal: 1, progress: 1, earnedAt: a.earnedAt };
}

/** A game's own list as new achievements, for its trial with no server (the frame is a guess: silver). */
export function pretendNew(game: string, list: readonly { id: string; name: string; emoji: string; how?: string }[]): NewAchievement[] {
  const now = new Date().toISOString();
  return list.map((a) => ({ id: a.id, game, name: a.name, emoji: a.emoji, how: a.how ?? null, tier: 2, earnedAt: now }));
}
