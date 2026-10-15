import { describe, expect, it } from 'vitest';
import type { Card } from '../../../shared/card101/cards';
import { scoreHand } from '../../../shared/card101/score';
import { eventLine, scoreLines } from './text';

const working = (text: string) => {
  const hand = text.split(' ') as Card[];
  return scoreLines(hand, scoreHand(hand));
};

describe('the scoring working', () => {
  it('matches every example in the rules', () => {
    expect(working('7H 7S 4C KD')).toEqual({ steps: ['The 7s are a pair, so they cancel out.'], sum: 'Hand: 4 + 0 = 4' });
    expect(working('5H 5S 5C QD')).toEqual({ steps: ['Three 5s: the whole hand scores 0!'], sum: 'Hand: 0' });
    expect(working('3H QS 6C AD')).toEqual({ steps: ['The 3 cancels the Queen: 10 → 0.'], sum: 'Hand: 6 + 1 = 7' });
    expect(working('3H 9S 9C 5D')).toEqual({
      steps: ['The 9s are a pair, so they cancel out.', 'The 3 cancels the 5: 5 → 0.'],
      sum: 'Hand: 0',
    });
    expect(working('3H 3S 9C 7D')).toEqual({
      steps: ['Two 3s: each one cancels a card.', 'The 3 cancels the 9: 9 → 0.', 'The 3 cancels the 7: 7 → 0.'],
      sum: 'Hand: 0',
    });
    expect(working('3H JS QC 2D').sum).toBe('Hand: 10 + 2 = 12');
  });

  it('four of a kind, and a hand with nothing cancelled', () => {
    expect(working('8H 8S 8C 8D').steps).toEqual(['Four 8s: the whole hand scores 0!']);
    expect(working('AH 2S 4C TD').sum).toBe('Hand: 1 + 2 + 4 + 10 = 17');
  });
});

describe('the game log', () => {
  const names = ['Speedy Otter', 'Kea', 'Tūī'];
  it('says who did what, and never names a card it shouldn’t', () => {
    expect(eventLine({ kind: 'draw', seat: 1, from: 'stack' }, names, 0)).toBe('Kea took a card from the stack.');
    expect(eventLine({ kind: 'draw', seat: 0, from: 'stack', card: 'QH' }, names, 0)).toBe('You took the Queen of hearts from the stack.');
    expect(eventLine({ kind: 'swap', seat: 2, slot: 3, placed: '4C', discarded: 'TD' }, names, 0)).toBe(
      'Tūī put the 4 of clubs face up in their bottom right spot, and threw away the 10 of diamonds.',
    );
    expect(eventLine({ kind: 'knock', seat: 0 }, names, 0)).toBe('You knocked! Everyone else gets one last turn.');
    expect(eventLine({ kind: 'turn', seat: 1, lastTurn: false }, names, 0)).toBeNull();
  });
});
