/** Plays many bot games and sums them up. Used by scripts/trader-sim.mjs (`npm run trader:sim`). */
import { seededRandom } from '../maths/serverQuestions';
import { JUMPS_PER_DAY, MARKET_MIN_DEPTH, MOON_PRICE } from './config';
import { botEndDay, botJump, newStats, playGame, type BotOptions, type BotStats, type SimResult } from './bot';
import { makeGalaxy, type Galaxy } from './galaxy';
import { MARKET_RULES, PUPIL_LIMITS, SchoolMarket, priceMove, pupilPush, pushPerUnit, type MarketRules, type PupilLimits, type PupilPushes } from './schoolMarket';
import { newTrader, startDay } from './state';

export interface SimSummary {
  games: number;
  /** Share (0 to 1) that bought the moon within the days played. */
  moonShare: number;
  /** Moon day at the 10th, 50th and 90th percentile of those that got there. */
  moonDays: [number, number, number];
  /** Average credits at the end of days 1, 2, 3, 5 and 8 (the moon's price once it is bought). */
  creditsAt: number[];
  stats: BotStats;
  /** Average ship number reached by day 10. */
  shipAt10: number;
}

export function simulate(options: BotOptions & { games: number; days: number; offset?: number }): SimSummary {
  const results: SimResult[] = [];
  for (let g = 0; g < options.games; g++) {
    const seed = `sim-${(options.offset ?? 0) + g}`;
    const galaxy = makeGalaxy(seed);
    results.push(playGame(galaxy, newTrader(galaxy, 1), seed, options.days, options));
  }
  const got = results.filter((r) => r.moonDay > 0).map((r) => r.moonDay).sort((a, b) => a - b);
  const pct = (p: number): number => (got.length ? got[Math.min(got.length - 1, Math.floor(p * got.length))] : 0);
  const total: BotStats = { jumps: 0, profitableJumps: 0, fights: 0, piratesBeaten: 0, wrecks: 0, robbed: 0, customsFines: 0 };
  for (const r of results) for (const k of Object.keys(total) as (keyof BotStats)[]) total[k] += r.stats[k];
  // Once a game has bought the moon it counts as the moon's price from then on.
  const at = (day: number): number => Math.round(results.reduce((sum, r) => sum + (day > r.credits.length ? MOON_PRICE : r.credits[day - 1]), 0) / results.length);
  return {
    games: results.length,
    moonShare: got.length / results.length,
    moonDays: [pct(0.1), pct(0.5), pct(0.9)],
    creditsAt: [at(1), at(2), at(3), at(5), at(8)],
    stats: total,
    shipAt10: results.reduce((sum, r) => sum + (r.ships[Math.min(10, r.ships.length) - 1] ?? 0), 0) / results.length,
  };
}

// ---------------------------------------------------------------------------------------------
// A busy school: many bots trading on one shared market (stage T.4)
// ---------------------------------------------------------------------------------------------

export interface SchoolSimOptions {
  /** How many pupils trade at the school. */
  pupils: number;
  days: number;
  mathsRate: number;
  /** Each pupil's sloppiness, given out in turn from this list (a class is a mix). */
  sloppy: readonly number[];
  /**
   * What bots know about prices elsewhere when they plan a trip: 'none' = only normal prices, so they crowd the same
   * routes; 'news' = also the big moves the news would tell them about; 'all' = every price at the school right now.
   */
  info: 'none' | 'news' | 'all';
  /** Each pupil's own taste (see BotOptions.taste). Default 0.3. */
  taste?: number;
  /** False: no shared market, every pupil alone (to compare with). Default true. */
  shared?: boolean;
  seed?: string;
  /** Market numbers to try instead of config.ts. */
  rules?: Partial<MarketRules>;
  limits?: Partial<PupilLimits>;
  /** Pupils play on this share of days (0 to 1); default every day. */
  playShare?: number;
}

