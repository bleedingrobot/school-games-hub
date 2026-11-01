import { beforeEach, describe, expect, it } from 'vitest';
import { GOODS, LOLLIES, ORE, SHIPS, WATER } from '../../../../shared/trader/config';
import type { Encounter } from '../../../../shared/trader/encounter';
import { startFight } from '../../../../shared/trader/fight';
import { distance, makeGalaxy, type Galaxy } from '../../../../shared/trader/galaxy';
import { isBanned } from '../../../../shared/trader/market';
import { newTrader, type Trader } from '../../../../shared/trader/state';
import {
  allPrices, bestBuy, bestBuyWorking, borrowSure, chartIdeas, customsWarning, dealAdvice, fightAdvice, loanNotNeeded, pirateWarning,
  piratesAbout, sellElsewhere, tradeIdeas, tripSummary, WORTH_A_JUMP_PCT,
} from './advice';
import { EMPTY_COACH, forSeason, loadCoach, noteHold, saveCoach } from './memory';
import { nextTip, tipsFor, tipStops, type TipId, type TipMoment } from './tips';
import { bestSales } from '../../../../shared/trader/priceGuide';

const DAY = 20_400;
const SEEDS = Array.from({ length: 30 }, (_, i) => `choices-${i}`);

function start(seed: string): { galaxy: Galaxy; t: Trader } {
  const galaxy = makeGalaxy(seed);
  return { galaxy, t: newTrader(galaxy, DAY) };
}
type Offer = Extract<Encounter, { kind: 'trader' }>;
const offer = (o: Partial<Offer>): Offer => ({ kind: 'trader', good: ORE, qty: 8, sells: true, price: 30, fair: 36, ...o });

