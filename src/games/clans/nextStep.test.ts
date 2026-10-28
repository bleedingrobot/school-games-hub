import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../../shared/clans/config';
import { KINGDOMS, empireOf } from '../../../shared/clans/empire';
import { kingdomLight, nextVillageStep, strengthKey, trafficLight } from './nextStep';
import { makeClan, startingDrafts } from './session';

describe('nextVillageStep', () => {
  const fresh = () => makeClan('T', startingDrafts(1));
  it('goes down the list in order', () => {
    const c = fresh();
    const e = empireOf(c);
    c.gold = 500;
    expect(nextVillageStep(c).say).toBe('Build your first Barracks so troops can join you.');
    c.gold = 20;
    expect(nextVillageStep(c).say).toBe('Win 50 gold in the Mines, then build your first Barracks so troops can join you.');
    c.gold = 500;
    e.buildsToday = CONFIG.empire.buildsPerDay;
    expect(nextVillageStep(c).say).toBe('Your builders are resting. Come back tomorrow to build your first Barracks.');
    e.buildsToday = 0;
    e.levels.barracks = 1;
    expect(nextVillageStep(c).say).toBe('Buy some troops, or win fights in the Mines so followers join you.');
    e.troops.footman = 3;
    e.kingdomRaidsToday = 0;
    expect(nextVillageStep(c).say).toBe('Try a raid! Bunny Hollow is a good first one.');
    e.kingdomRaidsToday = CONFIG.empire.raids.kingdomPerDay;
    expect(nextVillageStep(c).say).toBe('Upgrade your Smithy for better weapons.');
    e.levels.smithy = CONFIG.empire.buildings.smithy.max;
    expect(nextVillageStep(c).say).toBe('Upgrade your Forge so your raiders hit harder.');
    c.gold = 10;
    expect(nextVillageStep(c).say).toBe('Win more gold in the Mines to upgrade your village.');
    c.gold = 500;
    e.buildsToday = CONFIG.empire.buildsPerDay;
    expect(nextVillageStep(c).say).toBe('All done for today. Come back tomorrow.');
  });
  it('never uses the old words', () => {
    const c = fresh();
    for (const gold of [0, 500]) {
      c.gold = gold;
      expect(nextVillageStep(c).say).not.toMatch(/vault|develop|draft|energy|land/i);
    }
  });
});

describe('strengthKey and traffic light', () => {
  it('reads the numbers from the config', () => {
    expect(strengthKey()).toBe(`(footman ${CONFIG.empire.troopMight.footman}, axeman ${CONFIG.empire.troopMight.axeman}, knight ${CONFIG.empire.troopMight.knight})`);
  });
  it('uses 1.2x and 0.8x of their strength', () => {
    expect(trafficLight(120, 100)).toBe('win');
    expect(trafficLight(119, 100)).toBe('close');
    expect(trafficLight(80, 100)).toBe('close');
    expect(trafficLight(79, 100)).toBe('tough');
    expect(trafficLight(0, 100)).toBe('tough');
  });
  it('uses the simulator strength that wins about 80% of the time', () => {
    const bunny = KINGDOMS.find((k) => k.id === 'bunny-hollow')!;
    const dragon = KINGDOMS.find((k) => k.id === 'dragons-rest')!;
    expect(kingdomLight(15, bunny)).toBe('win');
    expect(kingdomLight(9, bunny)).toBe('close');
    expect(kingdomLight(8, bunny)).toBe('tough');
    // Dragon's Rest has 280 troops but tall walls: 340 is not enough to say "you should win".
    expect(kingdomLight(340, dragon)).toBe('close');
    expect(kingdomLight(440, dragon)).toBe('win');
    expect(kingdomLight(0, dragon)).toBe('tough');
  });
  it('knows every kingdom', () => {
    for (const k of KINGDOMS) expect(kingdomLight(100000, k)).toBe('win');
  });
});
