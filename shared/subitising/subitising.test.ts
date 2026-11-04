import { describe, expect, it } from 'vitest';
import { GAP_FILLED, STAGES, SUBITISING_CONFIG as C, slotOf, stageOfKey, type PictureType, type StageNumber } from './config';
import { checkItem } from '../training/save';
import { flashMs, growth, isStruggling, progressFrom, stageDone, type SubAnswer } from './engine';
import { gapKey, helpedKey, parseKey, subKey } from './keys';
import { BOX, DOT_R, MIN_GAP, closestPair, groupSizes, makeGapPicture, makePicture } from './patterns';
import { placementLevel, placementTrial, startStageFrom } from './placement';
import { buildTrial, choicesFor, rngFor } from './trials';

const ALL_TYPES = STAGES.filter((s) => s.activity !== 'gap').flatMap((s) => s.types.map((t) => [s, t] as const));
const STAGE_IDS = [1, 2, 3, 4, 5, 6, 7] as const;

function numbersFor(type: PictureType, min: number, max: number): number[] {
  const out: number[] = [];
  for (let n = min; n <= max; n++) {
    if (type === 'five' && n > 5) continue;
    if (type === 'fiveplus' && (n < 6 || n > 7)) continue;
    if ((type === 'pair' || type === 'dots') && n < 2) continue;
    out.push(n);
  }
  return out;
}

describe('pictures', () => {
  it('make exactly n dots, inside the box, never touching, for every type and number', () => {
    for (const [stage, type] of ALL_TYPES) {
      for (const n of numbersFor(type, stage.min, stage.max)) {
        for (let seed = 1; seed <= 25; seed++) {
          const p = makePicture(type, n, rngFor(seed));
          expect(p.dots.length, `${type} ${n}`).toBe(n);
          for (const d of p.dots) {
            expect(d.x - DOT_R).toBeGreaterThanOrEqual(0);
            expect(d.x + DOT_R).toBeLessThanOrEqual(BOX.width);
            expect(d.y - DOT_R).toBeGreaterThanOrEqual(0);
            expect(d.y + DOT_R).toBeLessThanOrEqual(BOX.height);
          }
          expect(closestPair(p.dots), `${type} ${n} seed ${seed}`).toBeGreaterThanOrEqual(2 * DOT_R + MIN_GAP);
        }
      }
    }
  });

  it('give the same picture for the same seed', () => {
    const a = makePicture('pair', 7, rngFor(42));
    const b = makePicture('pair', 7, rngFor(42));
    expect(a).toEqual(b);
  });

  it('keep two groups apart: the pair and dots pictures show a + b', () => {
    const p = makePicture('pair', 7, rngFor(3));
    expect(groupSizes(p).reduce((x, y) => x + y, 0)).toBe(7);
    expect(groupSizes(p)).toHaveLength(2);
    expect(p.twoColour).toBe(true);
    expect(makePicture('dots', 5, rngFor(3)).twoColour).toBe(false);
  });

  it('draw a ten-frame in rows, in pairs down the columns, or scattered', () => {
    const rows = makePicture('ten', 8, rngFor(1));
    expect(rows.dots.filter((d) => d.group === 0)).toHaveLength(5);
    expect(rows.dots.filter((d) => d.group === 1)).toHaveLength(3);
    const pairs = makePicture('tenpair', 6, rngFor(1));
    const columns = new Set(pairs.dots.map((d) => Math.round(d.x)));
    expect(columns.size).toBe(3);
    const mixed = makePicture('tenmix', 7, rngFor(9));
    expect(new Set(mixed.dots.map((d) => `${d.x},${d.y}`)).size).toBe(7);
  });

  it('draw the five-ten-frame along the top row from the left', () => {
    for (let n = 1; n <= 5; n++) {
      const p = makePicture('tenfive', n, rngFor(1));
      expect(p.dots).toHaveLength(n);
      expect(p.frame).toMatchObject({ cols: 5, rows: 2 });
      expect(new Set(p.dots.map((d) => d.y)).size).toBe(1);
      expect(p.dots.map((d) => d.x)).toEqual([...p.dots.map((d) => d.x)].sort((a, b) => a - b));
      expect(p.dots.map((d) => d.x)).toEqual(makePicture('ten', n, rngFor(1)).dots.map((d) => d.x));
    }
  });

  it('draw a die the usual way', () => {
    expect(makePicture('dice', 5, rngFor(1)).dots).toHaveLength(5);
    expect(makePicture('dice', 5, rngFor(1)).die?.turn).toBe(0);
    expect(makePicture('dicet', 4, rngFor(1)).die?.turn).toBe(45);
  });

  it('draw plain dice pips in one colour', () => {
    for (const type of ['dice', 'dicet'] as const) {
      for (let n = 1; n <= 6; n++) expect(new Set(makePicture(type, n, rngFor(1)).dots.map((d) => d.color))).toEqual(new Set([0]));
    }
  });

  it('keep the corners of a turned die inside the box, with room between the pips', () => {
    for (let n = 1; n <= 6; n++) {
      const { die, dots } = makePicture('dicet', n, rngFor(1));
      const half = (die!.size / 2) * Math.SQRT2;
      expect(die!.x - half).toBeGreaterThanOrEqual(8);
      expect(die!.x + half).toBeLessThanOrEqual(BOX.width - 8);
      expect(die!.y - half).toBeGreaterThanOrEqual(8);
      expect(die!.y + half).toBeLessThanOrEqual(BOX.height - 8);
      if (dots.length > 1) expect(closestPair(dots) - 2 * DOT_R).toBeGreaterThanOrEqual(6 - 1e-9);
    }
  });

  it('refuse a Missing Spots picture that is full or empty', () => {
    expect(() => makeGapPicture('five', 5, rngFor(1))).toThrow();
    expect(() => makeGapPicture('ten', 0, rngFor(1))).toThrow();
    expect(() => makeGapPicture('tenfive', 3, rngFor(1))).toThrow();
    expect(() => makeGapPicture('dice', 3, rngFor(1))).toThrow();
    expect(makeGapPicture('ten', 7, rngFor(1)).dots).toHaveLength(7);
  });
});

