/**
 * Toon Flap's physics (docs/TOON-FLAP-PLAN.md, section 1). One step is 1/60 s. The only input is "flap this step", so a run
 * is just the list of step numbers with a flap: the browser plays it live and the server replays the same list to check it.
 *
 * The clock is the flying steps. While the bird hovers (before the first tap, after a bump, on a perch) no time passes,
 * and the next flap lifts it off. A bump adds `BUMP_PENALTY_STEPS` to the time and the bird hovers again just in front of
 * the wall it hit, so a bump costs about 3 seconds and never ends the run.
 */
import { BIRD_HALF, BUMP_PENALTY_STEPS, CHECK_BONUS_STEPS, DT, MAX_RUN_STEPS, POTIONS_PER_RUN, RESPAWN_BACK, RESPAWN_LOW, SKY, START_X, START_Y, STEPS_PER_SECOND, TAILWIND_STEPS, UNDERWATER, WALL_WIDTH, WINGS } from './config';
import type { Course, Gap, Wall, Zone } from './levels';

export type Mode = 'hover' | 'fly' | 'done';
export type Hover = 'start' | 'bump' | 'perch';

export interface RunState {
  /** Flying steps so far (the clock, before bumps and bonuses). */
  t: number;
  x: number;
  y: number;
  vy: number;
  mode: Mode;
  /** Why the bird is hovering. */
  hover: Hover;
  bumps: number;
  /** The first wall the bird hasn't passed yet. */
  nextWall: number;
  /** Checks reached so far (the perch the bird is on, or last left, is `perches - 1`). */
  perches: number;
  /** The gap each answer wall was first flown into (by index), null if not yet. */
  picks: Array<number | null>;
  outcome: 'running' | 'finished' | 'timeout';
}

export type StepEvent = 'wait' | 'bump' | 'perch' | 'pick' | 'finish' | null;

export function newRun(course: Course): RunState {
  return { t: 0, x: START_X, y: START_Y, vy: 0, mode: 'hover', hover: 'start', bumps: 0, nextWall: 0, perches: 0, picks: course.signs.map(() => null), outcome: 'running' };
}

/** 0 to 1 and back, smoothed at the ends, over `period` steps: a sliding wall's position. No sin, so it is exact everywhere. */
function wave(t: number, period: number, offset: number): number {
  const p = ((t + offset) % period) / period;
  const tri = p < 0.5 ? p * 2 : 2 - p * 2;
  return tri * tri * (3 - 2 * tri);
}

/** The wall's openings at step `t` (a sliding wall moves them all together). */
export function gapsAt(wall: Wall, t: number): Gap[] {
  if (!wall.slide) return wall.gaps;
  const shift = wall.slide.amp * (2 * wave(t, wall.slide.period, wall.slide.offset) - 1);
  return wall.gaps.map((g) => ({ y: g.y + shift, h: g.h }));
}

/** Is a timed zone (gust, steam) on at step `t`? Untimed zones always are. */
export function zoneOn(zone: Zone, t: number): boolean {
  return !zone.timed || (t + zone.timed.offset) % zone.timed.period < zone.timed.on;
}

function inside(y: number, g: Gap): boolean {
  return y - BIRD_HALF >= g.y - g.h / 2 && y + BIRD_HALF <= g.y + g.h / 2;
}

/** Where a bumped bird comes back: in front of the wall it hit (or was heading for), in the middle of its nearest opening. */
function respawn(course: Course, s: RunState): void {
  const wall = course.walls[s.nextWall];
  if (wall) {
    const before = s.nextWall > 0 ? course.walls[s.nextWall - 1].x + WALL_WIDTH : START_X;
    s.x = wall.x - (wall.x - before) * RESPAWN_BACK;
    const gaps = gapsAt(wall, s.t);
    // A little below the middle of the opening, because the flap that sets off lifts the bird about a unit.
    s.y = gaps.reduce((best, g) => (Math.abs(g.y - SKY / 2) < Math.abs(best.y - SKY / 2) ? g : best), gaps[0]).y - RESPAWN_LOW;
  } else {
    const last = course.walls[course.walls.length - 1];
    s.x = Math.max(last.x + WALL_WIDTH + 0.5, s.x - 1.5);
    s.y = SKY / 2;
  }
  s.vy = 0;
  s.mode = 'hover';
  s.hover = 'bump';
}

/**
 * One step. `flap` is true if the player flapped this step. While hovering, a step without a flap does nothing
 * (returns 'wait', no time passes).
 */
