import { describe, expect, it } from 'vitest';
import { applyAction, catchUp, clanDay, parseAction, type Action, type Applied, type Context, type ServerState } from './actions';
import { shopPrice, examineCost } from './character';
import { CONFIG } from './config';
import { MAX_ROLLS, makeClan, slotSeed, startingDrafts } from './create';
import { battle, empireOf, fixedPlan, kingdomById, kingdomSide, needsUpgrade, sideOf } from './empire';
import { ITEMS } from './gamedata';
import { raidSeed } from './play';
import { QUESTS, buildPuzzle, puzzleFor, todaysQuest } from './quests';
import type { SeasonClock } from './season';
import { DEFAULT_PRACTICAL_SETTINGS } from '../maths/practical';

const SEED = 123456;
const DAY0 = 20_000;
const ctx = (over: Partial<Context> = {}): Context => ({ seed: SEED, today: DAY0, ...over });
const choices = (seed = SEED) => ({ name: 'Red Banner', drafts: startingDrafts(seed) });

function created(over: Partial<Context> = {}): ServerState {
  const out = applyAction(null, { type: 'create', ...choices() }, ctx(over));
  if (!out.ok || !out.state) throw new Error('create failed');
  return out.state;
}
/** Apply and expect it to work. */
function ok(state: ServerState, action: Action, over: Partial<Context> = {}): Extract<Applied, { ok: true }> & { state: ServerState } {
  const out = applyAction(state, action, ctx(over));
  if (!out.ok || !out.state) throw new Error(`refused: ${out.ok ? '' : out.say}`);
  return out as never;
}
const refused = (state: ServerState | null, action: Action, over: Partial<Context> = {}) => {
  const out = applyAction(state, action, ctx(over));
  expect(out.ok, JSON.stringify(action)).toBe(false);
  return out as Extract<Applied, { ok: false }>;
};
const rich = (state: ServerState, gold = 5000): ServerState => {
  const s = structuredClone(state);
  s.clan.gold = gold;
  return s;
};
/** A clan with 5000 gold and a Barracks (level 1) built the proper way. */
const withBarracks = (state: ServerState): ServerState => {
  const s = rich(state);
  return ok(s, { type: 'upgrade', building: 'barracks' }).state;
};

describe('reading an action', () => {
  it.each([
    ['not an object', 'buy'],
    ['an array', []],
    ['no type', {}],
    ['an unknown type', { type: 'giveGold', gold: 100 }],
    ['a member that is not there', { type: 'wake', member: 6 }],
    ['a negative member', { type: 'wake', member: -1 }],
    ['a fractional member', { type: 'wake', member: 1.5 }],
    ['the old deposit', { type: 'deposit', gold: 100 }],
    ['the old develop', { type: 'develop', width: 3, length: 3 }],
    ['the old claim, build, draft, chest and vote', { type: 'claim' }],
    ['an old build', { type: 'build', plot: 0, kind: 'barracks' }],
    ['the old draft', { type: 'draft' }],
    ['an old setDraft', { type: 'setDraft', percent: 10 }],
    ['the old chest', { type: 'chestGive', gold: 10 }],
    ['the old vote', { type: 'vote', kind: 'church' }],
    ['an unknown stat', { type: 'train', member: 0, key: 'luck', count: 1 }],
    ['a count of zero', { type: 'train', member: 0, key: 'agility', count: 0 }],
    ['an unknown building', { type: 'upgrade', building: 'castle' }],
    ['a building that was an old one', { type: 'upgrade', building: 'steelMill' }],
    ['a missing troop kind', { type: 'buyTroops', mix: { footman: 1, axeman: 1 } }],
    ['negative troops', { type: 'buyTroops', mix: { footman: -5, axeman: 0, knight: 0 } }],
    ['an unknown push', { type: 'raid', kingdom: 'bunny-hollow', push: 'reckless' }],
    ['no push', { type: 'war', kingdom: 'bunny-hollow' }],
    ['an answer that is not a number', { type: 'quest', choice: 0, answer: 'seven' }],
    ['an infinite answer', { type: 'quest', choice: 0, answer: Infinity }],
  ])('refuses %s', (_why, raw) => {
    expect(parseAction(raw)).toBeNull();
  });

  it('reads good actions and ignores extra things sent with them', () => {
    expect(parseAction({ type: 'wake', member: 2, gold: 9999, hp: 1000 })).toEqual({ type: 'wake', member: 2 });
    expect(parseAction({ type: 'quest', choice: 1 })).toEqual({ type: 'quest', choice: 1, answer: null });
    expect(parseAction({ type: 'train', member: 0, key: 'hp', count: 3 })).toEqual({ type: 'train', member: 0, key: 'hp', count: 3 });
    expect(parseAction({ type: 'upgrade', building: 'strongroom', gold: 1 })).toEqual({ type: 'upgrade', building: 'strongroom' });
    // Only the push is chosen: rounds and loot sent by a browser are ignored.
    expect(parseAction({ type: 'raid', kingdom: 'ironwood', push: 'bold', plan: { rounds: 5, loot: 20 }, rounds: 5, loot: 20 })).toEqual({ type: 'raid', kingdom: 'ironwood', push: 'bold' });
  });
});

