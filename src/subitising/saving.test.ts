import { describe, expect, it } from 'vitest';
import { checkItem } from '../../shared/training/save';
import { toTrainingAnswer } from './saving';

const base = { key: 'sub:ten-8', given: 8, correct: true, helped: false, thinkingMs: 1234.6, at: Date.parse('2026-10-21T12:00:00Z'), day: '2026-10-21', seed: 5 };

describe('saving a Quick looks answer', () => {
  it('saves a plain answer under its own key with its thinking time and nothing typed', () => {
    expect(toTrainingAnswer(base)).toEqual({ key: 'sub:ten-8', given: 8, ms: 1235, typingMs: 0, at: base.at, day: '2026-10-21', seed: 5 });
  });
  it('saves an answer given with help (or with the picture kept on) under the helped key', () => {
    expect(toTrainingAnswer({ ...base, helped: true }).key).toBe('subh:ten-8');
    expect(toTrainingAnswer({ ...base, key: 'gap:five-4', given: 1, helped: true }).key).toBe('gaph:five-4');
  });
  it('is something the server accepts, timed or helped', () => {
    for (const a of [base, { ...base, helped: true, thinkingMs: 0 }]) {
      const { seed, ...answer } = toTrainingAnswer(a);
      const r = checkItem({ type: 'answers', batchId: '3f1c9a52-0b7d-4c1e-9d3a-6a1f2b9c8e10', seed, answers: [answer] }, base.at + 1000);
      expect(r.ok).toBe(true);
    }
  });
});
