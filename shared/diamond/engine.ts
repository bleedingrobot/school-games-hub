/**
 * One level of Diamond Drop as a pure, seeded state machine (docs/DIAMOND-PLAN.md, sections 3 and 5).
 *
 * `startLevel` makes the level from its seed; `step` moves it on one tick (with the pupil pressing Drop or Finish, or
 * not); when a gem slips the level waits on a Hold on! question, and `answer` gives it the server's mark. `playLevel`
 * replays a whole recorded level from `(level, seed, drops, boosts, marks)`, which is how the server checks a result.
 * While playing only + − × ÷ are used, with the fixed angle table, so every browser and the server agree exactly.
 * Slips come only from the seed and the catch number; the outcome only from the mark for each question slot.
 */
import {
  DIAMOND_COINS, DIAMOND_SLIPS, EXTRA_TIME_SECONDS, FALL_DISTANCE, FIELD_H, FIELD_W, GEMS, LAST_LEVEL, LUCKY_CHARM,
  PIVOT, REEL_SPEED, ROCKS, SHOOT_SPEED, SLIP_AT, STARTER, STAR_TWO_SECONDS, STRONG_WINCH, SWING_RANGE, SWING_SPEED,
  TICKS_PER_SECOND, CLAW_R, gemOf, levelSpec, questionCap, type BoostId, type GemId, type Weight,
} from './config';
import { direction, makeField, makeStarterField, thingAt, type Thing } from './field';
import { STREAM, makeRandom, mixSeed } from './random';

export type Phase = 'swing' | 'out' | 'reel' | 'question' | 'done';

/** A slip on the way up, and what happened. */
export interface Slip {
  /** The Hold on! question slot it used (0, 1, 2 …). */
  slot: number;
  /** Which catch of the level it was (0 is the first). */
  catchNo: number;
  gem: GemId;
  tick: number;
  /** How far out the claw was when it slipped. */
  length: number;
  held: boolean;
  /** Where a dropped gem landed. */
  landed?: { x: number; y: number };
}

/** One drop of the claw, for the screen to animate. */
export interface Shot {
  /** The tick Drop was pressed. */
  tick: number;
  degree: number;
  /** The tick the claw touched something or reached the edge, and how far out it was. */
  turnTick: number;
  length: number;
  /** What it grabbed (its id in the field), or null for an empty claw. */
  grabbed: number | null;
  kind: Thing['kind'] | null;
  /** The gem it carried up (a crab's gem too). */
  gem?: GemId;
  /** The tick it was back at the top (or the level ended). */
  endTick: number;
  /** Banked: value counted towards the target. Coins: what it paid. */
  banked: number;
  coins: number;
  /** A rock turned to dust by the Rock Blaster. */
  blasted?: boolean;
}

export interface LevelState {
  level: number;
  seed: number;
  boosts: readonly BoostId[];
  starter: boolean;
  things: Thing[];
  /** Ids of things still buried. */
  buried: Set<number>;
  tick: number;
  /** The tick the level ends (extra time and sacks move it). */
  endTick: number;
  phase: Phase;
  /** The claw's swing, in tenths of a degree, and which way it's going. */
  swing: number;
  swingDir: 1 | -1;
  starterSwing: boolean;
  degree: number;
  length: number;
  grabbed: Thing | null;
  /** What the claw is carrying up, if anything worth something. */
  carrying: GemId | null;
  weight: Weight;
  /** Lengths at which the current catch will slip, highest first. */
  slipsDue: number[];
  catchNo: number;
  slotsUsed: number;
  /** The slot the level is waiting on an answer for. */
  waitingSlot: number | null;
  blasterLeft: boolean;
  banked: number;
  coins: number;
  passTick: number | null;
  /** Ticks left on the clock when the level was passed (before any later sack seconds). */
  leftAtPass: number;
  caught: Partial<Record<GemId, number>>;
  freeBoost: BoostId | null;
  shots: Shot[];
  slips: Slip[];
}

export interface LevelResult {
  level: number;
  seed: number;
  /** Gem value banked (towards the target). */
  banked: number;
  /** Coins this level paid (before the replay share: see progress.ts). */
  coins: number;
  passed: boolean;
  stars: 0 | 1 | 2 | 3;
  /** Ticks left on the clock when the level ended. */
  ticksLeft: number;
  /** Gems brought up, by kind. */
  caught: Partial<Record<GemId, number>>;
  diamond: boolean;
  /** Hold on! questions used, and how many were held. */
  questions: number;
  held: number;
  slips: Slip[];
  shots: Shot[];
  /** A free boost for the next level, from a mystery sack. */
  freeBoost: BoostId | null;
  /** The tick the level ended. */
  endTick: number;
}

