import { describe, expect, it } from 'vitest';
import { damageFor, makeMonster } from './rules';

describe('damage', () => {
  const a = makeMonster('plusplash-1', 10); // water
  const normalFoe = makeMonster('digibud-1', 10); // leaf: water has no edge either way
  it('right is normal, quick-right ×1.5, wrong a quarter', () => {
    const right = damageFor(a, 60, normalFoe, 'right', 0).damage;
    expect(damageFor(a, 60, normalFoe, 'quick-right', 0).damage).toBeCloseTo(right * 1.5, -1);
    expect(damageFor(a, 60, normalFoe, 'wrong', 0).damage).toBeCloseTo(right / 4, -1);
    expect(damageFor(a, 60, normalFoe, 'wrong', 0).damage).toBeGreaterThanOrEqual(1);
  });
});
