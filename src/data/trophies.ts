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
  /** Some I have not won yet, in shelf order (up to twelve: the page shows three from games my class can see). */
  next: TrophyType[];
  /** Up to three trophy ids I picked to show off, in my order. */
  favourites: string[];
}

/** A trophy waiting for its "New trophy!" moment. */
export interface NewTrophy extends Pick<TrophyType, 'id' | 'game' | 'name' | 'how' | 'kind'> {
  tier: Tier;
  count: number;
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
  const mine = data as MyTrophies;
  return { ...mine, favourites: mine.favourites ?? [] };
}

/** Only my trophies I haven't been shown yet (for the "New trophy!" moment). Empty if it can't be read. */
export async function fetchMyNewTrophies(): Promise<NewTrophy[]> {
  const { data, error } = await supabase.rpc('my_new_trophies');
  if (error || !Array.isArray(data)) return [];
  return data as NewTrophy[];
}

/** Save my favourite trophies (up to three). Returns what the server kept: only trophies I hold. */
export async function saveMyFavouriteTrophies(ids: string[]): Promise<string[]> {
  const { data, error } = await supabase.rpc('set_my_favourite_trophies', { ids });
  if (error) throw new FriendlyError("We couldn't save your favourites. Please try again.");
  return (data ?? []) as string[];
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

/** One of a pupil's favourite trophies, as classmates see it. */
export interface FavouriteTrophy extends Pick<TrophyType, 'id' | 'game' | 'kind' | 'name'> {
  tier: Tier;
}

/** What shows beside a pupil's name around the hub: how many different trophies, and their favourite three. */
export interface TrophyShelf {
  count: number;
  favourites: FavouriteTrophy[];
}

/** Trophy shelves for schoolmates, by made-up name (names outside my school are left out). Empty if it can't be read. */
export async function fetchTrophyShelves(names: string[]): Promise<Record<string, TrophyShelf>> {
  if (names.length === 0) return {};
  try {
    const { data, error } = await supabase.rpc('trophy_shelves', { names: names.slice(0, 60) });
    if (error || !data || typeof data !== 'object') return {};
    return data as Record<string, TrophyShelf>;
  } catch {
    return {};
  }
}
