import { describe, expect, it } from 'vitest';
import { MIN_MOVES_TO_COUNT } from '../botGame';
import { judgeCheckersGame, parseCheckersReport, type CheckersGameReport } from './botGame';
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
  it('the board decides who won', () => {
    const game = findGame((r) => r.winner === 'red');
    const asRed = judgeCheckersGame(report({ studentColour: 'red', moves: game.moves }));
    expect(asRed).toEqual({
      ok: true,
      game: { outcome: 'won', reason: game.result.ending, studentMoves: Math.ceil(game.moves.length / 2), countsForPoints: true },
    });
    const asWhite = judgeCheckersGame(report({ studentColour: 'white', moves: game.moves, ending: 'resigned' }));
    expect(asWhite.ok && asWhite.game.outcome).toBe('lost');
  });

  it('a 40-move draw is a draw', () => {
    const game = findGame((r) => r.ending === 'forty-moves');
    const judged = judgeCheckersGame(report({ moves: game.moves }));
    expect(judged.ok && judged.game).toMatchObject({ outcome: 'drawn', reason: 'forty-moves' });
  });

  it('refuses a "finished" game that is not over', () => {
    expect(judgeCheckersGame(report({ moves: ['11-15', '23-19'] }))).toEqual({ ok: false, problem: 'the game is not over' });
  });

  it('refuses illegal moves, so a win cannot be faked', () => {
    expect(judgeCheckersGame(report({ moves: ['11-15', '22-18', '12-16'], ending: 'resigned' }))).toEqual({
      ok: false,
      problem: 'illegal move at 3',
    });
    // A chess game sent in as checkers.
    expect(judgeCheckersGame(report({ moves: ['e2e4'], ending: 'resigned' })).ok).toBe(false);
  });

  it('resigning and leaving are losses; short and abandoned games earn nothing', () => {
    const short = judgeCheckersGame(report({ moves: ['11-15', '23-19'], ending: 'resigned' }));
    expect(short.ok && short.game).toEqual({ outcome: 'lost', reason: 'resigned', studentMoves: 1, countsForPoints: false });

    const { moves } = randomGame(7);
    const long = moves.slice(0, MIN_MOVES_TO_COUNT * 2);
    const resigned = judgeCheckersGame(report({ moves: long, ending: 'resigned' }));
    expect(resigned.ok && resigned.game).toMatchObject({ outcome: 'lost', studentMoves: MIN_MOVES_TO_COUNT, countsForPoints: true });
    const left = judgeCheckersGame(report({ moves: long, ending: 'abandoned' }));
    expect(left.ok && left.game).toMatchObject({ outcome: 'lost', reason: 'abandoned', countsForPoints: false });
    // After 19 moves in total, White (who goes second) has made 9.
    const asWhite = judgeCheckersGame(report({ studentColour: 'white', moves: long.slice(0, -1), ending: 'resigned' }));
    expect(asWhite.ok && asWhite.game.studentMoves).toBe(MIN_MOVES_TO_COUNT - 1);
  });
});

describe('reading a report from the browser', () => {
  it('accepts a proper report', () => {
    const good = { level: 'medium', studentColour: 'white', moves: ['11-15'], ending: 'abandoned' };
    expect(parseCheckersReport(good)).toEqual(good);
  });

  it('refuses anything odd', () => {
    const base = { level: 'easy', studentColour: 'red', moves: [], ending: 'finished' };
    for (const bad of [
      null,
      'text',
      { ...base, level: 'expert' },
      { ...base, studentColour: 'black' }, // a chess colour
      { ...base, ending: 'won' },
      { ...base, moves: 'not a list' },
      { ...base, moves: [1, 2] },
      { ...base, moves: ['x'.repeat(100)] },
      { ...base, moves: Array(1001).fill('11-15') },
    ]) {
      expect(parseCheckersReport(bad)).toBeNull();
    }
  });
});
