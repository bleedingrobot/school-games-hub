import { describe, expect, it } from 'vitest';
import { BOND_SETS, findBondSet, pairMakesTarget } from './bonds';
import { addExact, exact, sideText, sideValue, sumText } from './exact';

describe('bond sets', () => {
  it('has the sets from the plan, with unique ids', () => {
    expect(BOND_SETS).toHaveLength(16);
    expect(new Set(BOND_SETS.map((b) => b.id)).size).toBe(16);
  });

  it('counts the distinct pairs in each set', () => {
    const counts = Object.fromEntries(BOND_SETS.map((b) => [b.id, b.pairs.length]));
    expect(counts).toEqual({
      'whole-10': 5, 'whole-20': 10, 'whole-100-tens': 5, 'whole-100-any': 50, 'whole-1000-hundreds': 5, 'whole-1000-tens': 50,
      'decimal-1-tenths': 5, 'decimal-1-hundredths': 50, 'decimal-10-tenths': 50,
      'fraction-halves': 1, 'fraction-thirds': 1, 'fraction-quarters': 2, 'fraction-fifths': 2,
      'fraction-sixths': 3, 'fraction-eighths': 4, 'fraction-tenths': 5,
    });
  });

  it.each(BOND_SETS.map((b) => [b.id, b] as const))('%s: every pair adds up to the target and no pair is listed twice', (_id, set) => {
    for (const pair of set.pairs) expect(pairMakesTarget(set, pair)).toBe(true);
    const names = set.pairs.map((p) => p.map(sideText).sort().join('+'));
    expect(new Set(names).size).toBe(names.length);
  });

  it('draws sides the same way every time', () => {
    const hundredths = findBondSet('decimal-1-hundredths')!;
    expect(hundredths.pairs[29].map(sideText)).toEqual(['0.30', '0.70']);
    expect(findBondSet('decimal-10-tenths')!.pairs[49].map(sideText)).toEqual(['5.0', '5.0']);
    expect(findBondSet('fraction-eighths')!.pairs[0].map(sideText)).toEqual(['1/8', '7/8']);
  });

  it('can hold mixed forms: a pair is any two sides that add to the target', () => {
    const half = { kind: 'fraction', num: 1, den: 4 } as const;
    const dec = { kind: 'decimal', units: 75, places: 2 } as const;
    expect(addExact(sideValue(half), sideValue(dec))).toEqual(exact(1));
  });
});

describe('exact sums', () => {
  it('never shows floating point noise', () => {
    expect(sumText([{ kind: 'decimal', units: 1, places: 1 }, { kind: 'decimal', units: 2, places: 1 }])).toBe('0.3');
    expect(sumText([{ kind: 'decimal', units: 30, places: 2 }, { kind: 'decimal', units: 70, places: 2 }])).toBe('1.00');
    expect(sumText([{ kind: 'decimal', units: 34, places: 1 }, { kind: 'decimal', units: 66, places: 1 }])).toBe('10.0');
  });
  it('adds fractions exactly and reduces', () => {
    expect(sumText([{ kind: 'fraction', num: 1, den: 3 }, { kind: 'fraction', num: 1, den: 6 }])).toBe('1/2');
    expect(sumText([{ kind: 'fraction', num: 3, den: 8 }, { kind: 'fraction', num: 5, den: 8 }])).toBe('1');
    expect(sumText([{ kind: 'fraction', num: 3, den: 4 }, { kind: 'fraction', num: 3, den: 4 }])).toBe('3/2');
  });
  it('adds whole numbers', () => {
    expect(sumText([{ kind: 'whole', n: 3 }, { kind: 'whole', n: 4 }])).toBe('7');
  });
});
