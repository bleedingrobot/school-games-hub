import { describe, expect, it } from 'vitest';
import { newStats, type FactStats } from '../maths/leitner';
import { replay, type Tap } from './play';
import { seeded } from '../seededRandom';
import { EARLY_FACTS, earlyFactsPack, parseSkip, SKIP_FROM_STEPS } from '../maths/skillPacks/earlyFacts';
import { DEMO_KEYS, kindOfKey, HOP_STEPS, HOPS_PER_ROUND, makeRound, showHop, showRound, sisterHop, stepFor, stepKeys, STEPS, tellOf, wordOf, type Round } from './round';

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

describe('the sister hop', () => {
  it('is another fact of the same step and direction with a different answer, at the same help, and the first hop’s right pick still ends the replay', () => {
    for (const step of STEPS) {
      for (const gold of [false, true]) {
        for (const seed of seeds.slice(0, 6)) {
          const round = makeRound(seed, recordsFor[step], { gold });
          const hops = showRound(round);
          hops.forEach((hop, i) => {
            const sister = sisterHop(round, i, hop)!;
            expect(sister).not.toBeNull();
            const [a, b] = [parseSkip(hop.key)!, parseSkip(sister.key)!];
            expect([b.step, b.offset, b.high, b.kind]).toEqual([a.step, a.offset, a.high, a.kind]);
            expect(sister.key).not.toBe(hop.key);
            expect(sister.answer).not.toBe(hop.answer);
            expect(sister.h).toBe(hop.h);
            expect(sisterHop(round, i, hop)).toEqual(sister);
          });
          // A right tap on the sister sends the first hop's right pick, so the taps replay as usual.
          expect(replay(round, hops.map((hop) => ({ pick: hop.answer, ms: 3000 }))).done).toBe(true);
        }
      }
    }
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
