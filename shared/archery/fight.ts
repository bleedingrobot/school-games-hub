/**
 * Turns, rounds and fights (docs/ARCHERY-PLAN.md, section 2). A fight is a seed, what each player
 * brought, and a list of shots. `playFight` plays them all and gives the whole result: every
 * shot's landing, the damage, who won each round and the fight, and which arrows each player
 * used. The server replays fights with exactly this (Stage 4) to count the arrows used.
 *
 * Players take turns. Each round has fresh land and new wind from the seed, and the first turn
 * swaps each round (player 0 starts round 1). A round ends when one archer is left (both popping
 * at once is a draw), or after MAX_SHOTS_PER_ROUND, when more health wins. First to win
 * ROUNDS_TO_WIN rounds wins the fight.
 */
import { arrowKind, impact, isArrowId, usable, type ImpactContext } from './arrows';
import { MAX_ANGLE, MAX_POWER, MAX_ROUNDS, MAX_SHOTS_PER_ROUND, ROUNDS_TO_WIN, WIND_MAX } from './config';
import { blastDamage, capShotDamage, fallDamage, hurt } from './damage';
import { addDirt, carve, copyLand, dropArcher, makeRoundLand, settle } from './land';
import { makeRandom, mixSeed } from './random';
import { flyArrow } from './shot';
import type { Archer, ArrowId, FightResult, FightSetup, Round, RoundResult, Shot, ShotRecord } from './types';

const copyArcher = (a: Archer): Archer => ({ ...a });

/** The seed for a round's land, and its wind. */
export function roundSeeds(seed: number, index: number): { landSeed: number; wind: number } {
  const landSeed = mixSeed(seed, 1000 + index);
  const wind = makeRandom(mixSeed(seed, 2000 + index)).range(-WIND_MAX, WIND_MAX);
  return { landSeed, wind };
}

/** Starts round `index` of a fight. */
export function newRound(seed: number, index: number, setup: FightSetup): Round {
  const { landSeed, wind } = roundSeeds(seed, index);
  const { land, archers } = makeRoundLand(landSeed);
  archers[0].shield = setup.players[0].shield;
  archers[1].shield = setup.players[1].shield;
  return { index, landSeed, wind, land, archers, turn: index % 2, shots: 0, winner: null };
}

/**
 * Plays one shot by `player` in the round (changing the round's land and archers):
 * the flight, the arrow's landing, loose dirt falling, archers falling, then the damage,
 * at most MAX_SHOT_DAMAGE per archer. Doesn't change whose turn it is.
 */
export function playShot(round: Round, player: number, shot: Shot, keepPath = false): ShotRecord {
  const { land, archers } = round;
  const arrow = arrowKind(shot.arrow);
  const flight = flyArrow(land, archers, player, shot, round.wind);
  const raw = [0, 0];
  let c0 = Infinity;
  let c1 = -Infinity;
  const touched = ([a, b]: [number, number]) => {
    if (a < c0) c0 = a;
    if (b > c1) c1 = b;
  };
  const ctx: ImpactContext = {
    land, archers, shooter: player, hit: flight.hit, arrow,
    blast(x, y, radius, peak) {
      for (let i = 0; i < archers.length; i++) if (!archers[i].popped) raw[i] += blastDamage(archers[i], x, y, radius, peak);
      if (radius > 0) touched(carve(land, x, y, radius));
    },
    dirt(x, y, radius) {
      if (radius > 0) touched(addDirt(land, x, y, radius));
    },
    bonus(i, amount) {
      if (!archers[i].popped) raw[i] += amount;
    },
  };
  impact(ctx);
  if (c1 >= c0) settle(land, c0, c1);
  const fell: [number, number] = [0, 0];
  for (let i = 0; i < archers.length; i++) {
    if (archers[i].popped) continue;
    fell[i] = dropArcher(land, archers[i]);
    raw[i] += fallDamage(fell[i]);
  }
  const damage: [number, number] = [0, 0];
  for (let i = 0; i < archers.length; i++) damage[i] = hurt(archers[i], capShotDamage(raw[i]));
  round.shots++;
  const record: ShotRecord = {
    round: round.index, player, shot: { ...shot }, wind: round.wind, hit: flight.hit, damage, fell,
    after: [copyArcher(archers[0]), copyArcher(archers[1])],
  };
  if (keepPath) record.path = flight.path;
  return record;
}