describe('making a clan', () => {
  it('builds the same clan the creator showed, from the choices and the seed alone', () => {
    const state = created();
    expect(state.clan).toEqual(makeClan('Red Banner', startingDrafts(SEED)));
    expect(state).toMatchObject({ seed: SEED, day: 1, createdNzDay: DAY0, fightsLeft: CONFIG.fightsPerDay, fightNo: 0, raidNo: 0 });
  });

  it('keeps "Roll again" repeatable: the same rolls give the same member, other rolls give a different one', () => {
    const drafts = startingDrafts(SEED).map((d) => ({ ...d, rolls: 2 }));
    const a = applyAction(null, { type: 'create', name: 'Red Banner', drafts }, ctx());
    const b = applyAction(null, { type: 'create', name: 'Red Banner', drafts }, ctx());
    expect(a).toEqual(b);
    expect(a.ok && a.state!.clan.members).not.toEqual(created().clan.members);
  });

  it('ignores stats, gold and seeds the browser makes up', () => {
    const drafts = startingDrafts(SEED).map((d, i) => ({ ...d, seed: 999 + i, stats: { strength: 60 }, hp: 999 }));
    const out = applyAction(null, { type: 'create', name: 'Red Banner', drafts: drafts as never }, ctx());
    expect(out.ok && out.state!.clan).toEqual(created().clan);
    expect(out.ok && out.state!.clan.members.map((m) => m.stats.strength)).not.toContain(60);
  });

  it('uses the server seed for every slot', () => {
    const state = created();
    const direct = makeClan('Red Banner', startingDrafts(SEED).map((d, i) => ({ ...d, seed: slotSeed(SEED, i) })));
    expect(state.clan.members).toEqual(direct.members);
  });

  it.each([
    ['a name that is not from the lists', { name: 'Doom Lords' }],
    ['a name with words added', { name: 'Red Banner Extra' }],
    ['three members', { drafts: startingDrafts(SEED).slice(0, 3) }],
    ['five members', { drafts: [...startingDrafts(SEED), startingDrafts(SEED)[0]] }],
    ['too many rolls', { drafts: startingDrafts(SEED).map((d) => ({ ...d, rolls: MAX_ROLLS + 1 })) }],
    ['a negative roll', { drafts: startingDrafts(SEED).map((d) => ({ ...d, rolls: -1 })) }],
    ['a race that does not exist', { drafts: startingDrafts(SEED).map((d) => ({ ...d, race: 'Dragon' })) }],
    ['a class that does not exist', { drafts: startingDrafts(SEED).map((d) => ({ ...d, cls: 'Hacker' })) }],
    ['a member name nobody can pick', { drafts: startingDrafts(SEED).map((d) => ({ ...d, name: 'Mr Typed Name' })) }],
  ])('refuses %s', (_why, change) => {
    const out = applyAction(null, { type: 'create', ...choices(), ...change } as Action, ctx());
    expect(out.ok).toBe(false);
  });

  it('refuses made-up names while the teacher switch is off, and takes checked ones (tidied) when it is on', () => {
    const typed = startingDrafts(SEED).map((d, i) => (i === 0 ? { ...d, name: '  te ahi ' } : d));
    expect(applyAction(null, { type: 'create', ...choices(), drafts: typed } as Action, ctx()).ok).toBe(false);
    const out = applyAction(null, { type: 'create', ...choices(), drafts: typed } as Action, ctx({ typedNames: true }));
    expect(out.ok && out.state!.clan.members[0].name).toBe('Te Ahi');
    // Every member is saved with its look, so it stays the same if a teacher later swaps the name for a list name.
    expect(out.ok && out.state!.clan.members[0].look).toBeDefined();
  });

  it.each([
    ['a rude made-up name', 'Fuuuck'],
    ['numbers in a name', 'Bob99'],
    ['a name that is too long', 'Abcdefghijklm'],
    ['a name that is too short', 'A'],
  ])('refuses %s even with the switch on', (_why, name) => {
    const drafts = startingDrafts(SEED).map((d, i) => (i === 0 ? { ...d, name } : d));
    expect(applyAction(null, { type: 'create', ...choices(), drafts } as Action, ctx({ typedNames: true })).ok).toBe(false);
  });

  it('refuses two members with the same name, whatever the capitals', () => {
    const first = startingDrafts(SEED)[0].name;
    const drafts = startingDrafts(SEED).map((d, i) => (i === 1 ? { ...d, name: first.toUpperCase() } : d));
    const out = applyAction(null, { type: 'create', ...choices(), drafts } as Action, ctx({ typedNames: true }));
    expect(out.ok).toBe(false);
  });

  it('refuses a second clan', () => {
    expect(refused(created(), { type: 'create', ...choices() }).why).toBe('exists');
  });

  it('refuses everything else until there is a clan, and "load" simply says there is none', () => {
    expect(refused(null, { type: 'wakeAll' }).why).toBe('no-clan');
    expect(applyAction(null, { type: 'load' }, ctx())).toMatchObject({ ok: true, state: null });
  });
});

