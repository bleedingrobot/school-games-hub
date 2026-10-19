/**
 * Marble Rush's rules and physics, as plain functions (docs/MARBLE-PLAN.md, section 4).
 *
 * `newRun` makes the starting state, `stepRun` moves it forward one 1/60-second step with one
 * input, and `replay` plays a whole recorded run. The same inputs always give exactly the same
 * run, in every browser and on the server, so the server can work out a run's real time itself.
 *
 * The state is plain numbers: it can be saved, hashed and compared.
 */
import {
  AIR_GRAVITY, AIR_STEER, BALL_RADIUS, BOUNCE, BUMPER_RADIUS, BUMPER_SPEED, CHECKPOINT_BONUS_STEPS, DT, FALL_PENALTY_STEPS,
  CONVEYOR_PUSH, GEM_BONUS_STEPS, SAFE_SPOT_AGE, SAFE_SPOTS_KEPT, UNSAFE_TILES, GEM_PICKUP_RADIUS, MAX_GEM_BONUSES, JUMP_SPEED, KILL_BELOW, LEVEL, MAX_RUN_STEPS, OUCH_SPEED, SLOPE_GRAVITY, STEER, STEP_DOWN, STEP_UP, SURFACES, TIMED,
} from './config';
import type { Course, Tile } from './course';
import { BONUS, HOLD, MAX_CODE, MAX_INPUT_STEPS, REFUND, type InputRuns } from './inputs';

export type ClockMode = 'up' | 'down';

export interface RunOptions {
  mode?: ClockMode;
  /** Which shortcut doors (0 = A, 1 = B …) are open. Decided before the run, never changed during it. */
  openDoors?: readonly number[];
  /** Which gems (their numbers in `course.gemList`) are the right answers. Decided before the run, never changed during it. */
  rightGems?: readonly number[];
}

export type RunOutcome = 'running' | 'finished' | 'timeout';

export interface RunState {
  x: number;
  y: number;
  /** Height in tiles. */
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
  /** Physics steps played (not counting held steps). */
  steps: number;
  /** Held steps (clock and marble stopped). */
  held: number;
  /** Time added by falls, in steps. */
  penalty: number;
  /** The penalty of the latest fall, while it can still be taken back. */
  refundable: number;
  /** Time added by checkpoints (hard mode only), in steps. */
  bonus: number;
  falls: number;
  /** Where a fall goes back to if no safe tile is old enough: the start, or the last checkpoint reached. */
  respawnX: number;
  respawnY: number;
  /** Recent safe tiles the marble rolled onto, oldest first, as pairs: tile number, step it was reached. A fall goes back to one of these. */
  safeSpots: number[];
  /** Checkpoint tiles reached (their tile numbers), in order. */
  checkpoints: number[];
  outcome: RunOutcome;
  /** Clock steps at the finish, when finished. */
  finishSteps: number;
  /** Steps left before a jump pad can fire again, so one pad can't fire twice in a row. */
  padCooldown: number;
  /** For each answer gate, the tunnel the marble went into first (0, 1, 2), or -1 if it has not reached the gate yet. Only written down; it never changes the physics. */
  gateChoices: number[];
  /** The stops reached (pit stops and question stops; a block of touching tiles is one), in order. */
  pitStops: number[];
  /** The stops that took time off for a right answer (a `BONUS` input), in order. Each stop pays once. */
  pitsPaid: number[];
  /** The right gems picked up, in order (each took `GEM_BONUS_STEPS` off the clock; at most `MAX_GEM_BONUSES` count). */
  gemsTaken: number[];
}

const R2 = 0.7071067811865476;
/** Index = input code. North is up the grid (smaller y). */
export const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [0, -1], [R2, -R2], [1, 0], [R2, R2], [0, 1], [-R2, R2], [-1, 0], [-R2, -R2],
];

const CONVEYORS: Record<string, readonly [number, number]> = { e: [1, 0], w: [-1, 0], n: [0, -1], o: [0, 1] };

