import { describe, expect, it } from 'vitest';
import { ALL_GAMES, GAMES } from './registry';
import { isRanked } from './types';

describe('game registry', () => {
  it('gives every game a unique, URL-safe id and a dashboard group, and ranks only chess and checkers', () => {
    const ids = GAMES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
    expect(ALL_GAMES.filter((g) => !g.group)).toEqual([]);
    expect(GAMES.filter(isRanked).map((g) => g.id)).toEqual(['chess', 'checkers']);
  });
});
