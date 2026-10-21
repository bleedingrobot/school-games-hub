/**
 * Archery Challenge's bots (docs/ARCHERY-PLAN.md, section 6). Pure functions: a bot gets the fight so
 * far (seed, setup, shots) and picks the next shot for whoever's turn it is. It only uses the fight's
 * own seeded random numbers, so the same fight always gets the same bot shot (and a replay agrees).
 *
 * - Easy: an angle that looks like it gets over the hill (50–65°, with its own lean for the round),
 *   a guessed power first, then walks its power towards the target (too far → less, too short →
 *   more), with big wobble (±8 power, ±5°) that settles a little as the round goes on. It ignores the
 *   wind (short at full power → it aims flatter).
 * - Medium: works out the power for a 45–60° shot with no wind, picking (by sums, not by flying) the
 *   flattest angle whose arc clears the land between the archers (up to 80° if nothing in 45–60
 *   clears). It keeps that angle for the round while it still clears, and corrects its power from
 *   where its own last arrow landed (70% of the miss). ±4 power wobble, settling to ±2.
 * - Hard: the same, but its sums allow for the wind; then it flies the shot on a copy of the round,
 *   up to 3 times, correcting the power (a step, then a secant step; a steeper angle if the hill
 *   keeps stopping it). ±3 power wobble. It shoots a Steel Arrow when its flights say it will land close.
 * - Every bot misses on purpose some of the time (BOT_TUNING.missChance), so a 9-year-old can win.
 *
 * Stage 2: Plain and Steel only, from each level's kit (BOT_KITS), and only arrows in `botArrows()`.
 * Directions come from the aim table (AIM_X/AIM_Y), never Math.sin/cos.
 */
import { AIM_X, AIM_Y } from './aim';
import { botArrows } from './arrows';
import { ARCHER_H, CELL, GRAVITY, HANDS_HEIGHT, LAUNCH_OFFSET, MAX_ANGLE, MAX_POWER, POWER_TO_SPEED, WIND_ACCEL } from './config';
import { nextPlayer, playShot, startFight, takeShot, type FightRun } from './fight';
import { archerCols, copyLand, surfaceRow } from './land';
import { makeRandom, mixSeed, type Random } from './random';
import type { ArrowId, FightSetup, Round, Shot, ShotHit, ShotRecord } from './types';

export type BotLevel = 'easy' | 'medium' | 'hard';
export const BOT_LEVELS: readonly BotLevel[] = ['easy', 'medium', 'hard'];

/** Each level's fixed small kit (special arrows for the whole fight; Plain is unlimited). Stage 2: Plain and Steel only. */
export const BOT_KITS: Readonly<Record<BotLevel, Partial<Record<ArrowId, number>>>> = {
  easy: { steel: 1 },
  medium: { steel: 2 },
  hard: { steel: 3 },
};

/** A bot never flies more than this many trial shots in one turn (so it's quick on a Chromebook). */
export const BOT_MAX_SIMS = 3;

export interface BotTurn {
  seed: number;
  setup: FightSetup;
  shots: readonly Shot[];
  level: BotLevel;
}

/** How each level aims (docs/ARCHERY-PLAN.md, section 6). Tuned with scripts/archery-sim.mjs. */
export interface BotTuning {
  /** Random wobble added to the power (±), and to the angle (±, degrees). */
  powerWobble: number;
  angleWobble: number;
  /** Chance per shot of missing on purpose, and how far off (power points, either way). */
  missChance: number;
  missMin: number;
  missMax: number;
  /**
   * The wobble settles as the bot gets its eye in during a round: after k of its own shots this round
   * it's (1 − settle·k) of the full wobble, but never less than `floor` of it. A new round starts wobbly again.
   */
  settle: number;
  floor: number;
}

export const BOT_TUNING: Readonly<Record<BotLevel, BotTuning>> = {
  // Easy: ±8 power and ±5° at the start of each round, settling to ±2 power and ±1° after 4 shots.
  easy: { powerWobble: 8, angleWobble: 5, missChance: 0.15, missMin: 8, missMax: 16, settle: 0.2, floor: 0.25 },
  // Medium: ±4 power, settling to ±2 after 4 shots.
  medium: { powerWobble: 4, angleWobble: 0, missChance: 0.2, missMin: 8, missMax: 16, settle: 0.15, floor: 0.5 },
  // Hard: ±3 power all the time (±2 made it win ~96% against Easy and ~85% against Medium).
  hard: { powerWobble: 3, angleWobble: 0, missChance: 0.25, missMin: 8, missMax: 16, settle: 0, floor: 1 },
};

