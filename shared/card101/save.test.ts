import { describe, expect, it } from 'vitest';
import { judgeCard101Game, type Card101GameReport } from './save';
import type { SoloSetup } from './solo';
import { playWholeGame } from './testing';

const setup = (over: Partial<SoloSetup> = {}): SoloSetup => ({ seed: 's1-1792000000-abcdefabcdefabcdefabcdef', bots: 2, level: 'easy', settings: { target: 50 }, ...over });

function report(s: SoloSetup, leaveAfter = Infinity): { report: Card101GameReport; game: ReturnType<typeof playWholeGame>['solo']['game'] } {
  const { solo, actions } = playWholeGame(s, 'easy', leaveAfter);
  const sent = actions.filter((a) => a !== 'leave');
  return {
    report: {
      game: '101',
      seed: s.seed,
      stamp: 'x'.repeat(43),
      bots: s.bots,
      level: s.level,
      settings: s.settings,
      actions: sent,
      ending: sent.length === actions.length && solo.game.phase === 'over' ? 'finished' : 'abandoned',
    },
    game: solo.game,
  };
}

describe('judging a 101 game', () => {
  it('works out the result from the replay, and refuses a changed game', () => {
    const { report: r, game } = report(setup());
    const judged = judgeCard101Game(r);
    expect(judged.ok).toBe(true);
    if (!judged.ok) return;
    expect(judged.game.outcome).toBe(game.winners!.includes(0) ? 'won' : 'lost');
    expect(judged.game.total).toBe(game.totals[0]);
    expect(judgeCard101Game({ ...r, actions: [...r.actions, 'knock'] }).ok).toBe(false);
    expect(judgeCard101Game({ ...r, actions: r.actions.slice(1) }).ok).toBe(false);
    expect(judgeCard101Game({ ...r, seed: r.seed.replace(/f$/, 'e') }).ok).toBe(false);
  });
});