describe('days', () => {
  it('counts New Zealand days from the first one', () => {
    expect(clanDay(DAY0, DAY0)).toBe(1);
    expect(clanDay(DAY0, DAY0 + 6)).toBe(7);
    expect(clanDay(DAY0, DAY0 - 3)).toBe(1);
  });

  it('gives the night\'s rest when a new day starts, once', () => {
    let s = created();
    s.clan.members[1].knockedOut = true;
    s.clan.members[1].hp = 0;
    s.clan.wakesToday = 3;
    s.fightsLeft = 0;
    empireOf(s.clan).buildsToday = 2;
    empireOf(s.clan).kingdomRaidsToday = 1;
    const out = ok(s, { type: 'load' }, { today: DAY0 + 1 });
    expect(out.changed).toBe(true);
    expect(out.state.day).toBe(2);
    expect(out.state.clan.members[1]).toMatchObject({ knockedOut: false, hp: out.state.clan.members[1].maxHp });
    expect(out.state.clan.wakesToday).toBe(0);
    expect(out.state.fightsLeft).toBe(CONFIG.fightsPerDay);
    expect(empireOf(out.state.clan)).toMatchObject({ day: 2, buildsToday: 0, kingdomRaidsToday: 0 });
    s = out.state;
    expect(ok(s, { type: 'load' }, { today: DAY0 + 1 }).changed).toBe(false);
  });

  it('after a week away: one night\'s rest, and today\'s number', () => {
    const out = ok(created(), { type: 'load' }, { today: DAY0 + 9 });
    expect(out.state.day).toBe(10);
    expect(empireOf(out.state.clan).day).toBe(10);
  });

  it('never changes the state it is given', () => {
    const s = created();
    s.clan.members[2].knockedOut = true;
    s.clan.gold = 20;
    const before = structuredClone(s);
    ok(s, { type: 'wakeAll' }, { today: DAY0 });
    refused(s, { type: 'upgrade', building: 'walls' }, { today: DAY0 });
    expect(s).toEqual(before);
    const t = structuredClone(s);
    expect(catchUp(t, DAY0 + 2)).toBe(true);
    expect(catchUp(t, DAY0 + 2)).toBe(false);
  });

  it('a refusal on a new day does not save the rest either (the next request catches up again)', () => {
    const s = created();
    s.clan.gold = 5;
    const out = refused(s, { type: 'upgrade', building: 'walls' }, { today: DAY0 + 1 });
    expect(out.why).toBe('gold');
  });
});

