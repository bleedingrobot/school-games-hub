import { describe, expect, it } from 'vitest';
import { LADDER } from '../maths/ladder';
import { seededRandom } from '../maths/serverQuestions';
import { ROUND_QUESTIONS, makeRoundQuestions, markQuestion } from './speed';

describe('the speed round', () => {
  it('makes 10 different questions the server can mark, for every skill on the maths ladder', () => {
    for (const skill of LADDER) {
      const focus = { source: 'teacher-class' as const, skills: [skill.id], onlyThese: true, endsAt: null, canChoose: false, own: null };
      const qs = makeRoundQuestions({ facts: [], settings: {}, focus }, seededRandom(`seed-${skill.id}`));
      expect(qs.length, skill.id).toBe(ROUND_QUESTIONS);
      for (const q of qs) expect(markQuestion(q), skill.id).not.toBeNull();
    }
    // With no focus: the times-table step.
    const plain = makeRoundQuestions({ facts: [], settings: {} }, seededRandom('x'));
    expect(plain).toHaveLength(ROUND_QUESTIONS);
    // The same seed makes the same round.
    expect(makeRoundQuestions({ facts: [], settings: {} }, seededRandom('x'))).toEqual(plain);
  });
});
