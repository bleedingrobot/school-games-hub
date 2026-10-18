import { describe, expect, it } from 'vitest';
import { judgePowerClashGame, parsePowerClashReport, stampText, type PowerClashGameReport } from './save';
import { botLoadoutFor, type SoloSetup } from './solo';
import { playWholeMatch } from './testing';
import { stampText as spaceStampText } from '../space/save';

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

describe('reading a Power Clash report', () => {
  it('accepts a good one and refuses odd shapes', () => {
    const good = report(setup());
    expect(parsePowerClashReport(good)).toEqual(good);
    for (const bad of [
      { ...good, game: '101' },
      { ...good, side: 'Z' },
      { ...good, level: 'hard' },
      { ...good, loadouts: { X: ['board-wipe'], O: good.loadouts.O } },
      { ...good, loadouts: { X: ['a', 'b', 'c'], O: good.loadouts.O } },
      { ...good, loadouts: null },
      { ...good, actions: 'place:1' },
      { ...good, actions: ['x'.repeat(41)] },
      { ...good, actions: Array(1001).fill('next') },
      { ...good, stamp: 'short' },
      { ...good, ending: 'resigned' },
      null,
    ]) {
      expect(parsePowerClashReport(bad)).toBeNull();
    }
  });

  it('stamps say which game they are for', () => {
    expect(stampText('p', 's')).not.toBe(spaceStampText('p', 's'));
  });
});

describe('judging a Power Clash match', () => {
  it('works out the result by replaying, for either side', () => {
    for (const side of ['X', 'O'] as const) {
      const r = report(setup({ side }));
      const judged = judgePowerClashGame(r);
      expect(judged.ok).toBe(true);
      if (!judged.ok) return;
      const { solo } = playWholeMatch(setup({ side }), 'easy');
      expect(judged.game.outcome).toBe(solo.match.winner === side ? 'won' : 'lost');
      expect(judged.game).toEqual(expect.objectContaining({ reason: 'finished', countsForPoints: true, roundsWon: solo.match.score[side] }));
    }
  });

  it('gives no points for a match left part-way, and no result a student can pick', () => {
    const r = report(setup(), 4);
    expect(r.ending).toBe('abandoned');
    const judged = judgePowerClashGame(r);
    expect(judged.ok && judged.game).toEqual(expect.objectContaining({ outcome: 'lost', reason: 'abandoned', countsForPoints: false }));
  });

  it('refuses changed games', () => {
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
});

describe('Chaos Mode and the new powers in a saved game', () => {
  const NEW = ['force-field', 'portal-chaos', 'wild-card'] as const;
  it('reads the chaos flag, and a report with none is a normal game', () => {
    const r = report(setup({ chaos: true }));
    expect(r.chaos).toBe(true);
    expect(parsePowerClashReport(r)?.chaos).toBe(true);
    const { chaos: _ignored, ...old } = r;
    void _ignored;
    expect(parsePowerClashReport(old)?.chaos).toBe(false);
    expect(parsePowerClashReport({ ...r, chaos: 'yes' })?.chaos).toBe(false);
  });
  it('judges a whole Chaos Mode match with the dice-based powers, for either side', () => {
    for (const side of ['X', 'O'] as const) {
      for (const chaos of [false, true]) {
        const r = report(setup({ side, chaos, loadout: [...NEW], seed: `s1-1792000000-${side}${chaos ? 'c' : 'n'}abcdefabcdefabcdefabc` }));
        const judged = judgePowerClashGame(r);
        expect(judged.ok).toBe(true);
        if (judged.ok) expect(judged.game).toEqual(expect.objectContaining({ reason: 'finished', countsForPoints: true }));
      }
    }
  });
  it('a game played in Chaos Mode can not be claimed as a normal one with a good result', () => {
    const r = report(setup({ chaos: true, loadout: [...NEW], seed: 's1-1792000000-zzabcdefabcdefabcdefabcd' }));
    const claimed = judgePowerClashGame({ ...r, chaos: false });
    const honest = judgePowerClashGame(r);
    if (claimed.ok && honest.ok) expect(claimed.game).not.toEqual(honest.game);
  });
  it('refuses powers that do not exist', () => {
    const r = report(setup());
    expect(parsePowerClashReport({ ...r, loadouts: { X: ['teleport', 'body-swap', 'freeze-ray'], O: r.loadouts.O } })).toBeNull();
  });
});
