/**
 * What other planets pay (James, 22 Oct 2026: "I can't make a profit"). A pupil can't see a trip's profit without
 * knowing what the next planet pays, so the screens show, from the same rules the server uses:
 *  - a planet's prices today on its star chart card, with the profit on each good bought here;
 *  - in the market, the best price for each good on a planet the ship can reach on a full tank.
 * These are today's prices with the school's market as it is now. They can still change before you land (other
 * pupils trade), and your own prices are fixed when you land.
 */
import { SHIPS } from './config';
import type { Galaxy } from './galaxy';
import { distance } from './galaxy';
import { marketFor, type MarketLine } from './market';
import { pushesFrom, type Pushes } from './schoolMarket';
import type { Trader } from './state';

/** The school's pushes as the server sends them ([planet, good, push]), as landing-price moves (with the quiet zone). */
export const schoolPushes = (prices: readonly [number, number, number][] | undefined): Pushes =>
  pushesFrom({ pushes: (prices ?? []).map(([p, g, push]) => [p, g, push, 0]), news: [] });

/** A planet's market today, with the school's push. */
export const pricesAt = (galaxy: Galaxy, planet: number, day: number, pushes?: Pushes): MarketLine[] => marketFor(galaxy, planet, day, pushes?.(planet));

export interface BestSale {
  planet: number;
  /** What it pays for one. */
  sell: number;
  /** Fuel to get there from here. */
  fuel: number;
}

/**
 * For each good: the planet (not this one) within a full tank's reach that pays most for it today, nearest first on a
 * tie. Null if nowhere in reach buys it.
 */
export function bestSales(galaxy: Galaxy, t: Trader, pushes?: Pushes): (BestSale | null)[] {
  const here = galaxy.planets[t.location];
  const range = SHIPS[t.ship].fuelTank;
  const best: (BestSale | null)[] = t.market.map(() => null);
  for (const p of galaxy.planets) {
    if (p.id === t.location) continue;
    const fuel = distance(here, p);
    if (fuel > range) continue;
    const lines = pricesAt(galaxy, p.id, t.day, pushes);
    lines.forEach((line, good) => {
      if (line.sell <= 0) return;
      const cur = best[good];
      if (!cur || line.sell > cur.sell || (line.sell === cur.sell && fuel < cur.fuel)) best[good] = { planet: p.id, sell: line.sell, fuel };
    });
  }
  return best;
}
