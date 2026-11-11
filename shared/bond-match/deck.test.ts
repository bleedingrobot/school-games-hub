import { describe, expect, it } from 'vitest';
import { BOND_SETS } from './bonds';
import { newGame } from './engine';
import { perfectFlips, play } from './perfectPlayer';
import { BOARD_SIZES, buildDeck, pairsOnBoard, partnersOf } from './deck';

const seeds = Array.from({ length: 200 }, (_, i) => i * 10007 + 1);

describe('buildDeck', () => {
  it('builds every board size of every set where every card can be cleared (200 seeds)', () => {
    for (const set of BOND_SETS)
      for (const size of BOARD_SIZES) {
        for (const seed of seeds) {
          const deck = buildDeck(set, size, seed);
          expect(deck.cards).toHaveLength(deck.pairCount * 2);
          expect(deck.pairCount).toBe(pairsOnBoard(set, size));
          const partners = partnersOf(deck);
          partners.forEach((p, i) => {
            expect(p.length).toBeGreaterThanOrEqual(1);
            for (const j of p) expect(partners[j]).toContain(i); // and it is mutual
          });
          // The whole board can be cleared, so nobody is ever left with a card that has no partner.
          expect(play(newGame(deck), perfectFlips(newGame(deck))).finished).toBe(true);
        }
      }
  });
});
