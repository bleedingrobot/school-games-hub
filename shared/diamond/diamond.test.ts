import { describe, expect, it } from 'vitest';
import { botLevel } from './bot';
import { FIELD_H, LAST_LEVEL, RARE_GEMS, RARE_IDS, TICKS_PER_SECOND, gemOf, isRare, levelSpec, questionCap, type BoostId, type RareId } from './config';
import { levelKinds, levelResult, playLevel, starterLevel, startLevel, step } from './engine';
import { makeField, rareFor, rareIn } from './field';
import { applyResult, canStart, measures, newPlayer, newSeason, type Player } from './progress';
import { makeRandom } from './random';

const steady = { wobble: 4, choice: 3, maths: 0.6 };

describe('Diamond Drop rules', () => {
  it('replays a level exactly from its seed, drops, boosts and marks, so the server and the browser agree', () => {
    const boosts: BoostId[][] = [[], ['luckyCharm'], ['strongWinch', 'extraTime'], ['rockBlaster']];
    for (let level = 1; level <= LAST_LEVEL; level++) {
      const seed = 1000 + level * 77;
      const played = botLevel(level, seed, boosts[level % 4], steady, makeRandom(level));
      const input = { level, seed, drops: played.drops, boosts: boosts[level % 4], marks: played.marks, finish: played.finish };
      const replay = playLevel(input);
      expect(replay).toEqual(played.result);
      expect(playLevel(input)).toEqual(replay);
    }

    // Rare gems: the chances in config (rarest tried first), at most one a level, near the bottom, clear of everything.
    const n = 40000;
    const seen: Record<string, number> = {};
    for (let seed = 1; seed <= n; seed++) {
      const id = rareFor(seed) ?? 'none';
      seen[id] = (seen[id] ?? 0) + 1;
    }
    let none = 1;
    for (const g of [...RARE_GEMS].reverse()) {
      expect(Math.abs((seen[g.id] ?? 0) / n - none * g.chance)).toBeLessThan(0.01);
      none *= 1 - g.chance;
    }
    expect(Math.abs((seen.none ?? 0) / n - none)).toBeLessThan(0.01);
    let found = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const things = makeField(1 + (seed % LAST_LEVEL), seed);
      expect(things.filter((t) => isRare(t.gem)).length).toBeLessThanOrEqual(1);
      const r = rareIn(things);
      expect(r?.gem ?? null).toBe(rareFor(seed));
      if (!r) continue;
      found++;
      expect(gemOf(r.gem!).value).toBe(RARE_GEMS.find((g) => g.id === r.gem)!.value);
      expect(r.y).toBeGreaterThanOrEqual(380);
      expect(r.y).toBeLessThanOrEqual(FIELD_H - r.r);
      for (const t of things) if (t !== r && !t.crab) expect(Math.hypot(t.x - r.x, t.y - r.y)).toBeGreaterThan(t.r + r.r - 0.001);
    }
    expect(found).toBeGreaterThan(200);
    // A rare gem can be caught, and a level with one replays exactly.
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

  it('slips come only from the seed and the marks; a wrong mark drops the gem; nothing slips past the cap; the first go cannot miss', () => {
    let wrongDrops = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const level = 4 + (seed % 7);
      const { drops } = botLevel(level, seed, [], steady, makeRandom(seed));
      const held = playLevel({ level, seed, drops, marks: Array(8).fill(true) });
      const dropped = playLevel({ level, seed, drops, marks: [] });
      // The first slip is the same catch at the same moment whatever the marks.
      if (held.slips.length) expect(dropped.slips[0]).toMatchObject({ catchNo: held.slips[0].catchNo, tick: held.slips[0].tick, slot: 0 });
      for (const r of [held, dropped]) expect(r.questions).toBeLessThanOrEqual(questionCap(level));
      for (const slip of dropped.slips) {
        expect(slip.held).toBe(false);
        expect(slip.landed).toBeDefined();
        wrongDrops++;
      }
    }
    expect(wrongDrops).toBeGreaterThan(0);
    // With every answer wrong, once the questions run out the gems come up, so the Heart Diamond can still be found.
    let found = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const { result: r, marks } = botLevel(LAST_LEVEL, seed, [], { wobble: 2, choice: 1, maths: 0 }, makeRandom(seed));
      expect(marks.every((m) => m === false)).toBe(true);
      expect(r.questions).toBeLessThanOrEqual(questionCap(LAST_LEVEL));
      if (r.diamond) found++;
    }
    expect(found).toBeGreaterThan(0);
    // The guided first go: wherever the slow swing is when Drop is pressed, the first catch is the big quartz.
    for (let seed = 1; seed <= 1000; seed++) {
      const s = starterLevel(seed);
      const wait = (seed * 37) % 120;
      for (let t = 0; t < wait; t++) step(s);
      step(s, 'drop');
      while (s.phase === 'out') step(s);
      expect(s.shots[0].grabbed).toBe(0);
    }
  });

  it('passing, stars, and one new level a day across New Zealand midnight', () => {
    // Stars from a level's end: none if not passed, 1 for passing, 2 with 15 seconds left, 3 with every kind too.
    const s = startLevel(3, 5);
    const end = s.endTick;
    s.tick = end;
    s.banked = levelSpec(3).target - 1;
    expect(levelResult(s)).toMatchObject({ passed: false, stars: 0 });
    s.banked = levelSpec(3).target;
    s.passTick = end - 10 * TICKS_PER_SECOND;
    s.leftAtPass = 10 * TICKS_PER_SECOND;
    expect(levelResult(s).stars).toBe(1);
    s.passTick = end - 15 * TICKS_PER_SECOND;
    s.leftAtPass = 15 * TICKS_PER_SECOND;
    expect(levelResult(s).stars).toBe(2);
    for (const k of levelKinds(3)) s.caught[k] = 1;
    expect(levelResult(s)).toMatchObject({ passed: true, stars: 3 });

    // Pinned clock (NZ daylight time is UTC+13 in November): pass level 1 at 11:50 pm on 3 November, NZ time.
    const at = (iso: string) => new Date(iso);
    const lateTuesday = at('2026-11-03T10:50:00Z');
    const beforeMidnight = at('2026-11-03T10:59:00Z');
    const afterMidnight = at('2026-11-03T11:01:00Z');
    const win = { ...levelResult(startLevel(1, 9)), passed: true, stars: 1 as const };
    let p: Player = newPlayer();
    expect(canStart(p, 1, lateTuesday)).toBe(true);
    expect(canStart(p, 2, lateTuesday)).toBe(false);
    const first = applyResult(p, win, lateTuesday);
    p = first.player;
    expect(first.newLevel).toBe(true);
    expect(p.deepest).toBe(1);
    expect(canStart(p, 1, beforeMidnight)).toBe(true);
    expect(canStart(p, 2, beforeMidnight)).toBe(false);
    // A pass of level 2 sneaked in before midnight doesn't count as a new level.
    expect(applyResult(p, { ...win, level: 2 }, beforeMidnight).player.deepest).toBe(1);
    expect(canStart(p, 2, afterMidnight)).toBe(true);
    expect(canStart(p, 3, afterMidnight)).toBe(false);
    p = applyResult(p, { ...win, level: 2 }, afterMidnight).player;
    expect(p.deepest).toBe(2);
    expect(canStart(p, 3, afterMidnight)).toBe(false);

    // The rare gem collection is kept for good: counts, first date, new pages, and through a New Season.
    const rareDay = new Date('2026-11-18T01:00:00Z');
    const rareBase = { ...levelResult(startLevel(1, 9)), passed: true, stars: 1 as const };
    const caughtOf = (id: RareId) => ({ ...rareBase, caught: { ...rareBase.caught, [id]: 1 } });
    const firstRare = applyResult(newPlayer(), caughtOf('frostCrystal'), rareDay);
    expect(firstRare.newRare).toEqual(['frostCrystal']);
    expect(firstRare.player.lifetime.rare?.frostCrystal).toEqual({ count: 1, first: '2026-11-18' });
    const againRare = applyResult(firstRare.player, caughtOf('frostCrystal'), new Date('2026-11-19T01:00:00Z'));
    expect(againRare.newRare).toEqual([]);
    expect(againRare.player.lifetime.rare?.frostCrystal).toEqual({ count: 2, first: '2026-11-18' });
    const phoenix = applyResult(againRare.player, caughtOf('phoenixGem'), rareDay).player;
    expect(measures(phoenix)).toMatchObject({ diamond_rare_kinds: 2, diamond_rare_total: 3, diamond_phoenix: 1 });
    expect(phoenix.gemBook.frostCrystal).toBeUndefined();
    const nextSeason = newSeason(phoenix);
    expect(nextSeason.lifetime.rare).toEqual(phoenix.lifetime.rare);
    expect(nextSeason.gemBook).toEqual({});
  });

  it('on an unlimited day a second new level opens and counts, with no hub points; a normal day still refuses', () => {
    const day = new Date('2026-11-03T10:50:00Z');
    const win = { ...levelResult(startLevel(1, 9)), passed: true, stars: 3 as const };
    const first = applyResult(newPlayer(), win, day, true);
    expect(first.points).toBeGreaterThan(0);
    const p = first.player;
    expect(canStart(p, 2, day)).toBe(false);
    expect(canStart(p, 2, day, true)).toBe(true);
    expect(applyResult(p, { ...win, level: 2 }, day).player.deepest).toBe(1);
    const second = applyResult(p, { ...win, level: 2 }, day, true);
    expect(second).toMatchObject({ newLevel: true, points: 0 });
    expect(second.player.deepest).toBe(2);
    expect(second.coins).toBe(win.coins);
  });
});
