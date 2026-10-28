import { describe, expect, it } from 'vitest';
import { DEFAULT_PRACTICAL_SETTINGS, TROOP_COST } from '../maths/practical';
import { CONFIG } from './config';
import {
  KINGDOMS, area, barracksFor, battle, buildsLeft, buyTroops, canUpgrade, capacity, cleanPlan, empireNewDay, empireOf, fence, fixedPlan, friendlyWar, joinFollowers, kingdomSide, levelOf, levelTotal, lootGold,
  maxLevel, might, needsUpgrade, newEmpire, noTroops, planOf, RAIDABLE, raidClassmate, raidKingdom, raidNews, raidRefusal, room, safeGold, sideOf, syncVillage, totalCostToMax, upgrade, upgradeCost, upgradeSave,
  VILLAGE_TOTAL, villageComplete, villageLevels, type Party, type Side,
} from './empire';
import { barracksNeeded, landPlot, lootShare, troopBill } from './moments';
import { botOrders } from './bot';
import { newFight, playRound } from './fight';
import { payFight } from './play';
import { newClan, simulate } from './sim';
import { VILLAGE_BUILDINGS, type Clan, type OldEmpire, type Plot, type Troops } from './types';

const S = DEFAULT_PRACTICAL_SETTINGS;
const E = CONFIG.empire;

/** A clan with a purse and some building levels. */
function clanWith(gold = 100000, levels: Partial<Record<(typeof VILLAGE_BUILDINGS)[number], number>> = {}): Clan {
  const clan = newClan('balanced', 1);
  clan.gold = gold;
  Object.assign(empireOf(clan).levels, levels);
  syncVillage(clan);
  return clan;
}
const army = (footman: number, axeman = 0, knight = 0, extra: Partial<Side> = {}): Side => ({ troops: { footman, axeman, knight }, walls: 0, towers: 0, forge: 0, ...extra });
const wins = (a: Side, d: Side, plan: object, n = 100) => Array.from({ length: n }, (_, i) => battle(a, d, plan, i * 7919 + 5).outcome).filter((o) => o === 'won').length;

describe('the numbers', () => {
  it('uses the same troop prices as the troop-cost question', () => {
    expect(E.troopCost).toEqual(TROOP_COST);
    expect(E.troopCost).toEqual({ footman: 15, axeman: 30, knight: 60 });
    expect(E.troopCap).toEqual({ footman: 20, axeman: 10, knight: 5 });
  });

  it('has eight buildings, 2 builds a day, and the same tops the class village had', () => {
    expect(VILLAGE_BUILDINGS).toHaveLength(8);
    expect(E.buildsPerDay).toBe(2);
    expect([maxLevel('trainingHall'), maxLevel('smithy'), maxLevel('church')]).toEqual([5, 6, 3]);
    for (const b of ['barracks', 'walls', 'tower', 'forge', 'strongroom'] as const) expect(maxLevel(b)).toBe(5);
    expect(E.battle.rounds).toBe(3);
    expect(E.battle.loot).toBe(10);
  });

  it('a knight is worth four footmen, like its price', () => {
    expect(E.troopMight.knight * E.troopCost.footman).toBe(E.troopCost.knight);
    expect(E.troopMight.axeman * E.troopCost.footman).toBe(E.troopCost.axeman);
  });

  it('fills the whole village for a price a clan can reach in about a month', () => {
    // 39 levels in all; level n costs base * n.
    expect(VILLAGE_BUILDINGS.reduce((t, b) => t + maxLevel(b), 0)).toBe(39);
    expect(totalCostToMax()).toBe(VILLAGE_BUILDINGS.reduce((t, b) => t + E.buildings[b].base * ((maxLevel(b) * (maxLevel(b) + 1)) / 2), 0));
  });
});

