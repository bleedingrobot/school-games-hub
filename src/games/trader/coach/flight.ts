/**
 * First Flight (docs/TRADER-HINTS-PLAN.md, section 2): Bolt guides a pupil through one real trade, from buying to the
 * profit. It follows the game, not a script: the step shown is worked out fresh from the game each time, so a pupil who
 * does things in another order (buys their own choice, opens the chart early, lands somewhere else) is never left
 * waiting for a button they have already pressed.
 */
import { GOODS, MOON_PRICE, SHIPS } from '../../../../shared/trader/config';
import { chartPoint, coordText, type Galaxy } from '../../../../shared/trader/galaxy';
import { bestSales, pricesAt } from '../../../../shared/trader/priceGuide';
import type { Pushes } from '../../../../shared/trader/schoolMarket';
import { fuelCost, fuelNeeded, holdsOf, type Trader } from '../../../../shared/trader/state';
import { COACH_NAME } from '../text';
import type { FlightRun } from './memory';
import type { CoachTab } from './nextStep';

export interface FlightView {
  galaxy: Galaxy;
  t: Trader;
  pushes?: Pushes;
  tab: CoachTab;
  /** The planet whose coordinates are typed in the jump box, if any. */
  aimed?: number | null;
  /** Jumps made in this game so far (the server's count). */
  jumps: number;
  /** The numbers picked in the market but not traded yet (+ buy, − sell), or null off the Trade tab. */
  plan?: readonly number[] | null;
  run: FlightRun;
}

export interface FlightStep {
  /** Which step (1 to `FLIGHT_STEPS`) and a name for it. */
  n: number;
  id: 'hello' | 'hud' | 'buy' | 'bill' | 'chart' | 'find' | 'jump' | 'sell' | 'profit';
  say: string;
  /** The `data-coach` name of the thing to light up. */
  target?: string;
  /** A button that finishes this step ("Let's go"). Steps without one finish when the pupil does the thing. */
  button?: string;
  /** A planet to draw guide lines from on the star chart (to the x and y numbers). */
  guide?: number;
}

export const FLIGHT_STEPS = 9;

const plural = (n: number, word: string): string => `${n} ${word}`;

/** A word on minus signs, for whichever of x and y is negative for this planet. */
function negatives(galaxy: Galaxy, planet: number): string {
  const { x, y } = chartPoint(galaxy.planets[planet]);
  const notes = [...(x < 0 ? ['Left of the middle line, x is negative.'] : []), ...(y < 0 ? ['Below the middle line, y is negative.'] : [])];
  return notes.length ? ` ${notes.join(' ')}` : '';
}

/** The good with the biggest load in the hold, or -1 with an empty hold. */
function biggestLoad(t: Trader): number {
  let pick = -1;
  t.cargo.forEach((qty, good) => {
    if (qty > 0 && (pick < 0 || qty > t.cargo[pick])) pick = good;
  });
  return pick;
}

