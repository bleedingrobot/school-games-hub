import { describe, expect, it } from 'vitest';
import { DEFAULT_PRACTICAL_SETTINGS, TROOP_COST } from '../maths/practical';
import { CONFIG } from './config';
import {
  KINGDOMS, area, barracksFor, battle, build, buildingTotal, buyTroops, canBuild, capacity, claimCost, claimLand, cleanPlan, countBuildings, deposit, developPlot, draft, draftMax, draftWanted, emptyLand, empireNewDay,
  buildingsThatFit, shapesFor, smallestBuildingSize, empireOf, energyLeft, fence, friendlyWar, kingdomSide, lootGold, might, newEmpire, noTroops, plotCost, raidClassmate, raidKingdom, raidNews, raidRefusal, room, setDraft, sideOf, withdraw, type Party, type Side,
} from './empire';
import { barracksNeeded, draftJoin, energyLeft as energyLeftMoment, landPlot, lootShare, troopBill } from './moments';
import { newClan, simulate } from './sim';
import type { BuildingKind, Clan, Empire } from './types';

const S = DEFAULT_PRACTICAL_SETTINGS;
const E = CONFIG.empire;

/** An empire with gold and as many plots developed as asked for, each exactly big enough for a barracks. */
function rich(gold = 10000, plots = 0): Empire {
  const e = newEmpire();
  e.vault = gold;
  for (let i = 0; i < plots; i++) developPlot(e, 3, 5);
  return e;
}
const army = (footman: number, axeman = 0, knight = 0, extra: Partial<Side> = {}): Side => ({ troops: { footman, axeman, knight }, walls: 0, towers: 0, mills: 0, stables: 0, ...extra });
const wins = (a: Side, d: Side, plan: object, n = 100) => Array.from({ length: n }, (_, i) => battle(a, d, plan, i * 7919 + 5).outcome).filter((o) => o === 'won').length;

describe('the numbers', () => {
  it('uses the same troop prices as the troop-cost question', () => {
    expect(E.troopCost).toEqual(TROOP_COST);
    expect(E.troopCost).toEqual({ footman: 15, axeman: 30, knight: 60 });
    expect(E.troopCap).toEqual({ footman: 20, axeman: 10, knight: 5 });
    expect(CONFIG.empire.energyPerDay).toBe(100);
  });

  it('keeps the plan\'s worker-energy example: barracks 30, walls 7, towers 12', () => {
    expect([E.buildings.barracks.energy, E.buildings.walls.energy, E.buildings.tower.energy]).toEqual([30, 7, 12]);
  });

  it('has a plot big enough for every building, and no building takes more than a day of work', () => {
    const biggest = E.plotSide.max * E.plotSide.max;
    for (const [kind, def] of Object.entries(E.buildings)) {
      expect(def.size, kind).toBeLessThanOrEqual(biggest);
      expect(def.size, kind).toBeLessThanOrEqual(15);
      expect(def.energy, kind).toBeLessThanOrEqual(E.energyPerDay);
    }
  });

  it('a knight is worth four footmen, like its price', () => {
    expect(E.troopMight.knight * E.troopCost.footman).toBe(E.troopCost.knight);
    expect(E.troopMight.axeman * E.troopCost.footman).toBe(E.troopCost.axeman);
  });
});

