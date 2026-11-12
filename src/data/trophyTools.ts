/**
 * Teachers' trophy tools (docs/plans/profile/PLAN.md card P12): the admin's Trophy season panel, a pupil's trophies on their
 * page, "Reset avatar", and the class's new trophies this week. The database checks every call.
 */
import { supabase } from '../lib/supabase';
import { FriendlyError } from './profile';
import type { Tier } from '../avatar/earnedPictures';

/** The hub's trophy clock for my school. Dates are NZ days (YYYY-MM-DD). */
export interface TrophySeason {
  /** 0 before season 1 starts. */
  season: number;
  /** Season 1's first day. */
  start: string;
  days: number;
  /** Set while the clock is paused (holidays). */
  pausedSince: string | null;
  seasonStart: string | null;
  seasonEnd: string | null;
  /** Days until this season ends (or, before season 1, until it starts). Stands still while paused. */
  daysLeft: number;
}

export async function fetchTrophySeason(): Promise<TrophySeason> {
  const { data, error } = await supabase.rpc('admin_trophy_season');
  if (error || !data) throw new FriendlyError("We couldn't load the trophy season. Please try again.");
  return data as TrophySeason;
}

/** Change the season length and/or pause or go on. Returns the new state. */
export async function saveTrophySeason(change: { days?: number; paused?: boolean }): Promise<TrophySeason> {
  const { data, error } = await supabase.rpc('admin_set_trophy_season', {
    days: change.days ?? null,
    paused: change.paused ?? null,
  });
  if (error || !data) {
    // The server's own words say what length is allowed.
    throw new FriendlyError(error?.code === '22023' ? error.message : "We couldn't save that. Please try again.");
  }
  return data as TrophySeason;
}

/** One trophy a pupil holds, as their teacher sees it. */
export interface PupilTrophy {
  id: string;
  game: string;
  name: string;
  how: string;
  kind: 'trophy' | 'picture';
  tier: Tier;
  count: number;
  lastAt: string;
}

export async function fetchPupilTrophies(student: string): Promise<PupilTrophy[]> {
  const { data, error } = await supabase.rpc('teacher_pupil_trophies', { student });
  if (error || !Array.isArray(data)) throw new FriendlyError("We couldn't load their trophies. Please try again.");
  return data as PupilTrophy[];
}

/** Back to no avatar: the pupil sees "Make your avatar" again. Their trophies and pictures stay. */
export async function resetAvatar(student: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_reset_avatar', { student });
  if (error) throw new FriendlyError("We couldn't reset that avatar. Please try again.");
}

/** A trophy won this week by a pupil in the class. */
export interface ClassNewTrophy {
  player: string;
  name: string;
  avatar: unknown;
  id: string;
  game: string;
  trophy: string;
  kind: 'trophy' | 'picture';
  tier: Tier;
  at: string;
}

/** Game feats from the last 7 days, newest first. Empty if it can't be read (it's a nice-to-have on Today). */
export async function fetchClassNewTrophies(classId: string): Promise<ClassNewTrophy[]> {
  try {
    const { data, error } = await supabase.rpc('teacher_new_trophies', { target: classId });
    return error || !Array.isArray(data) ? [] : (data as ClassNewTrophy[]);
  } catch {
    return [];
  }
}
