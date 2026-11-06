import { describe, expect, it } from 'vitest';
import { DAYS_PER_EGG, finishChallenge, stalkAfter } from './progress';
import { seeded } from '../seededRandom';
import { bondKey, makeRound, ON_SCREEN, PAIRS_PER_ROUND, replay, TARGETS, type Round, type Target, type Tap } from './round';

const TARGET = 10;

const seeds = Array.from({ length: 200 }, (_, i) => i * 10007 + 1);

/** A child who always finds a right pair among the floating leaves. */
function perfectTaps(seed: number, target: Target = 10): Tap[] {
  const round = makeRound(seed, target);
  const taps: Tap[] = [];
  for (let n = 0; n < PAIRS_PER_ROUND; n++) {
    const now = replay(round, taps).onScreen;
    const a = now[0];
    const b = now.find((j) => j !== a && round.leaves[a] + round.leaves[j] === target);
    expect(b, `seed ${seed}: leaf ${a} has no partner floating`).toBeDefined();
    taps.push({ a, b: b!, ms: 1000 });
  }
  return taps;
}

/** No number floats twice, except the two 5s of 5 + 5 (maths review R4). */
function expectNoTwins(round: Round, onScreen: number[], where: string) {
  const numbers = onScreen.map((i) => round.leaves[i]).filter((n) => n !== round.target / 2);
  expect(new Set(numbers).size, `${where}: ${numbers.join(', ')}`).toBe(numbers.length);
}

describe('the round', () => {
  it('is ten pairs to 10, 100 or 1000 that can always be finished, the same for the same seed (200 seeds)', () => {
    for (const target of TARGETS) {
      const step = target / 10;
      for (const seed of seeds) {
        const round = makeRound(seed, target);
        expect(round).toEqual(makeRound(seed, target));
        expect(round.target).toBe(target);
        expect(round.leaves).toHaveLength(2 * PAIRS_PER_ROUND);
        // Whole tens (or hundreds) from 1 to 9 of them: no 0 + 100 (James, 4 Nov 2026), the same shape as the round to 10.
        expect(round.leaves.every((n) => n % step === 0 && n >= step && n <= 9 * step)).toBe(true);
        expect(round.leaves.map((n) => n / step)).toEqual(makeRound(seed).leaves);
        expect(replay(round, []).onScreen).toHaveLength(ON_SCREEN);
        const end = replay(round, perfectTaps(seed, target));
        expect(end).toMatchObject({ done: true, pairsMade: PAIRS_PER_ROUND, mistakes: 0, onScreen: [] });
        expect(end.answers.every((a) => a.key === bondKey(round.leaves[0], target))).toBe(target !== 10);
      }
    }
    expect(bondKey(30, 100)).toBe('bond100:tens');
    expect(bondKey(700, 1000)).toBe('bond1000:hundreds');
    expect(() => makeRound(1, 50 as Target)).toThrow();
  });

  it('never floats the same number twice, whichever right pairs a child taps first (200 seeds, every sum)', () => {
    for (const target of TARGETS) {
      for (const seed of seeds) {
        const round = makeRound(seed, target);
        const random = seeded(seed + 7);
        for (const order of ['in order', 'shuffled'] as const) {
          const taps: Tap[] = [];
          for (let r = replay(round, taps); !r.done; r = replay(round, taps)) {
            expectNoTwins(round, r.onScreen, `seed ${seed}, ${target}, ${order}, after ${taps.length} pairs`);
            // Any leaf with a partner floating; a shuffled child picks one at random.
            const pairs = r.onScreen.flatMap((a) => r.onScreen.filter((b) => b > a && round.leaves[a] + round.leaves[b] === target).map((b) => ({ a, b, ms: 900 })));
            expect(pairs.length, `seed ${seed}: nothing to pair`).toBeGreaterThan(0);
            taps.push(order === 'in order' ? pairs[0] : pairs[Math.floor(random() * pairs.length)]);
          }
          expect(taps).toHaveLength(PAIRS_PER_ROUND);
        }
      }
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
    const waiting = round.leaves.findIndex((_, i) => !replay(round, []).onScreen.includes(i));
    expect(() => replay(round, [{ a, b: waiting, ms: 1 }])).toThrow(); // a leaf that hasn't come in yet
    // The same taps always give the same answers and the same leaves floating (the server's replay is the browser's).
    expect(replay(round, perfectTaps(42))).toEqual(replay(makeRound(42), perfectTaps(42)));
  });
});

describe('the magic leaves', () => {
  it('turn bronze, then silver, then gold, bottom leaf first, with an egg and a new friend every 30 days', () => {
    expect(stalkAfter(0)).toMatchObject({ eggs: 0, friend: 'kiwi', dots: 'full', leaves: Array(10).fill('green') });
    expect(stalkAfter(3).leaves.slice(0, 4)).toEqual(['bronze', 'bronze', 'bronze', 'green']);
    expect(stalkAfter(10)).toMatchObject({ dots: 'small', leaves: Array(10).fill('bronze') });
    expect(stalkAfter(21)).toMatchObject({ dots: 'none', leaves: ['gold', ...Array(9).fill('silver')] });
    expect(stalkAfter(DAYS_PER_EGG)).toMatchObject({ eggs: 1, friend: 'tui', day: 0, leaves: Array(10).fill('green') });
    // Kiwi's pairs make 10, the tūī's 100, the kererū's 1000, then round again (James, 4 Nov 2026).
    expect([0, 1, 2, 3, 4, 5].map((eggs) => stalkAfter(eggs * DAYS_PER_EGG + 7).target)).toEqual([10, 100, 1000, 10, 100, 1000]);
  });

  it('change one leaf on the first finish of a NZ day only', () => {
    expect(finishChallenge(0, null, '2026-11-04')).toEqual({ daysDone: 1, lastLeafDay: '2026-11-04', leafChanged: 0, egg: false });
    expect(finishChallenge(1, '2026-11-04', '2026-11-04')).toMatchObject({ daysDone: 1, leafChanged: null });
    expect(finishChallenge(29, '2026-11-04', '2026-11-20')).toMatchObject({ daysDone: 30, leafChanged: 9, egg: true });
  });
});