describe('land', () => {
  it('prices a plot from its squares and its fence, and rounds the Developer\'s Hall discount up', () => {
    const e = newEmpire();
    expect(area(4, 5)).toBe(20);
    expect(fence(4, 5)).toBe(18);
    expect(plotCost(e, 4, 5)).toBe(20 * E.landPerSquare + 18 * E.fencePerUnit);
    e.plots.push({ width: 3, length: 5, building: 'developersHall' });
    expect(plotCost(e, 4, 5)).toBe(Math.ceil((58 * 90) / 100));
  });

  it('develops wild land, takes gold and one wild plot', () => {
    const e = rich(100);
    expect(developPlot(e, 4, 5)).toEqual({ ok: true });
    expect(e.vault).toBe(100 - plotCost(newEmpire(), 4, 5));
    expect(e.wild).toBe(E.startWild - 1);
    expect(e.plots).toEqual([{ width: 4, length: 5 }]);
  });

  it('says why it cannot: gold, size, no wild land', () => {
    const poor = newEmpire();
    expect(developPlot(poor, 4, 5)).toMatchObject({ ok: false, why: 'gold' });
    expect(developPlot(rich(), 1, 5)).toMatchObject({ ok: false, why: 'size' });
    expect(developPlot(rich(), 4, 7)).toMatchObject({ ok: false, why: 'size' });
    expect(developPlot(rich(), 2.5, 4)).toMatchObject({ ok: false, why: 'size' });
    const full = rich();
    full.wild = 0;
    expect(developPlot(full, 3, 3)).toMatchObject({ ok: false, why: 'land' });
  });

  it('claims more wild land for a rising price, up to a limit', () => {
    const e = rich(100000);
    expect(claimCost(e)).toBe(E.claim.base);
    claimLand(e);
    expect(claimCost(e)).toBe(E.claim.base + E.claim.step);
    expect(e.wild).toBe(E.startWild + 1);
    while (e.claimed < E.claim.max) expect(claimLand(e).ok).toBe(true);
    expect(claimLand(e)).toMatchObject({ ok: false, why: 'max' });
    expect(claimLand(newEmpire())).toMatchObject({ ok: false, why: 'gold' });
  });
});

describe('buildings and worker energy', () => {
  it('builds on a big enough plot and uses gold and energy', () => {
    const e = rich(1000, 1);
    const before = e.vault;
    expect(build(e, 0, 'barracks')).toEqual({ ok: true });
    expect(e.vault).toBe(before - E.buildings.barracks.gold);
    expect(e.energyUsed).toBe(30);
    expect(energyLeft(e)).toBe(70);
    expect(countBuildings(e, 'barracks')).toBe(1);
  });

  it('refuses a plot that is too small, one already taken, or one that does not exist', () => {
    const e = rich(1000);
    developPlot(e, 2, 3);
    expect(canBuild(e, 0, 'barracks')).toMatchObject({ ok: false, why: 'size' });
    expect(canBuild(e, 0, 'walls')).toEqual({ ok: true });
    build(e, 0, 'walls');
    expect(canBuild(e, 0, 'tower')).toMatchObject({ ok: false, why: 'taken' });
    expect(canBuild(e, 5, 'tower')).toMatchObject({ ok: false, why: 'plot' });
  });

  it('stops when the day\'s energy or the gold runs out, and again tomorrow', () => {
    const clan = newClan('balanced', 1);
    const e = empireOf(clan);
    e.vault = 5000;
    for (let i = 0; i < 5; i++) developPlot(e, 3, 5);
    expect(build(e, 0, 'barracks').ok).toBe(true);
    expect(build(e, 1, 'barracks').ok).toBe(true);
    expect(build(e, 2, 'barracks').ok).toBe(true);
    expect(e.energyUsed).toBe(90);
    expect(build(e, 3, 'barracks')).toMatchObject({ ok: false, why: 'energy' });
    expect(build(e, 3, 'tower')).toMatchObject({ ok: false, why: 'energy' });
    expect(build(e, 3, 'walls').ok).toBe(true);
    expect(energyLeft(e)).toBe(3);
    empireNewDay(clan);
    expect(build(e, 4, 'barracks').ok).toBe(true);
  });

  it('can always do the plan\'s example sum: barracks 30%, walls 7%, towers 12% leaves 51%', () => {
    const e = rich(5000, 3);
    expect(build(e, 0, 'barracks').ok && build(e, 1, 'walls').ok && build(e, 2, 'tower').ok).toBe(true);
    expect(energyLeft(e)).toBe(51);
    expect(energyLeftMoment(S, 30, 7, 12)?.answer).toBe(51);
  });

  it('limits how many of each building you can have', () => {
    const e = rich(100000, 8);
    e.vault = 100000;
    for (let i = 0; i < 6; i++) {
      e.energyUsed = 0;
      build(e, i, 'stables');
    }
    expect(countBuildings(e, 'stables')).toBe(E.buildings.stables.max);
  });

  it('a new day gives the workers their energy back and clears the raid counts', () => {
    const clan = newClan('balanced', 2);
    const e = empireOf(clan);
    e.energyUsed = 80;
    e.raidsToday = 1;
    e.kingdomRaidsToday = 1;
    e.raidedToday = ['x'];
    empireNewDay(clan);
    expect(e).toMatchObject({ energyUsed: 0, raidsToday: 0, kingdomRaidsToday: 0, raidedToday: [], day: 2 });
  });
});

