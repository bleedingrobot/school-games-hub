import { describe, expect, it } from 'vitest';
import { judgePowerClashGame, type PowerClashGameReport } from './save';
import { botLoadoutFor, type SoloSetup } from './solo';
import { playWholeMatch } from './testing';

const setup = (over: Partial<SoloSetup> = {}): SoloSetup => ({
  seed: 's1-1792000000-abcdefabcdefabcdefabcdef', level: 'easy', side: 'X', loadout: ['board-wipe', 'body-swap', 'freeze-ray'], ...over,
});

function report(s: SoloSetup, leaveAfter = Infinity): PowerClashGameReport {
  const { solo, actions } = playWholeMatch(s, 'easy', leaveAfter);
  const bot = botLoadoutFor(s.seed, s.level);
  return {
    game: 'power-clash', seed: s.seed, stamp: 'x'.repeat(43), level: s.level, side: s.side,
    chaos: s.chaos === true,
    loadouts: s.side === 'X' ? { X: s.loadout, O: bot } : { X: bot, O: s.loadout },
    actions, ending: solo.match.winner ? 'finished' : 'abandoned',
  };
}

describe('judging a Power Clash match', () => {
  it('works out the result by replaying, gives nothing for a match left part-way, and refuses changed games', () => {
    for (const side of ['X', 'O'] as const) {
      const judged = judgePowerClashGame(report(setup({ side })));
      const { solo } = playWholeMatch(setup({ side }), 'easy');
      expect(judged.ok && judged.game).toEqual(expect.objectContaining({ outcome: solo.match.winner === side ? 'won' : 'lost', countsForPoints: true }));
    }
    const left = judgePowerClashGame(report(setup(), 4));
    expect(left.ok && left.game).toEqual(expect.objectContaining({ outcome: 'lost', reason: 'abandoned', countsForPoints: false }));
    const r = report(setup());
    const refused = [
      { ...r, level: 'medium' as const },
      { ...r, side: 'O' as const },
      { ...r, actions: r.actions.slice(0, 3) }, // says finished, but isn't
      { ...r, loadouts: { ...r.loadouts, O: [r.loadouts.O[1], r.loadouts.O[0], r.loadouts.O[2]] } }, // the bot's powers are the seed's
    ];
    for (const bad of refused) expect(judgePowerClashGame(bad).ok).toBe(false);
  });
});
