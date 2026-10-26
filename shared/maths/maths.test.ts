import { describe, expect, it } from 'vitest';
import { QUICK_MS, TOP_BOX } from './config';
import { afterAnswer, mastery, newStats } from './leitner';

const DAY1 = Date.parse('2026-10-15T22:00:00Z'); // 16 October in New Zealand
const DAY2 = DAY1 + 24 * 3600 * 1000;

describe('mastery boxes', () => {
  it('quick and right moves up a box, slow stays, wrong drops to box 1, and fluent needs two different days', () => {
    const s0 = newStats('mul:7x8');
    expect(afterAnswer(s0, true, 2000, DAY1).box).toBe(1);
    expect(afterAnswer({ ...s0, box: 2 }, true, QUICK_MS + 1, DAY1).box).toBe(2);
    expect(afterAnswer({ ...s0, box: 3 }, false, 1000, DAY1).box).toBe(1);
    let s = s0;
    for (let i = 0; i < 6; i++) s = afterAnswer(s, true, 1500, DAY1 + i * 60_000);
    expect(s.box).toBe(TOP_BOX - 1);
    expect(mastery(s)).toBe('secure');
    s = afterAnswer(s, true, 1500, DAY2);
    expect(mastery(s)).toBe('fluent');
  });
});
