import { describe, expect, it } from 'vitest';
import { markQuestion } from './verify';

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

describe('markQuestion: times tables', () => {
  it('a missing factor is only right with the missing number, not the one on screen', () => {
    expect(markQuestion(tt('mul:6x8', 'missing-factor', ['?', '×', '8', '=', '48'], 6), AREA, FAR)).toEqual({ ok: true, correct: true });
    expect(markQuestion(tt('mul:6x8', 'missing-factor', ['?', '×', '8', '=', '48'], 8), AREA, FAR)).toEqual({ ok: true, correct: false });
    expect(markQuestion(tt('mul:6x8', 'missing-factor', ['6', '×', '?', '=', '48'], 8), AREA, FAR)).toEqual({ ok: true, correct: true });
    expect(markQuestion(tt('mul:6x8', 'missing-factor', ['6', '×', '?', '=', '48'], 6), AREA, FAR)).toEqual({ ok: true, correct: false });
  });

  it('a product is marked from the question shown', () => {
    expect(markQuestion(tt('mul:6x8', 'multiply', ['8', '×', '6', '=', '?'], 48), AREA, FAR)).toEqual({ ok: true, correct: true });
    expect(markQuestion(tt('mul:6x8', 'multiply', ['8', '×', '6', '=', '?'], 46), AREA, FAR)).toEqual({ ok: true, correct: false });
  });

  it('refuses a question shown that is not the fact, or not asked the way it says', () => {
    expect(markQuestion(tt('mul:6x8', 'missing-factor', ['?', '×', '7', '=', '42'], 6), AREA, FAR)).toEqual({ ok: false, problem: 'question-parts' });
    expect(markQuestion(tt('mul:6x8', 'multiply', ['?', '×', '8', '=', '48'], 6), AREA, FAR)).toEqual({ ok: false, problem: 'question-kind' });
    expect(markQuestion(tt('mul:6x8', 'missing-factor', ['8', '×', '6', '=', '?'], 48), AREA, FAR)).toEqual({ ok: false, problem: 'question-kind' });
    expect(markQuestion(tt('mul:6x8', 'multiply', ['48', '÷', '8', '=', '?'], 6), AREA, FAR)).toEqual({ ok: false, problem: 'question-kind' });
    expect(markQuestion({ ...tt('mul:6x8', 'multiply', undefined, 48), parts: 'nope' }, AREA, FAR)).toEqual({ ok: false, problem: 'question-parts' });
  });

  it('a save from an older browser (no parts) is still marked the old way', () => {
    expect(markQuestion(tt('mul:6x8', 'multiply', undefined, 48), AREA, FAR)).toEqual({ ok: true, correct: true });
    expect(markQuestion(tt('mul:6x8', 'missing-factor', undefined, 6), AREA, FAR)).toEqual({ ok: true, correct: true });
  });
});
