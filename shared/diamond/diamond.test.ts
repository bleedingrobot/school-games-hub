import { describe, expect, it } from 'vitest';
import { botLevel } from './bot';
import { LAST_LEVEL, TICKS_PER_SECOND, levelSpec, questionCap, type BoostId } from './config';
import { levelKinds, levelResult, playLevel, starterLevel, startLevel, step } from './engine';
import { applyResult, canStart, newPlayer, type Player } from './progress';
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
  });
});
