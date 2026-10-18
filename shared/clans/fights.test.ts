import { describe, expect, it } from 'vitest';
import { applyAction, parseAction, type Action, type Applied, type Context, type OpenFight, type ServerState } from './actions';
import { botOrders } from './bot';
import { nextCryQuestion, replayFight, type CryAnswer, type RecordedRound } from './battleCry';
import { gainXp } from './character';
import { CONFIG } from './config';
import { startingDrafts } from './create';
import { newFight, settle } from './fight';
import { fightSeed } from './play';
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

describe('starting a mine fight', () => {
  it('takes one fight off today, and picks the monsters from the clan seed and the fight number', () => {
    const s0 = created();
    const out = start(s0, 3);
    expect(out.result).toEqual({ type: 'fightStart', resumed: false });
    expect(out.state.fightsLeft).toBe(CONFIG.fightsPerDay - 1);
    expect(out.state.fightNo).toBe(1);
    expect(out.state.fight).toMatchObject({ depth: 3, boss: false, seed: fightSeed(SEED, 0), no: 1, rounds: [] });
    const direct = newFight(s0.clan.members, 3, fightSeed(SEED, 0));
    expect(rebuild(out.state).enemies.map((e) => [e.name, e.hp])).toEqual(direct.enemies.map((e) => [e.name, e.hp]));
  });

  it('gives each fight its own seed', () => {
    const first = playOut(start(created()).state).state;
    const second = start(first).state.fight as OpenFight;
    expect(second.seed).toBe(fightSeed(SEED, 1));
    expect(second.seed).not.toBe(fightSeed(SEED, 0));
  });

  it('shows the fight again, and uses no more fights, when it is started again (a refresh)', () => {
    const open = start(created(), 2).state;
    const again = ok(open, { type: 'fightStart', depth: 9, boss: false });
    expect(again.result).toEqual({ type: 'fightStart', resumed: true });
    expect(again.state.fightsLeft).toBe(open.fightsLeft);
    expect(again.state.fightNo).toBe(open.fightNo);
    expect(again.state.fight).toEqual(open.fight);
    expect(again.state.fight!.depth).toBe(2);
  });

  it('stops when the day\'s fights are used up', () => {
    let s = created();
    for (let i = 0; i < CONFIG.fightsPerDay; i++) {
      s = playOut(start(s).state).state;
      for (const m of s.clan.members) { m.knockedOut = false; m.hp = m.maxHp; }
    }
    expect(s.fightsLeft).toBe(0);
    expect(refused(s, { type: 'fightStart', depth: 1, boss: false }).why).toBe('fights');
  });

  it('will not start with everyone knocked out', () => {
    const s = created();
    for (const m of s.clan.members) { m.knockedOut = true; m.hp = 0; }
    expect(refused(s, { type: 'fightStart', depth: 1, boss: false }).why).toBe('resting');
  });

  it('will not fight a boss where there is none', () => {
    expect(refused(created(), { type: 'fightStart', depth: 1, boss: true }).why).toBe('boss');
    expect(start(created(), 5, true).state.fight?.boss).toBe(true);
  });

  it('needs a clan', () => {
    expect(refused(null, { type: 'fightStart', depth: 1, boss: false }).why).toBe('no-clan');
  });
});

