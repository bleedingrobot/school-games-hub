import { describe, expect, it } from 'vitest';
import { whenPlayed } from './Dashboard';

describe('when a game was played', () => {
  const now = new Date(2026, 9, 15, 14, 0); // Thursday 15 October 2026, 2pm

  it('says Today, Yesterday, a weekday, then a date', () => {
    expect(whenPlayed(new Date(2026, 9, 15, 8, 30).toISOString(), now)).toBe('Today');
    expect(whenPlayed(new Date(2026, 9, 14, 23, 59).toISOString(), now)).toBe('Yesterday');
    expect(whenPlayed(new Date(2026, 9, 12, 10, 0).toISOString(), now)).toBe('Monday');
    expect(whenPlayed(new Date(2026, 8, 30, 10, 0).toISOString(), now)).toBe('30 Sept');
  });
});
