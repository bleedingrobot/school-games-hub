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
  JUMP_SPEED, KILL_BELOW, LEVEL, MAX_RUN_STEPS, OUCH_SPEED, SLOPE_GRAVITY, STEER, STEP_DOWN, STEP_UP, SURFACES,
} from './config';
import type { Course, Tile } from './course';
import { HOLD, MAX_CODE, MAX_INPUT_STEPS, REFUND, type InputRuns } from './inputs';

export type ClockMode = 'up' | 'down';

export interface RunOptions {
  mode?: ClockMode;
  /** Which shortcut doors (0 = A, 1 = B …) are open. Decided before the run, never changed during it. */
  openDoors?: readonly number[];
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
  /** Respawn point: the start, or the last checkpoint reached. */
  respawnX: number;
  respawnY: number;
  /** Checkpoint tiles reached (their tile numbers), in order. */
  checkpoints: number[];
  outcome: RunOutcome;
  /** Clock steps at the finish, when finished. */
  finishSteps: number;
  /** Steps left before a jump pad can fire again, so one pad can't fire twice in a row. */
  padCooldown: number;
}

const R2 = 0.7071067811865476;
/** Index = input code. North is up the grid (smaller y). */
export const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [0, -1], [R2, -R2], [1, 0], [R2, R2], [0, 1], [-R2, R2], [-1, 0], [-R2, -R2],
];

const WALL: Tile = { ch: '=', level: 0, surface: 'normal', slope: null, door: -1 };
const VOID: Tile = { ch: '.', level: 0, surface: 'normal', slope: null, door: -1 };

export interface World {
  course: Course;
  mode: ClockMode;
  open: ReadonlySet<number>;
}

export function makeWorld(course: Course, options: RunOptions = {}): World {
  return { course, mode: options.mode ?? 'up', open: new Set(options.openDoors ?? []) };
}

function tileAt(w: World, tx: number, ty: number): Tile {
  const c = w.course;
  if (tx < 0 || ty < 0 || tx >= c.width || ty >= c.height) return VOID;
  const t = c.tiles[ty * c.width + tx];
  if (t.door >= 0) return w.open.has(t.door) ? { ...t, ch: '#' } : WALL;
  return t;
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
    respawnX: x, respawnY: y, checkpoints: [], outcome: 'running', finishSteps: 0, padCooldown: 0,
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
  s.x = s.respawnX;
  s.y = s.respawnY;
  s.z = floorAt(w, s.x, s.y) ?? 0;
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
  if (input === REFUND) {
    s.penalty -= s.refundable;
    s.refundable = 0;
    return;
  }
  const c = w.course;
  s.steps++;
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
    s.vx = (s.vx + ax * DT) * (1 - surf.drag);
    s.vy = (s.vy + ay * DT) * (1 - surf.drag);
  } else {
    s.vx += dir[0] * STEER * AIR_STEER * DT;
    s.vy += dir[1] * STEER * AIR_STEER * DT;
    s.vz -= AIR_GRAVITY * DT;
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
  } else if (on.ch === 'j' && s.grounded && s.padCooldown === 0) {
    s.grounded = false;
    s.vz = JUMP_SPEED;
    s.padCooldown = 30;
  } else if (on.ch === 'c') {
    const id = ty * c.width + tx;
    if (!s.checkpoints.includes(id)) {
      s.checkpoints.push(id);
      s.respawnX = tx + 0.5;
      s.respawnY = ty + 0.5;
      if (w.mode === 'down') s.bonus += CHECKPOINT_BONUS_STEPS;
    }
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
  return [s.x, s.y, s.z, s.vx, s.vy, s.vz, s.grounded ? 1 : 0, s.steps, s.held, s.penalty, s.bonus, s.falls, s.checkpoints.join('.'), s.outcome, s.finishSteps].join('|');
}

/** Medal for a finish time in clock steps, or null. */
export function medalFor(course: Course, finishSteps: number): 'gold' | 'silver' | 'bronze' | null {
  const sec = finishSteps / 60;
  const m = course.def.medals;
  return sec <= m.gold ? 'gold' : sec <= m.silver ? 'silver' : sec <= m.bronze ? 'bronze' : null;
}

/** The floor's height (in tiles) under a point, or null over a gap or a wall. For drawing. */
export function floorHeightAt(w: World, x: number, y: number): number | null {
  return floorAt(w, x, y);
}

/** What a tile is, for drawing. Shut doors are walls. */
export function drawTileAt(w: World, tx: number, ty: number): Tile {
  return tileAt(w, tx, ty);
}
