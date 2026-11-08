import { describe, expect, it } from 'vitest';
import { newStats, type FactStats } from '../maths/leitner';
import { finishChallenge, pondAfter, DAYS_PER_JAR } from './progress';
import { replay, type Tap } from './play';
import { seeded } from '../seededRandom';
import { EARLY_FACTS, earlyFactsPack, parseSkip, SKIP_FROM_STEPS } from '../maths/skillPacks/earlyFacts';
import { BACK_HOPS, DEMO_KEYS, kindOfKey, GOLD_FROM_HOPS, helpForStats, HOP_STEPS, HOPS_PER_ROUND, makeRound, showHop, showRound, stepFor, stepKeys, STEPS, tellOf, topSecure, wordOf, type Round } from './round';

const seeds = Array.from({ length: 60 }, (_, i) => i * 10007 + 1);
const secure = (keys: string[]): FactStats[] => keys.map((key) => ({ ...newStats(key), box: 2 }));
/** Records that put a child on each step: none, then every step before it secure (tens, then fives, twos, threes, fours, tens past 100). */
const recordsFor = Object.fromEntries(STEPS.map((step, i) => [step, secure(STEPS.slice(0, i).flatMap(stepKeys))])) as Record<number, FactStats[]>;

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
          // The "Show me first" demos use made-up hops that no round asks, and each is the kind it shows.
          for (const [kind, key] of Object.entries(DEMO_KEYS)) {
            expect(round.hops.map((h) => h.key)).not.toContain(key);
            expect(kindOfKey(key)).toBe(kind);
          }
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

  it('asks counting back once a step is secure going forward (1, then 2, then 3 by how secure the back facts are), and three on every gold day', () => {
    const backs = (r: Round) => r.hops.map((h) => h.key).filter((k) => k.includes(':back:'));
    const backKeys = EARLY_FACTS.families.skip10.keys.filter((k) => k.includes(':back:'));
    const at = (share: number) => secure(backKeys.slice(0, Math.ceil(backKeys.length * share)));
    for (const seed of seeds) {
      // Nothing secure forward: no back hops on an ordinary day; a gold day still has three, on today's step.
      expect(backs(makeRound(seed, [], { gold: false }))).toHaveLength(0);
      expect(backs(makeRound(seed, [], { gold: true }))).toHaveLength(BACK_HOPS);
      // Tens secure going forward (so today is fives): back hops are tens, last in the round, own keys; the count grows with the back facts.
      for (const [share, count] of [[0, 1], [0.4, 2], [0.8, 3]] as const) {
        const round = makeRound(seed, [...recordsFor[5], ...at(share)], { gold: false });
        expect(round.step).toBe(5);
        const found = backs(round);
        expect(found).toHaveLength(count);
        expect(found.every((k) => k.startsWith('skip10:back:'))).toBe(true);
        expect(round.hops.slice(HOPS_PER_ROUND - count).map((h) => h.key)).toEqual(found);
      }
      // Gold days keep three (never fewer), and every back hop lands on a number that counts down.
      const gold = makeRound(seed, recordsFor[5], { gold: true });
      expect(backs(gold)).toHaveLength(BACK_HOPS);
      for (const hop of showRound(makeRound(seed, [...recordsFor[5], ...at(1)], { gold: false })).filter((h) => h.back)) expect(hop.terms[hop.gap]).toBeLessThan(hop.before);
    }
  });
});

describe('non-multiple starts on gold days (R8)', () => {
  it('come only on a gold day, two hops, from a step the child has passed, and replay like any other hop', () => {
    const offsetOf = (round: Round) => round.hops.filter((h) => parseSkip(h.key)!.offset > 0);
    for (const seed of seeds) {
      expect(offsetOf(makeRound(seed, recordsFor[200], { gold: false }))).toHaveLength(0);
      expect(offsetOf(makeRound(seed, [], { gold: true }))).toHaveLength(0); // nothing passed yet
      const round = makeRound(seed, recordsFor[3], { gold: true }); // tens, fives and twos passed
      const from = offsetOf(round);
      expect(from).toHaveLength(GOLD_FROM_HOPS);
      for (const h of from) expect([10, 5, 2]).toContain(parseSkip(h.key)!.step);
      expect(new Set(round.hops.map((h) => h.key)).size).toBe(HOPS_PER_ROUND);
      expect(round.hops.slice(-BACK_HOPS).every((h) => h.key.includes(':back:'))).toBe(true);
      expect(replay(round, wobblyTaps(round))).toMatchObject({ done: true, hopsMade: HOPS_PER_ROUND });
    }
  });
});

describe('the step labels (R6)', () => {
  it('follow each fact: full with no record, faint then none as it is learned, full again after a slip, and full on a new step', () => {
    const known = { ...newStats('k'), box: 4, correct: 6, quickDays: ['a', 'b'] };
    expect(helpForStats(undefined)).toBe('full');
    expect(helpForStats({ ...known, box: 2, correct: 3 })).toBe('faint');
    expect(helpForStats(known)).toBe('none');
    expect(helpForStats({ ...known, box: 1 })).toBe('full');
    // A child who knows every 10s fact and has just moved to 5s: the 10s facts are not on the round, so every 5s hop starts full.
    const tens = stepKeys(10).map((key) => ({ ...known, key }));
    const fives = makeRound(7, tens, { reached: 5 });
    expect(fives.step).toBe(5);
    expect(fives.hops.map((h) => h.h)).toEqual(Array(HOPS_PER_ROUND).fill('full'));
  });
});