/** Easy's angle: the flattest from 50° that looks like it clears the hill (preferring up to 65°), leaning up to ±EASY_LEAN° for the round. */
const EASY_ANGLE_FROM = 50;
const EASY_ANGLE_PREFER = 65;
const EASY_LEAN = 4;
/** A shot at this power or more counts as full power (see shortAtFullPower). */
const FULL_POWER = 97;
const LOWER_STEP = 5;
const LOWER_MOST = 30;
/** Easy's walk: power points changed per px of miss, and the smallest and biggest step. */
const EASY_PX_PER_POINT = 12;
const EASY_STEP_MIN = 2;
const EASY_STEP_MAX = 12;
/** Medium corrects this share of its last miss (if that arrow went at about the same angle and landed within reach). */
const MEDIUM_CORRECT = 0.7;
const MEDIUM_CORRECT_RANGE = 220;
const MEDIUM_CORRECT_MAX = 15;
/** The arc should clear the land between the archers by the first of these (px) it can, else the next. */
const CLEAR_MARGINS = [24, 6];
/** The steepest angle Medium and Hard aim with. */
const ANGLE_MOST = 80;
/** Medium's angles: the flattest that clears from MEDIUM_FROM°, preferring up to MEDIUM_PREFER°. Hard's likewise. */
const MEDIUM_FROM = 45;
const MEDIUM_PREFER = 60;
const HARD_FROM = 40;
const HARD_PREFER = 60;
/** Hard: biggest power change one correction makes. */
const HARD_STEP_MAX = 25;
/** Hard shoots a Steel Arrow when its best flight hurts the target or lands this close (px). */
const HARD_STEEL_NEAR = 30;
/** Medium shoots a Steel Arrow (this often) when its last arrow this round hurt the target. */
const MEDIUM_STEEL_CHANCE = 0.5;
/** Easy shoots a Steel Arrow at random this often, while it has one. */
const EASY_STEEL_CHANCE = 0.15;

/** The bot's answer, with how it got there (for tests and the simulator). */
export interface BotChoice {
  shot: Shot;
  player: number;
  /** How many trial shots it flew on copies of the round (never more than BOT_MAX_SIMS). */
  sims: number;
  /** True when it missed on purpose. */
  deliberateMiss: boolean;
}

/** Replays the fight so far (startFight + takeShot). Throws if a shot is refused or the fight is over. */
export function replayFight(seed: number, setup: FightSetup, shots: readonly Shot[]): FightRun {
  const run = startFight(seed, setup);
  for (const s of shots) {
    const taken = takeShot(run, s);
    if (taken.problem) throw new Error(`bot: bad shot in the fight so far: ${taken.problem}`);
  }
  if (nextPlayer(run) === null) throw new Error('bot: the fight is over');
  return run;
}

/** Replays the fight so far, works out whose turn it is, and picks that player's shot. */
export function chooseBotShot(turn: BotTurn): Shot {
  return chooseBotShotWithInfo(turn).shot;
}

export function chooseBotShotWithInfo(turn: BotTurn): BotChoice {
  return chooseForRun(replayFight(turn.seed, turn.setup, turn.shots), turn.level);
}

// ——— Aiming sums ———

interface Aim {
  player: number;
  round: Round;
  /** +1 if the target is to the right, −1 to the left. */
  dir: number;
  /** Horizontal distance from the hands to the target's middle (px). */
  dist: number;
  /** The target's middle, in px. */
  tx: number;
  ty: number;
  /** Surface rows of the columns between the archers (from the shooter's side). */
  between: { x: number; top: number }[];
}

function aimFor(round: Round, player: number): Aim {
  const me = round.archers[player];
  const them = round.archers[1 - player];
  const dir = them.x >= me.x ? 1 : -1;
  const [l, r] = dir > 0 ? [me, them] : [them, me];
  const from = archerCols(l.x)[1] + 1;
  const to = archerCols(r.x)[0] - 1;
  const between: { x: number; top: number }[] = [];
  for (let c = from; c <= to; c++) between.push({ x: c * CELL + CELL / 2, top: surfaceRow(round.land, c) * CELL });
  return { player, round, dir, dist: Math.abs(them.x - me.x), tx: them.x, ty: them.y - ARCHER_H / 2, between };
}