const WALL: Tile = { ch: '=', level: 0, surface: 'normal', slope: null, door: -1 };
const VOID: Tile = { ch: '.', level: 0, surface: 'normal', slope: null, door: -1 };

export interface World {
  course: Course;
  mode: ClockMode;
  open: ReadonlySet<number>;
  /** The right gems, lowest number first. */
  rightGems: readonly number[];
  /** The step being played (set by `stepRun`); timed hazards depend only on this. */
  t: number;
}

export function makeWorld(course: Course, options: RunOptions = {}): World {
  return { course, mode: options.mode ?? 'up', open: new Set(options.openDoors ?? []), rightGems: [...new Set(options.rightGems ?? [])].sort((a, b) => a - b), t: 0 };
}

function tileAt(w: World, tx: number, ty: number): Tile {
  const c = w.course;
  if (tx < 0 || ty < 0 || tx >= c.width || ty >= c.height) return VOID;
  const t = c.tiles[ty * c.width + tx];
  if (t.door >= 0) return w.open.has(t.door) ? { ...t, ch: '#' } : WALL;
  if (t.ch === 't') return trapdoorSolid(w.t, tx) ? t : VOID;
  if (t.ch === 'q') return gateOpen(w.t, tx) ? { ...t, ch: '#' } : WALL;
  return t;
}

/** Hazards in the same column share a timer, so a row of them moves together. */
export const trapdoorSolid = (t: number, tx: number) => (t + tx * 53) % TIMED.trapdoor.period < TIMED.trapdoor.solid;
export const gateOpen = (t: number, tx: number) => (t + tx * 53) % TIMED.gate.period < TIMED.gate.open;
/** 0 = quiet, 1 = steaming (a warning), 2 = throwing the marble up. */
export function geyserPhase(t: number, tx: number, ty: number): 0 | 1 | 2 {
  const p = (t + tx * 37 + ty * 91) % TIMED.geyser.period;
  return p < TIMED.geyser.warn ? 1 : p < TIMED.geyser.warn + TIMED.geyser.active ? 2 : 0;
}
/** True while a gust of wind is blowing (and, with `warn`, for the steps just before). */
export function windBlowing(w: World, t: number, warn = false): boolean {
  const wind = w.course.def.wind;
  if (!wind) return false;
  const p = t % wind.period;
  return warn ? p >= wind.period - wind.warn || p < wind.on : p < wind.on;
}

/** The floor's height (in tiles) at a point, or null for a gap or a wall. */
function floorAt(w: World, x: number, y: number): number | null {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const t = tileAt(w, tx, ty);
  if (t.ch === '.' || t.ch === '=') return null;
  if (!t.slope) return t.level * LEVEL;
  const u = x - tx;
  const v = y - ty;
  const down = t.slope === 'E' ? u : t.slope === 'W' ? 1 - u : t.slope === 'S' ? v : 1 - v;
  return (t.level - down) * LEVEL;
}

const isWall = (w: World, x: number, y: number) => tileAt(w, Math.floor(x), Math.floor(y)).ch === '=';

/** True if the marble can't be there: a wall, or floor too far above it to step up onto. */
function blockedAt(w: World, s: RunState, x: number, y: number, axis: 'x' | 'y', sign: number): boolean {
  const R = BALL_RADIUS;
  const side = R * 0.7;
  for (let k = -1; k <= 1; k++) {
    const px = axis === 'x' ? x + sign * R : x + k * side;
    const py = axis === 'y' ? y + sign * R : y + k * side;
    if (isWall(w, px, py)) return true;
    const f = floorAt(w, px, py);
    if (f !== null && f > s.z + (s.grounded ? STEP_UP : 0.02)) return true;
  }
  return false;
}

