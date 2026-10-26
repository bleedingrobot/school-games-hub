import { describe, expect, it } from 'vitest';
import { BOND_SETS } from './bonds';
import { newGame } from './engine';
import { perfectFlips, play } from './perfectPlayer';
import { BOARD_SIZES, buildDeck, partnersOf } from './deck';

const seeds = Array.from({ length: 10 }, (_, i) => i * 10007 + 1);

describe('buildDeck', () => {
  it('builds every board size of every set so that every card can be cleared', () => {
    for (const set of BOND_SETS) {
      for (const size of BOARD_SIZES) {
        for (const seed of seeds) {
          const deck = buildDeck(set, size, seed);
          expect(deck.cards).toHaveLength(deck.pairCount * 2);
          expect(partnersOf(deck).every((p) => p.length >= 1)).toBe(true);
          expect(play(newGame(deck), perfectFlips(newGame(deck))).finished).toBe(true);
        }
      }
    }
  });
});
