/**
 * The leaderboard redesign's boards (docs/LEADERBOARD-PLAN.md, migration 20261113000100): most achievements, the hard workers
 * (school days played), one schoolmate's achievements per game, and the home page's New trophies. Game feats and turning up
 * only: never a maths result, never anyone's year.
 */
import { supabase } from '../lib/supabase';
import { FriendlyError } from './profile';
import type { Tier } from './trophies';

/** Who is on a board: the whole school, pupils in my year, or my class. */
export type BoardScope = 'school' | 'year' | 'class';

export interface AchievementsRow {
  place: number;
  name: string;
  avatar: unknown;
  /** Every achievement held (the ones that measure maths level are left out). */
  count: number;
  /** Earned since Monday. */
  week: number;
  /** Played on 4 or 5 school days this week. */
  hard: boolean;
  is_me: boolean;
}

export async function fetchAchievementsBoard(board: 'all-time' | 'week', scope: BoardScope): Promise<AchievementsRow[]> {
  const { data, error } = await supabase.rpc('achievements_board', { board, scope });
  if (error || !Array.isArray(data)) throw new FriendlyError('We couldn’t load the leaderboard.');
  return data as AchievementsRow[];
}

export interface HardWorkerRow {
  place: number;
  name: string;
  avatar: unknown;
  /** School days (Monday to Friday) with a finished game. */
  days: number;
  games: number;
  is_me: boolean;
}

export interface HardWorkers {
  rows: HardWorkerRow[];
  /** Everyone with 4 or more school days this week. */
  everyone: { name: string; avatar: unknown; days: number }[];
  season: number;
}

export async function fetchHardWorkers(board: 'week' | 'season', scope: BoardScope): Promise<HardWorkers> {
  const { data, error } = await supabase.rpc('hard_workers_board', { board, scope });
  if (error || !data || typeof data !== 'object') throw new FriendlyError('We couldn’t load the leaderboard.');
  const d = data as Partial<HardWorkers>;
  return { rows: d.rows ?? [], everyone: d.everyone ?? [], season: d.season ?? 0 };
}

export interface GameAchievements {
  game: string;
  count: number;
  /** Up to three, newest first, each with its emoji in front. */
  names: string[];
}

export async function fetchAchievementsByGame(player: string): Promise<GameAchievements[]> {
  const { data, error } = await supabase.rpc('achievements_by_game', { player });
  if (error || !Array.isArray(data)) throw new FriendlyError('We couldn’t load those achievements.');
  return data as GameAchievements[];
}

/** A trophy won at my school this week, for the home page strip. `name` is null for a pupil without a made-up name. */
export interface RecentTrophy {
  trophy: string;
  title: string;
  how: string;
  game: string;
  kind: 'trophy' | 'picture';
  tier: Tier;
  name: string | null;
  avatar: unknown;
  at: string;
}

/** The recentTrophies part of my_home_page, read safely. */
export function readRecentTrophies(raw: unknown): RecentTrophy[] {
  return Array.isArray(raw)
    ? raw.filter((t): t is RecentTrophy => !!t && typeof t === 'object' && typeof (t as RecentTrophy).trophy === 'string')
    : [];
}