const has = (s: LevelState, b: BoostId) => s.boosts.includes(b);

export function startLevel(level: number, seed: number, boosts: readonly BoostId[] = [], starter = false): LevelState {
  const spec = levelSpec(level);
  const isStarter = starter && level === 1;
  const things = isStarter ? makeStarterField(seed) : makeField(level, seed);
  const seconds = spec.seconds + (boosts.includes('extraTime') ? EXTRA_TIME_SECONDS : 0);
  return {
    level, seed, boosts: [...new Set(boosts)], starter: isStarter, things,
    buried: new Set(things.map((t) => t.id)),
    tick: 0, endTick: seconds * TICKS_PER_SECOND, phase: 'swing',
    swing: 0, swingDir: 1, starterSwing: isStarter, degree: 0, length: 0,
    grabbed: null, carrying: null, weight: 'empty', slipsDue: [], catchNo: 0, slotsUsed: 0, waitingSlot: null,
    blasterLeft: boosts.includes('rockBlaster'), banked: 0, coins: 0, passTick: null, leftAtPass: 0, caught: {}, freeBoost: null,
    shots: [], slips: [],
  };
}

/** The claw's angle now, in whole degrees (0 straight down, positive to the right). */
export const clawDegree = (s: LevelState) => (s.swing - (s.swing % 10)) / 10;

/** Has the level's goal been met (the target, or on the last level the Heart Diamond)? */
const goalMet = (s: LevelState) => (s.level === LAST_LEVEL ? (s.caught.heartDiamond ?? 0) > 0 : s.banked >= levelSpec(s.level).target);

function swingOn(s: LevelState) {
  const range = s.starterSwing ? STARTER.swingRange : SWING_RANGE;
  s.swing += s.swingDir * (s.starterSwing ? STARTER.swingSpeed : SWING_SPEED);
  if (s.swing > range) { s.swing = 2 * range - s.swing; s.swingDir = -1; }
  else if (s.swing < -range) { s.swing = -2 * range - s.swing; s.swingDir = 1; }
}

function reelSpeed(s: LevelState): number {
  const base = REEL_SPEED[s.weight];
  return has(s, 'strongWinch') && s.weight !== 'empty' && s.weight !== 'light' ? base * STRONG_WINCH : base;
}

function tip(s: LevelState) {
  const { dx, dy } = direction(s.degree);
  return { x: PIVOT.x + s.length * dx, y: PIVOT.y + s.length * dy };
}

/** The claw touched `t`: grab it, and decide from the seed and the catch number whether (and where) it will slip. */
function grab(s: LevelState, t: Thing) {
  const shot = s.shots[s.shots.length - 1];
  shot.turnTick = s.tick;
  shot.length = s.length;
  shot.grabbed = t.id;
  shot.kind = t.kind;
  s.buried.delete(t.id);
  s.grabbed = t;
  s.phase = 'reel';
  s.slipsDue = [];
  const rng = makeRandom(mixSeed(s.seed, STREAM.catch + s.catchNo));
  s.catchNo++;
  if (s.starterSwing) s.starterSwing = false;
  if (t.kind === 'rock') {
    if (s.blasterLeft) {
      s.blasterLeft = false;
      shot.blasted = true;
      s.weight = 'empty';
    } else s.weight = ROCKS[t.rock!].weight;
    s.carrying = null;
    return;
  }
  if (t.kind === 'sack') {
    s.weight = 'light';
    s.carrying = null;
    return;
  }
  const gem = t.kind === 'crab' ? t.crab!.gem : t.gem;
  s.carrying = gem ?? null;
  shot.gem = gem;
  if (!gem) { s.weight = 'light'; return; }
  const g = gemOf(gem);
  s.weight = g.weight;
  if (gem === 'heartDiamond') {
    s.slipsDue = DIAMOND_SLIPS.map(([lo, hi]) => s.length * rng.between(lo, hi));
  } else {
    const chance = has(s, 'luckyCharm') ? g.slip * LUCKY_CHARM : g.slip;
    if (rng.fraction() < chance) s.slipsDue = [s.length * rng.between(SLIP_AT[0], SLIP_AT[1])];
  }
}

