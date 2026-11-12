import { supabase } from '../lib/supabase';
import { FriendlyError } from './profile';
import type { Tier } from '../avatar/earnedPictures';

export { tierOf, TIERS, type Tier } from '../avatar/earnedPictures';

/** How often a trophy can be won: each hub season, each year, once ever, or in steps (1 bronze, 2 silver, 3 gold). */
export type TrophyRepeat = 'season' | 'year' | 'once' | 'steps';

/** A trophy that can be won. `kind: 'picture'` can also be worn as a profile picture. */
export interface TrophyType {
  id: string;
  /** The game's home card id, or 'hub' for a reward that belongs to no one game. */
  game: string;
  name: string;
  /** How to win it, in a child's words. */
  how: string;
  kind: 'trophy' | 'picture';
  repeat: TrophyRepeat;
  art: string | null;
}

export interface TrophyWin {
  season: number;
  year: number;
  at: string;
  detail: Record<string, unknown>;
}

/** A trophy I hold. */
export interface MyTrophy extends TrophyType {
  tier: Tier;
  /** How many times I have won it. */
  count: number;
  firstAt: string;
  lastAt: string;
  /** I have not been shown the "New trophy!" moment for it yet. */
  isNew: boolean;
  wins: TrophyWin[];
}

export interface MyTrophies {
  /** The hub's season number today (0 before the first season). */
  season: number;
  trophies: MyTrophy[];
  /** Up to three I have not won yet. */
  next: TrophyType[];
}

/** What classmates may see of someone's trophies: which, and the metal. */
export interface TrophyBadge {
  id: string;
  tier: Tier;
}

/** My own trophy cabinet. */
export async function fetchMyTrophies(): Promise<MyTrophies> {
  const { data, error } = await supabase.rpc('my_trophies');
  if (error || !data) throw new FriendlyError("We couldn't load your trophies. Please try again.");
  return data as MyTrophies;
}

/** A schoolmate's trophies (empty for anyone outside my school). */
export async function fetchTrophiesOf(player: string): Promise<TrophyBadge[]> {
  const { data, error } = await supabase.rpc('trophies_of', { player });
  if (error) throw new FriendlyError("We couldn't load those trophies. Please try again.");
  return (data ?? []) as TrophyBadge[];
}

/** Tell the server I have been shown my new trophies. Returns how many were new. */
export async function markMyTrophiesSeen(): Promise<number> {
  const { data, error } = await supabase.rpc('mark_my_trophies_seen');
  if (error) throw new FriendlyError("We couldn't save that. Please try again.");
  return (data ?? 0) as number;
}
