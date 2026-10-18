import { describe, expect, it } from 'vitest';
import { FACT_BY_KEY, FACTS, FAMILIES, buildFacts, digitsOf, divKey, factStep, mulKey, tableStep } from './facts';

describe('fact list', () => {
  it('has every times fact up to 12 x 12 once (78 families) and every division fact', () => {
    expect(FAMILIES).toHaveLength(78);
    const mul = FACTS.filter((f) => f.kind === 'mul');
    expect(mul).toHaveLength(78);
    // 12 square families have one division fact; the other 66 have two.
    expect(FACTS.filter((f) => f.kind === 'div')).toHaveLength(12 + 66 * 2);
    expect(new Set(FACTS.map((f) => f.key)).size).toBe(FACTS.length);
  });

  it('answers are right for every fact', () => {
    for (const f of FACTS) {
      if (f.kind === 'mul') expect(f.a * f.b).toBe(f.answer);
      else expect(f.b * f.answer).toBe(f.a);
    }
  });

  it('uses the maths focus plan key style, smaller number first', () => {
    expect(mulKey(7, 6)).toBe('mul:6x7');
    expect(divKey(42, 6)).toBe('div:42/6');
    expect(FACT_BY_KEY.get('mul:6x7')?.answer).toBe(42);
    expect(FACT_BY_KEY.get('div:42/7')?.answer).toBe(6);
  });

  it('groups 6x7, 7x6, 42/6 and 42/7 into one family', () => {
    const fam = FAMILIES.find((f) => f.a === 6 && f.b === 7)!;
    expect(fam.mulKey).toBe('mul:6x7');
    expect(fam.divKeys).toEqual(['div:42/6', 'div:42/7']);
    expect(FACTS.filter((f) => f.familyKey === fam.key).map((f) => f.key).sort()).toEqual(['div:42/6', 'div:42/7', 'mul:6x7']);
    const square = FAMILIES.find((f) => f.a === 8 && f.b === 8)!;
    expect(square.divKeys).toEqual(['div:64/8']);
  });

  it('follows the NZC family order for steps', () => {
    expect([2, 5, 10].map((t) => tableStep(t))).toEqual([1, 1, 1]);
    expect([3, 4, 8].map((t) => tableStep(t))).toEqual([2, 2, 2]);
    expect([6, 9].map((t) => tableStep(t))).toEqual([3, 3]);
    expect(tableStep(7)).toBe(4);
    expect([11, 12].map((t) => tableStep(t))).toEqual([5, 5]);
    // A fact is learned with the earlier of its two tables.
    expect(factStep(2, 7)).toBe(1);
    expect(factStep(6, 8)).toBe(2);
    expect(factStep(6, 7)).toBe(3);
    expect(factStep(7, 7)).toBe(4);
    expect(factStep(11, 12)).toBe(5);
  });

  it('every step has facts and steps 1 to 5 are all used', () => {
    for (let s = 1; s <= 5; s++) expect(FACTS.some((f) => f.step === s && f.kind === 'mul')).toBe(true);
    expect(buildFacts()).toHaveLength(FACTS.length);
  });

  it('counts answer digits', () => {
    expect([4, 42, 132].map(digitsOf)).toEqual([1, 2, 3]);
  });
});
