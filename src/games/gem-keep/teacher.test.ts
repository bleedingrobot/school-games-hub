import { describe, expect, it } from 'vitest';
import { gemKeepSummary, tablesText } from './teacher';

describe('Gem Keep’s line in the Games table', () => {
  it('says the mode, the tables and how students answer', () => {
    expect(gemKeepSummary({ mode: 'calm', tables: [2, 3, 4, 5, 6, 7, 8, 9, 10], multipleChoice: false })).toBe('Calm · ×2–×10 · typing');
    expect(gemKeepSummary({ mode: 'challenge', tables: [7], multipleChoice: true })).toBe('Challenge · ×7 · multiple choice');
  });

  it('gives a run of tables as a range, in any order, and a gappy set as a count', () => {
    expect(tablesText([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe('×1–×12');
    expect(tablesText([5, 3, 4])).toBe('×3–×5');
    expect(tablesText([2, 5, 10])).toBe('3 tables');
    expect(tablesText([])).toBe('no tables');
  });
});
