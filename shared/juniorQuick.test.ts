import { describe, expect, it } from 'vitest';
import { afterAnswer, newStats } from './maths/leitner';
import { JUNIOR_MIN_THINK_MS, JUNIOR_QUICK_MS, juniorAfterAnswer, thoughtOf } from './juniorQuick';

describe('the junior quick time', () => {
  const at = Date.UTC(2026, 10, 9, 0, 0);
  const box = (ms: number, quickMs?: number) => afterAnswer({ ...newStats('add:3+4'), box: 1 }, true, ms, at, quickMs).box;

  it('a correct answer in 8 seconds moves up a box for juniors but not at the usual 5 seconds; 11 seconds never does', () => {
    expect(box(8000, JUNIOR_QUICK_MS)).toBe(2);
    expect(box(8000)).toBe(1);
    expect(box(11_000, JUNIOR_QUICK_MS)).toBe(1);
  });
});

describe('the think floor (S14)', () => {
  const at = Date.UTC(2026, 10, 9, 0, 0);
  const start = { ...newStats('add:3+4'), box: 1 };

  it('a right answer at 9 ms is saved but is not quick; at 700 ms it moves up; a wrong one at 9 ms still drops to box 1', () => {
    const fast = juniorAfterAnswer(start, true, 9, at);
    expect(fast).toMatchObject({ box: 1, attempts: 1, correct: 1, avgMs: 9, quickDays: [] });
    expect(juniorAfterAnswer(start, true, 700, at)).toMatchObject({ box: 2, attempts: 1, correct: 1, avgMs: 700 });
    expect(juniorAfterAnswer({ ...start, box: 3 }, false, 9, at)).toMatchObject({ box: 1, attempts: 1, correct: 0, avgMs: 9 });
    expect(thoughtOf(JUNIOR_MIN_THINK_MS - 1)).toBe(false);
    expect(thoughtOf(JUNIOR_MIN_THINK_MS)).toBe(true);
  });
});
