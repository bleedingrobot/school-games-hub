import { describe, expect, it } from 'vitest';
import { GAP_FILLED, STAGES, SUBITISING_CONFIG as C, type PictureType} from './config';
import { checkItem } from '../training/save';
import { progressFrom, type SubAnswer } from './engine';
import { gapKey, helpedKey, parseKey, subKey } from './keys';
import { BOX, DOT_R, MIN_GAP, closestPair, makePicture } from './patterns';
import { buildTrial, rngFor } from './trials';

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

});

describe('keys', () => {
  it('give the answer from the key alone', () => {
    expect(parseKey(subKey('ten', 8))).toMatchObject({ activity: 'flash', answer: 8, stage: 5 });
    expect(parseKey(gapKey('ten', 7))).toMatchObject({ activity: 'gap', answer: 3, stage: 6 });
    expect(parseKey(gapKey('five', 4))).toMatchObject({ answer: 1, stage: 6 });
  });
});

const answersFor = (stage: number, rights: boolean[]): SubAnswer[] => {
  const types = STAGES[stage - 1].types;
  const n = STAGES[stage - 1].min;
  return rights.map((correct, i) => ({ key: subKey(types[i % types.length], n), correct, at: i }));
};

describe('stages', () => {
  it('finish a stage at 7 right of the last 8, with every type seen', () => {
    const rights = [true, true, true, true, true, true, true, false];
    expect(progressFrom(answersFor(1, rights)).stages[0].finished).toBe(true);
    expect(progressFrom(answersFor(1, rights)).current).toBe(2);
  });

});

describe('trials', () => {
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
