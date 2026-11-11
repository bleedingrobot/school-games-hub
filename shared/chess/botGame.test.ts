import { describe, expect, it } from 'vitest';
import { judgeBotGame, MIN_MOVES_TO_COUNT, type BotGameReport } from './botGame';

const REPEAT = ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8'];

function report(over: Partial<BotGameReport>): BotGameReport {
  return { level: 'easy', studentColour: 'white', moves: [], ending: 'finished', ...over };
}

describe('judging a bot game', () => {
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
