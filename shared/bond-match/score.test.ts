import { describe, expect, it } from 'vitest';
import { findBondSet } from './bonds';
import { buildDeck, partnersOf } from './deck';
import { newGame } from './engine';
import { perfectFlips, play } from './perfectPlayer';
import { minFlips, scoreGame, starsFor, STAR_CONFIG } from './score';

describe('stars', () => {
  it('sits on the edges of the thresholds', () => {
    // 8 pairs: gold up to 12 flips, silver up to 20, bronze after
    expect([8, 11, 12].map((f) => starsFor(f, 8))).toEqual([3, 3, 3]);
    expect([13, 19, 20].map((f) => starsFor(f, 8))).toEqual([2, 2, 2]);
    expect([21, 50].map((f) => starsFor(f, 8))).toEqual([1, 1]);
    expect([9, 15].map((f) => starsFor(f, 6))).toEqual([3, 2]); // 6 pairs: gold 9, silver 15
    expect(starsFor(16, 6)).toBe(1);
  });

  it('reads the thresholds from one config object', () => {
    expect(starsFor(10, 8, { goldWithin: 1, silverWithin: 2 })).toBe(2);
    expect(STAR_CONFIG).toEqual({ goldWithin: 1.5, silverWithin: 2.5 });
  });

  it('scores a finished game; null when unfinished', () => {
    const s = newGame(buildDeck(findBondSet('whole-20')!, 'medium', 2));
    expect(scoreGame(s, 30)).toBeNull();
    const end = play(s, perfectFlips(s));
    expect(scoreGame(end, 61.9)).toEqual({ flips: 8, seconds: 61, minFlips: 8, stars: 3 });
    expect(minFlips(s)).toBe(8);
  });

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