export function stepRun(course: Course, s: RunState, flap: boolean): StepEvent {
  if (s.mode === 'done') return null;
  if (s.mode === 'hover') {
    if (!flap) return 'wait';
    s.mode = 'fly';
  }
  const wings = WINGS[course.def.pace];
  const water = course.def.features.includes('underwater');
  let gravity = wings.gravity * (water ? UNDERWATER.gravity : 1);
  const maxFall = wings.maxFall * (water ? UNDERWATER.maxFall : 1);
  let push = 0;
  for (const z of course.zones) {
    if (s.x >= z.x0 && s.x <= z.x1 && zoneOn(z, s.t)) {
      push += z.push;
      gravity *= z.gravity;
    }
  }
  if (flap) s.vy = wings.lift * (water ? UNDERWATER.lift : 1);
  s.vy += (push - gravity) * DT;
  if (s.vy < -maxFall) s.vy = -maxFall;
  if (s.vy > wings.lift * 1.5) s.vy = wings.lift * 1.5;
  s.y += s.vy * DT;
  s.x += course.speed * DT;
  s.t++;

  // Walls behind the bird are passed.
  while (s.nextWall < course.walls.length && course.walls[s.nextWall].x + WALL_WIDTH < s.x - BIRD_HALF) s.nextWall++;
  let event: StepEvent = null;
  let bumped = s.y - BIRD_HALF < 0 || s.y + BIRD_HALF > SKY;
  for (let w = s.nextWall; !bumped && w < course.walls.length; w++) {
    const wall = course.walls[w];
    if (wall.x > s.x + BIRD_HALF) break;
    const gaps = gapsAt(wall, s.t);
    const at = gaps.findIndex((g) => inside(s.y, g));
    if (at < 0) bumped = true;
    else if (wall.answer !== undefined && s.picks[wall.answer] === null) {
      s.picks[wall.answer] = at;
      event = 'pick';
    }
  }
  if (bumped) {
    s.bumps++;
    respawn(course, s);
    return 'bump';
  }
  const perch = course.perches[s.perches];
  if (perch && s.x >= perch.x) {
    s.x = perch.x;
    s.y = perch.y;
    s.vy = 0;
    s.perches++;
    s.mode = 'hover';
    s.hover = 'perch';
    return 'perch';
  }
  if (s.x >= course.nestX) {
    s.mode = 'done';
    s.outcome = 'finished';
    return 'finish';
  }
  if (s.t >= MAX_RUN_STEPS) {
    s.mode = 'done';
    s.outcome = 'timeout';
    return 'finish';
  }
  return event;
}

export interface Replay {
  /** False if the flap list can't have come from playing (out of order, or a hover that the next flap doesn't match). */
  valid: boolean;
  state: RunState;
}

/** Plays a whole flap list from the start. The server does this to check a run before saving it. */
export function replayRun(course: Course, flaps: readonly number[]): Replay {
  const s = newRun(course);
  let k = 0;
  while (s.mode !== 'done') {
    const next = k < flaps.length ? flaps[k] : -1;
    if (next >= 0 && next < s.t) return { valid: false, state: s };
    const flap = next === s.t;
    if (s.mode === 'hover' && !flap) return { valid: next < 0, state: s };
    if (flap) k++;
    stepRun(course, s, flap);
  }
  return { valid: k === flaps.length, state: s };
}

export interface Score {
  /** The time, in steps: flying + bumps − bonuses (never below 0). */
  steps: number;
  seconds: number;
  flying: number;
  bumpSteps: number;
  checkBonus: number;
  tailwind: number;
  /** A revive potion cancelled one bump. */
  potion: boolean;
}

/**
 * The run's time. `checksRight` (marked by the server) and `gapsRight` (the replay's picks against the seed's right gaps,
 * maths.ts) take time off. A potion cancels one bump (at most `POTIONS_PER_RUN`).
 */
export function scoreRun(s: RunState, opts: { checksRight: number; gapsRight: number; potion?: boolean }): Score {
  const cancelled = opts.potion ? Math.min(POTIONS_PER_RUN, s.bumps) : 0;
  const bumpSteps = (s.bumps - cancelled) * BUMP_PENALTY_STEPS;
  const checkBonus = Math.min(opts.checksRight, s.perches) * CHECK_BONUS_STEPS;
  const tailwind = Math.min(opts.gapsRight, s.picks.length) * TAILWIND_STEPS;
  const steps = Math.max(0, s.t + bumpSteps - checkBonus - tailwind);
  return { steps, seconds: steps / STEPS_PER_SECOND, flying: s.t, bumpSteps, checkBonus, tailwind, potion: cancelled > 0 };
}

export type Medal = 'gold' | 'silver' | 'bronze';

/** Any finish is bronze. Gold needs normal wings; with Gentle wings the best is silver. */
export function medalFor(course: Course, seconds: number, maths: boolean, gentle = false): Medal {
  const gold = maths ? course.medals.gold : course.medals.goldPlain;
  const silver = maths ? course.medals.silver : course.medals.silverPlain;
  if (!gentle && seconds <= gold) return 'gold';
  if (seconds <= silver) return 'silver';
  return 'bronze';
}

/** Flaps as text for sending: each step number as the gap from the one before, in base 36, comma separated. */
export function encodeFlaps(flaps: readonly number[]): string {
  let last = 0;
  return flaps.map((f) => {
    const d = f - last;
    last = f;
    return d.toString(36);
  }).join(',');
}

export function decodeFlaps(text: string): number[] | null {
  if (text === '') return [];
  if (text.length > 40000 || !/^[0-9a-z]+(,[0-9a-z]+)*$/.test(text)) return null;
  let at = 0;
  const out: number[] = [];
  for (const part of text.split(',')) {
    at += parseInt(part, 36);
    out.push(at);
  }
  return out;
}

/** A short text of the whole state, for the determinism check. */
export const stateKey = (s: RunState): string => `${s.t}|${s.x.toFixed(6)}|${s.y.toFixed(6)}|${s.vy.toFixed(6)}|${s.mode}|${s.bumps}|${s.perches}|${s.picks.join('.')}`;
