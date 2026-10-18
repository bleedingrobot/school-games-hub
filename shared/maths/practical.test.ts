import { describe, expect, it } from 'vitest';
import { seeded } from '../seededRandom';
import {
  DEFAULT_PRACTICAL_SETTINGS, KINDS, TOPICS, YEAR_BANDS, buildQuestion, fmt, generateQuestion, generateSpec, isValidSpec, kindsFor, markAnswer,
  pickQuestion, readPracticalSettings, topicAvailable, type PracticalKind, type PracticalSettings, type YearBand,
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
const SAMPLES = 150;

describe('every kind at every band', () => {
  for (const band of YEAR_BANDS) {
    for (const kind of kindsFor(band)) {
      it(`Year ${band} ${kind}: valid questions, one right answer, rebuildable`, () => {
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
      });
    }
  }

  it('asks negative numbers only in Year 6', () => {
    expect(kindsFor(4)).not.toContain('negative');
    expect(kindsFor(5)).not.toContain('negative');
    expect(kindsFor(6)).toContain('negative');
    expect(() => generateSpec('negative', 5, seeded(1))).toThrow();
  });

  it('gives every topic at least one kind at every band except integers below Year 6', () => {
    for (const band of YEAR_BANDS) for (const topic of TOPICS) expect(kindsFor(band, [topic]).length > 0).toBe(topic !== 'integers' || band === 6);
  });
});

describe('easy bands stay sensible', () => {
  it('Years 4 and 5 have no negative or silly numbers', () => {
    for (const band of [4, 5] as YearBand[]) {
      const random = seeded(band * 77);
      for (const kind of kindsFor(band)) {
        for (let i = 0; i < SAMPLES; i++) {
          const q = generateQuestion(kind, band, random, TABLES);
          expect(q.nums.every((n) => n >= 0 && Number.isInteger(n))).toBe(true);
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(q.answer).toBeLessThanOrEqual(1000);
          expect(q.text).not.toContain('−');
        }
      }
    }
  });

  it('Year 4 uses round percentages and a 10% tax; Year 6 reaches 12.5%, 15% and 35%', () => {
    const seen = (band: YearBand, kind: PracticalKind, at: number) => {
      const random = seeded(5);
      const out = new Set<number>();
      for (let i = 0; i < 400; i++) out.add(generateSpec(kind, band, random).nums[at]);
      return out;
    };
    expect([...seen(4, 'percent-of', 0)].sort((a, b) => a - b)).toEqual([10, 25, 50]);
    expect([...seen(4, 'price-with-tax', 1)]).toEqual([10]);
    for (const pct of [12.5, 15, 35]) expect(seen(6, 'percent-of', 0).has(pct)).toBe(true);
  });

  it('Year 4 and 5 percent and tax questions come out exact (no rounding needed)', () => {
    for (const band of [4, 5] as YearBand[]) {
      const random = seeded(31);
      for (const kind of ['percent-of', 'price-with-tax'] as const) {
        for (let i = 0; i < SAMPLES; i++) expect(generateQuestion(kind, band, random).text).not.toContain('Round up');
      }
    }
  });
});

describe('same seed, same question', () => {
  it('picks the same numbers and words from the same seed', () => {
    for (const band of YEAR_BANDS) {
      for (const kind of kindsFor(band)) {
        const a = generateQuestion(kind, band, seeded(99), TABLES);
        const b = generateQuestion(kind, band, seeded(99), TABLES);
        expect(a).toEqual(b);
      }
    }
  });

  it('different seeds give different questions often enough', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) seen.add(generateQuestion('percent-of', 5, seeded(seed)).text);
    expect(seen.size).toBeGreaterThan(10);
  });
});

