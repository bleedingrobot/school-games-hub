/**
 * ⚠️  DEVELOPMENT-ONLY SAMPLE DATA  ⚠️
 *
 * Everything in this file is made up, so the dashboard has something to show
 * before results and points exist. The UI marks it with a "Sample data" badge.
 *
 * Delete this file once real data arrives (checkers results in Stage 5, points and
 * badges in Stage 7). The type checker will then point at every place that
 * still uses it. The student's name and avatar are real (Stage 3), and so are
 * chess results and recent games (Stage 4).
 */
export const IS_SAMPLE_DATA = true;

export const sampleStudent = {
  rankBadge: 'Silver' as const,
  points: 340,
  level: 4,
  pointsToNextLevel: 60,
};

export const sampleStats = {
  checkers: { played: 8, won: 5, lost: 3, drawn: 0 },
};

export const sampleAchievements = [
  { id: 'first-win', name: 'First Win', emoji: '🏆', progress: 1, goal: 1 },
  { id: 'ten-games', name: 'Play 10 Games', emoji: '🎮', progress: 20, goal: 10 },
  { id: 'king-me', name: 'Get 5 Kings', emoji: '👑', progress: 3, goal: 5 },
  { id: 'checkmate-medium', name: 'Beat Medium Bot', emoji: '🤖', progress: 0, goal: 1 },
];
