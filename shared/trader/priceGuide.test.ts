import { describe, expect, it } from 'vitest';
import { SHIPS, WATER } from './config';
import { distance, makeGalaxy } from './galaxy';
import { marketFor } from './market';
import { bestSales, pricesAt, schoolPushes } from './priceGuide';
import { priceMove, pushedLine } from './schoolMarket';
import { newTrader } from './state';

const galaxy = makeGalaxy('guide-test');

describe('what other planets pay', () => {
  it('finds, for each good, the best price on a planet a full tank can reach', () => {
    const t = newTrader(galaxy, 50);
    const here = galaxy.planets[t.location];
    const best = bestSales(galaxy, t);
    best.forEach((b, good) => {
      if (!b) return;
      expect(b.planet).not.toBe(t.location);
      expect(b.fuel).toBe(distance(here, galaxy.planets[b.planet]));
      expect(b.fuel).toBeLessThanOrEqual(SHIPS[t.ship].fuelTank);
      for (const p of galaxy.planets) {
        if (p.id === t.location || distance(here, p) > SHIPS[t.ship].fuelTank) continue;
        expect(marketFor(galaxy, p.id, 50)[good].sell).toBeLessThanOrEqual(b.sell);
      }
    });
    // There is at least one trade from the start that makes money (the reason this was added).
    expect(t.market.some((line, good) => line.buy > 0 && line.stock > 0 && (best[good]?.sell ?? 0) > line.buy)).toBe(true);
  });

  it('includes the school\'s market, as the server sends it', () => {
    const t = newTrader(galaxy, 50);
    const other = galaxy.planets.find((p) => p.id !== t.location)!.id;
    const pushes = schoolPushes([[other, WATER, -4000]]);
    expect(pricesAt(galaxy, other, 50, pushes)[WATER]).toEqual(pushedLine(marketFor(galaxy, other, 50)[WATER], priceMove(-4000)));
    expect(pricesAt(galaxy, other, 50, schoolPushes(undefined))).toEqual(marketFor(galaxy, other, 50));
  });
});
