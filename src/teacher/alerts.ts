/**
 * Helpers for the games' parts of Today's "Needs you" and the merged hardest questions (docs/TEACHER-VIEW-PLAN.md, stage 5).
 */
import type { TeacherAlert } from '../games/types';

/** Turned-down saves or requests count as needing the teacher for this long. Older ones stay in the game's own report. */
export const ALERT_DAYS = 7;

/**
 * One line per student with saves or requests a game turned down this week: "Maths Monsters turned down 3 saves from Speedy
 * Otter 27 this week". Made-up names only, since Today may be on a projector.
 */
export function refusalAlerts(
  refusals: { name: string; at: string }[],
  game: { id: string; name: string },
  thing: 'save' | 'request',
  now = Date.now(),
): TeacherAlert[] {
  const since = now - ALERT_DAYS * 24 * 60 * 60_000;
  const counts = new Map<string, number>();
  for (const r of refusals) {
    if (Date.parse(r.at) < since) continue;
    counts.set(r.name, (counts.get(r.name) ?? 0) + 1);
  }
  return [...counts].map(([name, n]) => ({
    id: `${game.id}:${name}`,
    text: `${game.name} turned down ${n === 1 ? `a ${thing}` : `${n} ${thing}s`} from ${name} this week`,
    section: `games/${game.id}`,
  }));
}
