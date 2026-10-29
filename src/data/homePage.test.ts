import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import { fetchMyHomePage } from './homePage';

const answer = (movesLeft: unknown) => rpc.mockResolvedValue({ data: { movesLeft }, error: null });

describe('the season in the home page', () => {
  beforeEach(() => rpc.mockReset());

  it('reads the season clock out of moves left', async () => {
    answer({ lord: null, clans: null, season: { number: 2, day: 24, daysLeft: 12, clockOn: true } });
    expect((await fetchMyHomePage()).season).toEqual({ number: 2, day: 24, daysLeft: 12, clockOn: true });
  });

  it('is null when the answer has no season, a muddled one, or no moves left at all', async () => {
    answer({ lord: null, clans: null });
    expect((await fetchMyHomePage()).season).toBeNull();
    answer({ season: { number: 'x', day: 1 } });
    expect((await fetchMyHomePage()).season).toBeNull();
    rpc.mockResolvedValue({ data: {}, error: null });
    expect((await fetchMyHomePage()).season).toBeNull();
  });

  it('reads the Dragon Maths season, or null when it is off or missing', async () => {
    answer({ lord: null, clans: null });
    expect((await fetchMyHomePage()).lordSeason).toBeNull();
    answer({ lord: null, clans: null, lordSeason: { start: '2026-10-18', on: false } });
    expect((await fetchMyHomePage()).lordSeason).toBeNull();
    answer({ lord: { level: 3, exp: 5 }, clans: null, lordSeason: { start: '2020-01-01', on: true } });
    const got = (await fetchMyHomePage()).lordSeason;
    expect(got?.hero).toEqual({ level: 3, ready: false });
    expect(got?.clock.number).toBeGreaterThan(1);
  });
});