describe('the shop, Training Hall and Church', () => {
  it('buys at the true price with the village tax, and puts the item on the member', () => {
    const s = created();
    const item = ITEMS.find((i) => i.price > 0 && i.price <= 150 && i.shopLevel >= 6)!;
    const out = ok(s, { type: 'buy', member: 1, item: item.name });
    expect(out.state.clan.gold).toBe(s.clan.gold - shopPrice(item));
    expect(out.state.clan.members[1].gear[item.kind]).toBe(item.name);
  });

  it('refuses to buy with too little gold, an item that is not there, a member that is not there, or one the shop does not sell yet', () => {
    const s = created();
    const dear = ITEMS.filter((i) => i.shopLevel >= 6).sort((a, b) => b.price - a.price)[0];
    const poor = structuredClone(s);
    poor.clan.gold = shopPrice(dear) - 1;
    expect(refused(poor, { type: 'buy', member: 0, item: dear.name }).why).toBe('gold');
    expect(refused(s, { type: 'buy', member: 0, item: 'Sword of Anything' }).why).toBe('item');
    expect(refused(rich(s), { type: 'buy', member: 5, item: dear.name }).why).toBe('member');
    const secret = ITEMS.find((i) => i.shopLevel < 6)!;
    expect(refused(rich(s), { type: 'buy', member: 0, item: secret.name }).why).toBe('shelf');
  });

  it('charges to look closely, and keeps one record of who looked at what', () => {
    const s = created();
    const item = ITEMS.find((i) => i.shopLevel >= 6 && examineCost(i) < 100)!;
    const once = ok(s, { type: 'examine', member: 0, item: item.name });
    const twice = ok(once.state, { type: 'examine', member: 0, item: item.name });
    expect(once.state.examined).toEqual([`${s.clan.members[0].name}|${item.name}`]);
    expect(twice.state.examined).toHaveLength(1);
    expect(twice.state.clan.gold).toBe(s.clan.gold - 2 * examineCost(item));
  });

  it('trains with points, stops at the points it has, and refuses when there are none', () => {
    const s = created();
    expect(refused(s, { type: 'train', member: 0, key: 'agility', count: 1 }).why).toBe('points');
    s.clan.members[0].points = 7;
    const out = ok(s, { type: 'train', member: 0, key: 'agility', count: 100 });
    expect(out.state.clan.members[0].stats.agility).toBe(s.clan.members[0].stats.agility + 2);
    expect(out.state.clan.members[0].points).toBe(1);
  });

  it('wakes: the first wake-up each day is free, the next costs gold, and a member who is awake is refused', () => {
    const s = created();
    s.clan.members[1].knockedOut = true;
    s.clan.members[2].knockedOut = true;
    const first = ok(s, { type: 'wake', member: 1 });
    expect(first.state.clan.gold).toBe(s.clan.gold);
    const second = ok(first.state, { type: 'wake', member: 2 });
    expect(second.state.clan.gold).toBe(s.clan.gold - (s.clan.members[2].level + 1) * CONFIG.churchPerLevel);
    expect(refused(second.state, { type: 'wake', member: 2 }).why).toBe('awake');
    const poor = structuredClone(first.state);
    poor.clan.gold = 0;
    expect(refused(poor, { type: 'wake', member: 2 }).why).toBe('gold');
  });

  it('wakes everyone or nobody', () => {
    const s = created();
    for (const i of [1, 2, 3]) s.clan.members[i].knockedOut = true;
    const poor = structuredClone(s);
    poor.clan.gold = 5;
    expect(refused(poor, { type: 'wakeAll' }).why).toBe('gold');
    expect(poor.clan.members.filter((m) => m.knockedOut)).toHaveLength(3);
    const out = ok(s, { type: 'wakeAll' });
    expect(out.state.clan.members.some((m) => m.knockedOut)).toBe(false);
    expect(refused(out.state, { type: 'wakeAll' }).why).toBe('awake');
  });
});

