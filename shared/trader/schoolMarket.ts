/**
 * The school's shared market (docs/TRADER-PLAN.md, sections 8 and 20). One market per school: when pupils sell lots of a
 * good on a planet its price there drops for everyone, and when they buy lots it rises. Overnight it drifts back.
 *
 * A "push" is how far a price is moved from that day's normal price, in hundredths of a percent (-1000 = 10% cheaper).
 * The database keeps one push per school, planet and good, with the day it was last changed; everything else is worked
 * out from that, so nothing has to run at midnight.
 *
 * Guard rails (numbers in config.ts):
 *  - one pupil's trades move a price at one planet by at most MARKET_PUPIL_CAP_BP a day (kept in the pupil's own game);
 *  - the market is as deep as the school is big: each push is divided by the pupils who played in the last week (at
 *    least MARKET_MIN_DEPTH), so a whole school moves a price about as much as one pupil alone would;
 *  - however many pupils trade, a push stays within MARKET_CAP_BP of normal (the database applies this in one step);
 *  - a pupil's prices are fixed when they land, so the market only moves for those who land after.
 *
 * `SchoolMarket` is the same rules as the database functions trader_push_market / trader_market, for the preview and the
 * simulator. The database tests check the SQL gives the same numbers.
 */
import { GOODS, GOOD_RULES, MARKET_CAP_BP, MARKET_FULL_STOCK_BP, MARKET_KEEP_PCT, MARKET_MIN_DEPTH, MARKET_NEWS_BP, MARKET_PUPIL_CAP_BP, MARKET_QUIET_BP } from './config';
import type { MarketLine } from './market';

/** The push on each good at a planet today (null or missing = no push). */
export type Pushes = (planet: number) => readonly number[] | null;

/** One change to the school's market: [planet, good, push]. */
export type MarketPush = [planet: number, good: number, bp: number];

/** What the server reads from the database: today's pushes [planet, good, push, moved today] and recent news rows [day, planet, good, direction]. */
export interface SchoolView {
  pushes: [planet: number, good: number, push: number, moved: number][];
  news: [day: number, planet: number, good: number, direction: number][];
}

export const EMPTY_VIEW: SchoolView = { pushes: [], news: [] };

/** The numbers the database is handed with each change, so config.ts is the one place they live. */
export interface MarketRules {
  cap: number;
  keep: number;
  news: number;
  /** The smallest depth (see config.ts, MARKET_MIN_DEPTH). */
  depth: number;
  /** The quiet zone (config.ts, MARKET_QUIET_BP). Used on reading only; the database stores the whole push. */
  quiet: number;
}
export const MARKET_RULES: MarketRules = { cap: MARKET_CAP_BP, keep: MARKET_KEEP_PCT, news: MARKET_NEWS_BP, depth: MARKET_MIN_DEPTH, quiet: MARKET_QUIET_BP };

/** How much a stored push moves the price: nothing inside the quiet zone, then the rest. */
export const priceMove = (push: number, quiet = MARKET_QUIET_BP): number => Math.sign(push) * Math.max(0, Math.abs(push) - quiet) || 0;

/** Pushes are stored in hundredths of a hundredth of a percent, so a small trade in a big school isn't rounded away. */
export const FINE = 100;

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/** A push after the nights from `fromDay` to `toDay`: it keeps `keep` percent each night, rounded towards zero (the same as SQL's whole-number divide). Works on any unit. */
export function drift(push: number, fromDay: number, toDay: number, keep = MARKET_KEEP_PCT): number {
  let p = push;
  for (let d = fromDay; d < toDay && p !== 0; d++) {
    if (toDay - d > 40) return 0;
    p = Math.trunc((p * keep) / 100);
  }
  return p || 0;
}

/** A market line moved by a push. Prices never go below 1 credit, and buying always costs more than selling. */
export function pushedLine(line: MarketLine, bp: number): MarketLine {
  if (!bp || (line.sell <= 0 && line.buy <= 0)) return line;
  const move = (price: number): number => Math.max(1, Math.floor((price * (10_000 + bp)) / 10_000));
  const sell = line.sell > 0 ? move(line.sell) : 0;
  const buy = line.buy > 0 ? Math.max(sell + 1, move(line.buy)) : 0;
  return { ...line, sell, buy };
}

/** The per-pupil numbers (config.ts), in one object so the simulator can try others. */
export interface PupilLimits {
  /** A whole normal day's stock moves a price this much. */
  full: number;
  /** One pupil moves a price at one planet at most this much a day, after the depth divides it (so this times MARKET_MIN_DEPTH before). */
  pupilCap: number;
}
export const PUPIL_LIMITS: PupilLimits = { full: MARKET_FULL_STOCK_BP, pupilCap: MARKET_PUPIL_CAP_BP };

/** How far one unit moves a price: a whole normal day's stock moves it `full`. */
export const pushPerUnit = (good: number, full = MARKET_FULL_STOCK_BP): number => Math.max(1, Math.round(full / GOOD_RULES[good].stock));

/** The pushes one pupil has made today, kept in their saved game: "planet:good" -> push. */
export interface PupilPushes {
  day: number;
  bp: Record<string, number>;
}

/**
 * A pupil trades `qty` of a good at a planet (positive = bought, negative = sold). Gives the push that reaches the
 * school's market, after the pupil's own daily limit, and their updated record. Nothing is refused: once a pupil has
 * moved a price as far as they can, it just stops moving.
 */
