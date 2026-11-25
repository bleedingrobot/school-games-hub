/**
 * The name a pupil goes by in a Class Live game (big screen, iPads, results), James 25 Nov 2026 NZ.
 *
 * A pupil's profile name (profiles.display_name) is either a made-up name, "Brave Kiwi 7" (two list words and a number,
 * public.is_made_up_name), or their own typed name a teacher approved ("Bob", "Bob Lee"; migration 20261112002800).
 *   - own typed name: shown as it is
 *   - made-up name:   the first word and its number, "Brave 7"
 * If two pupils in the same game would show the same short name ("Brave Kiwi 7" and "Brave Tui 7"), both show their
 * whole made-up name instead, so no two players on the screen look the same.
 *
 * Saboteur Crew uses its own fun factory names instead (shared/classlive/crew.ts).
 */

const MADE_UP = /^([A-Z][a-z]+) [A-Z][a-z]+ ([1-9][0-9]?)$/;
const MAX = 20;

const tidy = (name: string) => name.trim().replace(/\s+/g, ' ');

/** One pupil's short game name, without looking at anyone else. */
export function liveName(name: string): string {
  const n = tidy(name);
  const m = MADE_UP.exec(n);
  if (m) return `${m[1]} ${m[2]}`;
  return n.slice(0, MAX) || 'A player';
}

/** The whole name, used when two short names clash. */
const fullName = (name: string) => tidy(name).slice(0, MAX) || 'A player';

/** Every player's game name in one game, keyed like `names`. Short names that clash fall back to the whole name. */
export function liveNames<K extends string>(names: Record<K, string>): Record<K, string> {
  const keys = Object.keys(names) as K[];
  const count = new Map<string, number>();
  for (const k of keys) {
    const s = liveName(names[k]).toLowerCase();
    count.set(s, (count.get(s) ?? 0) + 1);
  }
  const out = {} as Record<K, string>;
  for (const k of keys) {
    const s = liveName(names[k]);
    out[k] = (count.get(s.toLowerCase()) ?? 0) > 1 ? fullName(names[k]) : s;
  }
  return out;
}

/** A newcomer's game name in a game whose players already have `taken` names: short, or whole if the short one is taken. */
export function liveNameAmong(name: string, taken: Iterable<string>): string {
  const s = liveName(name);
  for (const t of taken) if (t.toLowerCase() === s.toLowerCase()) return fullName(name);
  return s;
}
