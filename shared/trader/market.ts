/**
 * Prices and stock. Everything here is worked out from the galaxy, the day and the planet, so nothing needs to be
 * stored: ask again and you get the same answer. The school's shared market (schoolMarket.ts) can then push a price up
 * or down; a pupil's prices are worked out once, when they land, and kept for the visit.
 *
 * The price rule is the original's: base by tech level, a third more if the planet wants it, less with lots of
 * traders, less on big planets, a quarter off or a third more for special resources, nothing if the planet can't
 * use it or bans it, half as much again in an event, then a little random wobble.
 */
import { seededRandom } from '../maths/serverQuestions';
import {
  EVENTS,
  EVENT_BLOCK_DAYS,
  EVENT_CHANCE_PCT,
  EVENT_PRICE_PCT,
  EVENT_STOCK_DIVISOR,
  FIREWORKS,
  GOODS,
  GOOD_RULES,
  GOVERNMENTS,
  LOLLIES,
  PRICE_DIVISOR,
  RESOURCE_CHEAP_PCT,
  RESOURCE_DEAR_PCT,
  SIZE_STOCK_PCT,
  SPREAD_PCT,
  WANTED_PCT,
} from './config';
import type { Galaxy, Planet } from './galaxy';
import { pushedLine } from './schoolMarket';

export interface MarketLine {
  good: number;
  /** What the planet pays you for one (0 if it won't buy). */
  sell: number;
  /** What one costs you (0 if it has none to sell). */
  buy: number;
  /** How many it has to sell today. */
  stock: number;
}

/** Is this good banned on this planet? */
export function isBanned(planet: Planet, good: number): boolean {
  const g = GOVERNMENTS[planet.government];
  return (good === LOLLIES && !g.lolliesOk) || (good === FIREWORKS && !g.fireworksOk);
}

/** The event on a planet today (an index into EVENTS, 0 for none). It lasts a few days, then may change. */
export function eventOn(galaxy: Galaxy, planet: Planet, day: number): number {
  const block = Math.floor((day + planet.id) / EVENT_BLOCK_DAYS);
  const random = seededRandom(`trader-event:${galaxy.seed}:${planet.id}:${block}`);
  if (Math.floor(random() * 100) >= EVENT_CHANCE_PCT) return 0;
  return 1 + Math.floor(random() * (EVENTS.length - 1));
}

/** The original's standard price, in the original's money (0 if it can't be traded here). */
export function standardPrice(planet: Planet, good: number): number {
  const rule = GOOD_RULES[good];
  const gov = GOVERNMENTS[planet.government];
  if (isBanned(planet, good)) return 0;
  if (planet.tech < rule.useTech) return 0;
  let price = rule.lowTech + planet.tech * rule.step;
  if (gov.wants === good) price = Math.floor((price * WANTED_PCT) / 100);
  price = Math.floor((price * (100 - 2 * gov.traders)) / 100);
  price = Math.floor((price * (100 - planet.size)) / 100);
  if (planet.resource > 0) {
    if (rule.cheapWith > 0 && planet.resource === rule.cheapWith) price = Math.floor((price * RESOURCE_CHEAP_PCT) / 100);
    if (rule.dearWith > 0 && planet.resource === rule.dearWith) price = Math.floor((price * RESOURCE_DEAR_PCT) / 100);
  }
  return price < 0 ? 0 : price;
}

/** The whole market on a planet on a given day, moved by the school's push on each good (if any). */
export function marketFor(galaxy: Galaxy, planetId: number, day: number, push?: readonly number[] | null): MarketLine[] {
  const planet = galaxy.planets[planetId];
  const event = eventOn(galaxy, planet, day);
  const random = seededRandom(`trader-market:${galaxy.seed}:${planetId}:${day}`);
  return GOODS.map((_, good): MarketLine => {
    const rule = GOOD_RULES[good];
    let price = standardPrice(planet, good);
    // Draw the random numbers for every good, in order, so one good's price never depends on another's rules.
    const wobble = Math.floor(random() * (rule.variance + 1)) - Math.floor(random() * (rule.variance + 1));
    const stockWobble = Math.floor(random() * 11) - 5;
    if (price <= 0) return { good, sell: 0, buy: 0, stock: 0 };
    if (rule.event > 0 && event === rule.event) price = Math.floor((price * EVENT_PRICE_PCT) / 100);
    price += wobble;
    const sell = Math.max(1, Math.round(price / PRICE_DIVISOR));
    let buy = 0;
    let stock = 0;
    if (planet.tech >= rule.makeTech) {
      buy = Math.max(sell + 1, Math.floor((sell * (100 + SPREAD_PCT)) / 100));
      stock = Math.floor((rule.stock * SIZE_STOCK_PCT[planet.size]) / 100);
      if (rule.event > 0 && event === rule.event) stock = Math.floor(stock / EVENT_STOCK_DIVISOR);
      stock = Math.max(0, stock + stockWobble);
    }
    const line = { good, sell, buy, stock };
    return push?.[good] ? pushedLine(line, push[good]) : line;
  });
}
