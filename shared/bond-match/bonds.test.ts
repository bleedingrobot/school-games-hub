import { describe, expect, it } from 'vitest';
import { BOND_SETS, pairMakesTarget } from './bonds';
import { sideText } from './exact';

describe('bond sets', () => {
  it('every pair in every set adds up to the target and no pair is listed twice', () => {
    for (const set of BOND_SETS) {
      for (const pair of set.pairs) expect(pairMakesTarget(set, pair)).toBe(true);
      const names = set.pairs.map((p) => p.map(sideText).sort().join('+'));
      expect(new Set(names).size).toBe(names.length);
    }
  });
});
