/**
 * A trader's ship and wallet, and the things they can do at a planet: trade, refuel, mend, shop, borrow, jump.
 * Every function takes the state and gives back a new one (or a reason it can't be done). Nothing is changed in place.
 */
import {
  DISCOUNT_BP,
  GOODS,
  JUMPS_PER_DAY,
  LOAN_MAX,
  LOAN_REPAY_SHARE_PCT,
  LOAN_WEEKLY_PCT,
  LOAN_WEEK_DAYS,
  MAX_PODS,
  MOON_PRICE,
  POD_HOLDS,
  POD_MIN_TECH,
  POD_PRICE,
  SHIELDS,
  SHIPS,
  SHIPYARD_TECH,
  START_CREDITS,
  TRADE_IN_PCT,
  WEAPONS,
} from './config';
import { distance, startPlanet, type Galaxy } from './galaxy';
import { marketFor, type MarketLine } from './market';

export interface Loan {
  /** What was borrowed and not yet paid back. */
  principal: number;
  /** Everything owed, with the weekly 10% added. */
  owed: number;
  /** The day it was borrowed; each full week after adds interest. */
  since: number;
}

export interface Trader {
  day: number;
  location: number;
  credits: number;
  ship: number;
  /** How many of each good is in the hold. */
  cargo: number[];
  fuel: number;
  hull: number;
  /** Indexes into WEAPONS and SHIELDS. */
  weapons: number[];
  shields: number[];
  pods: number;
  loan: Loan;
  jumpsLeft: number;
  /** Counts jumps ever, so every jump has its own seed. */
  jumpNo: number;
  moon: boolean;
  /** The market on this planet today, with stock going down as you buy. */
  market: MarketLine[];
}

export type Result<T> = { ok: true; state: T; info?: number } | { ok: false; reason: string };

const no = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });
const clone = (t: Trader): Trader => ({ ...t, cargo: [...t.cargo], weapons: [...t.weapons], shields: [...t.shields], loan: { ...t.loan }, market: t.market.map((m) => ({ ...m })) });

export const holdsOf = (t: Trader): number => SHIPS[t.ship].holds + t.pods * POD_HOLDS;
export const usedHolds = (t: Trader): number => t.cargo.reduce((a, b) => a + b, 0);
export const freeHolds = (t: Trader): number => holdsOf(t) - usedHolds(t);
export const fuelCost = (ship: number, units: number): number => Math.ceil((units * SHIPS[ship].fuelTenths) / 10);

/** A new trader at the start of a season. */
export function newTrader(galaxy: Galaxy, day: number): Trader {
  const location = startPlanet(galaxy);
  return {
    day,
    location,
    credits: START_CREDITS,
    ship: 0,
    cargo: GOODS.map(() => 0),
    fuel: SHIPS[0].fuelTank,
    hull: SHIPS[0].hull,
    weapons: [],
    shields: [],
    pods: 0,
    loan: { principal: 0, owed: 0, since: 0 },
    jumpsLeft: JUMPS_PER_DAY,
    jumpNo: 0,
    moon: false,
    market: marketFor(galaxy, location, day),
  };
}

/** The first thing on a new day: jumps back to ten, prices re-read, and a week's interest on any loan. */
export function startDay(galaxy: Galaxy, t: Trader, day: number): Trader {
  const next = clone(t);
  next.day = day;
  next.jumpsLeft = JUMPS_PER_DAY;
  next.market = marketFor(galaxy, next.location, day);
  if (next.loan.principal > 0) {
    // One 10% charge for every week boundary crossed since the last day looked at, on what was borrowed (never on interest).
    const before = Math.floor((t.day - next.loan.since) / LOAN_WEEK_DAYS);
    const after = Math.floor((day - next.loan.since) / LOAN_WEEK_DAYS);
    const weeks = Math.max(0, after - before);
    next.loan.owed += weeks * Math.floor((next.loan.principal * LOAN_WEEKLY_PCT) / 100);
  }
  return next;
}

/** Buy some of a good here. `bp` takes a sharp-trader discount off the price (hundredths of a percent). */
export function buy(t: Trader, good: number, qty: number, bp = 0): Result<Trader> {
  const line = t.market[good];
  if (!Number.isInteger(qty) || qty < 1) return no('Pick how many.');
  if (!line || line.buy <= 0) return no('This planet has none to sell.');
  if (qty > line.stock) return no('There are not that many.');
  if (qty > freeHolds(t)) return no('Your hold is full.');
  const price = priceWithDiscount(line.buy, -bp);
  const total = price * qty;
  if (total > t.credits) return no('You cannot afford that.');
  const next = clone(t);
  next.credits -= total;
  next.cargo[good] += qty;
  next.market[good].stock -= qty;
  return { ok: true, state: next, info: total };
}

