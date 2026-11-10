import { describe, expect, it } from 'vitest';
import { newStats, type FactStats } from '../maths/leitner';
import { seeded } from '../seededRandom';
import { DAYS_PER_BASKET, finishChallenge, streamAfter } from './progress';
import { replay, type Tap } from './play';
import { ALL_KEYS, BACK_GOES, bondLine, helpForStats, pebbleAskLine, pebbleDoneLine, pebbleFewLine, pebbleManyLine, pebbleRightLine, pebbleShowLine, pebblesFor, splitFirstLine, splitRestLine, GOES_PER_ROUND, GUIDED_KEY, LEVELS, levelFor, levelKeys, makeRound, showRound, type Day, type Level, type Round } from './round';

const seeds = Array.from({ length: 60 }, (_, i) => i * 10007 + 1);
const inBox = (keys: string[], box: number): FactStats[] => keys.map((key) => ({ ...newStats(key), box }));
/** Records that put a child on each level. */
const recordsFor = (level: Level) => inBox(LEVELS.filter((l) => l.level < level).flatMap((l) => levelKeys(l.level)), 2);

/** One wrong pick on every go, then the right one. */
const wobblyTaps = (round: Round): Tap[] =>
  showRound(round).flatMap((go) => [{ pick: go.choices.find((c) => c !== go.answer)!, ms: 4000 }, { pick: go.answer, ms: 2000 }]);

describe('the round', () => {
  it('is the same for the same seed, crosses ten every go, asks every fact of the level, and each fact counts once', () => {
    expect(ALL_KEYS).toHaveLength(20);
    expect(levelKeys(1)).toHaveLength(8);
    for (const { level } of LEVELS) {
      for (const day of ['bronze', 'silver', 'gold'] as Day[]) {
        for (const seed of seeds) {
          const round = makeRound(seed, recordsFor(level), { day });
          expect(round).toEqual(makeRound(seed, recordsFor(level), { day }));
          expect(round.level).toBe(level);
          expect(round.goes).toHaveLength(GOES_PER_ROUND);
          const keys = round.goes.map((g) => g.key);
          if (level < 4) for (const k of levelKeys(level)) expect(keys).toContain(k);
          keys.slice(1).forEach((k, i) => expect(k).not.toBe(keys[i]));
          // Bronze days: bigger number first. Gold days end with two hop-backs.
          expect(round.goes.slice(-BACK_GOES).every((g) => g.v === 2)).toBe(day === 'gold');
          if (day === 'bronze') expect(round.goes.every((g) => g.v === 1)).toBe(true);
          for (const go of showRound(round)) {
            expect(go.choices.filter((c) => c === go.answer)).toHaveLength(1);
            expect(go.choices).toHaveLength(4);
            // Every go crosses ten: the hops split into some to the big rock and at least one after it.
            expect(go.toTen).toBeGreaterThan(0);
            expect(go.rest).toBeGreaterThan(0);
            expect(go.kind === 'back' ? go.from - go.toTen - go.rest : go.from + go.toTen + go.rest).toBe(go.answer);
            expect(go.toTenChoices).toContain(go.toTen);
          }
          const end = replay(round, wobblyTaps(round));
          expect(end).toMatchObject({ done: true, goesDone: GOES_PER_ROUND, mistakes: GOES_PER_ROUND });
          expect(end.answers.map((a) => a.key)).toEqual([...new Set(keys)]);
          expect(end.answers.every((a) => !a.correct)).toBe(true);
          expect(() => replay(round, [{ pick: 999, ms: 1 }])).toThrow();
        }
      }
    }
    // The very first challenge starts with 9 + 2, bigger first, full help.
    for (const seed of seeds) expect(makeRound(seed, [], { guided: true, day: 'bronze' }).goes[0]).toEqual({ key: GUIDED_KEY, v: 1, h: 'full' });
  });
});

