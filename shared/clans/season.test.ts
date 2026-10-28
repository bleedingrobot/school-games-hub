import { describe, expect, it } from 'vitest';
import { applyAction, type ServerState } from './actions';
import { CONFIG } from './config';
import { startingDrafts } from './create';
import { empireOf, upgrade } from './empire';
import { classRaidsResting, newSeasonSave, phaseOf, readClock } from './season';

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
