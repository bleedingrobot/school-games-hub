/**
 * ⚠️  DEVELOPMENT-ONLY SAMPLE DATA  ⚠️
 *
 * Everything in this file is made up, so the dashboard has something to show
 * before sign-in and the database exist. The UI marks it with a "Sample data" badge.
 *
 * Delete this file once real data arrives (profile in Stage 3, results in
 * Stages 4-5, points and badges in Stage 7). The type checker will then point
 * at every place that still uses it.
 */
import type { BotLevel } from '../games/types';

export const IS_SAMPLE_DATA = true;

export const sampleStudent = {
  displayName: 'Speedy Otter 27',
  avatarColour: '#2bb3a3',
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
