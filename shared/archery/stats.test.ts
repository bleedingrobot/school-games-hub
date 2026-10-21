import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STAT_KEYS, botFightStats, duelStats, onlyPlain, perfectRound } from './stats';

describe('achievement counts', () => {
  it('a Plain-only fight may still use helpers, but no other arrow', () => {
    expect(onlyPlain({})).toBe(true);
    expect(onlyPlain({ apple: 2, umbrella: 1 })).toBe(true);
    expect(onlyPlain({ steel: 1 })).toBe(false);
  });

  it('a bot fight counts only when it was won', () => {
    expect(botFightStats('forest', 'easy', false, {})).toEqual({});
    expect(botFightStats('forest', 'easy', true, { steel: 1 })).toEqual({ win_forest: 1 });
    expect(botFightStats('desert', 'hard', true, { apple: 1 })).toEqual({ win_desert: 1, plain_wins: 1, hawk_wins: 1 });
  });

  it('a classmate fight counts for both players, and the win for the winner', () => {
    expect(duelStats('snow', false, {})).toEqual({ duels: 1 });
    expect(duelStats('city', true, { giant: 1 })).toEqual({ duels: 1, duel_wins: 1, win_city: 1 });
    expect(duelStats('city', true, {})).toEqual({ duels: 1, duel_wins: 1, win_city: 1, plain_wins: 1 });
  });

  it('a perfect round is every question earning its coins', () => {
    expect(perfectRound(10, Array(10).fill(10))).toBe(true);
    expect(perfectRound(10, [...Array(9).fill(10), 0])).toBe(false);
    expect(perfectRound(10, Array(9).fill(10))).toBe(false);
    expect(perfectRound(0, [])).toBe(false);
  });

  it('every count is one the database keeps and measures', () => {
    const sql = readFileSync(resolve('supabase/migrations/20261022000200_archery_hub.sql'), 'utf8');
    for (const key of STAT_KEYS) {
      expect(sql).toContain(`'${key}'`);
      expect(sql).toContain(`p.stats ->> '${key}'`);
    }
  });
});