export function newRun(w: World): RunState {
  const { x, y } = w.course.start;
  return {
    x, y, z: floorAt(w, x, y) ?? 0, vx: 0, vy: 0, vz: 0, grounded: true,
    steps: 0, held: 0, penalty: 0, refundable: 0, bonus: 0, falls: 0,
    respawnX: x, respawnY: y, safeSpots: [], checkpoints: [], outcome: 'running', finishSteps: 0, padCooldown: 0,
    gateChoices: w.course.gates.map(() => -1), pitStops: [], pitsPaid: [], gemsTaken: [],
  };
}

/** Time on the clock, in steps: count-up is the time so far; count-down is what is left. */
export function clockSteps(w: World, s: RunState): number {
  const used = s.steps + s.penalty;
  return w.mode === 'up' ? used : w.course.def.hardSeconds * 60 + s.bonus - used;
}

function fall(w: World, s: RunState): void {
  s.falls++;
  s.penalty += FALL_PENALTY_STEPS;
  s.refundable = FALL_PENALTY_STEPS;
  // Back onto the track: the newest safe tile reached at least SAFE_SPOT_AGE ago (so not right on the edge just gone over).
  const spots = s.safeSpots;
  let spot = -1;
  for (let i = spots.length - 2; i >= 0; i -= 2) {
    if (spots[i + 1] <= s.steps - SAFE_SPOT_AGE) {
      spot = spots[i];
      break;
    }
  }
  const W = w.course.width;
  s.x = spot >= 0 ? (spot % W) + 0.5 : s.respawnX;
  s.y = spot >= 0 ? Math.floor(spot / W) + 0.5 : s.respawnY;
  s.z = floorAt(w, s.x, s.y) ?? 0;
  // Start the list again from here, old enough to be used straight away if the marble falls again at once.
  const id = Math.floor(s.y) * W + Math.floor(s.x);
  s.safeSpots = [id, s.steps - SAFE_SPOT_AGE];
  s.vx = s.vy = s.vz = 0;
  s.grounded = true;
}

function checkClock(w: World, s: RunState): void {
  if (s.outcome !== 'running') return;
  const left = clockSteps(w, s);
  if (w.mode === 'down' ? left <= 0 : left >= MAX_RUN_STEPS) s.outcome = 'timeout';
}