export interface SchoolSimSummary {
  pupils: number;
  moonShare: number;
  moonDays: [number, number, number];
  /** Average credits at the end of days 1, 2, 3, 5 and 8. */
  creditsAt: number[];
  /** How much the school's push moved the prices bots traded at, in percent (weighted by units). Buying: + is dearer. Selling: − is cheaper. */
  boughtAtPct: number;
  soldAtPct: number;
  /** Share of a pupil's trade pushes cut by their own 20% limit. */
  pupilCapShare: number;
  /** At the end of each school day: share of market rows at the 50% limit, the average size of a push (percent), and the biggest. */
  atCapShare: number;
  avgPushPct: number;
  maxPushPct: number;
  /** News lines about price moves a day (not counting events). */
  newsPerDay: number;
  /** Seconds the simulation took. */
  seconds: number;
}

/** What the news tells a pupil: only pushes big enough to be reported (today's, or yesterday's still showing). */
const newsOnly = (push: readonly number[] | null, news: number): number[] | null => (push ? push.map((p) => (Math.abs(p) * 2 >= news ? p : 0)) : null);

/** Plays a whole school on one galaxy, taking turns within each day, all trading on one market. */
export function simulateSchool(o: SchoolSimOptions): SchoolSimSummary {
  const started = Date.now();
  const seed = o.seed ?? 'school-sim';
  const galaxy = makeGalaxy(seed);
  const rules: MarketRules = { ...MARKET_RULES, ...o.rules };
  const market = new SchoolMarket(rules);
  const limits: PupilLimits = { ...PUPIL_LIMITS, ...o.limits };
  const shared = o.shared !== false;
  const order = seededRandom(`${seed}:order`);
  let today = 1;
  let pupilPushes = 0;
  let pupilCapped = 0;
  const seen = { buyUnits: 0, buyPct: 0, sellUnits: 0, sellPct: 0 };
  const capSamples: number[] = [];
  const avgSamples: number[] = [];
  let maxPush = 0;
  let newsLines = 0;

  const bots = Array.from({ length: o.pupils }, (_, i) => {
    let rec: PupilPushes | undefined;
    const bot = {
      t: newTrader(galaxy, 1),
      random: seededRandom(`${seed}:bot:${i}`),
      stats: newStats(),
      moonDay: 0,
      credits: [] as number[],
      options: { mathsRate: o.mathsRate, sloppy: o.sloppy[i % o.sloppy.length], taste: o.taste ?? 0.3, tasteSeed: `${seed}:taste:${i}` } as BotOptions,
    };
    if (shared) {
      bot.options.market = {
        pushes: (planet) => market.pushes(today)(planet),
        planning: o.info === 'none' ? undefined : o.info === 'all' ? (planet) => market.pushes(today)(planet) : (planet) => newsOnly(market.pushes(today)(planet), rules.news),
        traded(t, good, qty) {
          const now = market.moveOf(t.location, good, today) / 100;
          if (qty > 0) {
            seen.buyUnits += qty;
            seen.buyPct += qty * now;
          } else {
            seen.sellUnits -= qty;
            seen.sellPct -= qty * now;
          }
          const before = rec && rec.day === today ? (rec.bp[`${t.location}:${good}`] ?? 0) : 0;
          const raw = limits.pupilCap * MARKET_MIN_DEPTH;
          const want = Math.max(-raw, Math.min(raw, before + qty * pushPerUnit(good, limits.full))) - before;
          const r = pupilPush(rec, today, t.location, good, qty, limits);
          rec = r.rec;
          pupilPushes += 1;
          if (r.bp !== want) pupilCapped += 1;
          if (r.bp) market.apply(today, [[t.location, good, r.bp]], o.pupils);
        },
      };
    }
    return bot;
  });

  for (let day = 1; day <= o.days; day++) {
    today = day;
    const playing = bots.filter((b) => !b.moonDay && (o.playShare === undefined || order() < o.playShare));
    for (const b of playing) b.t = startDay(galaxy, b.t, day, shared ? market.pushes(day) : undefined);
    for (let j = 0; j < JUMPS_PER_DAY; j++) {
      // Everyone takes a turn, in a new order each round.
      const turn = [...playing];
      for (let i = turn.length - 1; i > 0; i--) {
        const k = Math.floor(order() * (i + 1));
        [turn[i], turn[k]] = [turn[k], turn[i]];
      }
      for (const b of turn) {
        if (b.moonDay || b.t.jumpsLeft < 1) continue;
        b.t = botJump(galaxy, b.t, seed + ':' + bots.indexOf(b), b.options, b.stats, b.random);
        if (b.t.moon) b.moonDay = day;
      }
    }
    for (const b of playing) {
      if (b.moonDay) continue;
      b.t = botEndDay(galaxy, b.t, b.options, b.random);
      if (b.t.moon) b.moonDay = day;
    }
    for (const b of bots) b.credits.push(b.moonDay ? MOON_PRICE : b.t.credits);
    if (shared) {
      const pushes = market.stored(day).map((p) => priceMove(p, rules.quiet));
      const cap = rules.cap;
      capSamples.push(pushes.length ? pushes.filter((p) => Math.abs(p) >= cap - rules.quiet).length / (galaxy.planets.length * 10) : 0);
      avgSamples.push(pushes.reduce((a, p) => a + Math.abs(p), 0) / (galaxy.planets.length * 10) / 100);
      for (const p of pushes) maxPush = Math.max(maxPush, Math.abs(p) / 100);
      newsLines += market.view(day).news.filter((n) => n[0] === day).length;
    }
  }

  const got = bots.filter((b) => b.moonDay > 0).map((b) => b.moonDay).sort((a, b) => a - b);
  const pct = (p: number): number => (got.length ? got[Math.min(got.length - 1, Math.floor(p * got.length))] : 0);
  const at = (day: number): number => Math.round(bots.reduce((sum, b) => sum + (b.credits[day - 1] ?? 0), 0) / bots.length);
  const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return {
    pupils: o.pupils,
    moonShare: got.length / bots.length,
    moonDays: [pct(0.1), pct(0.5), pct(0.9)],
    creditsAt: [at(1), at(2), at(3), at(5), at(8)],
    boughtAtPct: seen.buyUnits ? seen.buyPct / seen.buyUnits : 0,
    soldAtPct: seen.sellUnits ? seen.sellPct / seen.sellUnits : 0,
    pupilCapShare: pupilPushes ? pupilCapped / pupilPushes : 0,
    atCapShare: mean(capSamples),
    avgPushPct: mean(avgSamples),
    maxPushPct: maxPush,
    newsPerDay: newsLines / o.days,
    seconds: (Date.now() - started) / 1000,
  };
}

