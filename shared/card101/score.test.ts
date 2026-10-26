import { describe, expect, it } from 'vitest';
import { scoreHand } from './score';
import type { Card } from './cards';

const total = (text: string) => scoreHand(text.split(' ') as Card[]).total;

describe('scoring a hand (docs/101-RULES.md)', () => {
  it('the examples in the rules', () => {
    expect(total('7H 7C 4D KS')).toBe(4);
    expect(total('5H 5C 5D QS')).toBe(0);
    expect(total('3H QC 6D AS')).toBe(7);
    expect(total('3H 9C 9D 5S')).toBe(0);
    expect(total('3H 3C 9D 7S')).toBe(0);
    expect(total('3H JC QD 2S')).toBe(12);
  });
});
