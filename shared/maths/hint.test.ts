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
  it('leaves at least the right answer and one wrong choice', () => {
    const h = hintFor({ answer: 3, choices: [3, 5, 8, 9], parts: [] });
    expect(4 - h.remove.length).toBe(2);
  });
  it('gives a stretch of numbers that holds the answer, and is never just the answer', () => {
    for (let answer = 0; answer <= 999; answer++) {
      const h = hintFor({ answer, parts: [] });
      const [, low, high] = /between (\S+) and (\S+)\./.exec(h.text)!.map(Number);
      expect(answer).toBeGreaterThanOrEqual(low);
      expect(answer).toBeLessThan(high);
      expect(high - low).toBeGreaterThan(1);
    }
  });
  it('works for decimals and writes money with cents', () => {
    const d = hintFor({ answer: 4.15, parts: [] });
    const [, low, high] = /between (\S+) and (\S+)\./.exec(d.text)!.map(Number);
    expect(4.15).toBeGreaterThanOrEqual(low);
    expect(4.15).toBeLessThan(high);
    expect(hintFor({ answer: 5.85, parts: ['$', '?'] }).text).toMatch(/\$5\.00 and \$6\.00/);
  });
  it('is the same every time for the same question', () => {
    const q = { answer: 56, choices: [56, 54, 48, 63], parts: [] };
    expect(hintFor(q)).toEqual(hintFor(q));
  });
});
