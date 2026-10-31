import { describe, expect, it } from 'vitest';
import { applyAction, parseAction, type Action, type Applied, type Context, type OpenFight, type ServerState } from './actions';
import { botOrders } from './bot';
import { isLadderFight, playCryRound, replayFight, type CryAnswer, type RecordedRound } from './battleCry';
import { CONFIG } from './config';
import { startingDrafts } from './create';
import { newFight } from './fight';
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
const why = (state: ServerState, action: Action, over: Partial<Context> = {}) => {
  const out = applyAction(state, action, ctx(over));
  return out.ok ? 'ok' : out.why;
};
const fightOf = (s: ServerState) => s.fight as OpenFight;
const ladderStart = (s: ServerState) => ok(s, { type: 'fightStart', depth: 1, boss: false, ladder: true }).state;
const answerOf = (s: ServerState, round: number) => markQuestion(fightOf(s).questions![round - 1])!.answer;
const check = (s: ServerState, round: number, answer: number) => ok(s, { type: 'cryCheck', round, answer, ms: 4200 });
const localFight = (s: ServerState) => {
  const f = fightOf(s);
  return replayFight(s.clan.members, f.depth, f.seed, f.boss, f.rounds, f).state;
};
const round = (s: ServerState, cry: CryAnswer | null): Action => ({ type: 'fightRound', round: fightOf(s).rounds.length + 1, orders: botOrders(localFight(s)), cry });
/** A round where everyone guards, so the fight is still open afterwards (the bot can win in one round). */
const guardRound = (s: ServerState, cry: CryAnswer | null): Action => ({ type: 'fightRound', round: fightOf(s).rounds.length + 1, orders: localFight(s).clan.map(() => ({ action: 'guard' }) as const), cry });

describe('ladder fights: starting', () => {
  it('keeps one question a round, made from the child\'s maths, when the browser asks for a ladder fight', () => {
    const f = fightOf(ladderStart(created()));
    expect(f.questions).toHaveLength(CONFIG.maxRounds);
    expect(f.marks).toEqual([]);
    for (const q of f.questions!) expect(markQuestion(q)).not.toBeNull();
    expect(isLadderFight(f)).toBe(true);
  });

  it('makes the same questions for the same fight, so the server can always make them again', () => {
    const a = fightOf(ladderStart(created())).questions!;
    const b = fightOf(ladderStart(created())).questions!;
    expect(b).toEqual(a);
  });

  it('is an old-style fight when an older browser does not ask, or the child\'s maths could not be read', () => {
    expect(fightOf(ok(created(), { type: 'fightStart', depth: 1, boss: false }).state).questions).toBeUndefined();
    expect(fightOf(ok(created(), { type: 'fightStart', depth: 1, boss: false, ladder: true }, { maths: null }).state).questions).toBeUndefined();
    expect(fightOf(ok(created(), { type: 'fightStart', depth: 1, boss: false, ladder: true }, { maths: undefined }).state).questions).toBeUndefined();
  });

  it('reads the ladder flag and the check from what a browser sends, and nothing odd', () => {
    expect(parseAction({ type: 'fightStart', depth: 1, boss: false, ladder: true })).toEqual({ type: 'fightStart', depth: 1, boss: false, ladder: true });
    expect(parseAction({ type: 'fightStart', depth: 1, boss: false, ladder: 'yes' })).toEqual({ type: 'fightStart', depth: 1, boss: false });
    expect(parseAction({ type: 'cryCheck', round: 1, answer: 2.5, ms: 1234.6 })).toEqual({ type: 'cryCheck', round: 1, answer: 2.5, ms: 1235 });
    for (const bad of [
      { type: 'cryCheck', round: 0, answer: 1, ms: 1 },
      { type: 'cryCheck', round: Math.max(CONFIG.maxRounds, CONFIG.monster.rounds) + 1, answer: 1, ms: 1 },
      { type: 'cryCheck', round: 1, answer: 'twelve', ms: 1 },
      { type: 'cryCheck', round: 1, answer: Infinity, ms: 1 },
      { type: 'cryCheck', round: 1, answer: 1, ms: -5 },
      { type: 'cryCheck', round: 1, answer: 1 },
    ]) expect(parseAction(bad), JSON.stringify(bad)).toBeNull();
  });
});

