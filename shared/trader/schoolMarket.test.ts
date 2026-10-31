import { describe, expect, it } from 'vitest';
import {
  MARKET_CAP_BP,
  MARKET_FULL_STOCK_BP,
  MARKET_KEEP_PCT,
  MARKET_MIN_DEPTH,
  MARKET_NEWS_BP,
  MARKET_PUPIL_CAP_BP,
  MARKET_QUIET_BP,
  WATER,
  ROBOTS,
  GOOD_RULES,
} from './config';
import { makeGalaxy } from './galaxy';
import { marketFor } from './market';
import { newsFor } from './news';
import { emptyPlan } from './plan';
import { DEFAULT_SETTINGS, applyBatch, newGame, type Mark } from './server';
import {
  FINE,
  SchoolMarket,
  drift,
  priceMove,
  pupilPush,
  pushPerUnit,
  pushedLine,
  pushesFrom,
  tidyPushes,
  type SchoolView,
} from './schoolMarket';
import { busyLunchtime, simulateSchool } from './sim';
import { reachable } from './state';

const noMark: Mark = () => null;

describe('the school market rules', () => {
  it('drifts back overnight, keeping the set share each night and rounding towards zero', () => {
    expect(drift(1000, 5, 5, 25)).toBe(1000);
    expect(drift(1000, 5, 6, 25)).toBe(250);
    expect(drift(1000, 5, 7, 25)).toBe(62);
    expect(drift(-1000, 5, 7, 25)).toBe(-62);
    expect(drift(-3, 1, 2, 25)).toBe(0);
    expect(drift(1000, 5, 7, 50)).toBe(250);
    expect(drift(500_000, 1, 100, 99)).toBe(0);
    // The day it was changed is never in the future of `toDay` in normal play; if it is, nothing drifts.
    expect(drift(1000, 9, 5, 25)).toBe(1000);
  });

  it('moves a price by a push, never below 1 credit, and buying always costs more than selling', () => {
    const line = { good: WATER, sell: 10, buy: 11, stock: 40 };
    expect(pushedLine(line, -2000)).toEqual({ good: WATER, sell: 8, buy: 9, stock: 40 });
    expect(pushedLine(line, 2000)).toEqual({ good: WATER, sell: 12, buy: 13, stock: 40 });
    expect(pushedLine({ good: WATER, sell: 1, buy: 2, stock: 3 }, -5000)).toEqual({ good: WATER, sell: 1, buy: 2, stock: 3 });
    expect(pushedLine({ good: WATER, sell: 0, buy: 0, stock: 0 }, 3000)).toEqual({ good: WATER, sell: 0, buy: 0, stock: 0 });
    expect(pushedLine(line, 0)).toBe(line);
  });

  it('has a quiet zone: small pushes leave the price alone', () => {
    expect(priceMove(MARKET_QUIET_BP)).toBe(0);
    expect(priceMove(-MARKET_QUIET_BP + 1)).toBe(0);
    expect(priceMove(MARKET_QUIET_BP + 500)).toBe(500);
    expect(priceMove(-(MARKET_QUIET_BP + 500))).toBe(-500);
  });

  it('a normal day\'s stock is a full push; dear goods move more per unit', () => {
    expect(pushPerUnit(WATER)).toBe(Math.round(MARKET_FULL_STOCK_BP / GOOD_RULES[WATER].stock));
    expect(pushPerUnit(ROBOTS)).toBeGreaterThan(pushPerUnit(WATER));
  });

  it('limits one pupil\'s push on one good at one planet each day, and starts again the next day', () => {
    const raw = MARKET_PUPIL_CAP_BP * MARKET_MIN_DEPTH;
    let r = pupilPush(undefined, 3, 7, ROBOTS, -1000);
    expect(r.bp).toBe(-raw);
    r = pupilPush(r.rec, 3, 7, ROBOTS, -1);
    expect(r.bp).toBe(0); // already as far as they can: the price just stops moving
    r = pupilPush(r.rec, 3, 7, ROBOTS, 1); // buying some back moves it back a little
    expect(r.bp).toBe(pushPerUnit(ROBOTS));
    const other = pupilPush(r.rec, 3, 8, ROBOTS, -1); // another planet has its own limit
    expect(other.bp).toBe(-pushPerUnit(ROBOTS));
    const tomorrow = pupilPush(r.rec, 4, 7, ROBOTS, -1);
    expect(tomorrow.bp).toBe(-pushPerUnit(ROBOTS));
    expect(Object.keys(tomorrow.rec.bp)).toEqual(['7:9']);
  });

  it('adds up and sorts a request\'s pushes', () => {
    expect(tidyPushes([[5, 2, 10], [1, 3, -4], [5, 2, -10], [1, 0, 7], [1, 3, -1]])).toEqual([[1, 0, 7], [1, 3, -5]]);
  });
});