describe('the village', () => {
  it('upgrades a building from the purse, 2 a day, and refuses anything the rules refuse', () => {
    const s = rich(created(), 5000);
    const first = ok(s, { type: 'upgrade', building: 'smithy' });
    expect(first.result).toEqual({ type: 'upgrade', building: 'smithy', level: 1 });
    expect(first.state.clan.gold).toBe(5000 - CONFIG.empire.buildings.smithy.base);
    expect(first.state.clan.village.smithy).toBe(1);
    expect(empireOf(first.state.clan)).toMatchObject({ buildsToday: 1 });
    const second = ok(first.state, { type: 'upgrade', building: 'tower' });
    expect(refused(second.state, { type: 'upgrade', building: 'walls' }).why).toBe('builds');
    expect(ok(second.state, { type: 'upgrade', building: 'walls' }, { today: DAY0 + 1 }).ok).toBe(true);
    const poor = created();
    poor.clan.gold = 20;
    expect(refused(poor, { type: 'upgrade', building: 'forge' }, {}).why).toBe('gold');
    const top = structuredClone(s);
    empireOf(top.clan).levels.church = 3;
    expect(refused(top, { type: 'upgrade', building: 'church' }).why).toBe('max');
  });

  it('is refused while a fight is open', () => {
    const s = rich(created());
    s.fight = { depth: 0, boss: false, seed: 1, no: 1, settings: {} as never, rounds: [] };
    expect(refused(s, { type: 'upgrade', building: 'forge' }).why).toBe('fight-open');
  });

  it('the Training Hall, Smithy and Church read the new levels', () => {
    const s = rich(created());
    const item = ITEMS.find((i) => i.shopLevel === 0)!;
    expect(refused(s, { type: 'buy', member: 0, item: item.name }).why).toBe('shelf');
    const t = structuredClone(s);
    empireOf(t.clan).levels.smithy = 6;
    expect(ok(t, { type: 'buy', member: 0, item: item.name }).ok).toBe(true);
  });

  it('buys troops from the purse as far as the barracks have room, refusing anything the rules refuse', () => {
    const s = created();
    const b = withBarracks(s);
    expect(empireOf(b.clan).levels.barracks).toBe(1);
    const bought = ok(b, { type: 'buyTroops', mix: { footman: 5, axeman: 2, knight: 0 } });
    expect(empireOf(bought.state.clan).troops).toEqual({ footman: 5, axeman: 2, knight: 0 });
    expect(bought.state.clan.gold).toBe(b.clan.gold - 5 * 15 - 2 * 30);
    expect(refused(b, { type: 'buyTroops', mix: { footman: 21, axeman: 0, knight: 0 } }).why).toBe('room');
    expect(refused(s, { type: 'buyTroops', mix: { footman: 1, axeman: 0, knight: 0 } }).why).toBe('room');
    expect(refused(b, { type: 'buyTroops', mix: { footman: 0, axeman: 0, knight: 0 } }).why).toBe('amount');
  });

  it('buys a whole mix or none of it', () => {
    const b = withBarracks(created());
    b.clan.gold = 30;
    const before = structuredClone(b);
    refused(b, { type: 'buyTroops', mix: { footman: 1, axeman: 0, knight: 5 } });
    expect(b).toEqual(before);
  });

  it('gives each raid its seed from the server and checks the result: the same one the engine gives', () => {
    const s = withBarracks(created());
    empireOf(s.clan).troops = { footman: 20, axeman: 10, knight: 5 };
    const out = ok(s, { type: 'raid', kingdom: 'bunny-hollow', push: 'steady' });
    const expected = battle(sideOf(empireOf(s.clan)), kingdomSide(kingdomById('bunny-hollow')!), fixedPlan('steady'), raidSeed(SEED, 0));
    expect(out.result).toMatchObject({ type: 'raid', friendly: false, result: expected });
    expect(expected.plan).toEqual({ rounds: 3, push: 'steady', loot: 10 });
    expect(out.state.raidNo).toBe(1);
    // The same request on the same saved clan gives the very same answer.
    expect(applyAction(s, { type: 'raid', kingdom: 'bunny-hollow', push: 'steady' }, ctx())).toEqual(applyAction(s, { type: 'raid', kingdom: 'bunny-hollow', push: 'steady' }, ctx()));
  });

  it('allows one raid a day, but any number of Friendly Wars, and the next day brings the raid back', () => {
    const s = withBarracks(created());
    empireOf(s.clan).troops = { footman: 20, axeman: 10, knight: 5 };
    const first = ok(s, { type: 'raid', kingdom: 'bunny-hollow', push: 'steady' });
    expect(refused(first.state, { type: 'raid', kingdom: 'pebble-bridge', push: 'steady' }).why).toBe('limit');
    const war = ok(first.state, { type: 'war', kingdom: 'pebble-bridge', push: 'careful' });
    expect(war.result).toMatchObject({ type: 'war', friendly: true, gold: 0 });
    expect(war.state.raidNo).toBe(2);
    expect(empireOf(war.state.clan).troops).toEqual(empireOf(first.state.clan).troops);
    expect(ok(war.state, { type: 'raid', kingdom: 'bunny-hollow', push: 'steady' }, { today: DAY0 + 1 }).ok).toBe(true);
  });

  it('refuses a raid with no troops, or on a kingdom that is not there', () => {
    const s = created();
    expect(refused(s, { type: 'raid', kingdom: 'bunny-hollow', push: 'steady' }).why).toBe('army');
    const armed = withBarracks(s);
    empireOf(armed.clan).troops.footman = 5;
    expect(refused(armed, { type: 'raid', kingdom: 'atlantis', push: 'steady' }).why).toBe('kingdom');
  });

  it('a raid win puts the loot in the one purse', () => {
    const s = withBarracks(created());
    empireOf(s.clan).troops = { footman: 2000, axeman: 500, knight: 200 };
    const out = ok(s, { type: 'raid', kingdom: 'bunny-hollow', push: 'bold' });
    expect(out.result).toMatchObject({ type: 'raid', result: { outcome: 'won' } });
    const gold = (out.result as { gold: number }).gold;
    expect(gold).toBeGreaterThan(0);
    expect(out.state.clan.gold).toBe(s.clan.gold + gold);
  });
});

