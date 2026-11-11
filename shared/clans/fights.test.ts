import { describe, expect, it } from 'vitest';
import { applyAction, type Action, type Applied, type Context, type OpenFight, type ServerState } from './actions';
import { botOrders } from './bot';
import { nextCryQuestion, replayFight, type CryAnswer, type RecordedRound } from './battleCry';
import { CONFIG } from './config';
import { startingDrafts } from './create';
import { DEFAULT_PRACTICAL_SETTINGS } from '../maths/practical';

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
const refused = (state: ServerState | null, action: Action, over: Partial<Context> = {}) => {
  const out = applyAction(state, action, ctx(over));
  expect(out.ok, JSON.stringify(action)).toBe(false);
  return out as Extract<Applied, { ok: false }>;
};
const start = (state: ServerState, depth = 1, boss = false) => ok(state, { type: 'fightStart', depth, boss });

/** The fight as the browser rebuilds it from what the server says is open. */
const rebuild = (state: ServerState) => {
  const f = state.fight as OpenFight;
  return replayFight(state.clan.members, f.depth, f.seed, f.boss, f.rounds, f.settings).state;
};

/** What a careful child does in the next round: the bot's orders, and the Battle Cry answered right (or wrong on purpose). */
function nextRound(state: ServerState, cryRight = true): RecordedRound {
  const f = state.fight as OpenFight;
  const local = rebuild(state);
  const q = nextCryQuestion(local, f.settings);
  const cry: CryAnswer | null = q ? { answer: cryRight ? q.answer : q.answer + 1, reward: local.clan.some((m) => m.hp < m.maxHp) ? 'heal' : 'damage' } : null;
  return { orders: botOrders(local), cry };
}
const roundAction = (state: ServerState, played: RecordedRound): Action => ({
  type: 'fightRound', round: (state.fight as OpenFight).rounds.length + 1, orders: played.orders, cry: played.cry,
});

describe('playing a fight through the server', () => {
  it('marks each Battle Cry answer itself: a wrong answer earns nothing, whatever reward was claimed', () => {
    const open = start(created(), 3).state;
    const cheat = nextRound(open, false);
    const none: RecordedRound = { orders: cheat.orders, cry: null };
    const withWrong = ok(open, roundAction(open, cheat)).state;
    const withNone = ok(open, roundAction(open, none)).state;
    expect(rebuild(withWrong)).toEqual(rebuild(withNone));
    expect(withWrong.clan).toEqual(withNone.clan);
    // A right answer is believed only because the server rebuilt the question and it matched.
    const right = nextRound(open, true);
    if (right.cry) expect(replayFight(open.clan.members, 3, (open.fight as OpenFight).seed, false, [right], DEFAULT_PRACTICAL_SETTINGS).cries[0].correct).toBe(true);
  });
});

describe('a fight is paid once', () => {
  it('refuses the same round twice, and a round out of order', () => {
    const open = start(created()).state;
    const played = nextRound(open);
    const next = ok(open, roundAction(open, played));
    if (!next.state.fight) return; // a one-round fight: nothing more to test
    expect(refused(next.state, { type: 'fightRound', round: 1, orders: played.orders, cry: played.cry }).why).toBe('stale-round');
    expect(refused(next.state, { type: 'fightRound', round: 3, orders: played.orders, cry: played.cry }).why).toBe('stale-round');
    expect(next.state.fight!.rounds).toHaveLength(1);
  });
});

describe('random play never breaks the rules', () => {
  it('keeps every number sensible over many fights with random orders and answers', () => {
    let s = created();
    let x = 12345;
    const rand = (n: number) => ((x = Math.imul(x, 1103515245) + 12345 & 0x7fffffff) % n);
    for (let fight = 0; fight < 60; fight++) {
      for (const m of s.clan.members) { m.knockedOut = false; m.hp = m.maxHp; m.sp = m.maxSp; }
      s.fightsLeft = CONFIG.fightsPerDay;
      s = ok(s, { type: 'fightStart', depth: rand(CONFIG.maxLevel + 1), boss: false }).state;
      while (s.fight) {
        const orders = s.clan.members.map(() => (rand(3) === 0 ? { action: 'guard' as const } : rand(9) === 0 ? { action: 'run' as const } : { action: 'attack' as const, target: rand(6) }));
        const cry = rand(2) === 0 ? null : { answer: rand(50), reward: rand(2) === 0 ? ('damage' as const) : ('heal' as const) };
        const out = applyAction(s, { type: 'fightRound', round: s.fight.rounds.length + 1, orders, cry }, ctx());
        if (!out.ok || !out.state) throw new Error('refused');
        s = out.state;
      }
      expect(s.clan.gold).toBeGreaterThanOrEqual(0);
      expect(s.clan.followers).toBeGreaterThanOrEqual(0);
      for (const m of s.clan.members) {
        expect(m.hp).toBeGreaterThanOrEqual(0);
        expect(m.hp).toBeLessThanOrEqual(m.maxHp);
        expect(m.points).toBeGreaterThanOrEqual(0);
        expect(m.level).toBeLessThanOrEqual(CONFIG.maxLevel);
      }
    }
  });
});
