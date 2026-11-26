import { describe, expect, it } from 'vitest';
import { markQuestion } from './verify';
import { makeFocusPack, parseFocus } from '../../maths/focus';
import { LADDER } from '../../maths/ladder';
import { seededRandom } from '../../maths/serverQuestions';

// Area 4, near side: times tables at campaign level 6 (×6 and ×9, missing factors on).
const AREA = 4;
const FAR = false;
const tt = (key: string, kind: string, parts: string[] | undefined, given: number) => ({
  topic: 'times-tables',
  band: 6,
  key,
  kind,
  ...(parts ? { parts } : {}),
  given,
  ms: 2000,
  at: 0,
});

describe('markQuestion', () => {
  it('times tables: marks from the question shown, refuses a question that is not the fact, and still marks older saves; the maths ladder: rebuilds and marks every skill, refusing one not asked as shown', () => {
    expect(markQuestion(tt('mul:6x8', 'missing-factor', ['?', '×', '8', '=', '48'], 6), AREA, FAR)).toEqual({ ok: true, correct: true });
    expect(markQuestion(tt('mul:6x8', 'missing-factor', ['?', '×', '8', '=', '48'], 8), AREA, FAR)).toEqual({ ok: true, correct: false });
    expect(markQuestion(tt('mul:6x8', 'missing-factor', ['6', '×', '?', '=', '48'], 8), AREA, FAR)).toEqual({ ok: true, correct: true });
    expect(markQuestion(tt('mul:6x8', 'missing-factor', ['6', '×', '?', '=', '48'], 6), AREA, FAR)).toEqual({ ok: true, correct: false });
    expect(markQuestion(tt('mul:6x8', 'multiply', ['8', '×', '6', '=', '?'], 48), AREA, FAR)).toEqual({ ok: true, correct: true });
    expect(markQuestion(tt('mul:6x8', 'multiply', ['8', '×', '6', '=', '?'], 46), AREA, FAR)).toEqual({ ok: true, correct: false });
    expect(markQuestion(tt('mul:6x8', 'missing-factor', ['?', '×', '7', '=', '42'], 6), AREA, FAR)).toEqual({ ok: false, problem: 'question-parts' });
    expect(markQuestion(tt('mul:6x8', 'multiply', ['?', '×', '8', '=', '48'], 6), AREA, FAR)).toEqual({ ok: false, problem: 'question-kind' });
    expect(markQuestion(tt('mul:6x8', 'missing-factor', ['8', '×', '6', '=', '?'], 48), AREA, FAR)).toEqual({ ok: false, problem: 'question-kind' });
    expect(markQuestion(tt('mul:6x8', 'multiply', ['48', '÷', '8', '=', '?'], 6), AREA, FAR)).toEqual({ ok: false, problem: 'question-kind' });
    expect(markQuestion({ ...tt('mul:6x8', 'multiply', undefined, 48), parts: 'nope' }, AREA, FAR)).toEqual({ ok: false, problem: 'question-parts' });
    expect(markQuestion(tt('mul:6x8', 'multiply', undefined, 48), AREA, FAR)).toEqual({ ok: true, correct: true });
    expect(markQuestion(tt('mul:6x8', 'missing-factor', undefined, 6), AREA, FAR)).toEqual({ ok: true, correct: true });

    // The maths ladder (every question since 26 Nov 2026).
    for (const skill of LADDER) {
      const focus = parseFocus({ source: 'teacher-class', skills: [skill.id], onlyThese: true, endsAt: null, canChoose: false, own: null });
      const pack = makeFocusPack([], focus, {}, seededRandom(`m-${skill.id}`));
      for (let i = 0; i < 4; i++) {
        for (const multipleChoice of [false, true]) {
          const q = pack.nextQuestion({ multipleChoice })!;
          const report = { topic: 'ladder', key: q.factKey, parts: q.parts, ...(q.params ? { params: q.params } : {}), given: q.answer, ms: 3000, at: 0 };
          expect(markQuestion(report, AREA, FAR), `${skill.id} ${q.parts.join(' ')}`).toEqual({ ok: true, correct: true });
          expect(markQuestion({ ...report, given: q.answer + 1 }, AREA, FAR), skill.id).toEqual({ ok: true, correct: false });
        }
      }
    }
    const made = { topic: 'ladder', key: 'mul:6x8', parts: ['6', '×', '7', '=', '?'], given: 42, ms: 3000, at: 0 };
    expect(markQuestion(made, AREA, FAR)).toEqual({ ok: false, problem: 'question-parts' });
  });
});
