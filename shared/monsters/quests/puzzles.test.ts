import { describe, expect, it } from 'vitest';
import { cratesStart, light, lockStart, push, PUZZLES, slide, slideStart, stepStone, stonesGrid, tryLock, turnDial, type CratesState, type Puzzle, type SlideDir, type SlideState } from './puzzles';

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
  it('every puzzle can be solved but not by luck, and a wrong move costs a try', () => {
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
  });
});