describe('gold, troops and the draft', () => {
  it('keeps the clan purse and the vault apart', () => {
    const clan = newClan('balanced', 3);
    clan.gold = 500;
    expect(deposit(clan, 200)).toEqual({ ok: true });
    expect([clan.gold, empireOf(clan).vault]).toEqual([300, 200]);
    expect(deposit(clan, 400)).toMatchObject({ ok: false, why: 'gold' });
    expect(withdraw(clan, 50)).toEqual({ ok: true });
    expect([clan.gold, empireOf(clan).vault]).toEqual([350, 150]);
    expect(withdraw(clan, 500)).toMatchObject({ ok: false });
    expect(deposit(clan, 0)).toMatchObject({ ok: false });
  });

  it('a barracks holds 20 footmen, 10 axemen and 5 knights, and only built barracks count', () => {
    const e = rich(5000, 2);
    expect(capacity(e, 'footman')).toBe(0);
    build(e, 0, 'barracks');
    build(e, 1, 'barracks');
    expect([capacity(e, 'footman'), capacity(e, 'axeman'), capacity(e, 'knight')]).toEqual([40, 20, 10]);
  });

  it('buys troops at 15 / 30 / 60 gold, only as many as the barracks hold', () => {
    const e = rich(5000, 1);
    build(e, 0, 'barracks');
    const gold = e.vault;
    expect(buyTroops(e, 'footman', 12)).toEqual({ ok: true });
    expect(buyTroops(e, 'axeman', 4)).toEqual({ ok: true });
    expect(buyTroops(e, 'knight', 2)).toEqual({ ok: true });
    expect(gold - e.vault).toBe(12 * 15 + 4 * 30 + 2 * 60);
    expect(room(e, 'footman')).toBe(8);
    expect(buyTroops(e, 'footman', 9)).toMatchObject({ ok: false, why: 'room' });
    expect(buyTroops(e, 'knight', 0)).toMatchObject({ ok: false, why: 'amount' });
    e.vault = 10;
    expect(buyTroops(e, 'footman', 2)).toMatchObject({ ok: false, why: 'gold' });
  });

  it('the troop-bill question gives exactly what buying costs', () => {
    const e = rich(5000, 1);
    build(e, 0, 'barracks');
    const q = troopBill(S, 12, 4, 2)!;
    const gold = e.vault;
    buyTroops(e, 'footman', 12);
    buyTroops(e, 'axeman', 4);
    buyTroops(e, 'knight', 2);
    expect(gold - e.vault).toBe(q.answer);
  });

  it('the barracks question gives what the army really needs', () => {
    const t = { footman: 85, axeman: 0, knight: 0 };
    expect(barracksFor(t)).toMatchObject({ needed: 5, kind: 'footman' });
    expect(barracksNeeded(S, 85, 20)?.answer).toBe(5);
    expect(barracksFor({ footman: 20, axeman: 11, knight: 0 })).toMatchObject({ needed: 2, kind: 'axeman' });
    expect(barracksFor({ footman: 20, axeman: 10, knight: 5 }).needed).toBe(1);
    expect(barracksFor(noTroops()).needed).toBe(0);
    for (const [n, cap] of [[85, 20], [41, 10], [11, 5], [60, 20]]) {
      const kind = cap === 20 ? 'footman' : cap === 10 ? 'axeman' : 'knight';
      expect(barracksFor({ ...noTroops(), [kind]: n }).needed).toBe(barracksNeeded(S, n, cap)?.answer);
    }
  });

  it('the draft takes a share of the followers, rounded up, and the question agrees', () => {
    const clan = newClan('balanced', 4);
    const e = empireOf(clan);
    e.vault = 5000;
    for (let i = 0; i < 2; i++) developPlot(e, 3, 5);
    build(e, 0, 'barracks');
    build(e, 1, 'barracks');
    setDraft(e, 20);
    clan.followers = 53;
    const q = draftJoin(S, 53, 20)!;
    expect(q.answer).toBe(11);
    expect(draftWanted(53, 20)).toBe(11);
    const got = draft(clan);
    expect(got).toEqual({ wanted: 11, joined: 11, followers: 53 });
    expect(e.troops.footman).toBe(q.answer);
    expect(clan.followers).toBe(0);
  });

  it('the draft can only fill the barracks, and 0% drafts nobody', () => {
    const clan = newClan('balanced', 5);
    const e = empireOf(clan);
    clan.followers = 100;
    setDraft(e, 20);
    expect(draft(clan)).toMatchObject({ wanted: 20, joined: 0 });
    clan.followers = 100;
    setDraft(e, 0);
    expect(draft(clan)).toMatchObject({ wanted: 0, joined: 0 });
  });

  it('allows a draft of 0 to 20% in fives, and 5% more for each Gymnasium', () => {
    const e = rich(5000, 2);
    expect([setDraft(e, 20).ok, setDraft(e, 0).ok, setDraft(e, 5).ok]).toEqual([true, true, true]);
    for (const bad of [25, -5, 7, 12.5]) expect(setDraft(e, bad)).toMatchObject({ ok: false, why: 'draft' });
    build(e, 0, 'gymnasium');
    expect(draftMax(e)).toBe(25);
    expect(setDraft(e, 25).ok).toBe(true);
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

  it('walls help the defenders, towers help them hit back, mills help the raiders', () => {
    const base = wins(army(100), army(80), plan, 200);
    expect(wins(army(100), army(80, 0, 0, { walls: 4 }), plan, 200)).toBeLessThan(base);
    expect(wins(army(100), army(80, 0, 0, { towers: 4 }), plan, 200)).toBeLessThan(base);
    expect(wins(army(100, 0, 0, { mills: 3 }), army(80), plan, 200)).toBeGreaterThan(base);
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

  it('never loses more troops than there are, and stables bring more home', () => {
    for (let i = 0; i < 50; i++) {
      const r = battle(army(10, 5, 2), army(200, 50, 20), { rounds: 5, push: 'bold', loot: 20 }, i);
      expect(r.attackerLost.footman).toBeLessThanOrEqual(10);
      expect(r.attackerLost.axeman).toBeLessThanOrEqual(5);
      expect(r.attackerLost.knight).toBeLessThanOrEqual(2);
      expect(r.attackerLost.footman).toBeGreaterThanOrEqual(0);
    }
    const one = might(battle(army(100), army(100), plan, 7).attackerLost);
    const two = might(battle(army(100, 0, 0, { stables: 3 }), army(100), plan, 7).attackerLost);
    expect(two).toBeLessThan(one);
  });

  it('forces a plan into what is allowed', () => {
    expect(cleanPlan({ rounds: 99, push: 'wild' as never, loot: 17 })).toEqual({ rounds: 5, push: 'steady', loot: 15 });
    expect(cleanPlan({ rounds: 0, loot: 1 })).toMatchObject({ rounds: 1, loot: 5 });
    expect(cleanPlan({ loot: 50 }, 10).loot).toBe(10);
    expect(cleanPlan({}).rounds).toBeGreaterThanOrEqual(1);
  });
});

describe('the six computer kingdoms', () => {
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
      const big = army(Math.round(m * 2));
      const small = army(Math.round(m * 0.5));
      expect(wins(big, kingdomSide(k), { rounds: 4, push: 'steady', loot: 10 }, 60), k.name).toBe(60);
      expect(wins(small, kingdomSide(k), { rounds: 4, push: 'steady', loot: 10 }, 60), k.name).toBe(0);
    }
  });

  it('the easy one can be beaten by a starter army and the hard one cannot', () => {
    expect(wins(army(20), kingdomSide(KINGDOMS[0]), { rounds: 4, push: 'steady', loot: 10 })).toBe(100);
    expect(wins(army(20), kingdomSide(KINGDOMS[5]), { rounds: 4, push: 'steady', loot: 10 })).toBe(0);
  });
});

describe('raids on computer kingdoms and Friendly War', () => {
  /** Three barracks, filled: 60 footmen, 30 axemen and 15 knights (180 strength). */
  function ready(full = true): Empire {
    const e = rich(8000, 3);
    build(e, 0, 'barracks');
    build(e, 1, 'barracks');
    build(e, 2, 'barracks');
    buyTroops(e, 'footman', full ? 60 : 10);
    if (full) {
      buyTroops(e, 'axeman', 30);
      buyTroops(e, 'knight', 15);
    }
    return e;
  }
  const plan = { rounds: 4, push: 'steady' as const, loot: 10 };

  it('a win puts the loot in the vault, and the loot question gives that amount', () => {
    const e = ready();
    const vault = e.vault;
    const r = raidKingdom(e, 'hilltop-hold', plan, 1);
    expect(r.ok && r.result.outcome).toBe('won');
    const gold = r.ok ? r.gold : -1;
    expect(gold).toBe(lootGold(KINGDOMS[2].treasury, 10));
    expect(gold).toBe(lootShare(S, KINGDOMS[2].treasury, 10)?.answer);
    expect(e.vault).toBe(vault + gold);
  });

  it('every loot choice matches its question', () => {
    for (const k of KINGDOMS) for (const loot of E.battle.lootChoices) expect(lootGold(k.treasury, loot), `${k.name} ${loot}%`).toBe(lootShare(S, k.treasury, loot)?.answer);
  });

  it('a loss takes no loot but still costs the troops that do not come home', () => {
    const e = ready();
    const before = e.troops.footman;
    const r = raidKingdom(e, 'dragons-rest', plan, 1);
    expect(r.ok && r.result.outcome).toBe('lost');
    expect(r.ok && r.gold).toBe(0);
    expect(e.troops.footman).toBe(before - (r.ok ? r.result.attackerLost.footman : 0));
    expect(e.troops.footman).toBeLessThan(before);
  });

  it('allows the day\'s raids and no more, and needs troops', () => {
    const e = ready();
    expect(raidKingdom(e, 'bunny-hollow', plan, 1).ok).toBe(true);
    expect(raidKingdom(e, 'bunny-hollow', plan, 2)).toMatchObject({ ok: false, why: 'limit' });
    expect(raidKingdom(rich(), 'bunny-hollow', plan, 2)).toMatchObject({ ok: false, why: 'army' });
    expect(raidKingdom(ready(), 'nowhere', plan, 2)).toMatchObject({ ok: false, why: 'kingdom' });
  });

  it('a Friendly War changes nothing at all', () => {
    const e = ready();
    const before = JSON.stringify(e);
    for (let i = 0; i < 5; i++) {
      const f = friendlyWar(e, 'dragons-rest', plan, i);
      expect(f.ok).toBe(true);
    }
    const won = friendlyWar(e, 'bunny-hollow', plan, 1);
    expect(won.ok && won.result.outcome).toBe('won');
    expect(JSON.stringify(e)).toBe(before);
    expect(friendlyWar(rich(), 'bunny-hollow', plan, 1)).toMatchObject({ ok: false, why: 'army' });
  });

  it('a Friendly War gives the same result as the real raid would', () => {
    const e = ready();
    const f = friendlyWar(e, 'ironwood', plan, 12);
    const r = raidKingdom(e, 'ironwood', plan, 12);
    expect(f.ok && r.ok && f.result).toEqual(r.ok ? r.result : null);
  });
});

describe('raids on classmates (the rule only)', () => {
  function party(id: string, o: { footmen?: number; vault?: number; day?: number; wild?: number; buildings?: BuildingKind[] } = {}): Party {
    const e = newEmpire(o.day ?? 1);
    e.vault = 50000;
    e.wild = 40;
    for (const kind of o.buildings ?? []) {
      developPlot(e, 3, 5);
      e.energyUsed = 0;
      build(e, e.plots.length - 1, kind);
    }
    for (let i = 0; i < 3; i++) if (countBuildings(e, 'barracks') < 3) {
      developPlot(e, 3, 5);
      e.energyUsed = 0;
      build(e, e.plots.length - 1, 'barracks');
    }
    buyTroops(e, 'footman', o.footmen ?? 40);
    e.vault = o.vault ?? 1000;
    e.wild = o.wild ?? 4;
    e.energyUsed = 0;
    return { id, empire: e };
  }
  const plan = { rounds: 5, push: 'steady' as const, loot: 10 };
  const today = 10;

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
    expect(raidClassmate(a, party('b'), 'gold', plan, 1, today).ok).toBe(true);
    expect(raidRefusal(a, party('c'), today)).toMatchObject({ why: 'limit' });
    expect(raidRefusal(party('a'), party('b'), today, false)).toMatchObject({ why: 'off' });
    empireNewDay({ ...newClan('balanced', 1), empire: a.empire } as Clan);
    expect(raidRefusal(a, party('c'), today + 1)).toBeNull();
  });

  it('will not let the same clan be raided twice in a day by the same raider', () => {
    const a = party('a');
    a.empire.raidedToday.push('b');
    expect(raidRefusal(a, party('b'), today)).toMatchObject({ why: 'same' });
  });

  it('gives a raided clan a 1-day shield', () => {
    const a = party('a');
    const b = party('b');
    expect(raidClassmate(a, b, 'gold', plan, 1, today).ok).toBe(true);
    expect(b.empire.shieldUntil).toBe(today + 1);
    expect(raidRefusal(party('c'), b, today)).toMatchObject({ why: 'shield' });
    expect(raidRefusal(party('c'), b, today + 1)).toMatchObject({ why: 'shield' });
    expect(raidRefusal(party('c'), b, today + 2)).toBeNull();
  });

  it('only matches clans with armies of a similar size', () => {
    expect(raidRefusal(party('a', { footmen: 60 }), party('b', { footmen: 20 }), today)).toMatchObject({ why: 'unfair' });
    expect(raidRefusal(party('a', { footmen: 20 }), party('b', { footmen: 60 }), today)).toMatchObject({ why: 'unfair' });
    expect(raidRefusal(party('a', { footmen: 40 }), party('b', { footmen: 20 }), today)).toBeNull();
    expect(raidRefusal(party('a', { footmen: 0 }), party('b', { footmen: 0 }), today)).toMatchObject({ why: 'army' });
    expect(raidRefusal(party('a'), party('a'), today)).toMatchObject({ why: 'self' });
  });

  it('takes at most 10% of the gold, even if more is asked for, and the gold only moves', () => {
    const a = party('a', { footmen: 60, vault: 300 });
    const b = party('b', { footmen: 40, vault: 1000 });
    const total = a.empire.vault + b.empire.vault;
    const r = raidClassmate(a, b, 'gold', { ...plan, loot: 20 }, 1, today);
    expect(r.ok && r.result.plan.loot).toBe(10);
    expect(r.ok && r.result.outcome).toBe('won');
    expect(r.ok && r.gold).toBe(100);
    expect(a.empire.vault + b.empire.vault).toBe(total);
    expect(b.empire.vault).toBe(900);
  });

  it('can take land, 10% of the empty land rounded up, wild land first', () => {
    const a = party('a', { footmen: 60 });
    const b = party('b', { footmen: 40, wild: 6, buildings: ['walls'] });
    b.empire.plots.push({ width: 3, length: 3 });
    const empty = emptyLand(b.empire);
    const wildBefore = a.empire.wild;
    const r = raidClassmate(a, b, 'land', plan, 1, today);
    expect(r.ok && r.land).toBe(Math.ceil(empty / 10));
    expect(a.empire.wild).toBe(wildBefore + (r.ok ? r.land : 0));
    expect(emptyLand(b.empire)).toBe(empty - (r.ok ? r.land : 0));
    expect(countBuildings(b.empire, 'walls')).toBe(1);
  });

  it('takes a developed empty plot only when no wild land is left, and never one with a building', () => {
    const a = party('a', { footmen: 60 });
    const b = party('b', { footmen: 40, wild: 0, buildings: ['walls'] });
    b.empire.plots.push({ width: 3, length: 3 });
    const buildings = buildingTotal(b.empire);
    const r = raidClassmate(a, b, 'land', plan, 1, today);
    expect(r.ok && r.land).toBe(1);
    expect(buildingTotal(b.empire)).toBe(buildings);
    expect(b.empire.plots.some((p) => !p.building)).toBe(false);
  });

  it('destroys buildings, but Walls make a raider destroy less, and walls themselves stay up', () => {
    const many: BuildingKind[] = ['tower', 'tower', 'stables', 'steelMill', 'gymnasium', 'developersHall', 'tower', 'tower'];
    const open = party('b', { footmen: 40, buildings: many });
    const walled = party('b', { footmen: 40, buildings: [...many, 'walls', 'walls'] });
    const total = (p: Party) => buildingTotal(p.empire);
    const beforeOpen = total(open);
    const beforeWalled = total(walled);
    const o = raidClassmate(party('a', { footmen: 60 }), open, 'buildings', plan, 1, today);
    const w = raidClassmate(party('a', { footmen: 60 }), walled, 'buildings', plan, 1, today);
    expect(o.ok && o.destroyed.length).toBe(Math.ceil((beforeOpen * 10) / 100));
    expect(w.ok && w.destroyed.length).toBe(Math.max(0, Math.ceil((beforeWalled * 10) / 100) - 2));
    expect(total(open)).toBe(beforeOpen - (o.ok ? o.destroyed.length : 0));
    expect(w.ok && w.destroyed).not.toContain('walls');
    expect(countBuildings(walled.empire, 'walls')).toBe(2);
  });

  it('a raid that fails takes nothing, and both sides lose the troops that do not come home', () => {
    const a = party('a', { footmen: 30 });
    const b = party('b', { footmen: 55, buildings: ['walls', 'walls', 'walls'] });
    const [va, vb] = [a.empire.vault, b.empire.vault];
    const r = raidClassmate(a, b, 'gold', plan, 1, today);
    expect(r.ok && r.result.outcome).not.toBe('won');
    expect(a.empire.vault).toBe(va);
    expect(b.empire.vault).toBe(vb);
    expect(a.empire.troops.footman).toBe(30 - (r.ok ? r.result.attackerLost.footman : 0));
    expect(b.empire.troops.footman).toBe(55 - (r.ok ? r.result.defenderLost.footman : 0));
    expect(a.empire.troops.footman).toBeLessThan(30);
  });

  it('is replayable from the two armies and a seed', () => {
    const run = () => {
      const r = raidClassmate(party('a', { footmen: 60 }), party('b', { footmen: 40, buildings: ['walls', 'tower', 'tower', 'tower'] }), 'buildings', plan, 77, today);
      return JSON.stringify(r);
    };
    expect(run()).toBe(run());
  });

  it('the news names only the raiding clan, never anyone\'s private id', () => {
    const a = party('student-1234-secret', { footmen: 60 });
    const b = party('student-9876-secret', { footmen: 40 });
    const r = raidClassmate(a, b, 'gold', plan, 1, today);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const line = raidNews('Red Banner', r);
    expect(line).toBe('A raider from the Red Banner clan took 100 gold.');
    expect(line).not.toMatch(/student|secret/);
    expect(raidNews('Red Banner', { ...r, result: { ...r.result, outcome: 'lost' } })).toBe('A raider from the Red Banner clan was driven off.');
    expect(raidNews('Red Banner', { ...r, take: 'land', land: 1 })).toContain('1 plot of land');
    expect(raidNews('Red Banner', { ...r, take: 'buildings', destroyed: ['tower', 'walls'] })).toContain('2 buildings');
  });
});

