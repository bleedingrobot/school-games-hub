/**
 * How many live games may run at once (James, 26 Nov 2026 NZ, after the database stalled twice in one morning with two
 * classes playing): one Class Live or Showdown game of any kind across the school. `MOVING` still marks the joystick
 * games (a Kids vote's `noMoving`). The database lists the games running now
 * (`classlive_open_games`, migration 20261126133858_classlive_limits); this decides whether one more may start.
 */
import type { Activity } from './server';

/** The games whose iPads save a spot several times a second (classlive_activities.moves). */
export const MOVING: readonly Activity[] = ['corners', 'shark', 'lava', 'thrones', 'clash', 'ghost', 'crew'];
export const isMoving = (a: string) => (MOVING as readonly string[]).includes(a);

/** Most Class Live and Showdown games running at the same time, across the school (James, 26 Nov 2026 NZ: one). */
export const MAX_GAMES = 1;

/** A game running now (from classlive_open_games). `who`: the class's name, the lobby host, or the set time's host. */
export type OpenGame = { room: number; kind: 'classlive' | 'showdown'; activity: string; name: string; moving: boolean; classId: string | null; who: string };

export function readOpenGames(raw: unknown): OpenGame[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((g): OpenGame[] => {
    if (!g || typeof g !== 'object') return [];
    const x = g as Record<string, unknown>;
    return [{
      room: Number(x.room) || 0, kind: x.kind === 'showdown' ? 'showdown' : 'classlive', activity: String(x.activity ?? ''),
      name: String(x.name ?? 'A game').slice(0, 40), moving: x.moving === true, classId: typeof x.class_id === 'string' ? x.class_id : null,
      who: String(x.who ?? 'Another class').slice(0, 40),
    }];
  });
}

const said = (g: OpenGame) => `${g.who} (${g.name})`;

/**
 * Why this game can't start now, or null when it can. `activity` is a Class Live activity or 'showdown' (any kind
 * counts the same); the class's own game doesn't count (opening a new one ends it).
 */
export function lockedBecause(_activity: string, open: OpenGame[], classId: string | null): string | null {
  const others = open.filter((g) => !classId || g.classId !== classId);
  if (others.length >= MAX_GAMES) {
    return `Only one live game can run at a time: ${others.slice(0, 2).map(said).join(' and ')} ${others.length > 1 ? 'are' : 'is'} on now. Try again when it finishes.`;
  }
  return null;
}
