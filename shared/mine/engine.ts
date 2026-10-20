/**
 * Mine Runner's rules, as plain functions (docs/MINE-PLAN.md, section 4).
 *
 * `newRun` makes the starting state, `stepRun` moves it forward one 1/30-second step with one
 * input, and `replay` plays a whole recorded run. The same inputs always give exactly the same
 * run, in every browser and on the server, so the server can work out a run's real time itself.
 *
 * The state is plain numbers and small lists of plain objects: it can be saved, hashed and compared.
 * Everything that looks random (a robot's aim, how long it waits) comes from `state.rng`.
 */
import {
  CALM_RADIUS, DRAG, DT, ENERGY_PICKUP, ENERGY_REGEN, EXIT_RADIUS, KEY_DOOR_RANGE, KEY_RADIUS, LASER_COOLDOWN, LASER_COST, LASER_DAMAGE,
  LASER_LIFE, LASER_SPEED, LOSE_SIGHT_STEPS, MAX_ENERGY, MAX_MISSILES, MAX_PAD_BONUSES, MAX_RUN_STEPS, MAX_SHIELD, MAX_SPEED, MISSILE_COOLDOWN,
  MISSILE_DAMAGE, MISSILE_LIFE, MISSILE_PICKUP, MISSILE_SPEED, MISSILE_SPLASH, PAD_BONUS_STEPS, PAD_ENERGY, PAD_MISSILES, PAD_SHIELD,
  PICKUP_RADIUS, PROJECTILE_SUBSTEPS, REACTOR_HP, REACTOR_RADIUS, REBUILD_PENALTY_STEPS, REBUILD_SHIELD, ROBOTS, ROBOT_SHOT_LIFE, ACCEL,
  ROLL_UNIT, SHIELD_PICKUP, SHIP_RADIUS, SIGHT_EVERY, START_MISSILES, STEADY_PITCH_LIMIT, TURN_UNIT, USE_RANGE, WRONG_ANSWER_DAMAGE,
  WRONG_ANSWER_STEPS, type RobotType,
} from './config';
import { GRANT, HOLD, MAX_CODE, PENALTY, isSpecial, unpackInput, type InputRuns } from './inputs';
import { KEY_COLOURS, roomAt, type Level } from './level';

export interface World {
  level: Level;
  /** Steady flight keeps the ship level (up is always up). Decided before the run, never changed during it. */
  steady: boolean;
}

export type RunOutcome = 'running' | 'finished' | 'timeout';

export interface RobotState {
  type: RobotType;
  x: number;
  y: number;
  z: number;
  hp: number;
  alive: number;
  alert: number;
  /** 1 while it can see the ship (worked out every few steps). */
  seen: number;
  /** Steps until it can shoot again. */
  cool: number;
  /** Steps since it last saw the ship. */
  lost: number;
}

/** A shot in the air: 0 ship's laser, 1 ship's missile, 2 robot's shot. */
export interface Shot {
  k: 0 | 1 | 2;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  dmg: number;
}

export interface RunState {
  px: number; py: number; pz: number;
  vx: number; vy: number; vz: number;
  /** Which way the ship points (forward), its up, and its right: three arrows at right angles, each 1 long. */
  fx: number; fy: number; fz: number;
  ux: number; uy: number; uz: number;
  rx: number; ry: number; rz: number;
  shield: number;
  energy: number;
  missiles: number;
  laserCool: number;
  missileCool: number;
  /** Steps played (not counting held steps). */
  steps: number;
  held: number;
  /** Time added by rebuilds and wrong answers, in steps. */
  penalty: number;
  /** Time taken off by power-up pads, in steps. */
  bonus: number;
  padBonuses: number;
  /** Key colours held: blue, yellow, red. */
  keys: [number, number, number];
  doorsOpen: number[];
  padsUsed: number[];
  pickupsTaken: number[];
  robots: RobotState[];
  shots: Shot[];
  reactorHp: number;
  reactorDown: number;
  /** Steps left on the escape timer, once the reactor is down. */
  escapeLeft: number;
  lastRoom: number;
  rng: number;
  // Counts, for achievements and the results screen.
  deaths: number;
  wrongAnswers: number;
  damageTaken: number;
  robotsKilled: number;
  doorsByKey: number;
  doorsByAnswer: number;
  padsByAnswer: number;
  /** GRANTs that named something that wasn't there or was out of reach. A fair run has none. */
  badGrants: number;
  outcome: RunOutcome;
  /** The clock at the finish, in steps, when finished. */
  finishSteps: number;
}

