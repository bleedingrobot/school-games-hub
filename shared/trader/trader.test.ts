import { describe, expect, it } from 'vitest';
import { playGame } from './bot';
import {
  GOODS, GOVERNMENTS, JUMPS_PER_DAY, LOAN_MAX, LOLLIES, MOON_PRICE, PLANET_COUNT, SHIPS, START_CREDITS, WATER,
} from './config';
import { acceptDeal, encounterChance, encounterFor, isGoodDeal, settleCustoms, settleJunk } from './encounter';
import { fightRound, settleFight, startFight } from './fight';
import { distance, isPlayable, makeGalaxy } from './galaxy';
import { isBanned, marketFor, standardPrice } from './market';
import { borrow, buy, buyMoon, buyShip, freeHolds, fuelNeeded, newTrader, reachable, refuel, repay, sell, startDay, travel } from './state';

const galaxy = makeGalaxy('test-season');

describe('galaxy', () => {
  it('is the same every time for one seed and different for another', () => {
    expect(makeGalaxy('test-season')).toEqual(galaxy);
    expect(makeGalaxy('another-season').planets.map((p) => p.x)).not.toEqual(galaxy.planets.map((p) => p.x));
  });

  it('has 24 real-named planets at least 3 apart, on a 20 x 20 grid, with tech inside the government range', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const g = makeGalaxy(seed);
      expect(g.planets).toHaveLength(PLANET_COUNT);
      expect(new Set(g.planets.map((p) => p.name)).size).toBe(PLANET_COUNT);
      expect(isPlayable(g)).toBe(true);
      for (const p of g.planets) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThan(20);
        expect(p.tech).toBeGreaterThanOrEqual(GOVERNMENTS[p.government].minTech);
        expect(p.tech).toBeLessThanOrEqual(GOVERNMENTS[p.government].maxTech);
        for (const q of g.planets) if (q.id !== p.id) expect(distance(p, q)).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe('market', () => {
  it('is the same on the same day and changes with the day', () => {
    expect(marketFor(galaxy, 0, 3)).toEqual(marketFor(galaxy, 0, 3));
    expect(marketFor(galaxy, 0, 3)).not.toEqual(marketFor(galaxy, 0, 4));
  });

  it('refuses banned goods and goods a planet cannot use, and never sells what it cannot make', () => {
    for (const p of galaxy.planets) {
      const m = marketFor(galaxy, p.id, 1);
      for (const line of m) {
        if (isBanned(p, line.good)) expect(line).toMatchObject({ sell: 0, buy: 0 });
        if (line.buy > 0) expect(line.buy).toBeGreaterThan(line.sell);
        if (line.sell === 0) expect(line.buy).toBe(0);
      }
    }
    const navy = galaxy.planets.find((p) => GOVERNMENTS[p.government].name === 'Robot council');
    if (navy) expect(standardPrice(navy, LOLLIES)).toBe(0);
  });
});

describe('trading', () => {
  const start = newTrader(galaxy, 1);

  it('starts with 100 credits, a Flea, a full tank and ten jumps', () => {
    expect(start).toMatchObject({ credits: START_CREDITS, ship: 0, jumpsLeft: JUMPS_PER_DAY, fuel: SHIPS[0].fuelTank });
    expect(freeHolds(start)).toBe(10);
  });

  it('buys and sells with the right money, and a sharp-trader discount helps', () => {
    const line = start.market.find((m) => m.buy > 0 && m.stock > 2)!;
    const plain = buy(start, line.good, 2);
    const sharp = buy(start, line.good, 2, -200);
    if (!plain.ok || !sharp.ok) throw new Error('should buy');
    expect(plain.state.credits).toBe(START_CREDITS - line.buy * 2);
    expect(sharp.state.credits).toBeGreaterThanOrEqual(plain.state.credits);
    expect(plain.state.market[line.good].stock).toBe(line.stock - 2);
    expect(plain.state.cargo[line.good]).toBe(2);
    expect(start.credits).toBe(START_CREDITS);
  });

  it('refuses what cannot be done and says why', () => {
    expect(buy(start, WATER, 0)).toMatchObject({ ok: false });
    expect(buy({ ...start, credits: 0 }, start.market.findIndex((m) => m.buy > 0), 1)).toMatchObject({ ok: false });
    expect(sell(start, WATER, 1)).toMatchObject({ ok: false });
    expect(travel(galaxy, { ...start, jumpsLeft: 0 }, 1)).toMatchObject({ ok: false });
    expect(buyMoon(galaxy, start)).toMatchObject({ ok: false });
  });

  it('jumps cost across + up in fuel, one jump, and load the new market', () => {
    const dest = reachable(galaxy, start)[0];
    const r = travel(galaxy, start, dest);
    if (!r.ok) throw new Error('should travel');
    expect(r.state.fuel).toBe(start.fuel - fuelNeeded(galaxy, start, dest));
    expect(r.state.jumpsLeft).toBe(JUMPS_PER_DAY - 1);
    expect(r.state.location).toBe(dest);
    expect(r.state.market).toEqual(marketFor(galaxy, dest, 1));
    const far = galaxy.planets.find((p) => distance(galaxy.planets[start.location], p) > start.fuel);
    if (far) expect(travel(galaxy, start, far.id)).toMatchObject({ ok: false });
  });

  it('refuels for a sensible price', () => {
    const low = { ...start, fuel: 5 };
    const r = refuel(low, 100);
    if (!r.ok) throw new Error('should refuel');
    expect(r.state.fuel).toBe(SHIPS[0].fuelTank);
    expect(r.state.credits).toBe(START_CREDITS - Math.ceil((15 * SHIPS[0].fuelTenths) / 10));
    expect(refuel(start, 1)).toMatchObject({ ok: false });
  });

  it('lets you buy the moon with the money, and not before', () => {
    const yard = galaxy.planets.find((p) => p.tech >= 4)!;
    const rich = { ...start, location: yard.id, credits: MOON_PRICE + 5 };
    const r = buyMoon(galaxy, rich);
    if (!r.ok) throw new Error('should buy the moon');
    expect(r.state.moon).toBe(true);
    expect(r.state.credits).toBe(5);
    expect(buyMoon(galaxy, { ...rich, credits: MOON_PRICE - 1 })).toMatchObject({ ok: false });
  });

  it('changes ships at a shipyard and pays for it less the trade-in', () => {
    const yard = galaxy.planets.find((p) => p.tech >= 5)!;
    const t = { ...start, location: yard.id, credits: 1000 };
    const r = buyShip(galaxy, t, 1);
    if (!r.ok) throw new Error('should buy a ship');
    expect(r.state.ship).toBe(1);
    expect(r.state.credits).toBe(1000 - SHIPS[1].price);
    expect(buyShip(galaxy, { ...t, credits: 10 }, 1)).toMatchObject({ ok: false });
  });
});

describe('bank', () => {
  const start = newTrader(galaxy, 1);

  it('lends up to the limit, adds 10% of what was borrowed once a week, and never interest on interest', () => {
    const lent = borrow(start, 300);
    if (!lent.ok) throw new Error('should lend');
    expect(lent.state.credits).toBe(START_CREDITS + 300);
    expect(borrow(lent.state, LOAN_MAX)).toMatchObject({ ok: false });
    let t = lent.state;
    for (let day = 2; day <= 15; day++) t = startDay(galaxy, t, day);
    // Borrowed on day 1; weeks end on day 8 and day 15: two charges of 30.
    expect(t.loan.owed).toBe(360);
    expect(t.loan.principal).toBe(300);
  });

  it('takes a share of each sale towards the loan, and can be paid back by hand', () => {
    const lent = borrow(start, 100);
    if (!lent.ok) throw new Error('should lend');
    const withGoods = { ...lent.state, cargo: GOODS.map(() => 0) };
    const line = withGoods.market.find((m) => m.sell > 0)!;
    withGoods.cargo[line.good] = 10;
    const sold = sell(withGoods, line.good, 10);
    if (!sold.ok) throw new Error('should sell');
    expect(sold.state.loan.owed).toBeLessThan(100);
    const paid = repay(sold.state, 1000);
    if (!paid.ok) throw new Error('should repay');
    expect(paid.state.loan.owed).toBe(0);
  });
});

describe('encounters and fights', () => {
  it('rolls the same encounter for the same jump and about 1 jump in 3 has one', () => {
    let any = 0;
    const t = newTrader(galaxy, 1);
    for (let n = 1; n <= 600; n++) {
      const here = { ...t, jumpNo: n, location: n % PLANET_COUNT, market: marketFor(galaxy, n % PLANET_COUNT, 1) };
      const e = encounterFor(galaxy, here, 'seed');
      expect(encounterFor(galaxy, here, 'seed')).toEqual(e);
      if (e.kind !== 'none') any++;
    }
    expect(any / 600).toBeGreaterThan(0.15);
    expect(any / 600).toBeLessThan(0.5);
    expect(encounterChance(galaxy, 0)).toBeLessThanOrEqual(60);
  });

  it('customs take banned goods and charge a small fine, never more than you have', () => {
    const t = { ...newTrader(galaxy, 1), cargo: GOODS.map((_, i) => (i === LOLLIES ? 5 : 0)), credits: 3 };
    const r = settleCustoms(t, [LOLLIES]);
    expect(r.state.cargo[LOLLIES]).toBe(0);
    expect(r.taken).toBe(5);
    expect(r.fine).toBe(3);
    expect(r.state.credits).toBe(0);
  });

  it('junk costs a little hull only when steered badly, and never to zero', () => {
    const t = { ...newTrader(galaxy, 1), hull: 3 };
    expect(settleJunk(t, true).hull).toBe(3);
    expect(settleJunk(t, false).hull).toBe(1);
  });

  it('trader deals can be good or bad and accepted', () => {
    const t = { ...newTrader(galaxy, 1), jumpNo: 0 };
    const sells = { kind: 'trader', good: WATER, qty: 4, sells: true, price: 3, fair: 5 } as const;
    expect(isGoodDeal(sells)).toBe(true);
    expect(acceptDeal(t, sells)?.cargo[WATER]).toBe(4);
    expect(acceptDeal({ ...t, credits: 1 }, sells)).toBeNull();
  });

  it('a fight is the same twice, a good ship can win with no right answers, a poor one can flee, and a wreck keeps the money', () => {
    const armed = { ...newTrader(galaxy, 1), ship: 3, hull: 100, weapons: [2, 2], shields: [1] };
    const play = (right: boolean) => {
      let f = startFight(armed, 0, 'f1');
      while (f.outcome === 'going') f = fightRound(armed, f, 'charge', right);
      return f;
    };
    expect(play(false)).toEqual(play(false));
    expect(play(false).outcome).toBe('won');
    expect(settleFight(armed, play(true)).credits).toBeGreaterThan(armed.credits);

    const flea = newTrader(galaxy, 1);
    let f = startFight(flea, 2, 'f2');
    for (let i = 0; i < 20 && f.outcome === 'going'; i++) f = fightRound(flea, f, 'flee', false);
    expect(['fled', 'robbed', 'destroyed']).toContain(f.outcome);

    const wrecked = settleFight({ ...flea, credits: 500, cargo: GOODS.map(() => 3) }, { ...f, outcome: 'destroyed', hull: 0 });
    expect(wrecked.credits).toBe(500);
    expect(wrecked.cargo.every((q) => q === 0)).toBe(true);
    expect(wrecked.ship).toBe(0);
  });
});

describe('a whole game', () => {
  it('a bot trader can reach the moon inside a season and the game is exactly repeatable', () => {
    const play = () => playGame(galaxy, newTrader(galaxy, 1), 'whole', 40, { mathsRate: 0.7, sloppy: 0.3 });
    const a = play();
    expect(a.moonDay).toBeGreaterThan(5);
    expect(a.moonDay).toBeLessThanOrEqual(40);
    expect(play()).toEqual(a);
  });
});
