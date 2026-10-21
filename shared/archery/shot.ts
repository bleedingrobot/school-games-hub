/**
 * Flies one arrow (docs/ARCHERY-PLAN.md, section 2): a fixed time step, gravity and wind, checked
 * against each archer's box and the land cells every step. It moves at most 2.5 px a step (full
 * power), less than one 3 px cell, so it can't skip through a thin wall.
 *
 * The path is only for drawing the flight. James (21 Oct 2026): no aiming help, so screens fade it
 * within half a second and never keep it on screen.
 */
import { AIM_X, AIM_Y, clampAngle } from './aim';
import {
  ARCHER_H, BUBBLE_KEEP, BUBBLE_R, CELL, CHARM_LIFT, CHARM_PUSH, CHARM_RANGE, DT, FIELD_H, FIELD_W, GRAVITY, HANDS_HEIGHT,
  ICE_BOUNCE, LAUNCH_OFFSET, MAX_FLIGHT_STEPS, MAX_POWER, OWL_PULL, OWL_SENSE, PATH_EVERY, POWER_TO_SPEED, SIDE_MARGIN, WIND_ACCEL,
} from './config';
import { bowKind } from './gear';
import { cellAt, inArcherBox, solidAt } from './land';
import { AIR, BUILDING, ICE, type Archer, type Flight, type HitKind, type Land, type Shot } from './types';

/** A whole-number power kept to 0–100. */
export function clampPower(power: number): number {
  const p = Math.floor(power);
  return p < 0 ? 0 : p > MAX_POWER ? MAX_POWER : p;
}

