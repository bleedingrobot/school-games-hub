/**
 * Sky Races (docs/ISLES-PLAN.md, section 4; docs/ISLES-RULES.md): a friendly sky-boat race against a classmate's
 * island or the Gull Riders, a computer crew who are always free. Nobody ever loses anything: the winner gets a prize
 * and the other side a small "well raced" gift.
 *
 * The result comes only from the race's seed, the two racers (taken from the islands when the race starts) and how
 * many of the three race questions were marked right on the server. So the server can work it out at `raceFinish`,
 * the browser can show the same race, and nothing the browser sends can change who won.
 *
 * Each boat's speed is RACE_BASE plus its sky-boats (counted as a square root, so a big fleet helps less and less),
 * Swift Sails, happiness, one gust for each right answer (the side that wasn't asked gets HOME_WIND instead) and luck.
 * The faster boat wins; the result also says where each boat was at the end of every leg, for the animation.
 */
import { seededRandom } from '../maths/serverQuestions';
import {
  BOAT_SPEED, CALM_TURNS, FIRST_WIN_PRIZE, GULL_HAPPINESS, GUST_SPEED, HAPPY_SPEED, HOME_WIND, LATER_WIN_PRIZE,
  MOST_BOATS, MOST_CHALLENGED, RACE_BASE, RACE_LEGS, RACE_LUCK, RACE_QUESTIONS, RACES_PER_DAY, SAILS_SPEED,
  STARTER_LOW, STARTER_SPREAD, WELL_RACED_COINS,
} from './config';
import { has, type Island } from './engine';

/** The Gull Riders' id, used where a classmate's island id would go. */
export const GULL_RIDERS = 'gull-riders';

/** What a boat brings to a race, taken from its island when the race starts. */
export interface Racer {
  boats: number;
  swiftSails: boolean;
  happiness: number;
}

/** A boat's speed, part by part, so the result card can show the working. */
export interface Speed {
  boats: number;
  sails: number;
  happiness: number;
  /** Gusts from right answers (the challenger), or the home wind (the other side). */
  wind: number;
  luck: number;
  total: number;
}

export interface RaceResult {
  /** Did the challenger (the pupil who answered the questions) win? */
  won: boolean;
  you: Speed;
  them: Speed;
  /**
   * Where each boat is at the start and the end of every leg (RACE_LEGS + 1 numbers), from 0 at the start line to 1
   * at the finish. The winner reaches 1; the other boat ends just behind. The lead can change on the way.
   */
  youPath: number[];
  themPath: number[];
  /** The legs where the challenger's gusts blow (one for each right answer), for a puff of wind on screen. */
  gustLegs: number[];
}

/** The teacher's races switch is checked by the server, not here. */
export type RaceProblem =
  | 'no-turns'
  | 'raced-this-turn'
  | 'no-races-left'
  | 'raced-them-today'
  | 'calm-start'
  | 'challenged-enough'
  | 'own-island';

export function racerOf(island: Island): Racer {
  return { boats: island.boats, swiftSails: has(island, 'swift-sails'), happiness: island.happiness };
}

/** The Gull Riders' boat for this challenger: the same boats and sails, so a race against them is decided by the
 * gusts and a little luck. */
export function gullRiders(challenger: Racer): Racer {
  return { boats: challenger.boats, swiftSails: challenger.swiftSails, happiness: GULL_HAPPINESS };
}

/**
 * Why this island can't race this opponent now, or null if it can. `opponent` is a classmate's island (with its id),
 * or GULL_RIDERS, who are always free.
 */
export function raceProblem(island: Island, opponent: { id: string; island: Island } | typeof GULL_RIDERS, myId: string): RaceProblem | null {
  if (island.turnsLeft < 1) return 'no-turns';
  if (island.racesToday >= RACES_PER_DAY) return 'no-races-left';
  if (island.racedTurn === island.turn) return 'raced-this-turn';
  if (opponent === GULL_RIDERS) return null;
  if (opponent.id === myId) return 'own-island';
  if (island.racedWith.includes(opponent.id)) return 'raced-them-today';
  if (opponent.island.turn < CALM_TURNS) return 'calm-start';
  return opponent.island.challengedToday >= MOST_CHALLENGED ? 'challenged-enough' : null;
}

const clampRight = (right: number) => Math.max(0, Math.min(RACE_QUESTIONS, Math.floor(right)));

function speedParts(racer: Racer, wind: number, luck: number): Speed {
  const boats = BOAT_SPEED * Math.sqrt(Math.max(0, Math.min(MOST_BOATS, racer.boats)));
  const sails = racer.swiftSails ? SAILS_SPEED : 0;
  const happiness = (HAPPY_SPEED * Math.max(0, Math.min(100, racer.happiness))) / 100;
  return { boats, sails, happiness, wind, luck, total: RACE_BASE + boats + sails + happiness + wind + luck };
}

