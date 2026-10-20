import { describe, expect, it } from 'vitest';
import { TRIAL_NOTE, trialFact, trialQuestion } from './trialMaths';

describe('trial maths (preview only)', () => {
  it('makes simple sums with the right answer and a blank to fill', () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 48271) % 2147483647;
      return seed / 2147483647;
    };
    const seen = new Set<string>();
    for (let n = 0; n < 200; n++) {
      const q = trialQuestion(random);
      const [a, op, b, eq, blank] = q.parts;
      expect(eq).toBe('=');
      expect(blank).toBe('?');
      const x = Number(a);
      const y = Number(b);
      expect(q.answer).toBe(op === '+' ? x + y : op === '−' ? x - y : x * y);
      expect(q.answer).toBeGreaterThan(0);
      expect(trialFact(q)).toBe(`${a} ${op} ${b} = ${q.answer}`);
      expect(q.spoken.length).toBeGreaterThan(5);
      seen.add(op);
    }
    expect([...seen].sort()).toEqual(['+', '×', '−']);
  });
  it('gives each question its own id and is plainly marked as a stand-in', () => {
    expect(trialQuestion().id).not.toBe(trialQuestion().id);
    expect(TRIAL_NOTE).toMatch(/trial/i);
    expect(TRIAL_NOTE).toMatch(/not saved/i);
    expect(trialQuestion().skill).toBe('trial');
  });
});
