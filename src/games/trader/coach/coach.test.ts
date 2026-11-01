import { describe, expect, it } from 'vitest';
import { GOODS, LOLLIES, MAX_PODS, MOON_PRICE, SHIPS, WATER } from '../../../../shared/trader/config';
import { distance, makeGalaxy, type Galaxy } from '../../../../shared/trader/galaxy';
import { isBanned, marketFor } from '../../../../shared/trader/market';
import { hasShipyard, newTrader, type Trader } from '../../../../shared/trader/state';
import { allPrices, cargoPlan, nextUpgrade, SHIP_LADDER, stopOnTheWay, tradeIdeas, tradingMoney, WORTH_A_JUMP_PCT } from './advice';
import { nextStep, type CoachView } from './nextStep';

const DAY = 20_400;
const SEEDS = Array.from({ length: 40 }, (_, i) => `coach-${i}`);

function start(seed: string): { galaxy: Galaxy; t: Trader } {
  const galaxy = makeGalaxy(seed);
  return { galaxy, t: newTrader(galaxy, DAY) };
}
/** The same trader, landed on another planet (its prices read as a landing would). */
const at = (galaxy: Galaxy, t: Trader, planet: number): Trader => ({ ...t, location: planet, market: marketFor(galaxy, planet, t.day) });
const view = (galaxy: Galaxy, t: Trader, more: Partial<CoachView> = {}): CoachView => ({ galaxy, t, tab: 'trade', loans: true, ...more });

describe('Bolt: trade ideas', () => {
  it('always finds a trip that makes money from the very first planet, with goods the pupil can afford', () => {
    for (const seed of SEEDS) {
      const { galaxy, t } = start(seed);
      const trips = tradeIdeas(galaxy, t, allPrices(galaxy, t.day));
      expect(trips.find((trip) => trip.qty > 0), seed).toBeTruthy();
    }
  });

  it('never suggests a planet out of reach of a full tank, a loss, or a good the other planet bans', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const { galaxy, t } = start(seed);
      for (const planet of galaxy.planets) {
        const there = at(galaxy, t, planet.id);
        for (const trip of tradeIdeas(galaxy, there, allPrices(galaxy, t.day))) {
          expect(trip.each).toBeGreaterThan(0);
          expect(trip.fuel).toBeLessThanOrEqual(SHIPS[there.ship].fuelTank);
          expect(trip.fuel).toBe(distance(planet, galaxy.planets[trip.planet]));
          expect(isBanned(galaxy.planets[trip.planet], trip.good)).toBe(false);
          expect(trip.qty * trip.buy).toBeLessThanOrEqual(there.credits);
          expect(trip.qty).toBeLessThanOrEqual(SHIPS[there.ship].holds);
        }
      }
    }
  });

  it('puts the biggest profit on the whole load first', () => {
    const { galaxy, t } = start(SEEDS[0]);
    const trips = tradeIdeas(galaxy, t, allPrices(galaxy, t.day));
    for (let i = 1; i < trips.length; i++) expect(trips[i - 1].profit).toBeGreaterThanOrEqual(trips[i].profit);
  });
});

describe('Bolt: cargo in the hold', () => {
  it('says sell here unless a planet in reach pays clearly more, and then says where', () => {
    let sold = 0;
    let flown = 0;
    for (const seed of SEEDS.slice(0, 6)) {
      const { galaxy, t } = start(seed);
      for (const planet of galaxy.planets) {
        for (let good = 0; good < GOODS.length; good++) {
          const cargo = GOODS.map((_, g) => (g === good ? 5 : 0));
          const there = { ...at(galaxy, t, planet.id), cargo };
          const plan = cargoPlan(galaxy, there);
          if (!plan) throw new Error('a hold with cargo always has a plan');
          const step = nextStep(view(galaxy, there));
          if (plan.sellHere) {
            sold++;
            expect(plan.here).toBeGreaterThan(0);
            if (plan.best) expect(plan.best.sell * 100).toBeLessThan(plan.here * (100 + WORTH_A_JUMP_PCT));
            expect(step.say).toMatch(new RegExp(`^Sell your 5 ${GOODS[good]} here`));
            expect(step.target).toBe(`sell-all-${good}`);
          } else if (plan.best) {
            flown++;
            expect(plan.best.sell * 100).toBeGreaterThanOrEqual(Math.max(plan.here, 1) * (100 + WORTH_A_JUMP_PCT));
            expect(step.say).toContain(galaxy.planets[plan.best.planet].name);
            expect(step.say).toMatch(/^(Fly|Fill)/);
          }
        }
      }
    }
    expect(sold).toBeGreaterThan(20);
    expect(flown).toBeGreaterThan(20);
  });
});

