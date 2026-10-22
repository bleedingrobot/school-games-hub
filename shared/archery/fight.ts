/**
 * Turns, rounds and fights (docs/ARCHERY-PLAN.md, section 2). A fight is a seed, its setup (the world
 * and what each player brought), and a list of shots. `playFight` plays them all and gives the whole
 * result: every shot's landing, the damage, who won each round and the fight, and which arrows each
 * player used. The server replays fights with exactly this (Stage 4) to count the arrows used.
 *
 * Players take turns. Each round has fresh land and new wind from the seed (the wind stays the same
 * all round), and the first turn swaps each round (player 0 starts round 1). A round ends when one
 * archer is left (both popping at once is a draw), or after MAX_SHOTS_PER_ROUND, when more health
 * wins. First to win ROUNDS_TO_WIN rounds wins the fight; a classmate fight (`setup.oneRound`) is one round only.
 * A classmate's turn the timer used up is a shot with `pass` (nothing flies, but the turn still ends).
 *
 * Screens and bots play a fight one shot at a time with `startFight` and `takeShot`, which is exactly
 * what `playFight` does, so they always agree with a replay.
 */
import { arrowKind, isArrowId, usable } from './arrows';
import { APPLE_HEALTH, GLASS_STING, GOO_DAMAGE, MAX_ANGLE, MAX_POWER, MAX_ROUNDS, MAX_SHOTS_PER_ROUND, ROUNDS_TO_WIN, START_HEALTH, WORLD_WIND_MAX } from './config';
import { capShotDamage, fallDamage, hurt } from './damage';
import { inPuddle, newWork, runArrow, shake } from './effects';
import { isBowId, isShieldId, shieldKind } from './gear';
import { copyLand, dropArcher, makeRoundLand, settle, slideArcher, slideSand } from './land';
import { makeRandom, mixSeed } from './random';
import type { Archer, FightResult, FightSetup, ItemId, Round, RoundResult, Shot, ShotRecord, WorldId } from './types';

const copyArcher = (a: Archer): Archer => ({ ...a });

/** A copy of a round that can be played on without changing the real one (bots try shots on copies). */
export function copyRound(round: Round): Round {
  return { ...round, land: copyLand(round.land), archers: [copyArcher(round.archers[0]), copyArcher(round.archers[1])] };
}

/** The seed for a round's land, and its wind (each world has its own wind range). */
export function roundSeeds(seed: number, index: number, world: WorldId): { landSeed: number; wind: number } {
  const landSeed = mixSeed(seed, 1000 + index);
  const most = WORLD_WIND_MAX[world];
  const wind = makeRandom(mixSeed(seed, 2000 + index)).range(-most, most);
  return { landSeed, wind };
}

/**
 * Starts round `index` of a fight, with the bow each archer brought. A shield lasts the whole fight: it
 * starts full, and later rounds carry on with what was left of it at the end of the last round (`carry`),
 * Bubble bounce and all, so shields soak and then break. `used` is what each player has used so far in
 * the fight (for the Umbrellas they have left).
 */
export function newRound(seed: number, index: number, setup: FightSetup, used: FightResult['used'] = [{}, {}], carry: readonly Archer[] | null = null): Round {
  const { landSeed, wind } = roundSeeds(seed, index, setup.world);
  const { land, archers } = makeRoundLand(landSeed, setup.world);
  for (let i = 0; i < 2; i++) {
    const p = setup.players[i];
    const a = archers[i];
    const guard = p.shield && isShieldId(p.shield) ? p.shield : null;
    a.guard = guard;
    a.shield = !guard ? 0 : carry ? carry[i].shield : shieldKind(guard).soak;
    a.bubble = guard === 'bubble' && (carry ? !!carry[i].bubble : true);
    a.bow = p.bow && isBowId(p.bow) ? p.bow : 'starter';
    a.shardsBy = -1;
    a.umbrellas = Math.max(0, (p.quiver.umbrella ?? 0) - (used[i].umbrella ?? 0));
  }
  return { world: setup.world, index, landSeed, wind, land, archers, turn: index % 2, shots: 0, winner: null, goo: [] };
}

/**
 * Plays one shot by `player` in the round (changing the round's land and archers): an Apple first if they
 * eat one, the arrow's flight and landing (each arrow's own way, in effects.ts), loose dirt falling (and the
 * Desert's sand sliding, and an Earth Shaker's cliffs crumbling), archers falling (an Umbrella stops a fall
 * hurting; on the Snow, or shaken loose, they slide down slopes), then the damage, at most MAX_SHOT_DAMAGE
 * per archer. Then the end of the turn: Sticky Goo hurts anyone standing in it, and Glass shards in the
 * shooter either break (they hit back) or pop them. Doesn't change whose turn it is.
 */
