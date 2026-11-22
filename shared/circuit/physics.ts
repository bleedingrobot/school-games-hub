/**
 * Circuit Racer's physics as one pure function (docs/CIRCUIT-PLAN.md, section 2).
 *
 * `newRace` makes the starting state and `step(state, input, road)` gives the next state 1/30 s later, plus what
 * happened (events for sounds and sparks). Nothing else changes: the same inputs give exactly the same run on
 * every device and on the server, which replays a run's inputs (`replay`) to check its finish and time.
 *
 * The ideas follow OpenRoads (github.com/praveenscience/OpenRoads-SkyRoads-Clone, MIT licence,
 * copyright (c) 2014 anprogrammer), which copies how the 1993 game SkyRoads moves its ship: fixed steps, move in
 * small tries and stop flush against anything solid, a sideways nudge off clipped corners, crash or bonk by speed,
 * half-speed bounces, sliding off half-landed ledges, a jump helper that tries ±10% to ±60%, fuel by speed and air
 * by time, and inputs recorded by distance. The code and units here are our own, tuned for 8 to 11 year olds.
 *
 * Space: x across the road (lane i is x from i to i+1), y up (floor tops at 0), z along the road (row r is z from r
 * to r+1). The racer is a point for hitting things, HALF_WIDTH wide for the ledge slip.
 */
import {
  ACCEL, AIR_STEER_STEPS, AUTO_PILOT_AT, AUTO_PILOT_LOOK, AUTO_PILOT_TRIES, BATTERY_LINEAR, BATTERY_SQUARED, BOUNCE, BOUNCE_MIN, BOUNCE_ON, BRAKE,
  CRASH_SPEED, DT, FALL_LIMIT, FLOOR_THICKNESS, FULL, HALF_REFILL, HALF_WIDTH, JUMP_SPEED, LEDGE_SLIP, LOW_BRAKE_SHARE, LOW_SPEED, MAX_FALL_SPEED,
  MAX_RUN_STEPS, NO_JUMP_GRAVITY, OVERCLOCK_ACCEL, RESISTOR_DRAG, RESTART_DELAY_STEPS, SCRAPE_SLOW, SLOTS_PER_ROW, START_X, START_Z,
  SUBSTEPS, TOP_SPEED, TUNNEL_ROOF, TUNNEL_ROOF_THICKNESS, TURN_AT_REST, TURN_RATE, WALL_NUDGE,
} from './config';
import { decodeInput, inputPlayer, type Input, type InputLog } from './inputs';
import { cellAt, restartLane, topOf, type Road } from './road';

/** 'outOfTime': hard mode's count-down clock ran out (the whole road starts again; no checkpoint). */
export type Outcome = 'racing' | 'finished' | 'crashed' | 'fell' | 'outOfBattery' | 'outOfSignal' | 'outOfTime';
export type RaceEvent =
  | 'jump' | 'land' | 'bounce' | 'bonk' | 'nudge' | 'scrape' | 'crash' | 'fall' | 'recharge' | 'finish' | 'outOfBattery' | 'outOfSignal' | 'autopilot'
  /** Maths on: the racer has just reached a recharge port (the screen pauses for its question before the next step). */
  | 'port'
  /** The racer has just crossed a data gate's split row (its lane is in `choices`). */
  | 'gate'
  /** The racer has just passed a checkpoint (Stage 4), or has just restarted at one. */
  | 'checkpoint' | 'respawn' | 'outOfTime';