describe('upgrades', () => {
  it('level n costs base times n, paid from the purse', () => {
    const clan = clanWith(10000);
    const base = E.buildings.walls.base;
    expect(upgradeCost('walls', 1)).toBe(base);
    expect(upgradeCost('walls', 3)).toBe(base * 3);
    expect(upgrade(clan, 'walls')).toEqual({ ok: true });
    expect(clan.gold).toBe(10000 - base);
    expect(levelOf(clan, 'walls')).toBe(1);
    expect(upgrade(clan, 'walls').ok).toBe(true);
    expect(clan.gold).toBe(10000 - base - base * 2);
    expect(levelOf(clan, 'walls')).toBe(2);
  });

  it('allows 2 builds a day across all buildings, and again tomorrow', () => {
    const clan = clanWith(100000);
    const e = empireOf(clan);
    expect(buildsLeft(e)).toBe(2);
    expect(upgrade(clan, 'tower').ok).toBe(true);
    expect(upgrade(clan, 'forge').ok).toBe(true);
    expect(buildsLeft(e)).toBe(0);
    const gold = clan.gold;
    expect(upgrade(clan, 'walls')).toMatchObject({ ok: false, why: 'builds' });
    expect(clan.gold).toBe(gold);
    empireNewDay(clan);
    expect(e.buildsToday).toBe(0);
    expect(upgrade(clan, 'walls').ok).toBe(true);
  });

  it('says why it cannot: gold, the top level, a building that is not there', () => {
    const poor = clanWith(upgradeCost('smithy', 1) - 1);
    expect(upgrade(poor, 'smithy')).toMatchObject({ ok: false, why: 'gold' });
    expect(poor.gold).toBe(upgradeCost('smithy', 1) - 1);
    const maxed = clanWith(100000, { church: maxLevel('church') });
    expect(upgrade(maxed, 'church')).toMatchObject({ ok: false, why: 'max' });
    expect(canUpgrade(clanWith(), 'moat' as never)).toMatchObject({ ok: false, why: 'building' });
  });

  it('keeps clan.village in step with the three old buildings', () => {
    const clan = clanWith(100000);
    upgrade(clan, 'smithy');
    upgrade(clan, 'church');
    expect(clan.village).toEqual({ trainingHall: 0, smithy: 1, church: 1 });
    empireNewDay(clan);
    upgrade(clan, 'trainingHall');
    expect(clan.village.trainingHall).toBe(1);
  });

  it('a new day clears the builds and raid counts', () => {
    const clan = clanWith();
    const e = empireOf(clan);
    e.buildsToday = 2;
    e.raidsToday = 1;
    e.kingdomRaidsToday = 1;
    e.raidedToday = ['x'];
    empireNewDay(clan);
    expect(e).toMatchObject({ buildsToday: 0, raidsToday: 0, kingdomRaidsToday: 0, raidedToday: [], day: 2 });
  });

  it('the plan for a building grows with its level, and the area and fence questions agree', () => {
    for (const b of VILLAGE_BUILDINGS) {
      let last = 0;
      for (let level = 1; level <= maxLevel(b); level++) {
        const p = planOf(b, level);
        expect(area(p.width, p.length), `${b} ${level}`).toBeGreaterThan(last);
        last = area(p.width, p.length);
        const q = landPlot(S, b, level)!;
        expect(q.area.answer).toBe(area(p.width, p.length));
        expect(q.fence.answer).toBe(fence(p.width, p.length));
        expect([q.width, q.length]).toEqual([p.width, p.length]);
      }
    }
    expect(planOf('barracks', 1)).toEqual({ width: 3, length: 3 });
    expect(area(planOf('barracks', 3).width, planOf('barracks', 3).length)).toBe(3 * (3 + 2));
  });
});

describe('troops and barracks', () => {
  it('each barracks level holds 20 footmen, 10 axemen and 5 knights', () => {
    const clan = clanWith(100000);
    const e = empireOf(clan);
    expect(capacity(e, 'footman')).toBe(0);
    e.levels.barracks = 3;
    expect([capacity(e, 'footman'), capacity(e, 'axeman'), capacity(e, 'knight')]).toEqual([60, 30, 15]);
  });

  it('buys troops at 15 / 30 / 60 gold from the purse, only as many as the barracks hold', () => {
    const clan = clanWith(10000, { barracks: 1 });
    const e = empireOf(clan);
    expect(buyTroops(clan, 'footman', 20)).toEqual({ ok: true });
    expect(clan.gold).toBe(10000 - 20 * 15);
    expect(buyTroops(clan, 'footman', 1)).toMatchObject({ ok: false, why: 'room' });
    expect(buyTroops(clan, 'knight', 5).ok).toBe(true);
    expect(buyTroops(clan, 'axeman', 0)).toMatchObject({ ok: false, why: 'amount' });
    expect(e.troops).toEqual({ footman: 20, axeman: 0, knight: 5 });
    expect(room(e, 'axeman')).toBe(10);
    expect(buyTroops(clanWith(10, { barracks: 1 }), 'footman', 1)).toMatchObject({ ok: false, why: 'gold' });
  });

  it('the troop-bill question gives exactly what buying costs', () => {
    const clan = clanWith(10000, { barracks: 2 });
    buyTroops(clan, 'footman', 12);
    buyTroops(clan, 'axeman', 7);
    buyTroops(clan, 'knight', 3);
    expect(10000 - clan.gold).toBe(troopBill(S, 12, 7, 3)!.answer);
  });

  it('the barracks question gives what the army really needs', () => {
    const troops: Troops = { footman: 45, axeman: 12, knight: 3 };
    expect(barracksFor(troops)).toMatchObject({ needed: 3, kind: 'footman' });
    expect(barracksNeeded(S, 45, E.troopCap.footman)!.answer).toBe(3);
  });

  it('followers join by themselves as footmen while the barracks have room; the rest stay as followers', () => {
    const clan = clanWith(0, { barracks: 1 });
    clan.followers = 27;
    expect(joinFollowers(clan)).toBe(20);
    expect(empireOf(clan).troops.footman).toBe(20);
    expect(clan.followers).toBe(7);
    expect(joinFollowers(clan)).toBe(0);
    expect(clan.followers).toBe(7);
  });

  it('a won mine fight pays its followers into the barracks by itself', () => {
    const clan = clanWith(0, { barracks: 1 });
    clan.followers = 0;
    const fight = newFight(clan.members, 0, 7, false);
    while (!fight.result) playRound(fight, botOrders(fight), null);
    fight.result = 'won';
    fight.followers = 26;
    payFight(clan, fight);
    expect(empireOf(clan).troops.footman).toBe(20);
    expect(clan.followers).toBe(6);
    // With no room left, the next win's followers all stay as followers.
    fight.followers = 4;
    payFight(clan, fight);
    expect(empireOf(clan).troops.footman).toBe(20);
    expect(clan.followers).toBe(10);
  });

  it('with no barracks nobody joins, and upgrading the barracks lets the waiting followers in', () => {
    const clan = clanWith(10000);
    clan.followers = 30;
    expect(joinFollowers(clan)).toBe(0);
    upgrade(clan, 'barracks');
    expect(empireOf(clan).troops.footman).toBe(20);
    expect(clan.followers).toBe(10);
  });
});