/** A flying arrow's position (px) and speed (px/s). */
export interface Motion {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Where an archer's arrow starts, and how fast it's going (px, px/s). Their bow can add speed. */
export function launch(a: Archer, angle: number, power: number): Motion {
  const d = clampAngle(angle);
  const dx = AIM_X[d];
  const dy = -AIM_Y[d];
  const speed = clampPower(power) * POWER_TO_SPEED * bowKind(a.bow).power;
  return { x: a.x + dx * LAUNCH_OFFSET, y: a.y - HANDS_HEIGHT + dy * LAUNCH_OFFSET, vx: dx * speed, vy: dy * speed };
}

/** The kind of land cell at a point of the field (in pixels). */
function kindAt(land: Land, x: number, y: number): number {
  return cellAt(land, Math.floor(x / CELL), Math.floor(y / CELL));
}

/** How a flight goes, beyond gravity and wind. */
export interface FlyOptions {
  /** Gravity on (true unless a Crossbow Bolt). */
  gravity?: boolean;
  /** The wind's push × this (the shooter's bow; 0 for a Crossbow Bolt). */
  windScale?: number;
  /** Stop at the top of the flight, as it starts to come down (Arrow Rain splits there): hit kind 'split'. */
  apex?: boolean;
  /** Steer toward an archer close to its path while coming down (the Owl Arrow). */
  steer?: boolean;
  /** Stop after this many steps: hit kind 'spent' (a Crossbow Bolt's range). */
  maxSteps?: number;
  /** Cut through dirt and trees instead of stopping (a Crossbow Bolt), calling this for each step inside them, at most `cutMost` steps. */
  cut?: (x: number, y: number) => void;
  cutMost?: number;
  /** Has it already left the shooter's box? (A hop or a split piece starts away from them.) */
  armed?: boolean;
  /** Can it still bounce off ice? (Once per arrow.) */
  iceBounce?: boolean;
}

/** A flight, plus how it was moving when it stopped and where it bounced off a Bubble Shield. */
export interface FlightOut extends Flight {
  end: Motion;
  bubbles: [number, number, number][];
}

/** Is this archer's Bubble Shield still able to bounce an arrow? */
export const bubbleUp = (a: Archer) => a.guard === 'bubble' && !!a.bubble && a.shield > 0 && !a.popped;
/** Is this archer's Wind Charm still working? */
export const charmUp = (a: Archer) => a.guard === 'charm' && a.shield > 0 && !a.popped;

/**
 * Flies an arrow from `start` until it hits an archer, the land or the bottom, leaves the sides, or runs
 * out of time (or splits, or runs out of range, as `opts` says). The shooter's own box only counts once the
 * arrow has left it (so a shot straight up can come down on its own archer). Popped archers don't stop arrows.
 *
 * Snow's ice blocks bounce an arrow once: it goes back to where it was a step before and flips the part of
 * its speed that ran into the ice (sideways, up-and-down, or both at a corner), keeping ICE_BOUNCE of its
 * speed. The second time it meets ice, it stops there like on any land.
 *
 * The other archer's shield can push back: a Wind Charm lifts and pushes away an arrow coming down near them,
 * and a Bubble Shield bounces the first arrow of the round that reaches it (this changes the archer: their
 * `bubble` is used up).
 */
export function fly(land: Land, archers: readonly Archer[], shooter: number, start: Motion, wind: number, opts: FlyOptions = {}): FlightOut {
  let { x, y, vx, vy } = start;
  const gravity = opts.gravity === false ? 0 : GRAVITY;
  const ax = wind * WIND_ACCEL * (opts.windScale ?? 1);
  const maxSteps = opts.maxSteps ?? MAX_FLIGHT_STEPS;
  const path: number[] = [x, y];
  let armed = opts.armed ?? !inArcherBox(archers[shooter], x, y);
  let canIce = opts.iceBounce ?? true;
  let bounce: [number, number] | null = null;
  const bubbles: [number, number, number][] = [];
  let cutSteps = 0;
  const done = (kind: HitKind, steps: number, archer: number | null = null): FlightOut => {
    if (path[path.length - 2] !== x || path[path.length - 1] !== y) path.push(x, y);
    return { hit: { kind, x, y, archer, steps }, bounce, path, end: { x, y, vx, vy }, bubbles };
  };
  if (solidAt(land, x, y) && !opts.cut) return done('land', 0);
  for (let step = 1; step <= maxSteps; step++) {
    let axs = ax;
    let ays = gravity;
    if (vy > 0) {
      for (let i = 0; i < archers.length; i++) {
        const a = archers[i];
        if (i === shooter) continue;
        if (charmUp(a) && y < a.y) {
          const dx = x - a.x;
          if (dx < CHARM_RANGE && dx > -CHARM_RANGE) {
            ays -= CHARM_LIFT;
            axs += (dx > 0 || (dx === 0 && vx >= 0) ? 1 : -1) * CHARM_PUSH;
          }
        }
        if (opts.steer && !a.popped) {
          const tx = a.x - x;
          const ty = a.y - ARCHER_H / 2 - y;
          const d = Math.sqrt(tx * tx + ty * ty);
          if (d > 0 && d < OWL_SENSE) {
            axs += (tx / d) * OWL_PULL;
            ays += (ty / d) * OWL_PULL;
          }
        }
      }
    }
    vx += axs * DT;
    vy += ays * DT;
    if (opts.apex && vy >= 0) return done('split', step);
    const px = x;
    const py = y;
    x += vx * DT;
    y += vy * DT;
    if (step % PATH_EVERY === 0) path.push(x, y);
    if (x < -SIDE_MARGIN || x >= FIELD_W + SIDE_MARGIN) return done('gone', step);
    if (y >= FIELD_H) {
      y = FIELD_H;
      return done('floor', step);
    }
    for (let i = 0; i < archers.length; i++) {
      const a = archers[i];
      if (a.popped) continue;
      if (i === shooter && !armed) {
        if (!inArcherBox(a, x, y)) armed = true;
        continue;
      }
      if (i !== shooter && bubbleUp(a)) {
        const cx = x - a.x;
        const cy = y - (a.y - ARCHER_H / 2);
        const d2 = cx * cx + cy * cy;
        if (d2 < BUBBLE_R * BUBBLE_R) {
          // Bounce off the bubble: flip the speed along the line from its middle.
          const d = Math.sqrt(d2) || 1;
          const nx = cx / d;
          const ny = cy / d;
          const dot = vx * nx + vy * ny;
          if (dot < 0) {
            vx = (vx - 2 * dot * nx) * BUBBLE_KEEP;
            vy = (vy - 2 * dot * ny) * BUBBLE_KEEP;
          }
          a.bubble = false;
          x = px;
          y = py;
          bubbles.push([x, y, step]);
          path.push(x, y);
          continue;
        }
      }
      if (inArcherBox(a, x, y)) return done('archer', step, i);
    }
    if (step === maxSteps && opts.maxSteps !== undefined) return done('spent', step);
    if (!solidAt(land, x, y)) continue;
    const kind = kindAt(land, x, y);
    if (opts.cut && kind !== ICE && kind !== BUILDING && kind !== AIR) {
      if (cutSteps++ >= (opts.cutMost ?? 0)) return done('land', step);
      opts.cut(x, y);
      continue;
    }
    if (!canIce || kind !== ICE) return done('land', step);
    // Off the ice: which way did it come in?
    const side = solidAt(land, x, py);
    const top = solidAt(land, px, y);
    if (side || !top) vx = -vx;
    if (top || !side) vy = -vy;
    vx *= ICE_BOUNCE;
    vy *= ICE_BOUNCE;
    x = px;
    y = py;
    canIce = false;
    bounce = [x, y];
    path.push(x, y);
  }
  return done(opts.maxSteps !== undefined ? 'spent' : 'timeout', maxSteps);
}

/** Flies `shooter`'s arrow for a shot, as a plain arrow flies (with their bow). */
export function flyArrow(land: Land, archers: readonly Archer[], shooter: number, shot: Shot, wind: number): Flight {
  const a = archers[shooter];
  return fly(land, archers, shooter, launch(a, shot.angle, shot.power), wind, { windScale: bowKind(a.bow).wind });
}