export interface RaceState {
  x: number;
  y: number;
  z: number;
  /** Up speed (units/s) and forward speed (rows/s). */
  vy: number;
  vz: number;
  /** The steering held: -1 left, 0, 1 right. Fixed in the air after the first few steps. */
  steer: number;
  /** Auto-Pilot's change to the steering (1 = none). */
  steerScale: number;
  /** Sideways speed from sliding off a ledge, lanes/s. */
  slide: number;
  grounded: boolean;
  /** In the air from the player's own jump (not a fall or a bounce). */
  jumping: boolean;
  airSteps: number;
  /** Auto-Pilot is allowed on this run (off in hard mode). */
  autoPilot: boolean;
  /** Auto-Pilot has checked this jump. */
  autoPilotChecked: boolean;
  /** Auto-Pilot is saving this jump (the dashboard light). */
  autoPilotOn: boolean;
  /** Speed Auto-Pilot took away (or added) to save the jump, given back on landing. */
  autoPilotGiveBack: number;
  battery: number;
  signal: number;
  outcome: Outcome;
  /** Steps raced. At the finish this is the time (steps / 30 = seconds). */
  steps: number;
  /** Steps since the run ended (a restart comes at RESTART_DELAY_STEPS). */
  deadSteps: number;
  /** Distance slot (for recording inputs) and steps spent in it. */
  slot: number;
  slotSteps: number;
  /** The row of the last recharge port touched, and how many ports were used. */
  lastPortRow: number;
  ports: number;
  /**
   * Maths on: what each recharge port refills to, a share of FULL (1 for a right answer, HALF_REFILL otherwise), from the
   * server's marks. Null with maths off: ports refill fully, as in Stage 2. The screen fills this list in as answers are
   * marked (a port's share is only read on the step after it is reached, while the race waits for the answer).
   */
  refills: readonly number[] | null;
  /** Maths on: each data gate's right lane (from the seed). Null with maths off: every gate lane is overclock. */
  gateRight: readonly number[] | null;
  /** Ports already used (bit p for port p), with maths on: each refills once a go. */
  portsUsed: number;
  /** A port reached on the last step, waiting to refill (-1 if none). */
  pendingPort: number;
  /** Gates crossed so far, and the lane the racer was in at each split row (-1: not crossed). */
  gatesPassed: number;
  choices: readonly number[];
  /** The gate whose right lane the racer took at the split (its lane is overclock), or -1. */
  boostGate: number;
  /**
   * Checkpoints (Stage 4): the last one passed (-1: none) and the battery and signal when it was passed. After a crash, a
   * fall or running flat, the physics itself restarts the racer there once RESTART_DELAY_STEPS have passed (the time keeps
   * counting), so a run with checkpoint restarts is still one recording from the start, replayed exactly by the server.
   */
  checkpoint: number;
  checkpointBattery: number;
  checkpointSignal: number;
  /** Restarts at a checkpoint so far. Each one moves the input slots on (slotOf), so recorded slots only ever go up. */
  lives: number;
  /** Hard mode's clock: the run ends 'outOfTime' at this many steps (0: no clock). */
  timeLimit: number;
}

export interface RaceOptions {
  /** False in hard mode. */
  autoPilot?: boolean;
  /** Maths on: see RaceState.refills and RaceState.gateRight. */
  refills?: readonly number[] | null;
  gateRight?: readonly number[] | null;
  /** Hard mode's count-down clock, in steps (0 or missing: none). */
  timeLimit?: number;
}

/** Input slots one life (one go from the start or a checkpoint) can use: a whole road's worth, so lives never overlap. */
const lifeSlots = (road: Road): number => (road.length + 2) * SLOTS_PER_ROW;
/** The input slot for a place on the road in a life (inputs.ts). */
export const slotOf = (road: Road, z: number, lives: number): number => Math.floor(z * SLOTS_PER_ROW) + lives * lifeSlots(road);

const EPS = 1e-6;

export function newRace(road: Road, opts: RaceOptions = {}): RaceState {
  return {
    x: START_X, y: 0, z: START_Z, vy: 0, vz: 0, steer: 0, steerScale: 1, slide: 0, grounded: true, jumping: false, airSteps: 0,
    autoPilot: opts.autoPilot ?? true, autoPilotChecked: false, autoPilotOn: false, autoPilotGiveBack: 0,
    battery: FULL, signal: FULL, outcome: 'racing', steps: 0, deadSteps: 0,
    slot: Math.floor(START_Z * SLOTS_PER_ROW), slotSteps: 0, lastPortRow: -2, ports: 0,
    refills: opts.refills ?? null, gateRight: opts.gateRight ?? null, portsUsed: 0, pendingPort: -1,
    gatesPassed: 0, choices: road.gates.map(() => -1), boostGate: -1,
    checkpoint: -1, checkpointBattery: FULL, checkpointSignal: FULL, lives: 0, timeLimit: opts.timeLimit ?? 0,
  };
}

