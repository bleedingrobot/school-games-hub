import { describe, expect, it } from 'vitest';
import { newStats } from './maths/leitner';
import { JUNIOR_MIN_THINK_MS, juniorAfterAnswer, thoughtOf } from './juniorQuick';

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
