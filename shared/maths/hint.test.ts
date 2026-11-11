import { describe, expect, it } from 'vitest';
import { hintFor } from './hint';

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
  });
});
