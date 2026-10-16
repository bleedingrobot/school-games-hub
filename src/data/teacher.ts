/**
 * The teacher view. Every function here is checked on the server: the database refuses
 * anyone whose profile isn't a teacher, whatever the page does.
 */
import { supabase } from '../lib/supabase';
import { FriendlyError } from './profile';
import type { Rank } from './progress';

export interface Person {
  id: string;
  display_name: string;
  /** The part of their school email before the @. Only teachers get this. */
  real_name: string | null;
  avatar: unknown;
  role: 'student' | 'teacher';
  hidden: boolean;
  bot_games: number;
  friend_games: number;
  points: number;
  last_played: string | null;
  joined: string;
}

interface Tally {
  played: number;
  won: number;
  lost: number;
  drawn: number;
  /** Games they walked away from. */
  left: number;
}

export interface PersonDetail {
  points: number;
  level: number;
  /** Rank is null for games without badges (Wormholes & Black Holes). */
  games: { game: string; bot: Tally; friend: Tally; rank: Rank | null; achievements: number }[];
  recent: {
    game: string;
    kind: 'bot' | 'friend';
    /** The bot level, or the other player's name. */
    against: string;
    result: 'won' | 'lost' | 'drawn';
    reason: string;
    finished_at: string;
    /** Wormholes & Black Holes against bots: the place (null if they left early). */
    place?: number | null;
  }[];
}

/** Messages we wrote in the database are safe to show; anything else gets the fallback. */
function fail(error: { code?: string; message?: string }, fallback: string): never {
  if (error.code && ['22023', '42501'].includes(error.code) && error.message && !error.message.includes('permission denied')) {
    throw new FriendlyError(error.message);
  }
  throw new FriendlyError(fallback);
}

export async function fetchPeople(): Promise<Person[]> {
  const { data, error } = await supabase.rpc('teacher_students');
  if (error || !data) fail(error ?? {}, 'We couldn’t load the list of players.');
  return data as Person[];
}

export async function fetchPersonDetail(id: string): Promise<PersonDetail> {
  const { data, error } = await supabase.rpc('teacher_student_detail', { student: id });
  if (error || !data) fail(error ?? {}, 'We couldn’t load that player.');
  return data as PersonDetail;
}

export async function renamePerson(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('teacher_reset_name', { student: id });
  if (error) fail(error, 'We couldn’t rename that player.');
  return data as string;
}

export async function setHidden(id: string, hide: boolean): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_hidden', { student: id, hide });
  if (error) fail(error, 'We couldn’t change that.');
}

export async function setRole(id: string, role: 'student' | 'teacher'): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_role', { person: id, new_role: role });
  if (error) fail(error, 'We couldn’t change that.');
}

export async function deletePerson(id: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_delete_student', { student: id });
  if (error) fail(error, 'We couldn’t delete that player.');
}

export async function setMultiplayer(enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_multiplayer', { enabled });
  if (error) fail(error, 'We couldn’t change that.');
}

export async function setSpaceReactions(enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_space_reactions', { enabled });
  if (error) fail(error, 'We couldn’t change that.');
}

export async function startNewSeason(
  confirm: string,
): Promise<{ botGames: number; friendGames: number; gemKeepLevels?: number }> {
  const { data, error } = await supabase.rpc('teacher_new_season', { confirm });
  if (error || !data) fail(error ?? {}, 'We couldn’t start a new season.');
  return data as { botGames: number; friendGames: number; gemKeepLevels?: number };
}
