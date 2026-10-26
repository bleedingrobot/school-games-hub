import { describe, expect, it } from 'vitest';
import { compileCourse } from './course';
import { clockSteps, makeWorld, newRun, stepRun } from './engine';
import { FALL_PENALTY_STEPS } from './config';

const E = 3; // east

describe('falling', () => {
  const gap = compileCourse({
    id: 'tiny', name: 'Tiny', rows: ['=======', '=s#..#f', '======='], heights: Array(3).fill('2222222'),
    route: [], medals: { gold: 2, silver: 4, bronze: 8 }, hardSeconds: 10,
  });
  it('falls into a gap, lands back at the start, and the clock gains the penalty', () => {
    const w = makeWorld(gap);
    const s = newRun(w);
    for (let i = 0; i < 200 && s.falls === 0; i++) stepRun(w, s, E);
    expect(s.falls).toBe(1);
    expect(s.penalty).toBe(FALL_PENALTY_STEPS);
    expect(s.x).toBe(1.5);
    expect(clockSteps(w, s)).toBe(s.steps + FALL_PENALTY_STEPS);
  });
});
