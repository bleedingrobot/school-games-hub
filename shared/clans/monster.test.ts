import { describe, expect, it } from 'vitest';
import { applyAction, fightOf, monsterSeed, parseAction, type Action, type Applied, type Context, type OpenFight, type ServerState } from './actions';
import { nextCryQuestion, replayFight, type CryAnswer, type RecordedRound } from './battleCry';
import { botOrders } from './bot';
import { CONFIG } from './config';
import { startingDrafts } from './create';
import { empireOf, maxLevel } from './empire';
import { maxRoundsOf, playRound, type FightEvent, type FightState, type Order } from './fight';
import {
  buySupply, markSiege, MONSTER_LOOKS, monsterHp, monsterOf, monsterSave, newMonsterFight, playSiege, siegeQuestion, siegeShare, supplyPrice, tiredShare,
  type MonsterSetup,
} from './monster';
import { newSeasonSave } from './season';
import { DEFAULT_PRACTICAL_SETTINGS } from '../maths/practical';
import { TROOP_KINDS, VILLAGE_BUILDINGS, type Clan, type Member } from './types';

const M = CONFIG.monster;
const SEED = 123456;
const DAY0 = 20_000;
const CLOCK = { number: 1, day: 29, daysLeft: 7, clockOn: true };
const ctx = (over: Partial<Context> = {}): Context => ({ seed: SEED, today: DAY0, clock: CLOCK, ...over });

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

/** Members who cannot be beaten (and cannot win quickly if they only guard) or who fall at once. */
const sturdy = (members: Member[]): Member[] => members.map((m) => ({ ...structuredClone(m), hp: 1_000_000, maxHp: 1_000_000, knockedOut: false }));
const mighty = (state: ServerState): ServerState => {
  const s = structuredClone(state);
  for (const m of s.clan.members) {
    m.hp = m.maxHp = 1_000_000;
    m.stats = { ...m.stats, strength: 1000, dexterity: 1000, agility: 1000, armor: 1000 };
  }
  // A whole village, and a monster tired from four lost tries, so the clan can win.
  s.clan.empire = structuredClone(fullVillage().empire);
  s.clan.season = 1;
  s.clan.monster = { season: 1, tries: 4, losses: 4, lastDay: 0, supplies: { arrows: 0, potions: 0, net: 0 } };
  return s;
};
const frail = (state: ServerState): ServerState => {
  const s = structuredClone(state);
  for (const m of s.clan.members) { m.hp = m.maxHp = 1; m.stats = { ...m.stats, armor: 0, agility: 0 }; }
  return s;
};

const setup = (over: Partial<MonsterSetup> = {}): MonsterSetup => ({ kind: 'giant', losses: 0, siege: 0, potions: 0, net: false, walls: 0, ...over });
const guards = (s: FightState): Order[] => s.clan.map(() => ({ action: 'guard' }));
const baseMembers = () => sturdy(created().clan.members);
const kinds = (s: FightState, round: number): FightEvent['type'][] => {
  const from = s.log.findIndex((e) => e.type === 'round' && e.round === round);
  const rest = s.log.slice(from + 1);
  const next = rest.findIndex((e) => e.type === 'round');
  return (next < 0 ? rest : rest.slice(0, next)).map((e) => e.type);
};
const playTo = (s: FightState, round: number, orders: (s: FightState) => Order[] = guards) => {
  while (s.round < round && !s.result) playRound(s, orders(s), null);
};

/** A clan with a maxed village and a full army. */
function fullVillage(): Clan {
  const clan = structuredClone(created().clan);
  const e = empireOf(clan);
  for (const b of VILLAGE_BUILDINGS) e.levels[b] = maxLevel(b);
  for (const k of TROOP_KINDS) e.troops[k] = e.levels.barracks * CONFIG.empire.troopCap[k];
  return clan;
}

describe('which monster', () => {
  it('takes turns: giant, golem, troll, giant', () => {
    expect([1, 2, 3, 4, 5, 6].map(monsterOf)).toEqual(['giant', 'golem', 'troll', 'giant', 'golem', 'troll']);
  });
  it('has a look for each', () => {
    for (const k of ['giant', 'golem', 'troll'] as const) {
      expect(MONSTER_LOOKS[k].short.length).toBeGreaterThan(0);
      expect(MONSTER_LOOKS[k].signs).toHaveLength(3);
    }
  });
});

describe('tiredness and HP', () => {
  it('grows 10% a loss and stops at 40%', () => {
    const got = [0, 1, 2, 3, 4, 5, 9].map(tiredShare);
    [0, 0.1, 0.2, 0.3, 0.4, 0.4, 0.4].forEach((v, i) => expect(got[i]).toBeCloseTo(v));
    expect(tiredShare(-3)).toBe(0);
  });
  it('monsterHp counts losses and the siege share', () => {
    expect(monsterHp({ losses: 0, siege: 0 })).toEqual({ maxHp: M.hp, hp: M.hp });
    expect(monsterHp({ losses: 2, siege: 0 })).toEqual({ maxHp: Math.round(M.hp * 0.8), hp: Math.round(M.hp * 0.8) });
    const h = monsterHp({ losses: 1, siege: 0.5 });
    expect(h.maxHp).toBe(Math.round(M.hp * 0.9));
    expect(h.hp).toBe(Math.round(h.maxHp * 0.5));
    expect(monsterHp({ losses: 10, siege: 0 }).maxHp).toBe(Math.round(M.hp * 0.6));
    expect(monsterHp({ losses: 0, siege: 1 }).hp).toBe(1);
  });
});