/** Who won the round so far: null while it's still going. */
export function roundWinner(round: Round): 0 | 1 | 'draw' | null {
  const [a, b] = round.archers;
  if (a.popped && b.popped) return 'draw';
  if (a.popped) return 1;
  if (b.popped) return 0;
  if (round.shots >= MAX_SHOTS_PER_ROUND) {
    const ha = a.health + a.shield, hb = b.health + b.shield;
    return ha > hb ? 0 : hb > ha ? 1 : 'draw';
  }
  return null;
}

/** Why a shot can't be played, or null if it's fine. `used` is what the player has already shot. */
export function shotProblem(shot: Shot, setup: FightSetup, player: number, used: Partial<Record<ArrowId, number>>): string | null {
  if (!shot || typeof shot !== 'object') return 'not a shot';
  if (!Number.isInteger(shot.angle) || shot.angle < 0 || shot.angle > MAX_ANGLE) return 'angle must be a whole number from 0 to 180';
  if (!Number.isInteger(shot.power) || shot.power < 0 || shot.power > MAX_POWER) return 'power must be a whole number from 0 to 100';
  if (!isArrowId(shot.arrow)) return 'no such arrow';
  const arrow = arrowKind(shot.arrow);
  if (!usable(arrow)) return `${arrow.name} can't be used yet`;
  if (arrow.unlimited) return null;
  const have = setup.players[player].quiver[shot.arrow] ?? 0;
  if ((used[shot.arrow] ?? 0) >= have) return `no ${arrow.name} left`;
  return null;
}

export interface PlayOptions {
  /** Keep each flight's path in the shot records (for drawing). */
  keepPaths?: boolean;
}

/** Plays a whole fight (or as much of it as there are shots for). */
export function playFight(seed: number, setup: FightSetup, shots: readonly Shot[], options: PlayOptions = {}): FightResult {
  const records: ShotRecord[] = [];
  const rounds: RoundResult[] = [];
  const roundWins: [number, number] = [0, 0];
  const used: FightResult['used'] = [{}, {}];
  let round = newRound(seed, 0, setup);
  let winner: FightResult['winner'] = null;
  let invalid: string | null = null;

  for (const shot of shots) {
    if (winner !== null) {
      invalid = 'a shot after the fight ended';
      break;
    }
    const player = round.turn;
    const problem = shotProblem(shot, setup, player, used[player]);
    if (problem) {
      invalid = problem;
      break;
    }
    records.push(playShot(round, player, shot, options.keepPaths));
    if (!arrowKind(shot.arrow).unlimited) used[player][shot.arrow] = (used[player][shot.arrow] ?? 0) + 1;

    const w = roundWinner(round);
    if (w === null) {
      round.turn = 1 - player;
      continue;
    }
    round.winner = w;
    rounds.push({ index: round.index, landSeed: round.landSeed, wind: round.wind, winner: w, shots: round.shots });
    if (w !== 'draw') roundWins[w]++;
    if (roundWins[0] >= ROUNDS_TO_WIN) winner = 0;
    else if (roundWins[1] >= ROUNDS_TO_WIN) winner = 1;
    else if (rounds.length >= MAX_ROUNDS) winner = roundWins[0] > roundWins[1] ? 0 : roundWins[1] > roundWins[0] ? 1 : 'draw';
    else round = newRound(seed, round.index + 1, setup);
  }

  const status = invalid ? 'invalid' : winner !== null ? 'done' : 'playing';
  return {
    status, invalid, winner: invalid ? null : winner, roundWins, rounds, shots: records, used,
    nextPlayer: status === 'playing' ? round.turn : null,
    current: { ...round, land: copyLand(round.land), archers: [copyArcher(round.archers[0]), copyArcher(round.archers[1])] },
  };
}