describe('the school market kept in memory (the same rules as the database)', () => {
  it('divides each push by the school\'s depth, keeps within the cap, and drifts back', () => {
    const m = new SchoolMarket();
    m.apply(10, [[2, WATER, -10_000]], 1); // a tiny school counts as MARKET_MIN_DEPTH pupils
    expect(m.pushOf(2, WATER, 10)).toBe(-10_000 / MARKET_MIN_DEPTH);
    m.apply(10, [[2, WATER, -10_000]], 40); // a school of 40: one pupil moves it a fortieth as much
    expect(m.pushOf(2, WATER, 10)).toBe(-2000 - 250);
    for (let i = 0; i < 100; i++) m.apply(10, [[2, WATER, -10_000]], 5);
    expect(m.pushOf(2, WATER, 10)).toBe(-MARKET_CAP_BP);
    expect(m.pushOf(2, WATER, 11)).toBe(Math.trunc((-MARKET_CAP_BP * MARKET_KEEP_PCT) / 100));
    // The price only moves past the quiet zone.
    expect(m.moveOf(2, WATER, 10)).toBe(-(MARKET_CAP_BP - MARKET_QUIET_BP));
  });

  it('keeps small pushes from a big school instead of rounding them away', () => {
    const m = new SchoolMarket();
    for (let i = 0; i < 100; i++) m.apply(1, [[0, WATER, -30]], 100); // 0.3 hundredths each
    expect(m.pushOf(0, WATER, 1)).toBe(-30);
    expect(FINE).toBe(100);
  });

  it('writes news when a price moves a lot in one day, and only then', () => {
    const m = new SchoolMarket();
    m.apply(5, [[3, WATER, -(MARKET_NEWS_BP * MARKET_MIN_DEPTH) + MARKET_MIN_DEPTH]], 5);
    expect(m.view(5).news).toEqual([]);
    m.apply(5, [[3, WATER, -MARKET_MIN_DEPTH * 10]], 5);
    expect(m.view(5).news).toEqual([[5, 3, WATER, -1]]);
    // "Moved today" starts again on a new day; yesterday's news is still there, the day after it's gone.
    m.apply(6, [[3, WATER, 5]], 5);
    const v6 = m.view(6);
    expect(v6.news).toEqual([[5, 3, WATER, -1]]);
    expect(v6.pushes[0][3]).toBe(1);
    expect(m.view(7).news).toEqual([]);
  });

  it('turns what the database sends into landing prices, with the quiet zone', () => {
    const view: SchoolView = { pushes: [[4, WATER, -3000, -3000], [4, ROBOTS, 900, 0], [9, 99, 5000, 0]], news: [] };
    const pushes = pushesFrom(view);
    expect(pushes(4)?.[WATER]).toBe(-(3000 - MARKET_QUIET_BP));
    expect(pushes(4)?.[ROBOTS]).toBe(0);
    expect(pushes(9)).toBeNull(); // a good that doesn't exist is ignored
    expect(pushes(1)).toBeNull();
  });
});

