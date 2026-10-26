import { describe, expect, it } from 'vitest';
import { STAGES, SUBITISING_CONFIG as C, type PictureType } from './config';
import { growth, isStruggling, progressFrom, stageDone, type SubAnswer } from './engine';
import { gapKey, parseKey, subKey } from './keys';
import { BOX, DOT_R, MIN_GAP, closestPair, groupSizes, makeGapPicture, makePicture } from './patterns';
import { placementLevel, placementTrial } from './placement';
import { buildTrial, choicesFor, rngFor } from './trials';

const ALL_TYPES = STAGES.flatMap((s) => s.types.map((t) => [s, t] as const));

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

  it('draw a die the usual way', () => {
    expect(makePicture('dice', 5, rngFor(1)).dots).toHaveLength(5);
    expect(makePicture('dice', 5, rngFor(1)).die?.turn).toBe(0);
    expect(makePicture('dicet', 4, rngFor(1)).die?.turn).toBe(45);
  });

  it('refuse a Missing Spots picture that is full or empty', () => {
    expect(() => makeGapPicture('five', 5, rngFor(1))).toThrow();
    expect(() => makeGapPicture('ten', 0, rngFor(1))).toThrow();
    expect(() => makeGapPicture('dice', 3, rngFor(1))).toThrow();
    expect(makeGapPicture('ten', 7, rngFor(1)).dots).toHaveLength(7);
  });
});

describe('keys', () => {
  it('give the answer from the key alone', () => {
    expect(parseKey(subKey('ten', 8))).toMatchObject({ activity: 'flash', answer: 8, stage: 4 });
    expect(parseKey(gapKey('ten', 7))).toMatchObject({ activity: 'gap', answer: 3, stage: 4 });
    expect(parseKey(gapKey('five', 4))).toMatchObject({ answer: 1, stage: 3 });
  });
  it('refuse keys that are not ours or make no sense', () => {
    for (const k of ['sub:nope-3', 'gap:five-5', 'gap:dice-3', 'gap:ten-0', 'mul:6x7', 'sub:ten-', 'sub:ten-123']) expect(parseKey(k), k).toBeNull();
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
    expect(p.stages.map((s) => s.finished)).toEqual([true, true, false, false]);
    expect(p.current).toBe(3);
  });

  it('stay on the last stage when everything is finished', () => {
    expect(progressFrom([], 4).current).toBe(4);
    const done = progressFrom([...answersFor(4, Array(8).fill(true))], 4);
    expect(done.stages[3].finished).toBe(true);
    expect(done.current).toBe(4);
  });

  it('step back below 60% over the last 5', () => {
    expect(progressFrom(answersFor(1, [true, true, false, false, false])).stepBack).toBe(true);
    expect(progressFrom(answersFor(1, [true, true, true, false, false])).stepBack).toBe(false);
    expect(progressFrom(answersFor(1, [false, false, false])).stepBack).toBe(false);
  });

  it('stageDone needs the window and the types', () => {
    expect(stageDone(1, [], C)).toBe(false);
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
    for (let stage = 1; stage <= 4; stage++) {
      const p = progressFrom([], stage as 1 | 2 | 3 | 4);
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

  it('use every type of the stage, and only gaps on frame stages', () => {
    const p = progressFrom([], 4);
    const types = new Set<string>();
    const activities = new Set<string>();
    let last: { key: string } | null = null;
    for (let i = 0; i < 80; i++) {
      const t = buildTrial(p, 7, i, last);
      if (!t.review) types.add(t.type);
      activities.add(t.activity);
      last = t;
    }
    expect(types).toEqual(new Set(['ten', 'tenpair', 'tenmix']));
    expect(activities).toEqual(new Set(['flash', 'gap']));
    const one = progressFrom([], 1);
    for (let i = 0; i < 30; i++) expect(buildTrial(one, 2, i).activity).toBe('flash');
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
    const p = progressFrom([], 4);
    let review = 0;
    for (let i = 0; i < 400; i++) if (buildTrial(p, 3, i).review) review++;
    expect(review).toBeGreaterThan(40);
    expect(review).toBeLessThan(130);
  });

  it('make pictures easier while stepping back, and start at the shorter flash', () => {
    const struggling = progressFrom(answersFor(4, [false, false, false, true, false]), 4);
    expect(struggling.stepBack).toBe(true);
    for (let i = 0; i < 50; i++) {
      const t = buildTrial(struggling, 9, i);
      if (!t.review) {
        expect(t.type).toBe('ten');
        expect(t.n).toBeLessThanOrEqual(8);
      }
    }
    const good = progressFrom(answersFor(4, Array(8).fill(true)), 4);
    expect(buildTrial(good, 1, 0).flashMs).toBe(STAGES[3].flashGoodMs);
    expect(buildTrial(progressFrom([], 4), 1, 0).flashMs).toBe(STAGES[3].flashStartMs);
  });

  it('choicesFor keeps the answer and the count', () => {
    expect(choicesFor(1, 1, 4, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(choicesFor(3, 1, 4, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(choicesFor(10, 4, 11, 5)).toEqual([7, 8, 9, 10, 11]);
  });
});

describe('placement', () => {
  it('moves up on right and down on wrong, within 1 to 4', () => {
    expect(placementLevel([])).toBe(3);
    expect(placementLevel([true, true, true])).toBe(4);
    expect(placementLevel([false, false, false, false])).toBe(1);
    expect(placementLevel([false, true])).toBe(3);
  });
  it('shows pictures from the level it is at, with no review', () => {
    for (let i = 0; i < 30; i++) expect(placementTrial([], 5 + i).stage).toBe(3);
    for (let i = 0; i < 30; i++) expect(placementTrial([true, true], 5 + i).stage).toBe(4);
  });
});