export function makeWorld(level: Level, options: { steady?: boolean } = {}): World {
  return { level, steady: options.steady ?? true };
}

export function newRun(w: World): RunState {
  const { level } = w;
  const room = level.rooms[level.start];
  return {
    px: room.cx + 0.5, py: room.cy + 0.5, pz: room.cz + 0.5,
    vx: 0, vy: 0, vz: 0,
    fx: 0, fy: 1, fz: 0, ux: 0, uy: 0, uz: 1, rx: 1, ry: 0, rz: 0,
    shield: MAX_SHIELD, energy: MAX_ENERGY, missiles: START_MISSILES, laserCool: 0, missileCool: 0,
    steps: 0, held: 0, penalty: 0, bonus: 0, padBonuses: 0,
    keys: [0, 0, 0],
    doorsOpen: level.doors.map(() => 0),
    padsUsed: level.pads.map(() => 0),
    pickupsTaken: level.pickups.map(() => 0),
    robots: level.robots.map((r) => ({ type: r.type, x: r.x, y: r.y, z: r.z, hp: ROBOTS[r.type].hp, alive: 1, alert: 0, seen: 0, cool: 0, lost: 0 })),
    shots: [],
    reactorHp: REACTOR_HP, reactorDown: 0, escapeLeft: 0,
    lastRoom: level.start,
    rng: (level.recipe.seed % 2147483646) + 1,
    deaths: 0, wrongAnswers: 0, damageTaken: 0, robotsKilled: 0, doorsByKey: 0, doorsByAnswer: 0, padsByAnswer: 0, badGrants: 0,
    outcome: 'running', finishSteps: 0,
  };
}

/** What the clock shows, in steps: time played plus penalties, less pad bonuses. */
export function clockSteps(s: RunState): number {
  const n = s.steps + s.penalty - s.bonus;
  return n < 0 ? 0 : n;
}

function nextRandom(s: RunState): number {
  s.rng = (s.rng * 48271) % 2147483647;
  return s.rng;
}
/** A number from −1 to 1 in steps of 0.001. */
function jitter(s: RunState): number {
  return ((nextRandom(s) % 2001) - 1000) / 1000;
}

// ——— The mine ———

function solidAt(w: World, s: RunState, ix: number, iy: number, iz: number): boolean {
  const L = w.level;
  if (ix < 0 || iy < 0 || iz < 0 || ix >= L.nx || iy >= L.ny || iz >= L.nz) return true;
  const idx = ix + L.nx * (iy + L.ny * iz);
  if (L.solid[idx] === 1) return true;
  const d = L.doorAt[idx];
  return d >= 0 && s.doorsOpen[d] === 0;
}

/** Is there open space all the way from one point to another? */
function lineClear(w: World, s: RunState, ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const n = Math.ceil(len / 0.5);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (solidAt(w, s, Math.floor(ax + dx * t), Math.floor(ay + dy * t), Math.floor(az + dz * t))) return false;
  }
  return true;
}

interface Body {
  x: number;
  y: number;
  z: number;
}