/** True if the point is inside something solid. */
export function solid(road: Road, x: number, y: number, z: number): boolean {
  const c = cellAt(road, Math.floor(x), Math.floor(z));
  if (c === '.' || y <= -FLOOR_THICKNESS) return false;
  if (c === 't') return y < 0 || (y > TUNNEL_ROOF && y < TUNNEL_ROOF + TUNNEL_ROOF_THICKNESS);
  return y < (topOf(c) ?? 0);
}

/** The top and bottom of the solid piece at a point (the point must be inside it). */
function pieceAt(road: Road, x: number, y: number, z: number): { top: number; bottom: number } {
  const c = cellAt(road, Math.floor(x), Math.floor(z));
  if (c === 't') return y < 0 ? { top: 0, bottom: -FLOOR_THICKNESS } : { top: TUNNEL_ROOF + TUNNEL_ROOF_THICKNESS, bottom: TUNNEL_ROOF };
  return { top: topOf(c) ?? 0, bottom: -FLOOR_THICKNESS };
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** True when the whole road must start again (no checkpoint passed, or the hard-mode clock ran out). */
export function readyToRestart(s: RaceState): boolean {
  return s.outcome !== 'racing' && s.outcome !== 'finished' && s.deadSteps >= RESTART_DELAY_STEPS && (s.checkpoint < 0 || s.outcome === 'outOfTime');
}

/** Can this ended run go on (a checkpoint restart still to come)? */
export const willRespawn = (s: RaceState): boolean =>
  s.outcome !== 'racing' && s.outcome !== 'finished' && s.outcome !== 'outOfTime' && s.checkpoint >= 0;

/**
 * Restarts at the last checkpoint passed: standing still on its plain trace nearest the middle, with the battery and signal
 * it had there. Ports after the checkpoint can be used again (a known answer refills without asking), gates after it are
 * crossed again. The time includes the 1.5 s pause.
 */
function respawn(s: RaceState, road: Road): void {
  const row = road.checkpoints[s.checkpoint];
  Object.assign(s, {
    x: restartLane(road, row) + 0.5, y: 0, z: row + 0.5, vy: 0, vz: 0, steer: 0, steerScale: 1, slide: 0, grounded: true, jumping: false, airSteps: 0,
    autoPilotChecked: false, autoPilotOn: false, autoPilotGiveBack: 0, battery: s.checkpointBattery, signal: s.checkpointSignal,
    outcome: 'racing', deadSteps: 0, lives: s.lives + 1, slotSteps: 0, lastPortRow: -2, pendingPort: -1, boostGate: -1,
  } satisfies Partial<RaceState>);
  s.slot = slotOf(road, s.z, s.lives);
  road.ports.forEach((p, i) => {
    if (p.first >= row) s.portsUsed &= ~(1 << i);
  });
  s.gatesPassed = road.gates.filter((g) => g.first < row).length;
  s.steps += RESTART_DELAY_STEPS;
}

/** One step of the race. Pure: `prev` is not changed. */
export function step(prev: RaceState, input: Input, road: Road): { state: RaceState; events: RaceEvent[] } {
  const s: RaceState = { ...prev };
  const events: RaceEvent[] = [];
  if (s.outcome !== 'racing') {
    if (s.outcome !== 'finished') s.deadSteps++;
    if (s.deadSteps >= RESTART_DELAY_STEPS && willRespawn(s)) {
      respawn(s, road);
      events.push('respawn');
    }
    return { state: s, events };
  }
  const g = road.def.gravity;

  // Auto-Pilot: near the top of a jump, check it lands; if not, try small changes until it would.
  if (s.autoPilot && s.jumping && !s.autoPilotChecked && s.vy <= JUMP_SPEED * AUTO_PILOT_AT) {
    s.autoPilotChecked = true;
    if (runAutoPilot(s, input, road)) events.push('autopilot');
  }

  // A port reached last step refills now, by its answer (the screen waited for it in between).
  if (s.pendingPort >= 0) {
    const level = FULL * Math.min(1, Math.max(HALF_REFILL, s.refills?.[s.pendingPort] ?? HALF_REFILL));
    s.battery = Math.max(s.battery, level);
    s.signal = Math.max(s.signal, level);
    s.pendingPort = -1;
    events.push('recharge');
  }

  // What the racer is touching.
  const row = Math.floor(s.z);
  const onTile = s.grounded && s.y < EPS * 10 && s.y > -EPS * 10;
  const under = onTile ? cellAt(road, Math.floor(s.x), row) : '.';
  // A gate lane is overclock with maths off, and with maths on only the right lane, for a racer who took it at the split.
  const boosted = under === '?' && (s.gateRight === null || (s.boostGate === road.gateAt[row] && Math.floor(s.x) === s.gateRight[s.boostGate]));
  if (under === '>' || boosted) s.vz += OVERCLOCK_ACCEL * DT;
  else if (under === 'r') s.vz -= RESISTOR_DRAG * DT;
  else if (under === 'x') return end(s, events, 'crashed', 'crash');
  else if (under === '+' && s.refills) {
    const p = road.portAt[row];
    if (p >= 0 && p < 30 && !(s.portsUsed & (1 << p))) {
      s.portsUsed |= 1 << p;
      s.pendingPort = p;
      s.ports++;
      events.push('port');
    }
  } else if (under === '+') {
    s.battery = FULL;
    s.signal = FULL;
    if (row > s.lastPortRow + 1) {
      s.ports++;
      events.push('recharge');
    }
    s.lastPortRow = row;
  }

  // Forward speed (the pedal works in the air too, as in OpenRoads).
  if (input.accel > 0) s.vz += ACCEL * DT;
  else if (input.accel < 0) s.vz -= (s.vz < LOW_SPEED ? BRAKE * LOW_BRAKE_SHARE : BRAKE) * DT;
  s.vz = clamp(s.vz, 0, TOP_SPEED);

  // Steering: on the ground (not on gel), or just after take-off.
  if (under !== 'g' && (s.grounded || (s.jumping && s.airSteps < AIR_STEER_STEPS))) {
    if (s.steer !== input.turn) s.steerScale = 1;
    s.steer = input.turn;
  }

  // Jump.
  if (input.jump && s.grounded && g < NO_JUMP_GRAVITY) {
    s.vy = JUMP_SPEED;
    s.grounded = false;
    s.jumping = true;
    s.airSteps = 0;
    s.autoPilotChecked = false;
    events.push('jump');
  }

  // Gravity (on the ground too: the floor stops it, which is how the racer knows it's still on the floor).
  s.vy = Math.max(s.vy - g * DT, -MAX_FALL_SPEED);
  if (!s.grounded) s.airSteps++;

  const wasGrounded = s.grounded;
  const hit = move(s, road, events);
  if (hit === 'crash') return end(s, events, 'crashed', 'crash');

  if (hit === 'scrape') {
    s.vz = Math.max(0, s.vz - SCRAPE_SLOW);
    s.slide = 0;
    events.push('scrape');
  }
  if (hit === 'land') {
    if (s.y === 0 && cellAt(road, Math.floor(s.x), Math.floor(s.z)) === 'x') return end(s, events, 'crashed', 'crash');
    const fall = -s.vy;
    if (BOUNCE_ON && fall > BOUNCE_MIN) {
      s.vy = fall * BOUNCE;
      s.grounded = false;
      events.push('bounce');
    } else {
      s.vy = 0;
      s.grounded = true;
      if (!wasGrounded) events.push('land');
    }
    if (s.jumping) {
      s.jumping = false;
      s.vz = clamp(s.vz + s.autoPilotGiveBack, 0, TOP_SPEED);
      s.autoPilotGiveBack = 0;
      s.autoPilotOn = false;
      s.steerScale = 1;
    }
  } else {
    s.grounded = false;
  }

  // Ledge slip: half over an edge, slide off it.
  if (s.grounded) {
    const left = solid(road, s.x - HALF_WIDTH, s.y - 0.01, s.z);
    const right = solid(road, s.x + HALF_WIDTH, s.y - 0.01, s.z);
    if (left && right) s.slide = 0;
    else if (!left && right) s.slide -= LEDGE_SLIP * DT;
    else if (left && !right) s.slide += LEDGE_SLIP * DT;
  }

  // Crossing a gate's split row: the lane the racer is in is its answer.
  while (s.gatesPassed < road.gates.length && s.z >= road.gates[s.gatesPassed].first) {
    const g = s.gatesPassed++;
    const lane = Math.floor(s.x);
    const choices = [...s.choices];
    choices[g] = lane;
    s.choices = choices;
    s.boostGate = s.gateRight !== null && s.gateRight[g] === lane ? g : -1;
    events.push('gate');
  }

  // Passing a checkpoint keeps the battery and signal it had there for a restart.
  while (s.checkpoint + 1 < road.checkpoints.length && s.z >= road.checkpoints[s.checkpoint + 1]) {
    s.checkpoint++;
    s.checkpointBattery = s.battery;
    s.checkpointSignal = s.signal;
    events.push('checkpoint');
  }

  s.steps++;
  const slot = slotOf(road, s.z, s.lives);
  if (slot !== s.slot) {
    s.slot = slot;
    s.slotSteps = 0;
  } else s.slotSteps++;

  if (s.y < FALL_LIMIT) return end(s, events, 'fell', 'fall');
  if (s.z >= road.length && s.y > -0.5) return end(s, events, 'finished', 'finish');

  // Battery by speed, signal by time.
  const share = s.vz / TOP_SPEED;
  s.battery -= (FULL / road.def.battery) * (BATTERY_LINEAR * share + BATTERY_SQUARED * share * share) * DT;
  s.signal -= (FULL / road.def.signal) * DT;
  if (s.battery <= EPS) {
    s.battery = 0;
    return end(s, events, 'outOfBattery', 'outOfBattery');
  }
  if (s.signal <= EPS) {
    s.signal = 0;
    return end(s, events, 'outOfSignal', 'outOfSignal');
  }
  if (s.timeLimit > 0 && s.steps >= s.timeLimit) return end(s, events, 'outOfTime', 'outOfTime');
  return { state: s, events };
}

function end(s: RaceState, events: RaceEvent[], outcome: Outcome, event: RaceEvent) {
  s.outcome = outcome;
  events.push(event);
  return { state: s, events };
}

/**
 * Moves the racer for one step in SUBSTEPS small pieces: forward, then sideways, then up or down, each stopping flush
 * against anything solid. Returns what it hit (a crash ends the move at once).
 */
function move(s: RaceState, road: Road, events: RaceEvent[]): 'crash' | 'land' | 'scrape' | null {
  let dz = (s.vz * DT) / SUBSTEPS;
  let dx = ((s.steer * s.steerScale * TURN_RATE * (TURN_AT_REST + (1 - TURN_AT_REST) * (s.vz / TOP_SPEED)) + s.slide) * DT) / SUBSTEPS;
  let dy = (s.vy * DT) / SUBSTEPS;
  let result: 'land' | 'scrape' | null = null;
  for (let k = 0; k < SUBSTEPS; k++) {
    if (dz > 0) {
      const nz = s.z + dz;
      if (!solid(road, s.x, s.y, nz)) s.z = nz;
      else {
        // Clipped a corner? Nudge sideways (towards the nearer side first) instead of stopping.
        const first = s.x - Math.floor(s.x) < 0.5 ? -1 : 1;
        let nudged = false;
        for (const d of [first, -first]) {
          const nx = s.x + d * WALL_NUDGE;
          if (!solid(road, nx, s.y, s.z) && !solid(road, nx, s.y, nz)) {
            s.x = nx;
            s.z = nz;
            nudged = true;
            events.push('nudge');
            break;
          }
        }
        if (!nudged) {
          s.z = Math.floor(nz) - EPS;
          if (s.vz > CRASH_SPEED) return 'crash';
          s.vz = 0;
          dz = 0;
          events.push('bonk');
        }
      }
    }
    if (dx !== 0) {
      const nx = s.x + dx;
      if (!solid(road, nx, s.y, s.z)) s.x = nx;
      else {
        s.x = dx > 0 ? Math.floor(nx) - EPS : Math.floor(nx) + 1 + EPS;
        dx = 0;
        if (result === null) result = 'scrape';
      }
    }
    if (dy !== 0) {
      const ny = s.y + dy;
      if (!solid(road, s.x, ny, s.z)) s.y = ny;
      else {
        const piece = pieceAt(road, s.x, ny, s.z);
        if (dy < 0) {
          s.y = piece.top;
          result = 'land';
        } else {
          s.y = piece.bottom - EPS;
          s.vy = 0;
        }
        dy = 0;
      }
    }
  }
  return result;
}

/** True if the jump, played forward with this input held and no Auto-Pilot, comes down safely. */
function willLand(start: RaceState, input: Input, road: Road): boolean {
  let t: RaceState = { ...start, autoPilot: false };
  const held: Input = { turn: input.turn, accel: input.accel, jump: false };
  for (let i = 0; i < AUTO_PILOT_LOOK; i++) {
    const r = step(t, held, road);
    t = r.state;
    if (t.outcome !== 'racing') return t.outcome === 'finished';
    if (r.events.includes('land') || r.events.includes('bounce')) return cellAt(road, Math.floor(t.x), Math.floor(t.z)) !== 'x';
  }
  return false;
}

/** Tries steering, then speed, ±10% … ±60% until the jump would land. Changes `s` and returns true if it saved it. */
function runAutoPilot(s: RaceState, input: Input, road: Road): boolean {
  if (willLand(s, input, road)) return false;
  const vz = s.vz;
  const scale = s.steerScale;
  for (const share of AUTO_PILOT_TRIES) {
    if (s.steer !== 0) {
      for (const tryScale of [scale * (1 + share), scale * (1 - share)]) {
        if (willLand({ ...s, steerScale: tryScale }, input, road)) {
          s.steerScale = tryScale;
          s.autoPilotOn = true;
          return true;
        }
      }
    }
    for (const tryVz of [vz * (1 + share), vz * (1 - share)]) {
      if (tryVz > TOP_SPEED || tryVz === vz) continue;
      if (willLand({ ...s, vz: tryVz }, input, road)) {
        s.autoPilotGiveBack = vz - tryVz;
        s.vz = tryVz;
        s.autoPilotOn = true;
        return true;
      }
    }
  }
  return false;
}

/** Plays a recorded run from the start. The server uses this to find the real finish and time. */
export function replay(road: Road, log: InputLog, opts: RaceOptions = {}): RaceState {
  const play = inputPlayer(log);
  let s = newRace(road, opts);
  // Through checkpoint restarts too: the pauses read no inputs that matter (nothing is recorded while the racer is down).
  while ((s.outcome === 'racing' || willRespawn(s)) && s.steps < MAX_RUN_STEPS) s = step(s, decodeInput(play(s)), road).state;
  return s;
}

/** A short text of the whole state, to compare runs exactly. */
export function stateKey(s: RaceState): string {
  return [s.x, s.y, s.z, s.vy, s.vz, s.steer, s.steerScale, s.slide, s.battery, s.signal, s.steps, s.outcome].join('|');
}
