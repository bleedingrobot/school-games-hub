/**
 * A bot trader for the simulator (and for tests that need a whole game played). It sees tomorrow's prices on
 * every planet, which a pupil doesn't, so it is a ceiling for how fast the moon could be reached; `sloppy` makes
 * it choose worse trips some of the time, like a pupil still learning.
 */
import { seededRandom } from '../maths/serverQuestions';
import { ASK_EVERY, BIG_TRADE_CREDITS, DISCOUNT_BIG_BP, DISCOUNT_BP, GOODS, JUMPS_PER_DAY, MOON_PRICE, SHIELDS, SHIPS, WEAPONS } from './config';
import { acceptDeal, encounterFor, isGoodDeal, settleCustoms, settleJunk } from './encounter';
import { fightRound, settleFight, startFight } from './fight';
import type { Galaxy } from './galaxy';
import { marketFor } from './market';
import type { Pushes } from './schoolMarket';
import { PLANETS, SUNS, designProblem, emptyDesign, forgeCost, inZone, newPlanet, planetPrice, systemCounts, type PlanetKind, type SunKind, type SystemDesign } from './system';
import {
  buy,
  buyMoon,
  buyShield,
  buyShip,
  buyWeapon,
  freeHolds,
  fuelCost,
  fuelNeeded,
  hasShipyard,
  netWorth,
  reachable,
  refuel,
  repair,
  sell,
  startDay,
  travel,
  tradeInValue,
  type Trader,
} from './state';

export interface BotOptions {
  /** Chance (0 to 1) the pupil's focus answer is right. */
  mathsRate: number;
  /** Chance (0 to 1) of picking a worse trip than the best one. */
  sloppy: number;
  /** A school's shared market (the busy-lunchtime simulation). Without it, prices are never pushed. */
  market?: BotMarket;
  /**
   * Each pupil's own taste (0 to 1, with `tasteSeed`): how much a trip's profit is nudged up or down by what this pupil
   * happens to like or know, so a class doesn't all pick the very same trip. 0 = none (the solo simulator).
   */
  taste?: number;
  tasteSeed?: string;
  /**
   * The Star Forge (docs/TRADER-SYSTEM-PLAN.md): the bot spends on its solar system as soon as it can, and does not save for
   * (or buy) the old moon, so a game does not end at the moon. Give each game its own `newForgeBot()`.
   */
  forge?: ForgeBot;
}

/** The steps a Forge bot's system goes through, and the first day each was reached (0: not yet). */
export type Milestone = 'star' | 'planets3' | 'life' | 'full';
export const MILESTONES: readonly Milestone[] = ['star', 'planets3', 'life', 'full'];
export interface ForgeBot {
  design: SystemDesign;
  days: Record<Milestone, number>;
}
export const newForgeBot = (): ForgeBot => ({ design: emptyDesign(), days: { star: 0, planets3: 0, life: 0, full: 0 } });

/** The bot keeps this much back for fuel and repairs. */
const FORGE_RESERVE = 200;
const cheapest = <K extends string>(keys: K[], price: (k: K) => number): K => keys.slice().sort((a, b) => price(a) - price(b))[0];
const BOT_SUN: SunKind = cheapest(Object.keys(SUNS) as SunKind[], (k) => SUNS[k].price);
const BOT_PLANET: PlanetKind = cheapest(
  (Object.keys(PLANETS) as PlanetKind[]).filter((k) => !PLANETS[k].wonder && PLANETS[k].life.includes('microbes') && PLANETS[k].solid),
  (k) => planetPrice({ kind: k, size: 1 }),
);