describe('trading on the school market', () => {
  const galaxy = makeGalaxy('market-test');
  const settings = { ...DEFAULT_SETTINGS, maths: false };

  it('a trade sends its push with the request (after the pupil\'s limit), and prices are fixed when you land', () => {
    const game = newGame(galaxy, 100, settings);
    const here = game.t.location;
    const water = game.t.market[WATER];
    expect(water.buy).toBeGreaterThan(0);
    const plan = emptyPlan();
    plan[WATER] = 5;
    const r = applyBatch(galaxy, 'market-test', game, [{ type: 'trade', plan }], settings, noMark);
    if (!r.ok) throw new Error(r.reason);
    expect(r.pushes).toEqual([[here, WATER, 5 * pushPerUnit(WATER)]]);
    expect(r.game.pushed).toEqual({ day: 100, bp: { [`${here}:${WATER}`]: 5 * pushPerUnit(WATER) } });
    // Selling them back moves it back.
    const back = emptyPlan();
    back[WATER] = -5;
    const r2 = applyBatch(galaxy, 'market-test', r.game, [{ type: 'trade', plan: back }], settings, noMark);
    if (!r2.ok) throw new Error(r2.reason);
    expect(r2.pushes).toEqual([[here, WATER, -5 * pushPerUnit(WATER)]]);
    expect(r2.game.pushed?.bp).toEqual({});
  });

  it('a jump lands at the school\'s prices; your own prices don\'t change while you are there', () => {
    const game = newGame(galaxy, 100, settings);
    const dest = galaxy.planets[reachable(galaxy, game.t)[0]];
    const cheap = galaxy.planets.map(() => [-5000, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const r = applyBatch(galaxy, 'market-test', game, [{ type: 'jump', dest: dest.id }], settings, noMark, (p) => cheap[p]);
    if (!r.ok) throw new Error(r.reason);
    const normal = marketFor(galaxy, dest.id, 100);
    expect(r.game.t.market[WATER].sell).toBeLessThan(normal[WATER].sell);
    expect(r.game.t.market[WATER].sell).toBe(pushedLine(normal[WATER], -5000).sell);
    // Later moves (other pupils' trades) don't touch the prices this pupil landed with.
    const r2 = applyBatch(galaxy, 'market-test', { ...r.game, pending: null }, [{ type: 'refuel', units: 1 }], settings, noMark, () => [5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000]);
    if (!r2.ok) throw new Error(r2.reason);
    expect(r2.game.t.market).toEqual(r.game.t.market);
  });
});

describe('the news', () => {
  const galaxy = makeGalaxy('news-test');

  it('explains today\'s big moves, then yesterday\'s still showing, then events, and never names anyone', () => {
    const view: SchoolView = {
      pushes: [[3, WATER, -3000, -3000], [5, ROBOTS, 4000, 0]],
      news: [[20, 3, WATER, -1], [19, 5, ROBOTS, 1], [19, 6, WATER, -1]],
    };
    const items = newsFor(galaxy, 20, view);
    expect(items[0]).toMatchObject({ planet: 3, good: WATER, kind: 'sold' });
    expect(items[0].text).toBe(`Lots of traders sold Water on ${galaxy.planets[3].name}, so it's cheap there today.`);
    expect(items[1]).toMatchObject({ planet: 5, kind: 'still-dear' });
    expect(items[1].text).toBe(`Robots are still dear on ${galaxy.planets[5].name} after lots of buying yesterday.`);
    // Planet 6's push has drifted back into the quiet zone, so it's not news any more.
    expect(items.some((n) => n.planet === 6 && n.kind !== 'event')).toBe(false);
    for (const n of items.filter((x) => x.kind === 'event')) expect(n.text).toMatch(/dear\.$/);
  });

  it('a busy lunchtime of pretend classmates makes some news', () => {
    const market = new SchoolMarket();
    busyLunchtime(galaxy, market, 30, 30, 'test');
    const view = market.view(30);
    expect(view.pushes.length).toBeGreaterThan(0);
    expect(newsFor(galaxy, 30, view).some((n) => n.kind === 'sold' || n.kind === 'bought')).toBe(true);
  });
});

describe('a busy school in the simulator', () => {
  it('plays many pupils on one market, the same each time, and the moon is still reachable', () => {
    const run = () => simulateSchool({ pupils: 12, days: 25, mathsRate: 0.7, sloppy: [0, 0.4], info: 'news', seed: 'sim-test' });
    const a = run();
    expect(run().creditsAt).toEqual(a.creditsAt);
    expect(a.moonShare).toBeGreaterThan(0.5);
    expect(a.maxPushPct).toBeLessThanOrEqual(MARKET_CAP_BP / 100);
  });
});
