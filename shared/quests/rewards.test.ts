import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COIN_POUCH, rewardFit } from './rewards';

describe('Game Coins', () => {
  it('pouch amounts match quest_coins_amount in the migration', () => {
    const sql = readFileSync(new URL('../../supabase/migrations/20261119000700_game_coins.sql', import.meta.url), 'utf8');
    const body = sql.slice(sql.indexOf('function public.quest_coins_amount'), sql.indexOf('end\n$$;', sql.indexOf('function public.quest_coins_amount')));
    const inSql = Object.fromEntries([...body.matchAll(/when '([a-z-]+)' then (\d+)/g)].map((m) => [m[1], Number(m[2])]));
    expect(inSql).toEqual(Object.fromEntries(Object.entries(COIN_POUCH).map(([game, p]) => [game, p.amount])));
  });

  it('fits coins only to games with money, and turns to games with daily turns', () => {
    expect(rewardFit('trader', 'coins')).toBeNull();
    expect(rewardFit('archery-fights', 'coins')).toBeNull();
    expect(rewardFit('monsters-battles', 'coins')).toMatch(/no coins/);
    // Bonus Turns Day fits games with daily turns, Toon Flap and Goblin Storm included.
    expect(rewardFit('toonflap-daily', 'turns')).toBeNull();
    expect(rewardFit('goblinstorm-total', 'turns')).toBeNull();
  });
});