/** Plays one 1/60-second step with one input. Changes `s`. Does nothing once the run is over. */
export function stepRun(w: World, s: RunState, input: number): void {
  if (s.outcome !== 'running') return;
  if (input === HOLD) {
    s.held++;
    return;
  }
  if (input === BONUS) {
    // A right answer at the stop the marble reached last: its value comes off the clock, once per stop.
    const stop = s.pitStops[s.pitStops.length - 1];
    if (stop !== undefined && !s.pitsPaid.includes(stop)) {
      s.pitsPaid.push(stop);
      s.penalty -= w.course.pitValue[stop];
    }
    return;
  }
  if (input === REFUND) {
    s.penalty -= s.refundable;
    s.refundable = 0;
    return;
  }
  const c = w.course;
  s.steps++;
  w.t = s.steps;
  const dir = DIRS[input] ?? DIRS[0];
  const here = tileAt(w, Math.floor(s.x), Math.floor(s.y));
  let max: number = SURFACES.normal.max;

  if (s.grounded) {
    const surf = SURFACES[here.surface];
    max = surf.max;
    let ax = dir[0] * STEER * surf.steer;
    let ay = dir[1] * STEER * surf.steer;
    if (here.slope) {
      const g = SLOPE_GRAVITY * LEVEL;
      if (here.slope === 'E') ax += g;
      else if (here.slope === 'W') ax -= g;
      else if (here.slope === 'S') ay += g;
      else ay -= g;
    }
    const belt = CONVEYORS[here.ch];
    if (belt) {
      ax += belt[0] * CONVEYOR_PUSH;
      ay += belt[1] * CONVEYOR_PUSH;
    }
    s.vx = (s.vx + ax * DT) * (1 - surf.drag);
    s.vy = (s.vy + ay * DT) * (1 - surf.drag);
  } else {
    s.vx += dir[0] * STEER * AIR_STEER * DT;
    s.vy += dir[1] * STEER * AIR_STEER * DT;
    s.vz -= AIR_GRAVITY * DT;
  }
  const wind = c.def.wind;
  if (wind && s.steps % wind.period < wind.on) {
    s.vx += wind.dx * wind.force * DT;
    s.vy += wind.dy * wind.force * DT;
  }
  const v2 = s.vx * s.vx + s.vy * s.vy;
  if (v2 > max * max) {
    const k = max / Math.sqrt(v2);
    s.vx *= k;
    s.vy *= k;
  }

  // Move along x, then y, bouncing off anything in the way.
  const nx = s.x + s.vx * DT;
  if (s.vx !== 0 && blockedAt(w, s, nx, s.y, 'x', s.vx > 0 ? 1 : -1)) s.vx = -s.vx * BOUNCE;
  else s.x = nx;
  const ny = s.y + s.vy * DT;
  if (s.vy !== 0 && blockedAt(w, s, s.x, ny, 'y', s.vy > 0 ? 1 : -1)) s.vy = -s.vy * BOUNCE;
  else s.y = ny;

  // Up and down.
  const floor = floorAt(w, s.x, s.y);
  let gone = false;
  if (s.grounded) {
    if (floor === null || floor < s.z - STEP_DOWN) {
      s.grounded = false;
      s.vz = 0;
    } else s.z = floor;
  }
  if (!s.grounded) {
    s.z += s.vz * DT;
    if (floor !== null && s.z <= floor) {
      if (-s.vz > OUCH_SPEED) gone = true;
      else {
        s.z = floor;
        s.vz = 0;
        s.grounded = true;
      }
    }
    if (s.z < c.floorMin - KILL_BELOW) gone = true;
  }
  if (gone) {
    fall(w, s);
    checkClock(w, s);
    return;
  }

  // What the marble is touching.
  if (s.padCooldown > 0) s.padCooldown--;
  const tx = Math.floor(s.x);
  const ty = Math.floor(s.y);
  const on = tileAt(w, tx, ty);
  // Remember safe tiles rolled onto, for falls.
  if (s.grounded && !on.slope && on.surface !== 'ice' && !UNSAFE_TILES.includes(on.ch)) {
    const id = ty * c.width + tx;
    const spots = s.safeSpots;
    if (spots[spots.length - 2] !== id) {
      spots.push(id, s.steps);
      if (spots.length > SAFE_SPOTS_KEPT * 2) spots.splice(0, 2);
    }
  }
  const tunnel = c.tunnelAt[ty * c.width + tx];
  if (tunnel) {
    const gate = (tunnel - 1) >> 3;
    if (s.gateChoices[gate] < 0) s.gateChoices[gate] = (tunnel - 1) & 7;
  }
  // Number gems: rolling through a right one takes a second off, up to five a run. Wrong gems do nothing, so they are not looked at.
  if (w.rightGems.length) {
    for (const id of w.rightGems) {
      if (s.gemsTaken.includes(id)) continue;
      const gem = c.gemList[id];
      const gx = s.x - gem.x;
      const gy = s.y - gem.y;
      if (gx * gx + gy * gy >= GEM_PICKUP_RADIUS * GEM_PICKUP_RADIUS) continue;
      s.gemsTaken.push(id);
      if (s.gemsTaken.length <= MAX_GEM_BONUSES) s.penalty -= GEM_BONUS_STEPS;
    }
  }
  if (on.ch === 'b') {
    const cx = tx + 0.5;
    const cy = ty + 0.5;
    const dx = s.x - cx;
    const dy = s.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < BUMPER_RADIUS * BUMPER_RADIUS) {
      const d = Math.sqrt(d2);
      const nxv = d < 1e-6 ? 0 : dx / d;
      const nyv = d < 1e-6 ? -1 : dy / d;
      s.x = cx + nxv * BUMPER_RADIUS;
      s.y = cy + nyv * BUMPER_RADIUS;
      s.vx = nxv * BUMPER_SPEED;
      s.vy = nyv * BUMPER_SPEED;
    }
  } else if (on.ch === 'g' && s.grounded && s.padCooldown === 0 && geyserPhase(s.steps, tx, ty) === 2) {
    s.grounded = false;
    s.vz = JUMP_SPEED * TIMED.geyser.boost;
    s.padCooldown = 30;
  } else if (on.ch === 'j' && s.grounded && s.padCooldown === 0) {
    s.grounded = false;
    s.vz = JUMP_SPEED;
    s.padCooldown = 30;
  } else if (on.ch === 'c') {
    const id = ty * c.width + tx;
    if (!s.checkpoints.includes(id)) {
      s.checkpoints.push(id);
      if (!s.pitStops.includes(c.pitAt[id])) s.pitStops.push(c.pitAt[id]);
      s.respawnX = tx + 0.5;
      s.respawnY = ty + 0.5;
      if (w.mode === 'down') s.bonus += CHECKPOINT_BONUS_STEPS;
    }
  } else if (on.ch === 'k' || on.ch === 'h') {
    const stop = c.pitAt[ty * c.width + tx];
    if (!s.pitStops.includes(stop)) s.pitStops.push(stop);
  } else if (on.ch === 'f') {
    s.outcome = 'finished';
    s.finishSteps = s.steps + s.penalty;
    return;
  }
  checkClock(w, s);
}

