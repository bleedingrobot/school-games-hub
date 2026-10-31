/**
 * What the server does with Star Trader moves (docs/TRADER-PLAN.md, section 10). Everything that counts is worked out
 * here with the shared rules, on the game the server keeps, so the browser can never give itself money, cargo, fuel,
 * jumps or a discount. The screens run the very same functions to show what will happen.
 *
 * A pupil's saved game is a `Game`: the trader (ship, cargo, money ...), the one thing that is happening now (`pending`:
 * space junk, a friendly trader's offer, or a pirate fight), and how many of today's maths questions have been used.
 * Maths questions are used strictly in order (`asked`), and each answer is marked by the server (`mark`).
 */
import { BIG_TRADE_CREDITS, GOODS, JUMPS_PER_DAY, SHIELDS, SHIPS, WEAPONS } from './config';
import { acceptDeal, encounterFor, settleCustoms, settleJunk, type Encounter } from './encounter';
import { fightRound, laserPower, settleFight, startFight, type Fight, type FightAction } from './fight';
import type { Galaxy } from './galaxy';
import { discountFor, runPlan } from './plan';
import { pupilPush, tidyPushes, type MarketPush, type PupilPushes, type Pushes } from './schoolMarket';
import {
  borrow,
  buyMoon,
  buyPod,
  buyShield,
  buyShip,
  buyWeapon,
  netWorth,
  newTrader,
  refuel,
  repair,
  repay,
  startDay,
  travel,
  type Result,
  type Trader,
} from './state';

export type Deal = Extract<Encounter, { kind: 'trader' }>;

export type Pending = { kind: 'junk' } | { kind: 'deal'; offer: Deal } | { kind: 'fight'; tier: number; fight: Fight };

/** Counts kept for points, achievements and the board (T.5). */
export interface Stats {
  jumps: number;
  profitableJumps: number;
  piratesBeaten: number;
  wrecks: number;
}

export interface Game {
  t: Trader;
  pending: Pending | null;
  /** How many of today's questions have been used. The next question is number `asked`. */
  asked: number;
  stats: Stats;
  /** How far this pupil has pushed each price today (their 20% a day limit). Missing in a game that has not traded yet. */
  pushed?: PupilPushes;
}

/** The teacher's settings for the pupil's class, and whether maths is on for them. */
export interface Settings {
  jumpsPerDay: number;
  loans: boolean;
  /** Maths checks are on. When off, checks are skipped: laser shots are full power and junk is steered safely. */
  maths: boolean;
}

export const DEFAULT_SETTINGS: Settings = { jumpsPerDay: JUMPS_PER_DAY, loans: true, maths: true };

/** An answer sent with a move: the question's slot (it must be the next one), the number typed, how long it took. */
export interface Ask {
  slot: number;
  value: number;
  ms: number;
}

/** What the server tells the pupil about an answer. */
export interface Marked {
  slot: number;
  right: boolean;
  answer: number;
  ms: number;
}

/** Marks an answer against the day's stored list and claims the slot. Null if there is no such question or it was already used. */
export type Mark = (slot: number, value: number) => { right: boolean; answer: number } | null;

export type Action =
  | { type: 'trade'; plan: number[]; ask?: Ask }
  | { type: 'refuel'; units: number }
  | { type: 'repair'; points: number }
  | { type: 'buyShip'; ship: number }
  | { type: 'buyWeapon'; index: number }
  | { type: 'buyShield'; index: number }
  | { type: 'buyPod' }
  | { type: 'borrow'; amount: number }
  | { type: 'repay'; amount: number }
  | { type: 'moon' }
  | { type: 'jump'; dest: number };

export interface Outcome {
  game: Game;
  /** The answers marked in this request, in order. */
  answers: Marked[];
  /** A jump's encounter, for showing (the server has already acted on it). */
  encounter?: Encounter;
  /** Customs took something. */
  customs?: { taken: number; fine: number };
  /** A fight round's result; `over` when the fight has ended and been settled. */
  fight?: { fight: Fight; tier: number; over: boolean };
  /** What a trade came to. */
  trade?: { spent: number; earned: number; sharp: boolean };
  /** Space junk steered well, or not. */
  junk?: { steeredWell: boolean };
  /** A friendly trader's deal taken or not. */
  deal?: { took: boolean };
  /** What this request's trades do to the school's market (after the pupil's daily limit). Saved with the game, never sent to the pupil. */
  pushes?: MarketPush[];
}

export type Reply = ({ ok: true } & Outcome) | { ok: false; reason: string };

class Refused extends Error {}
const refuse = (reason: string): never => {
  throw new Refused(reason);
};
const must = <T>(r: Result<T>): T => (r.ok ? r.state : refuse(r.reason));
const int = (n: unknown, lo: number, hi: number): number => (typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi ? n : refuse('That could not be read.'));

