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
  it('works out the result by replaying for either side, gives no points for a match left part-way, and refuses changed games', () => {
    for (const side of ['X', 'O'] as const) {
      const r = report(setup({ side }));
      const judged = judgePowerClashGame(r);
      expect(judged.ok).toBe(true);
      if (!judged.ok) return;
      const { solo } = playWholeMatch(setup({ side }), 'easy');
      expect(judged.game.outcome).toBe(solo.match.winner === side ? 'won' : 'lost');
      expect(judged.game).toEqual(expect.objectContaining({ reason: 'finished', countsForPoints: true, roundsWon: solo.match.score[side] }));
    }
    const part = judgePowerClashGame(report(setup(), 4));
    expect(part.ok && part.game).toEqual(expect.objectContaining({ outcome: 'lost', reason: 'abandoned', countsForPoints: false }));
    const r = report(setup());
    const refused = [
      { ...r, level: 'medium' as const },
      { ...r, side: 'O' as const },
      { ...r, actions: r.actions.slice(0, 3) }, // says finished, but isn't
      { ...r, actions: [...r.actions, 'next'] },
      { ...r, loadouts: { ...r.loadouts, O: [r.loadouts.O[1], r.loadouts.O[0], r.loadouts.O[2]] } }, // the bot's powers are the seed's
      { ...r, loadouts: { ...r.loadouts, X: ['board-wipe', 'board-wipe', 'freeze-ray'] as typeof r.loadouts.X } },
    ];
    for (const bad of refused) expect(judgePowerClashGame(bad).ok).toBe(false);
  });

  it('a game played in Chaos Mode can not be claimed as a normal one with a good result', () => {
    const r = report(setup({ chaos: true, loadout: ['force-field', 'portal-chaos', 'wild-card'], seed: 's1-1792000000-zzabcdefabcdefabcdefabcd' }));
    const claimed = judgePowerClashGame({ ...r, chaos: false });
    const honest = judgePowerClashGame(r);
    if (claimed.ok && honest.ok) expect(claimed.game).not.toEqual(honest.game);
  });
});