export function flightStep(v: FlightView): FlightStep {
  const { galaxy, t, run, tab } = v;
  const acked = (id: string) => run.acks.includes(id);
  const here = galaxy.planets[t.location];

  if (!acked('hello')) {
    return {
      n: 1, id: 'hello', button: "Let's go",
      say: `Hi! I'm ${COACH_NAME}, your ship's robot. Traders get rich like this: buy something where it's cheap, fly to a planet that pays more, and sell it. What's left over is your profit. Save ${MOON_PRICE.toLocaleString('en-NZ')} credits and you can buy your own moon!`,
    };
  }
  if (!acked('hud')) {
    return {
      n: 2, id: 'hud', button: 'Got it', target: 'hud',
      say: `Up here is your ship's dashboard. 💰 is your credits: you have ${t.credits.toLocaleString('en-NZ')}. ⛽ is fuel: each square you fly uses 1. 🚀 shows the ${plural(t.jumpsLeft, 'jumps')} you have left today.`,
    };
  }

  const jumped = v.jumps > run.jumps;
  const good = t.cargo[run.good] > 0 ? run.good : biggestLoad(t);

  if (!jumped && good < 0) {
    // Step 3 and 4: buy the cargo.
    const buying = v.plan?.some((q) => q > 0) ?? false;
    if (tab !== 'trade') return { n: 3, id: 'buy', target: 'tab-trade', say: "First, let's buy some cargo. Open the Trade tab." };
    if (buying) {
      return {
        n: 4, id: 'bill', target: 'trade-go',
        say: "This line shows what you'll spend and how many credits you'll have left. Happy? Press Trade. Sometimes a maths check pops up first: get it right for a small discount. Getting it wrong costs nothing.",
      };
    }
    const name = GOODS[run.good];
    const dest = galaxy.planets[run.planet];
    const buy = t.market[run.good]?.buy ?? 0;
    const sell = pricesAt(galaxy, run.planet, t.day, v.pushes)[run.good]?.sell ?? 0;
    const fits = buy > 0 && Math.floor(t.credits / buy) >= holdsOf(t);
    const each = sell - buy;
    return {
      n: 3, id: 'buy', target: `buy-max-${run.good}`,
      say: `This is the market. I've found a good first trade: ${name} costs ${buy} here, and ${dest.name} pays ${sell}.${each > 0 ? ` That's ${each} profit on every one!` : ''} Press Buy max to ${fits ? 'fill your hold' : 'buy as many as you can afford'}.`,
    };
  }

  if (!jumped) {
    // Steps 5 to 7: fly the cargo to the planet that pays more.
    const name = GOODS[good];
    const destId = good === run.good ? run.planet : bestSales(galaxy, t, v.pushes)[good]?.planet ?? run.planet;
    const dest = galaxy.planets[destId];
    if (tab !== 'map') return { n: 5, id: 'chart', target: 'tab-map', say: `${t.cargo[good]} ${name} on board! Now let's fly it to ${dest.name}. Open the Star chart.` };
    if (v.aimed == null || v.aimed === t.location) {
      return {
        n: 6, id: 'find', target: `planet-${dest.id}`, guide: dest.id,
        say: `There's ${dest.name}, glowing yellow. To jump, type where it is. x is how far across: follow the dotted line up to the numbers along the top. y is how far up or down: follow the line across to the numbers down the side.${negatives(galaxy, dest.id)}`,
      };
    }
    return jumpStep(galaxy, t, v.aimed, dest.id);
  }

  if (good >= 0) {
    // Step 8: sell it.
    const name = GOODS[good];
    const pays = t.market[good]?.sell ?? 0;
    if (pays <= 0) {
      const best = bestSales(galaxy, t, v.pushes)[good];
      const dest = best ? galaxy.planets[best.planet] : null;
      if (tab === 'map' && v.aimed != null && v.aimed !== t.location) return { ...jumpStep(galaxy, t, v.aimed, dest?.id ?? v.aimed), n: 8, id: 'sell' };
      return {
        n: 8, id: 'sell', target: tab === 'map' ? (dest ? `planet-${dest.id}` : undefined) : 'tab-map', guide: tab === 'map' ? dest?.id : undefined,
        say: `${here.name} doesn't buy ${name}.${dest ? ` ${dest.name} at ${coordText(dest)} does: open the Star chart and fly there.` : ' Open the Star chart and try another planet.'}`,
      };
    }
    if (tab !== 'trade') return { n: 8, id: 'sell', target: 'tab-trade', say: `Welcome to ${here.name}! It pays ${pays} for ${name}. Open the Trade tab to sell.` };
    if ((v.plan?.[good] ?? 0) < 0) return { n: 8, id: 'sell', target: 'trade-go', say: `Now press Trade to sell your ${name}.` };
    return { n: 8, id: 'sell', target: `sell-all-${good}`, say: `Welcome to ${here.name}! It pays ${pays} for ${name}. Press Sell all to sell all of it, then Trade.` };
  }

  // Step 9: the profit (or, honestly, the loss).
  const profit = t.credits - run.credits;
  const before = `You had ${run.credits.toLocaleString('en-NZ')} credits before the trip, and now you have ${t.credits.toLocaleString('en-NZ')}.`;
  const result =
    profit > 0 ? `That's ${profit.toLocaleString('en-NZ')} credits profit! 🎉 That's trading.`
      : profit === 0 ? 'You came out even this time. Prices change, and the next trip will be better.'
        : `Prices moved, so you lost ${(-profit).toLocaleString('en-NZ')} this time. It happens to every trader, and the next trip will be better.`;
  return {
    n: 9, id: 'profit', button: 'Thanks, Bolt', target: 'hud-credits',
    say: `${before} ${result} Now try one yourself: find something cheap, check where it sells best, and fly there. I'll keep giving you a next step at the top.`,
  };
}

/** Step 7: coordinates are typed in. Can the jump go? */
function jumpStep(galaxy: Galaxy, t: Trader, aimed: number, dest: number): FlightStep {
  const there = galaxy.planets[aimed];
  const need = fuelNeeded(galaxy, t, aimed);
  const tank = SHIPS[t.ship].fuelTank;
  const yours = aimed === dest ? '' : ` That's not ${galaxy.planets[dest].name}, but it's your choice!`;
  if (t.jumpsLeft < 1) return { n: 7, id: 'jump', say: "That's all your jumps for today. Your cargo is safe in the hold: we'll fly it tomorrow." };
  if (need > tank) return { n: 7, id: 'jump', target: `planet-${dest}`, guide: dest, say: `${there.name} is ${need} squares away, but your tank only holds ${tank}. Pick a nearer planet.` };
  if (need > t.fuel) {
    const short = need - t.fuel;
    return { n: 7, id: 'jump', target: 'jump-fuel', say: `${there.name} needs ${need} fuel and you have ${t.fuel}.${yours} You need ${short} more fuel: press Buy ${short} fuel (${fuelCost(t.ship, short)} credits) first.` };
  }
  return { n: 7, id: 'jump', target: 'jump-go', say: `You found ${there.name}!${yours} It needs ${need} fuel and you have ${t.fuel}. Press Jump!` };
}