describe('keys', () => {
  it('give the answer from the key alone', () => {
    expect(parseKey(subKey('ten', 8))).toMatchObject({ activity: 'flash', answer: 8, stage: 5 });
    expect(parseKey(gapKey('ten', 7))).toMatchObject({ activity: 'gap', answer: 3, stage: 6 });
    expect(parseKey(gapKey('five', 4))).toMatchObject({ answer: 1, stage: 6 });
  });
  it('put every key in its stage, old saved keys included', () => {
    const stages: Array<[string, number]> = [
      ['sub:line-2', 1], ['sub:tenfive-4', 2], ['sub:dice-5', 3], ['sub:fiveplus-6', 4], ['sub:five-3', 4], ['sub:pair-7', 4],
      ['sub:ten-5', 5], ['sub:ten-8', 5], ['sub:tenpair-10', 5], ['sub:tenmix-9', 7], ['sub:tenmix-5', 7],
      ['gap:five-2', 6], ['gap:ten-3', 6], ['gap:tenpair-9', 6], ['gap:tenmix-3', 7], ['gap:tenmix-9', 7],
    ];
    for (const [k, s] of stages) expect(parseKey(k)?.stage, k).toBe(s);
    expect(stageOfKey('gap', 'five')).toBe(6);
    expect(stageOfKey('flash', 'tenmix')).toBe(7);
    expect(parseKey('gap:tenmix-5')).toMatchObject({ answer: 5, activity: 'gap' });
  });
  it('refuse numbers a stage cannot show', () => {
    for (const k of ['sub:tenfive-6', 'sub:tenfive-0', 'gap:tenfive-3', 'gap:five-5', 'sub:ten-4', 'gap:ten-2', 'gap:ten-10', 'gap:tenmix-10', 'sub:tenmix-4']) expect(parseKey(k), k).toBeNull();
  });
  it('refuse keys that are not ours or make no sense', () => {
    for (const k of ['sub:nope-3', 'gap:five-5', 'gap:dice-3', 'gap:ten-0', 'sub:tenfive-6', 'gap:five-0', 'mul:6x7', 'sub:ten-', 'sub:ten-123']) expect(parseKey(k), k).toBeNull();
  });
  it('fit the saved-answer key pattern', () => {
    for (const [stage, type] of ALL_TYPES) expect(subKey(type, stage.max)).toMatch(/^[a-z0-9]{1,12}:[0-9a-z/+-]{1,20}$/);
  });
});

