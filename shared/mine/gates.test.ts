import { expect, it } from 'vitest';
import type { Question } from '../maths/skillPack';
import { seededRandom } from '../maths/serverQuestions';
import { gateChoices } from './maths';

const sum = (answer: number, over: Partial<Question> = {}): Question => ({
  id: 0, factKey: 'mul:7x8', kind: 'mul', parts: ['7', '×', '8', '=', '?'], spoken: '7 times 8', answer, band: 1, ...over,
}) as Question;

it('number gates offer four different choices that always include the right answer, whole or decimal', () => {
  for (let n = 0; n < 50; n++) {
    const answer = n * 7;
    const a = gateChoices(sum(answer), seededRandom(`x${n}`))!;
    expect(a).toHaveLength(4);
    expect(a).toContain(answer);
    expect(new Set(a).size).toBe(4);
    expect(a.every((v) => Number.isInteger(v) && v >= 0)).toBe(true);
  }
  const d = gateChoices(sum(0.8, { input: 'decimal', parts: ['0.5', '+', '0.3', '=', '?'] }), seededRandom('x'))!;
  expect(d).toContain(0.8);
  expect(new Set(d).size).toBe(4);
});