/** The angle a shooter uses for an "up and over" angle a (0–90) towards the target. */
const toward = (aim: Aim, a: number) => (aim.dir > 0 ? a : MAX_ANGLE - a);
/** The 0–90 angle of a shot towards the target. */
const upAngle = (aim: Aim, angle: number) => (aim.dir > 0 ? angle : MAX_ANGLE - angle);

/** Where the arrow leaves the bow for angle a (0–90, towards the target). */
function launchPoint(aim: Aim, a: number): { x: number; y: number } {
  const me = aim.round.archers[aim.player];
  return { x: me.x + aim.dir * AIM_X[a] * LAUNCH_OFFSET, y: me.y - HANDS_HEIGHT - AIM_Y[a] * LAUNCH_OFFSET };
}

/**
 * How high (px, up from the launch point) an arc is when it has gone `dx` px towards the target, or
 * -Infinity if it never gets that far (a strong headwind). `ax` is the wind's push towards the target
 * (px/s²; 0 for "no wind" sums). Worked out with sums, not by flying it.
 */
function arcHeight(a: number, power: number, ax: number, dx: number): number {
  const v = power * POWER_TO_SPEED;
  const vx = AIM_X[a] * v;
  const vy = AIM_Y[a] * v;
  let t: number;
  if (ax === 0) {
    if (vx <= 0) return -Infinity;
    t = dx / vx;
  } else {
    const disc = vx * vx + 2 * ax * dx;
    if (disc < 0) return -Infinity;
    t = (Math.sqrt(disc) - vx) / ax;
    if (!(t > 0)) return -Infinity;
  }
  return vy * t - (GRAVITY * t * t) / 2;
}

/** The wind's push towards the target, px/s² (what Hard allows for; the others use 0). */
const windToward = (aim: Aim) => aim.round.wind * WIND_ACCEL * aim.dir;

/**
 * The power (not rounded) that lands an angle-a shot on the target's middle, or Infinity if even full
 * power can't. With `ax` = 0 it's the exact no-wind sum; with wind it's found by halving the range
 * (the arc at the target gets higher as the power goes up).
 */