describe('the whole thing with the simulator', () => {
  const run = (lineup: 'balanced' | 'fighters', empire: boolean, days = 30, seeds = 6) => Array.from({ length: seeds }, (_, i) => simulate({ days, seed: i + 1, lineup, mathsRate: 0.7, depthOffset: 0, empire }));
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  it('a balanced clan can afford a real empire in a few weeks, and the clan purse never goes below nothing', () => {
    const runs = run('balanced', true);
    const day21 = runs.map((r) => r.days[20].empire!);
    expect(mean(day21.map((d) => d.barracks))).toBeGreaterThanOrEqual(6);
    expect(mean(day21.map((d) => d.buildings))).toBeGreaterThanOrEqual(15);
    expect(mean(day21.map((d) => d.might))).toBeGreaterThanOrEqual(150);
    for (const r of runs) for (const d of r.days) expect(d.gold).toBeGreaterThanOrEqual(0);
  });

  it('a clan that tries a Friendly War first wins nearly all its raids, and the raids pay', () => {
    const raids = run('balanced', true).flatMap((r) => r.days.map((d) => d.empire!));
    const made = raids.reduce((t, d) => t + d.raids, 0);
    expect(made).toBeGreaterThan(50);
    expect(raids.reduce((t, d) => t + d.raidWins, 0) / made).toBeGreaterThanOrEqual(0.95);
    expect(raids.reduce((t, d) => t + d.raidGold, 0)).toBeGreaterThan(raids.reduce((t, d) => t + d.lostMight, 0) * E.troopCost.footman);
  });

  it('having an empire does not make the mines any easier or harder', () => {
    for (const lineup of ['balanced', 'fighters'] as const) {
      const [a, b] = [run(lineup, true), run(lineup, false)];
      expect(Math.abs(mean(a.map((r) => r.wins / r.fights)) - mean(b.map((r) => r.wins / r.fights))), lineup).toBeLessThan(0.06);
      expect(Math.abs(mean(a.map((r) => r.days[29].avgLevel)) - mean(b.map((r) => r.days[29].avgLevel))), lineup).toBeLessThan(0.6);
    }
  });

  it('is the same every time', () => {
    expect(JSON.stringify(run('balanced', true, 15, 2))).toBe(JSON.stringify(run('balanced', true, 15, 2)));
  });
});

