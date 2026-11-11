import { describe, expect, it } from 'vitest';
import { AUTO_FOCUS } from '../../../shared/maths/focus';
import { seededRandom } from '../../../shared/maths/serverQuestions';
import { makeRunQuestions, markQuestion } from '../../../shared/mine/maths';

describe('the questions for a run', () => {
  it('can be marked, are different from each other where the focus allows, and are the same again from the same seed', () => {
    const context = { facts: [], settings: {}, focus: { ...AUTO_FOCUS, source: 'teacher-class' as const, skills: ['facts-20'], onlyThese: true } };
    const a = makeRunQuestions(context, 12, seededRandom('seed-a'));
    const b = makeRunQuestions(context, 12, seededRandom('seed-a'));
    expect(a).toHaveLength(12);
    expect(a).toEqual(b);
    for (const q of a) expect(markQuestion(q)).not.toBeNull();
    expect(new Set(a.map((q) => q.factKey)).size).toBeGreaterThan(6);
  });
});