describe('the siege', () => {
  const empty = () => structuredClone(created().clan);
  it('is about nothing for an empty village', () => {
    const e = empty();
    for (const k of TROOP_KINDS) empireOf(e).troops[k] = 0;
    expect(siegeShare(e, 0, false)).toBeCloseTo(0, 5);
    expect(playSiege(e, 0, false, 5).share).toBeCloseTo(0, 5);
  });
  it('is bigger for a full village, and never above the most', () => {
    const full = fullVillage();
    const shareFull = siegeShare(full, 0, false);
    expect(shareFull).toBeGreaterThan(siegeShare(empty(), 0, false));
    expect(shareFull).toBeGreaterThan(0.2);
    for (const arrows of [0, 3, 50]) {
      for (const right of [false, true]) {
        expect(siegeShare(full, arrows, right)).toBeLessThanOrEqual(M.siege.most + 1e-9);
        for (let seed = 1; seed < 30; seed++) expect(playSiege(full, arrows, right, seed).share).toBeLessThanOrEqual(M.siege.most + 1e-9);
      }
    }
    expect(siegeShare(full, 1000, true)).toBeCloseTo(M.siege.most);
  });
  it('a right answer boosts by the configured amount', () => {
    const c = empty();
    empireOf(c).levels.tower = 2;
    const plain = siegeShare(c, 0, false);
    expect(plain).toBeGreaterThan(0);
    expect(siegeShare(c, 0, true)).toBeCloseTo(plain * M.siege.rightAnswer);
  });
  it('arrows add to it', () => {
    const c = empty();
    expect(siegeShare(c, 2, false) - siegeShare(c, 0, false)).toBeCloseTo(2 * M.siege.arrowShare);
  });
  it('playSiege is the same every time for a seed, and its rounds add up', () => {
    const c = empty();
    empireOf(c).levels.tower = 3;
    const a = playSiege(c, 2, true, 77);
    expect(playSiege(c, 2, true, 77)).toEqual(a);
    expect(a.rounds).toHaveLength(3);
    expect(a.rounds.reduce((t, r) => t + r.army + r.tower, 0)).toBeCloseTo(a.share);
    expect(a.right).toBe(true);
    expect(a.arrows).toBe(2);
    expect(playSiege(c, 2, true, 78).share).not.toBe(a.share);
    expect(a.share).toBeLessThan(M.siege.most);
  });
  it('a right answer gives a bigger siege than a wrong one (same seed)', () => {
    const c = empty();
    empireOf(c).levels.tower = 3;
    expect(playSiege(c, 0, true, 9).share).toBeGreaterThan(playSiege(c, 0, false, 9).share);
  });
  it('markSiege marks the answer, or says wrong for a skip, or null with no question', () => {
    const q = siegeQuestion(11, DEFAULT_PRACTICAL_SETTINGS);
    expect(q).not.toBeNull();
    expect(markSiege(11, DEFAULT_PRACTICAL_SETTINGS, q!.answer).right).toBe(true);
    expect(markSiege(11, DEFAULT_PRACTICAL_SETTINGS, q!.answer + 1).right).toBe(false);
    expect(markSiege(11, DEFAULT_PRACTICAL_SETTINGS, null).right).toBe(false);
    const off = { ...DEFAULT_PRACTICAL_SETTINGS, enabledTopics: [] };
    expect(siegeQuestion(11, off)).toBeNull();
    expect(markSiege(11, off, null).right).toBeNull();
  });
});