/** Bring the claw's load to the top. */
function bank(s: LevelState) {
  const shot = s.shots[s.shots.length - 1];
  const t = s.grabbed;
  shot.endTick = s.tick;
  if (t?.kind === 'sack' && t.sack) {
    const p = t.sack;
    if ('coins' in p) { s.coins += p.coins; shot.coins = p.coins; }
    else if ('seconds' in p) s.endTick += p.seconds * TICKS_PER_SECOND;
    else if (!s.freeBoost) s.freeBoost = p.boost;
  } else if (s.carrying) {
    const gem = s.carrying;
    const value = t?.kind === 'gem' && t.value !== undefined ? t.value : gemOf(gem).value;
    s.caught[gem] = (s.caught[gem] ?? 0) + 1;
    s.banked += value;
    const coins = value + (gem === 'heartDiamond' ? DIAMOND_COINS : 0);
    s.coins += coins;
    shot.banked = value;
    shot.coins = coins;
  }
  s.grabbed = null;
  s.carrying = null;
  s.weight = 'empty';
  s.length = 0;
  s.phase = 'swing';
  if (s.passTick === null && goalMet(s)) { s.passTick = s.tick; s.leftAtPass = s.endTick - s.tick; }
  // The last level ends as soon as the Heart Diamond is up.
  if (s.level === LAST_LEVEL && goalMet(s)) s.phase = 'done';
}

/**
 * Move the level on one tick. `press` is what the pupil pressed this tick: Drop (only counts while the claw is
 * swinging) or Finish (only once the level is passed, with the claw at the top). Does nothing while a question waits.
 */
export function step(s: LevelState, press: 'drop' | 'finish' | null = null): void {
  if (s.phase === 'done' || s.phase === 'question') return;
  if (s.phase === 'swing') {
    if (press === 'finish' && s.passTick !== null) { s.phase = 'done'; return; }
    if (press === 'drop') {
      s.degree = clawDegree(s);
      s.length = 0;
      s.phase = 'out';
      s.shots.push({ tick: s.tick, degree: s.degree, turnTick: s.tick, length: 0, grabbed: null, kind: null, endTick: s.tick, banked: 0, coins: 0 });
    } else swingOn(s);
  }
  if (s.phase === 'out') {
    s.length += SHOOT_SPEED;
    const at = tip(s);
    let hit: Thing | null = null;
    let hitD2 = 0;
    for (const t of s.things) {
      if (!s.buried.has(t.id)) continue;
      const p = thingAt(t, s.tick);
      const ddx = at.x - p.x;
      const ddy = at.y - p.y;
      const d2 = ddx * ddx + ddy * ddy;
      const reach = t.r + CLAW_R;
      if (d2 <= reach * reach && (!hit || d2 < hitD2)) { hit = t; hitD2 = d2; }
    }
    if (hit) grab(s, hit);
    else if (at.x < 0 || at.x > FIELD_W || at.y > FIELD_H) {
      const shot = s.shots[s.shots.length - 1];
      shot.turnTick = s.tick;
      shot.length = s.length;
      s.phase = 'reel';
      s.weight = 'empty';
    }
  } else if (s.phase === 'reel') {
    s.length -= reelSpeed(s);
    const due = s.slipsDue[0];
    if (due !== undefined && s.length <= due) {
      s.slipsDue.shift();
      if (s.slotsUsed < questionCap(s.level)) {
        s.length = due;
        s.waitingSlot = s.slotsUsed++;
        s.phase = 'question';
      } else s.slipsDue = [];
    }
    if (s.phase === 'reel' && s.length <= 0) bank(s);
  }
  s.tick++;
  // A question on the last tick is still asked (the clock is stopped); the level ends on the next tick after it.
  if ((s.phase as Phase) !== 'done' && (s.phase as Phase) !== 'question' && s.tick >= s.endTick) {
    if (s.shots.length && s.phase !== 'swing') s.shots[s.shots.length - 1].endTick = s.tick;
    s.phase = 'done';
  }
}

