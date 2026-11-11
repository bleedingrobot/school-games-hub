import { describe, expect, it } from 'vitest';
import {
  checkMove,
  countsForPoints,
  replayGame} from './multiplayer';


describe('sides and turns', () => {

  it('only counts games where both played at least 10 moves and nobody walked away', () => {
    expect(countsForPoints(19, 'checkmate')).toBe(false);
    expect(countsForPoints(20, 'checkmate')).toBe(true);
    expect(countsForPoints(20, 'agreed-draw')).toBe(true);
    expect(countsForPoints(80, 'abandoned')).toBe(false);
  });
});


describe('refereeing', () => {
  it('ends a chess game by the rules and says who won', () => {
    expect(replayGame('chess', ['f2f3', 'e7e5', 'g2g4', 'd8h4'])).toEqual({
      ok: true,
      toMove: 'first',
      ended: { winner: 'second', reason: 'checkmate' },
    });
    const repeat = ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8'];
    expect(replayGame('chess', repeat)).toMatchObject({ ended: { winner: null, reason: 'threefold-repetition' } });
  });

  it('checks a next move, and refuses one after the game has ended', () => {
    expect(checkMove('chess', [], 'e2e4')).toBe('e2e4');
    expect(checkMove('chess', [], 'e2e5')).toBeNull();
    expect(checkMove('chess', ['f2f3', 'e7e5', 'g2g4', 'd8h4'], 'e2e4')).toBeNull();
    expect(checkMove('checkers', [], '11-15')).toBe('11-15');
    expect(checkMove('checkers', ['11-15', '22-18'], '9-13')).toBeNull();
  });

});

/** Plays random legal checkers games until one ends the way we want. */
