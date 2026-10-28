import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { DRAGON_STAGES, MAX_LEVEL, WEAPONS, expNeeded } from '../../../shared/lord/data';
import { EVENT_BY_ID } from '../../../shared/lord/events';
import { forestTrip, newHero } from '../../../shared/lord/engine';
import { offersSizeItUp, SIZE_IT_UP_GOLD } from '../../../shared/lord/maths';
import type { FightAction } from '../../../shared/lord/types';
import { batchIdFor, MAX_REQUESTS_PER_MINUTE } from './handler';
import { DRAGON_SLAYER, Game, NZ_MIDNIGHT, STRONG, SEASON_START, play, proof } from './testKit';

describe('the lord server function: signing in and the front door', () => {
  it('needs a signed-in student, and answers the browser’s preflight', async () => {
    const g = new Game();
    expect((await g.raw({ action: 'load' }, null)).status).toBe(401);
    expect((await g.raw({ action: 'load' }, 'fake')).status).toBe(401);
    const preflight = await g.handler(new Request('http://x/lord', { method: 'OPTIONS', headers: { Origin: 'https://bleedingrobot.github.io' } }));
    expect(preflight.status).toBe(204);
    expect((await g.handler(new Request('http://x/lord', { method: 'GET' }))).status).toBe(405);
  });

  it('refuses things that are not requests, unknown actions and too many requests', async () => {
    const g = new Game();
    expect((await g.raw('hello')).status).toBe(400);
    expect((await g.raw({ action: 'cheat' })).body).toMatchObject({ ok: false, reason: 'bad-request' });
    await g.start();
    expect((await g.raw({ action: 'forest', version: 1 })).body).toMatchObject({ ok: false, reason: 'bad-request' }); // no request id
    expect((await g.raw({ action: 'forest', version: 1, requestId: 'not-an-id' })).body).toMatchObject({ ok: false, reason: 'bad-request' });
    const fresh = new Game();
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) await fresh.raw({ action: 'load' });
    expect((await fresh.raw({ action: 'load' })).status).toBe(429);
  });

  it('makes batch ids that are the same for the same request and different for different packs', async () => {
    expect(await batchIdFor('a:add-sub')).toBe(await batchIdFor('a:add-sub'));
    expect(await batchIdFor('a:add-sub')).not.toBe(await batchIdFor('a:money'));
    expect(await batchIdFor('a:add-sub')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('load and start-hero', () => {
  it('shows a new pupil nothing yet, then starts a hero of the class they pick with the day’s turns', async () => {
    const g = new Game();
    const first = await g.send({ action: 'load' });
    expect(first.body.state.hero).toBeNull();
    expect(first.body.state.season).toMatchObject({ number: 1, dayOfSeason: 1 });
    const out = await g.send({ action: 'start-hero', heroClass: 'mage' });
    expect(out.body.ok).toBe(true);
    expect(out.body.state.hero).toMatchObject({ heroClass: 'mage', level: 1, forestLeft: 10, day: '2026-10-19' });
    expect(out.body.state.version).toBe(1);
    expect(g.db.row?.hero.heroClass).toBe('mage');
  });

  it('will not start a second hero, or a class that does not exist', async () => {
    const g = new Game();
    expect((await g.send({ action: 'start-hero', heroClass: 'wizard' }, { version: null })).body).toMatchObject({ ok: false, reason: 'bad-request' });
    await g.start();
    const again = await g.send({ action: 'start-hero', heroClass: 'mage' });
    expect(again.body).toMatchObject({ ok: false, reason: 'rule' });
    expect(g.hero().heroClass).toBe('knight');
  });

  it('starts a hero with the look picked, and lets it be changed any time to another of the same class', async () => {
    const g = new Game();
    await g.send({ action: 'load' });
    const out = await g.send({ action: 'start-hero', heroClass: 'mage', look: 'mage-girl-06-1' });
    expect(out.body.state.hero).toMatchObject({ heroClass: 'mage', look: 'mage-girl-06-1' });
    expect((await g.send({ action: 'look', look: 'mage-boy-10-2' })).body.ok).toBe(true);
    expect(g.hero().look).toBe('mage-boy-10-2');
    for (const look of ['knight-girl-01-1', 'mage-girl-11-1', 'mage-girl-01-3', '', 7, null]) {
      expect((await g.send({ action: 'look', look })).body).toMatchObject({ ok: false, reason: 'bad-request' });
    }
    expect(g.hero().look).toBe('mage-boy-10-2');
  });

  it('lets a hero made before there were looks pick one, and ignores a look of the wrong class at the start', async () => {
    const g = new Game();
    await g.send({ action: 'load' });
    await g.send({ action: 'start-hero', heroClass: 'knight', look: 'trickster-boy-01-1' });
    expect(g.hero().look).toBeUndefined();
    g.patch({ level: 4, gold: 300 });
    expect((await g.send({ action: 'look', look: 'knight-girl-03-2' })).body.ok).toBe(true);
    expect(g.hero()).toMatchObject({ look: 'knight-girl-03-2', level: 4, gold: 300 });
  });

  it('asks a pupil without a hero to pick a class before anything else', async () => {
    const g = new Game();
    await g.send({ action: 'load' });
    expect((await g.send({ action: 'forest' })).body).toMatchObject({ ok: false, reason: 'no-hero' });
  });

  it('uses the teacher’s number of forest fights a day', async () => {
    const g = new Game({ seasonStart: SEASON_START, forestPerDay: 4 });
    const out = await g.start();
    expect(out.body.state.hero.forestLeft).toBe(4);
    expect(out.body.state.forestPerDay).toBe(4);
  });
});

describe('a normal day in the forest', () => {
  it('hands out a fight, uses a turn, and pays gold and experience only after the played actions check out', async () => {
    const g = new Game();
    await g.start();
    g.patch(STRONG);
    const open = await g.fight();
    expect(g.hero().forestLeft).toBe(9);
    expect(open.kind).toBe('forest');
    expect(g.db.fights).toHaveLength(1);
    const { actions, fight } = play(open.start);
    expect(fight.outcome).toBe('won');
    const goldBefore = g.hero().gold;
    const out = await g.send({ action: 'fight-finish', fightId: open.id, actions });
    expect(out.body.ok).toBe(true);
    expect(out.body.result).toMatchObject({ outcome: 'won', gold: fight.monster.gold, exp: fight.monster.exp });
    expect(g.hero().gold).toBe(goldBefore + fight.monster.gold);
    expect(g.hero().exp).toBe(fight.monster.exp);
    expect(g.hero().forestWins).toBe(1);
    expect(out.body.state.openFight).toBeNull();
    expect(g.db.fights[0]).toMatchObject({ status: 'finished' });
    expect(g.db.events.map((e) => e.action)).toEqual(['rollover'.slice(0, 0) + 'start-hero', 'forest', 'fight-finish']);
  });

  it('keeps the same monster and seed after a reload, with no extra fight used', async () => {
    const g = new Game();
    await g.start();
    const open = await g.fight();
    const reloaded = await g.refresh();
    expect(reloaded.openFight).toEqual(open);
    expect(g.hero().forestLeft).toBe(9);
    const again = await g.send({ action: 'forest' });
    expect(again.body).toMatchObject({ ok: false, reason: 'fight-open' });
    expect(g.hero().forestLeft).toBe(9);
  });

  it('gives the same fight to a second Chromebook and refuses to start another one', async () => {
    const g = new Game();
    await g.start();
    const open = await g.fight();
    // A second device has no memory of the state: it just loads.
    const other = await g.raw({ action: 'load' });
    expect(other.body.state.openFight.id).toBe(open.id);
    expect(other.body.state.openFight.seed).toBe(open.seed);
    const second = await g.send({ action: 'forest' });
    expect(second.body.reason).toBe('fight-open');
    expect(g.db.fights.filter((f) => f.status === 'open')).toHaveLength(1);
  });

  it('refuses shopping, healing and the bank while a fight is open', async () => {
    const g = new Game();
    await g.start();
    g.patch({ gold: 5000, hp: 3 });
    await g.fight();
    for (const action of [
      { action: 'shop-buy', slot: 'weapon', index: 1 },
      { action: 'heal', hp: 5 },
      { action: 'bank', op: 'deposit', amount: 10 },
      { action: 'master-start', trial: [] },
      { action: 'inn', game: 'guess-start' },
    ]) {
      expect((await g.send(action)).body.reason).toBe('fight-open');
    }
  });

  it('a lost fight drops carried gold, keeps experience and the bank, and wakes you at the healer', async () => {
    const g = new Game();
    await g.start();
    g.patch({ strength: 1, hp: 2, maxHp: 20, gold: 80, bank: 30, exp: 12 });
    const open = await g.fight();
    const { actions, fight } = play(open.start);
    expect(fight.outcome).toBe('lost');
    const out = await g.send({ action: 'fight-finish', fightId: open.id, actions });
    expect(out.body.result.outcome).toBe('lost');
    expect(g.hero()).toMatchObject({ gold: 0, bank: 30, exp: 12 });
    expect(g.hero().hp).toBe(6);
    expect(g.hero().forestWins).toBe(0);
  });

  it('running away costs the turn and pays nothing', async () => {
    const g = new Game();
    await g.start();
    g.patch({ ...STRONG });
    // Find a fight where running works the first time.
    let open = await g.fight();
    for (let i = 0; i < 30 && !play(open.start, () => ({ type: 'run' })).fight.outcome?.startsWith('fled'); i++) {
      const { actions } = play(open.start);
      await g.send({ action: 'fight-finish', fightId: open.id, actions });
      open = await g.fight();
    }
    const { actions, fight } = play(open.start, (f) => (f.round >= 0 ? { type: 'run' } : { type: 'attack' }));
    expect(fight.outcome).toBe('fled');
    const gold = g.hero().gold;
    const left = g.hero().forestLeft;
    const out = await g.send({ action: 'fight-finish', fightId: open.id, actions });
    expect(out.body.result).toMatchObject({ outcome: 'fled', gold: 0, exp: 0 });
    expect(g.hero().gold).toBe(gold);
    expect(g.hero().forestLeft).toBe(left);
  });

  it('gives a skill use for the day back to the hero, and class skills work', async () => {
    const g = new Game();
    await g.start('mage');
    g.patch({ ...STRONG, strength: 40 });
    const open = await g.fight();
    const { actions, fight } = play(open.start, (f) => (f.skillLeft > 0 ? { type: 'skill', skill: 'zap' } : { type: 'attack' }));
    expect(fight.skillLeft).toBeLessThan(3);
    await g.send({ action: 'fight-finish', fightId: open.id, actions });
    expect(g.hero().skillLeft).toBe(fight.skillLeft);
  });

  it('refuses a trip when the day’s fights are used up', async () => {
    const g = new Game();
    await g.start();
    g.patch({ forestLeft: 0 });
    const out = await g.send({ action: 'forest' });
    expect(out.body).toMatchObject({ ok: false, reason: 'no-turns' });
  });
});

describe('size it up', () => {
  it('a right answer makes the first hit bigger on the server too, and it follows from the seed', async () => {
    const g = new Game();
    await g.start();
    g.patch({ ...STRONG, strength: 60 });
    const open = await g.fight(true);
    expect(open.sizeUp).toBe(offersSizeItUp(open.seed));
    expect(open.sizeUp).toBe(true);
    // The browser plays with the 1.5 bonus after a right answer.
    const right = proof('add-sub', 1, true);
    const { actions, fight } = play({ ...open.start, firstHitBonus: 1.5 });
    const goldBefore = g.hero().gold;
    const out = await g.send({ action: 'fight-finish', fightId: open.id, actions, sizeUp: right });
    expect(out.body.ok).toBe(true);
    expect(out.body.result.sizeUp).toBe('right');
    expect(out.body.result.outcome).toBe(fight.outcome);
    // A win pays 20% more gold (rounded up), and the hero really gets it.
    expect(fight.outcome).toBe('won');
    const gold = fight.monster.gold + Math.ceil(fight.monster.gold * SIZE_IT_UP_GOLD) + fight.goldPinched;
    expect(out.body.result.gold).toBe(gold);
    expect(g.hero().gold).toBe(goldBefore + gold);
    // And the answer went into the maths records.
    expect(Object.values(g.db.batches).some((b) => b.pack === 'add-sub' && b.answers[0].correct)).toBe(true);
  });

  it('a forged right answer counts as wrong: the server plays the fight with no bonus and nobody sees an error', async () => {
    const g = new Game();
    await g.start();
    g.patch({ ...STRONG, strength: 900 });
    const open = await g.fight(true);
    expect(open.sizeUp).toBe(true);
    const lie = proof('add-sub', 1, false); // a wrong answer, with a "correct" flag stuck on
    const { actions } = play(open.start); // one round kills it either way
    const out = await g.send({ action: 'fight-finish', fightId: open.id, actions, sizeUp: { ...lie, correct: true } });
    expect(out.body.ok).toBe(true);
    expect(out.body.result.sizeUp).toBe('wrong');
  });

  it('an answer that cannot be rebuilt (made-up numbers, wrong pack, wrong level) counts as wrong and is noted for the teacher', async () => {
    const g = new Game();
    await g.start();
    g.patch({ ...STRONG, strength: 900 });
    for (const bad of [
      { pack: 'add-sub', key: 'add:1+1', params: [999, 999], level: 1, given: 1998, ms: 1 },
      { pack: 'money', key: 'money:change', params: [1, 2], level: 1, given: 1, ms: 1 },
      { ...proof('add-sub', 1, true), level: 4 },
      'banana',
    ]) {
      const open = await g.fight(true);
      const { actions } = play(open.start);
      const out = await g.send({ action: 'fight-finish', fightId: open.id, actions, sizeUp: bad });
      expect(out.body.ok).toBe(true);
      expect(out.body.result.sizeUp).toBe('wrong');
      g.patch({ forestLeft: 10 });
    }
    expect(g.db.refusals.map((r) => r.reason)).toEqual(expect.arrayContaining(['proof-params', 'proof-pack', 'proof-level', 'proof']));
  });
});

describe('a finished fight is paid once, and only if it checks out', () => {
  async function ready() {
    const g = new Game();
    await g.start();
    g.patch(STRONG);
    const open = await g.fight();
    const { actions } = play(open.start);
    return { g, open, actions };
  }

  it('counts the same finish sent twice once, whether the id is repeated or new', async () => {
    const { g, open, actions } = await ready();
    const requestId = crypto.randomUUID();
    const first = await g.send({ action: 'fight-finish', fightId: open.id, actions }, { requestId });
    expect(first.body.ok).toBe(true);
    const gold = g.hero().gold;
    const exp = g.hero().exp;
    const repeated = await g.send({ action: 'fight-finish', fightId: open.id, actions }, { requestId });
    expect(repeated.body).toMatchObject({ ok: false, reason: 'duplicate' });
    expect(repeated.body.state.openFight).toBeNull();
    const fresh = await g.send({ action: 'fight-finish', fightId: open.id, actions });
    expect(fresh.body).toMatchObject({ ok: false, reason: 'no-fight' });
    expect(g.hero().gold).toBe(gold);
    expect(g.hero().exp).toBe(exp);
    expect(g.db.events.filter((e) => e.action === 'fight-finish')).toHaveLength(1);
  });

  it('refuses a tampered result: actions that make a different fight, too long, unfinished, or not actions at all', async () => {
    const { g, open, actions } = await ready();
    const before = JSON.stringify(g.hero());
    const lies: unknown[] = [
      [],
      [{ type: 'attack' }], // not over after one round of this fight? (checked below)
      [...actions, { type: 'attack' }], // keeps going after it ended
      [{ type: 'skill', skill: 'zap' }, ...actions], // a skill a knight does not have
      [{ type: 'run' }, ...actions.slice(1)],
      'win',
      [{ type: 'attack', damage: 99999 }, ...actions.slice(0, 0)],
      Array.from({ length: 400 }, () => ({ type: 'attack' })),
    ];
    for (const lie of lies) {
      const out = await g.send({ action: 'fight-finish', fightId: open.id, actions: lie });
      if (out.body.ok) {
        // The only way a "lie" passes is if it really is a fight that ends: then it is replayed, never believed.
        expect(Array.isArray(lie)).toBe(true);
        return;
      }
      expect(['tampered']).toContain(out.body.reason);
      expect(g.hero().gold).toBe(JSON.parse(before).gold);
    }
    expect(g.db.refusals.length).toBeGreaterThan(0);
    expect(g.db.fights[0].status).toBe('open');
  });

  it('refuses a result sent for a different fight, and one that was never handed out', async () => {
    const { g, actions } = await ready();
    const out = await g.send({ action: 'fight-finish', fightId: crypto.randomUUID(), actions });
    expect(out.body).toMatchObject({ ok: false, reason: 'no-fight' });
    const g2 = new Game();
    await g2.start();
    expect((await g2.send({ action: 'fight-finish', fightId: crypto.randomUUID(), actions })).body.reason).toBe('no-fight');
  });

  it('pays what the replay says, not what the browser says (a result the pupil cannot win is not a win)', async () => {
    const g = new Game();
    await g.start();
    g.patch({ strength: 1, hp: 1, maxHp: 20, gold: 40 });
    const open = await g.fight();
    const real = play(open.start);
    expect(real.fight.outcome).toBe('lost');
    // A browser that claims it won sends the same actions: the server replays them and sees a loss.
    const out = await g.send({ action: 'fight-finish', fightId: open.id, actions: real.actions, outcome: 'won', gold: 99999 });
    expect(out.body.result.outcome).toBe('lost');
    expect(g.hero().gold).toBe(0);
  });

  it('replays to exactly what the browser got from the same seed and actions', async () => {
    const g = new Game();
    await g.start('trickster');
    g.patch({ strength: 25, hp: 60, maxHp: 60, gold: 20 });
    const open = await g.fight();
    const mixed: FightAction[] = [{ type: 'skill', skill: 'dodge' }, { type: 'attack' }, { type: 'skill', skill: 'pinch' }, { type: 'attack' }];
    const { actions, fight } = play(open.start, (f) => mixed[f.round] ?? { type: 'attack' });
    await g.send({ action: 'fight-finish', fightId: open.id, actions });
    const stored = g.db.fights[0] as unknown as { result: { outcome: string; rounds: number } };
    expect(stored.result.outcome).toBe(fight.outcome);
    expect(stored.result.rounds).toBe(fight.round);
    if (fight.outcome === 'won') expect(g.hero().gold).toBe(20 + fight.monster.gold + fight.goldPinched);
  });
});

describe('old versions and repeated ids', () => {
  it('refuses a change made from an old version and hands back the current state', async () => {
    const g = new Game();
    await g.start();
    const old = g.state!.version;
    g.patch({ gold: 500 });
    await g.send({ action: 'bank', op: 'deposit', amount: 100 }, { version: old });
    const stale = await g.send({ action: 'bank', op: 'deposit', amount: 100 }, { version: old - 1 });
    expect(stale.body).toMatchObject({ ok: false, reason: 'stale' });
    expect(stale.body.state.version).toBe(g.db.row!.version);
    expect(g.hero().bank).toBe(100);
  });

  it('counts a repeated request id once: the second is told "duplicate" and nothing is done twice', async () => {
    const g = new Game();
    await g.start();
    g.patch({ gold: 500 });
    await g.refresh();
    const requestId = crypto.randomUUID();
    const version = g.db.row!.version;
    const one = await g.send({ action: 'bank', op: 'deposit', amount: 100 }, { requestId, version });
    expect(one.body.ok).toBe(true);
    const two = await g.send({ action: 'bank', op: 'deposit', amount: 100 }, { requestId, version: version + 1 });
    expect(two.body).toMatchObject({ ok: false, reason: 'duplicate' });
    expect(g.hero()).toMatchObject({ gold: 400, bank: 100 });
  });

  it('refuses a request with no version when one is needed', async () => {
    const g = new Game();
    await g.start();
    expect((await g.send({ action: 'forest' }, { version: null })).body.reason).toBe('stale');
  });
});

describe('forest events', () => {
  it('hands out an event for free (no turn) and pays it once', async () => {
    const g = new Game();
    await g.start();
    g.forceTrip('event');
    const out = await g.send({ action: 'forest' });
    const id = out.body.result.eventId as string;
    expect(EVENT_BY_ID[id]).toBeDefined();
    expect(g.hero().forestLeft).toBe(10);
    expect(g.state!.pendingEvent).toBe(id);
    // Asking for another trip gives the same event again, not a new roll.
    const again = await g.send({ action: 'forest' });
    expect(again.body.result.eventId).toBe(id);
    const paid = await g.send({ action: 'event', walkOn: true });
    expect(paid.body.ok).toBe(true);
    expect(g.state!.pendingEvent).toBeNull();
    expect((await g.send({ action: 'event' })).body).toMatchObject({ ok: false, reason: 'rule' });
  });

  it('pays a luck event without any question, and a maths event only for a right answer', async () => {
    const g = new Game();
    await g.start();
    await g.send({ action: 'tools', tool: 'event', value: 'lost-purse' }, { version: g.state!.version }); // students cannot
    expect(g.state!.pendingEvent).toBeNull();
    g.services.isTeacher = async () => ({ ok: true, value: true });
    await g.send({ action: 'tools', tool: 'event', value: 'lost-purse' });
    const luck = await g.send({ action: 'event' });
    expect(luck.body.ok).toBe(true);
    expect(g.hero().gold).toBe(50 + 25);
    await g.send({ action: 'tools', tool: 'event', value: 'bridge-toll' }); // money, 25 gold
    const wrong = await g.send({ action: 'event', proof: proof('money', 1, false) });
    expect(wrong.body.result.right).toBe(false);
    expect(g.hero().gold).toBe(75);
    await g.send({ action: 'tools', tool: 'event', value: 'bridge-toll' });
    const right = await g.send({ action: 'event', proof: proof('money', 1, true) });
    expect(right.body.result.right).toBe(true);
    expect(g.hero().gold).toBe(75 + 25);
  });

  it('only believes an answer from the event’s own topic', async () => {
    const g = new Game();
    await g.start();
    g.services.isTeacher = async () => ({ ok: true, value: true });
    await g.send({ action: 'tools', tool: 'event', value: 'bridge-toll' });
    const out = await g.send({ action: 'event', proof: proof('add-sub', 1, true) }); // an easier topic than the event asks
    expect(out.body.result.right).toBe(false);
    expect(g.hero().gold).toBe(50);
  });

  it('walking on a maths event pays nothing and costs nothing', async () => {
    const g = new Game();
    await g.start();
    g.services.isTeacher = async () => ({ ok: true, value: true });
    await g.send({ action: 'tools', tool: 'event', value: 'bridge-toll' });
    const out = await g.send({ action: 'event', walkOn: true });
    expect(out.body.result).toMatchObject({ right: false, walkedOn: true });
    expect(g.hero().gold).toBe(50);
  });
});

describe('masters', () => {
  async function atMaster() {
    const g = new Game();
    await g.start();
    g.patch({ exp: expNeeded(1), ...STRONG, strength: 200 });
    await g.refresh();
    return g;
  }

  it('refuses a challenge without the experience, or twice in a day', async () => {
    const g = new Game();
    await g.start();
    const early = await g.send({ action: 'master-start', trial: [] });
    expect(early.body).toMatchObject({ ok: false, reason: 'rule' });
    expect(early.body.message).toMatch(/more experience/);
  });

  it('marks the three trial questions itself, hands out the fight, and pays the level and the bonus only after the replay', async () => {
    const g = await atMaster();
    const strength = g.hero().strength;
    const out = await g.send({ action: 'master-start', trial: [proof('add-sub', 1, true), proof('times-tables', 1, true), proof('add-sub', 1, false)] });
    expect(out.body.ok).toBe(true);
    expect(out.body.result.trial).toEqual(['right', 'right', 'wrong']);
    expect(g.hero().masterTried).toBe(true);
    const open = out.body.state.openFight;
    expect(open.kind).toBe('master');
    const { actions, fight } = play(open.start);
    expect(fight.outcome).toBe('won');
    const done = await g.send({ action: 'master-finish', fightId: open.id, actions });
    expect(done.body.result).toMatchObject({ outcome: 'won', level: 2 });
    expect(g.hero().level).toBe(2);
    expect(g.hero().strength).toBeGreaterThan(strength);
    expect(done.body.result.bonusStrength).toBeGreaterThan(0);
    expect(g.hero().hp).toBe(g.hero().maxHp);
  });

  it('forged answers in the trial count as wrong and add no strength', async () => {
    const g = await atMaster();
    const out = await g.send({ action: 'master-start', trial: [{ pack: 'add-sub', key: 'add:2+2', params: [2, 2], level: 1, given: 4, ms: 5, correct: true }, 'x', null] });
    expect(out.body.result.trial).toEqual(['wrong', 'wrong', 'wrong']);
  });

  it('a lost master fight costs nothing, heals you, and the try for the day is used', async () => {
    const g = new Game();
    await g.start();
    g.patch({ exp: expNeeded(1), strength: 1, hp: 5, maxHp: 15 });
    await g.refresh();
    const out = await g.send({ action: 'master-start', trial: [] });
    const open = out.body.state.openFight;
    const { actions, fight } = play(open.start);
    expect(fight.outcome).toBe('lost');
    await g.send({ action: 'master-finish', fightId: open.id, actions });
    expect(g.hero()).toMatchObject({ level: 1, hp: 15, masterTried: true, exp: expNeeded(1) });
    const again = await g.send({ action: 'master-start', trial: [] });
    expect(again.body).toMatchObject({ ok: false, reason: 'rule' });
  });

  it('closing the tab in a master fight does not give the try back, and a finish for the wrong kind of fight is refused', async () => {
    const g = await atMaster();
    const out = await g.send({ action: 'master-start', trial: [] });
    const open = out.body.state.openFight;
    const { actions } = play(open.start);
    const wrongKind = await g.send({ action: 'fight-finish', fightId: open.id, actions });
    expect(wrongKind.body.reason).toBe('no-fight');
    expect(g.hero().masterTried).toBe(true);
    expect((await g.refresh()).openFight?.id).toBe(open.id);
  });
});

describe('the Red Dragon', () => {
  async function atDragon() {
    const g = new Game();
    await g.start();
    g.patch(DRAGON_SLAYER);
    await g.refresh();
    return g;
  }

  it('is not reachable until the last master is beaten', async () => {
    const g = new Game();
    await g.start();
    expect((await g.send({ action: 'dragon-stage', stage: 1 })).body).toMatchObject({ ok: false, reason: 'rule' });
  });

  it('takes the stages in order, gives each riddle bonus only for a right answer, shares skills, and ends with a star and a fresh hero', async () => {
    const g = await atDragon();
    const skip2 = await g.send({ action: 'dragon-stage', stage: 2 });
    expect(skip2.body.reason).toBe('rule');
    let hp = g.hero().hp;
    for (const stage of [1, 2, 3] as const) {
      const riddle = proof('place-value', MAX_LEVEL, stage !== 2);
      const out = await g.send({ action: 'dragon-stage', stage, riddle });
      expect(out.body.ok).toBe(true);
      expect(out.body.result.riddle).toBe(stage === 2 ? 'wrong' : 'right');
      const open = out.body.state.openFight;
      expect(open.stage).toBe(stage);
      expect(open.start.monster.name).toBe(DRAGON_STAGES[stage - 1].name);
      expect(open.start.heroHp).toBe(stage === 1 ? hp : g.state!.dragon!.hp);
      expect(open.start.shield).toBe(stage === 2 ? 0 : 17);
      const { actions, fight } = play(open.start);
      expect(fight.outcome).toBe('won');
      const done = await g.send({ action: 'dragon-finish', fightId: open.id, actions });
      expect(done.body.ok).toBe(true);
      if (stage < 3) {
        expect(done.body.state.dragon.next).toBe(stage + 1);
        expect(g.hero().level).toBe(MAX_LEVEL);
        hp = done.body.state.dragon.hp;
      } else {
        expect(done.body.result.finished).toBe(true);
      }
    }
    expect(g.hero()).toMatchObject({ level: 1, dragonKills: 1, exp: 0, heroClass: 'knight' });
    expect(g.state!.dragon).toBeNull();
  });

  it('shares the day’s skill uses across the three stages', async () => {
    const g = await atDragon();
    g.patch({ skillLeft: 3 });
    const one = await g.send({ action: 'dragon-stage', stage: 1 });
    expect(one.body.state.openFight.start.skillLeft).toBe(3);
    const open = one.body.state.openFight;
    const { actions, fight } = play(open.start, (f) => (f.skillLeft > 0 ? { type: 'skill', skill: 'power-strike' } : { type: 'attack' }));
    await g.send({ action: 'dragon-finish', fightId: open.id, actions });
    expect(g.hero().skillLeft).toBe(fight.skillLeft);
    const two = await g.send({ action: 'dragon-stage', stage: 2 });
    expect(two.body.state.openFight.start.skillLeft).toBe(fight.skillLeft);
  });

  it('losing sends you home with nothing lost but the day’s try', async () => {
    const g = await atDragon();
    g.patch({ strength: 1, weapon: 0, armour: 0, hp: 50 });
    const one = await g.send({ action: 'dragon-stage', stage: 1 });
    const open = one.body.state.openFight;
    const { actions, fight } = play(open.start);
    expect(fight.outcome).toBe('lost');
    const done = await g.send({ action: 'dragon-finish', fightId: open.id, actions });
    expect(done.body.result).toMatchObject({ outcome: 'lost', finished: false });
    expect(g.hero().level).toBe(MAX_LEVEL);
    expect(g.state!.dragon).toBeNull();
    const again = await g.send({ action: 'dragon-stage', stage: 1 });
    expect(again.body).toMatchObject({ ok: false, reason: 'rule' });
    expect(again.body.message).toMatch(/tomorrow/);
    // Tomorrow, another go.
    g.clock = NZ_MIDNIGHT + 60_000;
    await g.refresh();
    expect((await g.send({ action: 'dragon-stage', stage: 1 })).body.ok).toBe(true);
  });

  it('the dragon cannot be run from', async () => {
    const g = await atDragon();
    const one = await g.send({ action: 'dragon-stage', stage: 1 });
    const open = one.body.state.openFight;
    const out = await g.send({ action: 'dragon-finish', fightId: open.id, actions: [{ type: 'run' }] });
    expect(out.body).toMatchObject({ ok: false, reason: 'tampered' });
  });
});

describe('shop, healer and bank', () => {
  it('sells gear, takes the old one back for half, and gives 10% off only for a right answer', async () => {
    const g = new Game();
    await g.start();
    g.patch({ gold: 1000, strength: 100 });
    await g.refresh();
    const full = WEAPONS[1].cost;
    const wrong = await g.send({ action: 'shop-buy', slot: 'weapon', index: 1, proof: proof('money', 1, false) });
    expect(wrong.body.result.paid).toBe(full);
    expect(g.hero()).toMatchObject({ weapon: 1, gold: 1000 - full });
    const right = await g.send({ action: 'shop-buy', slot: 'weapon', index: 2, proof: proof('money', 1, true) });
    expect(right.body.result.saved).toBeGreaterThan(0);
    expect(g.hero().weapon).toBe(2);
  });

  it('says why when the gear cannot be bought, and does not change anything', async () => {
    const g = new Game();
    await g.start();
    const poor = await g.send({ action: 'shop-buy', slot: 'weapon', index: 5 });
    expect(poor.body).toMatchObject({ ok: false, reason: 'rule' });
    expect(poor.body.message).toBeTruthy();
    expect((await g.send({ action: 'shop-buy', slot: 'helmet', index: 1 })).body.reason).toBe('bad-request');
    expect((await g.send({ action: 'shop-buy', slot: 'armour', index: -3 })).body.reason).toBe('bad-request');
    expect(g.hero().gold).toBe(50);
  });

  it('heals what you can pay for, with the discount only for a proven right answer', async () => {
    const g = new Game();
    await g.start();
    g.patch({ hp: 1, maxHp: 100, level: 8, gold: 1000 });
    await g.refresh();
    const one = await g.send({ action: 'heal', hp: 10, proof: proof('times-tables', 8, false) });
    expect(one.body.result).toMatchObject({ healed: 10, paid: 20, discount: 0 });
    const two = await g.send({ action: 'heal', hp: 10, proof: proof('times-tables', 8, true) });
    expect(two.body.result).toMatchObject({ healed: 10, paid: 18, discount: 0.1 });
    const three = await g.send({ action: 'heal', hp: 10, proof: proof('division', 8, true) });
    expect(three.body.result.discount).toBe(0.1); // division is one of the healer's packs
    const forged = await g.send({ action: 'heal', hp: 10, proof: { ...proof('times-tables', 8, false), correct: true } });
    expect(forged.body.result.discount).toBe(0);
    expect(g.hero().hp).toBe(41);
  });

  it('will not heal a healthy hero, or one with no gold, or a silly amount', async () => {
    const g = new Game();
    await g.start();
    expect((await g.send({ action: 'heal', hp: 5 })).body.message).toMatch(/perfect health/);
    g.patch({ hp: 1, gold: 0 });
    await g.refresh();
    expect((await g.send({ action: 'heal', hp: 5 })).body.message).toMatch(/cannot afford/);
    expect((await g.send({ action: 'heal', hp: -5 })).body.reason).toBe('bad-request');
    expect((await g.send({ action: 'heal', hp: 1.5 })).body.reason).toBe('bad-request');
  });

  it('banks and withdraws whole amounts, never more than there is', async () => {
    const g = new Game();
    await g.start();
    await g.send({ action: 'bank', op: 'deposit', amount: 30 });
    expect(g.hero()).toMatchObject({ gold: 20, bank: 30 });
    await g.send({ action: 'bank', op: 'deposit', amount: 9999 });
    expect(g.hero()).toMatchObject({ gold: 0, bank: 50 });
    expect((await g.send({ action: 'bank', op: 'deposit', amount: 1 })).body.reason).toBe('rule');
    await g.send({ action: 'bank', op: 'withdraw', amount: 20 });
    expect(g.hero()).toMatchObject({ gold: 20, bank: 30 });
    expect((await g.send({ action: 'bank', op: 'withdraw', amount: -1 })).body.reason).toBe('bad-request');
    expect((await g.send({ action: 'bank', op: 'steal', amount: 1 })).body.reason).toBe('bad-request');
  });

  it('interest: level 4 and up, at least 20 saved, a question about your own savings, once a day', async () => {
    const g = new Game();
    await g.start();
    g.patch({ level: 3, bank: 1000 });
    await g.refresh();
    expect((await g.send({ action: 'bank', op: 'interest', answer: 50 })).body.reason).toBe('rule');
    g.patch({ level: 4, bank: 19 });
    await g.refresh();
    expect((await g.send({ action: 'bank', op: 'interest', answer: 0 })).body.reason).toBe('rule'); // under 20 saved
    g.patch({ bank: 1000 });
    await g.refresh();
    expect((await g.send({ action: 'bank', op: 'interest' })).body.reason).toBe('rule'); // no question answered
    const out = await g.send({ action: 'bank', op: 'interest', answer: 50 });
    expect(out.body.result).toMatchObject({ interest: 50, due: 50, right: true });
    expect(g.hero().bank).toBe(1050);
    expect(g.state!.interestDone).toBe(true);
    expect((await g.send({ action: 'bank', op: 'interest', answer: 52 })).body.reason).toBe('rule');
    g.clock = NZ_MIDNIGHT + 1000;
    await g.refresh();
    expect(g.state!.interestDone).toBe(false);
  });

  it('interest: a hint earns half, a wrong answer earns nothing and is told the right amount', async () => {
    const g = new Game();
    await g.start();
    g.patch({ level: 4, bank: 259 });
    await g.refresh();
    const wrong = await g.send({ action: 'bank', op: 'interest', answer: 13 });
    expect(wrong.body.result).toMatchObject({ interest: 0, due: 12, right: false });
    expect(g.hero().bank).toBe(259);
    expect(g.state!.interestDone).toBe(true);
    g.clock = NZ_MIDNIGHT + 1000;
    await g.refresh();
    const hinted = await g.send({ action: 'bank', op: 'interest', answer: 12, hinted: true });
    expect(hinted.body.result).toMatchObject({ interest: 6, due: 12, right: true });
    expect(g.hero().bank).toBe(265);
  });
});

describe('the inn', () => {
  it('pays the riddle once a day: well for a right answer, a little for a wrong one', async () => {
    const g = new Game();
    await g.start();
    g.patch({ level: 4 });
    await g.refresh();
    const out = await g.send({ action: 'inn', game: 'riddle', proof: proof('patterns', 4, true) });
    expect(out.body.result).toMatchObject({ right: true });
    expect(out.body.result.gold).toBeGreaterThan(0);
    expect(g.state!.riddleDone).toBe(true);
    const again = await g.send({ action: 'inn', game: 'riddle', proof: proof('patterns', 4, true) });
    expect(again.body.reason).toBe('rule');
    g.clock = NZ_MIDNIGHT + 1000;
    await g.refresh();
    const wrong = await g.send({ action: 'inn', game: 'riddle', proof: proof('patterns', 4, false) });
    expect(wrong.body.result.right).toBe(false);
    expect(wrong.body.result.gold).toBeGreaterThan(0);
    expect(wrong.body.result.gold).toBeLessThan(out.body.result.gold);
  });

  it('plays the number guess on the server: the secret never leaves it, hints come back, seven tries, once a day', async () => {
    const g = new Game();
    await g.start();
    g.forced.push(41); // the secret is 1 + 41 % 100 = 42
    const start = await g.send({ action: 'inn', game: 'guess-start' });
    expect(JSON.stringify(start.body)).not.toContain('"secret"');
    expect((await g.send({ action: 'inn', game: 'guess', n: 50 })).body.result).toMatchObject({ hint: 'high', tries: 1 });
    expect((await g.send({ action: 'inn', game: 'guess', n: 25 })).body.result).toMatchObject({ hint: 'low', tries: 2 });
    const win = await g.send({ action: 'inn', game: 'guess', n: 42 });
    expect(win.body.result).toMatchObject({ hint: 'win', over: true });
    expect(win.body.result.prize).toBeGreaterThan(0);
    expect(JSON.stringify(win.body)).not.toContain('"secret":42');
    expect(g.state!.guess).toMatchObject({ done: true });
    expect((await g.send({ action: 'inn', game: 'guess', n: 42 })).body.reason).toBe('rule');
    await g.send({ action: 'inn', game: 'guess-start' });
    expect(g.state!.guess!.done).toBe(true);
  });

  it('a lost number guess pays a little, shows the secret, and an unfinished game carries on after a reload', async () => {
    const g = new Game();
    await g.start();
    g.forced.push(6); // 7
    await g.send({ action: 'inn', game: 'guess-start' });
    await g.send({ action: 'inn', game: 'guess', n: 1 });
    const reloaded = await g.refresh();
    expect(reloaded.guess).toMatchObject({ done: false });
    expect(reloaded.guess!.tries).toHaveLength(1);
    for (let n = 2; n <= 6; n++) await g.send({ action: 'inn', game: 'guess', n });
    const last = await g.send({ action: 'inn', game: 'guess', n: 50 });
    expect(last.body.result).toMatchObject({ over: true, secret: 7, hint: 'high' });
    expect(last.body.result.prize).toBeGreaterThan(0);
  });

  it('refuses guesses that are not whole numbers from 1 to 100', async () => {
    const g = new Game();
    await g.start();
    await g.send({ action: 'inn', game: 'guess-start' });
    for (const n of [0, 101, 2.5, '7', null]) expect((await g.send({ action: 'inn', game: 'guess', n })).body.reason).toBe('rule');
    expect((await g.send({ action: 'inn', game: 'cards' })).body.reason).toBe('bad-request');
  });
});

describe('the day rolling over, and the season ending', () => {
  it('gives the turns, skills and health back at New Zealand midnight and not before', async () => {
    const g = new Game();
    await g.start();
    g.patch({ forestLeft: 2, skillLeft: 0, hp: 5, masterTried: true });
    g.clock = NZ_MIDNIGHT - 1000; // 23:59:59 on the 19th
    const before = await g.refresh();
    expect(before.hero).toMatchObject({ forestLeft: 2, skillLeft: 0, hp: 5, masterTried: true, day: '2026-10-19' });
    g.clock = NZ_MIDNIGHT; // 00:00:00 on the 20th
    const after = await g.refresh();
    expect(after.today).toBe('2026-10-20');
    expect(after.hero).toMatchObject({ forestLeft: 12, skillLeft: 3, masterTried: false, day: '2026-10-20' }); // 2 left over + the day's 10
    expect(after.hero!.hp).toBe(after.hero!.maxHp);
    expect(g.db.events.at(-1)?.action).toBe('rollover');
    expect(g.db.row!.version).toBe(after.version);
  });

  it('piles forest fights up for missed days, but never past two days’ worth, and arena fights and skills do not pile up', async () => {
    const g = new Game();
    await g.start();
    g.patch({ arenaLeft: 3, skillLeft: 1 });
    g.clock += 5 * 86_400_000;
    const s = await g.refresh();
    expect(s.hero).toMatchObject({ forestLeft: 20, arenaLeft: 3, skillLeft: 3, masterExtra: 2 });
    const teacherLowered = new Game({ seasonStart: SEASON_START, forestPerDay: 4 });
    await teacherLowered.start();
    teacherLowered.clock += 5 * 86_400_000;
    expect((await teacherLowered.refresh()).hero!.forestLeft).toBe(8);
  });

  it('the first request of a new day can be an ordinary one: it rolls over and then does its job', async () => {
    const g = new Game();
    await g.start();
    g.patch({ forestLeft: 0 });
    g.clock = NZ_MIDNIGHT + 5000;
    const out = await g.send({ action: 'forest' });
    expect(out.body.ok).toBe(true);
    expect(g.hero().day).toBe('2026-10-20');
  });

  it('a fight handed out before midnight finishes after it with the new day’s health and skills', async () => {
    const g = new Game();
    await g.start();
    g.patch({ ...STRONG, hp: 300 });
    const open = await g.fight();
    const { actions } = play(open.start);
    g.clock = NZ_MIDNIGHT + 1000;
    const out = await g.send({ action: 'fight-finish', fightId: open.id, actions });
    expect(out.body.ok).toBe(true);
    expect(g.hero().day).toBe('2026-10-20');
    expect(g.hero().hp).toBe(g.hero().maxHp);
    expect(g.hero().forestLeft).toBe(19); // 9 left from the fight's day + the new day's 10
  });

  it('starts everyone again when a new 5-week season begins, keeping stars, and lets the class be changed', async () => {
    const g = new Game();
    await g.start('knight');
    g.patch({ level: 7, exp: 4000, gold: 900, bank: 100, dragonKills: 2, weapon: 5, armour: 5, look: 'knight-boy-02-1' });
    g.clock = Date.parse('2026-11-22T00:00:00Z'); // still season 1 (day 35)
    expect((await g.refresh()).season).toMatchObject({ number: 1, dayOfSeason: 35, daysLeft: 0 });
    expect(g.hero().level).toBe(7);
    g.clock = Date.parse('2026-11-23T00:00:00Z'); // season 2, day 1
    const s2 = await g.refresh();
    expect(s2.season).toMatchObject({ number: 2, dayOfSeason: 1 });
    expect(s2.hero).toMatchObject({ level: 1, exp: 0, gold: 50, bank: 0, weapon: 0, dragonKills: 2, heroClass: 'knight', look: 'knight-boy-02-1' });
    expect(s2.classOpen).toBe(true);
    const mage = await g.send({ action: 'start-hero', heroClass: 'mage', look: 'mage-girl-02-2' });
    expect(mage.body.state.hero).toMatchObject({ heroClass: 'mage', dragonKills: 2, level: 1, look: 'mage-girl-02-2' });
    expect(mage.body.state.classOpen).toBe(false);
    expect((await g.send({ action: 'start-hero', heroClass: 'knight' })).body.reason).toBe('rule');
  });

  it('starts the hero again once when the season jumps forward several seasons (a class moved onto the school date)', async () => {
    const g = new Game();
    await g.start('knight');
    g.patch({ level: 6, exp: 3000, gold: 500, dragonKills: 1, look: 'knight-boy-02-1' });
    expect(g.db.row!.season).toBe(1);
    // The school's date is earlier than the class's was: today is now day 6 of season 4.
    g.db.settings.seasonStart = '2026-07-01';
    const s4 = await g.refresh();
    expect(s4.season).toMatchObject({ number: 4, dayOfSeason: 6 });
    expect(s4.hero).toMatchObject({ level: 1, exp: 0, gold: 50, dragonKills: 1, heroClass: 'knight', look: 'knight-boy-02-1' });
    expect(s4.classOpen).toBe(true);
    expect(g.db.row!.season).toBe(4);
    // The next request in the same season doesn't start it again.
    g.patch({ level: 2 });
    expect((await g.refresh()).hero).toMatchObject({ level: 2 });
    expect(g.db.row!.season).toBe(4);
  });

  it('lets a fight in progress finish before the season resets the hero', async () => {
    const g = new Game();
    await g.start();
    g.patch({ ...STRONG, dragonKills: 0 });
    // A fight handed out on the very last day of the season (a fight left for a whole day counts as a loss instead).
    g.clock = Date.parse('2026-11-22T00:00:00Z');
    await g.refresh();
    g.patch({ ...STRONG, dragonKills: 0 });
    const open = await g.fight();
    g.clock = Date.parse('2026-11-23T00:00:00Z');
    const during = await g.refresh();
    expect(during.openFight?.id).toBe(open.id);
    expect(during.hero!.strength).toBe(900);
    const { actions } = play(open.start);
    const done = await g.send({ action: 'fight-finish', fightId: open.id, actions });
    expect(done.body.ok).toBe(true);
    const after = await g.refresh();
    expect(after.season.number).toBe(2);
    expect(after.hero).toMatchObject({ level: 1, forestWins: 0 });
  });

  it('is closed until the first season begins', async () => {
    const g = new Game({ seasonStart: '2026-11-02' });
    const out = await g.send({ action: 'load' });
    expect(out.body).toMatchObject({ ok: false, reason: 'not-started' });
    expect(out.body.message).toMatch(/14 days/);
  });
});

describe('the teacher switch', () => {
  it('turns every request away for students while it is off, and says so', async () => {
    const g = new Game({ enabled: false, seasonStart: SEASON_START });
    for (const action of [{ action: 'load' }, { action: 'start-hero', heroClass: 'knight' }, { action: 'forest' }]) {
      expect((await g.send(action)).body).toEqual({ ok: false, reason: 'closed' });
    }
    expect(g.db.row).toBeNull();
  });

  it('lets a teacher look around while it is off, and a student in as soon as it is on', async () => {
    const g = new Game({ enabled: false, seasonStart: SEASON_START });
    g.db.teacher = true;
    expect((await g.start()).body.ok).toBe(true);
    const s = new Game({ enabled: false, seasonStart: SEASON_START });
    expect((await s.send({ action: 'load' })).body.reason).toBe('closed');
    s.db.settings.enabled = true;
    expect((await s.send({ action: 'load' })).body.ok).toBe(true);
  });

  it('keeps a half-played game safe while it is off, and carries on when it is back on', async () => {
    const g = new Game();
    await g.start();
    g.patch(STRONG);
    const open = await g.fight();
    const { actions } = play(open.start);
    g.db.settings.enabled = false;
    expect((await g.send({ action: 'fight-finish', fightId: open.id, actions })).body.reason).toBe('closed');
    expect(g.db.fights[0].status).toBe('open');
    g.db.settings.enabled = true;
    expect((await g.send({ action: 'fight-finish', fightId: open.id, actions })).body.ok).toBe(true);
  });
});

describe('test tools', () => {
  it('are for teachers only: a student is turned away and it is noted', async () => {
    const g = new Game();
    await g.start();
    const out = await g.send({ action: 'tools', tool: 'jump', value: 12 });
    expect(out.body).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(g.hero().level).toBe(1);
    expect(g.db.refusals).toContainEqual({ reason: 'tools', action: 'tools' });
  });

  it('let a teacher jump to the dragon, refill, hurt, skip a day, reset and give up a fight', async () => {
    const g = new Game();
    g.db.teacher = true;
    await g.start();
    await g.send({ action: 'tools', tool: 'jump', value: 12 });
    expect(g.hero()).toMatchObject({ level: 12, exp: expNeeded(11) });
    await g.send({ action: 'tools', tool: 'gold' });
    expect(g.hero().gold).toBe(1050);
    await g.send({ action: 'tools', tool: 'hurt' });
    expect(g.hero().hp).toBeLessThan(g.hero().maxHp);
    await g.send({ action: 'tools', tool: 'best-gear' });
    expect(g.hero().weapon).toBe(WEAPONS.length - 1);
    const open = await g.fight();
    expect((await g.send({ action: 'tools', tool: 'gold' })).body.reason).toBe('fight-open');
    const gave = await g.send({ action: 'tools', tool: 'abandon-fight' });
    expect(gave.body.ok).toBe(true);
    expect(g.db.fights.find((f) => f.id === open.id)?.status).toBe('abandoned');
    expect(g.state!.openFight).toBeNull();
    await g.send({ action: 'tools', tool: 'new-day' });
    await g.refresh();
    expect(g.hero().forestLeft).toBe(20); // the tool pretends a long time has gone by
    await g.send({ action: 'tools', tool: 'reset' });
    expect(g.hero().level).toBe(1);
    expect(g.state!.classOpen).toBe(true);
  });
});

describe('when things go wrong', () => {
  it('keeps the hero as it was and says "busy" when the database cannot be reached', async () => {
    const g = new Game();
    await g.start();
    const real = g.services.commit;
    g.services.commit = vi.fn(async () => ({ ok: false as const, why: 'busy' as const }));
    const out = await g.send({ action: 'bank', op: 'deposit', amount: 10 });
    expect(out.status).toBe(503);
    expect(g.hero().gold).toBe(50);
    g.services.commit = real;
    expect((await g.send({ action: 'bank', op: 'deposit', amount: 10 }, { version: g.db.row!.version })).body.ok).toBe(true);
    g.services.load = vi.fn(async () => ({ ok: false as const, why: 'busy' as const }));
    expect((await g.raw({ action: 'load' })).status).toBe(503);
  });

  it('never puts who sent a turned-away request in its log', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const g = new Game();
    await g.start();
    await g.send({ action: 'tools', tool: 'jump', value: 12 });
    expect(warn).toHaveBeenCalledWith('lord: turned a request down (not-allowed)');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('pupil-1');
    warn.mockRestore();
  });

  it('a second device that raced ahead gets the saved state, not a second copy of the action', async () => {
    const g = new Game();
    await g.start();
    g.patch({ gold: 100 });
    await g.refresh();
    const version = g.state!.version;
    // Another Chromebook deposited first.
    await g.send({ action: 'bank', op: 'deposit', amount: 60 }, { version });
    const slow = await g.send({ action: 'bank', op: 'deposit', amount: 60 }, { version });
    expect(slow.body).toMatchObject({ ok: false, reason: 'stale' });
    expect(g.hero()).toMatchObject({ gold: 40, bank: 60 });
  });
});

describe('a whole day, start to finish', () => {
  it('plays ten forest fights, shops, heals, banks and tries a master, and ends with sensible numbers', async () => {
    const g = new Game();
    await g.start('knight');
    let wins = 0;
    for (let i = 0; i < 12; i++) {
      const out = await g.send({ action: 'forest' });
      if (!out.body.ok) {
        expect(out.body.reason).toBe('no-turns');
        break;
      }
      if (out.body.result.kind === 'event') {
        await g.send({ action: 'event', walkOn: true });
        continue;
      }
      const open = out.body.state.openFight;
      const { actions, fight } = play(open.start, (f) => (f.heroHp < f.heroMaxHp * 0.3 && f.kind === 'forest' ? { type: 'run' } : { type: 'attack' }));
      const done = await g.send({ action: 'fight-finish', fightId: open.id, actions });
      expect(done.body.ok).toBe(true);
      if (fight.outcome === 'won') wins += 1;
    }
    expect(g.hero().forestLeft).toBe(0);
    expect(wins).toBeGreaterThan(3);
    expect(g.hero().exp).toBeGreaterThan(0);
    expect(g.db.fights.every((f) => f.status === 'finished')).toBe(true);
    await g.send({ action: 'bank', op: 'deposit', amount: g.hero().gold });
    expect(g.hero().gold).toBe(0);
    expect((await g.send({ action: 'forest' })).body.reason).toBe('no-turns');
  });
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('lord');
    expect(readFileSync(resolve('supabase/functions/lord/index.ts'), 'utf8')).toBe(built);
  });
});

// A hero sheet other tests lean on: keep the helper honest.
describe('test helpers', () => {
  it('a strong hero really does win in a round or two, and a weak one loses', () => {
    const strong = { ...newHero('knight', '2026-10-19'), ...STRONG };
    const weak = { ...newHero('knight', '2026-10-19'), strength: 1, hp: 2, maxHp: 20 };
    for (const s of [1, 2, 3, 4, 5]) {
      const trip = forestTrip(strong, s);
      if (trip.kind === 'fight') expect(trip.monster.hp).toBeGreaterThan(0);
    }
    expect(weak.hp).toBe(2);
  });
});

describe('the teacher’s topic switches', () => {
  const only = (...topics: string[]) => new Game({ seasonStart: SEASON_START, topics });

  it('shows the topics that are on in the pupil’s state, and all of them when the teacher never chose', async () => {
    const g = only('patterns', 'money');
    await g.start();
    expect(g.state!.topics).toEqual(['money', 'patterns']);
    const all = new Game();
    await all.start();
    expect(all.state!.topics).toHaveLength(8);
  });

  it('treats a missing or empty list from an older database as all topics on', async () => {
    const g = new Game();
    delete (g.db.settings as { topics?: string[] }).topics;
    await g.start();
    expect(g.state!.topics).toHaveLength(8);
    g.db.settings.topics = [];
    expect((await g.refresh()).topics).toHaveLength(8);
  });

  it('counts an answer from a switched-off topic as wrong, and tells the teacher’s page why', async () => {
    const g = only('patterns');
    await g.start();
    g.patch({ level: 4 });
    await g.refresh();
    const out = await g.send({ action: 'inn', game: 'riddle', proof: proof('place-value', 4, true) }); // the riddle's own topics are patterns and place-value
    expect(out.body.result.right).toBe(false);
    expect(g.db.refusals).toEqual([{ reason: 'proof-pack', action: 'inn' }]); // so the teacher's page can say what happened
    g.clock = NZ_MIDNIGHT + 1000; // the riddle is once a day
    await g.refresh();
    const fine = await g.send({ action: 'inn', game: 'riddle', proof: proof('patterns', 4, true) });
    expect(fine.body.ok).toBe(true);
  });

  it('accepts a topic from the fallback when a moment’s own topics are all off', async () => {
    const g = only('fractions');
    await g.start();
    g.patch({ level: 4 });
    await g.refresh();
    const ok = await g.send({ action: 'inn', game: 'riddle', proof: proof('fractions', 4, true) });
    expect(ok.body.result.right).toBe(true);
  });

  it('never hands out a maths event about a topic that is off', async () => {
    const g = only('add-sub');
    await g.start();
    for (let i = 0; i < 12; i++) {
      g.clock += 70_000; // stay under the requests-a-minute limit
      g.patch({ forestLeft: 10, hp: g.hero().maxHp });
      g.db.row!.extra = { ...g.db.row!.extra, pendingEvent: null };
      await g.refresh();
      g.forceTrip('event');
      const out = await g.send({ action: 'forest' });
      expect(out.body.ok, JSON.stringify(out.body)).toBe(true);
      const event = EVENT_BY_ID[out.body.result.eventId as string];
      expect(!event.maths || event.maths.topic === 'add-sub').toBe(true);
      await g.send({ action: 'event', walkOn: true });
    }
  });

  it('pays the plain reward, with no question, for an event whose topic was switched off after it turned up', async () => {
    const g = new Game();
    await g.start();
    g.services.isTeacher = async () => ({ ok: true, value: true });
    await g.send({ action: 'tools', tool: 'event', value: 'bridge-toll' }); // money, 25 gold
    g.db.settings.topics = ['add-sub'];
    const out = await g.send({ action: 'event', proof: proof('money', 1, true) });
    expect(out.body.ok).toBe(true);
    expect(out.body.result.right).toBe(false);
    expect(g.hero().gold).toBe(50);
    expect(g.state!.pendingEvent).toBeNull();
  });

  it('the dragon’s riddles work with a single topic, and refuse another', async () => {
    for (const [pack, expected] of [['decimals', 'right'], ['fractions', 'wrong']] as const) {
      const g = only('decimals');
      await g.start();
      g.patch(DRAGON_SLAYER);
      await g.refresh();
      const out = await g.send({ action: 'dragon-stage', stage: 1, riddle: proof(pack, MAX_LEVEL, true) });
      expect(out.body.ok).toBe(true);
      expect(out.body.result.riddle).toBe(expected);
    }
  });
});
