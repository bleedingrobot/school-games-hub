import { describe, expect, it } from 'vitest';
import { newStats, type FactStats } from '../maths/leitner';
import { ALL_COUNT_KEYS } from '../maths/skillPacks/countingKeys';
import { BASKETS, FADE_GOOD, GOES_PER_ROUND as GOES, PASS_GOOD, STEPS, TOP_LEVEL, type Step } from './config';
import { DAYS_PER_FEAST, basketsAfter, finishChallenge, placeAfter } from './progress';
import { replay, slipsOf, type Tap } from './play';
import { GUIDED_KEY, STEP_PLAN, levelFor, makeRound, showGo, showRound, startFor, tapsAllowed, type Round } from './round';

const seeds = Array.from({ length: 40 }, (_, i) => i * 10007 + 1);
const steps: Step[] = [1, 2, 3, 4, 5, 6];
const rec = (key: string, box: number, attempts = 1): FactStats => ({ ...newStats(key), box, attempts });
const at = (p: object) => ({ step: 1, level: 5, goodInRow: 0, goodAtStep: 0, ...p });

describe('the round', () => {
  it('is the same for the same seed, has 7 new and 3 earlier goes (10 new at steps 1 and 2), weakest keys first', () => {
    for (const step of steps) {
      for (const seed of seeds) {
        const round = makeRound(seed, [], { step, level: 5 });
        expect(round).toEqual(makeRound(seed, [], { step, level: 5 }));
        expect(round.goes).toHaveLength(GOES);
        const fresh = new Set(STEP_PLAN[step].fresh.flatMap((p) => p.keys));
        expect(round.goes.filter((g) => fresh.has(g.key))).toHaveLength(STEP_PLAN[step].review.length ? 7 : 10);
        expect(showRound(round)).toHaveLength(GOES);
      }
    }
    for (const seed of seeds) {
      const g = makeRound(seed, [], { step: 1, level: 5, guided: true });
      expect(g.goes).toHaveLength(GOES);
      expect(g.goes[0]).toMatchObject({ key: GUIDED_KEY, l: TOP_LEVEL });
    }
    // The weakest keys come first: with every step-3 key but two at box 3, those two are asked.
    const keys = STEP_PLAN[3].fresh[0].keys;
    const records = keys.slice(0, 3).map((k) => rec(k, 3));
    for (const seed of seeds) {
      const asked = new Set(makeRound(seed, records, { step: 3 }).goes.map((g) => g.key));
      for (const k of keys.slice(3)) expect(asked.has(k), k).toBe(true);
    }
  });
});

describe('replaying the taps', () => {
  it('takes any count up to the pile for a give go and only the cards for the others; only the first tap of a go counts; the slip is named', () => {
    const round = makeRound(11, [], { step: 3, level: 3 });
    const goes = showRound(round);
    expect(goes.filter((g) => g.kind === 'give').length).toBeGreaterThan(0);
    const wobbly: Tap[] = goes.flatMap((g) => [{ pick: g.kind === 'give' ? g.answer + 1 : g.wrongs[0].n, ms: 3000 }, { pick: g.answer, ms: 2000 }]);
    const end = replay(round, wobbly);
    expect(end).toMatchObject({ done: true, mistakes: GOES, firstRight: 0 });
    expect(end.answers.every((a) => !a.correct)).toBe(true);
    goes.forEach((g, i) => {
      if (g.kind !== 'give') return;
      const before = goes.slice(0, i).map((x) => ({ pick: x.answer, ms: 1 }));
      expect(() => replay(round, [...before, { pick: g.pile + 1, ms: 1 }])).toThrow();
    });
    expect(slipsOf(round, wobbly).every((s, i) => s === (goes[i].kind === 'give' ? 'over' : goes[i].wrongs[0].kind))).toBe(true);
    const under = goes[0].kind === 'give' ? 0 : -1;
    expect(slipsOf(round, [{ pick: under, ms: 1 }].filter(() => under >= 0))[0] ?? 'under').toBe('under');
    const clean = goes.map((g) => ({ pick: g.answer, ms: 1500 }));
    expect(replay(round, clean)).toMatchObject({ done: true, mistakes: 0, firstRight: GOES });
  });
});

describe('the baskets', () => {
  it('make the Golden Berry Feast at thirty finished days; a second finish the same NZ day changes nothing; a missed day loses nothing', () => {
    let days = 0;
    let last: string | null = null;
    for (let d = 0; d < DAYS_PER_FEAST; d++) {
      const day = new Date(Date.UTC(2026, 10, 1 + d * 2, 4)).toISOString().slice(0, 10); // every other day: missed days between
      const r = finishChallenge(days, last, day);
      expect(r.changed).toBe(d % BASKETS);
      expect(r.feast).toBe(d === DAYS_PER_FEAST - 1);
      const again = finishChallenge(r.daysDone, r.lastDay, day);
      expect(again).toMatchObject({ daysDone: r.daysDone, changed: null, feast: false });
      days = r.daysDone;
      last = r.lastDay;
    }
    expect(days).toBe(30);
    expect(basketsAfter(10).baskets).toEqual(Array(BASKETS).fill('bronze'));
    expect(basketsAfter(30)).toMatchObject({ feasts: 1, friend: 'kiwi', day: 0 });
    expect(basketsAfter(0).baskets.every((m) => m === 'plain')).toBe(true);
  });
});

