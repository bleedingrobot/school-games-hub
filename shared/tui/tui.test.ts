import { describe, expect, it } from 'vitest';
import { newStats, type FactStats } from '../maths/leitner';
import { DAYS_PER_NEST, finishChallenge, treeAfter } from './progress';
import { replay, type Tap } from './play';
import { GOES_PER_ROUND, GUIDED_KEY, KEYS, makeRound, pictureFor, placeAfter, showRound, startFor, STEPS, type HelpLevel, type HelpSetting, type Place, type Round } from './round';

const seeds = Array.from({ length: 60 }, (_, i) => i * 10007 + 1);
const inBox = (keys: string[], box: number): FactStats[] => keys.map((key) => ({ ...newStats(key), box }));

/** One wrong pick on every go, then the right one. */
const wobblyTaps = (round: Round): Tap[] =>
  showRound(round).flatMap((go) => [{ pick: go.choices.find((c) => c !== go.answer)!, ms: 4000 }, { pick: go.answer, ms: 2000 }]);

describe('the round', () => {
  it('is the same for the same seed, asks every fact in its step’s ways, and each fact counts once', () => {
    for (const { step, ways } of STEPS) {
      for (const level of [5, 3, 0] as HelpLevel[]) {
        for (const seed of seeds) {
          const records = inBox(KEYS.slice(0, 4), 2);
          const round = makeRound(seed, records, { step, level });
          expect(round).toEqual(makeRound(seed, records, { step, level }));
          expect(round.goes).toHaveLength(GOES_PER_ROUND);
          const keys = round.goes.map((g) => g.key);
          for (const k of KEYS) expect(keys).toContain(k);
          keys.slice(1).forEach((k, i) => expect(k).not.toBe(keys[i]));
          // Weakest first: the facts still in box 0 come before the secure ones.
          expect(KEYS.slice(0, 4)).not.toContain(keys[0]);
          expect(round.goes.every((g) => (ways as readonly number[]).includes(g.v))).toBe(true);
          // Steps 2 to 4: seven of the new way.
          if (step > 1 && step < 5) expect(round.goes.filter((g) => g.v === ways[ways.length - 1])).toHaveLength(7);
          for (const go of showRound(round)) {
            expect(go.choices.filter((c) => c === go.answer)).toHaveLength(1);
            expect(go.choices).toHaveLength(level >= 4 ? 3 : 4);
            expect(go.answer).toBe(go.v >= 2 ? go.n : 10 + go.n);
            // "How many?" goes show the reversal (41 for 14) as a wrong nest.
            if (go.v <= 1 && go.n >= 2) expect(go.choices).toContain(go.n * 10 + 1);
          }
          const end = replay(round, wobblyTaps(round));
          expect(end).toMatchObject({ done: true, goesDone: GOES_PER_ROUND, mistakes: GOES_PER_ROUND, firstRight: 0 });
          expect(end.answers.map((a) => a.key)).toEqual([...new Set(keys)]);
          expect(end.answers.every((a) => !a.correct)).toBe(true);
          expect(() => replay(round, [{ pick: 999, ms: 1 }])).toThrow();
        }
      }
    }
    // The teacher's setting: Always shows every berry, Off numbers only.
    for (const [help, l] of [['always', 4], ['off', 0], ['fade', 2]] as [HelpSetting, number][]) {
      expect(makeRound(9, [], { level: 2, help }).goes.every((g) => g.l === l)).toBe(true);
    }
    // The very first challenge starts with 10 and 2, "10 + 2", every berry counted in.
    for (const seed of seeds) expect(makeRound(seed, [], { guided: true, step: 3, level: 2 }).goes[0]).toEqual({ key: GUIDED_KEY, v: 0, l: 5 });
  });
});

describe('the help level and the step', () => {
  it('fade after two good challenges, come back after a hard one, and a new step brings two levels back', () => {
    const at = (p: Partial<Place>): Place => ({ step: 1, level: 5, goodInRow: 0, goodAtStep: 0, ...p });
    expect(placeAfter(at({}), 9)).toEqual(at({ goodInRow: 1, goodAtStep: 1 }));
    expect(placeAfter(at({ step: 5, goodInRow: 1 }), 8)).toEqual(at({ step: 5, level: 4, goodAtStep: 1 }));
    expect(placeAfter(at({ level: 2, goodInRow: 1 }), 6)).toEqual(at({ level: 2 }));
    expect(placeAfter(at({ level: 2, goodInRow: 1 }), 4)).toEqual(at({ level: 3 }));
    expect(placeAfter(at({ level: 5 }), 0).level).toBe(5);
    // A second good challenge at a step passes it: help drops a level, then two come back for the new way.
    expect(placeAfter(at({ step: 2, level: 3, goodInRow: 1, goodAtStep: 1 }), 10)).toEqual(at({ step: 3, level: 4 }));
    // A child who already knows it starts at step 3, help level 2.
    expect(startFor(inBox(KEYS.slice(0, 7), 2))).toEqual({ step: 3, level: 2 });
    expect(startFor(inBox(KEYS.slice(0, 6), 3))).toEqual({ step: 1, level: 5 });
  });

  it('a wrong tap brings more picture for that go, and never shows the answer', () => {
    const go = { l: 0 as HelpLevel, choices: [13, 14, 15, 41], answer: 14 };
    expect(pictureFor(go, 0)).toEqual({ level: 0, peekOpen: false, nests: go.choices });
    expect(pictureFor(go, 1).level).toBe(3);
    expect(pictureFor({ ...go, l: 1 }, 1)).toMatchObject({ level: 1, peekOpen: true });
    expect(pictureFor({ ...go, l: 3 }, 1).level).toBe(4);
    expect(pictureFor(go, 2).level).toBe(5);
    const third = pictureFor(go, 3, [13, 15, 41]);
    expect(third.nests).toHaveLength(2);
    expect(third.nests).toContain(14);
  });
});

describe('the kōwhai flowers', () => {
  it('turn bronze, silver, then gold, one per NZ day, with a Golden Nest and a new friend every 30 days', () => {
    expect(treeAfter(0)).toMatchObject({ nests: 0, friend: 'tui', today: 'bronze', flowers: Array(10).fill('bud') });
    expect(treeAfter(21)).toMatchObject({ today: 'gold', flowers: ['gold', ...Array(9).fill('silver')] });
    expect(treeAfter(DAYS_PER_NEST)).toMatchObject({ nests: 1, friend: 'kereru', day: 0 });
    expect(finishChallenge(0, null, '2026-11-04')).toEqual({ daysDone: 1, lastFlowerDay: '2026-11-04', flowerChanged: 0, goldenNest: false });
    expect(finishChallenge(1, '2026-11-04', '2026-11-04')).toMatchObject({ daysDone: 1, flowerChanged: null });
    expect(finishChallenge(29, '2026-11-04', '2026-11-20')).toMatchObject({ daysDone: 30, flowerChanged: 9, goldenNest: true });
  });
});
