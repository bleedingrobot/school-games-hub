/** Connects Clan Quest to the live `clans` server function, with the student's sign-in, and holds the teacher's switch and tools. */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { makeClanServer, type ClanServer } from '../games/clans/remote';
import { supabase } from '../lib/supabase';
import { FriendlyError } from './profile';

export function liveClanServer(): ClanServer {
  return makeClanServer({
    url: `${SUPABASE_URL}/functions/v1/clans`,
    apikey: SUPABASE_PUBLISHABLE_KEY,
    token: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
  });
}

// ---------------------------------------------------------------------------
// The teacher's switch and tools
// ---------------------------------------------------------------------------

/** Is Clan Quest switched on for the class? (The dashboard hides the card when it isn't.) */
export async function fetchClansEnabled(): Promise<boolean> {
  const { data, error } = await supabase.from('app_settings').select('clans_enabled').maybeSingle();
  if (error || !data) throw new FriendlyError('We couldn’t load the Clan Quest setting.');
  return data.clans_enabled === true;
}

export async function saveClansEnabled(enabled: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('teacher_set_clans', { enabled });
  if (error || typeof data !== 'boolean') throw new FriendlyError('We couldn’t save the Clan Quest setting.');
  return data;
}

/** One pupil's clan at a glance, for the teacher page. Null if they have not made one. */
export interface ClanInfo {
  name: string;
  day: number;
  gold: number;
  followers: number;
  fightsLeft: number;
  averageLevel: number;
  inFight: boolean;
  lastPlayed: string;
}

export async function fetchClanInfo(student: string): Promise<ClanInfo | null> {
  const { data, error } = await supabase.rpc('teacher_clan_info', { student });
  if (error) throw new FriendlyError('We couldn’t load that clan.');
  return (data as ClanInfo | null) ?? null;
}

/** Deletes a pupil's clan so they make a new one. Their points and achievements are not touched. */
export async function resetClan(student: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('teacher_reset_clan', { student });
  if (error) throw new FriendlyError('We couldn’t reset that clan.');
  return data === true;
}

// ---------------------------------------------------------------------------
// Raids on classmates and the village groups (stage C.6 part A)
// ---------------------------------------------------------------------------

/** Are raids on classmates switched on? Off until a teacher turns them on. */
export async function fetchClanRaidsEnabled(): Promise<boolean> {
  const { data, error } = await supabase.from('app_settings').select('clan_raids_enabled').maybeSingle();
  if (error || !data) throw new FriendlyError('We couldn’t load the raids setting.');
  return data.clan_raids_enabled === true;
}

export async function saveClanRaidsEnabled(enabled: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('teacher_set_clan_raids', { enabled });
  if (error || typeof data !== 'boolean') throw new FriendlyError('We couldn’t save the raids setting.');
  return data;
}

export interface VillageGroup {
  id: number;
  name: string;
  isDefault: boolean;
  chest: number;
  levels: { trainingHall: number; smithy: number; church: number };
  pupils: number;
}

export interface VillagePupil {
  id: string;
  name: string;
  /** The id of the village they are in (1 is "Everyone else"). */
  village: number;
}

export interface Villages {
  villages: VillageGroup[];
  pupils: VillagePupil[];
}

export async function fetchVillages(): Promise<Villages> {
  const { data, error } = await supabase.rpc('teacher_villages');
  if (error || !data) throw new FriendlyError('We couldn’t load the village groups.');
  return data as Villages;
}

export async function createVillage(name: string): Promise<number> {
  const { data, error } = await supabase.rpc('teacher_create_village', { new_name: name });
  if (error) throw new FriendlyError(error.code === '22023' ? error.message : 'We couldn’t make that group.');
  return data as number;
}

export async function renameVillage(village: number, name: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_rename_village', { village, new_name: name });
  if (error) throw new FriendlyError(error.code === '22023' ? error.message : 'We couldn’t rename that group.');
}

export async function deleteVillage(village: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('teacher_delete_village', { village });
  if (error) throw new FriendlyError('We couldn’t delete that group.');
  return data === true;
}

/** Moves a pupil into a group (the default group, number 1, is "Everyone else"). */
export async function movePupil(student: string, village: number): Promise<void> {
  const { error } = await supabase.rpc('teacher_move_pupil', { student, village });
  if (error) throw new FriendlyError('We couldn’t move that pupil.');
}