/** Pushes a ball (a ship or a robot) out of the rock, and takes the speed out of the wall it hit. */
function pushOut(w: World, s: RunState, p: Body, r: number, v: Body | null): void {
  for (let pass = 0; pass < 3; pass++) {
    let hit = false;
    const x0 = Math.floor(p.x - r);
    const x1 = Math.floor(p.x + r);
    const y0 = Math.floor(p.y - r);
    const y1 = Math.floor(p.y + r);
    const z0 = Math.floor(p.z - r);
    const z1 = Math.floor(p.z + r);
    for (let z = z0; z <= z1; z++)
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          if (!solidAt(w, s, x, y, z)) continue;
          const cx = p.x < x ? x : p.x > x + 1 ? x + 1 : p.x;
          const cy = p.y < y ? y : p.y > y + 1 ? y + 1 : p.y;
          const cz = p.z < z ? z : p.z > z + 1 ? z + 1 : p.z;
          const dx = p.x - cx;
          const dy = p.y - cy;
          const dz = p.z - cz;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= r * r) continue;
          let nx: number;
          let ny: number;
          let nz: number;
          let push: number;
          if (d2 > 1e-12) {
            const d = Math.sqrt(d2);
            nx = dx / d;
            ny = dy / d;
            nz = dz / d;
            push = r - d;
          } else {
            // The middle of the ball is inside the block: leave by the nearest face.
            const gaps = [p.x - x, x + 1 - p.x, p.y - y, y + 1 - p.y, p.z - z, z + 1 - p.z];
            let best = 0;
            for (let g = 1; g < 6; g++) if (gaps[g] < gaps[best]) best = g;
            nx = best === 0 ? -1 : best === 1 ? 1 : 0;
            ny = best === 2 ? -1 : best === 3 ? 1 : 0;
            nz = best === 4 ? -1 : best === 5 ? 1 : 0;
            push = gaps[best] + r;
          }
          p.x += nx * push;
          p.y += ny * push;
          p.z += nz * push;
          if (v) {
            const vn = v.x * nx + v.y * ny + v.z * nz;
            if (vn < 0) {
              v.x -= nx * vn;
              v.y -= ny * vn;
              v.z -= nz * vn;
            }
          }
          hit = true;
        }
    if (!hit) break;
  }
}

// ——— Turning ———

/** sin and cos of a small angle using only add, subtract and multiply, so every device agrees. */
function smallSin(t: number): number {
  const t2 = t * t;
  return t * (1 - t2 / 6 + (t2 * t2) / 120);
}
function smallCos(t: number): number {
  const t2 = t * t;
  return 1 - t2 / 2 + (t2 * t2) / 24;
}

function turnShip(w: World, s: RunState, yaw: number, pitch: number, roll: number): void {
  if (yaw !== 0) {
    const t = yaw * TURN_UNIT;
    const c = smallCos(t);
    const n = smallSin(t);
    if (w.steady) {
      // Turn about straight-up, so the ship stays level.
      const fx = s.fx * c + s.fy * n;
      const fy = s.fy * c - s.fx * n;
      s.fx = fx;
      s.fy = fy;
    } else {
      const fx = s.fx * c + s.rx * n; const fy = s.fy * c + s.ry * n; const fz = s.fz * c + s.rz * n;
      s.rx = s.rx * c - s.fx * n; s.ry = s.ry * c - s.fy * n; s.rz = s.rz * c - s.fz * n;
      s.fx = fx; s.fy = fy; s.fz = fz;
    }
  }
  if (pitch !== 0) {
    const t = pitch * TURN_UNIT;
    const c = smallCos(t);
    const n = smallSin(t);
    const fx = s.fx * c + s.ux * n; const fy = s.fy * c + s.uy * n; const fz = s.fz * c + s.uz * n;
    if (!w.steady || (fz < STEADY_PITCH_LIMIT && fz > -STEADY_PITCH_LIMIT)) {
      s.ux = s.ux * c - s.fx * n; s.uy = s.uy * c - s.fy * n; s.uz = s.uz * c - s.fz * n;
      s.fx = fx; s.fy = fy; s.fz = fz;
    }
  }
  if (roll !== 0 && !w.steady) {
    const t = roll * ROLL_UNIT;
    const c = smallCos(t);
    const n = smallSin(t);
    const rx = s.rx * c + s.ux * n; const ry = s.ry * c + s.uy * n; const rz = s.rz * c + s.uz * n;
    s.ux = s.ux * c - s.rx * n; s.uy = s.uy * c - s.ry * n; s.uz = s.uz * c - s.rz * n;
    s.rx = rx; s.ry = ry; s.rz = rz;
  }
  // Tidy the three arrows so tiny errors never build up: forward first, then right, then up = right × forward.
  const fl = Math.sqrt(s.fx * s.fx + s.fy * s.fy + s.fz * s.fz);
  s.fx /= fl; s.fy /= fl; s.fz /= fl;
  if (w.steady) {
    s.rx = s.fy; s.ry = -s.fx; s.rz = 0;
  } else {
    const dot = s.rx * s.fx + s.ry * s.fy + s.rz * s.fz;
    s.rx -= s.fx * dot; s.ry -= s.fy * dot; s.rz -= s.fz * dot;
  }
  const rl = Math.sqrt(s.rx * s.rx + s.ry * s.ry + s.rz * s.rz);
  s.rx /= rl; s.ry /= rl; s.rz /= rl;
  s.ux = s.ry * s.fz - s.rz * s.fy;
  s.uy = s.rz * s.fx - s.rx * s.fz;
  s.uz = s.rx * s.fy - s.ry * s.fx;
}

