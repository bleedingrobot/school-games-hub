/** Connects Clan Quest to the live `clans` server function, with the student's sign-in, and holds the teacher's switch and tools. */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { toScoreRow, type ScoreRow, type ScoreRowRaw } from '../games/clans/fame';
import { makeClanServer, type ClanServer } from '../games/clans/remote';
import { readPracticalSettings, type PracticalSettings } from '../../shared/maths/practical';
import { readSettings } from './classSettings';
import { supabase } from '../lib/supabase';
import { forgetSettings } from './settingsMemory';
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
export async function fetchClansEnabled(classId?: string | null): Promise<boolean> {
  const data = await readSettings(['clans_enabled'], classId);
  if (!data) throw new FriendlyError('We couldn’t load the Clan Quest setting.');
  return data.clans_enabled === true;
}

export async function saveClansEnabled(enabled: boolean, classId?: string | null): Promise<boolean> {
  const { data, error } = await supabase.rpc('teacher_set_clans', { enabled, target_class: classId ?? null });
  forgetSettings();
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
  /** The heroes' names, so a teacher can see any made-up ones (missing from an older database). */
  heroes?: string[];
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
// Raids on classmates (stage C.6 part A; the village groups went with My Village, 28 Oct 2026)
// ---------------------------------------------------------------------------

/** Are raids on classmates switched on? Off until a teacher turns them on. */
export async function fetchClanRaidsEnabled(classId?: string | null): Promise<boolean> {
  const data = await readSettings(['clan_raids_enabled'], classId);
  if (!data) throw new FriendlyError('We couldn’t load the raids setting.');
  return data.clan_raids_enabled === true;
}

export async function saveClanRaidsEnabled(enabled: boolean, classId?: string | null): Promise<boolean> {
  const { data, error } = await supabase.rpc('teacher_set_clan_raids', { enabled, target_class: classId ?? null });
  forgetSettings();
  if (error || typeof data !== 'boolean') throw new FriendlyError('We couldn’t save the raids setting.');
  return data;
}

// ---------------------------------------------------------------------------
// Made-up hero names (27 Oct 2026)
// ---------------------------------------------------------------------------

/** May pupils make up their heroes' names? Off until a teacher turns it on: names come from the list. */
export async function fetchClanTypedNames(classId?: string | null): Promise<boolean> {
  const data = await readSettings(['clan_typed_names'], classId);
  if (!data) throw new FriendlyError('We couldn’t load the hero names setting.');
  return data.clan_typed_names === true;
}

export async function saveClanTypedNames(enabled: boolean, classId?: string | null): Promise<boolean> {
  const { data, error } = await supabase.rpc('teacher_set_clan_typed_names', { enabled, target_class: classId ?? null });
  forgetSettings();
  if (error || typeof data !== 'boolean') throw new FriendlyError('We couldn’t save the hero names setting.');
  return data;
}

/** Swaps a pupil's made-up hero names for names from the list. Gives how many were changed. */
export async function listHeroNames(student: string): Promise<number> {
  const { data, error } = await supabase.rpc('teacher_list_hero_names', { student });
  if (error || typeof data !== 'number') throw new FriendlyError('We couldn’t change those names.');
  return data;
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

/** One line of the Hall of Legends: a clan that finished a season goal. Dates are "YYYY-MM-DD" (or null). */
export interface HallRow {
  season: number;
  clanName: string;
  villageDoneOn: string | null;
  monsterDoneOn: string | null;
  isMe: boolean;
}

interface HallRowRaw {
  season: number;
  clan_name: string;
  village_done_on: string | null;
  monster_done_on: string | null;
  is_me: boolean;
}

/**
 * The Hall of Legends. Gives null when the database does not have `clan_hall_of_legends` yet (PostgREST code PGRST202),
 * so the screen can hide the button quietly. Any other problem is an error.
 */
export async function fetchHallOfLegends(): Promise<HallRow[] | null> {
  const { data, error } = await supabase.rpc('clan_hall_of_legends');
  if (error) {
    if (error.code === 'PGRST202') return null;
    throw new FriendlyError('We couldn’t load the Hall of Legends.');
  }
  return ((data ?? []) as HallRowRaw[]).map((r) => ({
    season: r.season, clanName: r.clan_name, villageDoneOn: r.village_done_on, monsterDoneOn: r.monster_done_on, isMe: r.is_me,
  }));
}

/** What the teacher sets for Clan Quest's maths and mine fights. The same shape the server sends with each clan. */
export interface ClanMathsSettings extends PracticalSettings {
  /** Mine fights a day, 1 to 30. */
  fightsPerDay: number;
  /** The fame season (a new season sets every clan's fame to 0). */
  season: number;
}

export async function fetchClanMathsSettings(classId?: string | null): Promise<ClanMathsSettings> {
  const data = await readSettings(['clans_year_band', 'clans_topics', 'clans_tables', 'clans_fights_per_day', 'clans_season'], classId);
  if (!data) throw new FriendlyError('We couldn’t load the Clan Quest maths settings.');
  return {
    ...readPracticalSettings({ yearBand: data.clans_year_band, enabledTopics: data.clans_topics, enabledTables: data.clans_tables }),
    fightsPerDay: (data.clans_fights_per_day as number | null) ?? 8,
    season: (data.clans_season as number | null) ?? 1,
  };
}

/**
 * Saves some of the maths settings (any of year band, topics, times tables, fights a day). The server changes only the ones
 * sent and keeps the rest, so a save never sends an old value back. Pupils get them next time they open the game; a fight
 * already open keeps its own.
 */
export async function saveClanMathsSettings(
  settings: Partial<Pick<ClanMathsSettings, 'yearBand' | 'enabledTopics' | 'enabledTables' | 'fightsPerDay'>>,
  classId?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_clan_maths', { settings, target_class: classId ?? null });
  forgetSettings();
  if (error) throw new FriendlyError(error.code === '22023' ? error.message : 'We couldn’t save the Clan Quest settings.');
}

/** Starts a new fame season: every clan's fame goes to 0; clans stay. */
export async function startClansNewSeason(confirm: string): Promise<{ season: number; clans: number }> {
  const { data, error } = await supabase.rpc('teacher_clans_new_season', { confirm });
  forgetSettings();
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

/** Clan Quest's maths report for one class, for a teacher who teaches it (migration 20261028000500). */
export async function fetchClassClanMaths(classId: string): Promise<ClanMathsClass> {
  const { data, error } = await supabase.rpc('teacher_clan_maths_class', { target_class: classId });
  if (error || !data) {
    throw new FriendlyError(error?.code === '22023' && error.message ? error.message : 'We couldn’t load the Clan Quest maths records for this class.');
  }
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

