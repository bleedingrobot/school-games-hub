import { describe, expect, it } from 'vitest';
import { FACTS } from './facts';

describe('fact list', () => {
  it('answers are right for every fact', () => {
    for (const f of FACTS) {
      if (f.kind === 'mul') expect(f.a * f.b).toBe(f.answer);
      else expect(f.b * f.answer).toBe(f.a);
    }
  });
});
