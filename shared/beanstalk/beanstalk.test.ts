import { describe, expect, it } from 'vitest';
import { DAYS_PER_EGG, finishChallenge, stalkAfter } from './progress';
import { makeRound, ON_SCREEN, PAIRS_PER_ROUND, replay, TARGET, type Tap } from './round';

const seeds = Array.from({ length: 200 }, (_, i) => i * 10007 + 1);

/** A child who always finds a right pair among the floating leaves. */
function perfectTaps(seed: number): Tap[] {
  const round = makeRound(seed);
  const taps: Tap[] = [];
  for (let n = 0; n < PAIRS_PER_ROUND; n++) {
    const now = replay(round, taps).onScreen;
    const a = now[0];
    const b = now.find((j) => j !== a && round.leaves[a] + round.leaves[j] === TARGET);
    expect(b, `seed ${seed}: leaf ${a} has no partner floating`).toBeDefined();
    taps.push({ a, b: b!, ms: 1000 });
  }
  return taps;
}

describe('the round', () => {
  it('is ten pairs to 10 that can always be finished, the same for the same seed (200 seeds)', () => {
    for (const seed of seeds) {
      const round = makeRound(seed);
      expect(round).toEqual(makeRound(seed));
      expect(round.leaves).toHaveLength(2 * PAIRS_PER_ROUND);
      expect(round.leaves.every((n) => n >= 1 && n <= 9)).toBe(true);
      expect(replay(round, []).onScreen).toHaveLength(ON_SCREEN);
      const end = replay(round, perfectTaps(seed));
      expect(end).toMatchObject({ done: true, pairsMade: PAIRS_PER_ROUND, mistakes: 0, onScreen: [] });
    }
  });

  it('marks a wrong pair against the first leaf and leaves both floating', () => {
    const round = makeRound(42);
    const [a] = replay(round, []).onScreen;
    const b = replay(round, []).onScreen.find((j) => j !== a && round.leaves[a] + round.leaves[j] !== TARGET)!;
    const r = replay(round, [{ a, b, ms: 3000 }]);
    const lo = Math.min(round.leaves[a], TARGET - round.leaves[a]);
    expect(r.answers).toEqual([{ key: `bond10:${lo}+${TARGET - lo}`, correct: false, ms: 3000 }]);
    expect(r.onScreen).toContain(a);
    expect(r.onScreen).toContain(b);
    expect(() => replay(round, [{ a, b: a, ms: 1 }])).toThrow();
    expect(() => replay(round, [{ a, b: 19, ms: 1 }])).toThrow(); // the last leaf isn't floating yet
  });
});

describe('the magic leaves', () => {
  it('turn bronze, then silver, then gold, bottom leaf first, with an egg and a new friend every 30 days', () => {
    expect(stalkAfter(0)).toMatchObject({ eggs: 0, friend: 'kiwi', dots: 'full', leaves: Array(10).fill('green') });
    expect(stalkAfter(3).leaves.slice(0, 4)).toEqual(['bronze', 'bronze', 'bronze', 'green']);
    expect(stalkAfter(10)).toMatchObject({ dots: 'small', leaves: Array(10).fill('bronze') });
    expect(stalkAfter(21)).toMatchObject({ dots: 'none', leaves: ['gold', ...Array(9).fill('silver')] });
    expect(stalkAfter(DAYS_PER_EGG)).toMatchObject({ eggs: 1, friend: 'tui', day: 0, leaves: Array(10).fill('green') });
  });

  it('change one leaf on the first finish of a NZ day only', () => {
    expect(finishChallenge(0, null, '2026-11-04')).toEqual({ daysDone: 1, lastLeafDay: '2026-11-04', leafChanged: 0, egg: false });
    expect(finishChallenge(1, '2026-11-04', '2026-11-04')).toMatchObject({ daysDone: 1, leafChanged: null });
    expect(finishChallenge(29, '2026-11-04', '2026-11-20')).toMatchObject({ daysDone: 30, leafChanged: 9, egg: true });
  });
});
