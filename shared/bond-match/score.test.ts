import { describe, expect, it } from 'vitest';
import { findBondSet } from './bonds';
import { buildDeck, partnersOf } from './deck';
import { newGame } from './engine';
import { perfectFlips, play } from './perfectPlayer';
import { scoreGame } from './score';

describe('stars', () => {
  it('counts wasted turns in a real game: 6 pairs gets silver at 15 flips and bronze at 16', () => {
    const s = newGame(buildDeck(findBondSet('whole-20')!, 'small', 2));
    const partners = partnersOf(s.deck);
    const b = s.deck.cards.findIndex((_, j) => j > 0 && !partners[0].includes(j));
    const waste = (turns: number) => Array.from({ length: turns * 2 }, (_, k) => (k % 2 === 0 ? 0 : b));
    const stars = (turns: number) => scoreGame(play(s, [...waste(turns), ...perfectFlips(s)]), 10)!;
    expect(stars(3)).toMatchObject({ flips: 9, stars: 3 });
    expect(stars(4)).toMatchObject({ flips: 10, stars: 2 });
    expect(stars(9)).toMatchObject({ flips: 15, stars: 2 });
    expect(stars(10)).toMatchObject({ flips: 16, stars: 1 });
  });
});
