import { describe, expect, it } from 'vitest';
import { emptyState, isKnown, recordAnswer } from './records';

describe('known needs bright green on two different days', () => {
  const fast = (s: ReturnType<typeof emptyState>, day: string) => recordAnswer(s, 'mul:6x7', 42, 42, 1300, day).state;

  it('two different days makes it known', () => {
    let s = fast(emptyState(), '2026-10-19');
    s = fast(s, '2026-10-20');
    expect(isKnown(s.records['mul:6x7'])).toBe(true);
  });

});

