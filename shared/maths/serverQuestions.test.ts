import { describe, expect, it } from 'vitest';
import { AUTO_FOCUS, makeFocusPack } from './focus';
import { LADDER } from './ladder';
import { publicQuestion, seededRandom } from './serverQuestions';

describe('questions the server makes', () => {
  it('the same seed gives the same numbers, another seed different ones', () => {
    const a = seededRandom('run-1');
    const b = seededRandom('run-1');
    const c = seededRandom('run-2');
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
    for (const n of first) expect(n >= 0 && n < 1).toBe(true);
  });

  it("gives Marble Rush's numbers exactly, so Marble can switch to it without a run changing", () => {
    // The first three numbers of Marble's own seededRandom('marble') (shared/marble/maths.ts on the marble branch).
    const r = seededRandom('marble');
    expect([r(), r(), r()].map((n) => n.toFixed(12))).toEqual(MARBLE_FIRST_THREE);
  });

  it('the same seed makes the same questions from a focus pack', () => {
    const focus = { ...AUTO_FOCUS, source: 'teacher-class' as const, skills: [LADDER.find((s) => s.built)!.id] };
    const make = () => {
      const pack = makeFocusPack([], focus, {}, seededRandom('round-7'));
      return [0, 1, 2, 3, 4].map(() => pack.nextQuestion({})!.parts.join(' '));
    };
    expect(make()).toEqual(make());
  });

  it('the browser is never told the answer, the record or the numbers', () => {
    const pack = makeFocusPack([], AUTO_FOCUS, {}, seededRandom('x'));
    const q = pack.nextQuestion({ multipleChoice: true })!;
    const shown = publicQuestion(q, 3);
    expect(shown.slot).toBe(3);
    expect(shown.parts).toEqual(q.parts);
    expect(shown.choices).toEqual(q.choices);
    expect(Object.keys(shown)).not.toContain('answer');
    expect(Object.keys(shown)).not.toContain('factKey');
    expect(Object.keys(shown)).not.toContain('params');
    expect(JSON.stringify(shown)).not.toContain('"answer"');
  });
});

const MARBLE_FIRST_THREE = ['0.219711785670', '0.394239328103', '0.990649517160'];