/** The server's mark for the question the level is waiting on. Right: the claw holds on. Wrong: the gem falls back into the rock. */
export function answer(s: LevelState, correct: boolean): void {
  if (s.phase !== 'question' || s.waitingSlot === null || !s.grabbed || !s.carrying) return;
  const slip: Slip = { slot: s.waitingSlot, catchNo: s.catchNo - 1, gem: s.carrying, tick: s.tick, length: s.length, held: correct };
  s.slips.push(slip);
  s.waitingSlot = null;
  s.phase = 'reel';
  if (correct) return;
  // It falls further out along the claw's line, as far as the seed says, but stays inside the ground and clear of others.
  const t = s.grabbed;
  const rng = makeRandom(mixSeed(s.seed, STREAM.landing + slip.slot));
  const { dx, dy } = direction(s.degree);
  let fall = rng.between(FALL_DISTANCE[0], FALL_DISTANCE[1]);
  let x = 0;
  let y = 0;
  for (; fall >= 0; fall -= 10) {
    const length = s.length + fall;
    x = PIVOT.x + length * dx;
    y = PIVOT.y + length * dy;
    if (x < t.r || x > FIELD_W - t.r || y > FIELD_H - t.r - 4) continue;
    if (!clashes(s, t, x, y)) break;
  }
  if (fall < 0) { x = PIVOT.x + s.length * dx; y = PIVOT.y + s.length * dy; }
  // A crab drops its gem, which stays put; the crab itself scuttles off.
  const fallen: Thing = { id: t.id, kind: 'gem', gem: s.carrying, x, y, r: t.kind === 'crab' ? gemOf(s.carrying).r : t.r };
  if (t.value !== undefined) fallen.value = t.value;
  s.things[s.things.findIndex((o) => o.id === t.id)] = fallen;
  s.buried.add(t.id);
  slip.landed = { x, y };
  s.grabbed = null;
  s.carrying = null;
  s.weight = 'empty';
  s.slipsDue = [];
}

function clashes(s: LevelState, me: Thing, x: number, y: number): boolean {
  for (const o of s.things) {
    if (o.id === me.id || !s.buried.has(o.id) || o.crab) continue;
    const ddx = o.x - x;
    const ddy = o.y - y;
    const need = o.r + me.r;
    if (ddx * ddx + ddy * ddy < need * need) return true;
  }
  return false;
}

/** What the level came to (for a level that has ended, or so far). */
export function levelResult(s: LevelState): LevelResult {
  const passed = s.passTick !== null;
  const level = levelSpec(s.level);
  let stars: LevelResult['stars'] = 0;
  if (passed) {
    stars = 1;
    if (s.leftAtPass >= STAR_TWO_SECONDS * TICKS_PER_SECOND) {
      stars = 2;
      if (levelKinds(level.level).every((k) => (s.caught[k] ?? 0) > 0)) stars = 3;
    }
  }
  return {
    level: s.level, seed: s.seed, banked: s.banked, coins: s.coins, passed, stars,
    ticksLeft: Math.max(0, s.endTick - s.tick), caught: { ...s.caught }, diamond: (s.caught.heartDiamond ?? 0) > 0,
    questions: s.slips.length, held: s.slips.filter((x) => x.held).length, slips: s.slips, shots: s.shots,
    freeBoost: s.freeBoost, endTick: s.tick,
  };
}

export interface LevelInput {
  level: number;
  seed: number;
  /** The ticks Drop was pressed (presses while the claw was busy are ignored). */
  drops: readonly number[];
  boosts?: readonly BoostId[];
  /** The server's mark for each Hold on! slot. A slot with no mark counts as wrong. */
  marks?: readonly boolean[];
  /** The tick Finish was pressed, if it was. */
  finish?: number | null;
  /** The guided first go (level 1 only). */
  starter?: boolean;
}

/** Most ticks a level could ever run (time, extra time and every sack's seconds), so a replay always stops. */
const MOST_TICKS = 10 * 60 * TICKS_PER_SECOND;

/** Replay a whole level from its seed and what the pupil pressed. The server saves exactly this. */
export function playLevel(input: LevelInput): LevelResult {
  const s = startLevel(input.level, input.seed, input.boosts ?? [], input.starter ?? false);
  const drops = [...input.drops].sort((a, b) => a - b);
  const marks = input.marks ?? [];
  let next = 0;
  while (s.phase !== 'done' && s.tick < MOST_TICKS) {
    if (s.phase === 'question') {
      answer(s, marks[s.waitingSlot!] === true);
      if (s.phase === 'question') break;
      continue;
    }
    while (next < drops.length && drops[next] < s.tick) next++;
    let press: 'drop' | 'finish' | null = null;
    if (s.phase === 'swing') {
      if (input.finish != null && input.finish === s.tick && s.passTick !== null) press = 'finish';
      else if (drops[next] === s.tick) press = 'drop';
    }
    step(s, press);
  }
  return levelResult(s);
}

/** Every gem kind buried on a level (for stars and the Gem Book). */
export const levelKinds = (level: number): GemId[] =>
  GEMS.filter((_, i) => (levelSpec(level).gems[i] ?? 0) > 0).map((g) => g.id);

/** The guided first go: level 1 with a slow, narrow swing over a big quartz straight below, so the first drop can't miss. */
export const starterLevel = (seed: number): LevelState => startLevel(1, seed, [], true);
