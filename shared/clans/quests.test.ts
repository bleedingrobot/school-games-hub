import { describe, expect, it } from 'vitest';
import { YEAR_BANDS, markAnswer } from '../maths/practical';
import { PUZZLE_KINDS, buildPuzzle, isValidPuzzle, makePuzzle } from './quests';

describe('quest puzzles', () => {
  it('are always valid, rebuild the same, and have exactly one right answer among the choices', () => {
    for (const band of YEAR_BANDS) for (const kind of PUZZLE_KINDS) {
      if (kind === 'cold' && band !== 6) continue;
      for (let seed = 1; seed <= 50; seed++) {
        const spec = makePuzzle(kind, band, seed * 7919);
        expect(isValidPuzzle(spec), `${kind} ${band} ${seed}`).toBe(true);
        const q = buildPuzzle(spec);
        expect(buildPuzzle({ kind: spec.kind, nums: [...spec.nums] })).toEqual(q);
        expect(Number.isInteger(q.answer)).toBe(true);
        expect(markAnswer(q, q.answer)).toBe(true);
        expect(markAnswer(q, q.answer + 1)).toBe(false);
        expect(q.working.length).toBeGreaterThanOrEqual(2);
        if (q.choices) expect(q.choices.filter((c) => c.value === q.answer)).toHaveLength(1);
      }
    }
  });
});
