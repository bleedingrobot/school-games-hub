import { expect, it } from 'vitest';
import { CHECK_FACTS, checkDoneLine, checkDueNow, checkOrder, scoreCheck } from './check';

it('marks the fixed 24 facts (right, quick under 3.5 s thinking, middle time), shuffles fairly, only says kind things, and holds a first check back until 3 Training sessions', () => {
  expect(new Set(CHECK_FACTS.map((f) => f.prompt)).size).toBe(24);
  const answers = CHECK_FACTS.map((f, i) => ({ given: i < 20 ? f.answer : null, ms: i < 10 ? 2000 : 6000, typingMs: 1000 }));
  answers[0] = { given: 99, ms: 1000, typingMs: 500 };
  expect(scoreCheck(answers)).toMatchObject({ right: 19, quick: 9, middleMs: 5000 });
  expect(scoreCheck([]).middleMs).toBeNull();
  expect([...checkOrder(42)].sort((a, b) => a - b)).toEqual(CHECK_FACTS.map((_, i) => i));
  expect(checkDoneLine({ right: 20, quick: 12 }, { right: 18, quick: 9 })).toBe('3 more quick facts than last time!');
  expect(checkDoneLine({ right: 15, quick: 5 }, { right: 18, quick: 9 })).not.toMatch(/less|fewer|slower/);
  // A first check waits for 3 Training sessions; a later one never does.
  expect(checkDueNow(true, 0, 0)).toBe(false);
  expect(checkDueNow(true, 0, 2)).toBe(false);
  expect(checkDueNow(true, 0, 3)).toBe(true);
  expect(checkDueNow(true, 1, 0)).toBe(true);
  expect(checkDueNow(false, 0, 10)).toBe(false);
});