describe('Bolt: first-time tips', () => {
  const calm: TipMoment = { pending: null, armed: false, after: null, planet: true, tab: 'trade', shipyard: true, loans: true, hasNews: false, jumpsLeft: 5, welcome: false };

  it('each tip shows once and only once: once seen, the same moment gives the next tip or none', () => {
    const moments: [Partial<TipMoment>, TipId][] = [
      [{ pending: 'junk' }, 'junk'],
      [{ pending: 'deal' }, 'trader'],
      [{ pending: 'fight', armed: true }, 'pirates'],
      [{ pending: 'fight', armed: false }, 'pirates-nolaser'],
      [{ after: 'customs', planet: false }, 'customs'],
      [{ after: 'wrecked', planet: false }, 'wrecked'],
      [{ after: 'robbed', planet: false }, 'robbed'],
      [{ tab: 'ship', shipyard: true }, 'shipyard'],
      [{ tab: 'ship', shipyard: false }, 'noyard'],
      [{ tab: 'bank' }, 'bank'],
      [{ hasNews: true }, 'news'],
      [{ jumpsLeft: 0 }, 'jumps'],
    ];
    const seen: string[] = [];
    for (const [change, id] of moments) {
      const m = { ...calm, ...change };
      expect(nextTip(m, seen)).toBe(id);
      seen.push(id);
      expect(nextTip(m, seen)).toBeNull();
    }
    // Nothing new on a calm planet once every tip is seen; and nothing at all with nothing happening.
    expect(nextTip({ ...calm, hasNews: true, jumpsLeft: 0, tab: 'ship' }, seen)).toBeNull();
    expect(nextTip(calm, [])).toBeNull();
  });

  it('waits on the planet while First Flight is showing, but an encounter gets its tip straight away', () => {
    expect(tipsFor({ ...calm, planet: false, tab: 'bank' })).toEqual([]);
    expect(tipsFor({ ...calm, planet: false, pending: 'junk' })).toEqual(['junk']);
  });

  it('two tips at once come one after the other (out of jumps, then the bank)', () => {
    const m = { ...calm, tab: 'bank' as const, jumpsLeft: 0 };
    expect(nextTip(m, [])).toBe('jumps');
    expect(nextTip(m, ['jumps'])).toBe('bank');
  });

  it('the bank tip waits while the bank is closed for the class', () => {
    expect(nextTip({ ...calm, tab: 'bank', loans: false }, [])).toBeNull();
  });

  it('the new-day welcome comes each new day, with the jumps, credits, moon and a headline', () => {
    expect(nextTip({ ...calm, welcome: true }, ['newday'])).toBe('newday');
    const { galaxy, t } = start(SEEDS[0]);
    const [stop] = tipStops('newday', { galaxy, t: { ...t, credits: 1240 }, jumpsPerDay: 10, news: [{ planet: 0, good: WATER, kind: 'sold', text: 'Water is cheap on Mars today.' } as never] });
    expect(stop.say).toBe(`Welcome back! A new day: ${t.jumpsLeft} jumps and 1,240 credits. You're 6% of the way to your moon. 📰 Water is cheap on Mars today.`);
  });

  it('the shipyard tour has three stops, each lighting something; no laser says how often fleeing works', () => {
    const { galaxy, t } = start(SEEDS[0]);
    const c = { galaxy, t, jumpsPerDay: 10, news: [] };
    expect(tipStops('shipyard', c).map((s) => s.target)).toEqual(['ship-fuel', 'ship-list', 'ship-moon']);
    expect(tipStops('pirates-nolaser', c)[0].say).toMatch(/Your Flea has no lasers.*Fleeing works 7 times in 10/);
    expect(tipStops('jumps', c)[0].say).toMatch(/^That's all 10 jumps for today!/);
  });

  it('no shipyard names the nearest one', () => {
    for (const seed of SEEDS) {
      const { galaxy, t } = start(seed);
      const bare = galaxy.planets.find((p) => p.tech < 4);
      if (!bare) continue;
      const say = tipStops('noyard', { galaxy, t: { ...t, location: bare.id }, jumpsPerDay: 10, news: [] })[0].say;
      expect(say).toMatch(/^No shipyard here\. They're only on planets of tech level 4 or more\. You can still buy fuel\. \w+ at \(-?\d+, -?\d+\) has one\.$/);
      return;
    }
    throw new Error('no planet without a shipyard');
  });
});

describe('Bolt: what the device remembers', () => {
  beforeEach(() => localStorage.clear());

  it('keeps tips, deals, buy prices and the day, and a new season starts them again but keeps First Flight', () => {
    saveCoach({ ...EMPTY_COACH, flight: 'done', season: 3, tips: ['junk'], deals: 2, boughtAt: { 0: { each: 8, from: 4 } }, day: 20_400 });
    const m = loadCoach();
    expect(m).toMatchObject({ flight: 'done', season: 3, tips: ['junk'], deals: 2, boughtAt: { 0: { each: 8, from: 4 } }, day: 20_400 });
    expect(forSeason(m, 3)).toBe(m);
    expect(forSeason(m, 4)).toEqual({ ...EMPTY_COACH, flight: 'done', season: 4 });
  });

  it('reads an H.2 memory (no tips yet) and junk safely', () => {
    localStorage.setItem('sgh-trader-coach', JSON.stringify({ flight: 'skipped', run: null }));
    expect(loadCoach()).toEqual({ ...EMPTY_COACH, flight: 'skipped' });
    expect(forSeason({ ...EMPTY_COACH, tips: ['junk'] }, 5)).toEqual({ ...EMPTY_COACH, tips: ['junk'], season: 5 });
    localStorage.setItem('sgh-trader-coach', '{oops');
    expect(loadCoach()).toEqual(EMPTY_COACH);
  });

  it('keeps an average price as goods are bought, forgets a good once it has all gone, and never guesses', () => {
    let b = noteHold({}, [0, 0], [10, 0], { 0: 8 }, 4);
    expect(b).toEqual({ 0: { each: 8, from: 4 } });
    b = noteHold(b, [10, 0], [15, 0], { 0: 11 }, 4);
    expect(b[0].each).toBe(9);
    b = noteHold(b, [15, 0], [5, 0], {}, 7);
    expect(b[0].each).toBe(9);
    expect(noteHold(b, [5, 0], [0, 0], {}, 7)).toEqual({});
    // Water bought on another device: its price stays unknown when more is bought here.
    expect(noteHold({}, [3, 0], [6, 0], { 0: 8 }, 4)).toEqual({});
  });
});

describe('Bolt: the market', () => {
  it('the ⭐ best buy line shows the whole sum', () => {
    const { galaxy, t } = start(SEEDS[0]);
    const best = bestBuy(tradeIdeas(galaxy, t, allPrices(galaxy, t.day)));
    expect(best).not.toBeNull();
    const b = best!;
    expect(bestBuyWorking(galaxy, b)).toBe(`Costs ${b.buy} here → ${galaxy.planets[b.planet].name} pays ${b.sell} → +${b.each} each × ${b.qty} = +${b.each * b.qty}`);
  });

  it('warns about selling here only when a planet in reach pays clearly more and there is a jump left', () => {
    let checked = 0;
    for (const seed of SEEDS) {
      const { galaxy, t } = start(seed);
      const best = bestSales(galaxy, t);
      t.market.forEach((line) => {
        const line2 = sellElsewhere(galaxy, t, line.good, best);
        const b = best[line.good];
        const clearly = !!b && line.sell > 0 && b.sell * 100 >= line.sell * (100 + WORTH_A_JUMP_PCT);
        expect(line2 !== null).toBe(clearly);
        if (line2 && b) {
          checked++;
          expect(line2).toBe(`${galaxy.planets[b.planet].name} pays ${b.sell - line.sell} more each for ${GOODS[line.good]}. Sell there instead?`);
          expect(sellElsewhere(galaxy, { ...t, jumpsLeft: 0 }, line.good, best)).toBeNull();
        }
      });
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('Bolt: the star chart', () => {
  it('gives up to 3 trips to different planets in reach, never a loss, for cargo on board or a buy here', () => {
    for (const seed of SEEDS) {
      const { galaxy, t } = start(seed);
      const prices = allPrices(galaxy, t.day);
      const trips = tradeIdeas(galaxy, t, prices);
      const empty = chartIdeas(galaxy, t, prices, trips);
      expect(empty.length).toBeGreaterThan(0);
      expect(empty.length).toBeLessThanOrEqual(3);
      expect(new Set(empty.map((i) => i.planet)).size).toBe(empty.length);
      for (const idea of empty) {
        expect(idea.onBoard).toBe(false);
        expect(idea.each).toBeGreaterThan(0);
        expect(idea.fuel).toBeLessThanOrEqual(SHIPS[t.ship].fuelTank);
      }
      const loaded = { ...t, cargo: t.cargo.map((_, g) => (g === trips[0].good ? 5 : 0)) };
      for (const idea of chartIdeas(galaxy, loaded, prices, trips)) {
        expect(idea.onBoard).toBe(true);
        expect(idea.planet).not.toBe(t.location);
        expect(idea.sell).toBeGreaterThan(t.market[idea.good].sell);
        expect(isBanned(galaxy.planets[idea.planet], idea.good)).toBe(false);
        expect(distance(galaxy.planets[t.location], galaxy.planets[idea.planet])).toBe(idea.fuel);
      }
    }
  });

  it('warns about customs before the jump when the typed planet bans something in the hold', () => {
    for (const seed of SEEDS) {
      const { galaxy, t } = start(seed);
      const strict = galaxy.planets.find((p) => isBanned(p, LOLLIES));
      if (!strict) continue;
      const loaded = { ...t, cargo: t.cargo.map((_, g) => (g === LOLLIES ? 3 : g === WATER ? 2 : 0)) };
      expect(customsWarning(strict, loaded)).toBe(`${strict.name} bans Lollies. If customs stop you, they will take your 3 Lollies and fine you.`);
      expect(customsWarning(strict, { ...t, cargo: t.cargo.map((_, g) => (g === WATER ? 2 : 0)) })).toBeNull();
      return;
    }
    throw new Error('no planet that bans Lollies');
  });

  it('warns about pirates only on a pirate world for a ship with no lasers', () => {
    for (const seed of SEEDS) {
      const { galaxy, t } = start(seed);
      const den = galaxy.planets.find(piratesAbout);
      if (!den) continue;
      expect(pirateWarning(den, t)).toBe(`Lots of pirates around ${den.name}. Your Flea has no lasers, so it can only run.`);
      expect(pirateWarning(den, { ...t, ship: 1, weapons: [0] })).toBeNull();
      expect(galaxy.planets.filter((p) => !piratesAbout(p)).every((p) => pirateWarning(p, t) === null)).toBe(true);
      return;
    }
    throw new Error('no pirate world');
  });
});

describe('Bolt: the friendly trader', () => {
  const { t } = start(SEEDS[0]);
  const me: Trader = { ...t, credits: 400, cargo: t.cargo.map(() => 0) };

  it('buying: a lower price is a good deal, with the working', () => {
    const a = dealAdvice(offer({ price: 30, fair: 36 }), me);
    expect(a.working).toBe('They sell Ore at 30. Here it costs 36. You\'d save 6 each × 8 = 48.');
    expect(a.good).toBe(true);
    expect(a.verdict).toBe('✅ Good deal. Take it.');
    const b = dealAdvice(offer({ price: 40, fair: 36 }), me);
    expect(b.working).toBe("They sell Ore at 40. Here it costs 36. That's 4 more each than here.");
    expect(b.verdict).toBe('❌ Not a good deal. Say No thanks.');
  });

  it('selling: a higher price is a good deal, with the working', () => {
    const furs = { ...me, cargo: me.cargo.map((_, g) => (g === 1 ? 6 : 0)) };
    const a = dealAdvice(offer({ good: 1, sells: false, qty: 6, price: 40, fair: 35 }), furs);
    expect(a.working).toBe("They pay 40 for your Furs. Here pays 35. That's 5 more each × 6 = 30 extra.");
    expect(a.verdict).toBe('✅ Good deal. Take it.');
    expect(a.checks).toEqual([]);
    expect(dealAdvice(offer({ good: 1, sells: false, qty: 6, price: 31, fair: 35 }), furs).working).toBe("They pay 31 for your Furs. Here pays 35. That's 4 less each than here.");
  });

  it('says whether it fits in the hold and whether the pupil can pay', () => {
    const ok = dealAdvice(offer({}), me);
    expect(ok.checks).toEqual([{ ok: true, text: 'It fits in your hold ✅' }, { ok: true, text: 'You can pay ✅' }]);
    const full = { ...me, cargo: me.cargo.map((_, g) => (g === WATER ? 5 : 0)) };
    const tight = dealAdvice(offer({}), full);
    expect(tight.checks[0]).toEqual({ ok: false, text: 'You only have room for 5 ❌' });
    expect(tight.works).toBe(false);
    expect(tight.verdict).toBe("❌ You can't take this one. Say No thanks.");
    const poor = dealAdvice(offer({}), { ...me, credits: 200 });
    expect(poor.checks[1]).toEqual({ ok: false, text: 'You need 40 more credits ❌' });
    expect(poor.works).toBe(false);
  });
});

describe('Bolt: pirate fights (table 5.5)', () => {
  const { t } = start(SEEDS[0]);
  const flea = t;
  const firefly: Trader = { ...t, ship: 2, hull: 100, weapons: [0], shields: [0] };
  const fight = (who: Trader, hull: number, shield: number, pirateHull = 999) => ({ ...startFight(who, 0, 's'), hull, shield, pirateHull });

  it('no laser: flee, and says how often it works', () => {
    expect(fightAdvice(flea, fight(flea, 25, 0))).toEqual({ move: 'flee', why: 'No lasers. Fleeing works 7 times in 10.' });
  });
  it('a laser and the hull more than half: charge', () => {
    expect(fightAdvice(firefly, fight(firefly, 60, 10))).toEqual({ move: 'charge', why: 'Your lasers can win this. A right answer fires at full power.' });
  });
  it('shields fitted but empty, and the hull above a quarter: raise shields', () => {
    expect(fightAdvice(firefly, fight(firefly, 40, 0))).toEqual({ move: 'shield', why: 'Shields up will soak their next shot.' });
  });
  it('the hull a quarter or less: flee', () => {
    expect(fightAdvice(firefly, fight(firefly, 25, 0))).toEqual({ move: 'flee', why: 'Your hull is very low. Get away and mend it.' });
    expect(fightAdvice(flea, fight(flea, 5, 0)).move).toBe('flee');
  });
  it('otherwise (shields still up, hull under half): charge if one shot could finish them, or else flee', () => {
    expect(fightAdvice(firefly, fight(firefly, 40, 10, 5)).move).toBe('charge');
    expect(fightAdvice(firefly, fight(firefly, 40, 10, 999))).toEqual({ move: 'flee', why: 'Your hull is under half. Getting away is safer: it works about 5 times in 10.' });
  });
});

describe('Bolt: the trip summary and the bank', () => {
  const { galaxy, t } = start(SEEDS[0]);

  it('a trip summary with the profit, or an honest loss, and nothing when a price is unknown', () => {
    const away = (t.location + 1) % galaxy.planets.length;
    const sold = t.cargo.map((_, g) => (g === WATER ? 10 : 0));
    expect(tripSummary(galaxy, t, sold, 120, { [WATER]: { each: 8, from: away } })).toBe(`Trip to ${galaxy.planets[t.location].name}: bought Water for 80, sold for 120: +40 🎉`);
    expect(tripSummary(galaxy, t, sold, 70, { [WATER]: { each: 8, from: away } })).toBe(`Trip to ${galaxy.planets[t.location].name}: bought Water for 80, sold for 70: −10. The next trip can do better.`);
    expect(tripSummary(galaxy, t, sold, 70, { [WATER]: { each: 8, from: t.location } })).toBe('Water: bought for 80, sold for 70: −10. The next trip can do better.');
    expect(tripSummary(galaxy, t, sold, 120, {})).toBeNull();
  });

  it('the first-borrow "Sure?" says what will be owed after a week', () => {
    expect(borrowSure(t, 300)).toBe("Borrow 300 now. After a week you'll owe 330. Part of each sale pays it back.");
  });

  it('says a loan is not needed when the credits already fill the hold with the best buy', () => {
    const trips = tradeIdeas(galaxy, t, allPrices(galaxy, t.day));
    const rich = { ...t, credits: 5000 };
    expect(loanNotNeeded(rich, tradeIdeas(galaxy, rich, allPrices(galaxy, t.day)))).toBe(true);
    const broke = { ...t, credits: 1 };
    expect(loanNotNeeded(broke, tradeIdeas(galaxy, broke, allPrices(galaxy, t.day)))).toBe(false);
    expect(trips.length).toBeGreaterThan(0);
  });
});