/** The design with the next piece built, in the bot's fixed order: the cheapest sun, 3 planets, first life, 5 planets, life on 3 (domes where it is too far from the sun), a big technology, then the star gate and the Dyson ring. Null when done. */
function nextStep(d: SystemDesign): SystemDesign | null {
  const next = structuredClone(d);
  const build = <T extends object>(x: T) => ({ ...x, built: true });
  const planets = next.planets;
  const lifeCount = planets.filter((p) => p.life?.built).length;
  const addPlanet = () => planets.push(build(newPlanet(planets.length + 1, BOT_PLANET)));
  /** Life on the first built planet without it, nearest the sun first; domes first if it is outside the zone. */
  const addLife = (): boolean => {
    const slot = planets.findIndex((p) => !p.life?.built);
    if (slot < 0) return false;
    const p = planets[slot];
    if (!inZone(next.sun?.kind, slot) && !p.tech.some((t) => t.kind === 'domes' && t.built)) p.tech.push(build({ kind: 'domes' as const }));
    else p.life = build({ kind: 'microbes' as const, creature: 0 });
    return true;
  };
  if (!next.sun?.built) next.sun = build({ kind: BOT_SUN, name: [0, 0] as [number, number] });
  else if (planets.length < 3) addPlanet();
  else if (lifeCount < 1) addLife();
  else if (planets.length < 5) addPlanet();
  else if (lifeCount < 3) addLife();
  else if (!next.tech.some((t) => t.built) && !planets.some((p) => p.tech.some((t) => t.kind === 'orbitalring'))) planets[0].tech.push(build({ kind: 'orbitalring' as const }));
  else if (!next.tech.some((t) => t.kind === 'gate')) next.tech.push(build({ kind: 'gate' as const }));
  else if (!next.tech.some((t) => t.kind === 'dyson')) next.tech.push(build({ kind: 'dyson' as const }));
  else return null;
  return designProblem(next) ? null : next;
}

/** A Forge bot builds whatever it can now afford, in order, and notes the day it reaches each milestone. */
export function forgeSpend(t: Trader, f: ForgeBot): Trader {
  let credits = t.credits;
  for (;;) {
    const next = nextStep(f.design);
    if (!next) break;
    const cost = forgeCost(f.design, next).total;
    if (credits - FORGE_RESERVE < cost) break;
    credits -= cost;
    f.design = next;
    const c = systemCounts(next);
    if (c.sun && !f.days.star) f.days.star = t.day;
    if (c.planets >= 3 && !f.days.planets3) f.days.planets3 = t.day;
    if (c.life >= 1 && !f.days.life) f.days.life = t.day;
    if (c.sun && c.planets >= 5 && c.life >= 3 && c.bigTech >= 1 && !f.days.full) f.days.full = t.day;
  }
  return credits === t.credits ? t : { ...t, credits };
}

/** How a bot meets the school's shared market. */
export interface BotMarket {
  /** The school's pushes right now (landing prices). */
  pushes: Pushes;
  /** What the bot believes prices elsewhere are when it plans a trip: the real pushes, or none (it only knows normal prices, like a pupil who heard a tip in the playground). */
  planning: Pushes | undefined;
  /** The bot bought (positive) or sold (negative) some of a good where it is. */
  traded(t: Trader, good: number, qty: number): void;
}

export interface BotStats {
  jumps: number;
  profitableJumps: number;
  fights: number;
  piratesBeaten: number;
  wrecks: number;
  robbed: number;
  customsFines: number;
}

export const newStats = (): BotStats => ({ jumps: 0, profitableJumps: 0, fights: 0, piratesBeaten: 0, wrecks: 0, robbed: 0, customsFines: 0 });

interface Plan {
  dest: number;
  buys: { good: number; qty: number }[];
  profit: number;
}

function discountFor(random: () => number, options: BotOptions, total: number): number {
  const asked = total >= BIG_TRADE_CREDITS || random() < 1 / ASK_EVERY;
  if (!asked || random() >= options.mathsRate) return 0;
  return total >= BIG_TRADE_CREDITS ? DISCOUNT_BIG_BP : DISCOUNT_BP;
}

function sellAll(t: Trader, random: () => number, options: BotOptions): Trader {
  let state = t;
  for (let good = 0; good < GOODS.length; good++) {
    const qty = state.cargo[good];
    if (qty > 0 && state.market[good].sell > 0) {
      const bp = discountFor(random, options, qty * state.market[good].sell);
      const r = sell(state, good, qty, bp);
      if (r.ok) {
        options.market?.traded(state, good, -qty);
        state = r.state;
      }
    }
  }
  return state;
}