describe('battles', () => {
  const plan = { rounds: 4, push: 'steady' as const, loot: 10 };

  it('is the same every time for the same armies, plan and seed', () => {
    const a = battle(army(40, 20, 5), kingdomSide(KINGDOMS[2]), plan, 99);
    const b = battle(army(40, 20, 5), kingdomSide(KINGDOMS[2]), plan, 99);
    expect(a).toEqual(b);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });

  it('changes with the seed, so luck is real', () => {
    const outcomes = new Set(Array.from({ length: 60 }, (_, i) => JSON.stringify(battle(army(90), army(100), plan, i).rounds)));
    expect(outcomes.size).toBeGreaterThan(10);
  });

  it('a much bigger army wins and a much smaller one is turned back', () => {
    expect(wins(army(100), army(30), plan)).toBe(100);
    expect(wins(army(30), army(100), plan)).toBe(0);
  });

  it('a close battle can go either way', () => {
    const w = wins(army(100), army(90), { rounds: 5, push: 'steady', loot: 5 }, 300);
    expect(w).toBeGreaterThan(60);
    expect(w).toBeLessThan(290);
  });

  it('counts a knight as four footmen and an axeman as two', () => {
    expect(might({ footman: 3, axeman: 2, knight: 1 })).toBe(11);
  });

  it('nobody to send loses; nobody to meet wins', () => {
    expect(battle(army(0), army(10), plan, 1).outcome).toBe('lost');
    expect(battle(army(10), army(0), plan, 1).outcome).toBe('won');
  });

  it('walls help the defenders, towers help them hit back, the forge helps the raiders', () => {
    const base = wins(army(100), army(80), plan, 200);
    expect(wins(army(100), army(80, 0, 0, { walls: 4 }), plan, 200)).toBeLessThan(base);
    expect(wins(army(100), army(80, 0, 0, { towers: 4 }), plan, 200)).toBeLessThan(base);
    expect(wins(army(100, 0, 0, { forge: 3 }), army(80), plan, 200)).toBeGreaterThan(base);
  });

  it('walls divide the damage the defenders take by 1.1, 1.2 and so on (the rule sheet)', () => {
    const none = battle(army(100), army(100), { rounds: 1, push: 'steady', loot: 10 }, 5);
    const five = battle(army(100), army(100, 0, 0, { walls: 5 }), { rounds: 1, push: 'steady', loot: 10 }, 5);
    const hit = (r: ReturnType<typeof battle>) => 100 - r.rounds[0].defender;
    expect(hit(five)).toBeCloseTo(hit(none) / 1.5, -1);
    expect(hit(five)).toBeLessThan(hit(none));
  });

  it('towers and the forge add 10% a level', () => {
    const one = battle(army(100), army(100), { rounds: 1, push: 'steady', loot: 10 }, 5);
    const forged = battle(army(100, 0, 0, { forge: 5 }), army(100), { rounds: 1, push: 'steady', loot: 10 }, 5);
    expect(100 - forged.rounds[0].defender).toBeGreaterThan(100 - one.rounds[0].defender);
    expect(100 - forged.rounds[0].defender).toBeLessThanOrEqual(Math.ceil((100 - one.rounds[0].defender) * 1.5) + 1);
  });

  it('asking for more loot makes the defenders fight harder', () => {
    const asks = [5, 10, 15, 20].map((loot) => wins(army(100), army(85), { rounds: 5, push: 'steady', loot }, 300));
    expect(asks[0]).toBeGreaterThan(asks[3]);
  });

  it('too few rounds is a stalemate; a bold push finishes sooner and costs more troops', () => {
    expect(battle(army(100), army(90), { rounds: 1, push: 'careful', loot: 5 }, 3).outcome).toBe('stalemate');
    const lost = (push: 'careful' | 'steady' | 'bold') => {
      let total = 0;
      for (let i = 0; i < 100; i++) total += might(battle(army(100), army(60), { rounds: 5, push, loot: 5 }, i).attackerLost);
      return total;
    };
    expect(lost('careful')).toBeLessThan(lost('steady'));
    expect(lost('steady')).toBeLessThan(lost('bold'));
    const quick = (push: 'careful' | 'bold') => wins(army(100), army(70), { rounds: 2, push, loot: 5 });
    expect(quick('bold')).toBeGreaterThan(quick('careful'));
  });

  it('never loses more troops than there are', () => {
    for (let i = 0; i < 50; i++) {
      const r = battle(army(10, 5, 2), army(200, 50, 20), { rounds: 5, push: 'bold', loot: 20 }, i);
      expect(r.attackerLost.footman).toBeLessThanOrEqual(10);
      expect(r.attackerLost.axeman).toBeLessThanOrEqual(5);
      expect(r.attackerLost.knight).toBeLessThanOrEqual(2);
      expect(r.attackerLost.footman).toBeGreaterThanOrEqual(0);
    }
  });

  it('forces a plan into what is allowed', () => {
    expect(cleanPlan({ rounds: 99, push: 'wild' as never, loot: 17 })).toEqual({ rounds: 5, push: 'steady', loot: 15 });
    expect(cleanPlan({ rounds: 0, loot: 1 })).toMatchObject({ rounds: 1, loot: 5 });
    expect(cleanPlan({ loot: 50 }, 10).loot).toBe(10);
    expect(cleanPlan({}).rounds).toBe(3);
  });

  it('a raid or Friendly War plan is the chosen push with 3 rounds and 10% loot', () => {
    for (const push of ['careful', 'steady', 'bold'] as const) expect(fixedPlan(push)).toEqual({ rounds: 3, push, loot: 10 });
  });
});

