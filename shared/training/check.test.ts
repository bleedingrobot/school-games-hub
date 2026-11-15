import { describe, expect, it } from 'vitest';
import { CHECK_FACTS, checkDoneLine, checkOrder, scoreCheck } from './check';

describe('the basic facts check', () => {
  it('is 24 different facts that never change (a change is a new version)', () => {
    expect(CHECK_FACTS).toHaveLength(24);
    expect(new Set(CHECK_FACTS.map((f) => f.prompt)).size).toBe(24);
    expect(CHECK_FACTS.slice(0, 3).map((f) => `${f.prompt}=${f.answer}`)).toEqual(['2 × 8=16', '5 × 7=35', '10 × 6=60']);
  });

  it('marks from the set: right, quick (under 3.5 s thinking), and the middle thinking time of right answers', () => {
    const answers = CHECK_FACTS.map((f, i) => ({ given: i < 20 ? f.answer : null, ms: i < 10 ? 2000 : 6000, typingMs: 1000 }));
    answers[0] = { given: 99, ms: 1000, typingMs: 500 };
    const s = scoreCheck(answers);
    expect(s.right).toBe(19);
    expect(s.quick).toBe(9);
    expect(s.middleMs).toBe(5000);
    expect(s.marks.slice(0, 2)).toEqual([0, 2]);
    expect(scoreCheck([]).middleMs).toBeNull();
  });

  it('shows the facts in a shuffled order that covers every fact once', () => {
    const order = checkOrder(42);
    expect([...order].sort((a, b) => a - b)).toEqual(CHECK_FACTS.map((_, i) => i));
    expect(order).toEqual(checkOrder(42));
  });

  it('only ever tells the pupil good news or a kind word', () => {
    expect(checkDoneLine({ right: 20, quick: 12 }, { right: 18, quick: 9 })).toBe('3 more quick facts than last time!');
    expect(checkDoneLine({ right: 20, quick: 9 }, { right: 18, quick: 9 })).toBe('2 more right than last time!');
    expect(checkDoneLine({ right: 15, quick: 5 }, { right: 18, quick: 9 })).not.toMatch(/less|fewer|slower/);
  });
});
