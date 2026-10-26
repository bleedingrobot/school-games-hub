import { describe, expect, it } from 'vitest';
import { seeded } from '../seededRandom';
import { KINDS, YEAR_BANDS, buildQuestion, generateSpec, isValidSpec, kindsFor, markAnswer, type PracticalKind } from './practical';

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
const SAMPLES = 100;

describe('practical questions', () => {
  it('every kind at every band: valid, right by a second working, rebuildable, and only the right answer is marked right', () => {
    const bad: string[] = [];
    for (const band of YEAR_BANDS) {
      for (const kind of kindsFor(band)) {
        const random = seeded(band * 1000 + KINDS.indexOf(kind));
        for (let i = 0; i < SAMPLES; i++) {
          const spec = generateSpec(kind, band, random, TABLES);
          const q = buildQuestion(spec.kind, spec.nums);
          const sound =
            isValidSpec(spec) &&
            Number.isInteger(q.answer) &&
            q.answer === ORACLE[kind](spec.nums) &&
            JSON.stringify(buildQuestion(kind, [...spec.nums])) === JSON.stringify(q) &&
            markAnswer(q, q.answer) &&
            !markAnswer(q, q.answer + 1) &&
            !markAnswer(q, null) &&
            (!q.choices || q.choices.filter((c) => c.value === q.answer).length === 1);
          if (!sound) bad.push(`Year ${band} ${kind} ${JSON.stringify(spec.nums)}: ${q.text} = ${q.answer}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('gets the tricky ones right: remainders, rounding up, tax, 12.5%, negatives and close deals', () => {
    const answer = (kind: PracticalKind, nums: number[]) => buildQuestion(kind, nums).answer;
    expect(answer('share-whole', [47, 7])).toBe(6);
    expect(answer('share-left', [47, 7])).toBe(5);
    expect(answer('round-up', [85, 20])).toBe(5);
    expect(answer('round-up', [80, 20])).toBe(4);
    expect(answer('price-with-tax', [65, 10])).toBe(72); // 71.5 rounds up to a whole gold piece
    expect(answer('percent-of', [12.5, 80])).toBe(10);
    expect(answer('negative', [3, -8])).toBe(-5);
    expect(answer('better-buy', [999, 10, 1000, 10])).toBe(1); // a gold piece apart
    expect(isValidSpec({ kind: 'better-buy', nums: [100, 3, 200, 6] })).toBe(false); // a tie
  });
});
