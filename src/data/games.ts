/**
 * The Games tab's whole-table helpers (teacher controls card C4): which settings column holds each game's on/off switch for a
 * class, one read of all of them, and one request that sets many at once (a whole section's All on / All off).
 *
 * The column list is kept here, apart from the games, so the Games tab needs no change to any game's files. Every game with
 * a `teacher.switch` must be listed (Games.test.tsx checks). The server (teacher_set_games, migration 20261112000300) refuses
 * any column that is not a game switch.
 */
import { supabase } from '../lib/supabase';
import { fetchSchoolDefaults, saveSchoolDefaults } from './admin';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

/** The four No maths games (chess, checkers, 101, Power Clash) share this one switch. */
export const NON_MATHS_COLUMN = 'non_maths_games';

/** Game id -> the class settings column that switches it on or off. Games not listed here are always on, or share a switch. */
export const GAME_SWITCH_COLUMNS: Readonly<Record<string, string>> = {
  'dragon-maths': 'lord_enabled',
  'clan-quest': 'clans_enabled',
  monsters: 'monsters_enabled',
  'bond-match': 'bond_match_enabled',
  mine: 'mine_enabled',
  archery: 'archery_enabled',
  kingdom: 'kingdom_enabled',
  trader: 'trader_enabled',
  diamond: 'diamond_enabled',
  isles: 'isles_enabled',
  decree: 'decree_enabled',
  robin: 'robin_enabled',
  pipi: 'pipi_enabled',
  beanstalk: 'beanstalk_enabled',
  korora: 'korora_enabled',
  tui: 'tui_enabled',
  weka: 'weka_enabled',
  parrot: 'parrot_enabled',
  hop: 'hop_enabled',
  lizard: 'lizard_enabled',
  pigeon: 'pigeon_enabled',
  swamphen: 'swamphen_enabled',
  toonflap: 'toonflap_enabled',
  glyph: 'glyph_enabled',
  orderup: 'orderup_enabled',
};

/**
 * The column that decides whether a game is on, or null for a game that is always on. A No maths game answers with the shared
 * Non-maths games column.
 */
export function switchColumnOf(game: { id: string; group?: string }): string | null {
  return GAME_SWITCH_COLUMNS[game.id] ?? (game.group === 'no-maths' ? NON_MATHS_COLUMN : null);
}

/** Every switch column the Games tab reads, in one list. */
export const ALL_SWITCH_COLUMNS: readonly string[] = [...new Set([...Object.values(GAME_SWITCH_COLUMNS), NON_MATHS_COLUMN])];

/**
 * Is each switch on for the class? One request for the lot. Non-maths games is on unless a teacher turned it off; the others are
 * off unless a teacher turned them on (the same reading each game's own switch uses).
 */
export async function fetchGameSwitches(classId: string): Promise<Record<string, boolean>> {
  const row = await readSettings([...ALL_SWITCH_COLUMNS], classId);
  if (!row) throw new Error('We couldn’t load this setting.');
  return readSwitches(row);
}

const readSwitches = (row: Record<string, unknown>): Record<string, boolean> =>
  Object.fromEntries(ALL_SWITCH_COLUMNS.map((c) => [c, c === NON_MATHS_COLUMN ? row[c] !== false : row[c] === true]));

/** The same switches on the school's defaults row (what a new class starts with; Admin, New class settings). */
export async function fetchSchoolSwitches(): Promise<Record<string, boolean>> {
  return readSwitches(await fetchSchoolDefaults());
}

/** Sets many switches on the school's defaults row; existing classes don't change. */
export const saveSchoolSwitches = (changes: Record<string, boolean>): Promise<void> => saveSchoolDefaults(changes);

/** Sets many switches for the class in one request: { column: on }. */
export async function saveGameSwitches(changes: Record<string, boolean>, classId: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_games', { changes, target_class: classId });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change those.');
}
