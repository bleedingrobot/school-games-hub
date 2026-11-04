import { describe, expect, it } from 'vitest';
import { isUnlimitedDay, nzToday } from './unlimited';

describe('unlimited turns today', () => {
  it('is on only for the New Zealand date it was set for', () => {
    // 11:30 pm UTC on 3 Nov is 12:30 pm on 4 Nov in New Zealand (daylight time).
    const now = new Date('2026-11-03T23:30:00Z');
    expect(nzToday(now)).toBe('2026-11-04');
    expect(isUnlimitedDay('2026-11-04', now)).toBe(true);
    expect(isUnlimitedDay('2026-11-03', now)).toBe(false);
    expect(isUnlimitedDay(null, now)).toBe(false);
    expect(isUnlimitedDay(undefined, now)).toBe(false);
  });
});
