import { describe, expect, it } from 'vitest';
import { judgeBotGame, type BotGameReport } from './botGame';

const FOOLS_MATE = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];

function report(over: Partial<BotGameReport>): BotGameReport {
  return { level: 'easy', studentColour: 'white', moves: [], ending: 'finished', ...over };
}

describe('judging a bot game', () => {
  it('the board decides who won, and a faked or unfinished win is refused', () => {
    const asBlack = judgeBotGame(report({ studentColour: 'black', moves: FOOLS_MATE, ending: 'resigned' }));
    expect(asBlack.ok && asBlack.game).toMatchObject({ outcome: 'won', reason: 'checkmate' });
    const asWhite = judgeBotGame(report({ studentColour: 'white', moves: FOOLS_MATE }));
    expect(asWhite.ok && asWhite.game.outcome).toBe('lost');
    // "Checkmate" by teleporting the queen.
    expect(judgeBotGame(report({ moves: ['e2e4', 'e7e5', 'd1f7'] }))).toEqual({ ok: false, problem: 'illegal move at 3' });
    expect(judgeBotGame(report({ moves: ['e2e4', 'e7e5'] }))).toEqual({ ok: false, problem: 'the game is not over' });
  });
});