describe('the six computer kingdoms', () => {
  const plan = fixedPlan('steady');
  it('are six, with different strengths, each stronger and richer than the last', () => {
    expect(KINGDOMS).toHaveLength(6);
    for (let i = 1; i < 6; i++) {
      expect(might(KINGDOMS[i].troops)).toBeGreaterThan(might(KINGDOMS[i - 1].troops));
      expect(KINGDOMS[i].treasury).toBeGreaterThan(KINGDOMS[i - 1].treasury);
    }
    expect(new Set(KINGDOMS.map((k) => k.id)).size).toBe(6);
    expect(new Set(KINGDOMS.map((k) => k.feel)).size).toBe(6);
  });

  it('can each be beaten by an army about twice their size, and not by one half their size', () => {
    for (const k of KINGDOMS) {
      const m = might(k.troops);
      expect(wins(army(Math.round(m * 2.2)), kingdomSide(k), plan, 60), k.name).toBe(60);
      expect(wins(army(Math.round(m * 0.5)), kingdomSide(k), plan, 60), k.name).toBe(0);
    }
  });

  it('the easy one can be beaten by a starter army and the hard one cannot', () => {
    expect(wins(army(20), kingdomSide(KINGDOMS[0]), plan)).toBe(100);
    expect(wins(army(20), kingdomSide(KINGDOMS[5]), plan)).toBe(0);
  });
});

describe('raids on computer kingdoms and Friendly War', () => {
  /** Three barracks levels, filled: 60 footmen, 30 axemen and 15 knights (180 strength). */
  function ready(full = true): Clan {
    const clan = clanWith(8000, { barracks: 3 });
    buyTroops(clan, 'footman', full ? 60 : 10);
    if (full) {
      buyTroops(clan, 'axeman', 30);
      buyTroops(clan, 'knight', 15);
    }
    return clan;
  }

  it('a win puts the loot in the purse, and the loot question gives that amount', () => {
    const clan = ready();
    const gold = clan.gold;
    const r = raidKingdom(clan, 'hilltop-hold', 'steady', 1);
    expect(r.ok && r.result.outcome).toBe('won');
    const got = r.ok ? r.gold : -1;
    expect(got).toBe(lootGold(KINGDOMS[2].treasury, 10));
    expect(got).toBe(lootShare(S, KINGDOMS[2].treasury, 10)?.answer);
    expect(r.ok && r.result.plan).toEqual({ rounds: 3, push: 'steady', loot: 10 });
    expect(clan.gold).toBe(gold + got);
  });

  it('every loot choice matches its question', () => {
    for (const k of KINGDOMS) for (const loot of E.battle.lootChoices) expect(lootGold(k.treasury, loot), `${k.name} ${loot}%`).toBe(lootShare(S, k.treasury, loot)?.answer);
  });

  it('a loss takes no loot but still costs the troops that do not come home', () => {
    const clan = ready();
    const before = empireOf(clan).troops.footman;
    const gold = clan.gold;
    const r = raidKingdom(clan, 'dragons-rest', 'steady', 1);
    expect(r.ok && r.result.outcome).toBe('lost');
    expect(r.ok && r.gold).toBe(0);
    expect(clan.gold).toBe(gold);
    expect(empireOf(clan).troops.footman).toBe(before - (r.ok ? r.result.attackerLost.footman : 0));
    expect(empireOf(clan).troops.footman).toBeLessThan(before);
  });

  it('allows the day\'s raids and no more, and needs troops', () => {
    const clan = ready();
    expect(raidKingdom(clan, 'bunny-hollow', 'steady', 1).ok).toBe(true);
    expect(raidKingdom(clan, 'bunny-hollow', 'steady', 2)).toMatchObject({ ok: false, why: 'limit' });
    expect(raidKingdom(clanWith(), 'bunny-hollow', 'steady', 2)).toMatchObject({ ok: false, why: 'army' });
    expect(raidKingdom(ready(), 'nowhere', 'steady', 2)).toMatchObject({ ok: false, why: 'kingdom' });
  });

  it('a Friendly War changes nothing at all', () => {
    const clan = ready();
    const before = JSON.stringify(clan);
    for (let i = 0; i < 5; i++) expect(friendlyWar(empireOf(clan), 'dragons-rest', 'steady', i).ok).toBe(true);
    const won = friendlyWar(empireOf(clan), 'bunny-hollow', 'steady', 1);
    expect(won.ok && won.result.outcome).toBe('won');
    expect(JSON.stringify(clan)).toBe(before);
    expect(friendlyWar(empireOf(clanWith()), 'bunny-hollow', 'steady', 1)).toMatchObject({ ok: false, why: 'army' });
  });

  it('a Friendly War gives the same result as the real raid would', () => {
    const clan = ready();
    const f = friendlyWar(empireOf(clan), 'ironwood', 'bold', 12);
    const r = raidKingdom(clan, 'ironwood', 'bold', 12);
    expect(f.ok && r.ok && f.result).toEqual(r.ok ? r.result : null);
  });
});