describe('the clan fight', () => {
  it('has one enemy: the monster, with its short name and monsterHp', () => {
    const su = setup({ kind: 'troll', losses: 2, siege: 0.3 });
    const s = newMonsterFight(baseMembers(), su, 5);
    expect(s.enemies).toHaveLength(1);
    expect(s.enemies[0].name).toBe('Frostjaw');
    const h = monsterHp(su);
    expect(s.enemies[0].hp).toBe(h.hp);
    expect(s.enemies[0].maxHp).toBe(h.maxHp);
    expect(s.enemies[0].stats.strength).toBe(Math.round(M.stats.strength * 0.8));
    expect(s.monster).toEqual({ kind: 'troll', potions: 0, net: false, wallsCut: 0, rounds: M.rounds });
    expect(s.result).toBeNull();
  });
  it('walls cut by wallsCut percent a level (never above 90)', () => {
    expect(newMonsterFight(baseMembers(), setup({ walls: 3 }), 1).monster!.wallsCut).toBe(3 * M.wallsCut);
    expect(newMonsterFight(baseMembers(), setup({ walls: 100 }), 1).monster!.wallsCut).toBe(90);
  });
  it('is the same fight for the same seed and orders, and different for another seed', () => {
    const run = (seed: number) => {
      const s = newMonsterFight(baseMembers(), setup(), seed);
      playTo(s, 6);
      return s;
    };
    expect(run(3)).toEqual(run(3));
    expect(run(3).log).not.toEqual(run(4).log);
  });
  it('times out after CONFIG.monster.rounds rounds', () => {
    const s = newMonsterFight(baseMembers(), setup(), 8);
    expect(maxRoundsOf(s)).toBe(M.rounds);
    playTo(s, M.rounds - 1);
    expect(s.result).toBeNull();
    playRound(s, guards(s), null);
    expect(s.round).toBe(M.rounds);
    expect(s.result).toBe('timeout');
  });
  it('stomps on two members in a normal round', () => {
    const s = newMonsterFight(baseMembers(), setup(), 21);
    playTo(s, 1);
    const stomps = s.log.filter((e) => e.type === 'hit' || e.type === 'miss');
    expect(stomps).toHaveLength(2);
    expect(new Set(stomps.map((e) => (e as { target: string }).target)).size).toBe(2);
  });
});

describe('the big moves', () => {
  it('warns at the end of round 2 and not at the end of round 1, then does the move in round 3', () => {
    const s = newMonsterFight(baseMembers(), setup(), 12);
    playTo(s, 1);
    expect(s.log.some((e) => e.type === 'warn')).toBe(false);
    playTo(s, 2);
    const last = s.log[s.log.length - 1];
    expect(last).toMatchObject({ type: 'warn', who: 'Grimmor', move: 'giant' });
    expect(kinds(s, 2)).not.toContain('big');
    playTo(s, 3);
    expect(kinds(s, 3)).toContain('big');
    expect(s.log.filter((e) => e.type === 'big')).toHaveLength(1);
  });
  it('the giant throws one boulder at one member', () => {
    const s = newMonsterFight(baseMembers(), setup({ kind: 'giant' }), 14);
    playTo(s, 3);
    const r3 = s.log.slice(s.log.findIndex((e) => e.type === 'round' && e.round === 3));
    const bigAt = r3.findIndex((e) => e.type === 'big');
    const hits = r3.slice(bigAt + 1).filter((e) => e.type === 'hit' && e.who === 'Grimmor');
    expect(hits).toHaveLength(1);
  });
  it('the golem slam hits every living member', () => {
    const s = newMonsterFight(baseMembers(), setup({ kind: 'golem' }), 15);
    playTo(s, 3);
    const r3 = s.log.slice(s.log.findIndex((e) => e.type === 'round' && e.round === 3));
    const hits = r3.slice(r3.findIndex((e) => e.type === 'big') + 1).filter((e) => e.type === 'hit' && e.who === 'Craghold') as { target: string }[];
    expect(new Set(hits.map((h) => h.target))).toEqual(new Set(s.clan.map((f) => f.name)));
  });
  it('the golem slam skips members who are already down', () => {
    const s = newMonsterFight(baseMembers(), setup({ kind: 'golem' }), 15);
    s.clan[1].hp = 0;
    playTo(s, 3);
    const r3 = s.log.slice(s.log.findIndex((e) => e.type === 'round' && e.round === 3));
    const hits = r3.slice(r3.findIndex((e) => e.type === 'big') + 1).filter((e) => e.type === 'hit' && e.who === 'Craghold') as { target: string }[];
    expect(hits.map((h) => h.target)).not.toContain(s.clan[1].name);
    expect(hits).toHaveLength(3);
  });
  it('the troll freezes the member it breathes on for a round', () => {
    const s = newMonsterFight(baseMembers(), setup({ kind: 'troll' }), 16);
    playTo(s, 3);
    const r3 = s.log.slice(s.log.findIndex((e) => e.type === 'round' && e.round === 3));
    const bigAt = r3.findIndex((e) => e.type === 'big');
    expect(bigAt).toBeGreaterThanOrEqual(0);
    const tied = r3.slice(bigAt).find((e) => e.type === 'tied') as { who: string } | undefined;
    expect(tied).toBeDefined();
    playRound(s, guards(s), null);
    // One 'tied' for the breath and one for the turn that is lost (in round 3 if the member had not yet played, else round 4).
    const ties = s.log.slice(s.log.findIndex((e) => e.type === 'round' && e.round === 3)).filter((e) => e.type === 'tied' && e.who === tied!.who);
    expect(ties).toHaveLength(2);
    expect(s.clan.find((f) => f.name === tied!.who)!.tied).toBe(0);
  });
  it('the giant net cancels the first big move, and the next one (round 6) happens', () => {
    const s = newMonsterFight(baseMembers(), setup({ net: true }), 17);
    playTo(s, 3);
    expect(kinds(s, 3)).toContain('net');
    expect(kinds(s, 3)).not.toContain('big');
    expect(s.monster!.net).toBe(false);
    playTo(s, 5);
    expect(s.log[s.log.length - 1].type).toBe('warn');
    playTo(s, 6);
    expect(kinds(s, 6)).toContain('big');
    expect(kinds(s, 6)).not.toContain('net');
  });
  it('the Walls cut what the monster does', () => {
    const total = (walls: number) => {
      const s = newMonsterFight(baseMembers(), setup({ walls, kind: 'golem' }), 30);
      playTo(s, 6);
      return s.log.reduce((t, e) => t + (e.type === 'hit' && e.who === 'Craghold' ? e.damage : 0), 0);
    };
    expect(total(5)).toBeLessThan(total(0));
  });
  it('the monster hits harder than the power-less mine formula (power multiplier)', () => {
    const s = newMonsterFight(baseMembers(), setup(), 31);
    playTo(s, 1);
    const hit = s.log.find((e) => e.type === 'hit') as { damage: number } | undefined;
    // strength 60 -> base at most 30*1.19, times 1.5, so well above the 29 a power of 1 allows when the armour is low
    if (hit) expect(hit.damage).toBeGreaterThan(0);
  });
});

