import { describe, expect, it } from 'vitest';
import { YEAR_BANDS, markAnswer } from '../maths/practical';
import {
  PUZZLE_KINDS, buildPuzzle, isValidPuzzle, makePuzzle
} from './quests';

describe('puzzles', () => {
  it('are always valid, rebuild the same, and have exactly one right answer among the choices', () => {
    for (const band of YEAR_BANDS) for (const kind of PUZZLE_KINDS) {
      if (kind === 'cold' && band !== 6) continue;
      for (let seed = 1; seed <= 200; seed++) {
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
  it('work out the right answers', () => {
    expect(buildPuzzle({ kind: 'pattern', nums: [0, 4, 5, 5] }).answer).toBe(29);
    expect(buildPuzzle({ kind: 'pattern', nums: [1, 1, 1, 5] }).answer).toBe(16);
    expect(buildPuzzle({ kind: 'pattern', nums: [2, 3, 2, 5] }).answer).toBe(96);
    expect(buildPuzzle({ kind: 'riddle', nums: [7, 3, 4, 0] }).answer).toBe(7);
    expect(buildPuzzle({ kind: 'riddle', nums: [7, 3, 4, 0] }).text).toContain('25');
    expect(buildPuzzle({ kind: 'riddle', nums: [7, 3, 4, 1] }).text).toContain('17');
    expect(buildPuzzle({ kind: 'cold', nums: [5, -8] }).answer).toBe(-3);
    // Ash, Bree, Cob in that order; who sits in the middle?
    const mid = buildPuzzle({ kind: 'order', nums: [0, 3, 2, 0, 1, 2] });
    expect(mid.choices!.find((c) => c.value === mid.answer)!.label).toBe('Bree');
    const right = buildPuzzle({ kind: 'order', nums: [0, 3, 1, 2, 0, 1] });
    expect(right.choices!.find((c) => c.value === right.answer)!.label).toBe('Bree');
  });
});
