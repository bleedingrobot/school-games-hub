import { describe, expect, it } from 'vitest';
import { applyAction, type Action, type Applied, type Context, type OpenFight, type ServerState } from './actions';
import { botOrders } from './bot';
import { nextCryQuestion, replayFight, type RecordedRound } from './battleCry';
import { CONFIG } from './config';
import { startingDrafts } from './create';

const SEED = 123456;
const DAY0 = 20_000;
const ctx = (over: Partial<Context> = {}): Context => ({ seed: SEED, today: DAY0, ...over });

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

function nextRound(state: ServerState, cryRight = true): RecordedRound {
  const f = state.fight as OpenFight;
  const local = replayFight(state.clan.members, f.depth, f.seed, f.boss, f.rounds, f.settings).state;
  const q = nextCryQuestion(local, f.settings);
  return { orders: botOrders(local), cry: q ? { answer: cryRight ? q.answer : q.answer + 1, reward: 'damage' } : null };
}

/** Every request of a whole fight, in order, with the state each one left. */
function playFight(state: ServerState, depth: number, boss = false, cryRight = true) {
  let s = ok(state, { type: 'fightStart', depth, boss }).state;
  const steps: Extract<Applied, { ok: true }>[] = [];
  for (let i = 0; i < CONFIG.maxRounds + 2 && s.fight; i++) {
    const played = nextRound(s, cryRight);
    const step = ok(s, { type: 'fightRound', round: (s.fight as OpenFight).rounds.length + 1, orders: played.orders, cry: played.cry });
    steps.push(step);
    s = step.state!;
  }
  return { state: s, steps, last: steps[steps.length - 1] };
}

describe('what the rules say each action earned', () => {
  it('pays a won mine fight 1 win, a won boss 1 boss, and only counts right Battle Cry answers', () => {
    const won = playFight(created(), 0);
    expect(won.last.result).toMatchObject({ type: 'fightRound', over: true });
    const wins = won.steps.reduce((n, s) => n + ((s.result as { earned?: { wins: number } }).earned?.wins ?? 0), 0);
    const cries = won.steps.reduce((n, s) => n + ((s.result as { earned?: { cries: number } }).earned?.cries ?? 0), 0);
    expect(wins).toBe(1);
    expect(cries).toBeGreaterThan(0);
    // The wins come only in the request that ended the fight.
    expect(won.steps.slice(0, -1).every((s) => ((s.result as { earned?: { wins: number } }).earned?.wins ?? 0) === 0)).toBe(true);
    const wrong = playFight(created(), 0, false, false);
    const wrongCries = wrong.steps.reduce((n, s) => n + ((s.result as { earned?: { cries: number } }).earned?.cries ?? 0), 0);
    expect(wrongCries).toBe(0);
  });
});
