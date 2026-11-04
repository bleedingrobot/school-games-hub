import { describe, expect, it } from 'vitest';
import { newStats, type FactStats } from '../maths/leitner';
import { DAYS_PER_BASKET, finishChallenge, streamAfter } from './progress';
import { replay, type Tap } from './play';
import { ALL_KEYS, BACK_GOES, GOES_PER_ROUND, GUIDED_KEY, LEVELS, levelFor, levelKeys, makeRound, showRound, type Day, type Level, type Round } from './round';

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
    // Learning (box 0 or 1): full help; secure (2): faint; known well (3 or 4): numbers only.
    const records = [...inBox(one.slice(0, 2), 1), ...inBox(one.slice(2, 4), 2), ...inBox(one.slice(4, 5), 3)];
    const help = new Map(makeRound(7, records).goes.map((g) => [g.key, g.h]));
    const want = (i: number) => (i === 2 || i === 3 ? 'faint' : i === 4 ? 'none' : 'full');
    one.forEach((k, i) => expect(help.get(k)).toBe(want(i)));
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
