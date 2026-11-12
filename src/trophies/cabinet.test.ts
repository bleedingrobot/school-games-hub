import { describe, expect, it } from 'vitest';
import type { MyTrophy, TrophyType } from '../data/trophies';
import { GAMES } from '../games/registry';
import { metalLabel, nextMetalLine, nextSpots, shelfOrder, trophyGame, trophyPlace, winLine } from './cabinet';

const type = (id: string, game: string, repeat: TrophyType['repeat'] = 'season'): TrophyType => ({
  id, game, name: id, how: `Win ${id}`, kind: 'trophy', repeat, art: null,
});
const mine = (id: string, extra: Partial<MyTrophy> = {}): MyTrophy => ({
  ...type(id, 'chess'), tier: 'bronze', count: 1, firstAt: '2026-10-13T01:00:00Z', lastAt: '2026-10-13T01:00:00Z', isNew: false,
  wins: [{ season: 1, year: 2026, at: '2026-10-13T01:00:00Z', detail: {} }], ...extra,
});

describe('trophy cabinet rules', () => {
  it('finds the game by page id or home-card id, and puts favourites first in the pupil\'s order', () => {
    expect(trophyGame('lord')?.id).toBe('dragon-maths');
    expect(trophyGame('chess')?.id).toBe('chess');
    expect(trophyGame('hub')).toBeUndefined();
    expect([trophyPlace('training'), trophyPlace('chess'), trophyPlace('hub')]).toEqual(['Training', 'Chess', 'Games Hub']);
    const shelf = [mine('a'), mine('b'), mine('c'), mine('d')];
    expect(shelfOrder(shelf, ['c', 'gone', 'a']).map((t) => t.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('shows up to three next spots, only from games the class can see', () => {
    const switched = GAMES.find((g) => g.teacherSwitch)!;
    const next = [type('off', switched.id), type('nowhere', 'not-a-game'), type('hubby', 'hub'), type('c1', 'chess'), type('c2', 'chess'), type('c3', 'chess')];
    // While the switches load, switched games wait.
    expect(nextSpots(next, null).map((t) => t.id)).toEqual(['hubby', 'c1', 'c2']);
    expect(nextSpots(next, new Set([switched.id])).map((t) => t.id)).toEqual(['off', 'hubby', 'c1']);
  });

  it('says each win, the metal and what winning again would do in plain words', () => {
    const win = { season: 2, year: 2026, at: '2026-11-13T22:00:00Z', detail: {} };
    // 22:00 UTC is the next morning in New Zealand.
    expect(winLine({ repeat: 'season' }, win)).toBe('Season 2 · 14 Nov 2026');
    expect(winLine({ repeat: 'steps' }, win)).toBe('Step 2 · 14 Nov 2026');
    expect(winLine({ repeat: 'once' }, win)).toBe('14 Nov 2026');
    expect(metalLabel({ tier: 'gold', count: 4 })).toBe('Gold ×4');
    expect(metalLabel({ tier: 'silver', count: 1 })).toBe('Silver');
    expect(nextMetalLine(mine('a'), 1)).toBe('Win it again next season to make it silver.');
    expect(nextMetalLine(mine('a'), 2)).toBe('Win it again this season to make it silver!');
    expect(nextMetalLine(mine('a', { tier: 'gold', count: 3 }), 2)).toMatch(/^Gold!/);
    expect(nextMetalLine(mine('a', { repeat: 'once' }), 2)).toBeNull();
  });
});
