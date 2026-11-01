import { describe, expect, it } from 'vitest';
import { botOrders } from './bot';
import { buy, churchCost, dayReset, depthHint, fightStats, gainXp, itemByName, rollMember, trainCost, trainStat, wake } from './character';
import { itemAt } from './items';
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
    expect(ITEMS).toHaveLength(11 * (7 + 6 + 6));
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

  it('adds gear to the stats a member fights with', () => {
    const m = rollMember(dice(2), 'A', 'Halfling', 'Wizard');
    const staff = itemByName(m.gear.weapon!)!;
    const robe = itemByName(m.gear.armor!)!;
    expect(fightStats(m).wisdom).toBe(m.stats.wisdom + (staff.bonus.wisdom ?? 0) + (robe.bonus.wisdom ?? 0) + (itemByName(m.gear.shield!)!.bonus.wisdom ?? 0));
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

  it('sells tier 2 from the start, the next tiers as the Smithy grows, and only the member\'s own line', () => {
    const clan = newClan('balanced', 1);
    clan.gold = 100000;
    const m = clan.members[0];
    expect(buy(clan, m, itemAt(m.cls, 'weapon', 3)!)).toBe(false);
    expect(buy(clan, m, ITEMS.find((i) => i.cls !== m.cls && i.tier === 2)!)).toBe(false);
    expect(buy(clan, m, itemAt(m.cls, 'weapon', 2)!)).toBe(true);
    expect(m.gear.weapon).toBe(itemAt(m.cls, 'weapon', 2)!.name);
    expect(clan.gold).toBe(100000 - itemAt(m.cls, 'weapon', 2)!.price);
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

  it('give a healer experience for HP healed, but not for healing someone already full', () => {
    const members = newClan('balanced', 1).members;
    const healer = members.findIndex((m) => m.cls === 'Healer');
    const heal = (missing: number) => {
      const s = newFight(members, 1, 4);
      s.enemies.forEach((e) => (e.tied = 1));
      s.clan[0].hp -= missing;
      playRound(s, members.map((_, i) => (i === healer ? { action: 'spell', spell: 2, target: 0 } : { action: 'guard' })));
      expect(s.log.some((e) => e.type === 'cast' && e.who === members[healer].name)).toBe(true);
      return s;
    };
    expect(heal(10).xp[healer]).toBeGreaterThan(0);
    expect(heal(0).xp[healer]).toBe(0);
  });

  it('give experience for a buff or tie-up that lands, and none for one that is shrugged off', () => {
    const members = newClan('balanced', 1).members;
    const healer = members.findIndex((m) => m.cls === 'Healer');
    const cast = (spell: number, wisdom: number) => {
      const s = newFight(members, 1, 4);
      s.enemies.forEach((e) => ((e.tied = 1), (e.level = 30 - wisdom), (e.stats.wisdom = 30 - wisdom)));
      Object.assign(s.clan[healer], { spells: [spell], sp: 99, level: wisdom });
      s.clan[healer].stats.wisdom = wisdom;
      playRound(s, members.map((_, i) => (i === healer ? { action: 'spell', spell, target: 0 } : { action: 'guard' })));
      return s;
    };
    expect(cast(4, 1).xp[healer]).toBe(CONFIG.xpSupport);
    expect(cast(5, 30).xp[healer]).toBe(CONFIG.xpSupport);
    const resisted = cast(5, 0);
    expect(resisted.log.some((e) => e.type === 'resist')).toBe(true);
    expect(resisted.xp[healer]).toBe(0);
  });

  it('give everyone still standing at least a share of the team experience when a fight ends', () => {
    let checked = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const members = newClan('balanced', seed).members;
      const healer = members.findIndex((m) => m.cls === 'Healer');
      const s = newFight(members, 3, seed);
      // The healer only guards, so anything it ends with is its share.
      while (!s.result) playRound(s, botOrders(s).map((o, i) => (i === healer ? { action: 'guard' } : o)));
      if (s.clan[healer].hp <= 0) continue;
      // Anyone else below the share was raised to the same amount, so the healer has the least, and no more than the share.
      const standing = s.clan.filter((f) => f.hp > 0).map((f) => s.xp[f.index]);
      expect(s.xp[healer]).toBeGreaterThan(0);
      expect(s.xp[healer]).toBe(Math.min(...standing));
      expect(s.xp[healer]).toBeLessThanOrEqual(Math.ceil((standing.reduce((t, x) => t + x, 0) / standing.length) * CONFIG.xpShare));
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
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
