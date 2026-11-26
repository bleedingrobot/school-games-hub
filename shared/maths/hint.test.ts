import { describe, expect, it } from 'vitest';
import { fractionSteps, helpKind, hintFor, unitSteps } from './hint';

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
    expect(helpKind({ parts: ['1/8', '+', '3/4', '=', '?'] })).toBe('fractions');
    expect(helpKind({ parts: ['3 h', '=', '?', 'min'] })).toBe('hours');
    expect(helpKind({ parts: ['8 km', '=', '?', 'm'] })).toBe('units');
    expect(helpKind({ parts: ['Face east,', 'quarter turn clockwise:', '?'], prompt: 'Which way are you now facing?' })).toBe('turns');
    expect(unitSteps(['450 g', '=', '?', 'kg'])).toMatchObject({ big: 'kg', factor: 1000, times: false });
    expect(helpKind({ parts: ['An angle of 250°', 'is', '?'], prompt: 'What kind of angle is it?', choiceLabels: ['reflex', 'obtuse', 'right', 'acute'] })).toBe('angles');
    expect(fractionSteps(['1/8', '+', '3/4', '=', '?'])?.changes).toEqual([{ n: 3, d: 4, by: 2 }]);
    expect(fractionSteps(['2/3', '−', '1/4', '=', '?'])).toMatchObject({ bottom: 12, changes: [{ n: 2, d: 3, by: 4 }, { n: 1, d: 4, by: 3 }] });
    expect(fractionSteps(['1/5', '+', '2/5', '=', '?'])).toBeNull();
  });
});
