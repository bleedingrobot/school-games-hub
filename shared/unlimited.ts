/**
 * Unlimited turns today (James, 4 Nov 2026; migration 20261104001300_unlimited_turns.sql): a class switch a teacher turns on
 * from the Today page. For the rest of that New Zealand day, the games with a daily turn limit (Dragon Maths forest and
 * arena fights, Clan Quest mine fights, Maths Monsters battles, Diamond Drop new levels, Star Trader jumps, Sky Isles turns)
 * no longer stop at the limit.
 *
 * The same rule in every game: the normal turns are used first, as on any day. After that each extra turn gives
 * everything in the game as usual, but no hub points (EXTRA_TURN_POINTS), so classes stay fair on points and levels.
 */

/** The class's switch, as the settings row keeps it: the NZ date ('YYYY-MM-DD') it is on for, or null. */
export type UnlimitedDay = string | null | undefined;

/** Today's date in New Zealand, 'YYYY-MM-DD'. */
export const nzToday = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

/** Is the switch on today? Anything that isn't today's date (null, an old day, junk) is off. */
export const isUnlimitedDay = (day: unknown, now: Date = new Date()): boolean => typeof day === 'string' && day === nzToday(now);

/** Hub points for a turn taken past the normal daily limit. */
export const EXTRA_TURN_POINTS = 0;

/** What pupils see where the turns-left count would be. */
export const UNLIMITED_LABEL = 'Unlimited today';
