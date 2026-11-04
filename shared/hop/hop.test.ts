import { describe, expect, it } from 'vitest';
import { newStats, type FactStats } from '../maths/leitner';
import { finishChallenge, pondAfter, DAYS_PER_JAR } from './progress';
import { replay, type Tap } from './play';
import { BACK_HOPS, HOPS_PER_ROUND, makeRound, showRound, stepFor, stepKeys, STEPS, type Round } from './round';

const seeds = Array.from({ length: 60 }, (_, i) => i * 10007 + 1);
const secure = (keys: string[]): FactStats[] => keys.map((key) => ({ ...newStats(key), box: 2 }));
/** Records that put a child on each step: none, 10s secure, 10s and 5s secure. */
const recordsFor = { 10: [], 5: secure(stepKeys(10)), 2: secure([...stepKeys(10), ...stepKeys(5)]) } as Record<number, FactStats[]>;

/** One wrong glow-worm on every hop, then the right one. */
const wobblyTaps = (round: Round): Tap[] =>
  showRound(round).flatMap((hop) => [{ pick: hop.choices.find((c) => c !== hop.answer)!, ms: 4000 }, { pick: hop.answer, ms: 2000 }]);

describe('the round', () => {
  it('is the same for the same seed, and every round can be finished with a right glow-worm on every hop', () => {
    for (const step of STEPS) {
      for (const gold of [false, true]) {
        for (const seed of seeds) {
          const round = makeRound(seed, recordsFor[step], { gold });
          expect(round).toEqual(makeRound(seed, recordsFor[step], { gold }));
          expect(round.step).toBe(step);
          expect(new Set(round.hops.map((h) => h.key)).size).toBe(HOPS_PER_ROUND);
          const hops = showRound(round);
          for (const hop of hops) {
            expect(hop.choices).toHaveLength(4);
            expect(hop.choices.filter((c) => c === hop.answer)).toHaveLength(1);
            expect(hop.parts.filter((p) => p.startsWith('?'))).toHaveLength(1);
          }
          const end = replay(round, wobblyTaps(round));
          expect(end).toMatchObject({ done: true, hopsMade: HOPS_PER_ROUND, mistakes: HOPS_PER_ROUND });
          // Each hop counts once for the maths records: wrong, as the first glow-worm was wrong.
          expect(end.answers).toEqual(hops.map((h) => ({ key: h.key, correct: false, ms: 4000 })));
          expect(() => replay(round, [{ pick: 999, ms: 1 }])).toThrow();
        }
      }
    }
  });

  it('asks counting back only on gold days, as the last three hops', () => {
    for (const seed of seeds) {
      expect(makeRound(seed, [], { gold: false }).hops.every((h) => !h.key.includes(':back:'))).toBe(true);
      const gold = makeRound(seed, [], { gold: true }).hops.map((h) => h.key.includes(':back:'));
      expect(gold).toEqual([...Array(HOPS_PER_ROUND - BACK_HOPS).fill(false), ...Array(BACK_HOPS).fill(true)]);
    }
  });
});

describe('the step', () => {
  it('moves 10s to 5s to 2s only once 70% of counting up and what comes next is secure, and never drops back', () => {
    const tens = stepKeys(10);
    const need = Math.ceil(tens.length * 0.7);
    expect(stepFor(secure(tens.slice(0, need - 1)))).toBe(10);
    expect(stepFor(secure(tens.slice(0, need)))).toBe(5);
    // Counting back doesn't count towards moving up (it's only asked on gold days).
    const back10 = Array.from({ length: 9 }, (_, i) => `skip10:back:${(i + 1) * 10}`);
    expect(stepFor(secure([...tens.slice(0, need - 1), ...back10]))).toBe(10);
    expect(stepFor(recordsFor[2])).toBe(2);
    expect(stepFor(secure([...stepKeys(10), ...stepKeys(5), ...stepKeys(2)]))).toBe(2);
    // A child who reached 5s and then forgot some 10s stays on 5s.
    expect(stepFor([], 5)).toBe(5);
  });
});

describe('the magic pads', () => {
  it('turn bronze, silver, then gold, one per NZ day, with a jar and a new friend every 30 days', () => {
    expect(pondAfter(0)).toMatchObject({ jars: 0, friend: 'hop', help: 'full', gold: false, pads: Array(10).fill('green') });
    expect(pondAfter(3).pads.slice(0, 4)).toEqual(['bronze', 'bronze', 'bronze', 'green']);
    expect(pondAfter(10)).toMatchObject({ help: 'faint', today: 'silver', gold: false, pads: Array(10).fill('bronze') });
    expect(pondAfter(21)).toMatchObject({ help: 'none', today: 'gold', gold: true, pads: ['gold', ...Array(9).fill('silver')] });
    expect(pondAfter(DAYS_PER_JAR)).toMatchObject({ jars: 1, friend: 'gecko', day: 0, gold: false });
    expect(finishChallenge(0, null, '2026-11-04')).toEqual({ daysDone: 1, lastPadDay: '2026-11-04', padChanged: 0, jar: false });
    expect(finishChallenge(1, '2026-11-04', '2026-11-04')).toMatchObject({ daysDone: 1, padChanged: null });
    expect(finishChallenge(29, '2026-11-04', '2026-11-20')).toMatchObject({ daysDone: 30, padChanged: 9, jar: true });
  });
});
