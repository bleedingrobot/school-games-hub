import { describe, expect, it } from 'vitest';
import { judgeCard101Game, MIN_ROUNDS_TO_COUNT, parseCard101Report, stampText, type Card101GameReport } from './save';
import { stampText as spaceStampText } from '../space/save';
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

describe('reading a 101 report', () => {
  it('accepts a good one and refuses odd shapes', () => {
    const { report: good } = report(setup(), 5);
    expect(parseCard101Report(good)).toEqual(good);
    for (const bad of [
      { ...good, game: 'space' },
      { ...good, bots: 4 },
      { ...good, level: 'hard' },
      { ...good, settings: { target: 101, extra: 1 } },
      { ...good, settings: { target: 60 } },
      { ...good, actions: 'peek' },
      { ...good, actions: ['x'.repeat(21)] },
      { ...good, actions: Array(1001).fill('peek') },
      { ...good, stamp: 'short' },
      { ...good, ending: 'resigned' },
      null,
    ]) {
      expect(parseCard101Report(bad)).toBeNull();
    }
  });

  it('stamps say which game they are for', () => {
    expect(stampText('p', 's')).not.toBe(spaceStampText('p', 's'));
  });
});

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

  it('finds every kind of stat over enough games', () => {
    const totals = { zeroHands: 0, triples: 0, knockWins: 0, savedByThree: 0 };
    for (let n = 0; n < 40; n++) {
      const judged = judgeCard101Game(report(setup({ seed: `s1-1792000000-${n.toString(16).padStart(24, '0')}` })).report);
      if (!judged.ok) throw new Error(judged.problem);
      for (const key of Object.keys(totals) as (keyof typeof totals)[]) totals[key] += judged.game.stats[key];
    }
    expect(totals.zeroHands).toBeGreaterThan(0);
    expect(totals.triples).toBeGreaterThan(0);
    expect(totals.knockWins).toBeGreaterThan(0);
    expect(totals.savedByThree).toBeGreaterThan(0);
  });

  it('a game left part-way is "abandoned", has no place and earns nothing', () => {
    const { report: r } = report(setup(), 10);
    const judged = judgeCard101Game(r);
    expect(judged).toEqual({ ok: true, game: expect.objectContaining({ outcome: 'lost', reason: 'abandoned', place: null, countsForPoints: false }) });
    expect(judgeCard101Game({ ...r, ending: 'finished' })).toEqual({ ok: false, problem: 'game not over' });
  });

  it('a game sent with an explicit leave is left early too', () => {
    const { solo, actions } = playWholeGame(setup({ bots: 1 }), 'easy', 10);
    expect(actions.at(-1)).toBe('leave');
    // With one bot, leaving ends the game (the bot is the last one left), but the student still left.
    const judged = judgeCard101Game({ ...report(setup({ bots: 1 }), 10).report, actions, ending: 'abandoned' });
    expect(solo.game.phase).toBe('over');
    expect(judged).toEqual({ ok: true, game: expect.objectContaining({ reason: 'abandoned', countsForPoints: false, place: null }) });
  });

  it('refuses a changed game', () => {
    const { report: r } = report(setup());
    expect(judgeCard101Game({ ...r, actions: [...r.actions, 'knock'] }).ok).toBe(false);
    expect(judgeCard101Game({ ...r, actions: r.actions.slice(1) }).ok).toBe(false);
    expect(judgeCard101Game({ ...r, seed: r.seed.replace(/f$/, 'e') }).ok).toBe(false);
  });
});
