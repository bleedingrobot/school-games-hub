import { describe, expect, it } from 'vitest';
import { seeded } from './seededRandom';
import { applyMove, boardResult, legalMoves, startPosition, type BoardResult } from './checkers/rules';
import {
  checkMove,
  CODE_ALPHABET,
  colourName,
  countsForPoints,
  makeCode,
  movesBy,
  normaliseCode,
  prettyCode,
  replayGame,
  sideToMove,
} from './multiplayer';

describe('game codes', () => {
  it('never use vowels or lookalike characters', () => {
    for (const c of 'AEIOU01LSZB258') expect(CODE_ALPHABET).not.toContain(c);
    const random = seeded(1);
    for (let i = 0; i < 200; i++) expect(makeCode(random)).toMatch(new RegExp(`^[${CODE_ALPHABET}]{5}$`));
  });

  it('accept any case, spaces and dashes when typed', () => {
    expect(normaliseCode('km4 tp')).toBe('KM4TP');
    expect(normaliseCode(' K-M-4-T-P ')).toBe('KM4TP');
    expect(prettyCode('KM4TP')).toBe('KM4 TP');
  });

  it('turn away anything that can’t be a code', () => {
    for (const typed of ['KM4T', 'KM4TPP', 'HELLO', 'KM4T0', 42, null, 'x'.repeat(100)]) {
      expect(normaliseCode(typed)).toBeNull();
    }
  });
});

describe('sides and turns', () => {
  it('names the colours for each game', () => {
    expect([colourName('chess', 'first'), colourName('chess', 'second')]).toEqual(['White', 'Black']);
    expect([colourName('checkers', 'first'), colourName('checkers', 'second')]).toEqual(['Red', 'White']);
  });

  it('knows whose turn it is and how many moves each side has made', () => {
    expect([0, 1, 2, 3].map(sideToMove)).toEqual(['first', 'second', 'first', 'second']);
    expect([movesBy('first', 5), movesBy('second', 5)]).toEqual([3, 2]);
  });

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

  it('says a game with an illegal move in it is broken', () => {
    expect(replayGame('chess', ['e2e5'])).toEqual({ ok: false });
    expect(replayGame('checkers', ['1-2'])).toEqual({ ok: false });
  });

  it('checks a next move, and refuses one after the game has ended', () => {
    expect(checkMove('chess', [], 'e2e4')).toBe('e2e4');
    expect(checkMove('chess', [], 'e2e5')).toBeNull();
    expect(checkMove('chess', ['f2f3', 'e7e5', 'g2g4', 'd8h4'], 'e2e4')).toBeNull();
    expect(checkMove('checkers', [], '11-15')).toBe('11-15');
    expect(checkMove('checkers', ['11-15', '22-18'], '9-13')).toBeNull();
  });

  it('ends checkers games by the rules, including the 40-move draw', () => {
    const draw = findCheckersGame((r) => r.ending === 'forty-moves');
    expect(replayGame('checkers', draw.moves)).toEqual({
      ok: true,
      toMove: sideToMove(draw.moves.length),
      ended: { winner: null, reason: 'forty-moves' },
    });
    const whiteWins = findCheckersGame((r) => r.winner === 'white');
    expect(replayGame('checkers', whiteWins.moves)).toMatchObject({ ended: { winner: 'second' } });
  });
});

/** Plays random legal checkers games until one ends the way we want. */
function findCheckersGame(wanted: (r: BoardResult) => boolean) {
  for (let seed = 1; seed < 500; seed++) {
    const random = seeded(seed);
    let position = startPosition();
    const moves: string[] = [];
    let result = boardResult(position);
    while (!result) {
      const options = legalMoves(position);
      const move = options[Math.floor(random() * options.length)];
      moves.push(move.notation);
      position = applyMove(position, move);
      result = boardResult(position);
    }
    if (wanted(result)) return { moves, result };
  }
  throw new Error('no such game');
}
