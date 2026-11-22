import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  display_name: string;
  avatar: unknown;
  role: 'student' | 'teacher';
  /** A teacher who can also see everyone in the school, make teachers and archive classes. */
  school_admin?: boolean;
}

export interface NameWords {
  adjectives: string[];
  animals: string[];
}

/** Friendly words for errors. Technical details never reach the screen. */
export class FriendlyError extends Error {}

function friendly(error: { code?: string; message?: string } | null, fallback: string): never {
  // Messages we wrote ourselves in the database are safe to show as-is.
  const ours = ['22023', '23505', '42501'];
  if (error?.code && ours.includes(error.code) && error.message && !error.message.includes('permission denied')) {
    throw new FriendlyError(error.message);
  }
  throw new FriendlyError(fallback);
}

export async function fetchMyProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar, role, school_admin')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) friendly(error, "We couldn't load your profile. Please try again.");
  return data as Profile;
}

export async function fetchNameWords(): Promise<NameWords> {
  const { data, error } = await supabase.from('name_words').select('kind, word').order('word');
  if (error || !data) friendly(error, "We couldn't load the name words. Please try again.");
  return {
    adjectives: data.filter((w) => w.kind === 'adjective').map((w) => w.word as string),
    animals: data.filter((w) => w.kind === 'animal').map((w) => w.word as string),
  };
}

export async function chooseMyName(adjective: string, animal: string): Promise<string> {
  const { data, error } = await supabase.rpc('choose_my_name', { adjective, animal });
  if (error) friendly(error, "We couldn't save that name. Please try again.");
  return data as string;
}

export async function saveMyAvatar(avatar: object): Promise<void> {
  const { error } = await supabase.rpc('save_my_avatar', { avatar });
  if (error) friendly(error, "We couldn't save your avatar. Please try again.");
}

/**
 * Teachers only: gives back today's turns, fights, runs and jumps in every game with a daily limit, for the teacher's own
 * account (migration 20261123000300_teacher_reset_my_turns.sql). Returns the names of the games that were reset.
 */
export async function resetMyTurns(): Promise<string[]> {
  const { data, error } = await supabase.rpc('teacher_reset_my_turns');
  if (error) friendly(error, "We couldn't reset your turns. Please try again.");
  return (data as string[] | null) ?? [];
}