describe('land questions use the real numbers', () => {
  it('the area and fence questions give the numbers the plot price is built from', () => {
    const e = newEmpire();
    for (const [w, l] of [[3, 5], [4, 4], [2, 6], [6, 6]]) {
      const q = landPlot(S, w, l)!;
      expect(q.area.answer).toBe(area(w, l));
      expect(q.fence.answer).toBe(fence(w, l));
      expect(plotCost(e, w, l)).toBe(q.area.answer * E.landPerSquare + q.fence.answer * E.fencePerUnit);
    }
  });

  it('every empty-handed starting state can be saved and read back as plain data', () => {
    const e = newEmpire(3);
    expect(JSON.parse(JSON.stringify(e))).toEqual(e);
    expect(sideOf(e).troops).toEqual(noTroops());
  });
});

describe('what a plot will fit', () => {
  it('says which buildings a number of squares has room for', () => {
    expect(smallestBuildingSize()).toBe(5);
    expect(buildingsThatFit(4)).toEqual([]);
    expect(buildingsThatFit(5)).toEqual(['tower']);
    expect(buildingsThatFit(6)).toEqual(['walls', 'tower']);
    expect(buildingsThatFit(15)).toContain('barracks');
  });
  it('suggests plot shapes with the least waste', () => {
    expect(shapesFor(15)[0]).toEqual({ width: 3, length: 5 });
    expect(shapesFor(5)[0]).toEqual({ width: 2, length: 3 });
    for (const k of Object.values(E.buildings)) for (const s of shapesFor(k.size)) expect(s.width * s.length).toBeGreaterThanOrEqual(k.size);
  });
});
