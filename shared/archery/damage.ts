/**
 * Damage (docs/ARCHERY-PLAN.md, section 2). A blast's damage fades in a straight line from its
 * peak at the centre to nothing at its edge. A direct hit adds a small bonus. Shields take damage
 * first. One shot can never take more than MAX_SHOT_DAMAGE from one archer, which is less than a
 * full archer's health, so no single arrow is ever a knock-out. At 0 health an archer pops.
 */
import { ARCHER_H, ARCHER_W, FALL_DAMAGE_CAP, FALL_DAMAGE_PER_CELL, MAX_SHOT_DAMAGE } from './config';
import { fallCells } from './land';
import type { Archer } from './types';

/** Rounds half up to a whole number (exact everywhere). */
export function whole(n: number): number {
  return Math.floor(n + 0.5);
}

/** How far (px) a point is from the nearest part of an archer's box (0 inside it). */
export function distanceToArcher(a: Archer, x: number, y: number): number {
  const left = a.x - ARCHER_W / 2;
  const right = a.x + ARCHER_W / 2;
  const top = a.y - ARCHER_H;
  const dx = x < left ? left - x : x > right ? x - right : 0;
  const dy = y < top ? top - y : y > a.y ? y - a.y : 0;
  return Math.sqrt(dx * dx + dy * dy);
}

/** A blast's damage to one archer: `peak` at the centre, fading to 0 at `radius`. */
export function blastDamage(a: Archer, x: number, y: number, radius: number, peak: number): number {
  if (radius <= 0 || peak <= 0) return 0;
  const d = distanceToArcher(a, x, y);
  if (d >= radius) return 0;
  return whole(peak * (1 - d / radius));
}

/** Damage for a fall of this many cells (short steps are free, long falls are capped). */
export function fallDamage(cells: number): number {
  const d = fallCells(cells) * FALL_DAMAGE_PER_CELL;
  return d > FALL_DAMAGE_CAP ? FALL_DAMAGE_CAP : d;
}

/** One shot's total for one archer, kept to the most a shot may ever do. */
export function capShotDamage(total: number): number {
  return total > MAX_SHOT_DAMAGE ? MAX_SHOT_DAMAGE : total < 0 ? 0 : total;
}

/**
 * Takes `amount` from the archer: shield first, the rest from health. At 0 health the archer pops.
 * Returns how much was actually taken (health plus shield).
 */
export function hurt(a: Archer, amount: number): number {
  if (a.popped || amount <= 0) return 0;
  const fromShield = amount < a.shield ? amount : a.shield;
  a.shield -= fromShield;
  const rest = amount - fromShield;
  const fromHealth = rest < a.health ? rest : a.health;
  a.health -= fromHealth;
  if (a.health <= 0) {
    a.health = 0;
    a.popped = true;
  }
  return fromShield + fromHealth;
}