describe('moving an old save into My Village when it loads', () => {
  const oldState = (): ServerState => {
    const s = created();
    s.clan.gold = 100;
    s.clan.empire = {
      vault: 400, wild: 10, claimed: 0, plots: [{ width: 3, length: 5, building: 'barracks' }, { width: 3, length: 5, building: 'steelMill' }], troops: { footman: 7, axeman: 0, knight: 0 },
      draftPercent: 10, day: 1, createdDay: 1, energyUsed: 0, raidsToday: 0, kingdomRaidsToday: 0, shieldUntil: 0, raidedToday: [],
    } as never;
    return s;
  };

  it('converts on the first request, using the class village levels from the server, and says it changed', () => {
    const s = oldState();
    expect(needsUpgrade(s.clan)).toBe(true);
    const out = ok(s, { type: 'load' }, { groupVillage: { trainingHall: 2, smithy: 3, church: 1 } });
    expect(out.changed).toBe(true);
    expect(out.state.clan.gold).toBe(500);
    expect(empireOf(out.state.clan)).toMatchObject({ version: 2, levels: { trainingHall: 2, smithy: 3, church: 1, barracks: 1, forge: 1 }, troops: { footman: 7, axeman: 0, knight: 0 } });
    expect(out.state.clan.village).toEqual({ trainingHall: 2, smithy: 3, church: 1 });
    expect(s.clan.gold).toBe(100);
  });

  it('is converted only once, whatever group levels come with later requests', () => {
    const once = ok(oldState(), { type: 'load' }, { groupVillage: { trainingHall: 2, smithy: 3, church: 1 } });
    const again = ok(once.state, { type: 'load' }, { groupVillage: { trainingHall: 5, smithy: 6, church: 3 } });
    expect(again.changed).toBe(false);
    expect(again.state.clan).toEqual(once.state.clan);
  });

  it('converts before any other action, so an old clan can upgrade straight away', () => {
    const out = ok(oldState(), { type: 'upgrade', building: 'walls' }, { groupVillage: { trainingHall: 0, smithy: 0, church: 0 } });
    expect(out.state.clan.gold).toBe(500 - CONFIG.empire.buildings.walls.base);
    expect(empireOf(out.state.clan).levels.walls).toBe(1);
  });

  it('a clan that never opened its empire gets the group levels too', () => {
    const s = created();
    delete s.clan.empire;
    const out = ok(s, { type: 'load' }, { groupVillage: { trainingHall: 1, smithy: 0, church: 0 } });
    expect(empireOf(out.state.clan).levels.trainingHall).toBe(1);
  });
});

