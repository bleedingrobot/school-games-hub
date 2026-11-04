/**
 * Unlimited turns today (James, 4 Nov 2026; migration 20261104001300_unlimited_turns.sql): one class switch per game, on
 * the teacher's Today page. For the rest of that New Zealand day, that game's daily turn limit is lifted.
 *
 * The same rule in every game: the normal turns are used first, as on any day. After that each extra turn gives
 * everything in the game as usual, but no hub points (EXTRA_TURN_POINTS), so classes stay fair on points and levels.
 */

/** The games with a switch, and what it lifts (for the teacher's Today page). */
export const UNLIMITED_GAMES = [
  { id: 'dragon-maths', name: 'Dragon Maths', lifts: 'forest and arena fights' },
  { id: 'clan-quest', name: 'Clan Quest', lifts: 'mine fights' },
  { id: 'monsters', name: 'Maths Monsters', lifts: 'battles' },
  { id: 'diamond', name: 'Diamond Drop', lifts: 'new levels' },
  { id: 'trader', name: 'Star Trader', lifts: 'jumps' },
  { id: 'isles', name: 'Sky Isles', lifts: 'turns' },
] as const;

export type UnlimitedGame = (typeof UNLIMITED_GAMES)[number]['id'];

/** Today's date in New Zealand, 'YYYY-MM-DD'. */
export const nzToday = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

/**
 * Is this game's switch on today? `days` is the settings row's `unlimited_days` ({ game id: NZ date }). Anything that
 * isn't today's date (missing, an old day, junk) is off.
 */
export function isUnlimitedFor(days: unknown, game: UnlimitedGame, now: Date = new Date()): boolean {
  if (!days || typeof days !== 'object') return false;
  return (days as Record<string, unknown>)[game] === nzToday(now);
}

/** Hub points for a turn taken past the normal daily limit. */
export const EXTRA_TURN_POINTS = 0;

/** What pupils see where the turns-left count would be. */
export const UNLIMITED_LABEL = 'Unlimited today';
