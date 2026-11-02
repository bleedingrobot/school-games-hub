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
 *
 * The questions come during the race: the boats sail a stretch, stop for a question, and a right answer blows a gust
 * on the next stretch. The server sends one stretch at a time (`raceSoFar`), and what it has shown never depends on an
 * answer not yet given, so the finished race always starts with exactly the stretches already seen.
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
   * at the finish. The winner reaches 1; the other boat ends just behind. The lead can change on the way, but only
   * towards the steadily faster boat, or with a gust (see pathsOf).
   */
  youPath: number[];
  themPath: number[];
  /** The legs where the challenger's gusts blow (the first leg after each question answered right), for a puff of
   * wind on screen. */
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

/**
 * Where the race stops for each question: the leg each stop comes after, spread evenly (with 3 questions and 8 legs,
 * after legs 2, 4 and 6, so a quarter, a half and three quarters of the way). Stop k is at k / (RACE_QUESTIONS + 1).
 */
export const RACE_STOPS: number[] = Array.from({ length: RACE_QUESTIONS }, (_, i) => Math.round(((i + 1) * RACE_LEGS) / (RACE_QUESTIONS + 1)));

/** The last path point the browser may see once `answered` questions are marked: the next stop (at most the last stop;
 * the last stretch comes with the result). */
export const shownUpTo = (answered: number) => RACE_STOPS[Math.min(Math.max(0, answered), RACE_QUESTIONS - 1)];

/** What has been shown of a race so far: the start of the finished race's paths. */
export interface RaceSoFar {
  youPath: number[];
  themPath: number[];
  gustLegs: number[];
}

/** The answers in order (true for right). A number n means the first n were right (the simulator and the tests). */
function marksOf(right: number | boolean[]): boolean[] {
  const given = typeof right === 'number' ? Array.from({ length: clampRight(right) }, () => true) : right;
  return Array.from({ length: RACE_QUESTIONS }, (_, i) => given[i] === true);
}

/** A boat's speed with no wind yet: what is known about the challenger before any question is answered. */
const steadyOf = (speed: Speed) => speed.total - speed.wind;

/**
 * The paths of a race, in a way that never shows more than is known.
 *
 * - Both boats share one set of leg weights (the wind is gusty for everyone at once), and each stretch between stops
 *   is exactly 1 / (RACE_QUESTIONS + 1) of a boat's steady speed. So between two points the gap only ever moves towards
 *   the boat with the higher steady speed, or towards the challenger when a gust blows: the leader is only overtaken
 *   by a boat that has been catching up all race, or by a gust you can see.
 * - Question k's gust (if it was right) blows on the first leg after stop k, and nowhere else.
 * - Up to the last stop, positions are distances over a course length fixed at the start: as far as either boat could
 *   possibly go (the challenger with every gust). Nothing in them depends on a question not yet answered.
 * - On the last stretch (every answer known), the course shrinks smoothly to the winner's distance, so the winner
 *   reaches the finish line exactly and nobody moves backwards.
 *
 * `theirs` gives the other boat's distance from the challenger's steady distance, gusts so far and gusts in all.
 */
function pathsOf(you: Speed, marks: boolean[], longest: number, lead: number, random: () => number,
  theirs: (share: number, gustsSoFar: number, legsLeft: number) => number): RaceSoFar {
  const stops = [0, ...RACE_STOPS, RACE_LEGS];
  const weights = Array.from({ length: RACE_LEGS }, () => 0.7 + random() * 0.6);
  // The share of the steady speed done by the end of each leg.
  const done = [0];
  for (let s = 0; s + 1 < stops.length; s++) {
    const sum = weights.slice(stops[s], stops[s + 1]).reduce((a, b) => a + b, 0);
    for (let leg = stops[s]; leg < stops[s + 1]; leg++) done.push(done[leg] + weights[leg] / sum / (RACE_QUESTIONS + 1));
  }
  const gustLegs = RACE_STOPS.filter((_, i) => marks[i]);
  const last = RACE_STOPS[RACE_QUESTIONS - 1];
  const round = (x: number) => Math.round(x * 1000) / 1000;
  const youPath: number[] = [];
  const themPath: number[] = [];
  let gusts = 0;
  for (let point = 0; point <= RACE_LEGS; point++) {
    if (point > 0 && gustLegs.includes(point - 1)) gusts += GUST_SPEED;
    const share = point === RACE_LEGS ? 1 : done[point];
    const length = point <= last ? longest : longest + ((lead - longest) * (point - last)) / (RACE_LEGS - last);
    youPath.push(round((steadyOf(you) * share + gusts) / length));
    themPath.push(round(theirs(share, gusts, (point - last) / (RACE_LEGS - last)) / length));
  }
  return { youPath, themPath, gustLegs };
}

