import { describe, expect, it } from 'vitest';
import { randomFromSeed } from '../space/random';
import { TimesTables, } from './skillPacks/timesTables';

const DAY1 = Date.parse('2026-10-15T22:00:00Z'); // 16 October in New Zealand


describe('times-tables questions', () => {
  function many(ctx: Parameters<TimesTables['nextQuestion']>[0], n = 400, seed = 'q') {
    const pack = new TimesTables([], randomFromSeed(seed), () => DAY1);
    return Array.from({ length: n }, () => pack.nextQuestion(ctx)!);
  }

  it('every answer is right for its question', () => {
    for (const q of many({ level: 6, division: true }, 1000)) {
      const [a, op, b, , c] = q.parts;
      const n = (s: string) => (s === '?' ? q.answer : Number(s));
      if (op === '×') expect(n(a) * n(b)).toBe(n(c));
      else expect(n(a) / n(b)).toBe(n(c));
    }
  });
});

describe('working out a question from how it was shown', () => {

  it('every question the pack asks can be solved back to the right answer and fact', async () => {
    const { solveQuestion, TimesTables } = await import('./skillPacks/timesTables');
    let seed = 7;
    const pack = new TimesTables([], () => ((seed = (seed * 16807) % 2147483647) / 2147483647));
    for (let i = 0; i < 300; i++) {
      const q = pack.nextQuestion({ level: 9, division: true, missingFactor: true })!;
      expect(solveQuestion(q.parts)).toEqual({ answer: q.answer, key: q.factKey });
    }
  });
});