export interface ReplayResult {
  outcome: RunOutcome | 'unfinished';
  /** Clock steps at the finish (0 unless finished). */
  finishSteps: number;
  falls: number;
  checkpoints: number;
  held: number;
  steps: number;
  state: RunState;
}

/** Plays a recorded run from the start. Returns null if the inputs aren't well made. */
export function replay(course: Course, runs: InputRuns, options: RunOptions = {}): ReplayResult | null {
  const w = makeWorld(course, options);
  const s = newRun(w);
  let total = 0;
  for (const [code, n] of runs) {
    if (!Number.isInteger(code) || code < 0 || code > MAX_CODE || !Number.isInteger(n) || n < 1) return null;
    total += n;
    if (total > MAX_INPUT_STEPS) return null;
  }
  for (const [code, n] of runs) {
    for (let i = 0; i < n && s.outcome === 'running'; i++) stepRun(w, s, code);
    if (s.outcome !== 'running') break;
  }
  return {
    outcome: s.outcome === 'running' ? 'unfinished' : s.outcome,
    finishSteps: s.outcome === 'finished' ? s.finishSteps : 0,
    falls: s.falls,
    checkpoints: s.checkpoints.length,
    held: s.held,
    steps: s.steps,
    state: s,
  };
}

/** Every number in the state as text, so two runs can be compared exactly (and between browsers). */
export function stateKey(s: RunState): string {
  return [s.x, s.y, s.z, s.vx, s.vy, s.vz, s.grounded ? 1 : 0, s.steps, s.held, s.penalty, s.bonus, s.falls, s.checkpoints.join('.'), s.safeSpots.join('.'), s.gateChoices.join('.'), s.pitStops.join('.'), s.pitsPaid.join('.'), s.gemsTaken.join('.'), s.outcome, s.finishSteps].join('|');
}

/** Medal for a finish time in clock steps, or null. */
export function medalFor(course: Course, finishSteps: number, maths = false): 'gold' | 'silver' | 'bronze' | null {
  const sec = finishSteps / 60;
  const m = course.def.medals;
  // With maths the pit stops and gems can take seconds off, so gold is a little faster.
  return sec <= (maths ? (m.goldMaths ?? m.gold) : m.gold) ? 'gold' : sec <= m.silver ? 'silver' : sec <= m.bronze ? 'bronze' : null;
}

/** The floor's height (in tiles) under a point, or null over a gap or a wall. For drawing. */
export function floorHeightAt(w: World, x: number, y: number): number | null {
  return floorAt(w, x, y);
}

/** What a tile is, for drawing. Shut doors are walls. */
export function drawTileAt(w: World, tx: number, ty: number): Tile {
  return tileAt(w, tx, ty);
}
