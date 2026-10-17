import { describe, expect, it } from 'vitest';
import { GAMES, POWER_CLASH_ON, findGame } from './registry';
import { BOT_LEVELS, isBotLevel, isRanked } from './types';

describe('game registry', () => {
  it('has chess, checkers, Wormholes & Black Holes, 101 and Gem Keep', () => {
    expect(GAMES.map((g) => g.id)).toEqual(['chess', 'checkers', 'space', '101', 'gem-keep']);
  });

  it('keeps Power Clash off the dashboard until James switches it on', () => {
    expect(POWER_CLASH_ON).toBe(false);
    expect(findGame('power-clash')).toBeUndefined();
  });

  it('keeps Wormholes & Black Holes and 101 off the rankings', () => {
    expect(GAMES.filter(isRanked).map((g) => g.id)).toEqual(['chess', 'checkers']);
    expect(findGame('space')?.ranked).toBe(false);
    expect(findGame('101')?.ranked).toBe(false);
    expect(findGame('gem-keep')?.ranked).toBe(false);
  });

  it('gives every game a unique, URL-safe id', () => {
    const ids = GAMES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
  });

  it('finds games by id', () => {
    expect(findGame('chess')?.name).toBe('Chess');
    expect(findGame('snakes')).toBeUndefined();
    expect(findGame(undefined)).toBeUndefined();
  });
});

describe('bot levels', () => {
  it('are Very Easy, Easy and Medium', () => {
    expect(BOT_LEVELS.map((l) => l.label)).toEqual(['Very Easy', 'Easy', 'Medium']);
  });

  it('rejects unknown levels', () => {
    expect(isBotLevel('easy')).toBe(true);
    expect(isBotLevel('impossible')).toBe(false);
    expect(isBotLevel(null)).toBe(false);
  });
});
