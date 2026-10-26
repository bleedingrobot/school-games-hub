import { describe, expect, it } from 'vitest';
import { markProof, questionLevel } from './proof';

describe('a times-table proof', () => {
  // Hero level 7 asks times tables at campaign level 6 (×6 and ×9, with ×2 to ×10 as review).
  const tt = (kind: string, parts: string[] | undefined, given: number) => ({
    pack: 'times-tables', key: 'mul:6x8', kind, ...(parts ? { parts } : {}), level: questionLevel('times-tables', 7), given, ms: 2000,
  });
  const mark = (proof: object) => markProof(proof, 'healer', 7, 0);

  it('is right only with the missing number, and refused when the question shown does not match', () => {
    expect(mark(tt('missing-factor', ['?', '×', '8', '=', '48'], 6))).toMatchObject({ ok: true, correct: true });
    expect(mark(tt('missing-factor', ['?', '×', '8', '=', '48'], 8))).toMatchObject({ ok: true, correct: false });
    expect(mark(tt('divide', ['48', '÷', '8', '=', '?'], 6))).toMatchObject({ ok: true, correct: true });
    expect(mark(tt('multiply', ['8', '×', '6', '=', '?'], 48))).toMatchObject({ ok: true, correct: true });
    expect(mark(tt('missing-factor', ['?', '×', '7', '=', '42'], 6))).toEqual({ ok: false, problem: 'proof-parts' });
    expect(mark(tt('multiply', ['?', '×', '8', '=', '48'], 6))).toEqual({ ok: false, problem: 'proof-kind' });
  });
});
