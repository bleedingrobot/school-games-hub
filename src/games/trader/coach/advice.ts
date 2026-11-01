/**
 * Bolt's sums (docs/TRADER-HINTS-PLAN.md): small, screen-only helpers that read the game's own rules and prices and turn
 * them into advice. Nothing here changes a rule or sends anything to the server.
 */
import { GOODS, GOVERNMENTS, LOAN_WEEKLY_PCT, MAX_PODS, POD_MIN_TECH, POD_PRICE, SHIELDS, SHIPS, START_CREDITS, WEAPONS } from '../../../../shared/trader/config';
import type { Encounter } from '../../../../shared/trader/encounter';
import { isGoodDeal } from '../../../../shared/trader/encounter';
import { laserPower, shieldPower, type Fight, type FightAction } from '../../../../shared/trader/fight';
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

/** The ⭐ best buy here (5.1): the trip with the biggest profit on a load the pupil can buy now, or null. */
export function bestBuy(trips: readonly Trip[]): Trip | null {
  return trips.find((trip) => trip.qty > 0) ?? null;
}

/** "Costs 15 here → Ceres pays 21 → +6 each × 10 = +60" */
export function bestBuyWorking(galaxy: Galaxy, trip: Trip): string {
  return `Costs ${trip.buy} here → ${galaxy.planets[trip.planet].name} pays ${trip.sell} → +${trip.each} each × ${trip.qty} = +${trip.profit}`;
}

/** A trip idea for the star chart (5.3): a planet in reach, what it pays and the profit on each one. */
export interface ChartIdea {
  planet: number;
  good: number;
  fuel: number;
  /** What the planet pays for one. */
  sell: number;
  /** How much more than here (for cargo on board), or the profit on each (for a buy here). */
  each: number;
  /** Cargo already on board, or a good to buy here first. */
  onBoard: boolean;
}

/**
 * Up to 3 good trips from here, each to a different planet: for the cargo on board, planets in reach that pay clearly
 * more than here (the same 10% as `cargoPlan`); with an empty hold, the best buys here. Never fills in the jump box.
 */
export function chartIdeas(galaxy: Galaxy, t: Trader, prices: MarketLine[][], trips: readonly Trip[]): ChartIdea[] {
  const here = galaxy.planets[t.location];
  const tank = SHIPS[t.ship].fuelTank;
  const ideas: ChartIdea[] = [];
  if (usedHolds(t) > 0) {
    t.cargo.forEach((qty, good) => {
      if (qty < 1) return;
      const hereSell = t.market[good]?.sell ?? 0;
      for (const p of galaxy.planets) {
        const fuel = distance(here, p);
        if (p.id === t.location || fuel > tank) continue;
        const sell = prices[p.id][good]?.sell ?? 0;
        if (sell <= 0 || sell * 100 < Math.max(hereSell, 1) * (100 + WORTH_A_JUMP_PCT)) continue;
        ideas.push({ planet: p.id, good, fuel, sell, each: sell - hereSell, onBoard: true });
      }
    });
    ideas.sort((a, b) => b.each * t.cargo[b.good] - a.each * t.cargo[a.good] || a.fuel - b.fuel);
  } else {
    for (const trip of trips) ideas.push({ planet: trip.planet, good: trip.good, fuel: trip.fuel, sell: trip.sell, each: trip.each, onBoard: false });
  }
  const seen = new Set<number>();
  return ideas.filter((idea) => !seen.has(idea.planet) && seen.add(idea.planet)).slice(0, 3);
}

/** "Mars bans Lollies. If customs stop you, they will take your 3 Lollies and fine you." or null (5.3). */
export function customsWarning(planet: Planet, t: Trader): string | null {
  const banned = bannedCargo(planet, t);
  if (!banned.length) return null;
  const names = banned.map((g) => GOODS[g]).join(' and ');
  const loads = banned.map((g) => `${t.cargo[g]} ${GOODS[g]}`).join(' and ');
  return `${planet.name} bans ${names}. If customs stop you, they will take your ${loads} and fine you.`;
}

