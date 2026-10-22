/**
 * What can happen on a jump. One roll per jump, from the trader's seed and jump number, so the server can roll the
 * same one again. About 1 jump in 3 has something (docs/TRADER-PLAN.md, section 7).
 */
import { seededRandom } from '../maths/serverQuestions';
import {
  CUSTOMS_FINE_BASE,
  CUSTOMS_FINE_PER_UNIT,
  ENCOUNTER_CAP_PCT,
  ENCOUNTER_DIVISOR,
  GOVERNMENTS,
  JUNK_HULL_DAMAGE,
  JUNK_PCT,
  PIRATE_TIERS,
  TRADER_BAD_PCT,
  TRADER_GOOD_PCT,
} from './config';
import type { Galaxy } from './galaxy';
import { isBanned } from './market';
import { freeHolds, type Trader } from './state';

export type Encounter =
  | { kind: 'none' }
  | { kind: 'junk' }
  | { kind: 'customs'; banned: number[] }
  | { kind: 'pirates'; tier: number }
  | { kind: 'trader'; good: number; qty: number; sells: boolean; price: number; fair: number };

/** The chance (percent) of meeting someone on the way to this planet. */
export function encounterChance(galaxy: Galaxy, planetId: number): number {
  const g = GOVERNMENTS[galaxy.planets[planetId].government];
  return Math.min(ENCOUNTER_CAP_PCT, Math.floor(((g.pirates + g.customs + g.traders) * 100) / ENCOUNTER_DIVISOR));
}

/** Roll the encounter for the jump that has just been made (the trader is already at the new planet). */
export function encounterFor(galaxy: Galaxy, t: Trader, seed: string): Encounter {
  const random = seededRandom(`trader-encounter:${seed}:${t.jumpNo}`);
  const roll = Math.floor(random() * 100);
  if (roll < JUNK_PCT) return { kind: 'junk' };
  const here = galaxy.planets[t.location];
  const g = GOVERNMENTS[here.government];
  if (Math.floor(random() * 100) >= encounterChance(galaxy, t.location)) return { kind: 'none' };
  const total = g.pirates + g.customs + g.traders;
  if (total <= 0) return { kind: 'none' };
  const pick = Math.floor(random() * total);
  if (pick < g.pirates) {
    const tiers = PIRATE_TIERS.map((tier, i) => ({ tier, i })).filter((x) => g.pirates >= x.tier.minStrength);
    return { kind: 'pirates', tier: tiers[Math.floor(random() * tiers.length)].i };
  }
  if (pick < g.pirates + g.customs) {
    const banned = t.cargo.map((qty, good) => (qty > 0 && isBanned(here, good) ? good : -1)).filter((good) => good >= 0);
    return { kind: 'customs', banned };
  }
  // A friendly trader: a load of something you could trade, at a deal that is good or bad compared with this planet.
  const sells = random() < 0.5;
  const options = t.market.filter((line) => (sells ? line.buy > 0 : line.sell > 0 && t.cargo[line.good] > 0));
  if (!options.length) return { kind: 'none' };
  const line = options[Math.floor(random() * options.length)];
  const fair = sells ? line.buy : line.sell;
  const good = random() < 0.5;
  const pct = good ? TRADER_GOOD_PCT : TRADER_BAD_PCT;
  // A trader who sells to you is a good deal when it costs less; one who buys from you is good when it pays more.
  const price = Math.max(1, Math.round(sells === good ? (fair * (100 - pct)) / 100 : (fair * (100 + pct)) / 100));
  const qty = sells ? 3 + Math.floor(random() * 8) : Math.max(1, Math.min(t.cargo[line.good], 3 + Math.floor(random() * 8)));
  return { kind: 'trader', good: line.good, qty, sells, price, fair };
}

/** Customs: banned goods are taken and a small fine charged (never more than you have). */
export function settleCustoms(t: Trader, banned: number[]): { state: Trader; taken: number; fine: number } {
  const state: Trader = { ...t, cargo: [...t.cargo] };
  let taken = 0;
  for (const good of banned) {
    taken += state.cargo[good];
    state.cargo[good] = 0;
  }
  const fine = taken > 0 ? Math.min(state.credits, CUSTOMS_FINE_BASE + CUSTOMS_FINE_PER_UNIT * taken) : 0;
  state.credits -= fine;
  return { state, taken, fine };
}

/** Space junk: steer through (a right answer) or take a little hull damage (a wrong one, never below 1). */
export function settleJunk(t: Trader, steeredWell: boolean): Trader {
  if (steeredWell) return t;
  return { ...t, hull: Math.max(1, t.hull - JUNK_HULL_DAMAGE) };
}

/** Is the trader's deal a good one? (For the "is that a good deal?" question.) */
export const isGoodDeal = (e: Extract<Encounter, { kind: 'trader' }>): boolean => (e.sells ? e.price < e.fair : e.price > e.fair);

/** Take a friendly trader's deal. */
export function acceptDeal(t: Trader, e: Extract<Encounter, { kind: 'trader' }>): Trader | null {
  const state: Trader = { ...t, cargo: [...t.cargo] };
  if (e.sells) {
    const cost = e.price * e.qty;
    if (cost > state.credits || e.qty > freeHolds(t)) return null;
    state.credits -= cost;
    state.cargo[e.good] += e.qty;
  } else {
    if (state.cargo[e.good] < e.qty) return null;
    state.cargo[e.good] -= e.qty;
    state.credits += e.price * e.qty;
  }
  return state;
}
