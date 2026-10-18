import { describe, expect, it } from 'vitest';
import { botOrders } from './bot';
import { buy, churchCost, dayReset, depthHint, examineCost, fightStats, gainXp, inShop, itemByName, rollMember, shopPrice, trainCost, trainStat, wake } from './character';
import { CONFIG } from './config';
import { CLASSES, ITEMS, MONSTERS, RACES } from './gamedata';
import { newFight, playRound, settle, monstersAt, type FightState } from './fight';
import { simulate, newClan } from './sim';
import { SPELLS } from './spells';

const dice = (seed = 1) => ({ rng: seed });

function play(state: FightState, cry: 'damage' | null = null): FightState {
  while (!state.result) playRound(state, botOrders(state), cry);
  return state;
}

describe('game data', () => {
  it('has the original counts', () => {
    expect(RACES).toHaveLength(9);
    expect(CLASSES).toHaveLength(11);
    expect(ITEMS).toHaveLength(34);
    expect(MONSTERS.filter((m) => m.boss)).toHaveLength(4);
  });

  it('renames the Demon to Imp', () => {
    expect(RACES.map((r) => r.name)).toContain('Imp');
    expect(RACES.map((r) => r.name)).not.toContain('Demon');
  });

  it('only gives classes and monsters spells that exist', () => {
    for (const def of [...RACES, ...CLASSES, ...MONSTERS]) for (const id of def.spells) expect(SPELLS[id], `${def.name}: ${id}`).toBeDefined();
  });

  it('has monsters at every depth from 0 to 20', () => {
    for (let d = 0; d <= 20; d++) expect(monstersAt(d).length, `depth ${d}`).toBeGreaterThan(0);
  });

  it('has unique item names and monster names within a zone', () => {
    expect(new Set(ITEMS.map((i) => i.name)).size).toBe(ITEMS.length);
  });
});

describe('characters', () => {
  it('rolls race + class stats, repeatably', () => {
    const a = rollMember(dice(5), 'A', 'Dwarf', 'Warrior');
    const b = rollMember(dice(5), 'A', 'Dwarf', 'Warrior');
    expect(a).toEqual(b);
    expect(a.stats.strength).toBeGreaterThanOrEqual(10); // dwarf 8 + warrior 3, wobble -1
    expect(a.spells).toEqual([20, 11, 18]);
    expect(a.maxHp).toBeGreaterThanOrEqual(23);
  });

  it('gives the clan leader extra', () => {
    const plain = rollMember(dice(9), 'A', 'Human', 'Knight');
    const leader = rollMember(dice(9), 'A', 'Human', 'Knight', true);
    expect(leader.stats.strength).toBe(plain.stats.strength + 2);
    expect(leader.maxHp).toBe(plain.maxHp + 4);
  });

  it('rejects an unknown race', () => {
    expect(() => rollMember(dice(), 'A', 'Dragon', 'Warrior')).toThrow();
  });

  it('only counts gear whose needs are met', () => {
    const m = rollMember(dice(2), 'A', 'Halfling', 'Wizard'); // strength is tiny
    m.gear.weapon = 'Axe'; // needs strength 13
    expect(fightStats(m).strength).toBe(m.stats.strength);
    m.stats.strength = 20;
    expect(fightStats(m).strength).toBe(27);
  });

  it('levels up on experience and awards training points', () => {
    const m = rollMember(dice(), 'A', 'Human', 'Warrior');
    expect(gainXp(m, CONFIG.xpToReach(2) - 1)).toBe(0);
    expect(gainXp(m, 1)).toBe(1);
    expect(m.level).toBe(2);
    expect(m.points).toBe(CONFIG.pointsPerLevel);
    gainXp(m, 1_000_000);
    expect(m.level).toBe(CONFIG.maxLevel);
  });

  it('training costs drop with the hall, never below 1', () => {
    expect(trainCost('strength', 0)).toBe(3);
    expect(trainCost('strength', 1)).toBe(2);
    expect(trainCost('strength', 9)).toBe(1);
    const m = rollMember(dice(), 'A', 'Human', 'Warrior');
    m.points = 2;
    expect(trainStat(m, 'strength', 0)).toBe(false);
    expect(m.points).toBe(2);
    expect(trainStat(m, 'strength', 1)).toBe(true);
    expect(m.points).toBe(0);
  });

  it('wakes the knocked out for (level + 1) × 10 gold, the first one each day free', () => {
    const clan = newClan('balanced', 1);
    const [a, b] = clan.members;
    for (const m of [a, b]) {
      m.knockedOut = true;
      m.hp = 0;
      m.level = 4;
    }
    expect(churchCost(a)).toBe(50);
    clan.gold = 0;
    expect(wake(clan, a)).toBe(true); // the free one
    expect(clan.gold).toBe(0);
    expect(wake(clan, b)).toBe(false); // now it costs
    clan.gold = 49;
    expect(wake(clan, b)).toBe(false);
    clan.gold = 50;
    expect(wake(clan, b)).toBe(true);
    expect(clan.gold).toBe(0);
    expect(b.knockedOut).toBe(false);
    expect(b.hp).toBeGreaterThan(0);
    dayReset(clan);
    expect(clan.wakesToday).toBe(0);
  });

  it('caps the experience one level costs, and says how hard a depth is', () => {
    expect(CONFIG.xpToReach(20) - CONFIG.xpToReach(19)).toBe(CONFIG.xpLevelCap);
    expect(CONFIG.xpToReach(3) - CONFIG.xpToReach(2)).toBe(40);
    expect(depthHint(3, 5)).toBe('too easy');
    expect(depthHint(5, 5)).toBe('just right');
    expect(depthHint(7, 5)).toBe('tough');
    expect(depthHint(10, 5)).toBe('too hard');
  });

  it('adds the village tax to prices and charges 25% to examine', () => {
    const axe = itemByName('Axe')!;
    expect(axe.price).toBe(50);
    expect(shopPrice(axe)).toBe(55);
    expect(shopPrice(axe, 0)).toBe(50);
    expect(examineCost(axe)).toBe(13);
  });

  it('only stocks the basics until the Smithy is built', () => {
    expect(inShop(0).every((i) => i.shopLevel === 6)).toBe(true);
    expect(inShop(6)).toHaveLength(ITEMS.length);
    const clan = newClan('balanced', 1);
    clan.gold = 100000;
    expect(buy(clan, clan.members[0], itemByName('Sky Sword')!)).toBe(false);
    expect(buy(clan, clan.members[0], itemByName('Axe')!)).toBe(true);
    expect(clan.members[0].gear.weapon).toBe('Axe');
  });
});

