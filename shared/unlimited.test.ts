import { describe, expect, it } from 'vitest';
import { isUnlimitedFor, nzToday } from './unlimited';

describe('unlimited turns today', () => {
  it('is on only for that game, on the New Zealand date it was set for', () => {
    // 11:30 pm UTC on 3 Nov is 12:30 pm on 4 Nov in New Zealand (daylight time).
    const now = new Date('2026-11-03T23:30:00Z');
    expect(nzToday(now)).toBe('2026-11-04');
    const days = { trader: '2026-11-04', monsters: '2026-11-03' };
    expect(isUnlimitedFor(days, 'trader', now)).toBe(true);
    expect(isUnlimitedFor(days, 'monsters', now)).toBe(false);
    expect(isUnlimitedFor(days, 'isles', now)).toBe(false);
    expect(isUnlimitedFor(null, 'trader', now)).toBe(false);
  });
});