// ——— One step ———

function dist(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function hurtShip(s: RunState, dmg: number): void {
  s.shield -= dmg;
  s.damageTaken += dmg;
}

function hurtRobot(s: RunState, r: RobotState, dmg: number): void {
  if (!r.alive) return;
  r.hp -= dmg;
  r.alert = 1;
  r.lost = 0;
  if (r.hp <= 0) {
    r.alive = 0;
    s.robotsKilled++;
  }
}

function hurtReactor(s: RunState, w: World, dmg: number): void {
  if (s.reactorDown) return;
  s.reactorHp -= dmg;
  if (s.reactorHp <= 0) {
    s.reactorHp = 0;
    s.reactorDown = 1;
    s.escapeLeft = w.level.escapeSteps;
  }
}

function explode(w: World, s: RunState, x: number, y: number, z: number): void {
  for (const r of s.robots) {
    if (!r.alive) continue;
    const d = dist(x, y, z, r.x, r.y, r.z) - ROBOTS[r.type].radius;
    if (d < MISSILE_SPLASH) hurtRobot(s, r, MISSILE_DAMAGE * (1 - (d < 0 ? 0 : d) / (MISSILE_SPLASH + 1)));
  }
  const R = w.level.reactor;
  if (dist(x, y, z, R.x, R.y, R.z) - REACTOR_RADIUS < MISSILE_SPLASH) hurtReactor(s, w, MISSILE_DAMAGE);
}

function fire(s: RunState, k: 0 | 1, speed: number, life: number, dmg: number): void {
  s.shots.push({ k, x: s.px + s.fx * 0.6, y: s.py + s.fy * 0.6, z: s.pz + s.fz * 0.6, vx: s.fx * speed, vy: s.fy * speed, vz: s.fz * speed, life, dmg });
}

function openDoor(w: World, s: RunState, id: number): void {
  s.doorsOpen[id] = 1;
  void w;
}

function rebuild(w: World, s: RunState): void {
  const room = w.level.rooms[s.lastRoom];
  s.px = room.cx + 0.5; s.py = room.cy + 0.5; s.pz = room.cz + 0.5;
  s.vx = 0; s.vy = 0; s.vz = 0;
  s.shield = REBUILD_SHIELD;
  s.penalty += REBUILD_PENALTY_STEPS;
  s.deaths++;
  s.shots = s.shots.filter((shot) => shot.k !== 2);
  for (const r of s.robots) if (r.alive && dist(r.x, r.y, r.z, s.px, s.py, s.pz) < CALM_RADIUS) {
    r.alert = 0;
    r.seen = 0;
    r.lost = 0;
  }
}

/** A special step: nothing moves and the clock stops, but a GRANT or PENALTY may change things. */
function stepSpecial(w: World, s: RunState, code: number): void {
  s.held++;
  if (code === HOLD) return;
  if (code === PENALTY) {
    s.wrongAnswers++;
    s.shield = s.shield - WRONG_ANSWER_DAMAGE < 1 ? 1 : s.shield - WRONG_ANSWER_DAMAGE;
    s.damageTaken += WRONG_ANSWER_DAMAGE;
    s.penalty += WRONG_ANSWER_STEPS;
    return;
  }
  const L = w.level;
  const id = code - GRANT;
  if (id < L.doors.length) {
    const door = L.doors[id];
    if (door.kind !== 'question' || s.doorsOpen[id] === 1 || dist(s.px, s.py, s.pz, door.x, door.y, door.z) > USE_RANGE) {
      s.badGrants++;
      return;
    }
    openDoor(w, s, id);
    s.doorsByAnswer++;
    return;
  }
  const n = id - L.doors.length;
  const pad = L.pads[n];
  if (!pad || s.padsUsed[n] === 1 || dist(s.px, s.py, s.pz, pad.x, pad.y, pad.z) > USE_RANGE) {
    s.badGrants++;
    return;
  }
  s.padsUsed[n] = 1;
  s.padsByAnswer++;
  if (pad.kind === 'shield') s.shield = Math.max(s.shield, PAD_SHIELD);
  else if (pad.kind === 'energy') s.energy = Math.max(s.energy, PAD_ENERGY);
  else s.missiles = Math.min(MAX_MISSILES, s.missiles + PAD_MISSILES);
  if (s.padBonuses < MAX_PAD_BONUSES) {
    s.padBonuses++;
    s.bonus += PAD_BONUS_STEPS;
  }
}

export function stepRun(w: World, s: RunState, code: number): void {
  if (s.outcome !== 'running') return;
  if (isSpecial(code)) {
    if (code > MAX_CODE) return;
    stepSpecial(w, s, code);
    return;
  }
  const L = w.level;
  const input = unpackInput(code);

  // Turn, then push.
  turnShip(w, s, input.yaw, input.pitch, input.roll);
  let ax = s.rx * input.tx + s.ux * input.ty + s.fx * input.tz;
  let ay = s.ry * input.tx + s.uy * input.ty + s.fy * input.tz;
  let az = s.rz * input.tx + s.uz * input.ty + s.fz * input.tz;
  const want = input.tx * input.tx + input.ty * input.ty + input.tz * input.tz;
  if (want > 1) {
    const k = 1 / Math.sqrt(want);
    ax *= k; ay *= k; az *= k;
  }
  s.vx = (s.vx + ax * ACCEL * DT) * (1 - DRAG);
  s.vy = (s.vy + ay * ACCEL * DT) * (1 - DRAG);
  s.vz = (s.vz + az * ACCEL * DT) * (1 - DRAG);
  const speed2 = s.vx * s.vx + s.vy * s.vy + s.vz * s.vz;
  if (speed2 > MAX_SPEED * MAX_SPEED) {
    const k = MAX_SPEED / Math.sqrt(speed2);
    s.vx *= k; s.vy *= k; s.vz *= k;
  }
  const ship: Body = { x: s.px + s.vx * DT, y: s.py + s.vy * DT, z: s.pz + s.vz * DT };
  const vel: Body = { x: s.vx, y: s.vy, z: s.vz };
  pushOut(w, s, ship, SHIP_RADIUS, vel);
  s.px = ship.x; s.py = ship.y; s.pz = ship.z;
  s.vx = vel.x; s.vy = vel.y; s.vz = vel.z;

  // Doors that open for a key.
  L.doors.forEach((door, id) => {
    if (door.kind === 'question' || s.doorsOpen[id] === 1) return;
    const c = KEY_COLOURS.indexOf(door.kind);
    if (s.keys[c] === 1 && dist(s.px, s.py, s.pz, door.x, door.y, door.z) < KEY_DOOR_RANGE) {
      openDoor(w, s, id);
      s.doorsByKey++;
    }
  });

  // Keys and pickups.
  for (const key of L.keys) {
    const c = KEY_COLOURS.indexOf(key.colour);
    if (s.keys[c] === 0 && dist(s.px, s.py, s.pz, key.x, key.y, key.z) < KEY_RADIUS) s.keys[c] = 1;
  }
  L.pickups.forEach((p, n) => {
    if (s.pickupsTaken[n] === 1 || dist(s.px, s.py, s.pz, p.x, p.y, p.z) >= PICKUP_RADIUS) return;
    if (p.kind === 'shield' && s.shield < MAX_SHIELD) s.shield = Math.min(MAX_SHIELD, s.shield + SHIELD_PICKUP);
    else if (p.kind === 'energy' && s.energy < MAX_ENERGY) s.energy = Math.min(MAX_ENERGY, s.energy + ENERGY_PICKUP);
    else if (p.kind === 'missiles' && s.missiles < MAX_MISSILES) s.missiles = Math.min(MAX_MISSILES, s.missiles + MISSILE_PICKUP);
    else return;
    s.pickupsTaken[n] = 1;
  });

  // The ship's weapons.
  if (input.fire && s.laserCool <= 0 && s.energy >= LASER_COST) {
    s.energy -= LASER_COST;
    s.laserCool = LASER_COOLDOWN;
    fire(s, 0, LASER_SPEED, LASER_LIFE, LASER_DAMAGE);
  }
  if (input.missile && s.missileCool <= 0 && s.missiles > 0) {
    s.missiles--;
    s.missileCool = MISSILE_COOLDOWN;
    fire(s, 1, MISSILE_SPEED, MISSILE_LIFE, MISSILE_DAMAGE);
  }
  if (s.laserCool > 0) s.laserCool--;
  if (s.missileCool > 0) s.missileCool--;
  s.energy = s.energy + ENERGY_REGEN > MAX_ENERGY ? MAX_ENERGY : s.energy + ENERGY_REGEN;

  // Shots fly in small steps so a fast one can't pass through a wall or a robot.
  const R = L.reactor;
  const kept: Shot[] = [];
  for (const shot of s.shots) {
    let gone = false;
    shot.life--;
    for (let sub = 0; sub < PROJECTILE_SUBSTEPS && !gone; sub++) {
      shot.x += shot.vx / PROJECTILE_SUBSTEPS;
      shot.y += shot.vy / PROJECTILE_SUBSTEPS;
      shot.z += shot.vz / PROJECTILE_SUBSTEPS;
      if (solidAt(w, s, Math.floor(shot.x), Math.floor(shot.y), Math.floor(shot.z))) {
        if (shot.k === 1) explode(w, s, shot.x, shot.y, shot.z);
        gone = true;
        break;
      }
      if (shot.k === 2) {
        if (dist(shot.x, shot.y, shot.z, s.px, s.py, s.pz) < SHIP_RADIUS + 0.3) {
          hurtShip(s, shot.dmg);
          gone = true;
        }
        continue;
      }
      for (const r of s.robots) {
        if (!r.alive) continue;
        if (dist(shot.x, shot.y, shot.z, r.x, r.y, r.z) < ROBOTS[r.type].radius + 0.15) {
          if (shot.k === 1) explode(w, s, shot.x, shot.y, shot.z);
          else hurtRobot(s, r, shot.dmg);
          gone = true;
          break;
        }
      }
      if (!gone && !s.reactorDown && dist(shot.x, shot.y, shot.z, R.x, R.y, R.z) < REACTOR_RADIUS + 0.15) {
        if (shot.k === 1) explode(w, s, shot.x, shot.y, shot.z);
        else hurtReactor(s, w, shot.dmg);
        gone = true;
      }
    }
    if (!gone && shot.life > 0) kept.push(shot);
  }
  s.shots = kept;

  // Robots.
  s.robots.forEach((r, i) => {
    if (!r.alive) return;
    const spec = ROBOTS[r.type];
    const dx = s.px - r.x;
    const dy = s.py - r.y;
    const dz = s.pz - r.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if ((s.steps + i) % SIGHT_EVERY === 0) {
      r.seen = d < spec.sight && lineClear(w, s, r.x, r.y, r.z, s.px, s.py, s.pz) ? 1 : 0;
      if (r.seen) {
        r.alert = 1;
        r.lost = 0;
      } else if (r.alert) {
        r.lost += SIGHT_EVERY;
        if (r.lost >= LOSE_SIGHT_STEPS) r.alert = 0;
      }
    }
    if (r.cool > 0) r.cool--;
    if (!r.alert || !r.seen) return;
    if (spec.speed > 0 && d > spec.keepAway) {
      const body: Body = { x: r.x + (dx / d) * spec.speed * DT, y: r.y + (dy / d) * spec.speed * DT, z: r.z + (dz / d) * spec.speed * DT };
      pushOut(w, s, body, spec.radius, null);
      r.x = body.x; r.y = body.y; r.z = body.z;
    }
    if (r.cool <= 0 && d < spec.sight) {
      const ax2 = dx + jitter(s) * spec.spread * d;
      const ay2 = dy + jitter(s) * spec.spread * d;
      const az2 = dz + jitter(s) * spec.spread * d;
      const al = Math.sqrt(ax2 * ax2 + ay2 * ay2 + az2 * az2);
      s.shots.push({ k: 2, x: r.x, y: r.y, z: r.z, vx: (ax2 / al) * spec.shotSpeed, vy: (ay2 / al) * spec.shotSpeed, vz: (az2 / al) * spec.shotSpeed, life: ROBOT_SHOT_LIFE, dmg: spec.damage });
      r.cool = spec.cooldown + (nextRandom(s) % 8);
    }
  });

  // Which room are we in, and the end of the level.
  const here = roomAt(L, s.px, s.py, s.pz);
  if (here >= 0) s.lastRoom = here;
  s.steps++;
  if (s.reactorDown) {
    if (dist(s.px, s.py, s.pz, L.exit.x, L.exit.y, L.exit.z) < EXIT_RADIUS) {
      s.outcome = 'finished';
      s.finishSteps = clockSteps(s);
      return;
    }
    s.escapeLeft--;
    if (s.escapeLeft <= 0) {
      s.outcome = 'timeout';
      return;
    }
  }
  if (s.shield <= 0) rebuild(w, s);
  if (s.steps >= MAX_RUN_STEPS) s.outcome = 'timeout';
}

/** Plays a recorded run from the start. Stops at the finish, at a timeout or at the end of the inputs. */
export function replay(w: World, runs: InputRuns): RunState {
  const s = newRun(w);
  for (const [code, n] of runs) {
    for (let i = 0; i < n && s.outcome === 'running'; i++) stepRun(w, s, code);
    if (s.outcome !== 'running') break;
  }
  return s;
}

/** The whole state as text, for tests and the determinism check. */
export function stateKey(s: RunState): string {
  const parts: (string | number)[] = [
    s.px, s.py, s.pz, s.vx, s.vy, s.vz, s.fx, s.fy, s.fz, s.ux, s.uy, s.uz, s.rx, s.ry, s.rz,
    s.shield, s.energy, s.missiles, s.steps, s.held, s.penalty, s.bonus, s.keys.join(''), s.doorsOpen.join(''), s.padsUsed.join(''), s.pickupsTaken.join(''),
    s.reactorHp, s.escapeLeft, s.lastRoom, s.rng, s.deaths, s.wrongAnswers, s.robotsKilled, s.outcome, s.finishSteps,
  ];
  for (const r of s.robots) parts.push(`${r.x},${r.y},${r.z},${r.hp},${r.alert},${r.cool}`);
  for (const t of s.shots) parts.push(`${t.k},${t.x},${t.y},${t.z},${t.life}`);
  return parts.join('|');
}
