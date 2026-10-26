import { describe, expect, it } from 'vitest';
import { checkItem } from './save';

const NOW = Date.UTC(2026, 9, 20, 2, 0, 0); // 20 Oct 2026, 3pm in New Zealand
const answer = (over: Record<string, unknown> = {}) => ({ key: 'mul:6x7', given: 42, ms: 2500, typingMs: 900, at: NOW - 1000, day: '2026-10-20', ...over });
const batch = (answers: unknown[] = [answer()], over: Record<string, unknown> = {}) => ({
  type: 'answers', batchId: '3f1c9a52-0b7d-4c1e-9d3a-6a1f2b9c8e10', seed: 12345, answers, ...over,
});

describe('checking Quick looks answers', () => {
  const quick = (over: Record<string, unknown> = {}) => answer({ key: 'sub:ten-8', given: 8, typingMs: 0, ms: 0, ...over });
  const marked = (raw: unknown) => {
    const r = checkItem(batch([raw]), NOW);
    return r.ok && r.item.type === 'answers' ? r.item.answers.map((a) => a.correct) : r;
  };

  it('marks flash and missing-spot answers, helped or not, whatever the browser says', () => {
    expect(marked(quick())).toEqual([true]);
    expect(marked(quick({ given: 7 }))).toEqual([false]);
    expect(marked(quick({ key: 'gap:ten-7', given: 3 }))).toEqual([true]);
    expect(marked(quick({ key: 'gap:ten-7', given: 7 }))).toEqual([false]); // the visible part is not the missing part
    expect(marked(quick({ key: 'subh:line-2', given: 2 }))).toEqual([true]);
    expect(marked(quick({ key: 'gaph:five-4', given: 1 }))).toEqual([true]);
    expect(marked({ ...quick(), correct: true, answer: 8, given: 5 })).toEqual([false]);
  });
});
