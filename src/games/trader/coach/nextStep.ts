/**
 * Bolt's next step (docs/TRADER-HINTS-PLAN.md, section 3): the one thing a pupil should do now, worked out fresh from the
 * game each time it changes. The first rule that fits wins. Each step can name a button (`target`, a `data-coach` name)
 * and the tab it is on, so "Show me" can light it up.
 */
import { GOODS, MOON_PRICE, SHIPS } from '../../../../shared/trader/config';
import { coordText, type Galaxy } from '../../../../shared/trader/galaxy';
import type { Pushes } from '../../../../shared/trader/schoolMarket';
import { fuelCost, fuelNeeded, hasShipyard, holdsOf, usedHolds, type Trader } from '../../../../shared/trader/state';
import { allPrices, bannedCargo, cargoPlan, nearestPlanet, nearestShipyard, nextUpgrade, stopOnTheWay, tradeIdeas } from './advice';

export type CoachTab = 'trade' | 'ship' | 'bank' | 'map';

export interface CoachView {
  galaxy: Galaxy;
  t: Trader;
  pushes?: Pushes;
  tab: CoachTab;
  /** The planet whose coordinates are typed in the jump box, if any. */
  aimed?: number | null;
  /** The bank is open for this class. */
  loans?: boolean;
}

export interface NextStep {
  say: string;
  /** The `data-coach` name of the thing to light up. */
  target?: string;
  /** The tab it is on (when "Show me" should open it first). */
  tab?: CoachTab;
}

const cr = (n: number): string => `${n.toLocaleString('en-NZ')} credits`;
const tabTarget = (tab: CoachTab, here: CoachTab, target: string): NextStep['target'] => (tab === here ? target : `tab-${tab}`);

