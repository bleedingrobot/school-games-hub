/**
 * Bolt's sums (docs/TRADER-HINTS-PLAN.md): small, screen-only helpers that read the game's own rules and prices and turn
 * them into advice. Nothing here changes a rule or sends anything to the server.
 */
import { GOVERNMENTS, MAX_PODS, POD_MIN_TECH, POD_PRICE, SHIELDS, SHIPS, START_CREDITS, WEAPONS } from '../../../../shared/trader/config';
import { distance, type Galaxy, type Planet } from '../../../../shared/trader/galaxy';
import { isBanned, type MarketLine } from '../../../../shared/trader/market';
import { bestSales, pricesAt, type BestSale } from '../../../../shared/trader/priceGuide';
import type { Pushes } from '../../../../shared/trader/schoolMarket';
import { freeHolds, hasShipyard, holdsOf, tradeInValue, usedHolds, type Trader } from '../../../../shared/trader/state';

/** A trip: buy a good here, sell it on another planet. */
export interface Trip {
  good: number;
  planet: number;
  /** What one costs here. */
  buy: number;
  /** What the other planet pays for one. */
  sell: number;
  /** Profit on each one. */
  each: number;
  /** How many the pupil can buy now (credits, free holds and stock). */
  qty: number;
  /** Profit on the whole load. */
  profit: number;
  /** Fuel to get there. */
  fuel: number;
}

/** Every planet's prices today (with the school's push), worked out once. */
export function allPrices(galaxy: Galaxy, day: number, pushes?: Pushes): MarketLine[][] {
  return galaxy.planets.map((p) => pricesAt(galaxy, p.id, day, pushes));
}

/**
 * Trips worth making from here: each good on sale here, sold on a planet within a full tank's reach that pays more for it.
 * Biggest profit on the whole load first; a nearer planet first on a tie. Banned goods never show (a planet that bans a
 * good pays nothing for it).
 */
export function tradeIdeas(galaxy: Galaxy, t: Trader, prices: MarketLine[][]): Trip[] {
  const here = galaxy.planets[t.location];
  const range = SHIPS[t.ship].fuelTank;
  const room = freeHolds(t);
  const trips: Trip[] = [];
  for (const line of t.market) {
    if (line.buy <= 0 || line.stock <= 0) continue;
    const qty = Math.min(line.stock, room, Math.floor(t.credits / line.buy));
    for (const p of galaxy.planets) {
      if (p.id === t.location) continue;
      const fuel = distance(here, p);
      if (fuel > range) continue;
      const sell = prices[p.id][line.good]?.sell ?? 0;
      const each = sell - line.buy;
      if (each <= 0) continue;
      trips.push({ good: line.good, planet: p.id, buy: line.buy, sell, each, qty, profit: each * qty, fuel });
    }
  }
  return trips.sort((a, b) => b.profit - a.profit || b.each - a.each || a.fuel - b.fuel);
}

/** The best trip for each good (the first, best one only). */
export function bestTripPerGood(trips: readonly Trip[]): Map<number, Trip> {
  const best = new Map<number, Trip>();
  for (const trip of trips) if (!best.has(trip.good)) best.set(trip.good, trip);
  return best;
}

/** What to do with cargo already in the hold: sell it here, or fly it somewhere that pays clearly more. */
export interface CargoPlan {
  good: number;
  qty: number;
  /** What this planet pays for one (0 if it doesn't buy it). */
  here: number;
  /** The best planet within a full tank, or null. */
  best: BestSale | null;
  sellHere: boolean;
}

/** Flying somewhere else is only worth a jump if it pays at least this much more (percent). */
export const WORTH_A_JUMP_PCT = 10;

/** A plan for the biggest load in the hold (by what it's worth), or null with an empty hold. */
export function cargoPlan(galaxy: Galaxy, t: Trader, pushes?: Pushes): CargoPlan | null {
  const best = bestSales(galaxy, t, pushes);
  let pick: CargoPlan | null = null;
  let worth = -1;
  t.cargo.forEach((qty, good) => {
    if (qty < 1) return;
    const here = t.market[good]?.sell ?? 0;
    const elsewhere = best[good];
    const value = qty * Math.max(here, elsewhere?.sell ?? 0);
    if (value <= worth) return;
    worth = value;
    const better = elsewhere !== null && elsewhere.sell * 100 >= Math.max(here, 1) * (100 + WORTH_A_JUMP_PCT);
    pick = { good, qty, here, best: elsewhere, sellHere: here > 0 && (!better || t.jumpsLeft < 1) };
  });
  return pick;
}

/** Goods in the hold that a planet bans (customs there would take them). */
export function bannedCargo(planet: Planet, t: Trader): number[] {
  return t.cargo.map((qty, good) => (qty > 0 && isBanned(planet, good) ? good : -1)).filter((good) => good >= 0);
}

/** A planet to stop at on the way when the target is further than a full tank, or null. */
export function stopOnTheWay(galaxy: Galaxy, t: Trader, to: number): Planet | null {
  const here = galaxy.planets[t.location];
  const there = galaxy.planets[to];
  const tank = SHIPS[t.ship].fuelTank;
  let pick: Planet | null = null;
  for (const p of galaxy.planets) {
    if (p.id === here.id || p.id === there.id) continue;
    const a = distance(here, p);
    const b = distance(p, there);
    if (a > tank || b > tank) continue;
    if (!pick || b < distance(pick, there) || (b === distance(pick, there) && a < distance(here, pick))) pick = p;
  }
  return pick;
}

/** The nearest other planet with a shipyard, or null. */
export function nearestShipyard(galaxy: Galaxy, t: Trader): Planet | null {
  const here = galaxy.planets[t.location];
  let pick: Planet | null = null;
  for (const p of galaxy.planets) {
    if (p.id === here.id || !hasShipyard(galaxy, { ...t, location: p.id })) continue;
    if (!pick || distance(here, p) < distance(here, pick)) pick = p;
  }
  return pick;
}

