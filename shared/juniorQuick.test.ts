import { describe, expect, it } from 'vitest';
import { afterAnswer, newStats } from './maths/leitner';
import { JUNIOR_QUICK_MS } from './juniorQuick';

describe('the junior quick time', () => {
  const at = Date.UTC(2026, 10, 9, 0, 0);
  const box = (ms: number, quickMs?: number) => afterAnswer({ ...newStats('add:3+4'), box: 1 }, true, ms, at, quickMs).box;

  it('a correct answer in 8 seconds moves up a box for juniors but not at the usual 5 seconds; 11 seconds never does', () => {
    expect(box(8000, JUNIOR_QUICK_MS)).toBe(2);
    expect(box(8000)).toBe(1);
    expect(box(11_000, JUNIOR_QUICK_MS)).toBe(1);
  });
});
