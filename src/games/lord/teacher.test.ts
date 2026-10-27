import { describe, expect, it } from 'vitest';
import { seasonText } from './teacher';

describe('Dragon Maths’ line in the Games table', () => {
  const on = (seasonStart: string | null) => ({ enabled: true, seasonStart, pausedSince: null });

  it('says which season the class is in and how many days are left', () => {
    expect(seasonText(on('2026-10-28'), '2026-10-28')).toBe('Season 1, 34 days left');
    expect(seasonText(on('2026-09-01'), '2026-10-28')).toBe('Season 2, 12 days left');
    expect(seasonText(on('2026-09-24'), '2026-10-28')).toBe('Season 1, last day');
    expect(seasonText(on('2026-09-25'), '2026-10-28')).toBe('Season 1, 1 day left');
  });

  it('says when the first season starts', () => {
    expect(seasonText(on('2026-11-02'), '2026-10-28')).toBe('Season 1 starts in 5 days');
    expect(seasonText({ enabled: false, seasonStart: null, pausedSince: null }, '2026-10-28')).toBe('Starts when switched on');
  });

  it('while the game is off, shows the season as it stood the day the clock was paused', () => {
    expect(seasonText({ enabled: false, seasonStart: '2026-09-01', pausedSince: '2026-10-10' }, '2026-10-28')).toBe('Season 2 paused, 30 days left');
    expect(seasonText({ enabled: false, seasonStart: '2026-11-02', pausedSince: '2026-10-10' }, '2026-10-28')).toBe('Season 1 paused');
    // Off without a pause (it was never switched on): the clock runs.
    expect(seasonText({ enabled: false, seasonStart: '2026-09-01', pausedSince: null }, '2026-10-28')).toBe('Season 2, 12 days left');
  });
});