/** Sell some of a good here. A share of the money goes to pay back any loan. */
export function sell(t: Trader, good: number, qty: number, bp = 0): Result<Trader> {
  const line = t.market[good];
  if (!Number.isInteger(qty) || qty < 1) return no('Pick how many.');
  if (!line || line.sell <= 0) return no('This planet will not buy that.');
  if (qty > t.cargo[good]) return no('You do not have that many.');
  const price = priceWithDiscount(line.sell, bp);
  const total = price * qty;
  const next = clone(t);
  next.cargo[good] -= qty;
  next.credits += total;
  if (next.loan.owed > 0) {
    const pay = Math.min(next.loan.owed, Math.floor((total * LOAN_REPAY_SHARE_PCT) / 100));
    next.credits -= pay;
    payOff(next, pay);
  }
  return { ok: true, state: next, info: total };
}

function payOff(t: Trader, pay: number): void {
  t.loan.owed -= pay;
  if (t.loan.owed <= 0) t.loan = { principal: 0, owed: 0, since: 0 };
  else t.loan.principal = Math.min(t.loan.principal, t.loan.owed);
}

/** A price with a discount (bp > 0 for a sale: more money; bp < 0 for a purchase: less). Never below 1 credit. */
export function priceWithDiscount(price: number, bp: number): number {
  return Math.max(1, Math.floor((price * (10_000 + bp)) / 10_000));
}

export const defaultDiscount = DISCOUNT_BP;

/** Fill the tank (or put in some fuel). */
export function refuel(t: Trader, units: number): Result<Trader> {
  const room = SHIPS[t.ship].fuelTank - t.fuel;
  const add = Math.min(units, room);
  if (add < 1) return no('The tank is full.');
  const cost = fuelCost(t.ship, add);
  if (cost > t.credits) return no('You cannot afford that much fuel.');
  const next = clone(t);
  next.credits -= cost;
  next.fuel += add;
  return { ok: true, state: next, info: cost };
}

/** Mend the hull. */
export function repair(t: Trader, points: number): Result<Trader> {
  const room = SHIPS[t.ship].hull - t.hull;
  const add = Math.min(points, room);
  if (add < 1) return no('The hull is already sound.');
  const cost = add * SHIPS[t.ship].repairCost;
  if (cost > t.credits) return no('You cannot afford that.');
  const next = clone(t);
  next.credits -= cost;
  next.hull += add;
  return { ok: true, state: next, info: cost };
}

export const hasShipyard = (galaxy: Galaxy, t: Trader): boolean => galaxy.planets[t.location].tech >= SHIPYARD_TECH;

/** What a ship is worth when you hand it in. */
export const tradeInValue = (t: Trader): number => Math.floor((SHIPS[t.ship].price * TRADE_IN_PCT) / 100) + gearValue(t);
const gearValue = (t: Trader): number =>
  Math.floor(
    ((t.weapons.reduce((a, w) => a + WEAPONS[w].price, 0) + t.shields.reduce((a, s) => a + SHIELDS[s].price, 0) + t.pods * POD_PRICE) * TRADE_IN_PCT) / 100,
  );

/** Change ships. Your old ship and its gear are taken in part payment; the cargo must fit; gear that doesn't fit is sold. */
export function buyShip(galaxy: Galaxy, t: Trader, ship: number): Result<Trader> {
  const rule = SHIPS[ship];
  if (!rule || ship === t.ship) return no('Pick a different ship.');
  if (!hasShipyard(galaxy, t) || galaxy.planets[t.location].tech < rule.minTech) return no('This planet does not sell that ship.');
  if (usedHolds(t) > rule.holds) return no('Your cargo will not fit. Sell some first.');
  const cost = rule.price - tradeInValue(t);
  if (cost > t.credits) return no('You cannot afford that.');
  const next = clone(t);
  next.credits -= cost;
  next.ship = ship;
  next.hull = rule.hull;
  next.weapons = [];
  next.shields = [];
  next.pods = 0;
  next.fuel = Math.min(next.fuel, rule.fuelTank);
  return { ok: true, state: next, info: cost };
}

