import { describe, expect, it } from 'vitest';
import { KEY_COLOURS, RECIPES, makeLevel, roomAt, type Level } from './level';

/** Rooms you can reach from the start with the doors that are open (by key held or by answering). */
function reachable(level: Level, keys: Set<string>, canAnswer: boolean): Set<number> {
  const doorOf = new Map<string, number>();
  level.doors.forEach((d) => doorOf.set([...d.rooms].sort((a, b) => a - b).join('-'), d.id));
  const seen = new Set<number>([level.start]);
  const todo = [level.start];
  while (todo.length) {
    const here = todo.pop() as number;
    for (const [a, b] of level.edges) {
      const other = a === here ? b : b === here ? a : -1;
      if (other < 0 || seen.has(other)) continue;
      const id = doorOf.get([a, b].sort((x, y) => x - y).join('-'));
      if (id !== undefined) {
        const d = level.doors[id];
        const ok = d.kind === 'question' ? canAnswer : keys.has(d.kind);
        if (!ok) continue;
      }
      seen.add(other);
      todo.push(other);
    }
  }
  return seen;
}

describe('levels', () => {
  it('are the same every time they are made', () => {
    for (const r of RECIPES) {
      const a = makeLevel(r);
      const b = makeLevel(r);
      expect(Buffer.from(a.solid).equals(Buffer.from(b.solid))).toBe(true);
      expect(a.keys).toEqual(b.keys);
      expect(a.robots).toEqual(b.robots);
      expect(a.path).toEqual(b.path);
    }
  });

  it.each(RECIPES.map((r) => [r.id, r] as const))('%s can always be finished: keys come before their doors', (_id, recipe) => {
    const level = makeLevel(recipe);
    expect(level.doors.map((d) => d.kind)).toEqual(recipe.doors);
    const keys = new Set<string>();
    // Collect keys in order: each key's room must be reachable with the keys so far.
    for (const colour of KEY_COLOURS) {
      const key = level.keys.find((k) => k.colour === colour);
      if (!key) continue;
      expect(reachable(level, keys, true).has(key.room), `${colour} key reachable`).toBe(true);
      keys.add(colour);
    }
    const all = reachable(level, keys, true);
    expect(all.has(level.reactorRoom)).toBe(true);
    // Without answering, a level with a question door can't be finished; without a key neither.
    if (recipe.doors.length) expect(reachable(level, new Set(), false).has(level.reactorRoom)).toBe(false);
    expect(level.escapeSteps).toBeGreaterThan(0);
  });

  it('puts everything in open space', () => {
    for (const r of RECIPES) {
      const level = makeLevel(r);
      const open = (p: { x: number; y: number; z: number }) => level.solid[Math.floor(p.x) + level.nx * (Math.floor(p.y) + level.ny * Math.floor(p.z))] === 0;
      for (const list of [level.keys, level.pickups, level.pads, level.robots]) for (const p of list) expect(open(p)).toBe(true);
      expect(open(level.reactor)).toBe(true);
      expect(open(level.exit)).toBe(true);
      expect(roomAt(level, level.exit.x, level.exit.y, level.exit.z)).toBe(level.start);
    }
  });

  it('no door can be walked around', () => {
    for (const r of RECIPES) {
      const level = makeLevel(r);
      // With every key but no answers, a level with a question door can't reach the reactor; with answers but no keys, a level with a key door can't.
      const hasQ = r.doors.includes('question');
      const hasKey = r.doors.some((d) => d !== 'question');
      if (hasQ) expect(reachable(level, new Set(KEY_COLOURS), false).has(level.reactorRoom)).toBe(false);
      if (hasKey) expect(reachable(level, new Set(), true).has(level.reactorRoom)).toBe(false);
    }
  });
});
