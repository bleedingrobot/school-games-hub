import { describe, expect, it } from 'vitest';
import { checkItem } from './save';

const NOW = Date.UTC(2026, 9, 20, 2, 0, 0); // 20 Oct 2026, 3pm in New Zealand
const answer = (over: Record<string, unknown> = {}) => ({ key: 'mul:6x7', given: 42, ms: 2500, typingMs: 900, at: NOW - 1000, day: '2026-10-20', ...over });
const batch = (answers: unknown[] = [answer()], over: Record<string, unknown> = {}) => ({
  type: 'answers', batchId: '3f1c9a52-0b7d-4c1e-9d3a-6a1f2b9c8e10', seed: 12345, answers, ...over,
});
describe('checking an answers item', () => {
  it('accepts a good batch and marks each answer from the real fact', () => {
    const r = checkItem(batch([answer(), answer({ given: 41 })]), NOW);
    expect(r.ok && r.item.type === 'answers' && r.item.answers.map((a) => a.correct)).toEqual([true, false]);
  });
});

