import { describe, expect, it } from 'vitest';
import { seeded } from '../seededRandom';
import {
  KINDS, YEAR_BANDS, buildQuestion, fmt, generateSpec, isValidSpec, kindsFor, markAnswer,
  type PracticalKind, 
} from './practical';

/** A second, plain way to work out each answer, so the builder isn't only checked against itself. */
const ORACLE: Record<PracticalKind, (n: number[]) => number> = {
  'percent-of': ([pct, amount]) => Math.ceil(Math.round(amount * pct * 10) / 1000 - 1e-9),
  'price-with-tax': ([price, tax]) => Math.ceil(Math.round(price * (100 + tax) * 10) / 1000 - 1e-9),
  change: ([paid, ...costs]) => costs.reduce((left, c) => left - c, paid),
  area: ([w, h]) => w * h,
  perimeter: ([w, h]) => w + h + w + h,
  'share-whole': ([total, per]) => { let n = 0; while ((n + 1) * per <= total) n++; return n; },
  'share-left': ([total, per]) => total % per,
  'round-up': ([count, cap]) => { let n = 0; while (n * cap < count) n++; return n; },
  'troop-cost': ([f, a, k]) => f * 15 + a * 30 + k * 60,
  'budget-left': ([, total, ...spent]) => spent.reduce((left, s) => left - s, total),
  ratio: ([mode, a, b, n]) => (mode === 0 ? (n / a) * b : (n / (a + b)) * Math.max(a, b)),
  negative: ([start, change]) => start + change,
  'better-buy': ([pa, na, pb, nb]) => (pa / na < pb / nb ? 1 : 2),
  'church-bill': ([per, ...levels]) => levels.reduce((t, l) => t + (l + 1) * per, 0),
  times: ([a, b]) => a * b,
};

const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const SAMPLES = 60;

describe('practical questions', () => {
  it('every kind at every year band is valid, has one right answer and is rebuildable', () => {
  for (const band of YEAR_BANDS) {
    for (const kind of kindsFor(band)) {
      {
        const random = seeded(band * 1000 + KINDS.indexOf(kind));
        for (let i = 0; i < SAMPLES; i++) {
          const spec = generateSpec(kind, band, random, TABLES);
          expect(isValidSpec(spec)).toBe(true);
          const q = buildQuestion(spec.kind, spec.nums);
          expect(Number.isInteger(q.answer)).toBe(true);
          expect(q.answer).toBe(ORACLE[kind](spec.nums));
          expect(q.text.length).toBeGreaterThan(5);
          expect(q.working.length).toBeGreaterThan(0);
          // Rebuilt from its numbers it is the same question.
          expect(buildQuestion(kind, [...spec.nums])).toEqual(q);
          // Only the right answer is right.
          expect(markAnswer(q, q.answer)).toBe(true);
          expect(markAnswer(q, q.answer + 1)).toBe(false);
          expect(markAnswer(q, null)).toBe(false);
          if (q.choices) expect(q.choices.filter((c) => c.value === q.answer)).toHaveLength(1);
          // Worked answer ends in the answer.
          if (!q.choices) expect(q.working.join(' ')).toContain(fmt(Math.abs(q.answer)));
        }
      }
    }
  }
  });
});

