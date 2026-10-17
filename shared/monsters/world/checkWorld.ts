/**
 * Checks all the maps together: every door leads somewhere real, and you can walk from the
 * start to every door, sign, person and trainer (nothing is walled in or blocks the way).
 */
import { DIRS, DELTA, type GameMap } from './types';
import { inMap, isBlocked, warpAt } from './walking';

export function checkWorld(maps: Record<string, GameMap>, start: { map: string; spot: string }): string[] {
  const problems: string[] = [];
  for (const m of Object.values(maps)) {
    for (const w of m.warps) {
      const to = maps[w.to];
      if (!to) {
        problems.push(`${w.id} leads to "${w.to}", which isn't a map`);
        continue;
      }
      if (!inMap(to, w.toX, w.toY)) problems.push(`${w.id} lands outside "${w.to}" (${w.toX},${w.toY})`);
      else if (isBlocked(to, w.toX, w.toY)) problems.push(`${w.id} lands on a blocked tile of "${w.to}" (${w.toX},${w.toY})`);
      else if (warpAt(to, w.toX, w.toY)) problems.push(`${w.id} lands on another door (${w.toX},${w.toY}), you'd be sent straight back`);
    }
  }
  if (problems.length) return problems;

  const first = maps[start.map]?.spots.find((s) => s.name === start.spot);
  if (!first) return [`the start spot "${start.spot}" is missing from "${start.map}"`];

  // Walk everywhere you can reach, going through doors, like a student would.
  const reached = new Map<string, Set<number>>();
  const doors = new Set<string>();
  const queue: [string, number, number][] = [[start.map, first.x, first.y]];
  while (queue.length) {
    const [id, x, y] = queue.pop()!;
    const map = maps[id];
    const seen = reached.get(id) ?? reached.set(id, new Set()).get(id)!;
    const k = y * map.width + x;
    if (seen.has(k)) continue;
    seen.add(k);
    const w = warpAt(map, x, y);
    if (w) {
      doors.add(w.id);
      queue.push([w.to, w.toX, w.toY]);
      continue; // stepping on a door takes you through it
    }
    for (const d of DIRS) {
      const nx = x + DELTA[d][0];
      const ny = y + DELTA[d][1];
      if (!isBlocked(map, nx, ny)) queue.push([id, nx, ny]);
    }
  }

  for (const m of Object.values(maps)) {
    const seen = reached.get(m.id);
    if (!seen) {
      problems.push(`you can never get to "${m.id}"`);
      continue;
    }
    for (const w of m.warps) if (!doors.has(w.id)) problems.push(`you can't reach the door ${w.id}`);
    for (const t of m.things) {
      const beside = DIRS.some((d) => seen.has((t.y + DELTA[d][1]) * m.width + t.x + DELTA[d][0]));
      if (!beside) problems.push(`you can't get next to ${t.kind} "${t.name || t.id}" in "${m.id}"`);
    }
    if (m.wild.length && !m.isGrass.some((g, i) => g && seen.has(i))) problems.push(`you can't reach any long grass in "${m.id}"`);
    for (const g of m.grass.keys()) if (m.isGrass[g] && m.walls[g] !== 0) problems.push(`long grass under a wall in "${m.id}" at ${g % m.width},${Math.floor(g / m.width)}`);
  }
  return problems;
}
