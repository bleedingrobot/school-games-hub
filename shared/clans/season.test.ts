import { describe, expect, it } from 'vitest';
import { applyAction, type ServerState } from './actions';
import { CONFIG } from './config';
import { startingDrafts } from './create';
import { empireOf, upgrade } from './empire';
import { beatenThisSeason, classRaidsResting, newSeasonSave, phaseOf, readClock, seasonRoad, type SeasonClock } from './season';
import type { Clan } from './types';

const SEED = 4242;
function created(): ServerState {
  const out = applyAction(null, { type: 'create', name: 'Red Banner', drafts: startingDrafts(SEED) }, { seed: SEED, today: 20_000 });
  if (!out.ok || !out.state) throw new Error('create failed');
  return out.state;
}

describe('season phases and the clock', () => {
  it('the numbers', () => {
    expect(CONFIG.season).toEqual({ length: 35, warnFrom: 22, monsterFrom: 29, villageReward: { fame: 50, points: 10 } });
  });

  it('phaseOf', () => {
    expect([1, 21, 22, 28, 29, 35].map(phaseOf)).toEqual(['build', 'build', 'warning', 'warning', 'monster', 'monster']);
  });

  it('readClock reads a good clock and refuses anything odd', () => {
    expect(readClock({ number: 3, day: 12, daysLeft: 23, clockOn: true })).toEqual({ number: 3, day: 12, daysLeft: 23, clockOn: true });
    for (const bad of [null, undefined, 5, 'x', [], {}, { number: 1, day: 1, daysLeft: 1 }, { number: '1', day: 1, daysLeft: 1, clockOn: true }, { number: 1, day: -1, daysLeft: 1, clockOn: true }, { number: 1, day: 1.5, daysLeft: 1, clockOn: true }, { number: 1, day: 1, daysLeft: 1, clockOn: 'yes' }]) {
      expect(readClock(bad)).toBeNull();
    }
  });

  it('class raids rest only with the clock on and from day 22', () => {
    const c = (day: number, clockOn = true) => ({ number: 1, day, daysLeft: 0, clockOn });
    expect(classRaidsResting(c(21))).toBe(false);
    expect(classRaidsResting(c(22))).toBe(true);
    expect(classRaidsResting(c(35))).toBe(true);
    expect(classRaidsResting(c(30, false))).toBe(false);
    expect(classRaidsResting(null)).toBe(false);
    expect(classRaidsResting(undefined)).toBe(false);
  });
});

describe('newSeasonSave', () => {
  function played(): ServerState {
    const s = created();
    s.clan.gold = 9000;
    s.clan.followers = 7;
    s.clan.wakesToday = 2;
    s.clan.questDay = 3;
    s.clan.members.forEach((m, i) => { m.level = 5 + i; m.xp = 999; m.gear = { weapon: 'Sword' }; m.points = 4; m.knockedOut = i === 1; });
    s.clan.members[2].look = 'bold' as never;
    s.day = 9; s.fightsLeft = 1; s.fightNo = 11; s.raidNo = 4; s.examined = ['Ash|Sword'];
    const e = empireOf(s.clan);
    e.day = 9; e.buildsSaved = 3; e.troops.footman = 8; e.raidsToday = 1; e.shieldUntil = 12;
    upgrade(s.clan, 'smithy');
    s.clan.season = 1;
    return s;
  }

  it('resets everything it should', () => {
    const before = played();
    const copy = structuredClone(before);
    const s = newSeasonSave(before, 2);
    expect(before).toEqual(copy);
    const c = s.clan;
    expect(c).toMatchObject({ gold: CONFIG.startGold, followers: 0, wakesToday: 0, season: 2, village: { trainingHall: 0, smithy: 0, church: 0 } });
    expect(c.questDay).toBeUndefined();
    const e = empireOf(c);
    expect(Object.values(e.levels).every((n) => n === 0)).toBe(true);
    expect(e).toMatchObject({ buildsToday: 0, buildsSaved: 0, troops: { footman: 0, axeman: 0, knight: 0 }, day: 9, raidsToday: 0, shieldUntil: 0, raidedToday: [] });
    expect(s.examined).toEqual([]);
    c.members.forEach((m) => expect(m).toMatchObject({ level: 1, xp: 0, gear: {}, knockedOut: false, hp: m.maxHp, points: expect.any(Number) }));
  });

  it('keeps names, races, classes and looks, and the clan\'s own numbers', () => {
    const before = played();
    const s = newSeasonSave(before, 2);
    expect(s.clan.name).toBe(before.clan.name);
    s.clan.members.forEach((m, i) => {
      const old = before.clan.members[i];
      expect([m.name, m.race, m.cls, m.look]).toEqual([old.name, old.race, old.cls, old.look]);
    });
    expect(s.clan.members[2].look).toBe('bold');
    expect([s.seed, s.day, s.createdNzDay, s.fightNo, s.raidNo, s.fightsLeft]).toEqual([before.seed, before.day, before.createdNzDay, before.fightNo, before.raidNo, before.fightsLeft]);
  });

  it('is deterministic for the same season and different for another', () => {
    const before = played();
    expect(newSeasonSave(before, 2)).toEqual(newSeasonSave(before, 2));
    expect(newSeasonSave(before, 3).clan.members.map((m) => m.stats)).not.toEqual(newSeasonSave(before, 2).clan.members.map((m) => m.stats));
  });
});

