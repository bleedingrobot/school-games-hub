import { describe, expect, it } from 'vitest';
import { judgeCard101Game, MIN_ROUNDS_TO_COUNT, type Card101GameReport } from './save';
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
  it('works out the result, place and stats from the replay', () => {
    for (const bots of [1, 2, 3]) {
      const s = setup({ bots, seed: `s1-1792000000-${String(bots).repeat(24)}` });
      const { report: r, game } = report(s);
      const judged = judgeCard101Game(r);
      expect(judged.ok).toBe(true);
      if (!judged.ok) return;
      const won = game.winners!.includes(0);
      expect(judged.game.outcome).toBe(won ? 'won' : 'lost');
      expect(judged.game.place === 1).toBe(won);
      expect(judged.game.reason).toBe('finished');
      expect(judged.game.players).toBe(bots + 1);
      expect(judged.game.rounds).toBe(game.results.length);
      expect(judged.game.total).toBe(game.totals[0]);
      expect(judged.game.countsForPoints).toBe(game.results.length >= MIN_ROUNDS_TO_COUNT);
      const mine = game.results.map((x) => x.scores[0]!);
      expect(judged.game.stats).toEqual({
        zeroHands: mine.filter((x) => x.total === 0).length,
        triples: mine.filter((x) => x.steps.some((st) => st.kind === 'triple')).length,
        knockWins: game.results.filter((x) => x.knocker === 0 && x.winners.includes(0)).length,
        savedByThree: mine.flatMap((x) => x.steps).filter((st) => st.kind === 'three-cancels' && st.value === 10).length,
      });
    }
  });

});
