import { describe, expect, it } from 'vitest';
import { judgeCheckersGame, type CheckersGameReport } from './botGame';
import { seeded } from '../seededRandom';
import { applyMove, boardResult, legalMoves, startPosition, type BoardResult } from './rules';

function report(over: Partial<CheckersGameReport>): CheckersGameReport {
  return { level: 'easy', studentColour: 'red', moves: [], ending: 'finished', ...over };
}

/** Plays random legal moves until the game ends. */
function randomGame(seed: number): { moves: string[]; result: BoardResult } {
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
  return { moves, result };
}

function findGame(wanted: (r: BoardResult) => boolean) {
  for (let seed = 1; seed < 500; seed++) {
    const game = randomGame(seed);
    if (wanted(game.result)) return game;
  }
  throw new Error('no such game');
}

describe('judging a checkers game against a bot', () => {
  it('the board decides who won, and a faked or unfinished win is refused', () => {
    const game = findGame((r) => r.winner === 'red');
    const asRed = judgeCheckersGame(report({ studentColour: 'red', moves: game.moves }));
    expect(asRed.ok && asRed.game.outcome).toBe('won');
    const asWhite = judgeCheckersGame(report({ studentColour: 'white', moves: game.moves, ending: 'resigned' }));
    expect(asWhite.ok && asWhite.game.outcome).toBe('lost');
    expect(judgeCheckersGame(report({ moves: ['11-15', '22-18', '12-16'], ending: 'resigned' }))).toEqual({ ok: false, problem: 'illegal move at 3' });
    expect(judgeCheckersGame(report({ moves: ['11-15', '23-19'] }))).toEqual({ ok: false, problem: 'the game is not over' });
  });
});