/** The legs the gusts blow on: spread out along the race (legs 2, 4 and 6 of 8). */
function gustLegsFor(right: number): number[] {
  return Array.from({ length: right }, (_, i) => Math.round(((i + 1) * RACE_LEGS) / (RACE_QUESTIONS + 1)) - 1);
}

/**
 * How far a boat has gone at the end of each leg. The steady part (everything but the gusts) is shared out over the
 * legs unevenly, so the boats bob back and forth; each gust is added on its own leg.
 */
function pathOf(steady: number, gustLegs: number[], random: () => number): number[] {
  const weights = Array.from({ length: RACE_LEGS }, () => 0.7 + random() * 0.6);
  const sum = weights.reduce((a, b) => a + b, 0);
  const path = [0];
  for (let leg = 0; leg < RACE_LEGS; leg++) {
    const gusts = gustLegs.filter((g) => g === leg).length * GUST_SPEED;
    path.push(path[leg] + (steady * weights[leg]) / sum + gusts);
  }
  return path;
}

function finish(you: Speed, them: Speed, gustLegs: number[], random: () => number): RaceResult {
  // A tie goes to the challenger.
  const won = you.total >= them.total;
  const lead = Math.max(you.total, them.total);
  const share = (d: number) => Math.round((d / lead) * 1000) / 1000;
  const youPath = pathOf(you.total - you.wind, gustLegs, random).map(share);
  const themPath = pathOf(them.total, [], random).map(share);
  return { won, you, them, youPath, themPath, gustLegs };
}

/**
 * Runs a race. `you` is the challenger (who answered the questions), `them` a classmate's island or `gullRiders(you)`,
 * and `right` how many of the race's questions the server marked right. The same seed, racers and `right` always give
 * the same race.
 */
export function runRace(seed: string, you: Racer, them: Racer, right: number): RaceResult {
  const random = seededRandom(`isles-race:${seed}`);
  const r = clampRight(right);
  const yours = speedParts(you, r * GUST_SPEED, random() * RACE_LUCK);
  const theirs = speedParts(them, HOME_WIND, random() * RACE_LUCK);
  return finish(yours, theirs, gustLegsFor(r), random);
}

/**
 * The first race, against the Gull Riders during turn 2's guide. It can't be lost, whatever the answers: the Gull
 * Riders take it easy and finish between STARTER_LOW and STARTER_LOW + STARTER_SPREAD of the pupil's speed, so it still
 * looks close.
 */
export function starterRace(seed: string, you: Racer, right: number): RaceResult {
  const random = seededRandom(`isles-starter:${seed}`);
  const r = clampRight(right);
  const yours = speedParts(you, r * GUST_SPEED, random() * RACE_LUCK);
  const gulls = speedParts(gullRiders(you), HOME_WIND, 0);
  const total = yours.total * (STARTER_LOW + random() * STARTER_SPREAD);
  // Their luck is whatever is left to make up that total (it can be below nothing: the gulls are taking it easy).
  const theirs = { ...gulls, luck: total - (gulls.total - gulls.luck), total };
  return finish(yours, theirs, gustLegsFor(r), random);
}

/** The prize for a win: the day's first win brings coins and goods, a later win coins. */
export function racePrize(winsToday: number): { coins: number; goods: number } {
  return winsToday === 0 ? { ...FIRST_WIN_PRIZE } : { ...LATER_WIN_PRIZE };
}

/**
 * The islands after a race. The challenger's race is counted (one a turn, RACES_PER_DAY a day, and never the same
 * classmate twice in a day). The winner gets the prize and the other side the "well raced" gift; nobody loses
 * anything. `defender` is the classmate's island, or null for the Gull Riders (they need no gift).
 */
export function settleRace(
  challenger: Island,
  defender: { id: string; island: Island } | null,
  result: Pick<RaceResult, 'won'>,
): { challenger: Island; defender: Island | null; prize: { coins: number; goods: number } } {
  let you: Island = {
    ...challenger,
    racesToday: challenger.racesToday + 1,
    racedTurn: challenger.turn,
    racedWith: defender ? [...challenger.racedWith, defender.id] : challenger.racedWith,
  };
  let them = defender ? { ...defender.island, challengedToday: defender.island.challengedToday + 1 } : null;
  let prize = { coins: 0, goods: 0 };
  if (result.won) {
    prize = racePrize(challenger.winsToday);
    you = { ...you, coins: you.coins + prize.coins, goods: you.goods + prize.goods, winsToday: you.winsToday + 1, racesWon: you.racesWon + 1 };
    if (them) them = { ...them, coins: them.coins + WELL_RACED_COINS };
  } else {
    you = { ...you, coins: you.coins + WELL_RACED_COINS };
    // A classmate who wins at home gets the same win as the challenger would: race points, not a prize.
    if (them) them = { ...them, racesWon: them.racesWon + 1 };
  }
  return { challenger: you, defender: them, prize };
}