export function nextStep(v: CoachView): NextStep {
  const { galaxy, t, pushes, tab } = v;
  const tank = SHIPS[t.ship].fuelTank;

  // The goal: the moon.
  if (!t.moon && t.credits >= MOON_PRICE) {
    if (hasShipyard(galaxy, t)) return { say: `You have ${cr(t.credits)}. That's enough to buy your own moon! 🌙`, target: tabTarget('ship', tab, 'moon-buy'), tab: 'ship' };
    const yard = nearestShipyard(galaxy, t);
    return { say: `You have enough to buy your own moon! 🌙 Moons are sold at shipyards${yard ? `: ${yard.name} at ${coordText(yard)} has one` : ''}.`, target: yard ? tabTarget('map', tab, `planet-${yard.id}`) : undefined, tab: 'map' };
  }

  const plan = cargoPlan(galaxy, t, pushes);

  // No jumps left: say so, and sell here if it pays.
  if (t.jumpsLeft < 1) {
    if (plan && plan.here > 0) return { say: `That's all your jumps for today. You can sell your ${GOODS[plan.good]} here (${plan.here} each), or keep it safe in the hold until tomorrow.`, target: tabTarget('trade', tab, `sell-all-${plan.good}`), tab: 'trade' };
    return { say: "That's all your jumps for today. Your ship, cargo and credits are saved. Come back tomorrow!" };
  }

  // A planet is typed in the jump box: is it safe, and can we get there?
  if (tab === 'map' && v.aimed != null && v.aimed !== t.location) {
    const dest = galaxy.planets[v.aimed];
    const banned = bannedCargo(dest, t);
    if (banned.length) {
      const names = banned.map((g) => GOODS[g]).join(' and ');
      return { say: `Careful! ${dest.name} bans ${names}. Customs there would take them and fine you. Sell them first, or pick another planet.`, target: 'tab-trade', tab: 'trade' };
    }
    const need = fuelNeeded(galaxy, t, dest.id);
    if (need > tank) {
      const stop = stopOnTheWay(galaxy, t, dest.id);
      return { say: `${dest.name} is ${need} squares away, but your tank only holds ${tank}. ${stop ? `Stop at ${stop.name} ${coordText(stop)} on the way.` : 'Pick a nearer planet.'}`, target: stop ? `planet-${stop.id}` : undefined };
    }
    if (need > t.fuel) {
      const short = need - t.fuel;
      return { say: `${dest.name} needs ${need} fuel and you have ${t.fuel}. Buy ${short} more fuel (${cr(fuelCost(t.ship, short))}) first.`, target: 'jump-fuel' };
    }
    return { say: `${dest.name} needs ${need} fuel and you have ${t.fuel}. Press Jump!`, target: 'jump-go' };
  }

  // Cargo in the hold: sell it here, or fly it somewhere that pays more.
  if (plan) {
    const name = GOODS[plan.good];
    if (plan.sellHere) {
      const why = plan.best && plan.best.sell > plan.here ? `It's ${plan.here} each here, nearly as good as anywhere nearby` : `This is the best price nearby (${plan.here} each)`;
      return { say: `Sell your ${plan.qty} ${name} here. ${why}.`, target: tabTarget('trade', tab, `sell-all-${plan.good}`), tab: 'trade' };
    }
    if (plan.best) {
      const dest = galaxy.planets[plan.best.planet];
      const pays = `It pays ${plan.best.sell} each${plan.here > 0 ? `; here pays ${plan.here}` : ''}.`;
      if (plan.best.fuel > t.fuel) {
        return { say: `Fill your tank, then fly your ${name} to ${dest.name} at ${coordText(dest)}. ${pays}`, target: tabTarget('ship', tab, 'ship-fuel'), tab: 'ship' };
      }
      return { say: `Fly your ${name} to ${dest.name} at ${coordText(dest)}. ${pays}`, target: tab === 'map' ? `planet-${dest.id}` : 'tab-map', tab: 'map' };
    }
    return { say: `Nobody near here buys ${name} today. Try a planet further away, or keep it for another day.`, target: 'tab-map', tab: 'map' };
  }

  // A damaged hull, if the pupil can pay to mend it.
  const rule = SHIPS[t.ship];
  const mend = rule.hull - t.hull;
  if (t.hull * 2 < rule.hull && mend * rule.repairCost <= t.credits) {
    return { say: `Your hull is getting low (${t.hull} of ${rule.hull}). Mend it before pirates find you: it costs ${cr(mend * rule.repairCost)}.`, target: tabTarget('ship', tab, 'ship-mend'), tab: 'ship' };
  }

  const trips = tradeIdeas(galaxy, t, allPrices(galaxy, t.day, pushes));

  // An upgrade, while still keeping enough to trade.
  const up = nextUpgrade(galaxy, t, trips);
  if (up) return { say: `You can afford ${up.name} (${cr(up.cost)}). ${up.why}`, target: tabTarget('ship', tab, up.target), tab: 'ship' };

  // The best thing to buy here.
  const best = trips.find((trip) => trip.qty > 0);
  if (best) {
    const dest = galaxy.planets[best.planet];
    return {
      say: `⭐ Best buy here: ${GOODS[best.good]}. It costs ${best.buy} here and ${dest.name} pays ${best.sell}: +${best.each} each. Press Buy max, then Trade.`,
      target: tabTarget('trade', tab, `buy-max-${best.good}`),
      tab: 'trade',
    };
  }

  // Nothing worth buying.
  if (usedHolds(t) >= holdsOf(t)) return { say: 'Your hold is full. Open the Star chart and pick somewhere to sell.', target: 'tab-map', tab: 'map' };
  if (trips.length && v.loans) return { say: "You're low on credits for a good trade here. The Bank can lend you some, or sell something first.", target: tab === 'bank' ? undefined : 'tab-bank', tab: 'bank' };
  const near = nearestPlanet(galaxy, t);
  return {
    say: `Nothing here makes a profit today. Try another planet${near ? `: ${near.name} at ${coordText(near)} is close` : ''}.`,
    target: near ? (tab === 'map' ? `planet-${near.id}` : 'tab-map') : undefined,
    tab: 'map',
  };
}
