import { describe, expect, it } from 'vitest';
import { BOND_SETS, pairMakesTarget } from './bonds';

describe('bond sets', () => {
  it('every pair in every set adds up to the target', () => {
    for (const set of BOND_SETS) for (const pair of set.pairs) expect(pairMakesTarget(set, pair), set.id).toBe(true);
  });
});