/**
 * A busy lunchtime for the preview: `pupils` pretend classmates (in middle-sized ships) each make the day's jumps on the
 * school's market, so the news and the pushed prices can be seen. Changes `market` only.
 */
export function busyLunchtime(galaxy: Galaxy, market: SchoolMarket, day: number, pupils = 30, seed = 'busy'): void {
  const random = seededRandom(`${seed}:${day}`);
  for (let i = 0; i < pupils; i++) {
    let rec: PupilPushes | undefined;
    const options: BotOptions = {
      mathsRate: 0.7,
      sloppy: 0.2,
      market: {
        pushes: market.pushes(day),
        planning: undefined,
        traded(t, good, qty) {
          const r = pupilPush(rec, day, t.location, good, qty);
          rec = r.rec;
          if (r.bp) market.apply(day, [[t.location, good, r.bp]], pupils);
        },
      },
    };
    let t = { ...newTrader(galaxy, day), ship: 3, credits: 2_000 + Math.floor(random() * 3_000), location: Math.floor(random() * galaxy.planets.length) };
    t = startDay(galaxy, { ...t, fuel: 15, day: day - 1 }, day, market.pushes(day));
    for (let j = 0; j < JUMPS_PER_DAY && t.jumpsLeft > 0; j++) t = botJump(galaxy, t, `${seed}:${i}`, options, newStats(), random);
  }
}
