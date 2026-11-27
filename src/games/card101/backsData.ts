import { fetchMyProgress } from '../../data/progress';
import type { EarnedAchievement } from './backs';

/** The signed-in pupil's achievements, for the card backs (server-earned: the browser only picks which back to show). */
export async function fetchMyAchievements(): Promise<EarnedAchievement[]> {
  const progress = await fetchMyProgress();
  return progress.achievements.map((a) => ({ id: a.id, earnedAt: a.earnedAt, progress: a.progress, goal: a.goal }));
}