describe('help and place', () => {
  it('fades after two good challenges (7 or more), returns after a hard one, passes a step after two of 8 or more, and a wrong tap raises that go\'s help', () => {
    expect([FADE_GOOD, PASS_GOOD]).toEqual([7, 8]);
    expect(placeAfter(at({ goodInRow: 1 }), 7)).toEqual(at({ level: 4 }));
    expect(placeAfter(at({ level: 3, goodInRow: 1 }), 7)).toEqual(at({ level: 2 }));
    expect(placeAfter(at({ level: 3 }), 8)).toEqual(at({ level: 3, goodInRow: 1, goodAtStep: 1 }));
    expect(placeAfter(at({ level: 3, goodInRow: 1, goodAtStep: 1 }), 9)).toEqual(at({ step: 2, level: 2 })); // faded on the same round: stands
    expect(placeAfter(at({ level: 3, goodAtStep: 1 }), 8)).toEqual(at({ step: 2, level: 5 })); // a pass without a fade brings two back
    expect(placeAfter(at({ level: 3, goodInRow: 1 }), 4)).toEqual(at({ level: 4 }));
    expect(placeAfter(at({ level: 2, goodInRow: 1, goodAtStep: 1 }), 7).step).toBe(1); // 7 fades but does not pass the step
    expect(placeAfter(at({ step: 6, level: 0, goodAtStep: 1 }), 10).step).toBe(6);
    expect(levelFor(2, 0, false, 'fade')).toEqual({ level: 2, peek: false });
    expect(levelFor(2, 1, false, 'fade').level).toBe(3);
    expect(levelFor(2, 2, false, 'fade').level).toBe(TOP_LEVEL);
    expect(levelFor(1, 0, false, 'fade').peek).toBe(true);
    expect(levelFor(0, 0, false, 'off')).toEqual({ level: 0, peek: false });
    expect(levelFor(0, 0, true, 'fade').level).toBe(TOP_LEVEL);
    expect(makeRound(9, [], { level: 2, help: 'always' }).goes.every((g) => g.l === 4)).toBe(true);
    expect(makeRound(9, [], { level: 2, help: 'off' }).goes.every((g) => g.l === 0)).toBe(true);
  });
});

describe('the wrong cards', () => {
  it('are never the right answer, are all different, and each matches its named slip, for every key', () => {
    const named: Record<string, (go: { n: number; answer: number }) => number[]> = {
      double: (g) => [g.n + 1], skip: (g) => [g.n - 1], row: (g) => [g.n - 2], lots: (g) => [g.n + 4],
      same: (g) => [g.n], again: (g) => [g.n + 2], one: () => [1],
    };
    for (const key of ALL_COUNT_KEYS) {
      for (let seed = 1; seed <= 20; seed++) {
        const go = showGo({ seed }, 0, { key, l: 3 })!;
        expect(go, key).not.toBeNull();
        if (go.kind === 'give') {
          expect(go.wrongs).toEqual([]);
          expect(go.pile).toBeGreaterThan(go.answer);
          expect(tapsAllowed(go)).toContain(go.answer);
          continue;
        }
        expect(go.wrongs, key).toHaveLength(3);
        expect(go.choices, key).toHaveLength(4);
        expect(new Set(go.choices).size, key).toBe(4);
        expect(go.choices).toContain(go.answer);
        for (const w of go.wrongs) {
          expect(w.n, key).not.toBe(go.answer);
          expect(w.n, key).toBeGreaterThanOrEqual(1);
          if (w.kind !== 'near') expect(named[w.kind](go), `${key} ${w.kind}`).toContain(w.n);
        }
        expect(go.points).toHaveLength(go.kind === 'counton' ? go.n : go.n);
      }
    }
  });
});

describe('where a child starts', () => {
  it('is step 1 with the most help for everyone, whatever their records say', () => {
    const strong = ['bond10:3+7', 'bond10:4+6', 'bond10:2+8', 'dbl:3', 'tenand:4'].map((k) => rec(k, 4, 9));
    expect(startFor([])).toEqual({ step: 1, level: TOP_LEVEL });
    expect(startFor(strong)).toEqual({ step: 1, level: TOP_LEVEL });
    expect(STEPS).toHaveLength(6);
    const round: Round = makeRound(5, strong);
    expect(round).toMatchObject({ step: 1, level: TOP_LEVEL });
    expect(round.goes.every((g) => g.key.startsWith('give:n') && Number(g.key.slice(6)) <= 5)).toBe(true);
  });
});
export { GUIDED_KEY };