describe('the glow-worms (mistakes that teach)', () => {
  it('are the answer, one more on the same step and two with other endings, for every hop the pack can make (threes, fours, tens past 100 and from a start too)', () => {
    const kinds = new Set<string>();
    const names = [...HOP_STEPS.map((h) => h.family), ...SKIP_FROM_STEPS.map(({ step }) => `skip${step}o`)];
    for (const name of names) {
      for (const key of EARLY_FACTS.families[name].keys) {
        const { answer, offset, high, step: size } = parseSkip(key)!;
        for (const at of [1, 2, 3, 4]) {
          for (const seed of [1, 2, 3, 4, 5, 6]) {
            const hop = showHop({ seed }, 0, { key, answer, at });
            // Whenever the shared pack can make the hop, so can we (the server would refuse the round otherwise).
            const makes = !!earlyFactsPack().rebuild(key, [answer, at], true, seeded(seed));
            expect(!!hop).toBe(makes);
            if (!hop) continue;
            const { choices, wrongs } = hop;
            expect(hop).toMatchObject({ size, from: offset, of: high ? 200 : size });
            expect(new Set(choices).size).toBe(4);
            expect(choices).toContain(answer);
            expect(wrongs.map((w) => w.n).sort()).toEqual(choices.filter((c) => c !== answer).sort());
            // Exactly two end like the answer (it, and one more hop on the same step): never the lone one.
            expect(choices.filter(tellOf(size, offset))).toHaveLength(2);
            expect(choices.every((c) => c >= 0 && c <= (high ? 200 : 100))).toBe(true);
            for (const w of wrongs) {
              kinds.add(w.kind);
              if (w.kind === 'off1') expect(Math.abs(w.n - answer)).toBe(1);
              if (w.kind === 'stay') expect(w.n).toBe(hop.before);
              if (w.kind === 'far') expect(Math.abs(w.n - hop.before)).toBe(2 * size);
              if (w.kind === 'way') expect(hop.back && w.n === hop.before + size).toBe(true);
              if (w.kind === 'step') expect((w.n - hop.before) * (hop.back ? -1 : 1)).not.toBe(size);
            }
            // The same seed puts the glow-worms in the same order (the server builds them again).
            expect(showHop({ seed }, 0, { key, answer, at })).toEqual(hop);
          }
        }
      }
    }
    expect([...kinds].sort()).toEqual(['far', 'off1', 'stay', 'step', 'way']);
  });

  it('count only the first glow-worm of a hop, however many wrong ones follow', () => {
    const round = makeRound(7, [], { gold: true });
    const hops = showRound(round);
    // Hop 0: two wrong, then the right one (a shown hop); hop 1: right first; the rest right first.
    const wrong = hops[0].wrongs.map((w) => w.n);
    const taps: Tap[] = [
      { pick: wrong[0], ms: 3000 },
      { pick: wrong[1], ms: 3500 },
      { pick: wrong[2], ms: 3600 },
      ...hops.map((h) => ({ pick: h.answer, ms: 2000 })),
    ];
    const end = replay(round, taps);
    expect(end).toMatchObject({ done: true, mistakes: 3 });
    expect(end.answers.map((a) => a.correct)).toEqual([false, ...Array(HOPS_PER_ROUND - 1).fill(true)]);
    expect(end.answers[0]).toMatchObject({ key: hops[0].key, ms: 3000 });
  });
});

describe('the step', () => {
  it('moves 10s to 5s to 2s to 3s to 4s to tens past 100 only once 70% of counting up and what comes next is secure, and never drops back', () => {
    const tens = stepKeys(10);
    const need = Math.ceil(tens.length * 0.7);
    expect(stepFor(secure(tens.slice(0, need - 1)))).toBe(10);
    expect(stepFor(secure(tens.slice(0, need)))).toBe(5);
    // Counting back doesn't count towards moving up (it's only asked on gold days).
    const back10 = Array.from({ length: 9 }, (_, i) => `skip10:back:${(i + 1) * 10}`);
    expect(stepFor(secure([...tens.slice(0, need - 1), ...back10]))).toBe(10);
    expect(stepFor(recordsFor[2])).toBe(2);
    expect(stepFor(recordsFor[3])).toBe(3);
    expect(stepFor(recordsFor[200])).toBe(200);
    expect(stepFor(secure(STEPS.flatMap(stepKeys)))).toBe(200); // the last step is where a child stays
    expect(STEPS.map(wordOf)).toEqual(['tens', 'fives', 'twos', 'threes', 'fours', 'tens past 100']);
    // A child who reached 5s and then forgot some 10s stays on 5s.
    expect(stepFor([], 5)).toBe(5);
  });
});

describe("the finish screen's signpost (R8)", () => {
  it('is for a child who has reached twos and has 70% of them secure, and not before', () => {
    const twos = stepKeys(2);
    const most = secure(twos.slice(0, Math.ceil(twos.length * 0.7)));
    const fewer = secure(twos.slice(0, Math.ceil(twos.length * 0.7) - 1));
    expect(topSecure(recordsFor[2], 2)).toBe(false); // on twos, none of them known yet
    expect(topSecure([...recordsFor[2], ...most], 2)).toBe(true);
    expect(topSecure([...recordsFor[2], ...fewer], 2)).toBe(false);
    // Twos known but the tens and fives never reached: the child is not on twos yet.
    expect(topSecure(most, 10)).toBe(false);
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