describe('ladder fights: checking an answer', () => {
  it('marks a right answer, keeps the mark and hands the answer on for the child\'s own records', () => {
    const s = ladderStart(created());
    const right = answerOf(s, 1);
    const out = check(s, 1, right);
    expect(out.result).toEqual({ type: 'cryCheck', round: 1, correct: true, answer: right, given: right });
    expect(fightOf(out.state).marks).toEqual([{ answer: right, correct: true }]);
    expect(out.effects?.ladder?.answers).toEqual([{ key: fightOf(s).questions![0].factKey, correct: true, ms: 4200 }]);
    expect(out.effects?.ladder?.once).toBe(`clans:${fightOf(s).seed}:${fightOf(s).no}:1`);
    // Nothing goes in the old Clan Quest records.
    expect(out.effects?.answers).toBeUndefined();
  });

  it('marks a wrong answer, and gives the right one to show', () => {
    const s = ladderStart(created());
    const out = check(s, 1, answerOf(s, 1) + 1);
    expect(out.result).toEqual({ type: 'cryCheck', round: 1, correct: false, answer: answerOf(s, 1), given: answerOf(s, 1) + 1 });
    expect(out.effects?.ladder?.answers[0].correct).toBe(false);
  });

  it('takes one answer a question: asking again gives the first mark back and changes nothing', () => {
    const s = check(ladderStart(created()), 1, -1).state;
    const again = check(s, 1, answerOf(s, 1));
    expect(again.result).toMatchObject({ correct: false, given: -1 });
    expect(again.changed).toBe(false);
    expect(again.effects).toBeUndefined();
    expect(fightOf(again.state).marks).toEqual([{ answer: -1, correct: false }]);
  });

  it('refuses a check for any round but the next, in an old-style fight, or with no fight', () => {
    const s = ladderStart(created());
    expect(why(s, { type: 'cryCheck', round: 2, answer: 1, ms: 1 })).toBe('stale-round');
    const old = ok(created(), { type: 'fightStart', depth: 1, boss: false }).state;
    expect(why(old, { type: 'cryCheck', round: 1, answer: 1, ms: 1 })).toBe('no-question');
    expect(why(created(), { type: 'cryCheck', round: 1, answer: 1, ms: 1 })).toBe('no-fight');
  });
});

describe('ladder fights: playing rounds', () => {
  it('plays the bonus for a right, checked answer and counts it for fame', () => {
    let s = ladderStart(created());
    s = check(s, 1, answerOf(s, 1)).state;
    const out = ok(s, guardRound(s, { answer: answerOf(s, 1), reward: 'damage' }));
    expect(out.result).toMatchObject({ type: 'fightRound', round: 1 });
    expect('earned' in out.result && out.result.earned?.cries).toBe(1);
    expect(out.effects).toBeUndefined();
    const f = fightOf(out.state);
    const { cries } = replayFight(out.state.clan.members, f.depth, f.seed, f.boss, f.rounds, f);
    expect(cries[0]).toMatchObject({ answered: true, correct: true, cry: 'damage' });
  });

  it('gives no bonus for an answer the server never checked, a wrong one, or one that differs from the checked one', () => {
    const fresh = ladderStart(created());
    const noBonus = (s: ServerState, cry: CryAnswer) => {
      const out = ok(s, guardRound(s, cry));
      expect('earned' in out.result ? out.result.earned?.cries : undefined).toBeUndefined();
      const f = fightOf(out.state);
      expect(replayFight(out.state.clan.members, f.depth, f.seed, f.boss, f.rounds, f).cries[0].cry).toBeNull();
    };
    noBonus(fresh, { answer: answerOf(fresh, 1), reward: 'damage' });
    noBonus(check(fresh, 1, answerOf(fresh, 1) + 1).state, { answer: answerOf(fresh, 1), reward: 'damage' });
    noBonus(check(fresh, 1, answerOf(fresh, 1)).state, { answer: answerOf(fresh, 1) + 1, reward: 'damage' });
  });

  it('plays a whole ladder fight to the end and pays it, the browser\'s copy matching the server\'s round for round', () => {
    let s = ladderStart(created());
    const played: RecordedRound[] = [];
    let last: Extract<Applied, { ok: true }> | null = null;
    for (let r = 1; s.fight && r <= CONFIG.maxRounds; r++) {
      // Right on odd rounds, wrong on even ones, "No thanks" on the third.
      const answer = r % 2 ? answerOf(s, r) : answerOf(s, r) + 1;
      if (r !== 3) s = check(s, r, answer).state;
      const cry = r === 3 ? null : { answer, reward: 'damage' as const };
      const action = round(s, cry);
      played.push({ orders: (action as Extract<Action, { type: 'fightRound' }>).orders, cry });
      const marks = fightOf(s).marks;
      const out = ok(s, action);
      last = out;
      s = out.state;
      // What the browser does: the same rounds with the marks it was given.
      if (s.fight) expect(localFight(s)).toEqual(replayFight(s.clan.members, 1, fightOf(s).seed, false, played, { settings: fightOf(s).settings, questions: fightOf(s).questions, marks }).state);
    }
    expect(s.fight).toBeNull();
    expect(last?.result).toMatchObject({ type: 'fightRound', over: true });
  });

  it('still plays an old-style fight that was open when ladder fights arrived exactly as before', () => {
    const s = ok(created(), { type: 'fightStart', depth: 1, boss: false }).state;
    const f = fightOf(s);
    const local = newFight(s.clan.members, f.depth, f.seed, f.boss);
    const viaSettings = structuredClone(local);
    const viaFight = structuredClone(local);
    const orders = botOrders(local);
    expect(playCryRound(viaFight, f, orders, null)).toEqual(playCryRound(viaSettings, f.settings, orders, null));
    expect(viaFight).toEqual(viaSettings);
  });
});
