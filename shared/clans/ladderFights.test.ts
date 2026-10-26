import { describe, expect, it } from 'vitest';
import { applyAction, type Action, type Applied, type Context, type OpenFight, type ServerState } from './actions';
import { botOrders } from './bot';
import { replayFight, type CryAnswer } from './battleCry';
import { startingDrafts } from './create';
import { parseFocus } from '../maths/focus';
import { markQuestion, type MathsContext } from '../maths/serverQuestions';

const SEED = 123456;
const DAY0 = 20_000;
const MATHS: MathsContext = { facts: [], settings: { enabledTables: [2, 5, 10] }, focus: parseFocus(null) };
const ctx = (over: Partial<Context> = {}): Context => ({ seed: SEED, today: DAY0, maths: MATHS, ...over });

function created(): ServerState {
  const out = applyAction(null, { type: 'create', name: 'Red Banner', drafts: startingDrafts(SEED) }, ctx());
  if (!out.ok || !out.state) throw new Error('create failed');
  return out.state;
}
function ok(state: ServerState, action: Action, over: Partial<Context> = {}): Extract<Applied, { ok: true }> & { state: ServerState } {
  const out = applyAction(state, action, ctx(over));
  if (!out.ok || !out.state) throw new Error(`refused: ${out.ok ? '' : `${out.why}: ${out.say}`}`);
  return out as never;
}
const fightOf = (s: ServerState) => s.fight as OpenFight;
const ladderStart = (s: ServerState) => ok(s, { type: 'fightStart', depth: 1, boss: false, ladder: true }).state;
const answerOf = (s: ServerState, round: number) => markQuestion(fightOf(s).questions![round - 1])!.answer;
const check = (s: ServerState, round: number, answer: number) => ok(s, { type: 'cryCheck', round, answer, ms: 4200 });
const localFight = (s: ServerState) => {
  const f = fightOf(s);
  return replayFight(s.clan.members, f.depth, f.seed, f.boss, f.rounds, f).state;
};
const round = (s: ServerState, cry: CryAnswer | null): Action => ({ type: 'fightRound', round: fightOf(s).rounds.length + 1, orders: botOrders(localFight(s)), cry });

describe('ladder fights', () => {
  it('gives no bonus for an answer the server never checked, a wrong one, or one that differs from the checked one, and checks an answer once', () => {
    const fresh = ladderStart(created());
    const noBonus = (s: ServerState, cry: CryAnswer) => {
      const out = ok(s, round(s, cry));
      expect('earned' in out.result ? out.result.earned?.cries : undefined).toBeUndefined();
      const f = fightOf(out.state);
      expect(replayFight(out.state.clan.members, f.depth, f.seed, f.boss, f.rounds, f).cries[0].cry).toBeNull();
    };
    noBonus(fresh, { answer: answerOf(fresh, 1), reward: 'damage' });
    noBonus(check(fresh, 1, answerOf(fresh, 1) + 1).state, { answer: answerOf(fresh, 1), reward: 'damage' });
    noBonus(check(fresh, 1, answerOf(fresh, 1)).state, { answer: answerOf(fresh, 1) + 1, reward: 'damage' });
    // One answer a question: checking again gives the first mark back.
    const again = check(check(fresh, 1, -1).state, 1, answerOf(fresh, 1));
    expect(again.result).toMatchObject({ correct: false, given: -1 });
  });
});