function plan(galaxy: Galaxy, t: Trader, options: BotOptions, random: () => number): Plan | null {
  const plans: Plan[] = [];
  const ship = SHIPS[t.ship];
  for (const dest of galaxy.planets) {
    if (dest.id === t.location) continue;
    const need = fuelNeeded(galaxy, t, dest.id);
    if (need > ship.fuelTank) continue;
    const topUp = Math.max(0, need - t.fuel);
    let budget = t.credits - fuelCost(t.ship, topUp);
    if (budget < 0) continue;
    const there = marketFor(galaxy, dest.id, t.day, options.market?.planning?.(dest.id));
    const options2 = t.market
      .map((line) => ({ good: line.good, gain: there[line.good].sell - line.buy, line }))
      .filter((o) => o.line.buy > 0 && o.gain > 0 && o.line.stock > 0)
      .sort((a, b) => b.gain - a.gain);
    let room = freeHolds(t);
    const buys: { good: number; qty: number }[] = [];
    let profit = -fuelCost(t.ship, need);
    for (const o of options2) {
      const qty = Math.min(o.line.stock, room, Math.floor(budget / o.line.buy));
      if (qty < 1) continue;
      buys.push({ good: o.good, qty });
      room -= qty;
      budget -= qty * o.line.buy;
      profit += qty * o.gain;
    }
    plans.push({ dest: dest.id, buys, profit });
  }
  if (!plans.length) return null;
  if (options.taste) {
    const nudge = seededRandom(`${options.tasteSeed}:${t.day}:${t.location}`);
    const by = galaxy.planets.map(() => 1 + options.taste! * (2 * nudge() - 1));
    for (const p of plans) p.profit = p.profit > 0 ? p.profit * by[p.dest] : p.profit;
  }
  plans.sort((a, b) => b.profit - a.profit);
  if (random() < options.sloppy) return plans[Math.floor(random() * Math.min(plans.length, 6))];
  return plans[0];
}

/** Spend on the next ship, a laser or a shield when there is plenty to spare. */
function shop(galaxy: Galaxy, t: Trader, options: BotOptions): Trader {
  if (!hasShipyard(galaxy, t)) return t;
  let state = t;
  if (!options.forge && state.credits >= MOON_PRICE) {
    const r = buyMoon(galaxy, state);
    if (r.ok) return r.state;
  }
  const next = state.ship + 1;
  if (next < SHIPS.length && state.credits >= (SHIPS[next].price - tradeInValue(state)) * 1.3 + 60 && SHIPS[next].holds > SHIPS[state.ship].holds) {
    const r = buyShip(galaxy, state, next);
    if (r.ok) state = r.state;
  }
  for (let w = WEAPONS.length - 1; w >= 0; w--) {
    if (state.weapons.length < SHIPS[state.ship].weaponSlots && state.credits >= WEAPONS[w].price * 3) {
      const r = buyWeapon(galaxy, state, w);
      if (r.ok) {
        state = r.state;
        break;
      }
    }
  }
  for (let s = SHIELDS.length - 1; s >= 0; s--) {
    if (state.shields.length < SHIPS[state.ship].shieldSlots && state.credits >= SHIELDS[s].price * 3) {
      const r = buyShield(galaxy, state, s);
      if (r.ok) {
        state = r.state;
        break;
      }
    }
  }
  return state;
}

