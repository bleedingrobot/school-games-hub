import { describe, expect, it } from 'vitest';
import {
  ARMOURS, DRAGON_STAGES, EXP_TO_CHALLENGE, FOREST_FIGHTS_PER_DAY, MASTERS, MAX_LEVEL, MONSTERS, WEAPONS, baseStats,
  expNeeded, levelUpGain, tierPower,
} from './data';
import {
  applyEvent, applyForestResult, applyMasterResult, buyGear, canChallengeMaster, canFaceDragon, damageRoll, deposit,
  finishDragon, forestTrip, heal, heroAttack, makeRandom, newHero, nextRandom, nzDate, replayFight, rollDay, seasonOf,
  startDragonStage, startFight, startMasterFight, stepFight, useForestTurn, withdraw,
} from './engine';
import { BANDED_PACKS, EXTRA_PACKS } from '../maths/skillPacks';
import { EVENTS } from './events';
import { STYLES, summarise } from './sim';
import type { FightAction, Hero } from './types';

const TODAY = '2026-10-19';
const hero = (patch: Partial<Hero> = {}, heroClass: Hero['heroClass'] = 'knight'): Hero => ({ ...newHero(heroClass, TODAY), ...patch });
/** A hero who has beaten every master and has the exp to face the dragon. */
const maxed = () =>
  hero({
    level: MAX_LEVEL, exp: expNeeded(MAX_LEVEL - 1), ...baseStats(MAX_LEVEL), hp: baseStats(MAX_LEVEL).maxHp,
    maxHp: baseStats(MAX_LEVEL).maxHp, weapon: WEAPONS.length - 1, armour: ARMOURS.length - 1,
  });

describe('random numbers', () => {
  it('give the same sequence for the same seed', () => {
    const a = makeRandom(42);
    const b = makeRandom(42);
    expect(Array.from({ length: 5 }, a)).toEqual(Array.from({ length: 5 }, b));
  });
  it('stay in [0, 1) and carry their whole state in one number', () => {
    let state = 7;
    for (let i = 0; i < 1000; i++) {
      const [v, next] = nextRandom(state);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      state = next;
    }
  });
});