export function pupilPush(rec: PupilPushes | undefined, day: number, planet: number, good: number, qty: number, limits: PupilLimits = PUPIL_LIMITS): { rec: PupilPushes; bp: number } {
  const next: PupilPushes = rec && rec.day === day ? { day, bp: { ...rec.bp } } : { day, bp: {} };
  const key = `${planet}:${good}`;
  const before = next.bp[key] ?? 0;
  // The record is kept before the depth divides it; even in the smallest school (depth MARKET_MIN_DEPTH) one pupil moves a price at most pupilCap.
  const raw = limits.pupilCap * MARKET_MIN_DEPTH;
  const after = clamp(before + qty * pushPerUnit(good, limits.full), -raw, raw);
  if (after !== 0) next.bp[key] = after;
  else delete next.bp[key];
  return { rec: next, bp: after - before };
}

/** Adds up pushes on the same planet and good, drops zeros, and sorts them (so every request locks rows in the same order). */
export function tidyPushes(list: readonly MarketPush[]): MarketPush[] {
  const sums = new Map<string, MarketPush>();
  for (const [planet, good, bp] of list) {
    const key = `${planet}:${good}`;
    const cur = sums.get(key);
    sums.set(key, [planet, good, (cur?.[2] ?? 0) + bp]);
  }
  return [...sums.values()].filter((p) => p[2] !== 0).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** Turns what was read from the database into "the pushes at a planet". */
export function pushesFrom(view: SchoolView, quiet = MARKET_QUIET_BP): Pushes {
  const byPlanet = new Map<number, number[]>();
  for (const [planet, good, push] of view.pushes) {
    if (!Number.isInteger(planet) || !Number.isInteger(good) || good < 0 || good >= GOODS.length) continue;
    let row = byPlanet.get(planet);
    if (!row) byPlanet.set(planet, (row = GOODS.map(() => 0)));
    row[good] = priceMove(clamp(Math.trunc(push), -MARKET_CAP_BP, MARKET_CAP_BP), quiet);
  }
  return (planet) => byPlanet.get(planet) ?? null;
}

/** A stored (fine) push as hundredths of a percent, rounded towards zero (SQL's whole-number divide). */
const toBp = (fine: number): number => Math.trunc(fine / FINE) || 0;

interface Row {
  push: number;
  moved: number;
  day: number;
}

/** The school's market kept in memory, with exactly the database's rules (for the preview and the simulator). */
export class SchoolMarket {
  private rows = new Map<string, Row>();
  private newsRows = new Map<string, [number, number, number, number]>();

  constructor(private rules: MarketRules = MARKET_RULES) {}

  /**
   * The same as trader_push_market: each pupil push is divided by the school's depth (pupils who played in the last week,
   * at least `rules.depth`), added to the drifted push, kept within the cap; news when it has moved a lot today.
   */
  apply(today: number, pushes: readonly MarketPush[], activePupils = 1): void {
    const { cap, keep, news } = this.rules;
    const depth = Math.max(this.rules.depth, activePupils);
    for (const [planet, good, bp] of tidyPushes(pushes)) {
      const delta = Math.trunc((bp * FINE) / depth);
      if (!delta) continue;
      const key = `${planet}:${good}`;
      const row = this.rows.get(key);
      const base = row ? drift(row.push, row.day, today, keep) : 0;
      const push = clamp(base + delta, -cap * FINE, cap * FINE);
      const moved = (row && row.day >= today ? row.moved : 0) + (push - base);
      this.rows.set(key, { push, moved, day: Math.max(today, row?.day ?? today) });
      if (Math.abs(moved) >= news * FINE) this.newsRows.set(`${today}:${key}`, [today, planet, good, moved < 0 ? -1 : 1]);
    }
  }

  /** The push on one good at one planet today (hundredths of a percent). */
  pushOf(planet: number, good: number, today: number): number {
    const row = this.rows.get(`${planet}:${good}`);
    return row ? toBp(drift(row.push, row.day, today, this.rules.keep)) : 0;
  }

  /** How much the price of one good at one planet is moved today (the push less the quiet zone). */
  moveOf(planet: number, good: number, today: number): number {
    return priceMove(this.pushOf(planet, good, today), this.rules.quiet);
  }

  /** The price moves at every planet today (for landing prices). */
  pushes(today: number): Pushes {
    return (planet) => {
      let any = false;
      const out = GOODS.map((_, good) => {
        const p = this.moveOf(planet, good, today);
        if (p) any = true;
        return p;
      });
      return any ? out : null;
    };
  }

  /** The same as trader_market: today's pushes and the news rows for today and yesterday. */
  view(today: number): SchoolView {
    const pushes: SchoolView['pushes'] = [];
    for (const [key, row] of this.rows) {
      const push = toBp(drift(row.push, row.day, today, this.rules.keep));
      if (push === 0) continue;
      const [planet, good] = key.split(':').map(Number);
      pushes.push([planet, good, push, row.day === today ? toBp(row.moved) : 0]);
    }
    pushes.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const news = [...this.newsRows.values()].filter((n) => n[0] === today || n[0] === today - 1).sort((a, b) => b[0] - a[0] || a[1] - b[1] || a[2] - b[2]);
    return { pushes, news };
  }

  /** Every push as it is stored (for the simulator's reports). */
  stored(today: number): number[] {
    return [...this.rows.values()].map((r) => toBp(drift(r.push, r.day, today, this.rules.keep)));
  }

  clear(): void {
    this.rows.clear();
    this.newsRows.clear();
  }
}