describe('quests', () => {
  const quest = (s: ServerState) => todaysQuest(s.seed, s.day, DEFAULT_PRACTICAL_SETTINGS)!;
  const puzzleChoice = (q: (typeof QUESTS)[number]) => q.choices.findIndex((c) => c.puzzle && !c.charm);

  /** A clan that is on a day when today's quest has a puzzle choice anyone can pick. */
  function stateWithPuzzle() {
    for (let offset = 0; offset < 10; offset++) {
      const s = created();
      const day = clanDay(DAY0, DAY0 + offset);
      const q = todaysQuest(s.seed, day, DEFAULT_PRACTICAL_SETTINGS)!;
      if (puzzleChoice(q) >= 0) return { today: DAY0 + offset, q };
    }
    throw new Error('no puzzle quest in ten days');
  }

  it('marks the answer by rebuilding the puzzle from the clan\'s seed: right gets the big prize, wrong the smaller', () => {
    const { today, q } = stateWithPuzzle();
    const choice = puzzleChoice(q);
    const s = created();
    const day = clanDay(DAY0, today);
    const spec = puzzleFor(q, choice, SEED, day, DEFAULT_PRACTICAL_SETTINGS)!;
    const answer = buildPuzzle(spec).answer;
    const right = ok(s, { type: 'quest', choice, answer }, { today });
    const wrong = ok(s, { type: 'quest', choice, answer: answer + 1 }, { today });
    const skipped = ok(s, { type: 'quest', choice, answer: null }, { today });
    expect(right.result).toMatchObject({ type: 'quest', questId: q.id, right: true });
    expect(wrong.result).toMatchObject({ right: false });
    expect(skipped.result).toMatchObject({ right: false });
    const total = (o: typeof right) => o.state.clan.gold + o.state.clan.followers + o.state.clan.members[0].points;
    expect(total(right)).toBeGreaterThan(total(wrong));
    expect(total(wrong)).toBeGreaterThanOrEqual(total(skipped) - 0);
    // A wrong answer never blocks: the quest is done either way.
    expect(wrong.state.clan.questDay).toBe(day);
  });

  it('pays once a day: a second quest on the same day is refused, and tomorrow brings a new one', () => {
    const s = created();
    const q = quest(s);
    const choice = q.choices.findIndex((c) => !c.charm);
    const first = ok(s, { type: 'quest', choice, answer: null });
    expect(refused(first.state, { type: 'quest', choice, answer: null }).why).toBe('quest');
    const next = ok(first.state, { type: 'quest', choice: 0, answer: null }, { today: DAY0 + 1 });
    expect((next.result as { questId: number }).questId).not.toBe(q.id);
  });

  it('refuses a charm choice when the clan is not charming enough, and does not use up the day', () => {
    for (let offset = 0; offset < 30; offset++) {
      const s = created();
      const day = clanDay(DAY0, DAY0 + offset);
      const q = todaysQuest(SEED, day, DEFAULT_PRACTICAL_SETTINGS)!;
      const choice = q.choices.findIndex((c) => c.charm === 'high');
      if (choice < 0) continue;
      for (const m of s.clan.members) m.stats.charisma = 1;
      const out = refused(s, { type: 'quest', choice, answer: null }, { today: DAY0 + offset });
      expect(out.say).toMatch(/charm/i);
      return;
    }
    throw new Error('no quest with a very charming choice in thirty days');
  });

  it('refuses a choice that is not in the story, and ignores an answer sent for a choice with no puzzle', () => {
    const s = created();
    const q = quest(s);
    expect(refused(s, { type: 'quest', choice: 5, answer: null }).why).toBe('choice');
    const plain = q.choices.findIndex((c) => !c.puzzle && !c.charm);
    if (plain >= 0) {
      const a = ok(s, { type: 'quest', choice: plain, answer: null });
      const b = ok(s, { type: 'quest', choice: plain, answer: 12345 });
      expect(a).toEqual(b);
    }
  });
});

describe('whatever is sent, the clan stays sensible', () => {
  it('keeps gold, followers, points and troops from going negative through 2,000 random requests', () => {
    let seedState = 99;
    const next = (n: number) => ((seedState = (Math.imul(seedState, 1103515245) + 12345) | 0), Math.abs(seedState >> 8) % n);
    let s = rich(created(), 400);
    s.clan.followers = 40;
    const buildings = ['trainingHall', 'smithy', 'church', 'barracks', 'walls', 'tower', 'forge', 'strongroom'];
    for (let i = 0; i < 2000; i++) {
      const raw: Action[] = [
        { type: 'upgrade', building: buildings[next(8)] as never }, { type: 'buyTroops', mix: { footman: next(8), axeman: next(4), knight: next(2) } },
        { type: 'wakeAll' }, { type: 'wake', member: next(4) },
        { type: 'raid', kingdom: 'bunny-hollow', push: 'bold' }, { type: 'war', kingdom: 'pebble-bridge', push: 'steady' },
        { type: 'train', member: next(4), key: 'strength', count: 1 + next(3) }, { type: 'quest', choice: next(3), answer: next(50) },
      ];
      const action = raw[next(raw.length)];
      const out = applyAction(s, action, ctx({ today: DAY0 + Math.floor(i / 40) }));
      if (out.ok && out.state) s = out.state;
      if (i % 50 === 0) s.clan.members[next(4)].points += 6;
      const e = empireOf(s.clan);
      expect([s.clan.gold, s.clan.followers, e.buildsToday, ...Object.values(e.levels), e.troops.footman, e.troops.axeman, e.troops.knight, ...s.clan.members.map((m) => m.points)].every((n) => n >= 0 && Number.isFinite(n))).toBe(true);
    }
  });
});

describe('saved builds across days', () => {
  it('a clan away for three days saves builds for the days it missed (up to the cap)', () => {
    const s = created();
    const out = ok(s, { type: 'load' }, { today: DAY0 + 3 });
    // Day 1's two builds were unused, plus two missed days: 6, capped at 4.
    expect(empireOf(out.state.clan).buildsSaved).toBe(CONFIG.empire.buildsSavedMax);
    const short = ok(s, { type: 'load' }, { today: DAY0 + 2 });
    // Day 1's two unused builds and one missed day: 4.
    expect(empireOf(short.state.clan).buildsSaved).toBe(4);
  });

  it('catchUp passes the missed days on', () => {
    const s = created();
    expect(catchUp(s, DAY0 + 1)).toBe(true);
    expect(empireOf(s.clan).buildsSaved).toBe(2);
  });
});

