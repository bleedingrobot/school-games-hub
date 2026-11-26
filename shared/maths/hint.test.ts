import { describe, expect, it } from 'vitest';
import { helpKind, hintFor } from './hint';

describe('the one hint', () => {
  it('takes two wrong choices away and never the right one', () => {
    for (const choices of [[3, 5, 8, 9], [12, 40, 7, 13], [0, 1, 2, 3]]) {
      for (const answer of choices) {
        const h = hintFor({ answer, choices, parts: [] });
        expect(h.remove).toHaveLength(2);
        expect(h.remove).not.toContain(answer);
        expect(h.remove.every((c) => choices.includes(c))).toBe(true);
      }
    }
    // The free Help me (helpKind): sign meanings wherever < > ≤ ≥ ≠ show, angle kinds on angle pictures.
    expect(helpKind({ parts: ['8 × 7', '≤', '8 × 5 + 42'] })).toBe('symbols');
    expect(helpKind({ parts: ['2 456 × 2', '?', '1 228 × 4'], choiceLabels: ['<', '>', '='] })).toBe('symbols');
    expect(helpKind({ parts: ['This 130° angle', 'is', '?'], figure: { kind: 'angle', degrees: 130 } })).toBe('angles');
    expect(helpKind({ parts: ['3 + 4', '≠', '8'] })).toBe('symbols');
    expect(helpKind({ parts: ['7', '×', '8', '=', '?'] })).toBeNull();
    expect(helpKind({ parts: ['9', '÷', '4', '=', '?', 'r', '1'] })).toBe('remainder');
    expect(helpKind({ parts: ['?'], prompt: 'Which point sits on the x-axis (the line going across)?' })).toBe('axes');
  });
});
