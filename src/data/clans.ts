/** Connects Clan Quest to the live `clans` server function, with the student's sign-in, and holds the teacher's switch and tools. */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { toScoreRow, type ScoreRow, type ScoreRowRaw } from '../games/clans/fame';
import { makeClanServer, type ClanServer } from '../games/clans/remote';
import { readPracticalSettings, type PracticalSettings } from '../../shared/maths/practical';
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

// ---------------------------------------------------------------------------
// The scoreboard, the maths settings and the private maths records (stage C.6 part B)
// ---------------------------------------------------------------------------

/** The top ten clans by fame and your own clan: clan names and fame only. */
export async function fetchScoreboard(): Promise<ScoreRow[]> {
  const { data, error } = await supabase.rpc('clan_scoreboard');
  if (error) throw new FriendlyError('We couldn’t load the scoreboard.');
  return ((data ?? []) as ScoreRowRaw[]).map(toScoreRow);
}

/** What the teacher sets for Clan Quest's maths and mine fights. The same shape the server sends with each clan. */
export interface ClanMathsSettings extends PracticalSettings {
  /** Mine fights a day, 1 to 30. */
  fightsPerDay: number;
  /** The fame season (a new season sets every clan's fame to 0). */
  season: number;
}

export async function fetchClanMathsSettings(): Promise<ClanMathsSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('clans_year_band, clans_topics, clans_tables, clans_fights_per_day, clans_season')
    .maybeSingle();
  if (error || !data) throw new FriendlyError('We couldn’t load the Clan Quest maths settings.');
  return {
    ...readPracticalSettings({ yearBand: data.clans_year_band, enabledTopics: data.clans_topics, enabledTables: data.clans_tables }),
    fightsPerDay: data.clans_fights_per_day ?? 8,
    season: data.clans_season ?? 1,
  };
}

/** Saves the maths settings (any of year band, topics, times tables, fights a day). Pupils get them next time they open the game; a fight already open keeps its own. */
export async function saveClanMathsSettings(settings: Partial<Pick<ClanMathsSettings, 'yearBand' | 'enabledTopics' | 'enabledTables' | 'fightsPerDay'>>): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_clan_maths', { settings });
  if (error) throw new FriendlyError(error.code === '22023' ? error.message : 'We couldn’t save the Clan Quest settings.');
}

/** Starts a new fame season: every clan's fame goes to 0; clans stay. */
export async function startClansNewSeason(confirm: string): Promise<{ season: number; clans: number }> {
  const { data, error } = await supabase.rpc('teacher_clans_new_season', { confirm });
  if (error) throw new FriendlyError(error.code === '22023' ? error.message : 'We couldn’t start a new season.');
  return data as { season: number; clans: number };
}

export interface MathsKind {
  key: string;
  attempts: number;
  correct: number;
  students?: number;
}

export interface ClanMathsClass {
  players: number;
  kinds: MathsKind[];
  hardest: MathsKind[];
}

export interface ClanMathsStudent {
  fame: number | null;
  kinds: MathsKind[];
}

export async function fetchClanMathsClass(): Promise<ClanMathsClass> {
  const { data, error } = await supabase.rpc('teacher_clan_maths_class');
  if (error || !data) throw new FriendlyError('We couldn’t load the Clan Quest maths records.');
  return data as ClanMathsClass;
}

export async function fetchClanMathsStudent(student: string): Promise<ClanMathsStudent> {
  const { data, error } = await supabase.rpc('teacher_clan_maths_student', { student });
  if (error || !data) throw new FriendlyError('We couldn’t load that pupil’s maths records.');
  return data as ClanMathsStudent;
}

/** "clan:y5:percent-of" as words for the teacher: "Percent of (Year 5)". */
export function kindLabel(key: string): string {
  const m = /^clan:y(\d):(.+)$/.exec(key);
  if (!m) return key;
  const kind = m[2].startsWith('quest-') ? `Quest puzzle: ${m[2].slice(6)}` : m[2];
  const words = kind.replace(/-/g, ' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} (Year ${m[1]})`;
}