describe('the season', () => {
  const clock = (over: Partial<SeasonClock> = {}): SeasonClock => ({ number: 2, day: 5, daysLeft: 31, clockOn: true, ...over });

  it('stamps a save with no season with the current one, without resetting', () => {
    const s = rich(created());
    const out = ok(s, { type: 'load' }, { clock: clock() });
    expect(out.changed).toBe(true);
    expect(out.newSeason).toBeUndefined();
    expect(out.state.clan.season).toBe(2);
    expect(out.state.clan.gold).toBe(5000);
    expect(ok(out.state, { type: 'load' }, { clock: clock() }).changed).toBe(false);
  });

  it('does not stamp when there is no season date yet (number 0) or no clock', () => {
    const s = created();
    expect(ok(s, { type: 'load' }, { clock: clock({ number: 0, clockOn: false }) }).state.clan.season).toBeUndefined();
    expect(ok(s, { type: 'load' }).state.clan.season).toBeUndefined();
  });

  it('starts the clan again when the clock is on and its season is older', () => {
    const s = rich(created());
    s.clan.season = 1;
    s.clan.members[0].level = 7;
    const out = ok(s, { type: 'load' }, { clock: clock() });
    expect(out.changed).toBe(true);
    expect(out.newSeason).toBe(true);
    expect(out.state.clan).toMatchObject({ season: 2, gold: CONFIG.startGold });
    expect(out.state.clan.members[0].level).toBe(1);
  });

  it('does the action on the fresh save, and a refused action is not a reset in disguise', () => {
    const s = rich(created());
    s.clan.season = 1;
    const out = ok(s, { type: 'upgrade', building: 'smithy' }, { clock: clock() });
    expect(out.newSeason).toBe(true);
    expect(out.state.clan.gold).toBe(CONFIG.startGold - CONFIG.empire.buildings.smithy.base);
    expect(empireOf(out.state.clan).levels.smithy).toBe(1);
  });

  it('waits when the clock is off, when the season is current, or while a fight is open', () => {
    const s = rich(created());
    s.clan.season = 1;
    expect(ok(s, { type: 'load' }, { clock: clock({ clockOn: false }) }).state.clan.gold).toBe(5000);
    const current = structuredClone(s);
    current.clan.season = 2;
    expect(ok(current, { type: 'load' }, { clock: clock() }).newSeason).toBeUndefined();
    const fighting = ok(s, { type: 'fightStart', depth: 0, boss: false }).state;
    fighting.clan.season = 1;
    const out = ok(fighting, { type: 'load' }, { clock: clock() });
    expect(out.newSeason).toBeUndefined();
    expect(out.state.clan.season).toBe(1);
    expect(out.state.fight).toBeTruthy();
  });

  it('rests raids on classmates from day 22 and still lists nothing, with a flag', () => {
    const s = created();
    const target = { id: 'pid-2', name: 'Blue Flag', createdNzDay: DAY0 - 20, empire: empireOf(created().clan), gold: 500 };
    const early = ok(s, { type: 'raidTargets' }, { clock: clock({ day: 21 }), self: 'pid-1', raidsOn: true, mates: [] });
    expect(early.result).toEqual({ type: 'raidTargets', targets: [] });
    const late = ok(s, { type: 'raidTargets' }, { clock: clock({ day: 22 }), self: 'pid-1', raidsOn: true, mates: [] });
    expect(late.result).toEqual({ type: 'raidTargets', targets: [], resting: true });
    const raid = refused(s, { type: 'raidClass', target: 'pid-2', take: 'gold', push: 'steady' }, { clock: clock({ day: 30 }), self: 'pid-1', raidsOn: true, target: target as never });
    expect(raid.why).toBe('resting-season');
    expect(raid.say).toBe('Raids on classmates rest for the last two weeks of the season. Computer kingdoms are still open!');
    // Computer kingdoms stay open.
    const withTroops = rich(created());
    empireOf(withTroops.clan).troops.footman = 10;
    expect(applyAction(withTroops, { type: 'raid', kingdom: 'bunny-hollow', push: 'steady' }, ctx({ clock: clock({ day: 30 }) })).ok).toBe(true);
  });

  it('does not rest raids when the clock is off', () => {
    const s = created();
    const late = ok(s, { type: 'raidTargets' }, { clock: clock({ day: 30, clockOn: false }), self: 'pid-1', raidsOn: true, mates: [] });
    expect(late.result).toEqual({ type: 'raidTargets', targets: [] });
  });
});
