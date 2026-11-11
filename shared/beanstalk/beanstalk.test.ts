import { describe, expect, it } from 'vitest';
import { afterDay, DAYS_PER_EGG, START_STEPS, sumSecure, type Steps } from './progress';
import { RECORD_KEY } from '../maths/skillPacks/generatedKit';
import type { FactAnswer} from '../maths/leitner';
import { handleBeanstalk} from './server';
import { memoryServices } from './memoryServices';
import { bondKey, factKeys, isMissingGo, makeRound, makeStageRound, ON_SCREEN, pairId, PAIRS_PER_ROUND, replay, targetOf, TARGETS, type Round, type Stage, type Target, type Tap } from './round';

const TARGET = 10;

const seeds = Array.from({ length: 200 }, (_, i) => i * 10007 + 1);

/** A child who always finds a right pair among the floating leaves. */
const perfectTaps = (seed: number, target: Target = 10): Tap[] => perfectTapsFor(makeRound(seed, target));

function perfectTapsFor(round: Round): Tap[] {
  const taps: Tap[] = [];
  for (let n = 0; n < PAIRS_PER_ROUND; n++) {
    const now = replay(round, taps).onScreen;
    const a = now[0];
    const b = now.find((j) => j !== a && round.leaves[a] + round.leaves[j] === targetOf(round, a));
    expect(b, `leaf ${a} has no partner floating`).toBeDefined();
    taps.push({ a, b: b!, ms: 1000 });
  }
  return taps;
}

