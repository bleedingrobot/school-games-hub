import { describe, expect, it } from 'vitest';
import { checkItem, MAX_ANSWERS_PER_BATCH } from './save';

const NOW = Date.UTC(2026, 9, 20, 2, 0, 0); // 20 Oct 2026, 3pm in New Zealand
const answer = (over: Record<string, unknown> = {}) => ({ key: 'mul:6x7', given: 42, ms: 2500, typingMs: 900, at: NOW - 1000, day: '2026-10-20', ...over });
const batch = (answers: unknown[] = [answer()], over: Record<string, unknown> = {}) => ({
  type: 'answers', batchId: '3f1c9a52-0b7d-4c1e-9d3a-6a1f2b9c8e10', seed: 12345, answers, ...over,
});
const problem = (raw: unknown) => {
  const r = checkItem(raw, NOW);
  return r.ok ? 'ok' : r.problem;
};

describe('checking an answers item', () => {
  it('accepts a good batch and marks each answer from the real fact', () => {
    const r = checkItem(batch([answer(), answer({ given: 41 })]), NOW);
    expect(r.ok && r.item.type === 'answers' && r.item.answers.map((a) => a.correct)).toEqual([true, false]);
  });

  it('marks division facts too', () => {
    const r = checkItem(batch([answer({ key: 'div:42/6', given: 7 })]), NOW);
    expect(r.ok && r.item.type === 'answers' && r.item.answers[0].correct).toBe(true);
  });

  it('turns away facts that are not real', () => {
    expect(problem(batch([answer({ key: 'mul:13x2' })]))).toBe('fact');
    expect(problem(batch([answer({ key: 'mul:7x6' })]))).toBe('fact'); // smaller number first
    expect(problem(batch([answer({ key: 'div:42/5' })]))).toBe('fact');
    expect(problem(batch([answer({ key: 5 })]))).toBe('fact');
  });

  it('turns away times that are not possible', () => {
    expect(problem(batch([answer({ ms: -1 })]))).toBe('time');
    expect(problem(batch([answer({ ms: 600_001 })]))).toBe('time');
    expect(problem(batch([answer({ ms: 1.5 })]))).toBe('time');
    expect(problem(batch([answer({ ms: '2500' })]))).toBe('time');
    expect(problem(batch([answer({ typingMs: -5 })]))).toBe('typing');
    expect(problem(batch([answer({ typingMs: 11_000 })]))).toBe('typing');
    expect(problem(batch([answer({ given: -1 })]))).toBe('given');
    expect(problem(batch([answer({ given: 4.2 })]))).toBe('given');
  });

  it('turns away answers from the future or long ago', () => {
    expect(problem(batch([answer({ at: NOW + 3_600_000 })]))).toBe('when');
    expect(problem(batch([answer({ at: NOW - 31 * 86_400_000 })]))).toBe('when');
    expect(problem(batch([answer({ at: NOW - 20 * 86_400_000, day: '2026-09-30' })]))).toBe('ok');
  });

  it('wants a real date near the answer’s time', () => {
    expect(problem(batch([answer({ day: '2026-10-21' })]))).toBe('ok'); // New Zealand is ahead of UTC
    expect(problem(batch([answer({ day: '2026-10-25' })]))).toBe('day');
    expect(problem(batch([answer({ day: '2026-02-30' })]))).toBe('day');
    expect(problem(batch([answer({ day: 'today' })]))).toBe('day');
  });

  it('wants a batch id, a seed and a sensible number of answers', () => {
    expect(problem(batch([answer()], { batchId: 'abc' }))).toBe('batch-id');
    expect(problem(batch([answer()], { seed: -1 }))).toBe('seed');
    expect(problem(batch([answer()], { seed: 1.5 }))).toBe('seed');
    expect(problem(batch([]))).toBe('answers');
    expect(problem(batch(Array.from({ length: MAX_ANSWERS_PER_BATCH + 1 }, () => answer())))).toBe('answers');
    expect(problem(batch(Array.from({ length: MAX_ANSWERS_PER_BATCH }, () => answer())))).toBe('ok');
  });

  it('turns away anything that is not an item', () => {
    for (const raw of [null, 5, 'x', [], {}, { type: 'run' }]) expect(problem(raw)).not.toBe('ok');
  });
});

describe('checking a student item', () => {
  const student = (over: Record<string, unknown> = {}) => ({ type: 'student', typing: { 1: [600, 650], 2: [900] }, autoSubmit: true, sessionsDone: 3, ...over });

  it('accepts typing times and settings', () => {
    expect(problem(student())).toBe('ok');
    expect(problem(student({ typing: {} }))).toBe('ok');
  });

  it('turns away typing times that are not possible', () => {
    expect(problem(student({ typing: { 4: [600] } }))).toBe('typing');
    expect(problem(student({ typing: { 1: [-3] } }))).toBe('typing');
    expect(problem(student({ typing: { 1: Array(11).fill(600) } }))).toBe('typing');
    expect(problem(student({ typing: [600] }))).toBe('typing');
    expect(problem(student({ autoSubmit: 'yes' }))).toBe('auto-submit');
    expect(problem(student({ sessionsDone: -1 }))).toBe('sessions');
  });
});