const answersFor = (stage: number, rights: boolean[]): SubAnswer[] => {
  const types = STAGES[stage - 1].types;
  const n = STAGES[stage - 1].min;
  return rights.map((correct, i) => ({ key: subKey(types[i % types.length], n), correct, at: i }));
};

describe('stages', () => {
  it('start at stage 1 with nothing finished', () => {
    const p = progressFrom([]);
    expect(p.current).toBe(1);
    expect(p.stages.every((s) => !s.finished)).toBe(true);
  });

  it('finish a stage at 7 right of the last 8, with every type seen', () => {
    const rights = [true, true, true, true, true, true, true, false];
    expect(progressFrom(answersFor(1, rights)).stages[0].finished).toBe(true);
    expect(progressFrom(answersFor(1, rights)).current).toBe(2);
  });

  it('not finish with 6 of 8, or before 8 answers', () => {
    expect(progressFrom(answersFor(1, [true, true, true, true, true, true, false, false])).stages[0].finished).toBe(false);
    expect(progressFrom(answersFor(1, [true, true, true, true, true, true, true])).stages[0].finished).toBe(false);
  });

  it('not finish a stage when one picture type was never practised', () => {
    const only: SubAnswer[] = Array.from({ length: 12 }, (_, i) => ({ key: subKey('line', 2), correct: true, at: i }));
    expect(progressFrom(only).stages[0].finished).toBe(false);
  });

  it('keep a finished stage finished when later answers are wrong', () => {
    const rights = [...Array(8).fill(true), ...Array(6).fill(false)];
    expect(progressFrom(answersFor(1, rights)).stages[0].finished).toBe(true);
  });

  it('ignore helped answers and keys that are not ours', () => {
    const a = answersFor(1, Array(8).fill(true)).map((x) => ({ ...x, helped: true }));
    expect(progressFrom(a).stages[0].finished).toBe(false);
    expect(progressFrom([{ key: 'mul:6x7', correct: true, at: 1 }]).stages.flatMap((s) => s.answers)).toHaveLength(0);
  });

  it('count stages below the starting stage as finished', () => {
    const p = progressFrom([], 3);
    expect(p.stages.map((s) => s.finished)).toEqual([true, true, false, false, false, false, false]);
    expect(p.current).toBe(3);
  });

  it('stay on the last stage when everything is finished', () => {
    expect(progressFrom([], 7).current).toBe(7);
    const done = progressFrom(Array.from({ length: 8 }, (_, i) => ({ key: i % 2 ? gapKey('tenmix', 5) : subKey('tenmix', 7), correct: true, at: i })), 7);
    expect(done.stages[6].finished).toBe(true);
    expect(done.current).toBe(7);
  });

  it('step back below 60% over the last 5', () => {
    expect(progressFrom(answersFor(1, [true, true, false, false, false])).stepBack).toBe(true);
    expect(progressFrom(answersFor(1, [true, true, true, false, false])).stepBack).toBe(false);
    expect(progressFrom(answersFor(1, [false, false, false])).stepBack).toBe(false);
  });

  it('stageDone needs the window and the types', () => {
    expect(stageDone(1, [], C)).toBe(false);
  });

  it('need both dots and spaces seen in the mix-it-up stage', () => {
    const flashOnly = Array.from({ length: 10 }, (_, i): SubAnswer => ({ key: subKey('tenmix', 6), correct: true, at: i }));
    expect(progressFrom(flashOnly, 7).stages[6].finished).toBe(false);
    const both = Array.from({ length: 10 }, (_, i): SubAnswer => ({ key: i < 5 ? subKey('tenmix', 6) : gapKey('tenmix', 4), correct: true, at: i }));
    expect(progressFrom(both, 7).stages[6].finished).toBe(true);
    expect(progressFrom(both, 7).stages[6].seen).toEqual({ [slotOf('flash', 'tenmix')]: 5, [slotOf('gap', 'tenmix')]: 5 });
  });

  it('need every picture type of empty squares in stage 6', () => {
    const two = Array.from({ length: 10 }, (_, i): SubAnswer => ({ key: gapKey(i % 2 ? 'five' : 'ten', 3), correct: true, at: i }));
    expect(progressFrom(two, 6).stages[5].finished).toBe(false);
    const three = Array.from({ length: 9 }, (_, i): SubAnswer => ({ key: gapKey((['five', 'ten', 'tenpair'] as const)[i % 3], 3), correct: true, at: i }));
    expect(progressFrom(three, 6).stages[5].finished).toBe(true);
  });

  it('spot struggling', () => {
    expect(isStruggling([true, false, false], null)).toBe(true);
    expect(isStruggling([false, true], null)).toBe(false);
    expect(isStruggling([true], 4500)).toBe(true);
    expect(isStruggling([true], 3000)).toBe(false);
  });

  it('grow the garden from seed to flower', () => {
    expect(growth(progressFrom([]).stages[0])).toBe(0);
    expect(growth(progressFrom(answersFor(1, Array(5).fill(true))).stages[0])).toBe(1);
    expect(growth(progressFrom(answersFor(1, Array(8).fill(true))).stages[0])).toBe(4);
  });
});