describe('tricky answers are marked right', () => {
  const answer = (kind: PracticalKind, nums: number[]) => buildQuestion(kind, nums).answer;

  it('remainders: 47 points at 7 each buys 6 with 5 left over', () => {
    expect(answer('share-whole', [47, 7])).toBe(6);
    expect(answer('share-left', [47, 7])).toBe(5);
    expect(answer('share-left', [42, 7])).toBe(0);
    expect(answer('share-whole', [6, 7])).toBe(0);
    expect(answer('share-left', [6, 7])).toBe(6);
  });

  it('rounding up: 85 footmen need 5 barracks of 20, and 80 need exactly 4', () => {
    expect(answer('round-up', [85, 20])).toBe(5);
    expect(answer('round-up', [80, 20])).toBe(4);
    expect(answer('round-up', [81, 20])).toBe(5);
    expect(answer('round-up', [1, 20])).toBe(1);
    expect(buildQuestion('round-up', [85, 20]).working.join(' ')).toContain('round up');
  });

  it('tax rounds up to a whole gold piece', () => {
    expect(answer('price-with-tax', [65, 10])).toBe(72); // 71.5
    expect(answer('price-with-tax', [240, 10])).toBe(264);
    expect(answer('price-with-tax', [100, 12.5])).toBe(113); // 112.5
    expect(buildQuestion('price-with-tax', [65, 10]).text).toContain('Round up');
    expect(buildQuestion('price-with-tax', [240, 10]).text).not.toContain('Round up');
  });

  it('percentages, including 12.5% and 75%', () => {
    expect(answer('percent-of', [25, 480])).toBe(120);
    expect(answer('percent-of', [12.5, 80])).toBe(10);
    expect(answer('percent-of', [75, 60])).toBe(45);
    expect(answer('percent-of', [35, 40])).toBe(14);
    expect(answer('percent-of', [20, 50])).toBe(10);
    expect(answer('percent-of', [25, 150])).toBe(38); // 37.5 rounded up
  });

  it('change from 1,000, with one thing or two', () => {
    expect(answer('change', [1000, 640])).toBe(360);
    expect(answer('change', [1000, 350, 275])).toBe(375);
    expect(buildQuestion('change', [1000, 640]).text).toContain('1,000');
  });

  it('negative numbers', () => {
    expect(answer('negative', [3, -8])).toBe(-5);
    expect(answer('negative', [-4, 7])).toBe(3);
    expect(answer('negative', [-2, -5])).toBe(-7);
    const q = buildQuestion('negative', [3, -8]);
    expect(markAnswer(q, -5)).toBe(true);
    expect(markAnswer(q, 5)).toBe(false);
    expect(q.text).toContain('3');
    expect(q.working.join(' ')).toContain('−5');
  });

  it('better buy compares exactly, even when the rates are close', () => {
    expect(answer('better-buy', [500, 7, 750, 8])).toBe(1); // 71.4 vs 93.75
    expect(answer('better-buy', [120, 4, 150, 6])).toBe(2); // 30 each vs 25 each
    expect(answer('better-buy', [999, 10, 1000, 10])).toBe(1); // a gold piece apart
  });

  it('refuses a better-buy question with a tie, and other nonsense numbers', () => {
    expect(isValidSpec({ kind: 'better-buy', nums: [100, 3, 200, 6] })).toBe(false);
    expect(isValidSpec({ kind: 'share-whole', nums: [10, 0] })).toBe(false);
    expect(isValidSpec({ kind: 'area', nums: [3.5, 4] })).toBe(false);
    expect(isValidSpec({ kind: 'ratio', nums: [0, 3, 5, 10] })).toBe(false);
    expect(isValidSpec({ kind: 'nope' as PracticalKind, nums: [] })).toBe(false);
    expect(() => buildQuestion('area', [0, 4])).toThrow();
  });

  it('uses the names given for the two offers', () => {
    const q = buildQuestion('better-buy', [500, 7, 750, 8], { labels: ['Axe', 'Sword'] });
    expect(q.choices).toEqual([{ value: 1, label: 'Axe' }, { value: 2, label: 'Sword' }]);
    expect(q.text).toContain('Axe');
    expect(q.answer).toBe(1);
  });

  it('troop costs, ratios and budgets', () => {
    expect(answer('troop-cost', [12, 4, 0])).toBe(300);
    expect(answer('troop-cost', [1, 1, 1])).toBe(105);
    expect(answer('ratio', [0, 2, 3, 8])).toBe(12);
    expect(answer('ratio', [1, 2, 3, 100])).toBe(60);
    expect(answer('budget-left', [1, 100, 30, 7, 12])).toBe(51);
    expect(answer('budget-left', [0, 600, 180])).toBe(420);
    expect(answer('church-bill', [10, 4, 4, 4])).toBe(150);
  });
});