describe('the level and the help', () => {
  it('moves up once 70% of a level is secure and never drops back; each fact’s help fades with its own record', () => {
    const one = levelKeys(1);
    expect(levelFor(inBox(one.slice(0, 5), 2))).toBe(1);
    expect(levelFor(inBox(one.slice(0, 6), 2))).toBe(2);
    expect(levelFor(recordsFor(4))).toBe(4);
    expect(levelFor(inBox(ALL_KEYS, 4))).toBe(4);
    expect(levelFor([], 3)).toBe(3);
    // Full until secure and quick on one day (or right and quick from the start); split-first until fluent and right 8 times; faint until right 12; then none.
    const two = ['2026-11-04', '2026-11-05'];
    const rec = (key: string, box: number, correct: number, quickDays: string[]): FactStats => ({ ...newStats(key), box, correct, quickDays });
    const records = [
      rec(one[0], 1, 1, two.slice(0, 1)), // learning
      rec(one[1], 3, 3, two.slice(0, 1)), // secure and quick on one day: split first (S25)
      rec(one[2], 2, 4, two), // secure on two days: split first
      rec(one[3], 4, 6, two), // fluent, not yet right 8 times: split first
      rec(one[4], 4, 9, two), // faint
      rec(one[5], 4, 12, two), // numbers only
    ];
    const help = new Map(makeRound(7, records).goes.map((g) => [g.key, g.h]));
    const want = ['full', 'split', 'split', 'split', 'faint', 'none', 'full', 'full'];
    one.forEach((k, i) => expect(help.get(k)).toBe(want[i]));
    expect(helpForStats(undefined)).toBe('full');
    // S25: right and quick twice on one day leaves full help; a wrong answer brings it back.
    const quick1 = { ...newStats('k'), box: 2, correct: 2, attempts: 2, quickDays: ['2026-11-04'] };
    expect(helpForStats(quick1)).toBe('split');
    expect(helpForStats({ ...quick1, box: 1, attempts: 3 })).toBe('full');
    expect(pebblesFor('full') && pebblesFor('split') && !pebblesFor('faint') && !pebblesFor('none')).toBe(true);
  });
});

describe('the magic stones', () => {
  it('turn bronze, silver, then gold, one per NZ day, with a Golden Picnic Basket and a new friend every 30 days', () => {
    expect(streamAfter(0)).toMatchObject({ baskets: 0, friend: 'weka', today: 'bronze', stones: Array(10).fill('grey') });
    expect(streamAfter(10)).toMatchObject({ today: 'silver', stones: Array(10).fill('bronze') });
    expect(streamAfter(21)).toMatchObject({ today: 'gold', stones: ['gold', ...Array(9).fill('silver')] });
    expect(streamAfter(DAYS_PER_BASKET)).toMatchObject({ baskets: 1, friend: 'kiwi', day: 0 });
    expect(finishChallenge(0, null, '2026-11-04')).toEqual({ daysDone: 1, lastStoneDay: '2026-11-04', stoneChanged: 0, goldenBasket: false });
    expect(finishChallenge(1, '2026-11-04', '2026-11-04')).toMatchObject({ daysDone: 1, stoneChanged: null });
    expect(finishChallenge(29, '2026-11-04', '2026-11-20')).toMatchObject({ daysDone: 30, stoneChanged: 9, goldenBasket: true });
  });
});

describe('the split after each go', () => {
  it('says how the smaller number was split: to the big rock first, then the rest', () => {
    const add = { kind: 'add' as const, small: 5, big: 9, total: 14, toTen: 1, rest: 4 };
    expect(bondLine(add)).toBe('You solved 9 + 5 by splitting the 5 into 1 and 4. You added the 1 first to make ten, then the other 4.');
    expect(bondLine(add, true)).toMatch(/^You solved 9 plus 5 /);
    expect(bondLine({ ...add, kind: 'turn', small: 5, big: 8, total: 13, toTen: 2, rest: 3 }))
      .toBe('You solved 5 + 8 by starting on 8 and splitting the 5 into 2 and 3. You added the 2 first to make ten, then the other 3.');
    expect(bondLine({ kind: 'back', small: 5, big: 8, total: 13, toTen: 3, rest: 2 }, true))
      .toBe('You solved 13 take away 5 by splitting the 5 into 3 and 2. You took away the 3 first to get to ten, then the other 2.');
  });
});

