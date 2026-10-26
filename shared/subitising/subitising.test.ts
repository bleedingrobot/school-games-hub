import { describe, expect, it } from 'vitest';
import { STAGES, SUBITISING_CONFIG as C, type PictureType } from './config';
import { progressFrom } from './engine';
import { parseKey } from './keys';
import { BOX, DOT_R, MIN_GAP, closestPair, makePicture } from './patterns';
import { buildTrial, rngFor } from './trials';

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
});

describe('trials', () => {
  it('always hold the answer among at least 5 buttons, in range', () => {
    for (let stage = 1; stage <= 4; stage++) {
      const p = progressFrom([], stage as 1 | 2 | 3 | 4);
      for (let i = 0; i < 60; i++) {
        const t = buildTrial(p, 100 + i, i);
        expect(t.choices.length).toBeGreaterThanOrEqual(C.choiceCount);
        expect(t.choices).toContain(t.answer);
        expect(parseKey(t.key)?.answer).toBe(t.answer);
        expect(t.picture.dots.length).toBe(t.n);
      }
    }
  });
});