describe('teacher switches', () => {
  const all = (over: Partial<PracticalSettings> = {}): PracticalSettings => ({ ...DEFAULT_PRACTICAL_SETTINGS, enabledTopics: [...TOPICS], ...over });

  it('asks only the topics left on, at the chosen band', () => {
    const random = seeded(3);
    const settings = all({ enabledTopics: ['area'], yearBand: 4 });
    for (let i = 0; i < 40; i++) expect(['area', 'perimeter']).toContain(pickQuestion(settings, random)!.kind);
  });

  it('gives nothing when every topic is off, or only integers below Year 6', () => {
    expect(pickQuestion(all({ enabledTopics: [] }), seeded(1))).toBeNull();
    expect(pickQuestion(all({ enabledTopics: ['integers'], yearBand: 5 }), seeded(1))).toBeNull();
    expect(pickQuestion(all({ enabledTopics: ['integers'], yearBand: 6 }), seeded(1))!.kind).toBe('negative');
    expect(topicAvailable(all({ yearBand: 4 }), 'integers')).toBe(false);
  });

  it('uses the times tables the teacher left on', () => {
    const random = seeded(8);
    const settings = all({ enabledTopics: ['times'], enabledTables: [7], yearBand: 5 });
    for (let i = 0; i < 30; i++) expect(pickQuestion(settings, random)!.nums[0]).toBe(7);
  });

  it('reads saved settings safely', () => {
    expect(readPracticalSettings(undefined)).toEqual(DEFAULT_PRACTICAL_SETTINGS);
    expect(readPracticalSettings('rubbish')).toEqual(DEFAULT_PRACTICAL_SETTINGS);
    const read = readPracticalSettings({ enabledTopics: ['area', 'nope', 'area'], yearBand: 6, enabledTables: [12, 3, 3, 40, 'x'] });
    expect(read).toEqual({ enabledTopics: ['area'], yearBand: 6, enabledTables: [3, 12] });
    expect(readPracticalSettings({ yearBand: 9 }).yearBand).toBe(DEFAULT_PRACTICAL_SETTINGS.yearBand);
    expect(readPracticalSettings({ enabledTopics: [] }).enabledTopics).toEqual([]);
    expect(readPracticalSettings({ enabledTables: [] }).enabledTables).toEqual(DEFAULT_PRACTICAL_SETTINGS.enabledTables);
  });

  it('tops up every topic equally, so a switched-on topic is not drowned out', () => {
    const random = seeded(12);
    const counts = new Map<string, number>();
    const settings = all({ yearBand: 6 });
    for (let i = 0; i < 4000; i++) {
      const q = pickQuestion(settings, random)!;
      counts.set(q.topic, (counts.get(q.topic) ?? 0) + 1);
    }
    expect(counts.size).toBe(TOPICS.length);
    for (const n of counts.values()) expect(n).toBeGreaterThan(4000 / TOPICS.length / 2);
  });
});

describe('fmt', () => {
  it('writes numbers for people', () => {
    expect(fmt(1000)).toBe('1,000');
    expect(fmt(12.5)).toBe('12.5');
    expect(fmt(-5)).toBe('−5');
    expect(fmt(0)).toBe('0');
    expect(fmt(1234567)).toBe('1,234,567');
  });
});
