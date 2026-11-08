import { describe, expect, it } from 'vitest';
import { afterDay, DAYS_PER_EGG, dotsFor, finishChallenge, placeAfter, shownDots, stalkAfter, START_PLACE, START_STEPS, sumSecure, type Place, type Steps } from './progress';
import { seeded } from '../seededRandom';
import type { FactAnswer } from '../maths/leitner';
import { handleBeanstalk, unplayed } from './server';
import { memoryServices } from './memoryServices';
import { bondKey, factKeys, isMissingGo, makeRound, makeStageRound, mistakeKind, ON_SCREEN, pairId, PAIRS_PER_ROUND, replay, targetOf, TARGETS, type Round, type Stage, type Target, type Tap } from './round';

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

/** No number floats twice, except the two 5s of 5 + 5 (maths review R4). */
function expectNoTwins(round: Round, onScreen: number[], where: string) {
  const numbers = onScreen.map((i) => round.leaves[i]).filter((n) => n !== round.target / 2);
  expect(new Set(numbers).size, `${where}: ${numbers.join(', ')}`).toBe(numbers.length);
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
        expect(end.answers.every((a) => a.key === bondKey(round.leaves[0], target))).toBe(target > 20);
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

describe('mistakes that teach (maths review R5)', () => {
  it('names a wrong pair by its total: over, under, one off (close), and on 100 and 1000 one ten or hundred off (digit)', () => {
    expect([12, 7, 11, 9, 3, 17, 10].map((n) => mistakeKind(n, 10))).toEqual(['over', 'under', 'close', 'close', 'under', 'over', null]);
    expect([90, 110, 120, 80, 30, 100].map((n) => mistakeKind(n, 100))).toEqual(['digit', 'digit', 'over', 'under', 'under', null]);
    expect([900, 1100, 1700, 300, 1000].map((n) => mistakeKind(n, 1000))).toEqual(['digit', 'digit', 'over', 'under', null]);
  });

  it('gives every tray of six a near miss, one off the sum, whatever pairs a child makes (200 seeds, every sum)', () => {
    for (const target of TARGETS) {
      for (const seed of seeds) {
        const round = makeRound(seed, target);
        const random = seeded(seed + 3);
        const taps: Tap[] = [];
        for (let r = replay(round, taps); !r.done; r = replay(round, taps)) {
          const n = r.onScreen.map((i) => round.leaves[i]);
          if (n.length === ON_SCREEN) expect(n.some((x, i) => n.some((y, j) => j > i && mistakeKind(x + y, target) === (target <= 20 ? 'close' : 'digit'))), `seed ${seed}: ${n}`).toBe(true);
          const pairs = r.onScreen.flatMap((a) => r.onScreen.filter((b) => b > a && round.leaves[a] + round.leaves[b] === target).map((b) => ({ a, b, ms: 900 })));
          taps.push(pairs[Math.floor(random() * pairs.length)]);
        }
      }
    }
  });

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

describe('the magic leaves', () => {
  it('turn bronze, then silver, then gold, bottom leaf first, with an egg and a new friend every 30 days', () => {
    expect(stalkAfter(0)).toMatchObject({ eggs: 0, friend: 'kiwi', leaves: Array(10).fill('green') });
    expect(stalkAfter(3).leaves.slice(0, 4)).toEqual(['bronze', 'bronze', 'bronze', 'green']);
    expect(stalkAfter(10)).toMatchObject({ leaves: Array(10).fill('bronze') });
    expect(stalkAfter(21)).toMatchObject({ leaves: ['gold', ...Array(9).fill('silver')] });
    expect(stalkAfter(DAYS_PER_EGG)).toMatchObject({ eggs: 1, friend: 'tui', day: 0, leaves: Array(10).fill('green') });
    // The egg and the friend still come from the calendar; the sum doesn't (S21: the saved stage).
    expect(stalkAfter(5 * DAYS_PER_EGG + 7)).toMatchObject({ eggs: 5, friend: 'takahe' });
  });

  it('change one leaf on the first finish of a NZ day only', () => {
    expect(finishChallenge(0, null, '2026-11-04')).toEqual({ daysDone: 1, lastLeafDay: '2026-11-04', leafChanged: 0, egg: false });
    expect(finishChallenge(1, '2026-11-04', '2026-11-04')).toMatchObject({ daysDone: 1, leafChanged: null });
    expect(finishChallenge(29, '2026-11-04', '2026-11-20')).toMatchObject({ daysDone: 30, leafChanged: 9, egg: true });
  });
});

describe('the dots follow the child, not the calendar (maths review R6)', () => {
  const counted = { leafChanged: 0, stageChanged: false };

  it('fade after two good days in a row, come back after a hard day, and stay put on a middling day', () => {
    // Two days of 8 or more first-time pairs: full to small, then (two more) small to none, and none stays none.
    let place: Place = START_PLACE;
    place = placeAfter(place, 10, counted);
    expect(place).toEqual({ help: 0, goodInRow: 1 });
    place = placeAfter(place, 8, counted);
    expect(place).toEqual({ help: 1, goodInRow: 0 });
    place = placeAfter(placeAfter(place, 9, counted), 10, counted);
    expect(dotsFor(place.help)).toBe('none');
    expect(placeAfter(placeAfter(place, 10, counted), 10, counted).help).toBe(2);
    // A hard day (4 or fewer) brings one step back at once; 5 to 7 neither fades nor returns, and breaks the run of good days.
    expect(placeAfter({ help: 2, goodInRow: 1 }, 4, counted)).toEqual({ help: 1, goodInRow: 0 });
    expect(placeAfter({ help: 0, goodInRow: 0 }, 1, counted).help).toBe(0);
    expect(placeAfter({ help: 1, goodInRow: 1 }, 6, counted)).toEqual({ help: 1, goodInRow: 0 });
    // A child who struggles keeps their help on day 21 of the beanstalk, and one who knows it all loses it on day 3.
    expect(placeAfter({ help: 1, goodInRow: 1 }, 10, counted).help).toBe(2);
  });

  it('start again at full dots on a new sum (a stage change), never move on a replay, and lose to the teacher’s dots switch', () => {
    expect(placeAfter({ help: 2, goodInRow: 1 }, 10, { leafChanged: 9, stageChanged: true })).toEqual(START_PLACE);
    expect(placeAfter({ help: 1, goodInRow: 1 }, 10, { leafChanged: null, stageChanged: false })).toEqual({ help: 1, goodInRow: 1 });
    expect(placeAfter({ help: 1, goodInRow: 0 }, 0, { leafChanged: null, stageChanged: false })).toEqual({ help: 1, goodInRow: 0 });
    expect([0, 1, 2].map((h) => shownDots(h as 0 | 1 | 2, true))).toEqual(['full', 'small', 'none']);
    expect([0, 1, 2].map((h) => shownDots(h as 0 | 1 | 2, false))).toEqual(['none', 'none', 'none']);
  });
});

describe('bonds to 20 and the missing leaf (maths review R8)', () => {
  it('lets the server finish a bonds to 20 round, scoring each go against a bond20 record the maths records know', async () => {
    const log = { answers: [] as { player: string; once: string; answers: FactAnswer[] }[] };
    const services = memoryServices({ log, now: () => Date.parse('2026-11-10T00:00:00Z'), random: () => 0.42 });
    services.data.players.p = { child: 'jill', daysDone: DAYS_PER_EGG, lastLeafDay: null, help: 0, goodInRow: 0, ...START_STEPS, stage: 1, version: 1 };
    const { body: { seed, round } } = await handleBeanstalk(services, 'p', { action: 'start' });
    const reply = await handleBeanstalk(services, 'p', { action: 'finish', seed, taps: perfectTapsFor(round as Round) });
    expect(reply).toMatchObject({ status: 200, body: { daysDone: DAYS_PER_EGG + 1, leafChanged: 0 } });
    const keys = log.answers[0].answers.map((a) => a.key);
    expect(keys).toHaveLength(PAIRS_PER_ROUND);
    expect(keys.filter((k) => /^bond20:\d\+\d+$/.test(k) && factKeys(20).includes(k))).toHaveLength(8); // and two older bonds to 10 last
    expect(factKeys(10)).toHaveLength(5);
    expect(factKeys(100)).toEqual(['bond100:tens']);
    // The missing leaf is only on the screen (the taps are the same two leaves): on the 4th, 7th and 10th go.
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(isMissingGo)).toEqual([3, 6, 9]);
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

  it('makes each pair once, gives the spare places to the weakest (three at most, 5 + 5 once), and mixes two older pairs last on every stage but the first (200 seeds)', () => {
    const records = (weak: number) => [1, 2, 3, 4, 5].map((n) => ({ key: bondKey(n), attempts: 3, correct: 3, avgMs: 1, box: n === weak ? 0 : 3, lastSeen: 100 + n, quickDays: [] }));
    for (const seed of seeds) {
      for (const stage of [0, 1, 2, 3] as Stage[]) {
        const round = makeStageRound(seed, stage, records(2));
        expect(round).toEqual(makeStageRound(seed, stage, records(2)));
        expect(round.target).toBe(TARGETS[stage]);
        const targets = round.pairTargets!;
        expect(targets).toHaveLength(PAIRS_PER_ROUND);
        // Own pairs first, older ones last (none on the first stage), each older sum lower than the stage's.
        const older = targets.filter((t) => t !== round.target);
        expect(older).toHaveLength(stage === 0 ? 0 : 2);
        expect(targets.slice(PAIRS_PER_ROUND - older.length).every((t) => t < round.target)).toBe(true);
        const own = round.leaves.slice(0, 2 * (PAIRS_PER_ROUND - older.length));
        const unit = round.target === 100 ? 10 : round.target === 1000 ? 100 : 1;
        const lo = (n: number, t: number) => Math.min(n, t - n) / unit;
        const counts = new Map<number, number>();
        own.forEach((n, i) => i % 2 === 0 && counts.set(lo(n, round.target), (counts.get(lo(n, round.target)) ?? 0) + 1));
        const pairs = round.target === 20 ? 9 : 5;
        if (stage !== 1) expect([...counts.keys()].sort()).toEqual(Array.from({ length: pairs }, (_, i) => (i + 1) * 1)); // every pair at least once
        expect(Math.max(...counts.values())).toBeLessThanOrEqual(3);
        if (round.target !== 20) expect(counts.get(5)).toBe(1); // 5 + 5 at most once
        if (stage !== 1) expect(counts.get(2)).toBeGreaterThanOrEqual(counts.get(4)!); // the weakest (3 + 7's neighbour: 2 + 8) gets the extras
        // Every pair adds to its own sum, and the round can always be finished.
        for (let k = 0; k < PAIRS_PER_ROUND; k++) expect(round.leaves[2 * k] + round.leaves[2 * k + 1]).toBe(targets[k]);
        expect(replay(round, perfectTapsFor(round))).toMatchObject({ done: true, pairsMade: PAIRS_PER_ROUND, mistakes: 0 });
      }
    }
  });

  it('keeps the round at the start and replays that one on finish, or the calendar’s sum for a challenge already open before rounds were kept', async () => {
    const services = memoryServices({ now: () => Date.parse('2026-11-10T00:00:00Z'), random: () => 0.42 });
    services.data.players.p = { ...unplayed(), child: 'jill', stage: 2, daysDone: 65, stageDays: 5, version: 1 };
    const { body: { seed, round } } = await handleBeanstalk(services, 'p', { action: 'start' });
    expect(services.data.rounds[0].round).toEqual(round);
    expect((round as Round).target).toBe(100);
    expect(await handleBeanstalk(services, 'p', { action: 'finish', seed, taps: perfectTapsFor(round as Round) })).toMatchObject({ status: 200, body: { stage: 2, moved: 0 } });
    // An open challenge with no kept round: made again from its seed on the child's stage.
    delete services.data.rounds[0].round;
    services.data.rounds[0].open = true;
    services.data.players.p.lastLeafDay = null;
    expect(await handleBeanstalk(services, 'p', { action: 'finish', seed, taps: perfectTaps(seed as number, 100) })).toMatchObject({ status: 200 });
  });
});