describe('raids on classmates', () => {
  function party(id: string, o: { footmen?: number; gold?: number; day?: number; levels?: Partial<Record<(typeof VILLAGE_BUILDINGS)[number], number>> } = {}): Party {
    const e = newEmpire(o.day ?? 1);
    e.levels.barracks = 3;
    Object.assign(e.levels, o.levels ?? {});
    e.troops.footman = o.footmen ?? 40;
    return { id, empire: e, gold: o.gold ?? 1000 };
  }
  const today = 10;
  const raid = (a: Party, d: Party, take: 'gold' | 'buildings', seed = 1, push: 'careful' | 'steady' | 'bold' = 'steady') => raidClassmate(a, d, take, push, seed, today);
  /** Finds a seed where the raiders win (the army is big enough that most seeds do). */
  const winning = (make: () => [Party, Party], take: 'gold' | 'buildings') => {
    for (let seed = 1; seed < 200; seed++) {
      const [a, d] = make();
      const r = raidClassmate(a, d, take, 'steady', seed, today);
      if (r.ok && r.result.outcome === 'won') return { a, d, r, seed };
    }
    throw new Error('no winning seed');
  };

  it('lets two fair, ready clans fight', () => {
    expect(raidRefusal(party('a'), party('b'), today)).toBeNull();
  });

  it('protects a clan for its first 3 days, and does not let a new clan raid either', () => {
    expect(raidRefusal(party('a'), party('b', { day: 9 }), 10)).toMatchObject({ why: 'new-defender' });
    expect(raidRefusal(party('a'), party('b', { day: 8 }), 10)).toMatchObject({ why: 'new-defender' });
    expect(raidRefusal(party('a'), party('b', { day: 7 }), 10)).toBeNull();
    expect(raidRefusal(party('a', { day: 9 }), party('b'), 10)).toMatchObject({ why: 'new-attacker' });
    expect(raidRefusal(party('a', { day: 7 }), party('b'), 10)).toBeNull();
  });

  it('allows one raid a day, and a teacher can switch them off', () => {
    const a = party('a');
    expect(raid(a, party('b'), 'gold').ok).toBe(true);
    expect(raidRefusal(a, party('c'), today)).toMatchObject({ why: 'limit' });
    expect(raidRefusal(party('a'), party('b'), today, false)).toMatchObject({ why: 'off' });
    expect(raidRefusal(party('a'), party('a'), today)).toMatchObject({ why: 'self' });
  });

  it('will not let the same clan be raided twice in a day by the same raider', () => {
    const a = party('a');
    a.empire.raidedToday.push('b');
    expect(raidRefusal(a, party('b'), today)).toMatchObject({ why: 'same' });
  });

  it('gives a raided clan a 1-day shield', () => {
    const d = party('b');
    raid(party('a'), d, 'gold');
    expect(d.empire.shieldUntil).toBe(today + 1);
    expect(raidRefusal(party('c'), d, today)).toMatchObject({ why: 'shield' });
    expect(raidRefusal(party('c'), d, today + 1)).toMatchObject({ why: 'shield' });
    expect(raidRefusal(party('c'), d, today + 2)).toBeNull();
  });

  it('only matches clans with armies of a similar size', () => {
    expect(raidRefusal(party('a', { footmen: 20 }), party('b', { footmen: 41 }), today)).toMatchObject({ why: 'unfair' });
    expect(raidRefusal(party('a', { footmen: 20 }), party('b', { footmen: 40 }), today)).toBeNull();
    expect(raidRefusal(party('a', { footmen: 0 }), party('b'), today)).toMatchObject({ why: 'army' });
  });

  it('takes up to 10% of the purse above the strongroom\'s safe gold, rounded up, and the gold only moves', () => {
    const { a, d, r } = winning(() => [party('a', { footmen: 60, gold: 50 }), party('b', { gold: 1005 })], 'gold');
    expect(r.ok && r.gold).toBe(Math.ceil(1005 * 0.1));
    expect(d.gold).toBe(1005 - 101);
    expect(a.gold).toBe(50 + 101);
    const safe = winning(() => [party('a', { footmen: 60, gold: 0 }), party('b', { gold: 1005, levels: { strongroom: 2 } })], 'gold');
    expect(safeGold(safe.d.empire)).toBe(400);
    expect(safe.r.ok && safe.r.gold).toBe(Math.ceil((1005 - 400) * 0.1));
  });

  it('a strongroom that holds everything leaves nothing to take', () => {
    const { a, d, r } = winning(() => [party('a', { footmen: 60, gold: 0 }), party('b', { gold: 300, levels: { strongroom: 2 } })], 'gold');
    expect(r.ok && r.gold).toBe(0);
    expect(d.gold).toBe(300);
    expect(a.gold).toBe(0);
  });

  it('knocks one level off some buildings: 10% of all levels rounded up, less one for each Walls level, never Walls or Strongroom', () => {
    const levels = { trainingHall: 4, smithy: 4, church: 2, barracks: 5, tower: 5, forge: 5, walls: 0, strongroom: 4 };
    const { d, r } = winning(() => [party('a', { footmen: 60 }), party('b', { levels })], 'buildings');
    const total = 4 + 4 + 2 + 5 + 5 + 5 + 4;
    expect(total).toBe(29);
    expect(r.ok && r.destroyed).toHaveLength(3);
    expect(levelTotal(d.empire)).toBe(total - 3);
    expect(d.empire.levels.strongroom).toBe(4);
    expect(d.empire.levels.walls).toBe(0);
    for (const b of VILLAGE_BUILDINGS) expect(d.empire.levels[b]).toBeGreaterThanOrEqual(0);
  });

  it('walls make a raider knock down fewer levels, and the walls themselves stay up', () => {
    const levels = { trainingHall: 4, smithy: 4, church: 2, barracks: 5, tower: 5, forge: 5, strongroom: 4 };
    const one = winning(() => [party('a', { footmen: 60 }), party('b', { levels: { ...levels, walls: 1 } })], 'buildings');
    expect(one.r.ok && one.r.destroyed).toHaveLength(Math.ceil(30 * 0.1) - 1);
    const lots = winning(() => [party('a', { footmen: 60 }), party('b', { levels: { ...levels, walls: 5 } })], 'buildings');
    expect(lots.r.ok && lots.r.destroyed).toHaveLength(0);
    expect(lots.d.empire.levels.walls).toBe(5);
  });

  it('stops when there is nothing left to knock down', () => {
    const { d, r } = winning(() => [party('a', { footmen: 60 }), party('b', { levels: { barracks: 1, strongroom: 5 } })], 'buildings');
    expect(r.ok).toBe(true);
    expect(d.empire.levels.strongroom).toBe(5);
    expect(d.empire.levels.barracks).toBeGreaterThanOrEqual(0);
  });

  it('a raid that fails takes nothing, and both sides lose the troops that do not come home', () => {
    for (let seed = 1; seed < 200; seed++) {
      const a = party('a', { footmen: 22 });
      const d = party('b', { footmen: 44, levels: { walls: 3, tower: 3 } });
      const before = { a: a.empire.troops.footman, d: d.empire.troops.footman };
      const r = raidClassmate(a, d, 'gold', 'bold', seed, today);
      if (!r.ok || r.result.outcome === 'won') continue;
      expect(r.gold).toBe(0);
      expect(r.destroyed).toEqual([]);
      expect(a.gold).toBe(1000);
      expect(d.gold).toBe(1000);
      expect(a.empire.troops.footman).toBe(before.a - r.result.attackerLost.footman);
      expect(d.empire.troops.footman).toBe(before.d - r.result.defenderLost.footman);
      return;
    }
    throw new Error('no failed raid found');
  });

  it('is replayable from the two armies and a seed, and the plan is fixed at 3 rounds and 10%', () => {
    const one = raid(party('a'), party('b'), 'gold', 33);
    const two = raid(party('a'), party('b'), 'gold', 33);
    expect(one).toEqual(two);
    expect(one.ok && one.result.plan).toEqual({ rounds: 3, push: 'steady', loot: 10 });
  });

  it('refuses a take that is not gold or buildings', () => {
    expect(raid(party('a'), party('b'), 'land' as never)).toMatchObject({ ok: false, why: 'take' });
  });

  it('the news names only the raiding clan, never anyone\'s private id', () => {
    const r = { result: { outcome: 'won' } as never, take: 'gold' as const, gold: 70, destroyed: [] };
    expect(raidNews('Red Banner', r)).toBe('A raider from the Red Banner clan took 70 gold.');
    expect(raidNews('Red Banner', { ...r, result: { outcome: 'lost' } as never })).toBe('A raider from the Red Banner clan was driven off.');
    expect(raidNews('Red Banner', { ...r, take: 'buildings', destroyed: ['tower', 'forge'] })).toContain('2 levels');
  });
});

