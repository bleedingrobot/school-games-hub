/**
 * ⚠️  DEVELOPMENT-ONLY SAMPLE DATA  ⚠️
 *
 * Everything in this file is made up, so the dashboard has something to show
 * before results and points exist. The UI marks it with a "Sample data" badge.
 *
 * Delete this file once real data arrives (results in Stages 4-5, points and
 * badges in Stage 7). The type checker will then point at every place that
 * still uses it. The student's name and avatar are already real (Stage 3).
 */
import type { BotLevel } from '../games/types';

export const IS_SAMPLE_DATA = true;

export const sampleStudent = {
  rankBadge: 'Silver' as const,
  points: 340,
  level: 4,
  pointsToNextLevel: 60,
};

export const sampleStats = {
  chess: { played: 12, won: 6, lost: 5, drawn: 1 },
  checkers: { played: 8, won: 5, lost: 3, drawn: 0 },
};

export type SampleResult = 'won' | 'lost' | 'drawn';

export const sampleRecentGames: {
  id: string;
  gameId: string;
  opponent: string;
  botLevel?: BotLevel;
  result: SampleResult;
  when: string;
}[] = [
  { id: 'g1', gameId: 'chess', opponent: 'Easy bot', botLevel: 'easy', result: 'won', when: 'Today' },
  { id: 'g2', gameId: 'checkers', opponent: 'Brave Kiwi 14', result: 'lost', when: 'Yesterday' },
  { id: 'g3', gameId: 'checkers', opponent: 'Medium bot', botLevel: 'medium', result: 'won', when: 'Monday' },
  { id: 'g4', gameId: 'chess', opponent: 'Jolly Tuatara 3', result: 'drawn', when: 'Last week' },
];

export const sampleAchievements = [
  { id: 'first-win', name: 'First Win', emoji: '🏆', progress: 1, goal: 1 },
  { id: 'ten-games', name: 'Play 10 Games', emoji: '🎮', progress: 20, goal: 10 },
  { id: 'king-me', name: 'Get 5 Kings', emoji: '👑', progress: 3, goal: 5 },
  { id: 'checkmate-medium', name: 'Beat Medium Bot', emoji: '🤖', progress: 0, goal: 1 },
];
