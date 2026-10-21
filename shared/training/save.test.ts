import { describe, expect, it } from 'vitest';
import { checkItem, correctAnswerFor, MAX_ANSWERS_PER_BATCH, studentTyping } from './save';

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

describe('checking Quick looks answers', () => {
  const quick = (over: Record<string, unknown> = {}) => answer({ key: 'sub:ten-8', given: 8, typingMs: 0, ms: 0, ...over });
  const marked = (raw: unknown) => {
    const r = checkItem(batch([raw]), NOW);
    return r.ok && r.item.type === 'answers' ? r.item.answers.map((a) => a.correct) : r;
  };

  it('works out the right answer from the key alone', () => {
    expect(correctAnswerFor('sub:ten-8')).toBe(8);
    expect(correctAnswerFor('gap:ten-7')).toBe(3);
    expect(correctAnswerFor('subh:five-5')).toBe(5);
    expect(correctAnswerFor('mul:6x7')).toBe(42);
    expect(correctAnswerFor('sub:cube-3')).toBeNull();
  });

  it('marks flash and missing-spot answers, helped or not, whatever the browser says', () => {
    expect(marked(quick())).toEqual([true]);
    expect(marked(quick({ given: 7 }))).toEqual([false]);
    expect(marked(quick({ key: 'gap:ten-7', given: 3 }))).toEqual([true]);
    expect(marked(quick({ key: 'gap:ten-7', given: 7 }))).toEqual([false]); // the visible part is not the missing part
    expect(marked(quick({ key: 'subh:line-2', given: 2 }))).toEqual([true]);
    expect(marked(quick({ key: 'gaph:five-4', given: 1 }))).toEqual([true]);
    expect(marked({ ...quick(), correct: true, answer: 8, given: 5 })).toEqual([false]);
  });

  it('turns away a full or empty frame, a made-up picture and silly numbers', () => {
    for (const key of ['gap:five-5', 'gap:ten-10', 'gap:ten-0', 'gap:dice-3', 'sub:cube-3', 'sub:line-99', 'sub:line-0', 'sub:ten-4', 'subh:ten-12', 'sub:ten-08', 'sub:', 'sub:ten-8-8']) {
      expect(problem(batch([quick({ key })])), key).toBe('fact');
    }
  });

  it('turns away silly answers, times and typing', () => {
    expect(problem(batch([quick({ given: -1 })]))).toBe('given');
    expect(problem(batch([quick({ given: 1_000_000 })]))).toBe('given');
    expect(problem(batch([quick({ given: 8.5 })]))).toBe('given');
    expect(problem(batch([quick({ ms: -1 })]))).toBe('time');
    expect(problem(batch([quick({ typingMs: 900 })]))).toBe('typing'); // a tap answer types nothing
    expect(problem(batch([quick({ at: NOW + 3_600_000 })]))).toBe('when');
    expect(problem(batch([quick({ day: '2031-01-01' })]))).toBe('day');
  });

  it('counts the same answer once when it is in a batch twice', () => {
    const r = checkItem(batch([quick(), quick(), quick({ at: NOW - 500 })]), NOW);
    expect(r.ok && r.item.type === 'answers' && r.item.answers).toHaveLength(2);
  });

  it('leaves times-table answers exactly as they were, even the same one twice', () => {
    const r = checkItem(batch([answer(), answer()]), NOW);
    expect(r.ok && r.item.type === 'answers' && r.item.answers).toHaveLength(2);
    expect(problem(batch([answer({ typingMs: 900 })]))).toBe('ok');
  });

  it('takes a full session and a mix with times tables in one batch', () => {
    const session = Array.from({ length: 12 }, (_, i) => quick({ at: NOW - 100 * (i + 1) }));
    expect(problem(batch(session))).toBe('ok');
    expect(problem(batch([...session, answer()]))).toBe('ok');
  });
});

describe('checking Quick looks settings on a student item', () => {
  const quick = { placed: true, startStage: 3, finished: 2, guided: false };
  const student = (over: Record<string, unknown> = {}) => ({ type: 'student', typing: { 1: [600], 2: [900] }, autoSubmit: true, sessionsDone: 3, quick, ...over });

  it('accepts them, and stores them inside the typing column with the typing times', () => {
    const r = checkItem(student(), NOW);
    expect(r.ok && r.item.type === 'student' && r.item.quick).toEqual(quick);
    if (!r.ok || r.item.type !== 'student') throw new Error('should be accepted');
    expect(studentTyping(r.item)).toEqual({ 1: [600], 2: [900], q: { p: 1, s: 3, f: 2, g: 0 } });
  });

  it('leaves the typing column exactly as it was when there are no Quick looks settings', () => {
    const r = checkItem(student({ quick: undefined }), NOW);
    if (!r.ok || r.item.type !== 'student') throw new Error('should be accepted');
    expect(r.item.quick).toBeUndefined();
    expect(studentTyping(r.item)).toEqual({ 1: [600], 2: [900] });
  });

  it('turns away settings that make no sense', () => {
    for (const bad of [null, 5, {}, { ...quick, startStage: 5 }, { ...quick, startStage: 0 }, { ...quick, finished: 5 }, { ...quick, placed: 1 }, { ...quick, guided: 'no' }, { ...quick, finished: 1.5 }]) {
      expect(problem(student({ quick: bad })), JSON.stringify(bad)).toBe('quick');
    }
  });

  it('still fits the database’s 600-character limit with the biggest typing times', () => {
    const full = { 1: Array(10).fill(10_000), 2: Array(10).fill(10_000), 3: Array(10).fill(10_000) };
    const r = checkItem(student({ typing: full, quick: { placed: true, startStage: 4, finished: 4, guided: true } }), NOW);
    if (!r.ok || r.item.type !== 'student') throw new Error('should be accepted');
    // How Postgres writes jsonb as text: ", " between items and ": " after keys.
    const asText = JSON.stringify(studentTyping(r.item)).replace(/,/g, ', ').replace(/":/g, '": ');
    expect(asText.length).toBeLessThanOrEqual(600);
  });
});