function powerFor(aim: Aim, a: number, ax = 0): number {
  const p = launchPoint(aim, a);
  const d = (aim.tx - p.x) * aim.dir;
  const rise = p.y - aim.ty;
  if (d <= 0) return Infinity;
  if (ax === 0) {
    const c = AIM_X[a];
    const s = AIM_Y[a];
    if (c <= 0) return Infinity;
    const denom = 2 * c * (d * s - rise * c);
    if (denom <= 0) return Infinity;
    return Math.sqrt((GRAVITY * d * d) / denom) / POWER_TO_SPEED;
  }
  if (arcHeight(a, MAX_POWER, ax, d) < rise) return Infinity;
  let lo = 0;
  let hi = MAX_POWER;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (arcHeight(a, mid, ax, d) < rise) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** How far (px) an arc clears the land between the archers at its lowest (negative: it hits). */
function clearance(aim: Aim, a: number, power: number, ax: number): number {
  const p = launchPoint(aim, a);
  let worst = Infinity;
  for (const col of aim.between) {
    const dx = (col.x - p.x) * aim.dir;
    if (dx <= 0) continue;
    const margin = arcHeight(a, power, ax, dx) - (p.y - col.top);
    if (margin < worst) worst = margin;
  }
  return worst;
}

/**
 * The angle (0–90, towards the target) and power for a shot: the flattest angle from `from`° up whose
 * arc clears the land between the archers, preferring `from`–`prefer`°, then up to ANGLE_MOST; if none
 * clears, the one that clears best (its arrow will blast the hill down).
 */
function pickAim(aim: Aim, ax: number, from: number, prefer: number): { a: number; power: number } {
  let best = { a: from, power: MAX_POWER };
  let bestClear = -Infinity;
  const tried: { a: number; power: number; clear: number }[] = [];
  for (let a = from; a <= ANGLE_MOST; a++) {
    const power = powerFor(aim, a, ax);
    if (power > MAX_POWER) continue;
    const clear = clearance(aim, a, power, ax);
    tried.push({ a, power, clear });
    if (clear > bestClear) {
      bestClear = clear;
      best = { a, power };
    }
  }
  // A roomy gap first (so the wobble doesn't clip the hill), then a tight one; preferred angles first.
  for (const margin of CLEAR_MARGINS) {
    for (const t of tried) if (t.a <= prefer && t.clear >= margin) return t;
    for (const t of tried) if (t.clear >= margin) return t;
  }
  return best;
}

/** How far past the target (along the shot, px) a hit landed: + too far, − too short. */
function missOf(aim: Aim, hit: ShotHit): number {
  if (hit.kind === 'archer' && hit.archer === 1 - aim.player) return 0;
  return (hit.x - aim.tx) * aim.dir;
}

/** This player's last shot in the round being played, or null. */
function lastOwnShot(run: FightRun, player: number): ShotRecord | null {
  for (let i = run.records.length - 1; i >= 0; i--) {
    const r = run.records[i];
    if (r.round !== run.round.index) return null;
    if (r.player === player) return r;
  }
  return null;
}

interface Trial {
  shot: Shot;
  damage: number;
  selfDamage: number;
  miss: number;
  hit: ShotHit;
}

/** Flies a shot on a copy of the round (the real round never changes). */
function trial(aim: Aim, shot: Shot): Trial {
  const round = aim.round;
  const copy: Round = { ...round, land: copyLand(round.land), archers: [{ ...round.archers[0] }, { ...round.archers[1] }] };
  const rec = playShot(copy, aim.player, shot);
  return { shot, damage: rec.damage[1 - aim.player], selfDamage: rec.damage[aim.player], miss: missOf(aim, rec.hit), hit: rec.hit };
}

const clampP = (p: number) => (p < 0 ? 0 : p > MAX_POWER ? MAX_POWER : Math.round(p));
const clampA = (a: number) => (a < 0 ? 0 : a > MAX_ANGLE ? MAX_ANGLE : Math.round(a));
const limit = (n: number, most: number) => (n > most ? most : n < -most ? -most : n);
/** Power change that moves the landing by `miss` px (range grows with power², so dRange/dPower ≈ 2·range/power). */
const powerStep = (aim: Aim, power: number, miss: number) => (-miss * (power > 1 ? power : 1)) / (2 * (aim.dist > 50 ? aim.dist : 50));

/** Can this player shoot a Steel Arrow now (in their setup, their level's kit and the bots' list, with one left)? */
function steelLeft(run: FightRun, player: number, level: BotLevel): boolean {
  if (!botArrows().some((a) => a.id === 'steel')) return false;
  const have = Math.min(run.setup.players[player].quiver.steel ?? 0, BOT_KITS[level].steel ?? 0);
  return (run.used[player].steel ?? 0) < have;
}

/** How many shots this player has taken in the round being played. */
function ownShots(run: FightRun, player: number): number {
  let n = 0;
  for (let i = run.records.length - 1; i >= 0 && run.records[i].round === run.round.index; i--) if (run.records[i].player === player) n++;
  return n;
}

/** A whole-number wobble of up to ±`most`, settling as the bot gets its eye in this round (BotTuning.settle). */
function wobble(rng: Random, run: FightRun, player: number, level: BotLevel, most: number): number {
  const t = BOT_TUNING[level];
  const k = 1 - t.settle * ownShots(run, player);
  const w = Math.round(most * (k > t.floor ? k : t.floor));
  return w > 0 ? rng.range(-w, w) : 0;
}

/**
 * How many of this player's arrows this round fell short at (nearly) full power. Easy and Medium don't
 * allow for the wind, so a headwind can leave them short at full power: each such arrow makes them aim
 * LOWER_STEP° flatter (a flatter arrow goes further), down to LOWER_MOST°.
 */
function shortAtFullPower(run: FightRun, aim: Aim): number {
  let n = 0;
  for (let i = run.records.length - 1; i >= 0 && run.records[i].round === run.round.index; i--) {
    const r = run.records[i];
    if (r.player === aim.player && r.shot.power >= FULL_POWER && missOf(aim, r.hit) < -20) n++;
  }
  return n;
}

// ——— The three levels ———

interface Plan {
  angle: number;
  power: number;
  arrow: ArrowId;
  sims: number;
}

function planEasy(run: FightRun, aim: Aim, rng: Random): Plan {
  const p = aim.player;
  // An angle that looks like it gets over the hill (worked out on the land as it is now), plus its own
  // lean for the round, which it sticks with.
  const lean = makeRandom(mixSeed(run.seed, 8000 + run.round.index * 2 + p)).range(-EASY_LEAN, EASY_LEAN);
  const flatter = shortAtFullPower(run, aim) * LOWER_STEP;
  const angleBase = Math.max(LOWER_MOST, pickAim(aim, 0, EASY_ANGLE_FROM, EASY_ANGLE_PREFER).a + lean - flatter);
  const last = lastOwnShot(run, p);
  let power: number;
  if (!last) {
    power = 30 + aim.dist / 22 + rng.range(-10, 10); // a guess from how far away they look
  } else {
    const miss = missOf(aim, last.hit);
    const near = last.damage[1 - p] > 0 && Math.abs(miss) < 20;
    const step = near ? 0 : Math.min(EASY_STEP_MAX, Math.max(EASY_STEP_MIN, Math.round(Math.abs(miss) / EASY_PX_PER_POINT)));
    power = last.shot.power - Math.sign(miss) * step;
  }
  const t = BOT_TUNING.easy;
  const angle = toward(aim, angleBase + wobble(rng, run, p, 'easy', t.angleWobble));
  power += wobble(rng, run, p, 'easy', t.powerWobble);
  const arrow: ArrowId = steelLeft(run, p, 'easy') && rng.fraction() < EASY_STEEL_CHANCE ? 'steel' : 'plain';
  return { angle, power, arrow, sims: 0 };
}

function planMedium(run: FightRun, aim: Aim, rng: Random): Plan {
  const p = aim.player;
  const last = lastOwnShot(run, p);
  let a = -1;
  let power = 0;
  // It keeps its angle from its last shot this round while that arc still clears the land, and corrects
  // the power from where that arrow landed; otherwise it works out a fresh angle and power.
  if (last && last.hit.kind !== 'timeout') {
    const la = upAngle(aim, last.shot.angle);
    const miss = missOf(aim, last.hit);
    const stuckShort = last.shot.power >= FULL_POWER && miss < -20;
    if (la >= LOWER_MOST && la <= ANGLE_MOST && Math.abs(miss) < MEDIUM_CORRECT_RANGE && !stuckShort) {
      const fresh = powerFor(aim, la, 0);
      if (fresh <= MAX_POWER && clearance(aim, la, fresh, 0) >= CLEAR_MARGINS[CLEAR_MARGINS.length - 1]) {
        a = la;
        power = last.shot.power + limit(powerStep(aim, last.shot.power, miss) * MEDIUM_CORRECT, MEDIUM_CORRECT_MAX);
      }
    }
  }
  if (a < 0) {
    const fresh = pickAim(aim, 0, MEDIUM_FROM, MEDIUM_PREFER);
    const flatter = shortAtFullPower(run, aim) * LOWER_STEP;
    a = Math.max(LOWER_MOST, fresh.a - flatter);
    const p1 = flatter ? powerFor(aim, a, 0) : fresh.power;
    power = p1 > MAX_POWER ? MAX_POWER : p1;
  }
  const t = BOT_TUNING.medium;
  power += wobble(rng, run, p, 'medium', t.powerWobble);
  const lastHurt = !!last && last.damage[1 - p] > 0;
  const arrow: ArrowId = lastHurt && steelLeft(run, p, 'medium') && rng.fraction() < MEDIUM_STEEL_CHANCE ? 'steel' : 'plain';
  return { angle: toward(aim, a + wobble(rng, run, p, 'medium', t.angleWobble)), power, arrow, sims: 0 };
}

/** Is a trial blocked by land well short of the target (so more power alone may not help)? */
const blocked = (t: Trial) => t.hit.kind === 'land' && t.miss < -60;

function better(a: Trial, b: Trial): boolean {
  const sa = a.damage - a.selfDamage;
  const sb = b.damage - b.selfDamage;
  if (sa !== sb) return sa > sb;
  return Math.abs(a.miss) < Math.abs(b.miss);
}

function planHard(run: FightRun, aim: Aim, rng: Random): Plan {
  const p = aim.player;
  const ax = windToward(aim);
  const first = pickAim(aim, ax, HARD_FROM, HARD_PREFER);
  let a = first.a;
  const p0 = clampP(Math.min(first.power, MAX_POWER));
  const trials: Trial[] = [];
  const fly = (angle: number, power: number) => {
    const t = trial(aim, { angle: toward(aim, angle), power: clampP(power), arrow: 'plain' });
    trials.push(t);
    return t;
  };
  const t0 = fly(a, p0);
  let next: Shot | null = null;
  if (t0.damage <= 0) {
    // A first correction from how range grows with power.
    let p1 = clampP(p0 + limit(powerStep(aim, p0, t0.miss), HARD_STEP_MAX));
    if (p1 === p0) p1 = clampP(p0 + (t0.miss > 0 ? -1 : 1));
    const t1 = fly(a, p1);
    if (t1.damage <= 0) {
      if (blocked(t0) && blocked(t1) && a < ANGLE_MOST) {
        // The hill keeps stopping it: try a steeper arc.
        a = a + 12 > ANGLE_MOST ? ANGLE_MOST : a + 12;
        const p2 = clampP(Math.min(powerFor(aim, a, ax), MAX_POWER));
        const t2 = fly(a, p2);
        if (t2.damage <= 0) next = { angle: toward(aim, a), power: clampP(p2 + limit(powerStep(aim, p2, t2.miss), HARD_STEP_MAX)), arrow: 'plain' };
      } else {
        // A secant step between the two flights.
        const secant = (pa: number, ma: number, pz: number, mz: number, fallback: number) =>
          mz !== ma ? pz - (mz * (pz - pa)) / (mz - ma) : fallback;
        const p2 = clampP(nearGuess(secant(p0, t0.miss, p1, t1.miss, p1 + powerStep(aim, p1, t1.miss)), p1));
        const t2 = fly(a, p2);
        if (t2.damage <= 0) {
          const [u, w] = Math.abs(t1.miss) < Math.abs(t0.miss) ? [t0, t1] : [t1, t0];
          next = { angle: toward(aim, a), power: clampP(nearGuess(secant(u.shot.power, u.miss, t2.shot.power, t2.miss, t2.shot.power + powerStep(aim, t2.shot.power, t2.miss)), w.shot.power)), arrow: 'plain' };
        }
      }
    }
  }
  let best = trials[0];
  for (const t of trials) if (better(t, best)) best = t;
  // If no flight hurt the target, use the next correction (unflown), unless one already landed right by them.
  const chosen = best.damage > 0 || !next || Math.abs(best.miss) < 12 ? best.shot : next;
  const t = BOT_TUNING.hard;
  const close = best.damage > 0 || Math.abs(best.miss) < HARD_STEEL_NEAR;
  const arrow: ArrowId = close && chosen === best.shot && steelLeft(run, p, 'hard') ? 'steel' : 'plain';
  const power = chosen.power + wobble(rng, run, p, 'hard', t.powerWobble);
  return { angle: chosen.angle, power, arrow, sims: trials.length };
}

/** Keeps a secant guess sensible: a finite number within HARD_STEP_MAX of where it started. */
function nearGuess(guess: number, from: number): number {
  if (!Number.isFinite(guess)) return from;
  return from + limit(guess - from, HARD_STEP_MAX);
}

/**
 * Picks the next shot for whoever's turn it is in a fight being played (the run isn't changed).
 * `chooseBotShot` replays the fight and calls this; the simulator calls it on its own run.
 */
export function chooseForRun(run: FightRun, level: BotLevel): BotChoice {
  const player = nextPlayer(run);
  if (player === null) throw new Error('bot: the fight is over');
  const rng = makeRandom(mixSeed(run.seed, 7000 + run.records.length));
  const aim = aimFor(run.round, player);
  const plan = level === 'easy' ? planEasy(run, aim, rng) : level === 'medium' ? planMedium(run, aim, rng) : planHard(run, aim, rng);
  const t = BOT_TUNING[level];
  let power = plan.power;
  let arrow = plan.arrow;
  const deliberateMiss = rng.fraction() < t.missChance;
  if (deliberateMiss) {
    power += (rng.int(2) === 0 ? -1 : 1) * rng.range(t.missMin, t.missMax);
    arrow = 'plain'; // no need to waste a Steel Arrow on a miss
  }
  return { shot: { angle: clampA(plan.angle), power: clampP(power), arrow }, player, sims: plan.sims, deliberateMiss };
}