/** The nearest planet the ship can reach on the fuel it has, or null. */
export function nearestPlanet(galaxy: Galaxy, t: Trader): Planet | null {
  const here = galaxy.planets[t.location];
  let pick: Planet | null = null;
  for (const p of galaxy.planets) {
    const d = distance(here, p);
    if (p.id === here.id || d > t.fuel) continue;
    if (!pick || d < distance(here, pick)) pick = p;
  }
  return pick;
}

/** Is this a planet with lots of pirates about? (Governments with pirates 6 or more.) */
export const piratesAbout = (planet: Planet): boolean => GOVERNMENTS[planet.government].pirates >= 6;

export type Upgrade =
  | { kind: 'pod'; cost: number; name: string; why: string; target: string }
  | { kind: 'weapon' | 'shield' | 'ship'; index: number; cost: number; name: string; why: string; target: string };

/**
 * The trader ships Bolt suggests, in order. The Gnat is skipped (a Flea with two pods already holds more, and a new ship
 * loses its pods), and so is the Beetle (no laser and a thin hull).
 */
export const SHIP_LADDER = [2, 3, 5];

/** "It holds 10 more, has room for a laser and is much tougher." */
function shipWhy(t: Trader, ship: number): string {
  const now = SHIPS[t.ship];
  const s = SHIPS[ship];
  const extra = s.holds - holdsOf(t);
  const parts = [
    ...(extra > 0 ? [`holds ${extra} more`] : []),
    ...(now.weaponSlots === 0 && s.weaponSlots > 0 ? ['has room for a laser'] : []),
    ...(s.hull > now.hull ? ['is much tougher'] : []),
  ];
  if (!parts.length) return 'It is a better ship.';
  const last = parts.pop() as string;
  return `It ${parts.length ? `${parts.join(', ')} and ${last}` : last}.`;
}

/**
 * Credits to keep for trading after an upgrade: enough to fill the hold with the cheapest good that makes a profit from
 * here, and never less than the starting money. So a suggested upgrade never leaves the pupil unable to trade.
 */
export function tradingMoney(t: Trader, trips: readonly Trip[]): number {
  const cheapest = trips.reduce((low, trip) => Math.min(low, trip.buy), Infinity);
  return Math.max(START_CREDITS, Number.isFinite(cheapest) ? cheapest * holdsOf(t) : 0);
}

/**
 * The next upgrade worth buying on this planet, or null. In order: cargo pods (more holds is the quickest way to earn
 * more), a first laser, a first shield, then the next ship on the ladder. Only things sold here and affordable while still
 * keeping `tradingMoney` back.
 */
export function nextUpgrade(galaxy: Galaxy, t: Trader, trips: readonly Trip[]): Upgrade | null {
  if (!hasShipyard(galaxy, t)) return null;
  const tech = galaxy.planets[t.location].tech;
  const keep = tradingMoney(t, trips);
  const rule = SHIPS[t.ship];
  const options: Upgrade[] = [];
  if (t.pods < MAX_PODS && tech >= POD_MIN_TECH) {
    options.push({ kind: 'pod', cost: POD_PRICE, name: 'a cargo pod', why: 'It adds 5 holds, so every trip earns more.', target: 'ship-pod' });
  }
  if (t.weapons.length === 0 && rule.weaponSlots > 0 && tech >= WEAPONS[0].minTech) {
    options.push({ kind: 'weapon', index: 0, cost: WEAPONS[0].price, name: `a ${WEAPONS[0].name}`, why: 'Then you can fight pirates instead of running.', target: 'gear-weapon-0' });
  }
  if (t.shields.length === 0 && rule.shieldSlots > 0 && tech >= SHIELDS[0].minTech) {
    options.push({ kind: 'shield', index: 0, cost: SHIELDS[0].price, name: `an ${SHIELDS[0].name}`, why: 'It soaks up pirate shots.', target: 'gear-shield-0' });
  }
  const nextShip = SHIP_LADDER.find((s) => s > t.ship);
  if (nextShip !== undefined && tech >= SHIPS[nextShip].minTech && usedHolds(t) <= SHIPS[nextShip].holds) {
    const s = SHIPS[nextShip];
    options.push({ kind: 'ship', index: nextShip, cost: s.price - tradeInValue(t), name: `a ${s.name}`, why: shipWhy(t, nextShip), target: `ship-buy-${nextShip}` });
  }
  return options.find((o) => o.cost <= t.credits - keep) ?? null;
}

/** A planet with only a few pirates about (governments with pirates 3 or fewer). */
export const calmPlanet = (planet: Planet): boolean => GOVERNMENTS[planet.government].pirates <= 3;

/**
 * First Flight's trade (docs/TRADER-HINTS-PLAN.md, 2.1): a trip that is sure to make money, the pupil can afford now, and
 * is easy for a first go. Of the trips that make a profit, the first that fits best wins: a calm planet reached on the
 * fuel already in the tank, then either of those, then any; biggest profit first within each. Null if nothing pays.
 */
export function starterTrade(galaxy: Galaxy, t: Trader, pushes?: Pushes): Trip | null {
  const trips = tradeIdeas(galaxy, t, allPrices(galaxy, t.day, pushes)).filter((trip) => trip.qty > 0);
  const onFuel = (trip: Trip) => trip.fuel <= t.fuel;
  const calm = (trip: Trip) => calmPlanet(galaxy.planets[trip.planet]);
  return trips.find((x) => onFuel(x) && calm(x)) ?? trips.find(onFuel) ?? trips.find(calm) ?? trips[0] ?? null;
}