describe('Bolt: upgrades', () => {
  it('never suggests an upgrade that leaves too little to trade with', () => {
    const { galaxy, t } = start(SEEDS[1]);
    const trips = tradeIdeas(galaxy, t, allPrices(galaxy, t.day));
    for (let credits = 0; credits <= 3000; credits += 25) {
      const rich = { ...t, credits };
      const up = nextUpgrade(galaxy, rich, tradeIdeas(galaxy, rich, allPrices(galaxy, t.day)));
      if (up) expect(credits - up.cost).toBeGreaterThanOrEqual(tradingMoney(rich, trips));
    }
  });

  it('suggests cargo pods on the Flea first, then the Firefly (skipping the smaller Gnat)', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const { galaxy, t } = start(seed);
      const yard = galaxy.planets.find((p) => p.tech >= SHIPS[2].minTech);
      if (!yard) continue;
      const there = { ...at(galaxy, t, yard.id), credits: 5000 };
      const trips = tradeIdeas(galaxy, there, allPrices(galaxy, t.day));
      expect(nextUpgrade(galaxy, there, trips)?.kind).toBe('pod');
      const podded = { ...there, pods: MAX_PODS };
      const up = nextUpgrade(galaxy, podded, trips);
      expect(up?.kind).toBe('ship');
      expect(up && 'index' in up ? up.index : -1).toBe(SHIP_LADDER[0]);
      expect(up?.target).toBe(`ship-buy-${SHIP_LADDER[0]}`);
    }
  });

  it('suggests nothing on a planet with no shipyard', () => {
    const { galaxy, t } = start(SEEDS[2]);
    const none = galaxy.planets.find((p) => !hasShipyard(galaxy, { ...t, location: p.id }));
    if (!none) return;
    const there = { ...at(galaxy, t, none.id), credits: 5000 };
    expect(nextUpgrade(galaxy, there, tradeIdeas(galaxy, there, allPrices(galaxy, t.day)))).toBeNull();
  });
});