describe('upgradeSave: moving an old empire into My Village', () => {
  const plot = (building?: Plot['building'], width = 3, length = 5): Plot => ({ width, length, ...(building ? { building } : {}) });
  function oldClan(o: Partial<OldEmpire> = {}, gold = 500): Clan {
    const base = newClan('balanced', 3);
    const old: OldEmpire = {
      vault: 0, wild: 10, claimed: 0, plots: [], troops: { footman: 12, axeman: 4, knight: 1 }, draftPercent: 10, day: 9, createdDay: 2, energyUsed: 40,
      raidsToday: 1, kingdomRaidsToday: 1, shieldUntil: 11, raidedToday: ['zed'], ...o,
    };
    return { ...base, gold, followers: 5, village: { trainingHall: 1, smithy: 1, church: 1 }, empire: old as never };
  }

  it('never lets a raid knock down Walls, the Strongroom or the Barracks', () => {
    expect([...RAIDABLE].sort()).toEqual(['church', 'forge', 'smithy', 'tower', 'trainingHall']);
  });

  it('pays back buildings beyond the top level at their old price', () => {
    const up = upgradeSave(oldClan({ plots: Array.from({ length: 7 }, () => plot('barracks')) }, 0), null);
    expect(up.empire!.levels.barracks).toBe(5);
    expect(up.gold).toBe(2 * 100);
  });

  it('puts vault gold in the purse and keeps troops, days, shield and raid counts', () => {
    const up = upgradeSave(oldClan({ vault: 750 }), null);
    expect(up.gold).toBe(1250);
    const e = up.empire!;
    expect(e).toMatchObject({ version: 2, buildsToday: 0, troops: { footman: 12, axeman: 4, knight: 1 }, day: 9, createdDay: 2, raidsToday: 1, kingdomRaidsToday: 1, shieldUntil: 11, raidedToday: ['zed'] });
    for (const gone of ['vault', 'wild', 'claimed', 'plots', 'energyUsed', 'draftPercent']) expect(e).not.toHaveProperty(gone);
    expect(up.followers).toBe(5);
  });

  it('takes the Training Hall, Smithy and Church levels from the group village, or the clan\'s own village if none, and keeps clan.village in step', () => {
    const fromGroup = upgradeSave(oldClan(), { trainingHall: 3, smithy: 6, church: 2 });
    expect(fromGroup.empire!.levels).toMatchObject({ trainingHall: 3, smithy: 6, church: 2 });
    expect(fromGroup.village).toEqual({ trainingHall: 3, smithy: 6, church: 2 });
    const fallback = upgradeSave(oldClan(), undefined);
    expect(fallback.empire!.levels).toMatchObject({ trainingHall: 1, smithy: 1, church: 1 });
    expect(upgradeSave(oldClan(), { trainingHall: 99, smithy: 99, church: 99 }).empire!.levels).toMatchObject({ trainingHall: 5, smithy: 6, church: 3 });
  });

  it('turns buildings into levels: counts, capped, Steel Mill becomes the Forge', () => {
    const plots = [...Array(12).fill(0).map(() => plot('barracks')), plot('walls'), plot('walls'), plot('tower'), plot('steelMill'), plot('steelMill')];
    const up = upgradeSave(oldClan({ plots }), null);
    expect(up.empire!.levels).toMatchObject({ barracks: 5, walls: 2, tower: 1, forge: 2, strongroom: 0 });
  });

  it('gives back the develop price of spare plots and the gold price of Stables, Gymnasium and Developer\'s Hall; wild land gives nothing', () => {
    const plots = [plot(undefined, 3, 5), plot(undefined, 2, 2), plot('stables'), plot('stables'), plot('gymnasium'), plot('developersHall'), plot('tower')];
    const up = upgradeSave(oldClan({ plots, wild: 25, claimed: 15 }, 100), null);
    const plotA = 3 * 5 * E.legacy.landPerSquare + 2 * (3 + 5) * E.legacy.fencePerUnit;
    const plotB = 2 * 2 * E.legacy.landPerSquare + 2 * (2 + 2) * E.legacy.fencePerUnit;
    expect(up.gold).toBe(100 + plotA + plotB + 2 * 100 + 100 + 150);
    expect(up.empire!.levels).toMatchObject({ tower: 1, barracks: 0 });
  });

  it('is pure: the clan that comes in is not changed', () => {
    const clan = oldClan({ vault: 10 });
    const copy = JSON.stringify(clan);
    upgradeSave(clan, { trainingHall: 2, smithy: 2, church: 2 });
    expect(JSON.stringify(clan)).toBe(copy);
  });

  it('is idempotent: a converted save is never converted again, whatever group levels are passed', () => {
    const once = upgradeSave(oldClan({ vault: 400, plots: [plot('barracks'), plot(undefined)] }), { trainingHall: 2, smithy: 2, church: 2 });
    const twice = upgradeSave(once, { trainingHall: 5, smithy: 6, church: 3 });
    expect(twice).toEqual(once);
    expect(needsUpgrade(once)).toBe(false);
    expect(needsUpgrade(oldClan())).toBe(true);
    expect(upgradeSave(twice, null)).toEqual(once);
  });

  it('gives a clan that never opened its empire a fresh one with the group village levels', () => {
    const base = newClan('balanced', 4);
    delete base.empire;
    const up = upgradeSave(base, { trainingHall: 1, smithy: 0, church: 2 });
    expect(up.empire).toMatchObject({ version: 2, troops: noTroops() });
    expect(up.empire!.levels).toMatchObject({ trainingHall: 1, church: 2, barracks: 0 });
    expect(up.gold).toBe(base.gold);
  });

  it('survives being saved as JSON', () => {
    const up = upgradeSave(oldClan({ vault: 5, plots: [plot('walls')] }), null);
    expect(JSON.parse(JSON.stringify(up))).toEqual(up);
  });

  it('empireOf converts an old-shape empire on the spot, using the clan\'s own village', () => {
    const clan = oldClan({ vault: 100 }, 0);
    const e = empireOf(clan);
    expect(e.version).toBe(2);
    expect(clan.gold).toBe(100);
    expect(e.levels.smithy).toBe(1);
  });
});