const copy = (g: Game): Game => structuredClone(g);

export function newGame(galaxy: Galaxy, day: number, settings: Settings, pushes?: Pushes): Game {
  const t = newTrader(galaxy, day, pushes);
  t.jumpsLeft = settings.jumpsPerDay;
  return { t, pending: null, asked: 0, stats: { jumps: 0, profitableJumps: 0, piratesBeaten: 0, wrecks: 0 } };
}

/** The first thing on a new day: jumps back, prices read again, interest, new questions. A half-finished event is dropped. */
export function rollDay(galaxy: Galaxy, game: Game, day: number, settings: Settings, pushes?: Pushes): Game {
  if (game.t.day >= day) return game;
  const t = startDay(galaxy, game.t, day, pushes);
  t.jumpsLeft = settings.jumpsPerDay;
  return { ...copy(game), t, pending: null, asked: 0 };
}

export const netWorthOf = (galaxy: Galaxy, game: Game): number => netWorth(galaxy, game.t);

/** The next question's number, or null if today's list is used up. */
export const nextSlot = (game: Game, total: number): number | null => (game.asked < total ? game.asked : null);

/** Uses an answer sent with a move. Null when there is none (or maths is off). */
function takeAsk(g: Game, ask: Ask | undefined, settings: Settings, mark: Mark, answers: Marked[]): { right: boolean } | null {
  if (!ask || !settings.maths) return null;
  if (ask.slot !== g.asked) refuse('That question is not the next one.');
  if (typeof ask.value !== 'number' || !Number.isFinite(ask.value) || ask.value < 0 || ask.value > 1_000_000) refuse('That answer could not be read.');
  const r = mark(ask.slot, ask.value) ?? refuse('That question has been used.');
  g.asked += 1;
  const ms = Math.round(Math.min(Math.max(typeof ask.ms === 'number' && Number.isFinite(ask.ms) ? ask.ms : 120_000, 0), 120_000));
  answers.push({ slot: ask.slot, right: r.right, answer: r.answer, ms });
  return { right: r.right };
}

/**
 * Apply the moves in order. If any one is refused, none are kept and the reason is given. `pushes` is the school's
 * market today, read when a jump lands (none: normal prices).
 */
export function applyBatch(galaxy: Galaxy, galaxySeed: string, game: Game, actions: readonly Action[], settings: Settings, mark: Mark, pushes?: Pushes): Reply {
  try {
    const g = copy(game);
    const out: Outcome = { game: g, answers: [] };
    const market: MarketPush[] = [];
    for (const action of actions) {
      if (g.pending) refuse('Finish what is happening first.');
      step(galaxy, galaxySeed, g, action, settings, mark, out, market, pushes);
    }
    if (market.length) out.pushes = tidyPushes(market);
    return { ok: true, ...out };
  } catch (e) {
    if (e instanceof Refused) return { ok: false, reason: e.message };
    throw e;
  }
}

/** A trade moves the school's prices at this planet: selling pushes down, buying pushes up, within the pupil's daily limit. */
function recordPushes(g: Game, plan: readonly number[], market: MarketPush[]): void {
  const t = g.t;
  for (let good = 0; good < plan.length; good++) {
    if (!plan[good]) continue;
    const r = pupilPush(g.pushed, t.day, t.location, good, plan[good]);
    g.pushed = r.rec;
    if (r.bp) market.push([t.location, good, r.bp]);
  }
}

