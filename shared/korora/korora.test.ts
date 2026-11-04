import { describe, expect, it } from 'vitest';
import { newStats, type FactStats } from '../maths/leitner';
import { DAYS_PER_FISH, finishChallenge, poolAfter } from './progress';
import { replay, type Tap } from './play';
import { followsItsDouble, FAIR_GOES, GOES_PER_ROUND, GUIDED_KEY, LEVELS, levelFor, levelKeys, makeRound, showRound, type Level, type Round } from './round';

const seeds = Array.from({ length: 60 }, (_, i) => i * 10007 + 1);
const secure = (keys: string[]): FactStats[] => keys.map((key) => ({ ...newStats(key), box: 2 }));
/** Records that put a child on each level. */
const recordsFor = (level: Level) => secure(LEVELS.filter((l) => l.level < level).flatMap((l) => levelKeys(l.level)));

/** One wrong pick on every go, then the right one. */
const wobblyTaps = (round: Round): Tap[] =>
  showRound(round).flatMap((go) => [{ pick: go.choices.find((c) => c !== go.answer)!, ms: 4000 }, { pick: go.answer, ms: 2000 }]);

describe('the round', () => {
  it('is the same for the same seed, asks every fact of the level, never one twice in a row, and each fact counts once', () => {
    for (const { level } of LEVELS) {
      for (const gold of [false, true]) {
        for (const seed of seeds) {
          const round = makeRound(seed, recordsFor(level), { gold });
          expect(round).toEqual(makeRound(seed, recordsFor(level), { gold }));
          expect(round.level).toBe(level);
          expect(round.goes).toHaveLength(GOES_PER_ROUND);
          const keys = round.goes.map((g) => g.key);
          for (const k of levelKeys(level)) expect(keys).toContain(k);
          keys.slice(1).forEach((k, i) => expect(k).not.toBe(keys[i]));
          expect(keys.slice(-FAIR_GOES).every((k) => k.startsWith('oddeven:'))).toBe(gold);
          expect(keys.some((k) => k.startsWith('half:') && round.goes.find((g) => g.key === k)!.v !== 0)).toBe(false);
          const goes = showRound(round);
          for (const go of goes) {
            expect(go.choices.filter((c) => c === go.answer)).toHaveLength(1);
            expect(go.choices).toHaveLength(go.kind === 'fair' ? 2 : 4);
          }
          const end = replay(round, wobblyTaps(round));
          expect(end).toMatchObject({ done: true, goesDone: GOES_PER_ROUND, mistakes: GOES_PER_ROUND });
          expect(end.answers.map((a) => a.key)).toEqual([...new Set(keys)]);
          expect(end.answers.every((a) => !a.correct)).toBe(true);
          expect(() => replay(round, [{ pick: 999, ms: 1 }])).toThrow();
        }
      }
    }
    // A double comes just before its half when a round has both (double 4, then half of 8).
    const paired = seeds.map((seed) => makeRound(seed, recordsFor(2))).flatMap((r) => r.goes.map((g, i) => ({ g, i, r })))
      .filter(({ g }) => g.key === 'dbl:4').filter(({ r }) => r.goes.some((x) => x.key === 'half:8'));
    expect(paired.length).toBeGreaterThan(0);
    for (const { i, r } of paired) expect(followsItsDouble(r.goes, i + 1) || r.goes[i + 1]?.key !== 'half:8').toBe(true);
    expect(paired.filter(({ i, r }) => followsItsDouble(r.goes, i + 1)).length).toBeGreaterThan(paired.length / 2);
    // The very first challenge starts with double 2.
    for (const seed of seeds) expect(makeRound(seed, [], { guided: true }).goes[0].key).toBe(GUIDED_KEY);
  });
});

describe('the level', () => {
  it('moves up once 70% of a level is secure, and never drops back', () => {
    const one = levelKeys(1);
    expect(levelFor(secure(one.slice(0, 3)))).toBe(1);
    expect(levelFor(secure(one.slice(0, 4)))).toBe(2);
    expect(levelFor(recordsFor(4))).toBe(4);
    expect(levelFor(secure(LEVELS.flatMap((l) => levelKeys(l.level))))).toBe(4);
    expect(levelFor([], 3)).toBe(3);
  });
});

describe('the magic pebbles', () => {
  it('turn bronze, silver, then gold, one per NZ day, with a Golden Fish and a new friend every 30 days', () => {
    expect(poolAfter(0)).toMatchObject({ fish: 0, friend: 'korora', help: 'full', gold: false, pebbles: Array(10).fill('grey') });
    expect(poolAfter(10)).toMatchObject({ help: 'faint', today: 'silver', pebbles: Array(10).fill('bronze') });
    expect(poolAfter(21)).toMatchObject({ help: 'none', gold: true, pebbles: ['gold', ...Array(9).fill('silver')] });
    expect(poolAfter(DAYS_PER_FISH)).toMatchObject({ fish: 1, friend: 'hoiho', day: 0 });
    expect(finishChallenge(0, null, '2026-11-04')).toEqual({ daysDone: 1, lastPebbleDay: '2026-11-04', pebbleChanged: 0, goldenFish: false, shoesWon: null });
    expect(finishChallenge(9, null, '2026-11-04')).toMatchObject({ daysDone: 10, shoesWon: 'bronze', goldenFish: false });
    expect(finishChallenge(19, null, '2026-11-04')).toMatchObject({ daysDone: 20, shoesWon: 'silver' });
    expect(poolAfter(0).shoes).toBeNull();
    expect(poolAfter(10).shoes).toBe('bronze');
    expect(poolAfter(25).shoes).toBe('silver');
    expect(finishChallenge(1, '2026-11-04', '2026-11-04')).toMatchObject({ daysDone: 1, pebbleChanged: null });
    expect(finishChallenge(29, '2026-11-04', '2026-11-20')).toMatchObject({ daysDone: 30, pebbleChanged: 9, goldenFish: true, shoesWon: 'gold' });
  });
});
