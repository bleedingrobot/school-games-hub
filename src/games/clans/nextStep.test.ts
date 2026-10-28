import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../../shared/clans/config';
import { KINGDOMS, draft, empireOf } from '../../../shared/clans/empire';
import { draftPreview, kingdomLight, nextEmpireStep, strengthKey, trafficLight } from './nextStep';
import { makeClan, startingDrafts } from './session';

const clanWith = (followers: number, percent: number, barracks: number, footmen: number) => {
  const clan = makeClan('Test Clan', startingDrafts(1));
  const e = empireOf(clan);
  clan.followers = followers;
  e.draftPercent = percent;
  for (let i = 0; i < barracks; i++) e.plots.push({ width: 4, length: 4, building: 'barracks' });
  e.troops.footman = footmen;
  return clan;
};

describe('draftPreview matches the engine', () => {
  const cases: [number, number, number, number][] = [
    [50, 20, 1, 0], [50, 0, 1, 0], [50, 20, 0, 0], [50, 20, 1, 20], [50, 20, 1, 15], [7, 5, 2, 0], [1, 5, 1, 0], [0, 20, 1, 0], [33, 15, 1, 12], [100, 25, 3, 59],
  ];
  it.each(cases)('%i followers at %i%%, %i barracks, %i footmen', (followers, percent, barracks, footmen) => {
    const clan = clanWith(followers, percent, barracks, footmen);
    const p = draftPreview(empireOf(clan), clan.followers);
    const real = draft(clan);
    expect(p.joined).toBe(real.joined);
    expect(p.wanted).toBe(real.wanted);
    expect(p.followers).toBe(real.followers);
    expect(p.why === null).toBe(real.joined > 0);
  });
  it('says why nobody would join', () => {
    const why = (f: number, pc: number, b: number, ft: number) => { const c = clanWith(f, pc, b, ft); return draftPreview(empireOf(c), c.followers).why; };
    expect(why(50, 0, 1, 0)).toBe('Pick a bigger draft first');
    expect(why(50, 20, 0, 0)).toBe('Build a Barracks first');
    expect(why(50, 20, 1, 20)).toBe('Your barracks are full');
  });
});

describe('nextEmpireStep', () => {
  const fresh = () => { const c = makeClan('T', startingDrafts(1)); return c; };
  it('goes down the list in order', () => {
    const c = fresh();
    const e = empireOf(c);
    e.vault = 0; c.gold = 250;
    expect(nextEmpireStep(e, c)).toEqual({ say: 'Put some gold in your vault so you can build.', putIn: 100 });
    c.gold = 30;
    expect(nextEmpireStep(e, c).putIn).toBe(30);
    c.gold = 0; e.vault = 500;
    expect(nextEmpireStep(e, c).say).toBe('Get a plot of land ready in Land and buildings.');
    e.plots.push({ width: 4, length: 4 });
    expect(nextEmpireStep(e, c).say).toBe('Build a Barracks so your troops have somewhere to live.');
    e.plots[0].building = 'barracks';
    expect(nextEmpireStep(e, c).say).toBe('Buy some troops, or draft your followers, in Barracks and troops.');
    e.troops.footman = 3;
    e.kingdomRaidsToday = 0;
    expect(nextEmpireStep(e, c).say).toBe('Try a raid! Bunny Hollow is a good first one.');
    e.kingdomRaidsToday = CONFIG.empire.raids.kingdomPerDay;
    expect(nextEmpireStep(e, c).say).toBe('All done for today. Come back tomorrow.');
  });
  it('does not ask for gold when the purse is empty', () => {
    const c = fresh(); const e = empireOf(c);
    e.vault = 0; c.gold = 0;
    expect(nextEmpireStep(e, c).putIn).toBeUndefined();
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
