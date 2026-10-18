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