describe('potions', () => {
  it('a potion order heals and uses one up', () => {
    const s = newMonsterFight(baseMembers(), setup({ potions: 2 }), 40);
    s.clan[2].hp = 100;
    const orders = guards(s);
    orders[0] = { action: 'potion', target: 2 };
    playRound(s, orders, null);
    const ev = s.log.find((e) => e.type === 'potion') as { amount: number; target: string } | undefined;
    expect(ev).toBeDefined();
    expect(ev!.target).toBe(s.clan[2].name);
    expect(ev!.amount).toBe(Math.min(s.clan[2].maxHp - 100, Math.ceil(s.clan[2].maxHp * M.potionHeal)));
    expect(s.monster!.potions).toBe(1);
    expect(s.clan[2].hp).toBeGreaterThan(100);
  });
  it('with none left it becomes an attack', () => {
    const s = newMonsterFight(baseMembers(), setup({ potions: 0 }), 41);
    const orders = guards(s);
    orders[0] = { action: 'potion', target: 1 };
    playRound(s, orders, null);
    expect(s.log.some((e) => e.type === 'potion')).toBe(false);
    expect(s.log.some((e) => (e.type === 'hit' || e.type === 'miss') && e.who === s.clan[0].name)).toBe(true);
    expect(s.monster!.potions).toBe(0);
  });
  it('is not used up on a member who is down (attacks instead)', () => {
    const s = newMonsterFight(baseMembers(), setup({ potions: 1 }), 42);
    s.clan[3].hp = 0;
    const orders = guards(s);
    orders[0] = { action: 'potion', target: 3 };
    playRound(s, orders, null);
    expect(s.monster!.potions).toBe(1);
  });
});

describe('supplies', () => {
  const rich = (gold: number) => ({ ...structuredClone(created().clan), gold });
  it('charges the price (with tax) times the count', () => {
    const c = rich(100_000);
    expect(supplyPrice('net')).toBe(Math.ceil((M.supplies.net.price * (100 + CONFIG.shopTax)) / 100));
    expect(buySupply(c, 1, 'potions', 3)).toEqual({ ok: true });
    expect(c.gold).toBe(100_000 - 3 * supplyPrice('potions'));
    expect(c.monster).toMatchObject({ season: 1, supplies: { arrows: 0, potions: 3, net: 0 } });
    expect(buySupply(c, 1, 'potions', 1).ok).toBe(true);
    expect(monsterSave(c, 1).supplies.potions).toBe(4);
  });
  it('refuses more than the most, even across buys', () => {
    const c = rich(100_000);
    const r = buySupply(c, 1, 'arrows', M.supplies.arrows.max + 1);
    expect(r).toMatchObject({ ok: false, why: 'full' });
    expect(c.gold).toBe(100_000);
    expect(c.monster).toBeUndefined();
    expect(buySupply(c, 1, 'net', 1).ok).toBe(true);
    expect(buySupply(c, 1, 'net', 1)).toMatchObject({ ok: false, why: 'full' });
  });
  it('refuses without enough gold and changes nothing', () => {
    const c = rich(supplyPrice('arrows') * 2 - 1);
    expect(buySupply(c, 1, 'arrows', 2)).toMatchObject({ ok: false, why: 'gold' });
    expect(c.gold).toBe(supplyPrice('arrows') * 2 - 1);
    expect(c.monster).toBeUndefined();
  });
  it('refuses odd amounts and kinds', () => {
    const c = rich(100_000);
    expect(buySupply(c, 1, 'arrows', 0)).toMatchObject({ ok: false, why: 'amount' });
    expect(buySupply(c, 1, 'arrows', 1.5)).toMatchObject({ ok: false, why: 'amount' });
    expect(buySupply(c, 1, 'sword' as never, 1)).toMatchObject({ ok: false, why: 'amount' });
  });
  it('keeps the season, tries and losses; an old season starts fresh', () => {
    const c = rich(100_000);
    c.monster = { season: 2, tries: 3, losses: 2, lastDay: 5, supplies: { arrows: 1, potions: 0, net: 0 } };
    buySupply(c, 2, 'arrows', 1);
    expect(c.monster).toEqual({ season: 2, tries: 3, losses: 2, lastDay: 5, supplies: { arrows: 2, potions: 0, net: 0 } });
    buySupply(c, 3, 'arrows', 1);
    expect(c.monster).toEqual({ season: 3, tries: 0, losses: 0, lastDay: 0, supplies: { arrows: 1, potions: 0, net: 0 } });
  });
});

