import { describe, expect, it } from 'vitest';
import { botLevel } from './bot';
import { FIELD_H, LAST_LEVEL, RARE_GEMS, RARE_IDS, gemOf, isRare, type RareId } from './config';
import { levelResult, playLevel, startLevel } from './engine';
import { makeField, rareFor, rareIn } from './field';
import { applyResult, measures, newPlayer, newSeason } from './progress';
import { makeRandom } from './random';

const steady = { wobble: 4, choice: 3, maths: 0.6 };

describe('Diamond Drop rare gems', () => {
  it('turns up at the chances in config (rarest tried first), at most one a level', () => {
    const n = 40000;
    const seen: Record<string, number> = {};
    for (let seed = 1; seed <= n; seed++) {
      const id = rareFor(seed);
      seen[id ?? 'none'] = (seen[id ?? 'none'] ?? 0) + 1;
    }
    // Rarest first: each gem's share is its chance times the chance that no rarer one came first.
    let none = 1;
    for (const g of [...RARE_GEMS].reverse()) {
      const want = none * g.chance;
      expect(Math.abs((seen[g.id] ?? 0) / n - want)).toBeLessThan(0.01);
      none *= 1 - g.chance;
    }
    expect(Math.abs((seen.none ?? 0) / n - none)).toBeLessThan(0.01);
    expect(seen.phoenixGem).toBeGreaterThan(n * 0.005);
  });

  it('buries the rare gem near the bottom, clear of everything, and once at most', () => {
    let found = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const level = 1 + (seed % LAST_LEVEL);
      const things = makeField(level, seed);
      const rares = things.filter((t) => isRare(t.gem));
      expect(rares.length).toBeLessThanOrEqual(1);
      expect(rares[0]?.gem ?? null).toBe(rareFor(seed));
      const r = rareIn(things);
      if (!r) continue;
      found++;
      expect(r.y).toBeGreaterThanOrEqual(380);
      expect(r.y).toBeLessThanOrEqual(FIELD_H - r.r);
      for (const t of things) if (t !== r && !t.crab) expect(Math.hypot(t.x - r.x, t.y - r.y)).toBeGreaterThan(t.r + r.r - 0.001);
    }
    expect(found).toBeGreaterThan(200);
  });

  it('is the same field every time from the same seed, so the server replay agrees', () => {
    for (let seed = 1; seed <= 20; seed++) expect(makeField(5, seed)).toEqual(makeField(5, seed));
  });

  it('can be caught, and a level with one replays exactly', () => {
    let caught = 0;
    for (let seed = 1; seed <= 120 && caught < 3; seed++) {
      const level = 3 + (seed % 6);
      if (!rareFor(seed)) continue;
      const played = botLevel(level, seed, [], steady, makeRandom(seed));
      expect(playLevel({ level, seed, drops: played.drops, marks: played.marks, finish: played.finish })).toEqual(played.result);
      if (RARE_IDS.some((id) => (played.result.caught[id] ?? 0) > 0)) caught++;
    }
    expect(caught).toBeGreaterThan(0);
  });

  it('keeps the collection for good: counts, first date, new pages, and through a New Season', () => {
    const day = new Date('2026-11-18T01:00:00Z');
    const base = { ...levelResult(startLevel(1, 9)), passed: true, stars: 1 as const };
    const caughtOf = (id: RareId) => ({ ...base, caught: { ...base.caught, [id]: 1 } });
    const first = applyResult(newPlayer(), caughtOf('frostCrystal'), day);
    expect(first.newRare).toEqual(['frostCrystal']);
    expect(first.player.lifetime.rare?.frostCrystal).toEqual({ count: 1, first: '2026-11-18' });
    const again = applyResult(first.player, caughtOf('frostCrystal'), new Date('2026-11-19T01:00:00Z'));
    expect(again.newRare).toEqual([]);
    expect(again.player.lifetime.rare?.frostCrystal).toEqual({ count: 2, first: '2026-11-18' });
    const phoenix = applyResult(again.player, caughtOf('phoenixGem'), day).player;
    expect(measures(phoenix)).toMatchObject({ diamond_rare_kinds: 2, diamond_rare_total: 3, diamond_phoenix: 1 });
    // Rare gems aren't the season's gems: they don't fill the normal Gem Book's count.
    expect(phoenix.gemBook.frostCrystal).toBeUndefined();
    const next = newSeason(phoenix);
    expect(next.lifetime.rare).toEqual(phoenix.lifetime.rare);
    expect(next.gemBook).toEqual({});
  });

  it('looks rare gems up like any other gem', () => {
    for (const g of RARE_GEMS) expect(gemOf(g.id).value).toBe(g.value);
  });
});