describe('Bolt: the next step', () => {
  it('on day one points at the best buy, with Buy max lit up', () => {
    for (const seed of SEEDS) {
      const { galaxy, t } = start(seed);
      const step = nextStep(view(galaxy, t));
      expect(step.say, seed).toMatch(/^⭐ Best buy here: \w+\. It costs \d+ here and \w+ pays \d+: \+\d+ each\./);
      expect(step.target).toMatch(/^buy-max-\d$/);
    }
  });

  it('points at the tab first when the button is on another tab', () => {
    const { galaxy, t } = start(SEEDS[0]);
    expect(nextStep(view(galaxy, t, { tab: 'ship' })).target).toBe('tab-trade');
    const loaded = { ...t, cargo: GOODS.map((_, g) => (g === WATER ? 5 : 0)) };
    const step = nextStep(view(galaxy, loaded, { tab: 'bank' }));
    expect(step.target).toMatch(/^tab-(trade|map|ship)$/);
  });

  it('says the moon can be bought once there is enough', () => {
    const { galaxy, t } = start(SEEDS[0]);
    const step = nextStep(view(galaxy, { ...t, credits: MOON_PRICE }, { tab: 'ship' }));
    expect(step.say).toMatch(/moon/);
    expect(step.target).toBe('moon-buy');
    expect(nextStep(view(galaxy, { ...t, credits: MOON_PRICE, moon: true })).say).not.toMatch(/buy your own moon/);
  });

  it('says when the day\'s jumps are used up', () => {
    const { galaxy, t } = start(SEEDS[0]);
    expect(nextStep(view(galaxy, { ...t, jumpsLeft: 0 })).say).toMatch(/all your jumps for today/);
  });

  it('warns before a jump to a planet that bans cargo in the hold', () => {
    for (const seed of SEEDS) {
      const { galaxy, t } = start(seed);
      const strict = galaxy.planets.find((p) => isBanned(p, LOLLIES) && p.id !== t.location && distance(galaxy.planets[t.location], p) <= t.fuel);
      if (!strict) continue;
      const step = nextStep(view(galaxy, { ...t, cargo: GOODS.map((_, g) => (g === LOLLIES ? 2 : 0)) }, { tab: 'map', aimed: strict.id }));
      expect(step.say).toBe(`Careful! ${strict.name} bans Lollies. Customs there would take them and fine you. Sell them first, or pick another planet.`);
      return;
    }
    throw new Error('no galaxy had a planet that bans Lollies in reach');
  });

  it('when the typed planet is too far, says so and names a stop on the way', () => {
    const { galaxy, t } = start(SEEDS[3]);
    const here = galaxy.planets[t.location];
    const far = [...galaxy.planets].sort((a, b) => distance(here, b) - distance(here, a))[0];
    if (distance(here, far) <= SHIPS[t.ship].fuelTank) return;
    const step = nextStep(view(galaxy, t, { tab: 'map', aimed: far.id }));
    expect(step.say).toMatch(new RegExp(`^${far.name} is \\d+ squares away, but your tank only holds ${SHIPS[t.ship].fuelTank}\\.`));
    const stop = stopOnTheWay(galaxy, t, far.id);
    if (stop) {
      expect(step.say).toContain(`Stop at ${stop.name}`);
      expect(step.target).toBe(`planet-${stop.id}`);
    }
  });

  it('when fuel is short, points at the buy-fuel button; with enough, at Jump!', () => {
    const { galaxy, t } = start(SEEDS[0]);
    const here = galaxy.planets[t.location];
    const near = galaxy.planets.find((p) => p.id !== here.id && distance(here, p) <= SHIPS[t.ship].fuelTank) as (typeof galaxy.planets)[number];
    const empty = nextStep(view(galaxy, { ...t, fuel: 0 }, { tab: 'map', aimed: near.id }));
    expect(empty.say).toMatch(/Buy \d+ more fuel/);
    expect(empty.target).toBe('jump-fuel');
    const full = nextStep(view(galaxy, { ...t, fuel: SHIPS[t.ship].fuelTank }, { tab: 'map', aimed: near.id }));
    expect(full.say).toMatch(/Press Jump!$/);
    expect(full.target).toBe('jump-go');
  });

  it('asks for a low hull to be mended', () => {
    const { galaxy, t } = start(SEEDS[0]);
    const step = nextStep(view(galaxy, { ...t, hull: 5 }, { tab: 'ship' }));
    expect(step.say).toMatch(/hull is getting low \(5 of 25\)/);
    expect(step.target).toBe('ship-mend');
  });

  it('suggests a cargo pod when there is money to spare at a shipyard', () => {
    const { galaxy, t } = start(SEEDS[0]);
    expect(hasShipyard(galaxy, t)).toBe(true);
    const step = nextStep(view(galaxy, { ...t, credits: 2000 }));
    expect(step.say).toMatch(/^You can afford a cargo pod/);
    expect(step.target).toBe('tab-ship');
    expect(nextStep(view(galaxy, { ...t, credits: 2000 }, { tab: 'ship' })).target).toBe('ship-pod');
  });

  it('with no credits, offers the bank (when it is open) instead of a buy', () => {
    const { galaxy, t } = start(SEEDS[0]);
    expect(nextStep(view(galaxy, { ...t, credits: 0 })).say).toMatch(/Bank can lend/);
    expect(nextStep(view(galaxy, { ...t, credits: 0 }, { loans: false })).say).toMatch(/^Nothing here makes a profit/);
  });
});