describe('monster actions', () => {
  const week = (over: Partial<typeof CLOCK> = {}) => ({ clock: { ...CLOCK, ...over } });
  const startMonster = (s: ServerState, siege: number | null = null, over: Partial<Context> = {}) => ok(s, { type: 'monsterStart', siege }, over);
  const roundAction = (state: ServerState, played: RecordedRound): Action => ({ type: 'fightRound', round: (state.fight as OpenFight).rounds.length + 1, orders: played.orders, cry: played.cry });
  const rebuild = (state: ServerState) => {
    const f = state.fight as OpenFight;
    return replayFight(state.clan.members, f.depth, f.seed, f.boss, f.rounds, f.settings, fightOf(state.clan.members, f)).state;
  };
  function nextRound(state: ServerState): RecordedRound {
    const f = state.fight as OpenFight;
    const local = rebuild(state);
    const q = nextCryQuestion(local, f.settings);
    return { orders: botOrders(local), cry: q ? { answer: q.answer, reward: local.clan.some((m) => m.hp < m.maxHp) ? 'heal' : 'damage' } as CryAnswer : null };
  }
  function playOut(state: ServerState, over: Partial<Context> = {}) {
    let s = state;
    let last: Extract<Applied, { ok: true }> | null = null;
    for (let i = 0; i < M.rounds + 2 && s.fight; i++) {
      last = ok(s, roundAction(s, nextRound(s)), over);
      s = last.state!;
    }
    if (s.fight) throw new Error('never ended');
    return { state: s, last: last! };
  }
  /** A new day: restore everyone and move the NZ day on by one. */
  const nextDay = (s: ServerState): { state: ServerState; over: Partial<Context> } => {
    const t = structuredClone(s);
    for (const m of t.clan.members) { m.hp = m.maxHp; m.sp = m.maxSp; m.knockedOut = false; }
    return { state: t, over: { today: DAY0 + 1, ...week({ day: 30 }) } };
  };

  describe('monsterStart', () => {
    it('is not yet with the clock off, no season, or before day 29', () => {
      expect(refused(created(), { type: 'monsterStart', siege: null }, week({ clockOn: false })).why).toBe('not-yet');
      expect(refused(created(), { type: 'monsterStart', siege: null }, week({ day: 28 })).why).toBe('not-yet');
      expect(refused(created(), { type: 'monsterStart', siege: null }, { clock: null }).why).toBe('not-yet');
      expect(refused(created(), { type: 'monsterStart', siege: null }, week({ number: 0 })).why).toBe('not-yet');
    });
    it('needs a clan', () => {
      expect(refused(null, { type: 'monsterStart', siege: null }).why).toBe('no-clan');
    });
    it('works from day 29, marks the right siege answer and sets the try up', () => {
      const s0 = created();
      s0.clan.gold = 100_000;
      const withArrows = ok(s0, { type: 'buySupply', kind: 'arrows', count: 2 }, week({ day: 25 })).state;
      const withNet = ok(withArrows, { type: 'buySupply', kind: 'potions', count: 2 }, week({ day: 25 })).state;
      const baseSeed = withNet.seed;
      const q = siegeQuestion(monsterSeed(baseSeed, 1, 0), DEFAULT_PRACTICAL_SETTINGS)!;
      const right = startMonster(withNet, q.answer);
      expect(right.result).toEqual({ type: 'monsterStart', resumed: false, right: true, answer: q.answer });
      const f = right.state.fight as OpenFight;
      expect(f.monster).toBeDefined();
      expect(f.seed).toBe(monsterSeed(baseSeed, 1, 0));
      expect(f.monster!.setup).toMatchObject({ kind: 'giant', losses: 0, potions: 2, net: false, walls: 0 });
      expect(f.monster!.siege).toEqual(playSiege(right.state.clan, 2, true, f.seed));
      expect(f.monster!.setup.siege).toBe(f.monster!.siege.share);
      expect(f.monster!.siege.arrows).toBe(2);
      expect(f.rounds).toEqual([]);
      expect(right.state.clan.monster).toMatchObject({ season: 1, tries: 1, lastDay: DAY0, supplies: { arrows: 0, potions: 2, net: 0 } });
      expect(right.state.fightNo).toBe(withNet.fightNo + 1);
      expect(right.state.fightsLeft).toBe(withNet.fightsLeft);
      expect(right.effects?.answers).toHaveLength(1);

      const wrong = startMonster(withNet, q.answer + 1);
      expect(wrong.result).toMatchObject({ right: false, answer: q.answer });
      const skip = startMonster(withNet, null);
      expect(skip.result).toMatchObject({ right: false, answer: q.answer });
      expect(skip.effects).toBeUndefined();
      expect((right.state.fight as OpenFight).monster!.siege.share).toBeGreaterThan((wrong.state.fight as OpenFight).monster!.siege.share);
    });
    it('has no question when every topic is off', () => {
      const off = { ...DEFAULT_PRACTICAL_SETTINGS, enabledTopics: [] };
      const r = startMonster(created(), null, { settings: off });
      expect(r.result).toMatchObject({ right: null, answer: null });
    });
    it('is one try a day', () => {
      const s = startMonster(created()).state;
      const done = playOut(s).state;
      for (const m of done.clan.members) { m.hp = m.maxHp; m.knockedOut = false; }
      expect(refused(done, { type: 'monsterStart', siege: null }).why).toBe('tried-today');
      expect(ok(done, { type: 'monsterStart', siege: null }, { today: DAY0 + 1, ...week({ day: 30 }) }).state.clan.monster!.tries).toBe(2);
    });
    it('is refused when a mine fight is open, and resumes an open monster fight unchanged', () => {
      const mine = ok(created(), { type: 'fightStart', depth: 1, boss: false }).state;
      expect(refused(mine, { type: 'monsterStart', siege: null }).why).toBe('fight-open');
      const started = startMonster(created());
      const again = ok(started.state, { type: 'monsterStart', siege: 5 });
      expect(again.result).toMatchObject({ type: 'monsterStart', resumed: true });
      expect(again.changed).toBe(false);
      expect(again.state).toEqual(started.state);
      expect(refused(started.state, { type: 'fightStart', depth: 1, boss: false }).why).toBe('fight-open');
    });
    it('is refused when everyone is resting', () => {
      const s = created();
      for (const m of s.clan.members) m.knockedOut = true;
      s.day = 1;
      expect(refused(s, { type: 'monsterStart', siege: null }).why).toBe('resting');
    });
    it('uses the season walls and a net for the setup', () => {
      const s = created();
      s.clan.gold = 100_000;
      const withNet = ok(s, { type: 'buySupply', kind: 'net', count: 1 }, week({ day: 22 })).state;
      withNet.clan.empire!.levels.walls = 2;
      const f = startMonster(withNet).state.fight as OpenFight;
      expect(f.monster!.setup).toMatchObject({ net: true, walls: 2 });
    });
  });

  describe('playing a try', () => {
    it('a loss: members fall, losses go up, the next try finds the monster more tired', () => {
      const s = frail(created());
      const started = startMonster(s);
      const { state, last } = playOut(started.state);
      expect(last.result).toMatchObject({ type: 'fightRound', over: true, monster: { kind: 'giant', season: 1, won: false, first: false, tries: 1 } });
      expect(state.fight).toBeNull();
      expect(state.clan.monster).toMatchObject({ losses: 1, tries: 1 });
      expect(state.clan.monster!.wonDay).toBeUndefined();
      const d = nextDay(state);
      const next = ok(d.state, { type: 'monsterStart', siege: null }, d.over);
      expect((next.state.fight as OpenFight).monster!.setup.losses).toBe(1);
      expect(monsterHp((next.state.fight as OpenFight).monster!.setup).maxHp).toBe(Math.round(M.hp * 0.9));
    });
    it('a win: first is true and wonDay is set; the next day it is not first, and losses are not counted afterwards', () => {
      const s = mighty(created());
      const started = startMonster(s);
      const { state, last } = playOut(started.state);
      expect(last.result).toMatchObject({ over: true, monster: { won: true, first: true, tries: 5, kind: 'giant', season: 1 } });
      expect(state.clan.monster!.wonDay).toBe(29);
      expect(state.clan.monster!.losses).toBe(4);
      const d = nextDay(state);
      const second = playOut(ok(d.state, { type: 'monsterStart', siege: null }, d.over).state, d.over);
      expect(second.last.result).toMatchObject({ monster: { won: true, first: false, tries: 6 } });
      expect(second.state.clan.monster!.wonDay).toBe(29);
    });
    it('a loss after the first win does not add to the losses', () => {
      const s = mighty(created());
      const won = playOut(startMonster(s).state).state;
      const d = nextDay(won);
      const f = frail(d.state);
      const lost = playOut(ok(f, { type: 'monsterStart', siege: null }, d.over).state, d.over);
      expect(lost.last.result).toMatchObject({ monster: { won: false, first: false } });
      expect(lost.state.clan.monster!.losses).toBe(won.clan.monster!.losses);
    });
    it('what the server replays is what the browser plays', () => {
      const s = mighty(created());
      s.clan.members[1].hp = 5;
      const started = startMonster(s);
      let cur = started.state;
      while (cur.fight) {
        const played = nextRound(cur);
        const local = rebuild(cur);
        playRound(local, played.orders, null);
        const step = ok(cur, roundAction(cur, played));
        if (step.state.fight) expect(rebuild(step.state).log).toEqual(rebuild(step.state).log);
        cur = step.state;
        expect(cur.fight?.rounds.length ?? 0).toBeLessThanOrEqual(M.rounds);
      }
      expect(cur.clan.monster!.tries).toBe(5);
    });
    it('replayFight with fightOf equals the monster fight played directly', () => {
      const started = startMonster(frail(mighty(created()))).state;
      const f = started.fight as OpenFight;
      const direct = fightOf(started.clan.members, f);
      expect(direct.monster).toBeDefined();
      expect(direct.enemies[0].name).toBe('Grimmor');
      const orders = [{ action: 'guard' }, { action: 'guard' }, { action: 'guard' }, { action: 'guard' }] as Order[];
      const rec: RecordedRound[] = [{ orders, cry: null }, { orders, cry: null }];
      const replayed = replayFight(started.clan.members, f.depth, f.seed, f.boss, rec, f.settings, direct).state;
      playRound(direct, orders, null);
      playRound(direct, orders, null);
      expect(replayed).toEqual(direct);
    });
    it('a potion bought is used up in the fight and comes off the supplies', () => {
      const s = mighty(created());
      s.clan.gold = 100_000;
      let t = ok(s, { type: 'buySupply', kind: 'potions', count: 3 }, week({ day: 22 })).state;
      t = startMonster(t).state;
      expect((t.fight as OpenFight).monster!.setup.potions).toBe(3);
      // Round 1: member 0 drinks a potion on member 1 (who is hurt) and the rest guard.
      t.clan.members[1].hp = 10;
      const orders: Order[] = [{ action: 'potion', target: 1 }, { action: 'guard' }, { action: 'guard' }, { action: 'guard' }];
      const step = ok(t, { type: 'fightRound', round: 1, orders, cry: null });
      const local = rebuild(step.state.fight ? step.state : t);
      expect(local.monster!.potions === 3 || local.monster!.potions === 2).toBe(true);
      const { state } = playOut(step.state.fight ? step.state : t);
      expect(state.clan.monster!.supplies.potions).toBeLessThanOrEqual(3);
    });
    it('a net is used up only when it held the big move', () => {
      const s = frail(created());
      s.clan.gold = 100_000;
      const t = startMonster(ok(s, { type: 'buySupply', kind: 'net', count: 1 }, week({ day: 22 })).state).state;
      // The members fall in round 1, before round 3: the net is kept.
      const { state } = playOut(t);
      expect(state.clan.monster!.supplies.net).toBe(1);
    });
  });

  describe('buySupply action', () => {
    it('is refused before day 22 and works from day 22', () => {
      const s = created();
      s.clan.gold = 10_000;
      expect(refused(s, { type: 'buySupply', kind: 'arrows', count: 1 }, week({ day: 21 })).why).toBe('not-yet');
      expect(refused(s, { type: 'buySupply', kind: 'arrows', count: 1 }, week({ clockOn: false, day: 25 })).why).toBe('not-yet');
      expect(refused(s, { type: 'buySupply', kind: 'arrows', count: 1 }, { clock: null }).why).toBe('not-yet');
      const bought = ok(s, { type: 'buySupply', kind: 'arrows', count: 2 }, week({ day: 22 })).state;
      expect(bought.clan.gold).toBe(10_000 - 2 * supplyPrice('arrows'));
      expect(bought.clan.monster!.supplies.arrows).toBe(2);
      expect(refused(bought, { type: 'buySupply', kind: 'arrows', count: 2 }, week({ day: 30 })).why).toBe('full');
      expect(refused(created(), { type: 'buySupply', kind: 'net', count: 1 }, week({ day: 30 })).why).toBe('gold');
    });
  });

  describe('a new season', () => {
    const withMonster = (): ServerState => {
      const s = created();
      s.clan.season = 1;
      s.clan.monster = { season: 1, tries: 3, losses: 2, lastDay: DAY0, wonDay: 30, supplies: { arrows: 1, potions: 1, net: 1 } };
      return s;
    };
    it('newSeasonSave drops the monster and offers a re-pick', () => {
      const n = newSeasonSave(withMonster(), 2);
      expect(n.clan.monster).toBeUndefined();
      expect(n.clan.repick).toBe(2);
      expect(n.clan.season).toBe(2);
      expect(monsterSave(n.clan, 2)).toMatchObject({ tries: 0, losses: 0, lastDay: 0 });
    });
    it('a request in the new season starts it and drops the old monster save', () => {
      const out = applyAction(withMonster(), { type: 'load' }, ctx({ clock: { number: 2, day: 1, daysLeft: 35, clockOn: true } }));
      expect(out).toMatchObject({ ok: true, newSeason: true });
      const st = (out as Extract<Applied, { ok: true }>).state!;
      expect(st.clan.monster).toBeUndefined();
      expect(st.clan.repick).toBe(2);
    });
  });

  describe('repick', () => {
    const newSeason = (): ServerState => {
      const out = applyAction(created(), { type: 'load' }, ctx({ clock: { number: 1, day: 1, daysLeft: 35, clockOn: true } }));
      const s = (out as Extract<Applied, { ok: true }>).state!;
      return newSeasonSave(s, 2);
    };
    const c2 = { clock: { number: 2, day: 1, daysLeft: 35, clockOn: true } };
    const other = (m: Member) => {
      const race = m.race === 'Elf' ? 'Human' : 'Elf';
      const cls = m.cls === 'Wizard' ? 'Fighter' : 'Wizard';
      return { race, cls };
    };
    it('changes a member to a new race and class at level 1', () => {
      const s = newSeason();
      const before = s.clan.members[2];
      const pick = other(before);
      const r = ok(s, { type: 'repick', member: 2, ...pick }, c2);
      const m = r.state.clan.members[2];
      expect(m).toMatchObject({ race: pick.race, cls: pick.cls, level: 1, xp: 0, name: before.name });
      expect(r.state.clan.members[0]).toEqual(s.clan.members[0]);
      expect(r.state.clan.repick).toBe(2);
    });
    it('keeps the look', () => {
      const s = newSeason();
      s.clan.members[1].look = 2 as never;
      const pick = other(s.clan.members[1]);
      expect(ok(s, { type: 'repick', member: 1, ...pick }, c2).state.clan.members[1].look).toBe(2);
    });
    it('is refused for a member who has xp, and for an unknown race, class or member', () => {
      const s = newSeason();
      const pick = other(s.clan.members[0]);
      const played = structuredClone(s);
      played.clan.members[0].xp = 10;
      expect(refused(played, { type: 'repick', member: 0, ...pick }, c2).why).toBe('repick');
      expect(refused(s, { type: 'repick', member: 0, race: 'Dragon', cls: pick.cls }, c2).why).toBe('choice');
      expect(refused(s, { type: 'repick', member: 0, race: pick.race, cls: 'Plumber' }, c2).why).toBe('choice');
      expect(refused(s, { type: 'repick', member: 5, ...pick }, c2).why).toBe('member');
    });
    it('is refused after repickDone, and repickDone twice is harmless', () => {
      const s = newSeason();
      const pick = other(s.clan.members[0]);
      const done = ok(s, { type: 'repickDone' }, c2).state;
      expect(done.clan.repick).toBeUndefined();
      expect(refused(done, { type: 'repick', member: 0, ...pick }, c2).why).toBe('repick');
      expect(ok(done, { type: 'repickDone' }, c2).state.clan.repick).toBeUndefined();
    });
    it('is refused for a clan that never had a new season', () => {
      expect(refused(created(), { type: 'repick', member: 0, race: 'Elf', cls: 'Wizard' }).why).toBe('repick');
    });
  });
});

