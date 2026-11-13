import { describe, expect, it } from 'vitest';
import { cratesStart, light, lockStart, push, PUZZLES, slide, slideStart, stepStone, stonesGrid, tryLock, turnDial, type CratesState, type Puzzle, type SlideDir, type SlideState } from './puzzles';
import { WORLD_MAPS } from '../maps';
import { hatchRings } from '../world/questWorld';
import type { WorldState } from '../world/types';
import { findEgg, HATCH_SPOTS } from './eggs';
import { emptyQuestSave, type EggKind } from './types';

const DIRS: SlideDir[] = ['up', 'down', 'left', 'right'];

/** The fewest moves that solve a slide or crates puzzle (a search through every position), or -1. */
function fewest<S extends { done: boolean }>(start: S, moves: (s: S) => S[], key: (s: S) => string): number {
  let now = [start];
  const seen = new Set([key(start)]);
  for (let n = 0; n < 200 && now.length; n++) {
    if (now.some((s) => s.done)) return n;
    now = now.flatMap(moves).filter((s) => !seen.has(key(s)) && seen.add(key(s)));
  }
  return -1;
}

describe('the puzzles', () => {
  it('every puzzle can be solved but not by luck, a wrong move costs a try, and every egg spot glows once its egg is ready', () => {
    for (const p of PUZZLES as Puzzle[]) {
      if (p.kind === 'stones') {
        // A path of multiples crosses the pool, and the first column is not all multiples (a real choice).
        const g = stonesGrid(p);
        const solve = fewest({ at: null, tries: 0, done: false } as Parameters<typeof stepStone>[1], (s) => {
          const [r, c] = s.at ?? [-1, -1];
          const next: [number, number][] = s.at ? [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] : g.map((_, i) => [i, 0]);
          return next.map(([nr, nc]) => stepStone(p, s, nr, nc)).filter((x) => !x.splash);
        }, (s) => `${s.at}:${s.done}`);
        expect(solve, p.id).toBeGreaterThan(g[0].length);
        expect(g.map((row) => row[0] % p.multipleOf === 0).filter(Boolean).length, p.id).toBeLessThan(g.length);
        // One clear route: the multiples are exactly the count (start, start + n, …) in stepping order,
        // each next to the one before and to no other, with just one multiple by each bank.
        const path = g.flatMap((row, r) => row.flatMap((n, c): [number, number, number][] => (n % p.multipleOf === 0 ? [[n, r, c]] : []))).sort((a, b) => a[0] - b[0]);
        path.forEach(([n], i) => expect(n, p.id).toBe(path[0][0] + i * p.multipleOf));
        const touch = (a: number[], b: number[]) => Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) === 1;
        path.forEach((a, i) => path.forEach((b, j) => expect(touch(a, b), `${p.id} ${a[0]} ${b[0]}`).toBe(Math.abs(i - j) === 1)));
        expect(path[0][2], p.id).toBe(0);
        expect(path[path.length - 1][2], p.id).toBe(g[0].length - 1);
        expect(path.filter(([, , c]) => c === 0).length, p.id).toBe(1);
        expect(path.filter(([, , c]) => c === g[0].length - 1).length, p.id).toBe(1);
        // Walking the count crosses, and a tap on a stone that is not next to you says why.
        let s: Parameters<typeof stepStone>[1] = { at: null, tries: 0, done: false };
        expect(stepStone(p, s, path[1][1], path[1][2]).miss, p.id).toBe('start');
        for (const [, r, c] of path) s = stepStone(p, s, r, c);
        expect(stepStone(p, { at: [path[0][1], path[0][2]], tries: 0, done: false }, path[2][1], path[2][2]).miss, p.id).toBe('far');
        expect(stepStone(p, s, s.at![0], g[0].length).done, p.id).toBe(true);
        const wrong = g.findIndex((row) => row[0] % p.multipleOf !== 0);
        expect(stepStone(p, { at: null, tries: 0, done: false }, wrong, 0)).toMatchObject({ tries: 1, splash: true, at: null });
      }
      if (p.kind === 'slide') {
        const n = fewest<SlideState>(slideStart(p), (s) => DIRS.map((d) => slide(p, s, d)), (s) => `${s.at}`);
        expect(n, p.id).toBeGreaterThanOrEqual(3);
      }
      if (p.kind === 'crates') {
        const n = fewest<CratesState>(cratesStart(p), (s) => DIRS.map((d) => push(p, s, d)), (s) => `${s.you}|${[...s.crates].sort()}`);
        expect(n, p.id).toBeGreaterThanOrEqual(4);
      }
      if (p.kind === 'lanterns') {
        let s = { lit: [] as number[], tries: 0, done: false };
        const order = p.numbers.map((n, i) => [n, i]).sort((a, b) => a[0] - b[0]);
        expect(light(p, light(p, s, order[0][1]), order[2][1])).toEqual({ lit: [], tries: 1, done: false });
        for (const [, i] of order) s = light(p, s, i);
        expect(s.done, p.id).toBe(true);
      }
      if (p.kind === 'lock') {
        let s = lockStart(p);
        expect(tryLock(p, s).tries).toBe(1);
        p.code.split('').forEach((d, i) => {
          for (let k = 0; k < Number(d); k++) s = turnDial(s, i, 1);
        });
        expect(tryLock(p, s).done, p.id).toBe(true);
      }
    }
    expect(new Set(PUZZLES.map((p) => p.id)).size).toBe(PUZZLES.length);
    // Every egg's hatching spot is on its map, and its glowing ring shows there only once the egg is ready.
    for (const [kind, home] of Object.entries(HATCH_SPOTS)) {
      const map = WORLD_MAPS[home.map];
      const spot = map?.spots.find((s) => s.name === home.spot);
      expect(spot, kind).toBeDefined();
      const state = { quest: { ...emptyQuestSave(), eggs: [findEgg(`t:${kind}`, kind as EggKind, 0, () => 0)] } } as unknown as WorldState;
      expect(hatchRings(state, map, 0), kind).toEqual([]);
      expect(hatchRings(state, map, 20), kind).toEqual([{ x: spot!.x, y: spot!.y }]);
      expect(hatchRings(state, Object.values(WORLD_MAPS).find((m) => m.id !== home.map)!, 20), kind).toEqual([]);
    }
  });
});