describe('the tables', () => {
  it('have twelve levels, ten monsters each, getting stronger', () => {
    expect(MONSTERS).toHaveLength(MAX_LEVEL);
    for (const [i, list] of MONSTERS.entries()) {
      expect(list).toHaveLength(10);
      for (const m of list) expect(m.level).toBe(i + 1);
      for (let v = 1; v < list.length; v++) {
        expect(list[v].hp).toBeGreaterThanOrEqual(list[v - 1].hp);
        expect(list[v].exp).toBeGreaterThanOrEqual(list[v - 1].exp);
      }
    }
    for (let level = 1; level < MAX_LEVEL; level++) expect(MONSTERS[level][0].hp).toBeGreaterThan(MONSTERS[level - 1][0].hp);
  });
  it('have unique monster ids', () => {
    const ids = MONSTERS.flat().map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('need more exp for each level, and have a master for each step up', () => {
    expect(EXP_TO_CHALLENGE).toHaveLength(MAX_LEVEL - 1);
    for (let i = 1; i < EXP_TO_CHALLENGE.length; i++) expect(EXP_TO_CHALLENGE[i]).toBeGreaterThan(EXP_TO_CHALLENGE[i - 1]);
    expect(MASTERS.map((m) => m.level)).toEqual(Array.from({ length: MAX_LEVEL - 1 }, (_, i) => i + 2));
  });
  it('make gear dearer and better as you go, with the first free', () => {
    for (const table of [WEAPONS, ARMOURS]) {
      expect(table).toHaveLength(12);
      expect(table[0].cost).toBe(0);
      for (let i = 1; i < table.length; i++) {
        expect(table[i].cost).toBeGreaterThan(table[i - 1].cost);
        expect(table[i].power).toBeGreaterThan(table[i - 1].power);
        expect(table[i].need).toBeGreaterThanOrEqual(table[i - 1].need);
      }
    }
  });
  it('keep prices friendly for a Year 4-6 pupil (nothing in the shop beyond a few digits)', () => {
    expect(Math.max(...WEAPONS.map((w) => w.cost), ...ARMOURS.map((a) => a.cost))).toBeLessThan(10000);
  });
  it('level-up gains add up to the base stats', () => {
    let hp = baseStats(1).maxHp;
    for (let l = 2; l <= MAX_LEVEL; l++) hp += levelUpGain(l).maxHp;
    expect(hp).toBe(baseStats(MAX_LEVEL).maxHp);
    expect(tierPower(1)).toBe(10);
  });
});

describe('damage', () => {
  it('is a random half of your strength plus the other half', () => {
    const rand = makeRandom(1);
    for (let i = 0; i < 500; i++) {
      const d = damageRoll(20, rand);
      expect(d).toBeGreaterThanOrEqual(10);
      expect(d).toBeLessThanOrEqual(20);
    }
  });
});

describe('days and seasons', () => {
  it('give turns back on the first play of a new day, and not the same day', () => {
    const tired = hero({ forestLeft: 0, hp: 3, masterTried: true, skillLeft: 0 });
    expect(rollDay(tired, TODAY)).toBe(tired);
    const next = rollDay(tired, '2026-10-20');
    expect(next).toMatchObject({ forestLeft: FOREST_FIGHTS_PER_DAY, hp: tired.maxHp, masterTried: false, skillLeft: 3 });
  });
  it('lets the teacher change the forest fights a day', () => {
    expect(rollDay(hero({ forestLeft: 0 }), '2026-10-20', 6).forestLeft).toBe(6);
  });
  it('piles unused forest fights up for missed days, never past two days’ worth', () => {
    expect(rollDay(hero({ forestLeft: 4 }), '2026-10-20').forestLeft).toBe(14);
    expect(rollDay(hero({ forestLeft: 0 }), '2026-10-23').forestLeft).toBe(20); // three days gone: two days' worth, no more
    expect(rollDay(hero({ forestLeft: 10 }), '2026-10-30').forestLeft).toBe(20);
    expect(rollDay(hero({ forestLeft: 0 }), '2026-10-20', 6).forestLeft).toBe(6);
    expect(rollDay(hero({ forestLeft: 6 }), '2026-10-25', 6).forestLeft).toBe(12);
  });
  it('saves up an extra master try for each missed day, to two, and spends it before the day’s try', () => {
    expect(rollDay(hero(), '2026-10-20').masterExtra).toBe(0);
    expect(rollDay(hero(), '2026-10-21').masterExtra).toBe(1);
    expect(rollDay(hero(), '2026-10-30').masterExtra).toBe(2);
    const banked = rollDay(hero({ exp: 99999 }), '2026-10-30');
    const lost = applyMasterResult(banked, { ...startMasterFight(banked, 1), over: true, outcome: 'lost' });
    expect(lost).toMatchObject({ masterTried: false, masterExtra: 1 });
    const again = applyMasterResult(lost, { ...startMasterFight(lost, 2), over: true, outcome: 'lost' });
    expect(again).toMatchObject({ masterTried: false, masterExtra: 0 });
    const last = applyMasterResult(again, { ...startMasterFight(again, 3), over: true, outcome: 'lost' });
    expect(last.masterTried).toBe(true);
  });
  it('uses the New Zealand date', () => {
    expect(nzDate(new Date('2026-10-18T12:30:00Z'))).toBe('2026-10-19'); // NZDT is UTC+13
    expect(nzDate(new Date('2026-06-18T11:30:00Z'))).toBe('2026-06-18'); // NZST is UTC+12
  });
  it('counts seasons of 35 days', () => {
    expect(seasonOf('2026-10-19', '2026-10-19')).toEqual({ number: 1, dayOfSeason: 1, daysLeft: 34, started: true });
    expect(seasonOf('2026-10-19', '2026-11-22')).toMatchObject({ number: 1, dayOfSeason: 35, daysLeft: 0 });
    expect(seasonOf('2026-10-19', '2026-11-23')).toMatchObject({ number: 2, dayOfSeason: 1 });
    expect(seasonOf('2026-10-19', '2026-10-12')).toMatchObject({ started: false, daysLeft: 7 });
  });
  it('never lets turns run below zero', () => {
    expect(() => useForestTurn(hero({ forestLeft: 0 }))).toThrow();
    expect(useForestTurn(hero()).forestLeft).toBe(FOREST_FIGHTS_PER_DAY - 1);
  });
});

describe('the forest', () => {
  it('finds the same thing for the same seed', () => {
    const h = hero({ level: 4 });
    for (let seed = 0; seed < 50; seed++) expect(forestTrip(h, seed)).toEqual(forestTrip(h, seed));
  });
  it('mostly fights monsters of your level, sometimes weaker, about 1 trip in 5 an event', () => {
    const h = hero({ level: 5 });
    let events = 0;
    let weaker = 0;
    const n = 4000;
    for (let seed = 0; seed < n; seed++) {
      const trip = forestTrip(h, seed * 31 + 1);
      if (trip.kind === 'event') events += 1;
      else {
        expect([4, 5]).toContain(trip.monster.level);
        if (trip.monster.level === 4) weaker += 1;
      }
    }
    expect(events / n).toBeGreaterThan(0.16);
    expect(events / n).toBeLessThan(0.24);
    expect(weaker / (n - events)).toBeGreaterThan(0.1);
    expect(weaker / (n - events)).toBeLessThan(0.23);
  });
  it('never sends a level 1 hero to a level 0 monster', () => {
    for (let seed = 0; seed < 300; seed++) {
      const trip = forestTrip(hero(), seed);
      if (trip.kind === 'fight') expect(trip.monster.level).toBe(1);
    }
  });
  it('pays events, scaled to your level, and maths rewards only for a right answer', () => {
    const treasure = EVENTS.find((e) => e.id === 'treasure-piles')!;
    const h = hero();
    expect(applyEvent(h, treasure, false).gold).toBe(h.gold);
    expect(applyEvent(h, treasure, true).gold).toBeGreaterThan(h.gold);
    const high = hero({ level: 8 });
    expect(applyEvent(high, treasure, true).gold - high.gold).toBeGreaterThan(applyEvent(h, treasure, true).gold - h.gold);
  });
  it('does not state numbers in a maths event (the question comes from a pack, so they could disagree)', () => {
    for (const e of EVENTS.filter((x) => x.maths)) expect(e.text, e.id).not.toMatch(/\d/);
  });
  it('only asks maths events for packs that exist, and has a good spread of them', () => {
    const known = new Set([...Object.keys(BANDED_PACKS), 'times-tables', ...Object.keys(EXTRA_PACKS)]);
    const maths = EVENTS.filter((e) => e.maths);
    for (const e of maths) expect(known.has(e.maths!.topic), e.id).toBe(true);
    expect(maths.length).toBeGreaterThanOrEqual(8);
    expect(new Set(maths.map((e) => e.maths!.topic)).size).toBeGreaterThanOrEqual(6);
    expect(EVENTS.length - maths.length).toBeGreaterThanOrEqual(12);
  });
  it('has events with unique ids', () => {
    expect(new Set(EVENTS.map((e) => e.id)).size).toBe(EVENTS.length);
  });
});

describe('fights', () => {
  const goblin = MONSTERS[0][0];
  const attackUntilOver = (hp: number, seed: number) => {
    const actions: FightAction[] = [];
    let f = startFight(hero({ hp }), goblin, seed);
    while (!f.over) {
      actions.push({ type: 'attack' });
      f = stepFight(f, { type: 'attack' });
    }
    return { f, actions };
  };

  it('replay the same way from the same seed and actions', () => {
    const { f, actions } = attackUntilOver(20, 99);
    const replayed = replayFight(startFight(hero({ hp: 20 }), goblin, 99), actions);
    expect(replayed).toEqual(f);
  });
  it('refuse extra actions after the end', () => {
    const { actions } = attackUntilOver(20, 5);
    expect(() => replayFight(startFight(hero(), goblin, 5), [...actions, { type: 'attack' }])).toThrow();
  });
  it('do not change the state you pass in', () => {
    const start = startFight(hero(), goblin, 1);
    const copy = structuredClone(start);
    stepFight(start, { type: 'attack' });
    expect(start).toEqual(copy);
  });
  it('end with a win when the monster runs out of HP, with gold and exp', () => {
    const strong = hero({ strength: 500 });
    const f = stepFight(startFight(strong, goblin, 3), { type: 'attack' });
    expect(f).toMatchObject({ over: true, outcome: 'won', monsterHp: 0 });
    const after = applyForestResult(strong, f);
    expect(after.gold).toBe(strong.gold + goblin.gold);
    expect(after.exp).toBe(goblin.exp);
    expect(after.forestWins).toBe(1);
  });
  it('lose softly: carried gold is gone, banked gold and exp stay, you wake up with some HP', () => {
    const h = hero({ hp: 1, gold: 100, bank: 50 });
    const f = startFight(h, MONSTERS[11][4], 2);
    f.heroDefence = 0;
    let g = f;
    while (!g.over) g = stepFight(g, { type: 'attack' });
    expect(g.outcome).toBe('lost');
    const after = applyForestResult(h, g);
    expect(after).toMatchObject({ gold: 0, bank: 50 });
    expect(after.hp).toBe(Math.ceil(h.maxHp * 0.3));
  });
  it('let you run away from a forest fight sometimes, but never from a master', () => {
    let fled = 0;
    let stayed = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const f = stepFight(startFight(hero(), goblin, seed), { type: 'run' });
      if (f.outcome === 'fled') fled += 1;
      else stayed += 1;
    }
    expect(fled).toBeGreaterThan(80);
    expect(stayed).toBeGreaterThan(20);
    const m = startMasterFight(hero({ exp: 1000 }), 1);
    expect(() => stepFight(m, { type: 'run' })).toThrow();
  });
  it('give a bonus first hit for Size it up, and only on the first hit', () => {
    const plain = stepFight(startFight(hero(), goblin, 11), { type: 'attack' });
    const sized = stepFight(startFight(hero(), goblin, 11, { firstHitBonus: 1.5 }), { type: 'attack' });
    const dmg = (f: typeof plain) => (f.log.find((e) => e.type === 'hero-hit') as { damage: number }).damage;
    expect(dmg(sized)).toBeGreaterThan(dmg(plain));
  });
  it('shields soak damage', () => {
    const plain = startFight(hero({ hp: 20 }), MONSTERS[0][4], 8);
    const shielded = startFight(hero({ hp: 20 }), MONSTERS[0][4], 8, { shield: 100 });
    expect(stepFight(shielded, { type: 'attack' }).heroHp).toBe(20);
    expect(stepFight(plain, { type: 'attack' }).heroHp).toBeLessThanOrEqual(20);
  });
});

describe('class skills', () => {
  const ogre = MONSTERS[3][2];
  it('power strike hits harder than an attack, uses a skill, and only a knight can do it', () => {
    const k = hero({ strength: 20 });
    const power = stepFight(startFight(k, ogre, 4), { type: 'skill', skill: 'power-strike' });
    const plain = stepFight(startFight(k, ogre, 4), { type: 'attack' });
    expect(power.monsterHp).toBeLessThan(plain.monsterHp);
    expect(ogre.hp - power.monsterHp).toBe(2 * (ogre.hp - plain.monsterHp)); // same seed, same roll, doubled
    expect(power.skillLeft).toBe(k.skillLeft - 1);
    expect(() => stepFight(startFight(hero({}, 'mage'), ogre, 4), { type: 'skill', skill: 'power-strike' })).toThrow();
  });
  it('stop when the uses run out', () => {
    expect(() => stepFight(startFight(hero({ skillLeft: 0 }), ogre, 4), { type: 'skill', skill: 'power-strike' })).toThrow();
  });
  it('mend heals the mage, never above max', () => {
    const m = hero({ hp: 5 }, 'mage');
    const f = stepFight(startFight(m, MONSTERS[0][0], 4), { type: 'skill', skill: 'mend' });
    expect(f.log).toContainEqual(expect.objectContaining({ type: 'skill', skill: 'mend' }));
    const full = stepFight(startFight(hero({}, 'mage'), MONSTERS[0][0], 4), { type: 'skill', skill: 'mend' });
    expect(full.heroHp).toBeLessThanOrEqual(full.heroMaxHp);
  });
  it('dodge makes the monster miss and still hits back', () => {
    const t = hero({ hp: 20 }, 'trickster');
    const f = stepFight(startFight(t, ogre, 4), { type: 'skill', skill: 'dodge' });
    expect(f.heroHp).toBe(20);
    expect(f.monsterHp).toBeLessThan(ogre.hp);
    expect(f.log.map((e) => e.type)).toContain('monster-missed');
  });
  it('pinch takes gold once, and the gold arrives only if you win', () => {
    const t = hero({ strength: 500 }, 'trickster');
    const f = stepFight(startFight(t, ogre, 4), { type: 'skill', skill: 'pinch' });
    expect(f.goldPinched).toBeGreaterThan(0);
    expect(applyForestResult(t, f).gold).toBe(t.gold + ogre.gold + f.goldPinched);
  });
});

describe('masters and levelling', () => {
  it('need enough exp, and only one try a day', () => {
    expect(canChallengeMaster(hero()).ok).toBe(false);
    expect(canChallengeMaster(hero({ exp: expNeeded(1) })).ok).toBe(true);
    expect(canChallengeMaster(hero({ exp: expNeeded(1), masterTried: true })).ok).toBe(false);
    expect(() => startMasterFight(hero(), 1)).toThrow();
  });
  it('raise your level, stats and health when you win, and exp is never spent', () => {
    const h = hero({ exp: expNeeded(1), hp: 3 });
    const won = { ...startMasterFight(h, 1), over: true, outcome: 'won' as const };
    const after = applyMasterResult(h, won);
    expect(after.level).toBe(2);
    expect(after.maxHp).toBe(baseStats(2).maxHp);
    expect(after.strength).toBe(baseStats(2).strength);
    expect(after.hp).toBe(after.maxHp);
    expect(after.exp).toBe(h.exp);
    expect(after.masterTried).toBe(true);
  });
  it('cost nothing when you lose: you are just healed', () => {
    const h = hero({ exp: expNeeded(1), hp: 3, gold: 77 });
    const lost = { ...startMasterFight(h, 1), over: true, outcome: 'lost' as const };
    const after = applyMasterResult(h, lost);
    expect(after).toMatchObject({ level: 1, gold: 77, hp: h.maxHp, exp: h.exp, masterTried: true });
  });
  it('stop at level 12', () => {
    expect(canChallengeMaster(maxed()).ok).toBe(false);
  });
});

describe('the dragon', () => {
  it('waits for level 12 and the last master', () => {
    expect(canFaceDragon(hero())).toBe(false);
    expect(canFaceDragon(maxed())).toBe(true);
    expect(() => startDragonStage(hero(), 1, 1)).toThrow();
  });
  it('has three stages that cannot be run from', () => {
    expect(DRAGON_STAGES).toHaveLength(3);
    const f = startDragonStage(maxed(), 1, 1);
    expect(f.kind).toBe('dragon');
    expect(() => stepFight(f, { type: 'run' })).toThrow();
  });
  it('gives a star and a fresh start, keeping your class', () => {
    const done = finishDragon({ ...maxed(), heroClass: 'mage', dragonKills: 1 }, TODAY);
    expect(done).toMatchObject({ level: 1, dragonKills: 2, heroClass: 'mage', exp: 0, forestLeft: FOREST_FIGHTS_PER_DAY });
  });
});

describe('the healer, bank and shop', () => {
  it('heals as much as you can pay for', () => {
    const h = hero({ hp: 5, gold: 8, level: 4 }); // 1 gold an HP at level 4
    const after = heal(h, 20);
    expect(after.hp).toBe(13);
    expect(after.gold).toBe(0);
  });
  it('gives a discount for a right answer and never heals above max', () => {
    const h = hero({ hp: 10, maxHp: 20, gold: 1000, level: 8 }); // 2 gold an HP
    const full = heal(h, 100);
    expect(full.hp).toBe(20);
    expect(full.gold).toBe(1000 - 20);
    expect(heal(h, 10, 0.5).gold).toBe(1000 - 10);
  });
  it('banks gold safely, and only what you have', () => {
    const h = hero({ gold: 100 });
    expect(deposit(h, 40)).toMatchObject({ gold: 60, bank: 40 });
    expect(deposit(h, 400)).toMatchObject({ gold: 0, bank: 100 });
    expect(withdraw({ ...h, bank: 30 }, 50)).toMatchObject({ gold: 130, bank: 0 });
    expect(deposit(h, -5)).toMatchObject({ gold: 100, bank: 0 });
  });
  it('sells your old gear back for half, then charges the new price', () => {
    const rich = hero({ level: 2, gold: 1000, ...baseStats(2) });
    const first = buyGear(rich, 'weapon', 1);
    expect(first.ok && first.hero.weapon).toBe(1);
    if (!first.ok) throw new Error('should buy');
    const second = buyGear({ ...first.hero, level: 3, ...baseStats(3) }, 'weapon', 2);
    if (!second.ok) throw new Error('should buy');
    expect(second.refund).toBe(Math.floor(WEAPONS[1].cost / 2));
    expect(second.hero.gold).toBe(first.hero.gold + second.refund - second.paid);
  });
  it('will not sell gear you are too weak for, or too poor for, or that is worse', () => {
    expect(buyGear(hero({ gold: 100000 }), 'weapon', 11)).toMatchObject({ ok: false });
    expect(buyGear(hero({ gold: 0, ...baseStats(2), level: 2 }), 'weapon', 1)).toMatchObject({ ok: false });
    expect(buyGear(hero({ weapon: 5, gold: 99999 }), 'weapon', 3)).toMatchObject({ ok: false });
    expect(buyGear(hero({ gold: 99999 }), 'weapon', 0)).toMatchObject({ ok: false });
  });
  it('gives kindness a discount of 1% a point, up to 10%', () => {
    const level2 = { level: 2, gold: 1000, ...baseStats(2) };
    const plain = buyGear(hero(level2), 'weapon', 1);
    const kind = buyGear(hero({ ...level2, kindness: 50 }), 'weapon', 1);
    if (!plain.ok || !kind.ok) throw new Error('should buy');
    expect(kind.paid).toBe(Math.ceil(WEAPONS[1].cost * 0.9));
    expect(kind.paid).toBeLessThan(plain.paid);
  });
  it('raises attack with a weapon', () => {
    expect(heroAttack(hero({ weapon: 3 }))).toBe(hero().strength + WEAPONS[3].power);
  });
});

describe('the pace (a quick check of the simulator; npm run lord:sim has the full picture)', () => {
  it('lets a pupil playing four days a week reach the dragon inside a season, in any class', () => {
    for (const heroClass of ['knight', 'mage', 'trickster'] as const) {
      const s = summarise(heroClass, STYLES[1], 12);
      expect(s.reachedDragonShare, heroClass).toBeGreaterThan(0.7);
      expect(s.lossPerFight, heroClass).toBeLessThan(0.12);
    }
  });
});