/** "Lots of pirates around Io. Your Flea can only run." for a pirate world when the ship has no laser, or null (5.3). */
export function pirateWarning(planet: Planet, t: Trader): string | null {
  if (!piratesAbout(planet) || laserPower(t) > 0) return null;
  return `Lots of pirates around ${planet.name}. Your ${SHIPS[t.ship].name} has no lasers, so it can only run.`;
}

/**
 * The losing-trade line (5.1): selling a good here when a planet in reach pays clearly more (the same 10% as
 * `cargoPlan`), and there's a jump left to get there. Null when selling here is fine.
 */
export function sellElsewhere(galaxy: Galaxy, t: Trader, good: number, best: readonly (BestSale | null)[]): string | null {
  const elsewhere = best[good];
  const here = t.market[good]?.sell ?? 0;
  if (!elsewhere || t.jumpsLeft < 1 || here <= 0 || elsewhere.sell * 100 < here * (100 + WORTH_A_JUMP_PCT)) return null;
  return `${galaxy.planets[elsewhere.planet].name} pays ${elsewhere.sell - here} more each for ${GOODS[good]}. Sell there instead?`;
}

/** Bolt's view of a friendly trader's offer (5.4): the working, whether it works, and the verdict. */
export interface DealAdvice {
  /** The price compared with this planet's, as a sum. */
  working: string;
  /** Lines on whether the deal can be done: "It fits in your hold ✅", "You need 40 more credits ❌". */
  checks: { ok: boolean; text: string }[];
  /** A better price than this planet's. */
  good: boolean;
  /** It can be done (fits and can be paid for). */
  works: boolean;
  /** "✅ Good deal. Take it." */
  verdict: string;
}

export function dealAdvice(offer: Extract<Encounter, { kind: 'trader' }>, t: Trader): DealAdvice {
  const name = GOODS[offer.good];
  const diff = Math.abs(offer.price - offer.fair);
  const good = isGoodDeal(offer);
  let working: string;
  if (offer.sells) {
    working = `They sell ${name} at ${offer.price}. Here it costs ${offer.fair}. `
      + (good ? `You'd save ${diff} each × ${offer.qty} = ${diff * offer.qty}.` : diff === 0 ? "That's the same as here." : `That's ${diff} more each than here.`);
  } else {
    working = `They pay ${offer.price} for your ${name}. Here pays ${offer.fair}. `
      + (good ? `That's ${diff} more each × ${offer.qty} = ${diff * offer.qty} extra.` : diff === 0 ? "That's the same as here." : `That's ${diff} less each than here.`);
  }
  const checks: DealAdvice['checks'] = [];
  if (offer.sells) {
    const room = freeHolds(t);
    const cost = offer.price * offer.qty;
    checks.push(offer.qty <= room ? { ok: true, text: 'It fits in your hold ✅' } : { ok: false, text: `You only have room for ${room} ❌` });
    checks.push(cost <= t.credits ? { ok: true, text: 'You can pay ✅' } : { ok: false, text: `You need ${cost - t.credits} more credits ❌` });
  }
  const works = checks.every((c) => c.ok);
  const verdict = !works ? "❌ You can't take this one. Say No thanks." : good ? '✅ Good deal. Take it.' : '❌ Not a good deal. Say No thanks.';
  return { working, checks, good, works, verdict };
}

/** Bolt's suggestion in a pirate fight (5.5): a button and why. */
export interface FightAdvice {
  move: FightAction;
  why: string;
}

/** "7 times in 10", or "about 5 times in 10" for 55%. */
export const timesInTen = (pct: number): string => `${pct % 10 === 0 ? '' : 'about '}${Math.floor(pct / 10)} times in 10`;

/**
 * Simple rules from the fight's own numbers, in this order (table 5.5): no laser, flee; hull a quarter or less, flee;
 * a laser and hull over half, charge; shields fitted but empty, raise them. Otherwise (a laser, hull between a quarter and
 * a half): charge if one full shot could finish them, or else flee.
 */