describe('the whole thing with the simulator', () => {
  const run = (lineup: 'balanced' | 'fighters', empire: boolean, days = 35, seeds = 6) => Array.from({ length: seeds }, (_, i) => simulate({ days, seed: i + 1, lineup, mathsRate: 0.7, depthOffset: 0, empire }));
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  it('a clan fills its whole village within 3 to 4 weeks, and the purse never goes below nothing', () => {
    for (const lineup of ['balanced', 'fighters'] as const) {
      const runs = run(lineup, true, 45);
      const first = runs.map((r) => r.days.find((d) => d.empire!.allMax)?.day ?? Infinity);
      expect(mean(first), lineup).toBeGreaterThanOrEqual(17);
      expect(mean(first), lineup).toBeLessThanOrEqual(28);
      for (const r of runs) for (const d of r.days) expect(d.gold).toBeGreaterThanOrEqual(0);
    }
  });

  it('builds the barracks and an army early', () => {
    const day21 = run('balanced', true).map((r) => r.days[20].empire!);
    expect(mean(day21.map((d) => d.barracks))).toBeGreaterThanOrEqual(3);
    expect(mean(day21.map((d) => d.might))).toBeGreaterThanOrEqual(150);
  });

  it('a clan that tries a Friendly War first wins nearly all its raids', () => {
    const raids = run('balanced', true).flatMap((r) => r.days.map((d) => d.empire!));
    const made = raids.reduce((t, d) => t + d.raids, 0);
    expect(made).toBeGreaterThan(50);
    expect(raids.reduce((t, d) => t + d.raidWins, 0) / made).toBeGreaterThanOrEqual(0.95);
  });

  it('having a village never makes the mines harder (the Training Hall and Smithy only help)', () => {
    for (const lineup of ['balanced', 'fighters'] as const) {
      const [a, b] = [run(lineup, true), run(lineup, false)];
      expect(mean(a.map((r) => r.wins / r.fights)), lineup).toBeGreaterThanOrEqual(mean(b.map((r) => r.wins / r.fights)) - 0.02);
      expect(mean(a.map((r) => r.days[29].avgLevel)), lineup).toBeGreaterThanOrEqual(mean(b.map((r) => r.days[29].avgLevel)) - 0.3);
    }
  });

  it('is the same every time', () => {
    expect(JSON.stringify(run('balanced', true, 15, 2))).toBe(JSON.stringify(run('balanced', true, 15, 2)));
  });

  it('every starting state can be saved and read back as plain data', () => {
    const e = newEmpire(3);
    expect(JSON.parse(JSON.stringify(e))).toEqual(e);
    expect(sideOf(e).troops).toEqual(noTroops());
  });
});