export function playShot(round: Round, player: number, shot: Shot, keepPath = false): ShotRecord {
  const { land, archers } = round;
  const me = archers[player];
  // A turn the timer used up (classmate fights): no Apple, no arrow, nothing falls; only the end of the turn happens.
  const pass = shot.pass === true;
  let apple = 0;
  if (!pass && shot.apple && !me.popped) {
    apple = Math.min(APPLE_HEALTH, START_HEALTH - me.health);
    me.health += apple;
  }
  const w = pass ? null : newWork(round, player, shot, keepPath);
  if (w) runArrow(w);
  const raw = w ? w.raw : [0, 0];
  if (w && w.c1 >= w.c0) {
    settle(land, w.c0, w.c1);
    if (round.world === 'desert') slideSand(land, w.c0, w.c1, archers);
  }
  const tumble = w ? shake(w) : [false, false];
  if (w?.shaken) settle(land, w.shaken[0], w.shaken[1]);
  const fell: [number, number] = [0, 0];
  const slid: [number, number] = [0, 0];
  const umbrella: [boolean, boolean] = [false, false];
  for (let i = 0; w && i < archers.length; i++) {
    const a = archers[i];
    if (a.popped) continue;
    fell[i] = dropArcher(land, a);
    let fall = fallDamage(fell[i]);
    if (round.world === 'snow' || tumble[i]) {
      const slide = slideArcher(land, archers, i);
      slid[i] = slide.slid;
      for (const d of slide.drops) {
        fell[i] += d;
        fall += fallDamage(d);
      }
    }
    if (fall > 0 && (a.umbrellas ?? 0) > 0) {
      a.umbrellas = (a.umbrellas ?? 0) - 1;
      umbrella[i] = true;
      fall = 0;
    }
    raw[i] += fall;
  }
  const damage: [number, number] = [0, 0];
  for (let i = 0; i < archers.length; i++) damage[i] = hurt(archers[i], capShotDamage(raw[i]));
  /** What the shot itself did (before goo), for "did they hit back?". */
  const struck: [number, number] = [damage[0], damage[1]];

  // The end of the turn. Sticky Goo: new puddles join, everyone standing in one is hurt, and each puddle has a shot less.
  const goo: [number, number] = [0, 0];
  const puddles = [...round.goo, ...(w ? w.puddles : [])];
  for (let i = 0; i < archers.length; i++) {
    if (puddles.some((p) => inPuddle(p, archers[i]))) {
      goo[i] = hurt(archers[i], GOO_DAMAGE);
      damage[i] += goo[i];
    }
  }
  round.goo = puddles.map((p) => ({ ...p, shots: p.shots - 1 })).filter((p) => p.shots > 0);

  // Glass shards in the shooter (from the other archer's Glass Arrow): hit back this turn to break them (they
  // still sting), or pop. If the Glass shooter has already popped, they just break.
  let glass: ShotRecord['glass'] = null;
  let sting = 0;
  const by = me.shardsBy ?? -1;
  if (by >= 0 && !me.popped) {
    if (archers[by].popped) glass = 'broke';
    else if (struck[by] > 0) {
      glass = 'broke';
      sting = hurt(me, GLASS_STING);
    } else {
      glass = 'popped';
      sting = me.health;
      me.health = 0;
      me.popped = true;
    }
    damage[player] += sting;
    me.shardsBy = -1;
  } else if (by >= 0) me.shardsBy = -1;
  // New shards from this shot's Glass Arrow.
  for (let i = 0; w && i < archers.length; i++) if (w.stabbed[i] && !archers[i].popped) archers[i].shardsBy = player;

  round.shots++;
  const hit = w?.hit ?? { kind: 'timeout' as const, x: me.x, y: me.y, archer: null, steps: 0 };
  const record: ShotRecord = {
    round: round.index, player, shot: { ...shot }, wind: round.wind, hit, bounce: w ? w.bounce : null, damage, fell, slid,
    after: [copyArcher(archers[0]), copyArcher(archers[1])], apple, umbrella, goo, glass, sting,
  };
  if (keepPath) {
    record.path = w ? w.path : [];
    record.events = w?.events ?? [];
  }
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

/** Why a shot can't be played, or null if it's fine. `used` is what the player has already used. */
export function shotProblem(shot: Shot, setup: FightSetup, player: number, used: Partial<Record<ItemId, number>>): string | null {
  if (!shot || typeof shot !== 'object') return 'not a shot';
  // A used-up turn takes nothing, so there's nothing to check.
  if (shot.pass === true) return null;
  if (!Number.isInteger(shot.angle) || shot.angle < 0 || shot.angle > MAX_ANGLE) return 'angle must be a whole number from 0 to 180';
  if (!Number.isInteger(shot.power) || shot.power < 0 || shot.power > MAX_POWER) return 'power must be a whole number from 0 to 100';
  if (!isArrowId(shot.arrow)) return 'no such arrow';
  const arrow = arrowKind(shot.arrow);
  if (!usable(arrow)) return `${arrow.name} can't be used yet`;
  if (shot.apple !== undefined && typeof shot.apple !== 'boolean') return 'apple must be true or false';
  if (shot.apple && (used.apple ?? 0) >= (setup.players[player].quiver.apple ?? 0)) return 'no Apples left';
  if (arrow.unlimited) return null;
  const have = setup.players[player].quiver[shot.arrow] ?? 0;
  if ((used[shot.arrow] ?? 0) >= have) return `no ${arrow.name} left`;
  return null;
}

export interface PlayOptions {
  /** Keep each flight's path in the shot records (for drawing). */
  keepPaths?: boolean;
}

/** A fight being played one shot at a time (`startFight`, then `takeShot` for each shot). */
export interface FightRun {
  seed: number;
  setup: FightSetup;
  /** The round being played now (or the last one, once the fight is over). */
  round: Round;
  records: ShotRecord[];
  rounds: RoundResult[];
  roundWins: [number, number];
  used: FightResult['used'];
  winner: FightResult['winner'];
}

export function startFight(seed: number, setup: FightSetup): FightRun {
  return { seed, setup, round: newRound(seed, 0, setup), records: [], rounds: [], roundWins: [0, 0], used: [{}, {}], winner: null };
}

/** What `takeShot` did. */
export interface TakenShot {
  /** Why the shot was refused (nothing was played), or null. */
  problem: string | null;
  record: ShotRecord | null;
  /** The round this shot ended (its final land and archers), or null if it goes on. */
  ended: Round | null;
}

/** Plays the next shot of the fight (by whoever's turn it is), and starts the next round if this one ended. */
export function takeShot(run: FightRun, shot: Shot, keepPath = false): TakenShot {
  if (run.winner !== null) return { problem: 'a shot after the fight ended', record: null, ended: null };
  const round = run.round;
  const player = round.turn;
  const problem = shotProblem(shot, run.setup, player, run.used[player]);
  if (problem) return { problem, record: null, ended: null };
  const record = playShot(round, player, shot, keepPath);
  run.records.push(record);
  const used = run.used[player];
  if (!shot.pass && !arrowKind(shot.arrow).unlimited) used[shot.arrow] = (used[shot.arrow] ?? 0) + 1;
  if (!shot.pass && shot.apple) used.apple = (used.apple ?? 0) + 1;
  for (let i = 0; i < 2; i++) if (record.umbrella[i]) run.used[i].umbrella = (run.used[i].umbrella ?? 0) + 1;

  const w = roundWinner(round);
  if (w === null) {
    round.turn = 1 - player;
    return { problem: null, record, ended: null };
  }
  round.winner = w;
  run.rounds.push({ index: round.index, landSeed: round.landSeed, wind: round.wind, winner: w, shots: round.shots });
  if (w !== 'draw') run.roundWins[w]++;
  if (run.setup.oneRound) run.winner = w;
  else if (run.roundWins[0] >= ROUNDS_TO_WIN) run.winner = 0;
  else if (run.roundWins[1] >= ROUNDS_TO_WIN) run.winner = 1;
  else if (run.rounds.length >= MAX_ROUNDS) run.winner = run.roundWins[0] > run.roundWins[1] ? 0 : run.roundWins[1] > run.roundWins[0] ? 1 : 'draw';
  else run.round = newRound(run.seed, round.index + 1, run.setup, run.used, round.archers);
  return { problem: null, record, ended: round };
}

/** Whose turn it is in a fight that's still going (null once it's over). */
export function nextPlayer(run: FightRun): number | null {
  return run.winner === null ? run.round.turn : null;
}

/** Plays a whole fight (or as much of it as there are shots for). */
export function playFight(seed: number, setup: FightSetup, shots: readonly Shot[], options: PlayOptions = {}): FightResult {
  const run = startFight(seed, setup);
  let invalid: string | null = null;
  for (const shot of shots) {
    const taken = takeShot(run, shot, options.keepPaths);
    if (taken.problem) {
      invalid = taken.problem;
      break;
    }
  }
  const status = invalid ? 'invalid' : run.winner !== null ? 'done' : 'playing';
  const round = run.round;
  return {
    status, invalid, winner: invalid ? null : run.winner, roundWins: run.roundWins, rounds: run.rounds, shots: run.records, used: run.used,
    nextPlayer: status === 'playing' ? round.turn : null,
    current: { ...round, land: copyLand(round.land), archers: [copyArcher(round.archers[0]), copyArcher(round.archers[1])] },
  };
}