/** Play one jump. Returns the trader afterwards (still at the new planet, nothing sold yet). */
export function botJump(galaxy: Galaxy, t: Trader, seed: string, options: BotOptions, stats: BotStats, random: () => number): Trader {
  let state = sellAll(t, random, options);
  state = shop(galaxy, state, options);
  if (options.forge) state = forgeSpend(state, options.forge);
  const worthBefore = netWorth(galaxy, state);
  let target: Plan | null = null;
  if (!options.forge && state.credits >= MOON_PRICE && !state.moon && !hasShipyard(galaxy, state)) {
    // Head for the nearest shipyard to buy the moon.
    const yards = reachable(galaxy, state).filter((id) => galaxy.planets[id].tech >= 4);
    yards.sort((a, b) => fuelNeeded(galaxy, state, a) - fuelNeeded(galaxy, state, b));
    if (yards.length) target = { dest: yards[0], buys: [], profit: 0 };
  }
  if (!target) target = plan(galaxy, state, options, random);
  if (!target) {
    // Nothing to gain: go somewhere close and cheap to keep the day moving.
    const near = reachable(galaxy, state).sort((a, b) => fuelNeeded(galaxy, state, a) - fuelNeeded(galaxy, state, b));
    if (!near.length) {
      const r = refuel(state, SHIPS[state.ship].fuelTank);
      if (r.ok) state = r.state;
      return { ...state, jumpsLeft: 0 };
    }
    target = { dest: near[0], buys: [], profit: 0 };
  }
  for (const b of target.buys) {
    const bp = discountFor(random, options, b.qty * state.market[b.good].buy);
    const r = buy(state, b.good, b.qty, -bp);
    if (r.ok) {
      options.market?.traded(state, b.good, b.qty);
      state = r.state;
    }
  }
  const need = fuelNeeded(galaxy, state, target.dest);
  if (need > state.fuel) {
    const r = refuel(state, need - state.fuel);
    if (r.ok) state = r.state;
  }
  const moved = travel(galaxy, state, target.dest, options.market?.pushes);
  if (!moved.ok) return { ...state, jumpsLeft: Math.max(0, state.jumpsLeft - 1) };
  state = moved.state;
  stats.jumps += 1;
  const e = encounterFor(galaxy, state, seed);
  if (e.kind === 'junk') state = settleJunk(state, random() < options.mathsRate);
  else if (e.kind === 'customs') {
    const r = settleCustoms(state, e.banned);
    state = r.state;
    if (r.fine > 0) stats.customsFines += 1;
  } else if (e.kind === 'pirates') {
    stats.fights += 1;
    let fight = startFight(state, e.tier, `${seed}:${state.jumpNo}`);
    const armed = state.weapons.length > 0;
    while (fight.outcome === 'going') {
      const action = armed ? (fight.hull < 15 && state.shields.length ? 'shield' : 'charge') : 'flee';
      fight = fightRound(state, fight, action, random() < options.mathsRate);
    }
    state = settleFight(state, fight);
    if (fight.outcome === 'won') stats.piratesBeaten += 1;
    if (fight.outcome === 'destroyed') stats.wrecks += 1;
    if (fight.outcome === 'robbed') stats.robbed += 1;
  } else if (e.kind === 'trader' && isGoodDeal(e)) {
    const r = acceptDeal(state, e);
    if (r && (e.sells ? state.cargo.reduce((a, b) => a + b, 0) + e.qty <= SHIPS[state.ship].holds : true)) state = r;
  }
  // Mend the hull when it's low and it's cheap to do so.
  if (state.hull < SHIPS[state.ship].hull / 2) {
    const r = repair(state, SHIPS[state.ship].hull - state.hull);
    if (r.ok && r.state.credits > 20) state = r.state;
  }
  if (netWorth(galaxy, state) > worthBefore) stats.profitableJumps += 1;
  return state;
}

/** The end of a bot's day: sell up and go shopping (which can buy the moon). */
export function botEndDay(galaxy: Galaxy, t: Trader, options: BotOptions, random: () => number): Trader {
  const state = shop(galaxy, sellAll(t, random, options), options);
  return options.forge ? forgeSpend(state, options.forge) : state;
}

export interface SimResult {
  /** The day the moon was bought, or 0 if it wasn't within the days played. */
  moonDay: number;
  stats: BotStats;
  /** Credits at the end of each day. */
  credits: number[];
  ships: number[];
  /** The first day each Forge milestone was reached (0: not reached). Only when the bot used the Forge. */
  forge?: Record<Milestone, number>;
}

/** Play up to `days` days of ten jumps each. */
export function playGame(galaxy: Galaxy, start: Trader, seed: string, days: number, options: BotOptions): SimResult {
  const random = seededRandom(`trader-bot:${seed}`);
  const stats = newStats();
  let t = start;
  const credits: number[] = [];
  const ships: number[] = [];
  let moonDay = 0;
  for (let day = 1; day <= days && (!moonDay || options.forge); day++) {
    t = startDay(galaxy, t, day);
    for (let j = 0; j < JUMPS_PER_DAY; j++) {
      if (t.jumpsLeft < 1) break;
      t = botJump(galaxy, t, seed, options, stats, random);
      if (t.moon && !options.forge) {
        moonDay = day;
        break;
      }
    }
    // End the day by selling up and shopping, which can buy the moon.
    t = sellAll(t, random, options);
    t = shop(galaxy, t, options);
    if (options.forge) t = forgeSpend(t, options.forge);
    if (t.moon && !options.forge) moonDay = day;
    credits.push(t.credits);
    ships.push(t.ship);
  }
  return { moonDay, stats, credits, ships, ...(options.forge ? { forge: options.forge.days } : {}) };
}