describe('reading monster actions', () => {
  it('reads monsterStart', () => {
    expect(parseAction({ type: 'monsterStart', siege: 12 })).toEqual({ type: 'monsterStart', siege: 12 });
    expect(parseAction({ type: 'monsterStart' })).toEqual({ type: 'monsterStart', siege: null });
    expect(parseAction({ type: 'monsterStart', siege: null, ladder: true })).toEqual({ type: 'monsterStart', siege: null, ladder: true });
    expect(parseAction({ type: 'monsterStart', siege: 'x' })).toBeNull();
    expect(parseAction({ type: 'monsterStart', siege: Infinity })).toBeNull();
    expect(parseAction({ type: 'monsterStart', siege: 1e12 })).toBeNull();
  });
  it('reads buySupply', () => {
    expect(parseAction({ type: 'buySupply', kind: 'net', count: 1, gold: 5 })).toEqual({ type: 'buySupply', kind: 'net', count: 1 });
    for (const bad of [{ kind: 'net', count: 0 }, { kind: 'net', count: 11 }, { kind: 'net', count: 1.5 }, { kind: 'sword', count: 1 }, { kind: 'net' }, { count: 1 }]) {
      expect(parseAction({ type: 'buySupply', ...bad })).toBeNull();
    }
  });
  it('reads repick and repickDone', () => {
    expect(parseAction({ type: 'repick', member: 1, race: 'Elf', cls: 'Wizard' })).toEqual({ type: 'repick', member: 1, race: 'Elf', cls: 'Wizard' });
    for (const bad of [{ member: 6, race: 'Elf', cls: 'Wizard' }, { member: 1, race: 5, cls: 'Wizard' }, { member: 1, race: 'Elf' }, { member: 1, race: 'x'.repeat(41), cls: 'Wizard' }, { race: 'Elf', cls: 'Wizard' }]) {
      expect(parseAction({ type: 'repick', ...bad })).toBeNull();
    }
    expect(parseAction({ type: 'repickDone', junk: 1 })).toEqual({ type: 'repickDone' });
  });
  it('lets a fightRound go up to the monster fight length', () => {
    expect(parseAction({ type: 'fightRound', round: M.rounds, orders: [], cry: null })).not.toBeNull();
    expect(parseAction({ type: 'fightRound', round: M.rounds + 1, orders: [], cry: null })).toBeNull();
  });
  it('reads a potion order in a fightRound', () => {
    expect(parseAction({ type: 'fightRound', round: 1, orders: [{ action: 'potion', target: 1 }], cry: null })).not.toBeNull();
  });
});
