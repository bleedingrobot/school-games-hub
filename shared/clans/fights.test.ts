import { describe, expect, it } from 'vitest';
import { applyAction, type Action, type Applied, type Context, type OpenFight, type ServerState } from './actions';
import { botOrders } from './bot';
import { nextCryQuestion, replayFight, type CryAnswer, type RecordedRound } from './battleCry';
import { gainXp } from './character';
import { CONFIG } from './config';
import { startingDrafts } from './create';
import { settle } from './fight';
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

/** Plays a started fight to its end through the server rules. */
function playOut(state: ServerState, cryRight = true) {
  let s = state;
  let last: Extract<Applied, { ok: true }> | null = null;
  for (let i = 0; i < CONFIG.maxRounds + 2 && s.fight; i++) {
    last = ok(s, roundAction(s, nextRound(s, cryRight)));
    s = last.state!;
  }
  if (s.fight) throw new Error('the fight never ended');
  return { state: s, last: last! };
}

/** The same fight played in the browser on its own copy, the way the test page does it. */
function playLocally(state: ServerState, rounds: RecordedRound[]) {
  const f = state.fight as OpenFight;
  const clan = structuredClone(state.clan);
  const { state: fs } = replayFight(clan.members, f.depth, f.seed, f.boss, rounds, f.settings);
  const levels = settle(clan.members, fs, gainXp);
  clan.gold += fs.gold;
  clan.followers += fs.followers;
  return { clan, fs, levels };
}

describe('mine fights through the server rules', () => {
  it('stops when the day\'s fights are used up', () => {
    let s = created();
    for (let i = 0; i < CONFIG.fightsPerDay; i++) {
      s = playOut(start(s).state).state;
      for (const m of s.clan.members) { m.knockedOut = false; m.hp = m.maxHp; }
    }
    expect(s.fightsLeft).toBe(0);
    expect(refused(s, { type: 'fightStart', depth: 1, boss: false }).why).toBe('fights');
  });

  it('gives exactly the result the browser\'s own engine gives for the same recording, and pays it', () => {
    const open = start(created(), 2).state;
    const recorded: RecordedRound[] = [];
    let s = open;
    let paid: Extract<Applied, { ok: true }> | null = null;
    while (s.fight) {
      const played = nextRound(s);
      recorded.push(played);
      paid = ok(s, roundAction(s, played));
      s = paid.state!;
    }
    const mine = playLocally(open, recorded);
    expect(s.clan).toEqual(mine.clan);
    expect(paid!.result).toMatchObject({ type: 'fightRound', over: true, summary: { result: mine.fs.result, gold: mine.fs.gold, followers: mine.fs.followers, xp: mine.fs.xp, levels: mine.levels } });
    expect(s.fight).toBeNull();
  });

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
