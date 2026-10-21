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
  CELL, DT, FIELD_H, FIELD_W, GRAVITY, HANDS_HEIGHT, ICE_BOUNCE, LAUNCH_OFFSET, MAX_FLIGHT_STEPS, MAX_POWER, PATH_EVERY,
  POWER_TO_SPEED, SIDE_MARGIN, WIND_ACCEL,
} from './config';
import { cellAt, inArcherBox, solidAt } from './land';
import { ICE, type Archer, type Flight, type HitKind, type Land, type Shot } from './types';

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

/** The kind of land cell at a point of the field (in pixels). */
function kindAt(land: Land, x: number, y: number): number {
  return cellAt(land, Math.floor(x / CELL), Math.floor(y / CELL));
}

/**
 * Flies `shooter`'s arrow until it hits an archer, the land or the bottom, leaves the sides, or runs
 * out of time. The shooter's own box only counts once the arrow has left it (so a shot straight up
 * can come down on its own archer). Popped archers don't stop arrows.
 *
 * Snow's ice blocks bounce an arrow once: it goes back to where it was a step before and flips the
 * part of its speed that ran into the ice (sideways, up-and-down, or both at a corner), keeping
 * ICE_BOUNCE of its speed. The second time it meets ice, it stops there like on any land.
 */
export function flyArrow(land: Land, archers: readonly Archer[], shooter: number, shot: Shot, wind: number): Flight {
  let { x, y, vx, vy } = launch(archers[shooter], shot.angle, shot.power);
  const ax = wind * WIND_ACCEL;
  const path: number[] = [x, y];
  let armed = !inArcherBox(archers[shooter], x, y);
  let bounce: [number, number] | null = null;
  const done = (kind: HitKind, steps: number, archer: number | null = null): Flight => {
    if (path[path.length - 2] !== x || path[path.length - 1] !== y) path.push(x, y);
    return { hit: { kind, x, y, archer, steps }, bounce, path };
  };
  if (solidAt(land, x, y)) return done('land', 0);
  for (let step = 1; step <= MAX_FLIGHT_STEPS; step++) {
    vx += ax * DT;
    vy += GRAVITY * DT;
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
      if (inArcherBox(a, x, y)) return done('archer', step, i);
    }
    if (!solidAt(land, x, y)) continue;
    if (bounce || kindAt(land, x, y) !== ICE) return done('land', step);
    // Off the ice: which way did it come in?
    const side = solidAt(land, x, py);
    const top = solidAt(land, px, y);
    if (side || !top) vx = -vx;
    if (top || !side) vy = -vy;
    vx *= ICE_BOUNCE;
    vy *= ICE_BOUNCE;
    x = px;
    y = py;
    bounce = [x, y];
    path.push(x, y);
  }
  return done('timeout', MAX_FLIGHT_STEPS);
}