/**
 * Runs a race. `you` is the challenger (who answered the questions), `them` a classmate's island or `gullRiders(you)`,
 * and `right` the answers the server marked, in order (or how many were right). The winner and the prize depend only on
 * how many were right; which ones only moves the gusts. The same seed, racers and answers always give the same race.
 */
export function runRace(seed: string, you: Racer, them: Racer, right: number | boolean[]): RaceResult {
  const random = seededRandom(`isles-race:${seed}`);
  const marks = marksOf(right);
  const r = marks.filter(Boolean).length;
  const yours = speedParts(you, r * GUST_SPEED, random() * RACE_LUCK);
  const theirs = speedParts(them, HOME_WIND, random() * RACE_LUCK);
  // A tie goes to the challenger.
  const won = yours.total >= theirs.total;
  const longest = Math.max(steadyOf(yours) + RACE_QUESTIONS * GUST_SPEED, theirs.total);
  const paths = pathsOf(yours, marks, longest, Math.max(yours.total, theirs.total), random, (share) => theirs.total * share);
  return { won, you: yours, them: theirs, ...paths };
}

/**
 * The first race, against the Gull Riders during turn 2's guide. It can't be lost, whatever the answers: the Gull
 * Riders take it easy and finish between STARTER_LOW and STARTER_LOW + STARTER_SPREAD of the pupil's speed, so it still
 * looks close. On the way they keep that share of the pupil's steady speed, and catch up that share of the pupil's
 * gusts on the last stretch, so they are always just behind.
 */
export function starterRace(seed: string, you: Racer, right: number | boolean[]): RaceResult {
  const random = seededRandom(`isles-starter:${seed}`);
  const marks = marksOf(right);
  const r = marks.filter(Boolean).length;
  const yours = speedParts(you, r * GUST_SPEED, random() * RACE_LUCK);
  const gulls = speedParts(gullRiders(you), HOME_WIND, 0);
  const easy = STARTER_LOW + random() * STARTER_SPREAD;
  const total = yours.total * easy;
  // Their luck is whatever is left to make up that total (it can be below nothing: the gulls are taking it easy).
  const theirs = { ...gulls, luck: total - (gulls.total - gulls.luck), total };
  const longest = steadyOf(yours) + RACE_QUESTIONS * GUST_SPEED;
  const paths = pathsOf(yours, marks, longest, yours.total, random,
    (share, _gusts, lastStretch) => easy * (steadyOf(yours) * share + yours.wind * Math.max(0, lastStretch)));
  return { won: true, you: yours, them: theirs, ...paths };
}

/**
 * What the browser may see of an open race, with `marks` the answers marked so far (in order): the paths up to the next
 * stop. They are the start of the finished race's paths whatever the later answers are (test 3 and the rules tests).
 */
export function raceSoFar(seed: string, you: Racer, them: Racer, starter: boolean, marks: boolean[]): RaceSoFar {
  const race = starter ? starterRace(seed, you, marks) : runRace(seed, you, them, marks);
  const upTo = shownUpTo(marks.length);
  return { youPath: race.youPath.slice(0, upTo + 1), themPath: race.themPath.slice(0, upTo + 1), gustLegs: race.gustLegs.filter((leg) => leg < upTo) };
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
