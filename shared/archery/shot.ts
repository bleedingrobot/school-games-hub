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
  DT, FIELD_H, FIELD_W, GRAVITY, HANDS_HEIGHT, LAUNCH_OFFSET, MAX_FLIGHT_STEPS, MAX_POWER, PATH_EVERY,
  POWER_TO_SPEED, SIDE_MARGIN, WIND_ACCEL,
} from './config';
import { inArcherBox, solidAt } from './land';
import type { Archer, Flight, HitKind, Land, Shot } from './types';

/** A whole-number power kept to 0–100. */
export function clampPower(power: number): number {
  const p = Math.floor(power);
  return p < 0 ? 0 : p > MAX_POWER ? MAX_POWER : p;
}

/** Where an archer's arrow starts, and how fast it's going (px, px/s). */
export function launch(a: Archer, angle: number, power: number): { x: number; y: number; vx: number; vy: number } {
  const d = clampAngle(angle);
  const dx = AIM_X[d];
  const dy = -AIM_Y[d];
  const speed = clampPower(power) * POWER_TO_SPEED;
  return { x: a.x + dx * LAUNCH_OFFSET, y: a.y - HANDS_HEIGHT + dy * LAUNCH_OFFSET, vx: dx * speed, vy: dy * speed };
}

/**
 * Flies `shooter`'s arrow until it hits an archer, the land or the bottom, leaves the sides, or runs
 * out of time. The shooter's own box only counts once the arrow has left it (so a shot straight up
 * can come down on its own archer). Popped archers don't stop arrows.
 */
export function flyArrow(land: Land, archers: readonly Archer[], shooter: number, shot: Shot, wind: number): Flight {
  let { x, y, vx, vy } = launch(archers[shooter], shot.angle, shot.power);
  const ax = wind * WIND_ACCEL;
  const path: number[] = [x, y];
  let armed = !inArcherBox(archers[shooter], x, y);
  const done = (kind: HitKind, steps: number, archer: number | null = null): Flight => {
    if (path[path.length - 2] !== x || path[path.length - 1] !== y) path.push(x, y);
    return { hit: { kind, x, y, archer, steps }, path };
  };
  if (solidAt(land, x, y)) return done('land', 0);
  for (let step = 1; step <= MAX_FLIGHT_STEPS; step++) {
    vx += ax * DT;
    vy += GRAVITY * DT;
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
      if (inArcherBox(a, x, y)) return done('archer', step, i);
    }
    if (solidAt(land, x, y)) return done('land', step);
  }
  return done('timeout', MAX_FLIGHT_STEPS);
}