describe('split first and the pebbles', () => {
  it('asks for the part that gets to ten, then the rest, and repeats the same question with pebbles', () => {
    const add = { kind: 'add' as const, small: 5, big: 8, total: 13, toTen: 2, rest: 3 };
    expect(splitFirstLine(add)).toBe('8 plus 5. Split the 5 to get to ten. How many hops from 8 to the big rock?');
    expect(splitRestLine(add)).toBe('2 gets to ten. How many of the 5 are left?');
    expect(pebbleAskLine(add)).toBe('The same question with pebbles: 8 plus 5. Here are 8 gold and 5 silver. Drag the silver pebbles you need to make ten, then tap Check.');
    expect(pebbleAskLine({ ...add, kind: 'turn' })).toMatch(/^The same question with pebbles: 5 plus 8\./);
    expect(pebbleDoneLine(add)).toBe('8 and 2 make 10. 10 and 3 make 13.');
    expect(pebbleRightLine(add)).toBe('10 is full. 2 gone, 3 left. 8 and 2 make 10. 10 and 3 make 13.');
    expect(pebbleFewLine(1)).toBe('Not full yet. 1 more space.');
    expect(pebbleFewLine(3)).toBe('Not full yet. 3 more spaces.');
    expect(pebbleManyLine(1)).toBe('That is more than ten: 1 too many. Put it back.');
    expect(pebbleShowLine(add)).toBe('Let me show you. 10 is full. 2 gone, 3 left. 8 and 2 make 10. 10 and 3 make 13.');
  });
});

describe('moving onto the game kit (stage K1)', () => {
  /**
   * Weka moved onto shared/kit on 7 Nov 2026 with no change a child or teacher can see: old and new code were compared on
   * 4,000 rounds and 16,000 tap runs before the old code went. This digest is of the old code's results. It doesn't depend
   * on the wrong choices the shared pack makes. If Weka's help, goes or stones change on purpose, update the number (S25: full help now ends after one quick day, so the number changed).
   */
  it('keeps the same help, goes, answers and stones as before the move', () => {
    const days = ['2026-11-01', '2026-11-02', '2026-11-03'];
    const out: unknown[] = [];
    for (let i = 0; i < 300; i++) {
      const r = seeded(i * 7919 + 13);
      const records = ALL_KEYS.filter(() => r() < 0.7).map((key): FactStats => ({ ...newStats(key), box: Math.floor(r() * 6), correct: Math.floor(r() * 16), quickDays: days.slice(0, Math.floor(r() * 4)) }));
      const opts = { reached: (1 + Math.floor(r() * 4)) as Level, day: (['bronze', 'silver', 'gold'] as const)[Math.floor(r() * 3)], guided: r() < 0.1 };
      const round = makeRound(Math.floor(r() * 2147483647), records, opts);
      const taps = showRound(round).flatMap((go) => [
        ...go.choices.filter((c) => c !== go.answer).slice(0, Math.floor(r() * 3)).map((pick) => ({ pick, ms: 4000 })),
        { pick: go.answer, ms: Math.floor(r() * 9000) },
      ]);
      const { goesDone, mistakes, done, answers } = replay(round, taps);
      out.push(round, goesDone, mistakes, done, answers);
    }
    for (let d = 0; d < 100; d++) out.push(streamAfter(d), finishChallenge(d, null, days[0]), finishChallenge(d, days[0], days[0]));
    let hash = 5381;
    for (const ch of JSON.stringify(out)) hash = (hash * 33 + ch.charCodeAt(0)) % 2147483647;
    expect(hash).toBe(964958306);
  });
});