export function fightAdvice(t: Trader, fight: Fight, pirateHull = fight.pirateHull): FightAdvice {
  const ship = SHIPS[t.ship];
  const power = laserPower(t);
  if (power <= 0) return { move: 'flee', why: `No lasers. Fleeing works ${timesInTen(ship.fleePct)}.` };
  if (fight.hull * 4 <= ship.hull) return { move: 'flee', why: 'Your hull is very low. Get away and mend it.' };
  if (fight.hull * 2 > ship.hull) return { move: 'charge', why: 'Your lasers can win this. A right answer fires at full power.' };
  if (shieldPower(t) > 0 && fight.shield <= 0) return { move: 'shield', why: 'Shields up will soak their next shot.' };
  if (power * 3 >= pirateHull + fight.pirateShield) return { move: 'charge', why: 'One full-power shot could finish them.' };
  return { move: 'flee', why: `Your hull is under half. Getting away is safer: it works ${timesInTen(ship.fleePct)}.` };
}

/**
 * "+5 holds = about +30 credits a trip" for an upgrade that adds holds (5.2): the best load from here with the new holds,
 * compared with the best load now (using today's stock and the credits the pupil has). Null if it adds nothing here.
 */
export function upgradeGain(galaxy: Galaxy, t: Trader, upgrade: Upgrade, prices: MarketLine[][]): string | null {
  const bigger: Trader | null = upgrade.kind === 'pod' ? { ...t, pods: t.pods + 1 } : upgrade.kind === 'ship' ? { ...t, ship: upgrade.index, pods: 0 } : null;
  if (!bigger) return null;
  const extra = holdsOf(bigger) - holdsOf(t);
  const best = (who: Trader) => bestBuy(tradeIdeas(galaxy, who, prices))?.profit ?? 0;
  const gain = best(bigger) - best(t);
  return extra > 0 && gain > 0 ? `+${extra} holds = about +${gain} credits a trip from here` : null;
}

/** "Borrow 300 now. After a week you'll owe 330. Part of each sale pays it back." (the first-borrow "Sure?", section 4) */
export function borrowSure(t: Trader, amount: number): string {
  const owed = t.loan.owed + amount + Math.floor(((t.loan.principal + amount) * LOAN_WEEKLY_PCT) / 100);
  return `Borrow ${amount} now. After a week you'll owe ${owed.toLocaleString('en-NZ')}. Part of each sale pays it back.`;
}

/** The bank line (5.7): the pupil can already fill the hold with the best buy, so a loan isn't needed now. */
export function loanNotNeeded(t: Trader, trips: readonly Trip[]): boolean {
  const best = bestBuy(trips);
  if (!best) return false;
  const line = t.market[best.good];
  const fill = Math.min(line?.stock ?? 0, freeHolds(t));
  return fill > 0 && best.qty >= fill;
}

/**
 * The trip summary (5.6) for a sale: what the sold goods cost (when known on this device) and what they sold for.
 * `sold` is how many of each good were sold, `earned` the credits from the sale. Null if any sold good's price is unknown.
 */
export function tripSummary(galaxy: Galaxy, t: Trader, sold: readonly number[], earned: number, boughtAt: Record<number, { each: number; from: number }>): string | null {
  const goods = sold.map((q, good) => (q > 0 ? good : -1)).filter((g) => g >= 0);
  if (!goods.length || goods.some((g) => !boughtAt[g])) return null;
  const paid = Math.round(goods.reduce((sum, g) => sum + boughtAt[g].each * sold[g], 0));
  const profit = earned - paid;
  const names = goods.map((g) => GOODS[g]).join(' and ');
  const away = goods.some((g) => boughtAt[g].from !== t.location);
  const end = profit > 0 ? `+${profit} 🎉` : profit === 0 ? 'no profit, no loss.' : `−${-profit}. The next trip can do better.`;
  return away
    ? `Trip to ${galaxy.planets[t.location].name}: bought ${names} for ${paid}, sold for ${earned}: ${end}`
    : `${names}: bought for ${paid}, sold for ${earned}: ${end}`;
}
