import { describe, expect, it } from 'vitest';
import { schoolSeasonText, seasonText } from './teacher';

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

describe('Dragon Maths’ line once the school has one season date', () => {
  const school = (over = {}) => ({ start: '2026-08-31', pausedSince: null, number: 3, dayOfSeason: 23, daysLeft: 12, startsIn: null, canChange: false, ...over });

  it('shows the school’s season, whatever the class’s switch', () => {
    expect(schoolSeasonText(school())).toBe('Season 3, 12 days left');
    expect(schoolSeasonText(school({ daysLeft: 1 }))).toBe('Season 3, 1 day left');
    expect(schoolSeasonText(school({ daysLeft: 0 }))).toBe('Season 3, last day');
  });

  it('says “holiday pause” while the school is paused', () => {
    expect(schoolSeasonText(school({ pausedSince: '2026-12-18' }))).toBe('Season 3, holiday pause');
  });

  it('says when season 1 starts, or that it starts when a class switches on', () => {
    expect(schoolSeasonText(school({ number: null, dayOfSeason: null, daysLeft: null, startsIn: 5, start: '2026-11-02' }))).toBe('Season 1 starts in 5 days');
    expect(schoolSeasonText(school({ number: null, dayOfSeason: null, daysLeft: null, start: null }))).toBe('Starts when switched on');
  });
});