describe('saved builds', () => {
  it('every building costs 50 a level at base, and the village is 39 levels', () => {
    for (const b of VILLAGE_BUILDINGS) expect(E.buildings[b].base).toBe(50);
    expect(E.buildsSavedMax).toBe(4);
    expect(VILLAGE_TOTAL).toBe(39);
  });

  it('banks unused builds when a day ends, and keeps at most buildsSavedMax', () => {
    const clan = clanWith();
    const e = empireOf(clan);
    empireNewDay(clan);
    expect(e.buildsSaved).toBe(2);
    expect(buildsLeft(e)).toBe(4);
    empireNewDay(clan);
    expect(e.buildsSaved).toBe(4);
    empireNewDay(clan);
    expect(e.buildsSaved).toBe(E.buildsSavedMax);
    expect(buildsLeft(e)).toBe(E.buildsPerDay + E.buildsSavedMax);
  });

  it('banks only the builds that were not used, and a missed day gives a full set', () => {
    const clan = clanWith();
    const e = empireOf(clan);
    e.buildsToday = 1;
    empireNewDay(clan);
    expect(e.buildsSaved).toBe(1);
    empireNewDay(clan, 1);
    expect(e.buildsSaved).toBe(4);
  });

  it('uses today\'s builds first and a saved one only when they are gone', () => {
    const clan = clanWith();
    const e = empireOf(clan);
    e.buildsSaved = 3;
    expect(upgrade(clan, 'tower').ok).toBe(true);
    expect(upgrade(clan, 'forge').ok).toBe(true);
    expect([e.buildsToday, e.buildsSaved]).toEqual([2, 3]);
    expect(upgrade(clan, 'walls').ok).toBe(true);
    expect([e.buildsToday, e.buildsSaved]).toEqual([2, 2]);
    expect(buildsLeft(e)).toBe(2);
    e.buildsSaved = 0;
    expect(upgrade(clan, 'church')).toMatchObject({ ok: false, why: 'builds', say: 'Your builders have done every job they can. They start again tomorrow!' });
  });

  it('counts a village as complete only when every building is at its top level', () => {
    const clan = clanWith(0);
    const e = empireOf(clan);
    expect(villageLevels(e)).toBe(0);
    expect(villageComplete(e)).toBe(false);
    for (const b of VILLAGE_BUILDINGS) e.levels[b] = maxLevel(b);
    expect(villageLevels(e)).toBe(VILLAGE_TOTAL);
    expect(villageComplete(e)).toBe(true);
    e.levels.walls--;
    expect(villageComplete(e)).toBe(false);
  });
});
