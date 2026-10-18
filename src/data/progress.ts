/**
 * Points, levels, badges, achievements and leaderboards.
 *
 * All of it is worked out in the database when games are saved. The page only reads it,
 * through read-only database functions; nothing here can change a score.
 */
import { supabase } from '../lib/supabase';
import { FriendlyError } from './profile';

export type Rank = 'bronze' | 'silver' | 'gold' | 'champion';

export const RANKS: Record<Rank, { label: string; emoji: string }> = {
  bronze: { label: 'Bronze', emoji: '🥉' },
  silver: { label: 'Silver', emoji: '🥈' },
  gold: { label: 'Gold', emoji: '🥇' },
  champion: { label: 'Champion', emoji: '🌟' },
};

export interface RankProgress {
  rank: Rank;
  /** The next badge up, or null at Champion. */
  next: Rank | null;
  /** How far towards the next badge, 0 to 1. */
  progress: number | null;
  /** At Gold with a Champion score: rated games still needed. */
  gamesNeeded: number | null;
  ratedGames: number;
}

export interface Achievement {
  id: string;
  game: string;
  name: string;
  emoji: string;
  measure: string;
  goal: number;
  progress: number;
  earnedAt: string | null;
}

export interface MyProgress {
  points: number;
  level: number;
  levelStart: number;
  nextLevelAt: number;
  weekPoints: number;
  games: { game: string; rank: RankProgress; weekRatingChange: number | null }[];
  achievements: Achievement[];
  /** Points earned by recent games, by bot game or friend game ID. */
  recent: { id: string; points: number }[];
}

export async function fetchMyProgress(): Promise<MyProgress> {
  const { data, error } = await supabase.rpc('my_progress');
  if (error || !data) throw new FriendlyError('We couldn’t load your points.');
  return data as MyProgress;
}

export type Board = 'week' | 'all-time' | 'improved';

export interface BoardRow {
  /** Null on your own line when you're not on the board yet. */
  place: number | null;
  display_name: string;
  avatar: unknown;
  rank: Rank;
  /** Points this week (weekly board only). */
  points: number | null;
  games: number;
  is_me: boolean;
}

export async function fetchLeaderboard(game: string, board: Board): Promise<BoardRow[]> {
  const { data, error } = await supabase.rpc('leaderboard', { game, board });
  if (error || !data) throw new FriendlyError('We couldn’t load the leaderboard.');
  return data as BoardRow[];
}

export interface Rules {
  bot: Record<'very-easy' | 'easy' | 'medium', { lost: number; drawn: number; won: number }>;
  friend: { lost: number; drawn: number; won: number };
  /** Wormholes & Black Holes: taking-part points, the same win or lose. */
  space?: { bot: number; friend: number; friendDailyGames: number; minTurns: number };
  /** 101: bot games earn the same as chess; classmates games their own points. */
  card101?: { friendLost: number; friendWon: number; friendDailyGames: number; minRounds: number };
  /** Gem Keep: points for a win with 1, 2 or 3 stars, and for a loss that got far enough. */
  gemKeep?: { won: [number, number, number]; lost: number; minWavesForLoss: number };
  /** Maths Monsters (null while the game is switched off): wild wins per point, points per trainer, per badge. */
  monsters?: { wildWinsPerPoint: number; trainerWin: number; badge: number } | null;
  /** Power Clash: taking-part points against a bot and against a classmate (never ranked). */
  powerClash?: { bot: number; friend?: number; friendDailyGames?: number };
  botDailyCap: number;
  pairDailyLimit: number;
  achievementPoints: number;
  /** Points needed for levels 1 to 10. */
  levels: number[];
  ratingK: number;
  weeklyMinGames: number;
  allTimeMinGames: number;
  improvedMinGames: number;
  championMinGames: number;
}

export async function fetchRules(): Promise<Rules> {
  const { data, error } = await supabase.rpc('progress_rules');
  if (error || !data) throw new FriendlyError('We couldn’t load the rules.');
  return data as Rules;
}

/** How far through the current level, 0 to 1. */
export function levelProgress(p: Pick<MyProgress, 'points' | 'levelStart' | 'nextLevelAt'>): number {
  const span = p.nextLevelAt - p.levelStart;
  return span > 0 ? Math.min(1, Math.max(0, (p.points - p.levelStart) / span)) : 0;
}

/** A short line about the next badge, e.g. "Halfway to Silver". */
export function nextRankText(r: RankProgress): string {
  if (!r.next) return 'Top badge!';
  const next = RANKS[r.next].label;
  if (r.gamesNeeded) return `Play ${r.gamesNeeded} more rated game${r.gamesNeeded === 1 ? '' : 's'} for ${next}`;
  if (r.ratedGames === 0) return 'Play a friend to start climbing';
  const p = r.progress ?? 0;
  if (p >= 0.75) return `Nearly ${next}!`;
  if (p >= 0.4) return `Halfway to ${next}`;
  return `On the way to ${next}`;
}