describe('trials', () => {
  it('make the same trial from the same seed', () => {
    const p = progressFrom([], 4);
    expect(buildTrial(p, 5, 2)).toEqual(buildTrial(p, 5, 2));
  });

  it('always hold the answer among at least 5 buttons, in range', () => {
    for (const stage of STAGE_IDS) {
      const p = progressFrom([], stage);
      for (let i = 0; i < 60; i++) {
        const t = buildTrial(p, 100 + i, i);
        expect(t.choices.length).toBeGreaterThanOrEqual(C.choiceCount);
        expect(t.choices).toContain(t.answer);
        expect(Math.min(...t.choices)).toBeGreaterThanOrEqual(t.activity === 'gap' ? 1 : 1);
        expect(parseKey(t.key)?.answer).toBe(t.answer);
        expect(t.picture.dots.length).toBe(t.n);
      }
    }
  });

  it('use every type of the stage, flash only in stages 1 to 5, gaps only in 6, both in 7', () => {
    const ran = (stage: StageNumber) => {
      const p = progressFrom([], stage);
      const slots = new Set<string>();
      let last: { key: string } | null = null;
      for (let i = 0; i < 120; i++) {
        const t = buildTrial(p, 7, i, last);
        if (!t.review) slots.add(slotOf(t.activity, t.type));
        else expect(t.stage).toBeLessThan(stage);
        expect(t.stage === stage || t.review).toBe(true);
        if (!t.review) expect(t.stage).toBe(stage);
        last = t;
      }
      return slots;
    };
    expect(ran(1)).toEqual(new Set(['flash:line', 'flash:clus', 'flash:angl']));
    expect(ran(2)).toEqual(new Set(['flash:tenfive']));
    expect(ran(5)).toEqual(new Set(['flash:ten', 'flash:tenpair']));
    expect(ran(6)).toEqual(new Set(['gap:five', 'gap:ten', 'gap:tenpair']));
    expect(ran(7)).toEqual(new Set(['flash:tenmix', 'gap:tenmix']));
    for (const stage of [1, 2, 3, 4, 5] as const) {
      for (let i = 0; i < 40; i++) expect(buildTrial(progressFrom([], stage), 2, i).activity).toBe('flash');
    }
    for (let i = 0; i < 40; i++) {
      const t = buildTrial(progressFrom([], 6), 2, i);
      if (!t.review) expect(t.activity).toBe('gap');
    }
  });

  it('use the number ranges of the new stages', () => {
    const seen = { fiveGap: new Set<number>(), tenGap: new Set<number>(), mixFlash: new Set<number>(), mixGap: new Set<number>(), tenFlash: new Set<number>() };
    for (let i = 0; i < 400; i++) {
      const six = buildTrial(progressFrom([], 6), 40 + i, i);
      if (!six.review) (six.type === 'five' ? seen.fiveGap : seen.tenGap).add(six.n);
      const seven = buildTrial(progressFrom([], 7), 40 + i, i);
      if (!seven.review) (seven.activity === 'gap' ? seen.mixGap : seen.mixFlash).add(seven.n);
      const five = buildTrial(progressFrom([], 5), 40 + i, i);
      if (!five.review) seen.tenFlash.add(five.n);
    }
    expect([...seen.fiveGap].sort()).toEqual([1, 2, 3, 4]);
    expect([...seen.tenGap].sort((a, b) => a - b)).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect([...seen.mixGap].sort((a, b) => a - b)).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect([...seen.mixFlash].sort((a, b) => a - b)).toEqual([5, 6, 7, 8, 9, 10]);
    expect([...seen.tenFlash].sort((a, b) => a - b)).toEqual([5, 6, 7, 8, 9, 10]);
  });

  it('never repeat the same picture twice in a row', () => {
    const p = progressFrom([], 2);
    let last: { key: string } | null = null;
    for (let i = 0; i < 60; i++) {
      const t = buildTrial(p, 11, i, last);
      if (last) expect(t.key).not.toBe(last.key);
      last = t;
    }
  });

  it('mix in review from finished stages about a fifth of the time', () => {
    const p = progressFrom([], 7);
    let review = 0;
    for (let i = 0; i < 400; i++) if (buildTrial(p, 3, i).review) review++;
    expect(review).toBeGreaterThan(40);
    expect(review).toBeLessThan(130);
  });

  it('make pictures easier while stepping back, and start at the shorter flash', () => {
    const struggling = progressFrom(answersFor(5, [false, false, false, true, false]), 5);
    expect(struggling.stepBack).toBe(true);
    for (let i = 0; i < 50; i++) {
      const t = buildTrial(struggling, 9, i);
      if (!t.review) {
        expect(t.type).toBe('ten');
        expect(t.n).toBeLessThanOrEqual(8);
      }
    }
    expect(flashMs(5, Array(8).fill(true))).toBe(STAGES[4].flashGoodMs);
    expect(flashMs(5, [])).toBe(STAGES[4].flashStartMs);
    // Once ten-frames to 10 is finished the next pictures come from empty squares, shown for 1000 at first.
    expect(buildTrial(progressFrom(answersFor(5, Array(8).fill(true)), 5), 1, 0).flashMs).toBe(STAGES[5].flashStartMs);
    expect(buildTrial(progressFrom([], 5), 1, 0).flashMs).toBe(STAGES[4].flashStartMs);
    expect(buildTrial(progressFrom([], 2), 1, 0).flashMs).toBe(1200);
  });

  it('keep stepping back inside the small half for empty squares', () => {
    const struggling = progressFrom([...answersFor(6, [false, false, false, true, false])].map((a) => ({ ...a, key: gapKey('five', 2) })), 6);
    expect(struggling.stepBack).toBe(true);
    for (let i = 0; i < 50; i++) {
      const t = buildTrial(struggling, 9, i);
      if (!t.review) {
        expect(t.type).toBe('five');
        expect(t.answer).toBeLessThanOrEqual(4);
      }
    }
  });

  it('choicesFor keeps the answer, the count and the range, and starts the run at random', () => {
    const rng = rngFor(3);
    const starts = new Set<number>();
    for (let i = 0; i < 100; i++) {
      const c = choicesFor(3, 1, 8, 5, rng);
      expect(c).toHaveLength(5);
      expect(c).toContain(3);
      expect(Math.min(...c)).toBeGreaterThanOrEqual(1);
      expect(Math.max(...c)).toBeLessThanOrEqual(8);
      starts.add(c[0]);
    }
    expect(starts).toEqual(new Set([1, 2, 3]));
    // A short range is widened on both sides (never below 1).
    expect(choicesFor(2, 1, 3, 5, rng)).toEqual([1, 2, 3, 4, 5]);
    const wide = new Set<string>();
    for (let i = 0; i < 100; i++) wide.add(choicesFor(4, 3, 5, 5, rng).join());
    expect(wide).toEqual(new Set(['1,2,3,4,5', '2,3,4,5,6', '3,4,5,6,7']));
  });

  it('puts the answer in different button places and never offers numbers far above the stage', () => {
    for (const stage of STAGE_IDS) {
      const p = progressFrom([], stage);
      const places = new Set<number>();
      for (let i = 0; i < 200; i++) {
        const t = buildTrial(p, 500 + i, i);
        places.add(t.choices.indexOf(t.answer));
        expect(t.choices).toEqual([...t.choices].sort((a, b) => a - b));
        if (t.activity === 'flash' && !t.review) expect(Math.max(...t.choices)).toBeLessThanOrEqual(Math.max(STAGES[stage - 1].max + (stage === 3 ? 2 : 0), 5));
      }
      // Stage 1 (1 to 3) always shows 1 to 5, so the answer's place is the number itself.
      expect(places.size).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('placement', () => {
  it('moves up on right and down on wrong, within 1 to 7', () => {
    expect(C.placementTrials).toBe(8);
    expect(placementLevel([])).toBe(3);
    expect(placementLevel([true, true, true])).toBe(6);
    expect(placementLevel([true, true, true, true, true, true, true, true])).toBe(7);
    expect(placementLevel([false, false, false, false])).toBe(1);
    expect(placementLevel([false, false, false, false, false, false, false, false])).toBe(1);
    expect(placementLevel([false, true])).toBe(3);
    expect(startStageFrom([true, true, true, true, true])).toBe(7);
  });
  it('shows pictures from the level it is at, with no review', () => {
    for (let i = 0; i < 30; i++) expect(placementTrial([], 5 + i).stage).toBe(3);
    for (let i = 0; i < 30; i++) expect(placementTrial([true, true], 5 + i).stage).toBe(5);
    for (let i = 0; i < 30; i++) expect(placementTrial([true, true, true], 5 + i).activity).toBe('gap');
    for (let i = 0; i < 30; i++) expect(placementTrial([true, true, true, true], 5 + i).stage).toBe(7);
  });
});

describe('every picture that can be made', () => {
  it('has a key the server accepts and marks right for its own answer', () => {
    const now = Date.now();
    let made = 0;
    for (const start of STAGE_IDS) {
      for (let finishedBefore = 0; finishedBefore <= 7; finishedBefore++) {
        for (const stepBack of [false, true]) {
          const base = progressFrom([], start, undefined, finishedBefore);
          const progress = { ...base, stepBack };
          for (let seed = 1; seed <= 12; seed++) {
            let last: { key: string } | null = null;
            for (let i = 0; i < 6; i++) {
              const t = buildTrial(progress, seed, i, last);
              last = t;
              made++;
              const parsed = parseKey(t.key);
              expect(parsed, t.key).not.toBeNull();
              expect(parsed!.answer, t.key).toBe(t.answer);
              expect(parsed!.stage, t.key).toBe(t.stage);
              expect(parsed!.activity, t.key).toBe(t.activity);
              for (const key of [t.key, helpedKey(t.key)]) {
                const checked = checkItem({ type: 'answers', batchId: '123e4567-e89b-42d3-a456-426614174000', seed: 5, answers: [{ key, given: t.answer, ms: 1500, typingMs: 0, at: now - 1000, day: new Date(now - 1000).toISOString().slice(0, 10) }] }, now);
                expect(checked, key).toMatchObject({ ok: true, item: { answers: [{ correct: true }] } });
                const wrong = checkItem({ type: 'answers', batchId: '123e4567-e89b-42d3-a456-426614174000', seed: 5, answers: [{ key, given: t.answer + 1, ms: 1500, typingMs: 0, at: now - 1000, day: new Date(now - 1000).toISOString().slice(0, 10) }] }, now);
                expect(wrong, key).toMatchObject({ ok: true, item: { answers: [{ correct: false }] } });
              }
              if (t.activity === 'gap') {
                const [lo, hi] = GAP_FILLED[t.type]!;
                expect(t.n).toBeGreaterThanOrEqual(lo);
                expect(t.n).toBeLessThanOrEqual(hi);
              }
            }
          }
        }
      }
    }
    expect(made).toBeGreaterThan(1000);
  });
});