describe('fights', () => {
  it('are the same every time from the same seed', () => {
    const a = play(newFight(newClan('balanced', 1).members, 3, 42));
    const b = play(newFight(newClan('balanced', 1).members, 3, 42));
    expect(a).toEqual(b);
  });

  it('differ with a different seed', () => {
    const a = play(newFight(newClan('balanced', 1).members, 3, 42));
    const b = play(newFight(newClan('balanced', 1).members, 3, 43));
    expect(a.log).not.toEqual(b.log);
  });

  it('survive being saved as JSON halfway through', () => {
    const members = newClan('balanced', 1).members;
    const straight = newFight(members, 4, 7);
    let saved = newFight(members, 4, 7);
    for (let i = 0; i < 2 && !straight.result; i++) {
      playRound(straight, botOrders(straight));
      playRound(saved, botOrders(saved));
      saved = JSON.parse(JSON.stringify(saved));
    }
    play(straight);
    play(saved);
    expect(saved).toEqual(straight);
  });

  it('pick 2-4 enemies from the right depth', () => {
    for (let seed = 1; seed < 60; seed++) {
      const depth = seed % 21;
      const s = newFight(newClan('balanced', 1).members, depth, seed);
      expect(s.enemies.length).toBeGreaterThanOrEqual(2);
      expect(s.enemies.length).toBeLessThanOrEqual(4);
      for (const e of s.enemies) {
        const def = MONSTERS.find((m) => m.name === e.name)!;
        expect(def.boss).toBe(false);
        expect(Math.abs(def.mine - depth)).toBeLessThanOrEqual(4);
      }
    }
  });

  it('put a boss at depth 5, 10, 15 and 20', () => {
    for (const depth of [5, 10, 15, 20]) {
      const s = newFight(newClan('balanced', 1).members, depth, 1, true);
      expect(MONSTERS.find((m) => m.name === s.enemies[0].name)?.boss).toBe(true);
    }
  });

  it('end within the round limit', () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = play(newFight(newClan('fighters', seed).members, seed % 10, seed));
      expect(s.round).toBeLessThanOrEqual(CONFIG.maxRounds);
      expect(['won', 'lost', 'fled', 'timeout']).toContain(s.result);
    }
  });

  it('never make HP go below 0 or above max', () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = play(newFight(newClan('balanced', seed).members, 8, seed));
      for (const f of [...s.clan, ...s.enemies]) {
        expect(f.hp).toBeGreaterThanOrEqual(0);
        expect(f.hp).toBeLessThanOrEqual(f.maxHp);
        expect(f.sp).toBeLessThanOrEqual(f.maxSp);
      }
    }
  });

  it('pay gold only for kills, and followers only for a win', () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = play(newFight(newClan('balanced', seed).members, 2, seed));
      const kills = s.enemies.filter((e) => e.hp <= 0).length;
      expect(s.gold > 0).toBe(kills > 0);
      expect(s.followers > 0).toBe(s.result === 'won');
    }
  });

  it('give experience per hit, to whoever landed it', () => {
    const s = play(newFight(newClan('balanced', 1).members, 1, 3));
    expect(s.xp.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    for (const e of s.log) if (e.type === 'hit' && s.clan.some((c) => c.name === e.who)) expect(e.damage).toBeGreaterThanOrEqual(1);
  });

  it('knock people out at 0 HP and leave them out', () => {
    const members = newClan('balanced', 1).members;
    members[2].hp = 0;
    members[2].knockedOut = true;
    const s = newFight(members, 1, 5);
    expect(s.clan[2].hp).toBe(0);
    play(s);
    expect(s.clan[2].hp).toBe(0);
    expect(s.log.some((e) => e.type === 'hit' && e.who === members[2].name)).toBe(false);
  });

  it('lose at once if everyone is already knocked out', () => {
    const members = newClan('balanced', 1).members;
    for (const m of members) {
      m.hp = 0;
      m.knockedOut = true;
    }
    expect(newFight(members, 1, 5).result).toBe('lost');
  });

  it('turn a bad order into an attack', () => {
    const s = newFight(newClan('balanced', 1).members, 1, 9);
    playRound(s, [{ action: 'spell', spell: 999, target: 0 }, { action: 'attack', target: 99 }]);
    expect(s.log.some((e) => e.type === 'hit' || e.type === 'miss')).toBe(true);
  });

  it('let a healer heal (and only with the SP for it)', () => {
    const members = newClan('balanced', 1).members;
    const healer = members.findIndex((m) => m.cls === 'Healer');
    members[0].hp = 3;
    const s = newFight(members, 1, 4);
    const before = s.clan[healer].sp;
    playRound(s, members.map((_, i) => (i === healer ? { action: 'spell', spell: 2, target: 0 } : { action: 'guard' })));
    const cast = s.log.find((e) => e.type === 'cast');
    expect(before).toBeGreaterThanOrEqual(SPELLS[2].sp);
    expect(cast).toBeDefined();
    s.clan[healer].sp = 0;
    const rounds = s.log.length;
    playRound(s, members.map((_, i) => (i === healer ? { action: 'spell', spell: 2, target: 0 } : { action: 'guard' })));
    expect(s.log.slice(rounds).some((e) => e.type === 'cast' && e.who === members[healer].name)).toBe(false);
  });

  it('give a right Battle Cry more damage on average', () => {
    let plain = 0;
    let boosted = 0;
    for (let seed = 1; seed <= 80; seed++) {
      for (const cry of [null, 'damage'] as const) {
        const s = newFight(newClan('fighters', 1).members, 4, seed);
        playRound(s, botOrders(s), cry);
        const total = s.log.reduce((t, e) => t + (e.type === 'hit' && s.clan.some((c) => c.name === e.who) ? e.damage : 0), 0);
        if (cry) boosted += total;
        else plain += total;
      }
    }
    expect(boosted).toBeGreaterThan(plain);
  });

  it('settle: write HP, knock-outs and experience back onto the members', () => {
    const clan = newClan('balanced', 1);
    const s = play(newFight(clan.members, 6, 11));
    const xp = clan.members.map((m) => m.xp);
    settle(clan.members, s, gainXp);
    clan.members.forEach((m, i) => {
      expect(m.xp).toBe(xp[i] + s.xp[i]);
      expect(m.knockedOut).toBe(s.clan[i].hp <= 0);
      expect(m.hp).toBeLessThanOrEqual(m.maxHp);
    });
  });
});

describe('the simulator', () => {
  it('is repeatable and keeps clans growing', () => {
    const opts = { days: 12, seed: 3, lineup: 'balanced', mathsRate: 0.7, depthOffset: 0 } as const;
    const a = simulate(opts);
    expect(simulate(opts)).toEqual(a);
    expect(a.days[11].avgLevel).toBeGreaterThan(a.days[0].avgLevel);
    expect(a.wins / a.fights).toBeGreaterThan(0.5);
  });
});
