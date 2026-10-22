import { describe, expect, it } from 'vitest';
import { findBondSet } from './bonds';
import { buildDeck, partnersOf } from './deck';
import { perfectFlips } from './perfectPlayer';
import { newVersus, otherPlayer, versusFlip, winnerOf, type VersusState } from './versus';

const start = () => newVersus(buildDeck(findBondSet('whole-10')!, 'small', 7));

const wrongFor = (s: VersusState, i: number) => {
  const partners = partnersOf(s.game.deck);
  return s.game.deck.cards.findIndex((_, j) => j !== i && !partners[i].includes(j) && !s.game.matched[j]);
};

describe('two players on one board', () => {
  it('a match scores a pair and the same player goes again', () => {
    const s = start();
    const p = partnersOf(s.game.deck)[0][0];
    const r = versusFlip(versusFlip(s, 0).state, p);
    expect(r.state.pairs).toEqual([1, 0]);
    expect(r.state.turn).toBe(0);
  });

  it('a mismatch passes the turn', () => {
    const s = start();
    const r = versusFlip(versusFlip(s, 0).state, wrongFor(s, 0));
    expect(r.state.turn).toBe(1);
    expect(r.state.pairs).toEqual([0, 0]);
  });

  it('a refused flip changes nothing', () => {
    const s = versusFlip(start(), 0).state;
    const r = versusFlip(s, 0);
    expect(r.refused).toBe('same-card');
    expect(r.state).toBe(s);
  });

  it('counts the pairs and names the winner when the board is clear', () => {
    let s = start();
    // Player 1 misses once, so player 2 clears the board.
    s = versusFlip(versusFlip(s, 0).state, wrongFor(s, 0)).state;
    expect(winnerOf(s)).toBeUndefined();
    const flips = perfectFlips(s.game);
    for (let k = 0; k < flips.length; k += 2) s = versusFlip(versusFlip(s, flips[k]).state, flips[k + 1]).state;
    expect(s.game.finished).toBe(true);
    expect(s.pairs).toEqual([0, 6]);
    expect(winnerOf(s)).toBe(1);
    expect(otherPlayer(1)).toBe(0);
  });

  it('a tie is a tie', () => {
    const s = start();
    expect(winnerOf({ ...s, game: { ...s.game, finished: true }, pairs: [3, 3] })).toBe('tie');
  });
});