describe('the season road', () => {
  const G = { name: 'Grimmor the Storm Giant', short: 'Grimmor' };
  const at = (day: number, beaten = false) => {
    const clock: SeasonClock = { number: 1, day, daysLeft: CONFIG.season.length - day, clockOn: true };
    return seasonRoad(clock, G, beaten);
  };
  const said = (day: number, beaten = false) => { const h = at(day, beaten).headline; return `${h.before}${h.strong}${h.after}`; };

  it('has four stages built from the rules', () => {
    const { stages } = at(1);
    expect(stages.map((s) => [s.id, s.name, s.when])).toEqual([
      ['build', 'Build', 'Days 1–21'], ['ready', 'Get ready', 'Days 22–28'], ['monster', 'Monster week', 'Days 29–35'], ['new', 'New season', 'Day 1 again'],
    ]);
    expect(stages.map((s) => [s.from, s.to])).toEqual([[1, 21], [22, 28], [29, 35], [36, 36]]);
    expect(stages[2].say).toBe('Grimmor attacks! One try a day');
  });

  it('marks done, now and next', () => {
    const states = (d: number) => at(d).stages.map((s) => s.state);
    expect(states(1)).toEqual(['now', 'next', 'next', 'next']);
    expect(states(21)).toEqual(['now', 'next', 'next', 'next']);
    expect(states(22)).toEqual(['done', 'now', 'next', 'next']);
    expect(states(28)).toEqual(['done', 'now', 'next', 'next']);
    expect(states(29)).toEqual(['done', 'done', 'now', 'next']);
    expect(states(35)).toEqual(['done', 'done', 'now', 'next']);
  });

  it('says the right thing each day', () => {
    expect(said(1)).toBe('28 days until Grimmor the Storm Giant comes. 21 days to build before supplies go on sale.');
    expect(at(1).headline.strong).toBe('28 days');
    expect(said(21)).toBe('8 days until Grimmor the Storm Giant comes. 1 day to build before supplies go on sale.');
    expect(said(22)).toBe('Grimmor comes in 7 days! Buy supplies in the Market and get strong.');
    expect(said(27)).toBe('Grimmor comes in 2 days! Buy supplies in the Market and get strong.');
    expect(said(28)).toBe('Grimmor comes tomorrow! Buy supplies in the Market and get strong.');
    expect(at(28).headline.strong).toBe('tomorrow');
    expect(said(29)).toBe('Monster week! 7 days left to beat Grimmor. One try a day.');
    expect(said(34)).toBe('Monster week! 2 days left to beat Grimmor. One try a day.');
    expect(said(35)).toBe('Last day of the season! Last chance to beat Grimmor. Tomorrow your clan starts fresh. Your trophies stay forever.');
  });

  it('changes after a win', () => {
    expect(said(31, true)).toBe('You beat Grimmor! New season in 5 days.');
    expect(at(31, true).headline.strong).toBe('New season in 5 days.');
    expect(said(34, true)).toBe('You beat Grimmor! New season in 2 days.');
    expect(said(35, true)).toBe('Last day of the season! You beat Grimmor. Tomorrow your clan starts fresh. Your trophies stay forever.');
  });

  it('fills the road evenly, reaching each stop as its stage starts', () => {
    expect(at(1).fill).toBe(0);
    expect(at(22).fill).toBeCloseTo(1 / 3, 10);
    expect(at(29).fill).toBeCloseTo(2 / 3, 10);
    for (let d = 1; d <= CONFIG.season.length; d++) {
      const f = at(d).fill;
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      if (d > 1) expect(f).toBeGreaterThan(at(d - 1).fill);
    }
  });

  it('writes the screen reader sentence', () => {
    expect(at(24).label).toBe('Season 1, day 24 of 35. Now: Get ready. Next: Monster week in 5 days.');
    expect(at(1).label).toBe('Season 1, day 1 of 35. Now: Build. Next: Get ready in 21 days.');
    expect(at(30).label).toBe('Season 1, day 30 of 35. Now: Monster week. Next: New season in 6 days.');
    expect(at(35).label).toBe('Season 1, day 35 of 35. Now: Monster week. Next: New season in 1 day.');
  });

  it('knows whether this season\'s monster was beaten', () => {
    const clan = (monster?: Clan['monster']) => ({ monster }) as Clan;
    const save = { season: 2, tries: 1, losses: 0, lastDay: 1, supplies: { arrows: 0, potions: 0, net: 0 } };
    expect(beatenThisSeason(clan(), 2)).toBe(false);
    expect(beatenThisSeason(clan(save), 2)).toBe(false);
    expect(beatenThisSeason(clan({ ...save, wonDay: 31 }), 2)).toBe(true);
    expect(beatenThisSeason(clan({ ...save, wonDay: 31 }), 3)).toBe(false);
    expect(beatenThisSeason(null, 2)).toBe(false);
  });
});
