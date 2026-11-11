import { describe, expect, it } from 'vitest';
import { checkItem } from '../../shared/training/save';
import { toTrainingAnswer } from './saving';

const base = { key: 'sub:ten-8', given: 8, correct: true, helped: false, thinkingMs: 1234.6, at: Date.parse('2026-10-21T12:00:00Z'), day: '2026-10-21', seed: 5 };

describe('saving a Quick looks answer', () => {
  it('is something the server accepts, timed or helped', () => {
    for (const a of [base, { ...base, helped: true, thinkingMs: 0 }]) {
      const { seed, ...answer } = toTrainingAnswer(a);
      const r = checkItem({ type: 'answers', batchId: '3f1c9a52-0b7d-4c1e-9d3a-6a1f2b9c8e10', seed, answers: [answer] }, base.at + 1000);
      expect(r.ok).toBe(true);
    }
  });
});