describe('the round', () => {
  it('is ten pairs to 10, 20, 100 or 1000 that can always be finished, the same for the same seed (200 seeds)', () => {
    for (const target of TARGETS) {
      const step = target / 10;
      for (const seed of seeds) {
        const round = makeRound(seed, target);
        expect(round).toEqual(makeRound(seed, target));
        expect(round.target).toBe(target);
        expect(round.leaves).toHaveLength(2 * PAIRS_PER_ROUND);
        if (target === 20) {
          // Bonds to 20 (R8): 1 + 19 to 9 + 11 once each and one more, never 10 + 10.
          const small = round.leaves.filter((n) => n < 10);
          expect(small).toHaveLength(PAIRS_PER_ROUND);
          expect([1, 2, 3, 4, 5, 6, 7, 8, 9].every((n) => small.includes(n))).toBe(true);
          expect(round.leaves.includes(10)).toBe(false);
          expect(round.leaves.every((n) => n >= 1 && n <= 19)).toBe(true);
          expect(round.leaves.filter((_, i) => i % 2 === 0).map((n, i) => n + round.leaves[2 * i + 1]).every((t) => t === 20)).toBe(true);
          expect(bondKey(7, 20)).toBe('bond20:7+13');
          expect(bondKey(13, 20)).toBe('bond20:7+13');
        } else {
          // Whole tens (or hundreds) from 1 to 9 of them: no 0 + 100 (James, 4 Nov 2026), the same shape as the round to 10.
          expect(round.leaves.every((n) => n % step === 0 && n >= step && n <= 9 * step)).toBe(true);
          expect(round.leaves.map((n) => n / step)).toEqual(makeRound(seed).leaves);
        }
        expect(replay(round, []).onScreen).toHaveLength(ON_SCREEN);
        const end = replay(round, perfectTaps(seed, target));
        expect(end).toMatchObject({ done: true, pairsMade: PAIRS_PER_ROUND, mistakes: 0, onScreen: [] });
        expect(end.answers.every((a) => RECORD_KEY.test(a.key))).toBe(true);
      }
    }
    // One key per pair, smaller number first (S34); the old one-key-for-all records are still read, never written.
    expect(bondKey(30, 100)).toBe('bond100:30+70');
    expect(bondKey(70, 100)).toBe('bond100:30+70');
    expect(bondKey(700, 1000)).toBe('bond1000:300+700');
    expect(bondKey(500, 1000)).toBe('bond1000:500+500');
    expect(() => makeRound(1, 50 as Target)).toThrow();
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

describe('mistakes that teach (maths review R5)', () => {
  it('replays wrong pairs as before but scores only the first tap of each go, and remembers the pairs tried', () => {
    const round = makeRound(42);
    const right = perfectTaps(42);
    const start = replay(round, []).onScreen;
    const a = right[0].a;
    const [w1, w2] = start.filter((j) => j !== a && round.leaves[a] + round.leaves[j] !== TARGET);
    const ka = bondKey(round.leaves[a]);
    // Go 1: two wrong pairs ("Let's look together"), then the right one. Go 2: right first time. Go 3: one wrong, then right.
    const c = right[2].a;
    const wc = replay(round, right.slice(0, 2)).onScreen.find((j) => j !== c && round.leaves[c] + round.leaves[j] !== TARGET)!;
    const taps = [{ a, b: w1, ms: 5 }, { a: w2, b: a, ms: 6 }, right[0], right[1], { a: c, b: wc, ms: 7 }, ...right.slice(2)];
    const mid = replay(round, taps.slice(0, 2));
    expect(mid).toMatchObject({ wrongInGo: 2, tried: [pairId(a, w1), pairId(w2, a)], pairsMade: 0, onScreen: start });
    const end = replay(round, taps);
    const perfect = replay(round, right);
    // The leaves, the pairs and the finish are the same as with no mistakes: the server replays it the same way.
    expect(end).toMatchObject({ done: true, pairsMade: PAIRS_PER_ROUND, mistakes: 3, onScreen: [], shown: 1, wrongInGo: 0 });
    expect(end.answers).toHaveLength(PAIRS_PER_ROUND);
    expect(end.answers[0]).toEqual({ key: ka, correct: false, ms: 5 });
    expect(end.answers.filter((x) => !x.correct)).toHaveLength(2);
    expect(end.answers.slice(1)).toEqual([perfect.answers[1], { ...perfect.answers[2], correct: false, ms: 7 }, ...perfect.answers.slice(3)]);
  });
});

describe('bonds to 20 and the missing leaf (maths review R8)', () => {
  it('lets the server finish a bonds to 20 round, scoring each go against a bond20 record the maths records know', async () => {
    const log = { answers: [] as { player: string; once: string; answers: FactAnswer[] }[] };
    const services = memoryServices({ log, now: () => Date.parse('2026-11-10T00:00:00Z'), random: () => 0.42 });
    services.data.players.p = { child: 'jill', daysDone: DAYS_PER_EGG, lastLeafDay: null, help: 0, goodInRow: 0, helpMissing: 0, goodInRowMissing: 0, ...START_STEPS, stage: 1, version: 1 };
    const { body: { seed, round } } = await handleBeanstalk(services, 'p', { action: 'start' });
    const reply = await handleBeanstalk(services, 'p', { action: 'finish', seed, taps: perfectTapsFor(round as Round) });
    expect(reply).toMatchObject({ status: 200, body: { daysDone: DAYS_PER_EGG + 1, leafChanged: 0 } });
    const keys = log.answers[0].answers.map((a) => a.key);
    expect(keys).toHaveLength(PAIRS_PER_ROUND);
    expect(keys.filter((k) => /^bond20:\d\+\d+$/.test(k) && factKeys(20).includes(k))).toHaveLength(8); // and two older bonds to 10 last
    expect(factKeys(10)).toHaveLength(5);
    expect(factKeys(100)).toEqual(['bond100:10+90', 'bond100:20+80', 'bond100:30+70', 'bond100:40+60', 'bond100:50+50']);
    // The missing leaf is only on the screen (the taps are the same two leaves): on the 3rd, 5th and 7th go (S22), never the last.
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(isMissingGo)).toEqual([2, 4, 6]);
    // At least three leaves of the tray's sum float on each of them, on every stage, so a guess is not enough.
    for (const stage of [0, 1, 2, 3] as Stage[]) {
      const round = makeStageRound(7, stage);
      const taps = perfectTapsFor(round);
      for (const go of [2, 4, 6]) {
        const { onScreen } = replay(round, taps.slice(0, go));
        expect(onScreen.filter((i) => targetOf(round, i) === targetOf(round, onScreen[0])).length, `stage ${stage} go ${go}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe('the sum follows the child, not the calendar (maths review 2, S21)', () => {
  const secureRecords = (target: Target) => factKeys(target).map((key) => ({ key, attempts: 4, correct: 4, avgMs: 2000, box: 3, lastSeen: 0, quickDays: [] }));
  /** One NZ day's first finish. */
  const day = (steps: Steps, right: number, secure = true) => afterDay(steps, right, true, secure);

  it('moves up after two good first-finish days with the sum secure, steps back after two hard days, never past 1000 or below 10, and a repeat the same day changes nothing', () => {
    let s: Steps = START_STEPS;
    s = day(s, 9);
    expect(s).toMatchObject({ stage: 0, goodDays: 1, moved: 0 });
    s = day(s, 8, false); // good but the facts aren't secure yet: stays, and keeps its good days
    expect(s).toMatchObject({ stage: 0, goodDays: 2, moved: 0 });
    s = day(s, 10);
    expect(s).toEqual({ stage: 1, goodDays: 0, hardDays: 0, stageDays: 0, moved: 1 }); // a new stage starts the counts again
    expect(sumSecure([], 10)).toBe(false);
    expect(sumSecure(secureRecords(10), 10)).toBe(true);
    expect(sumSecure(secureRecords(10).slice(0, 3), 10)).toBe(false); // 3 of 5 is under 70 percent
    expect(sumSecure(secureRecords(10).slice(0, 4), 10)).toBe(true);
    // A middling day (5 to 7) breaks both runs; two hard days (4 or fewer) step back.
    expect(day({ ...START_STEPS, stage: 2, goodDays: 1 }, 6)).toMatchObject({ stage: 2, goodDays: 0, hardDays: 0 });
    s = day(day({ ...START_STEPS, stage: 2 }, 3), 4);
    expect(s).toMatchObject({ stage: 1, moved: -1 });
    expect(day(day({ ...START_STEPS, stage: 0 }, 0), 0)).toMatchObject({ stage: 0, moved: 0 }); // never below bonds to 10
    expect(day(day({ ...START_STEPS, stage: 3 }, 10), 10)).toMatchObject({ stage: 3, moved: 0 }); // 1000 is the top; it doesn't go round to 10
    // A replay the same day changes nothing.
    const kept: Steps = { stage: 1, goodDays: 1, hardDays: 0, stageDays: 4 };
    expect(afterDay(kept, 10, false, true)).toEqual({ ...kept, moved: 0 });
  });

});
