/**
 * Bots that drive a road by looking ahead with the real physics (docs/CIRCUIT-PLAN.md, section 2).
 *
 * Every few steps a bot tries each lane within two of where it is, with and without jumping, plays each one
 * forward with `step`, and keeps the one that gets furthest without falling or crashing. Its style sets the speed it
 * drives at and how far ahead it looks. They prove every road can be finished (roads.test.ts) and give the
 * simulator's times and battery/signal margins (scripts/circuit-sim.mjs).
 */
import { CRASH_SPEED, DT, JUMP_SPEED, LANES, TOP_SPEED } from './config';
import { inputCode, makeRecorder, type Input, type InputChange } from './inputs';
import { newRace, solid, step, type RaceOptions, type RaceState } from './physics';
import { cellAt, topOf, type Road } from './road';

export interface BotStyle {
  /** The speed it drives at, as a share of top speed. */
  speed: number;
  /** How many steps ahead it looks. */
  look: number;
  /** It decides again every this many steps. */
  every: number;
}

export const BOT_STYLES = {
  careful: { speed: 0.6, look: 36, every: 3 },
  average: { speed: 0.8, look: 30, every: 3 },
  wild: { speed: 1, look: 14, every: 4 },
} as const satisfies Record<string, BotStyle>;
export type BotName = keyof typeof BOT_STYLES;

export interface BotResult {
  /** The last attempt (finished, unless every attempt failed). */
  state: RaceState;
  log: InputChange[];
  attempts: number;
  /** How the failed attempts ended. */
  fails: string[];
  /** The lowest battery and signal on the last attempt. */
  minBattery: number;
  minSignal: number;
}

interface Plan {
  lane: number;
  /** Jump now. */
  jump: boolean;
  /** Creep along below the crash speed (to bonk up to a block and hop onto it). */
  slow: boolean;
}

/**
 * Steers toward the middle of a lane, holds a speed, and jumps like a person would: at the last moment before the
 * floor ends, or just in time to rise onto a block ahead.
 */
function drive(s: RaceState, road: Road, plan: Plan, target: number, jump: boolean): Input {
  const middle = plan.lane + 0.5;
  const turn = s.x < middle - 0.08 ? 1 : s.x > middle + 0.08 ? -1 : 0;
  const speed = plan.slow ? Math.min(target, CRASH_SPEED * 0.6) : target;
  const accel = s.vz < speed - 0.2 ? 1 : s.vz > speed + 0.4 ? -1 : 0;
  let hop = jump;
  if (s.grounded && !hop) {
    if (s.vz > 1 && !solid(road, s.x, s.y - 0.01, s.z + s.vz * DT * 2)) hop = true;
    const ahead = Math.floor(s.z) + 1;
    const top = topOf(cellAt(road, Math.floor(s.x), ahead));
    const g = road.def.gravity;
    const rise = top === null ? -1 : top - s.y;
    if (rise > 0.01 && rise < (JUMP_SPEED * JUMP_SPEED) / (2 * g) - 0.05) {
      const t = (JUMP_SPEED - Math.sqrt(JUMP_SPEED * JUMP_SPEED - 2 * g * rise)) / g;
      if (ahead - s.z <= s.vz * t + 0.2) hop = true;
    }
  }
  return { turn, accel, jump: hop };
}

function score(s0: RaceState, road: Road, plan: Plan, target: number, look: number): number {
  let s: RaceState = { ...s0, autoPilot: false };
  let bonks = 0;
  let reached = s.z;
  for (let i = 0; i < look + 60; i++) {
    if (i === look) reached = s.z;
    if (i >= look && s.grounded) break;
    const r = step(s, drive(s, road, plan, target, plan.jump && i === 0), road);
    s = r.state;
    if (r.events.includes('bonk')) bonks++;
    if (s.outcome === 'finished') return 1e6 - i;
    if (s.outcome !== 'racing' || s.y < -0.4) return -1e6 + i;
  }
  // Progress is measured at the same step for every plan; the rest only checks a jump comes down safely.
  return reached - 2 * bonks - (plan.jump ? 0.3 : 0) - 0.15 * Math.abs(plan.lane + 0.5 - s0.x) - (plan.slow ? 0.5 : 0);
}

function choose(s: RaceState, road: Road, style: BotStyle, current: Plan): Plan {
  const target = style.speed * TOP_SPEED;
  const here = Math.floor(s.x);
  let best = current;
  let bestScore = -Infinity;
  for (let lane = Math.max(0, here - 2); lane <= Math.min(LANES - 1, here + 2); lane++) {
    for (const jump of s.grounded ? [false, true] : [false]) {
      for (const slow of [false, true]) {
        const plan = { lane, jump, slow };
        const v = score(s, road, plan, target, style.look) + (lane === current.lane ? 0.1 : 0);
        if (v > bestScore) {
          bestScore = v;
          best = plan;
        }
      }
    }
  }
  return best;
}

/** One go at a road. */
function attempt(road: Road, style: BotStyle, opts: RaceOptions) {
  const rec = makeRecorder();
  let s = newRace(road, opts);
  let plan: Plan = { lane: Math.floor(s.x), jump: false, slow: false };
  let minBattery = s.battery;
  let minSignal = s.signal;
  const target = style.speed * TOP_SPEED;
  while (s.outcome === 'racing') {
    let jumpNow = false;
    if (s.steps % style.every === 0) {
      plan = choose(s, road, style, plan);
      jumpNow = plan.jump;
    }
    const input = drive(s, road, plan, target, jumpNow);
    rec.record(s, inputCode(input));
    s = step(s, input, road).state;
    minBattery = Math.min(minBattery, s.battery);
    minSignal = Math.min(minSignal, s.signal);
  }
  return { state: s, log: rec.log, minBattery, minSignal };
}

/** Drives a road, trying again (up to `tries` goes) after a crash, a fall or running flat. */
export function botRun(road: Road, name: BotName, opts: RaceOptions = {}, tries = 3): BotResult {
  const fails: string[] = [];
  let style: BotStyle = BOT_STYLES[name];
  for (let n = 1; ; n++) {
    const go = attempt(road, style, opts);
    if (go.state.outcome === 'finished' || n >= tries) return { ...go, attempts: n, fails };
    fails.push(`${go.state.outcome} at row ${Math.floor(go.state.z)}`);
    // A real player gets a bit more careful after a crash.
    style = { ...style, look: style.look + 10 };
  }
}
