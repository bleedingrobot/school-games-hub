import { describe, expect, it } from 'vitest';
import { DRAGON_WEEK_FROM, MASTERS_FROM, lordSeasonRoad, readLordSeason } from './seasonRoad';

const road = (day: number, hero: { level: number; ready: boolean } | null = null) => lordSeasonRoad({ number: 2, day }, hero);
const text = (h: { before: string; strong: string; after: string }) => h.before + h.strong + h.after;

describe('the Dragon Maths season road', () => {
  it('has the four stops in order, over the 35 days', () => {
    expect(MASTERS_FROM).toBe(15);
    expect(DRAGON_WEEK_FROM).toBe(29);
    const r = road(1);
    expect(r.stages.map((s) => [s.name, s.when])).toEqual([
      ['Forest', 'Days 1–14'], ['Masters', 'Days 15–28'], ['Dragon week', 'Days 29–35'], ['New season', 'Day 1 again'],
    ]);
  });

  it.each([
    [1, ['now', 'next', 'next', 'next']], [14, ['now', 'next', 'next', 'next']], [15, ['done', 'now', 'next', 'next']],
    [28, ['done', 'now', 'next', 'next']], [29, ['done', 'done', 'now', 'next']], [35, ['done', 'done', 'now', 'next']],
  ])('on day %i the stops are %j', (day, states) => {
    expect(road(day).stages.map((s) => s.state)).toEqual(states);
  });

  it('counts down to dragon week, then to the end of the season', () => {
    expect(text(road(10).headline)).toBe('19 days until dragon week. 26 days left in this season.');
    expect(road(10).headline.strong).toBe('19 days');
    expect(text(road(28).headline)).toBe('1 day until dragon week. 8 days left in this season.');
    expect(text(road(31).headline)).toBe('Dragon week! 5 days left to beat the Red Dragon this season.');
    expect(text(road(35).headline)).toBe('Last day of the season! Tomorrow every hero starts again. Your stars stay forever.');
  });

  it('gives the pupil their own line from their level', () => {
    expect(road(10).mine).toBe('');
    expect(road(10, { level: 7, ready: false }).mine).toBe('You are level 7: 5 more masters to the dragon.');
    expect(road(10, { level: 11, ready: false }).mine).toBe('You are level 11: 1 more master to the dragon.');
    expect(road(10, { level: 12, ready: false }).mine).toBe('You are level 12! Win in the forest to get ready for the Red Dragon.');
    expect(road(10, { level: 12, ready: true }).mine).toBe('You are ready: the Red Dragon is waiting. One try a day.');
  });

  it('fills the bar along the road and never past the last stop before the season ends', () => {
    expect(road(1).fill).toBe(0);
    expect(road(15).fill).toBeCloseTo(1 / 3);
    expect(road(29).fill).toBeCloseTo(2 / 3);
    expect(road(35).fill).toBeLessThan(0.97);
    for (let d = 2; d <= 35; d++) expect(road(d).fill).toBeGreaterThan(road(d - 1).fill);
  });

  it('has a sentence for screen readers', () => {
    expect(road(24).label).toBe('Season 2, day 24 of 35. Now: Masters. Next: Dragon week in 5 days.');
    expect(road(35).label).toBe('Season 2, day 35 of 35. Now: Dragon week. Next: New season in 1 day.');
  });
});

describe('reading the home page season', () => {
  it('works out the season and day from the school date, and the hero', () => {
    expect(readLordSeason({ start: '2026-10-18', on: true }, { level: 4, exp: 10 }, '2026-10-29')).toEqual({ clock: { number: 1, day: 12 }, hero: { level: 4, ready: false } });
    expect(readLordSeason({ start: '2026-10-18', on: true }, null, '2026-11-22')).toEqual({ clock: { number: 2, day: 1 }, hero: null });
    expect(readLordSeason({ start: '2026-10-18', on: true }, { level: 12, exp: 1e9 }, '2026-10-29')?.hero).toEqual({ level: 12, ready: true });
  });

  it('is null when the game is off, there is no date, the season has not started, or the answer is muddled', () => {
    expect(readLordSeason({ start: '2026-10-18', on: false }, null, '2026-10-29')).toBeNull();
    expect(readLordSeason({ start: null, on: true }, null, '2026-10-29')).toBeNull();
    expect(readLordSeason({ start: '2026-11-02', on: true }, null, '2026-10-29')).toBeNull();
    expect(readLordSeason({ start: 'soon', on: true }, null, '2026-10-29')).toBeNull();
    expect(readLordSeason(undefined, null, '2026-10-29')).toBeNull();
  });
});