function step(galaxy: Galaxy, seed: string, g: Game, action: Action, settings: Settings, mark: Mark, out: Outcome, market: MarketPush[], pushes?: Pushes): void {
  const t = g.t;
  switch (action.type) {
    case 'trade': {
      const plan = action.plan;
      if (!Array.isArray(plan) || plan.length !== GOODS.length) refuse('That trade could not be read.');
      plan.forEach((q) => int(q, -500, 500));
      const base = runPlan(t, plan);
      if (!base.ok) return refuse(base.reason);
      const worth = base.out.spent + base.out.earned;
      const checked = takeAsk(g, action.ask, settings, mark, out.answers);
      const sharp = checked?.right === true;
      const bp = sharp ? discountFor(worth) : 0;
      const done = runPlan(t, plan, bp, bp);
      if (!done.ok) return refuse(done.reason);
      g.t = done.out.state;
      out.trade = { spent: done.out.spent, earned: done.out.earned, sharp };
      recordPushes(g, plan, market);
      return;
    }
    case 'refuel':
      g.t = must(refuel(t, int(action.units, 1, 100)));
      return;
    case 'repair':
      g.t = must(repair(t, int(action.points, 1, 500)));
      return;
    case 'buyShip':
      g.t = must(buyShip(galaxy, t, int(action.ship, 0, SHIPS.length - 1)));
      return;
    case 'buyWeapon':
      g.t = must(buyWeapon(galaxy, t, int(action.index, 0, WEAPONS.length - 1)));
      return;
    case 'buyShield':
      g.t = must(buyShield(galaxy, t, int(action.index, 0, SHIELDS.length - 1)));
      return;
    case 'buyPod':
      g.t = must(buyPod(galaxy, t));
      return;
    case 'borrow':
      if (!settings.loans) refuse('The bank is closed.');
      g.t = must(borrow(t, int(action.amount, 1, 500)));
      return;
    case 'repay':
      g.t = must(repay(t, int(action.amount, 1, 100_000)));
      return;
    case 'moon':
      g.t = must(buyMoon(galaxy, t));
      return;
    case 'jump': {
      const worthBefore = netWorth(galaxy, t);
      g.t = must(travel(galaxy, t, int(action.dest, 0, galaxy.planets.length - 1), pushes));
      g.stats.jumps += 1;
      const e = encounterFor(galaxy, g.t, seed);
      out.encounter = e;
      if (e.kind === 'junk') g.pending = { kind: 'junk' };
      else if (e.kind === 'customs') {
        const res = settleCustoms(g.t, e.banned);
        g.t = res.state;
        out.customs = { taken: res.taken, fine: res.fine };
      } else if (e.kind === 'pirates') g.pending = { kind: 'fight', tier: e.tier, fight: startFight(g.t, e.tier, `${seed}:${g.t.jumpNo}`) };
      else if (e.kind === 'trader') g.pending = { kind: 'deal', offer: e };
      if (netWorth(galaxy, g.t) > worthBefore) g.stats.profitableJumps += 1;
      return;
    }
    default:
      refuse('That could not be read.');
  }
}

/** One round of the pirate fight in progress. Charging the lasers is the only round with a maths check. */
export function applyFight(game: Game, action: FightAction, ask: Ask | undefined, settings: Settings, mark: Mark): Reply {
  try {
    const g = copy(game);
    if (g.pending?.kind !== 'fight') refuse('There is no fight.');
    const { tier, fight } = g.pending as Extract<Pending, { kind: 'fight' }>;
    if (action !== 'charge' && action !== 'shield' && action !== 'flee') refuse('That could not be read.');
    if (action === 'charge' && laserPower(g.t) <= 0) refuse('Your ship has no lasers.');
    const answers: Marked[] = [];
    // Maths off: the lasers are always fully charged. A skipped question: half power.
    let right = action === 'charge' && !settings.maths;
    if (action === 'charge' && settings.maths) right = takeAsk(g, ask, settings, mark, answers)?.right === true;
    const next = fightRound(g.t, fight, action, right);
    const over = next.outcome !== 'going';
    if (over) {
      if (next.outcome === 'won') g.stats.piratesBeaten += 1;
      if (next.outcome === 'destroyed') g.stats.wrecks += 1;
      g.t = settleFight(g.t, next);
      g.pending = null;
    } else g.pending = { kind: 'fight', tier, fight: next };
    return { ok: true, game: g, answers, fight: { fight: next, tier, over } };
  } catch (e) {
    if (e instanceof Refused) return { ok: false, reason: e.message };
    throw e;
  }
}

/** Space junk: steer through (a right answer) or take a little damage. Maths off: always steered well. */
export function applyJunk(game: Game, ask: Ask | undefined, settings: Settings, mark: Mark): Reply {
  try {
    const g = copy(game);
    if (g.pending?.kind !== 'junk') refuse('There is no space junk.');
    const answers: Marked[] = [];
    const checked = takeAsk(g, ask, settings, mark, answers);
    const steeredWell = !settings.maths || checked?.right === true;
    g.t = settleJunk(g.t, steeredWell);
    g.pending = null;
    return { ok: true, game: g, answers, junk: { steeredWell } };
  } catch (e) {
    if (e instanceof Refused) return { ok: false, reason: e.message };
    throw e;
  }
}

/** A friendly trader's offer: take it or leave it. */
export function applyDeal(game: Game, take: boolean): Reply {
  const g = copy(game);
  if (g.pending?.kind !== 'deal') return { ok: false, reason: 'There is no offer.' };
  const offer = g.pending.offer;
  let took = false;
  if (take) {
    const next = acceptDeal(g.t, offer);
    if (!next) return { ok: false, reason: 'You could not take that deal (not enough money or room in the hold).' };
    g.t = next;
    took = true;
  }
  g.pending = null;
  return { ok: true, game: g, answers: [], deal: { took } };
}

/** True if a trade this size always asks a question (kept in step with the screen). */
export const alwaysAsks = (worth: number): boolean => worth >= BIG_TRADE_CREDITS;
