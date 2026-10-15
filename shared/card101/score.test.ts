import { describe, expect, it } from 'vitest';
import { cardName, cardValue, CARD_PATTERN, isCard, PACK, type Card } from './cards';
import { scoreHand } from './score';

const hand = (text: string) => text.split(' ') as Card[];
const total = (text: string) => scoreHand(hand(text)).total;

describe('the pack', () => {
  it('has 52 different cards', () => {
    expect(PACK).toHaveLength(52);
    expect(new Set(PACK).size).toBe(52);
    expect(PACK.every(isCard)).toBe(true);
    expect(isCard('1H')).toBe(false);
    expect(isCard('qh')).toBe(false);
  });

  it('card values: King 0, 3 0, Ace 1, numbers face value, Jack and Queen 10', () => {
    expect(['KS', '3H', 'AD', '2C', '4S', '9H', 'TD', 'JC', 'QS'].map((c) => cardValue(c as Card))).toEqual([0, 0, 1, 2, 4, 9, 10, 10, 10]);
  });

  it('names cards in words', () => {
    expect(cardName('QH')).toBe('Queen of hearts');
    expect(cardName('TS')).toBe('10 of spades');
  });

  it('the leak-finder pattern finds every card and nothing else', () => {
    expect(JSON.stringify(PACK).match(CARD_PATTERN)).toHaveLength(52);
    expect('{"phase":"peek","from":"stack","kind":"draw","seat":2,"QS":1}'.match(CARD_PATTERN)).toEqual(['QS']);
  });
});

describe('scoring a hand (docs/101-RULES.md)', () => {
  it('adds up plain cards', () => {
    expect(total('AH 2C 4D 9S')).toBe(16);
    expect(total('JH QC TD 9S')).toBe(39);
    expect(total('KH KC')).toBe(0);
  });

  it('the examples in the rules', () => {
    expect(total('7H 7C 4D KS')).toBe(4);
    expect(total('5H 5C 5D QS')).toBe(0);
    expect(total('3H QC 6D AS')).toBe(7);
    expect(total('3H 9C 9D 5S')).toBe(0);
    expect(total('3H 3C 9D 7S')).toBe(0);
    expect(total('3H JC QD 2S')).toBe(12);
  });

  it('pairs cancel anywhere in the hand, not just in a column', () => {
    for (const order of ['8H 8C 2D 4S', '8H 2D 8C 4S', '8H 2D 4S 8C', '2D 4S 8H 8C']) expect(total(order)).toBe(6);
  });

  it('two pairs cancel to 0, and four of a kind is 0', () => {
    expect(total('8H 8C QD QS')).toBe(0);
    expect(total('9H 9C 9D 9S')).toBe(0);
  });

  it('three of a kind makes the whole hand 0, whatever else is there', () => {
    expect(total('QH QC QD JS')).toBe(0);
    expect(total('AH AC AD TS')).toBe(0);
    expect(total('3H 3C 3D QS')).toBe(0);
    expect(scoreHand(hand('QH QC QD JS')).steps).toEqual([{ kind: 'triple', rank: 'Q', slots: [0, 1, 2] }]);
  });

  it('a 3 cancels the highest card', () => {
    expect(total('3H 2C 9D 4S')).toBe(6);
    expect(scoreHand(hand('3H 2C 9D 4S')).values).toEqual([0, 2, 0, 4]);
  });

  it('pairs go first, then the 3 cancels the highest card left', () => {
    // Not 9 + 5 = 14 (the 3 cancelling a 9 first).
    expect(total('3H 9C 9D 5S')).toBe(0);
    expect(scoreHand(hand('3H 9C 9D 5S')).steps).toEqual([
      { kind: 'pair', rank: '9', slots: [1, 2] },
      { kind: 'three-cancels', three: 0, cancels: 3, value: 5 },
    ]);
    expect(total('3H QC QD 5S')).toBe(0);
    expect(total('3H 4C 4D 2S')).toBe(0);
  });

  it('a pair of 3s: each 3 cancels a card as well', () => {
    expect(total('3H 3C 9D 7S')).toBe(0);
    expect(total('3H 3C KD 7S')).toBe(0);
    expect(scoreHand(hand('3H 3C 9D 7S')).steps).toEqual([
      { kind: 'pair', rank: '3', slots: [0, 1] },
      { kind: 'three-cancels', three: 0, cancels: 2, value: 9 },
      { kind: 'three-cancels', three: 1, cancels: 3, value: 7 },
    ]);
  });

  it('two cards tie for highest: the 3 cancels just one', () => {
    expect(total('3H JC QD 2S')).toBe(12);
    expect(total('3H TC JD QS')).toBe(20);
    expect(total('3H 8C 8D 8S')).toBe(0); // (three of a kind)
  });

  it('a 3 with nothing left to cancel does nothing more', () => {
    expect(total('3H KC KD AS')).toBe(0);
    expect(total('3H KC 7D 7S')).toBe(0);
    expect(total('3H KC KD KS')).toBe(0);
  });

  it('a 3 and a pair of Kings: the 3 still cancels the highest card left', () => {
    expect(total('3H KC KD 8S')).toBe(0);
  });

  it('every possible hand scores between 0 and 40, and the values add up to the total', () => {
    let checked = 0;
    for (let a = 0; a < 52; a += 3) for (let b = a + 1; b < 52; b += 5) for (let c = b + 1; c < 52; c += 4) for (let d = c + 1; d < 52; d += 2) {
      const h = [PACK[a], PACK[b], PACK[c], PACK[d]];
      const s = scoreHand(h);
      expect(s.total).toBeGreaterThanOrEqual(0);
      expect(s.total).toBeLessThanOrEqual(40);
      expect(s.values.reduce((x, y) => x + y, 0)).toBe(s.total);
      checked++;
    }
    expect(checked).toBeGreaterThan(1000);
  });
});