describe('playing a fight through the server', () => {
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

  it('replays identically from its seed, every time', () => {
    const run = () => {
      const { state } = playOut(start(created(), 2).state);
      return state;
    };
    expect(run()).toEqual(run());
  });

  it('turns the same play into the same result on a second server (two Chromebooks agree)', () => {
    const a = start(created()).state;
    const b = structuredClone(a);
    const played = nextRound(a);
    expect(ok(a, roundAction(a, played)).state).toEqual(ok(b, roundAction(b, played)).state);
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

  it('keeps going with no questions when the teacher has every topic off', () => {
    const open = ok(created(), { type: 'fightStart', depth: 1, boss: false }, { settings: { ...DEFAULT_PRACTICAL_SETTINGS, enabledTopics: [] } }).state;
    expect(nextCryQuestion(rebuild(open), (open.fight as OpenFight).settings)).toBeNull();
    const done = playOut(open);
    expect(done.state.fight).toBeNull();
  });

  it('uses the maths settings the fight began with, even if the teacher changes them', () => {
    const open = ok(created(), { type: 'fightStart', depth: 1, boss: false }, { settings: { ...DEFAULT_PRACTICAL_SETTINGS, enabledTopics: [] } }).state;
    const played: RecordedRound = { orders: botOrders(rebuild(open)), cry: null };
    const later = ok(open, roundAction(open, played), { settings: DEFAULT_PRACTICAL_SETTINGS }).state;
    expect(later.fight!.settings.enabledTopics).toEqual([]);
  });

  it('survives hurt and knocked-out members: they are written back, and a won fight pays followers', () => {
    const { state, last } = playOut(start(created(), 1).state);
    const summary = (last.result as { summary: { result: string; followers: number } }).summary;
    if (summary.result === 'won') expect(summary.followers).toBeGreaterThan(0);
    for (const m of state.clan.members) expect(m.hp).toBeGreaterThanOrEqual(0);
  });
});

describe('a fight is paid once', () => {
  it('refuses another round once the fight has ended, and pays nothing more', () => {
    const { state, last } = playOut(start(created(), 2).state);
    const gold = state.clan.gold;
    const extra = refused(state, { type: 'fightRound', round: 1, orders: [], cry: null });
    expect(extra.why).toBe('no-fight');
    expect(state.clan.gold).toBe(gold);
    expect(last.result).toMatchObject({ over: true });
  });

  it('refuses the same round twice, and a round out of order', () => {
    const open = start(created()).state;
    const played = nextRound(open);
    const next = ok(open, roundAction(open, played));
    if (!next.state.fight) return; // a one-round fight: nothing more to test
    expect(refused(next.state, { type: 'fightRound', round: 1, orders: played.orders, cry: played.cry }).why).toBe('stale-round');
    expect(refused(next.state, { type: 'fightRound', round: 3, orders: played.orders, cry: played.cry }).why).toBe('stale-round');
    expect(next.state.fight!.rounds).toHaveLength(1);
  });

  it('cannot be re-played with other orders: the rounds already played are kept by the server', () => {
    const open = start(created(), 3).state;
    const first = ok(open, roundAction(open, nextRound(open))).state;
    if (!first.fight) return;
    const other: Action = { type: 'fightRound', round: 1, orders: [{ action: 'guard' }], cry: null };
    expect(refused(first, other).why).toBe('stale-round');
    expect(first.fight!.rounds).toHaveLength(1);
  });

  it('keeps a refused round from changing anything', () => {
    const open = start(created()).state;
    const before = structuredClone(open);
    refused(open, { type: 'fightRound', round: 2, orders: [], cry: null });
    expect(open).toEqual(before);
  });

  it('needs a fight to be open', () => {
    expect(refused(created(), { type: 'fightRound', round: 1, orders: [], cry: null }).why).toBe('no-fight');
  });

  it('a fight started after a finished one is a new fight, with a fight used for it', () => {
    const done = playOut(start(created()).state).state;
    for (const m of done.clan.members) { m.knockedOut = false; m.hp = m.maxHp; }
    const second = start(done).state;
    expect(second.fightsLeft).toBe(CONFIG.fightsPerDay - 2);
    expect(second.fight?.no).toBe(2);
  });
});

describe('a refresh in the middle of a fight', () => {
  it('shows the fight again exactly as it was, with no free retry and nothing lost', () => {
    let s = start(created(), 4).state;
    s = ok(s, roundAction(s, nextRound(s))).state;
    if (!s.fight) return;
    const reloaded = ok(s, { type: 'load' });
    expect(reloaded.state.fight).toEqual(s.fight);
    // The browser rebuilds the same fight from what is kept.
    expect(rebuild(reloaded.state)).toEqual(rebuild(s));
    const resumed = ok(reloaded.state, { type: 'fightStart', depth: 1, boss: false });
    expect(resumed.state.fightsLeft).toBe(CONFIG.fightsPerDay - 1);
    expect(resumed.state.fight).toEqual(s.fight);
  });

  it('ends the same way as a fight that was never interrupted', () => {
    const whole = playOut(start(created(), 3).state).state;
    let s = start(created(), 3).state;
    s = ok(s, roundAction(s, nextRound(s))).state;
    s = ok(s, { type: 'load' }).state;
    s = ok(s, { type: 'fightStart', depth: 3, boss: false }).state;
    expect(playOut(s).state).toEqual(whole);
  });

  it('works on another Chromebook: the saved copy is all it needs', () => {
    let s = start(created(), 2).state;
    s = ok(s, roundAction(s, nextRound(s))).state;
    const elsewhere = JSON.parse(JSON.stringify(s)) as ServerState;
    expect(playOut(elsewhere).state.fight).toBeNull();
  });
});

describe('while a fight is open', () => {
  const things: Action[] = [
    { type: 'buy', member: 0, item: 'Dagger' },
    { type: 'train', member: 0, key: 'strength', count: 1 },
    { type: 'wakeAll' },
    { type: 'deposit', gold: 10 },
    { type: 'quest', choice: 0, answer: null },
    { type: 'raid', kingdom: 'bunny-hollow', plan: { rounds: 3, push: 'steady', loot: 10 } },
    { type: 'draft' },
  ];
  it.each(things.map((a) => [a.type, a] as const))('refuses %s, because it would change the clan the fight is being replayed with', (_n, action) => {
    const open = start(created()).state;
    const out = refused(open, action);
    expect(out.why).toBe('fight-open');
    expect(out.say).toMatch(/middle of a fight/);
  });

  it('puts off the night\'s rest until the fight is over, then gives it once', () => {
    let s = start(created(), 2).state;
    s = ok(s, roundAction(s, nextRound(s)), { today: DAY0 + 1 }).state;
    if (s.fight) {
      expect(s.day).toBe(1);
      s = playOut(s).state;
    }
    expect(s.day).toBe(1);
    const next = ok(s, { type: 'load' }, { today: DAY0 + 1 });
    expect(next.state.day).toBe(2);
    expect(next.state.fightsLeft).toBe(CONFIG.fightsPerDay);
    expect(next.state.clan.members.every((m) => !m.knockedOut && m.hp === m.maxHp)).toBe(true);
    expect(ok(next.state, { type: 'load' }, { today: DAY0 + 1 }).changed).toBe(false);
  });

  it('lets a fight started yesterday be finished today without using another', () => {
    const open = start(created(), 2).state;
    const out = ok(open, { type: 'fightStart', depth: 2, boss: false }, { today: DAY0 + 1 });
    expect(out.result).toEqual({ type: 'fightStart', resumed: true });
    expect(out.state.fightsLeft).toBe(CONFIG.fightsPerDay - 1);
  });
});

describe('reading fight requests', () => {
  const good = { type: 'fightRound', round: 1, orders: [{ action: 'attack', target: 0 }, null, { action: 'guard' }], cry: { answer: 7, reward: 'damage' } };
  it('reads a good round, turning an empty order into none', () => {
    expect(parseAction(good)).toEqual({ type: 'fightRound', round: 1, orders: [{ action: 'attack', target: 0 }, undefined, { action: 'guard' }], cry: { answer: 7, reward: 'damage' } });
    expect(parseAction({ ...good, cry: null })).toMatchObject({ cry: null });
    expect(parseAction({ ...good, cry: { answer: null, reward: 'heal' } })).toMatchObject({ cry: { answer: null, reward: 'heal' } });
  });

  it('ignores extra things sent with a round, such as a result the browser would like to claim', () => {
    const parsed = parseAction({ ...good, result: 'won', gold: 99999, xp: [999], summary: { gold: 1e9 } });
    expect(parsed).toEqual(parseAction(good));
  });

  it.each([
    ['round 0', { ...good, round: 0 }],
    ['a round past the last', { ...good, round: CONFIG.maxRounds + 1 }],
    ['orders that are not a list', { ...good, orders: 'attack' }],
    ['more orders than members', { ...good, orders: Array(CONFIG.maxMembers + 1).fill({ action: 'guard' }) }],
    ['an order that does not exist', { ...good, orders: [{ action: 'surrender' }] }],
    ['an attack with a text target', { ...good, orders: [{ action: 'attack', target: 'all' }] }],
    ['a spell with no target', { ...good, orders: [{ action: 'spell', spell: 1 }] }],
    ['a reward that does not exist', { ...good, cry: { answer: 1, reward: 'gold' } }],
    ['an answer that is text', { ...good, cry: { answer: 'seven', reward: 'damage' } }],
    ['an infinite answer', { ...good, cry: { answer: Infinity, reward: 'damage' } }],
    ['a start with a depth too deep', { type: 'fightStart', depth: CONFIG.maxLevel + 1, boss: false }],
    ['a start with a negative depth', { type: 'fightStart', depth: -1, boss: false }],
    ['a start with no boss flag', { type: 'fightStart', depth: 1 }],
    ['a start with the boss flag as text', { type: 'fightStart', depth: 1, boss: 'yes' }],
  ])('refuses %s', (_why, raw) => {
    expect(parseAction(raw)).toBeNull();
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
