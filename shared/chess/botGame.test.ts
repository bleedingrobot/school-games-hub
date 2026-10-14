import { describe, expect, it } from 'vitest';
import { judgeBotGame, MIN_MOVES_TO_COUNT, parseReport, type BotGameReport } from './botGame';

const FOOLS_MATE = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];
const REPEAT = ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8'];

function report(over: Partial<BotGameReport>): BotGameReport {
  return { level: 'easy', studentColour: 'white', moves: [], ending: 'finished', ...over };
}

describe('judging a bot game', () => {
  it('a checkmate is a win for whoever delivered it', () => {
    const asBlack = judgeBotGame(report({ studentColour: 'black', moves: FOOLS_MATE }));
    expect(asBlack).toEqual({
      ok: true,
      game: { outcome: 'won', reason: 'checkmate', studentMoves: 2, countsForPoints: false },
    });
    const asWhite = judgeBotGame(report({ studentColour: 'white', moves: FOOLS_MATE }));
    expect(asWhite.ok && asWhite.game.outcome).toBe('lost');
  });

  it('a draw by the rules is a draw', () => {
    const judged = judgeBotGame(report({ moves: REPEAT }));
    expect(judged.ok && judged.game).toMatchObject({ outcome: 'drawn', reason: 'threefold-repetition' });
  });

  it('the board decides, even if the browser says the student resigned', () => {
    const judged = judgeBotGame(report({ studentColour: 'black', moves: FOOLS_MATE, ending: 'resigned' }));
    expect(judged.ok && judged.game.outcome).toBe('won');
  });

  it('refuses a "finished" game that is not over', () => {
    expect(judgeBotGame(report({ moves: ['e2e4', 'e7e5'] }))).toEqual({ ok: false, problem: 'the game is not over' });
  });

  it('refuses illegal moves, so a win cannot be faked', () => {
    // "Checkmate" by teleporting the queen.
    const judged = judgeBotGame(report({ moves: ['e2e4', 'e7e5', 'd1f7'] }));
    expect(judged).toEqual({ ok: false, problem: 'illegal move at 3' });
  });

  it('resigning and leaving are losses', () => {
    const resigned = judgeBotGame(report({ moves: ['e2e4', 'e7e5'], ending: 'resigned' }));
    expect(resigned.ok && resigned.game).toMatchObject({ outcome: 'lost', reason: 'resigned' });
    const left = judgeBotGame(report({ moves: ['e2e4', 'e7e5'], ending: 'abandoned' }));
    expect(left.ok && left.game).toMatchObject({ outcome: 'lost', reason: 'abandoned' });
  });

  it('short and abandoned games earn nothing', () => {
    const long = Array.from({ length: MIN_MOVES_TO_COUNT * 2 }, (_, i) => REPEAT[i % 4]);
    // Shuffling knights for 20 moves repeats the start position, so cut it before the draw.
    const notOver = long.slice(0, 7);
    expect(judgeBotGame(report({ moves: notOver, ending: 'resigned' }))).toMatchObject({
      ok: true,
      game: { countsForPoints: false },
    });

    const tenMoves = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'b1c3', 'f8c5', 'd2d3', 'd7d6',
      'c1g5', 'h7h6', 'g5h4', 'g7g5', 'h4g3', 'c8g4', 'h2h3', 'g4h5', 'a2a3'];
    expect(judgeBotGame(report({ moves: tenMoves, ending: 'resigned' }))).toMatchObject({
      ok: true,
      game: { studentMoves: 10, countsForPoints: true },
    });
    expect(judgeBotGame(report({ moves: tenMoves, ending: 'abandoned' }))).toMatchObject({
      ok: true,
      game: { studentMoves: 10, countsForPoints: false },
    });
  });
});

describe('reading a report from the browser', () => {
  const good = { level: 'medium', studentColour: 'black', moves: ['e2e4'], ending: 'abandoned' };

  it('accepts a well-formed report', () => {
    expect(parseReport(good)).toEqual(good);
  });

  it('rejects anything odd', () => {
    expect(parseReport(null)).toBeNull();
    expect(parseReport('hi')).toBeNull();
    expect(parseReport({ ...good, level: 'grandmaster' })).toBeNull();
    expect(parseReport({ ...good, studentColour: 'green' })).toBeNull();
    expect(parseReport({ ...good, ending: 'won' })).toBeNull();
    expect(parseReport({ ...good, moves: 'e2e4' })).toBeNull();
    expect(parseReport({ ...good, moves: [1, 2] })).toBeNull();
    expect(parseReport({ ...good, moves: Array(1001).fill('e2e4') })).toBeNull();
  });
});