export function buyWeapon(galaxy: Galaxy, t: Trader, weapon: number): Result<Trader> {
  const rule = WEAPONS[weapon];
  if (!rule || !hasShipyard(galaxy, t) || galaxy.planets[t.location].tech < rule.minTech) return no('This planet does not sell that.');
  if (t.weapons.length >= SHIPS[t.ship].weaponSlots) return no('There is no room for another laser.');
  if (rule.price > t.credits) return no('You cannot afford that.');
  const next = clone(t);
  next.credits -= rule.price;
  next.weapons.push(weapon);
  return { ok: true, state: next, info: rule.price };
}

export function buyShield(galaxy: Galaxy, t: Trader, shield: number): Result<Trader> {
  const rule = SHIELDS[shield];
  if (!rule || !hasShipyard(galaxy, t) || galaxy.planets[t.location].tech < rule.minTech) return no('This planet does not sell that.');
  if (t.shields.length >= SHIPS[t.ship].shieldSlots) return no('There is no room for another shield.');
  if (rule.price > t.credits) return no('You cannot afford that.');
  const next = clone(t);
  next.credits -= rule.price;
  next.shields.push(shield);
  return { ok: true, state: next, info: rule.price };
}

export function buyPod(galaxy: Galaxy, t: Trader): Result<Trader> {
  if (!hasShipyard(galaxy, t) || galaxy.planets[t.location].tech < POD_MIN_TECH) return no('This planet does not sell that.');
  if (t.pods >= MAX_PODS) return no('You cannot fit more cargo pods.');
  if (POD_PRICE > t.credits) return no('You cannot afford that.');
  const next = clone(t);
  next.credits -= POD_PRICE;
  next.pods += 1;
  return { ok: true, state: next, info: POD_PRICE };
}

/** The moon. Bought at any shipyard with money in hand; you keep your ship. */
export function buyMoon(galaxy: Galaxy, t: Trader): Result<Trader> {
  if (t.moon) return no('You already own a moon.');
  if (!hasShipyard(galaxy, t)) return no('Moons are sold at shipyards.');
  if (t.credits < MOON_PRICE) return no('You need more money.');
  const next = clone(t);
  next.moon = true;
  next.credits -= MOON_PRICE;
  return { ok: true, state: next, info: MOON_PRICE };
}

/** Borrow from the bank. */
export function borrow(t: Trader, amount: number): Result<Trader> {
  if (!Number.isInteger(amount) || amount < 1) return no('Pick an amount.');
  if (t.loan.principal + amount > LOAN_MAX) return no(`You can borrow up to ${LOAN_MAX} credits.`);
  const next = clone(t);
  if (next.loan.principal === 0) next.loan.since = t.day;
  next.loan.principal += amount;
  next.loan.owed += amount;
  next.credits += amount;
  return { ok: true, state: next, info: amount };
}

/** Pay some back from your credits. */
export function repay(t: Trader, amount: number): Result<Trader> {
  if (t.loan.owed <= 0) return no('You do not owe anything.');
  const pay = Math.min(amount, t.loan.owed, t.credits);
  if (pay < 1) return no('You have nothing to pay with.');
  const next = clone(t);
  next.credits -= pay;
  payOff(next, pay);
  return { ok: true, state: next, info: pay };
}

/** What a trader is worth: money, ship, gear and cargo at today's local prices, less any loan. */
export function netWorth(_galaxy: Galaxy, t: Trader): number {
  const cargo = t.cargo.reduce((sum, qty, good) => sum + qty * (t.market[good]?.sell ?? 0), 0);
  return t.credits + tradeInValue(t) + cargo - t.loan.owed;
}

/** What a jump to a planet needs. */
export function fuelNeeded(galaxy: Galaxy, t: Trader, to: number): number {
  return distance(galaxy.planets[t.location], galaxy.planets[to]);
}

/** The planets this ship can reach right now. */
export function reachable(galaxy: Galaxy, t: Trader): number[] {
  return galaxy.planets.filter((p) => p.id !== t.location && fuelNeeded(galaxy, t, p.id) <= t.fuel).map((p) => p.id);
}

/** Go to another planet. The encounter (if any) is rolled by `encounterFor` and settled before trading. */
export function travel(galaxy: Galaxy, t: Trader, to: number): Result<Trader> {
  if (!galaxy.planets[to] || to === t.location) return no('Pick another planet.');
  if (t.jumpsLeft < 1) return no('No jumps left today.');
  const need = fuelNeeded(galaxy, t, to);
  if (need > t.fuel) return no('Not enough fuel.');
  const next = clone(t);
  next.fuel -= need;
  next.jumpsLeft -= 1;
  next.jumpNo += 1;
  next.location = to;
  next.market = marketFor(galaxy, to, t.day);
  return { ok: true, state: next, info: need };
}
