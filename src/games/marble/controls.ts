/**
 * Turning what the student does (keys, a drag, a thumb stick) into one of the engine's 9 inputs.
 *
 * The view is tilted: "up the screen" is the grid's north-west corner. So the screen's up, right,
 * down and left are the grid's NW, NE, SE and SW, and the engine's 8 directions come out of
 * the keys' 8 combinations: up+right is straight north on the grid, and so on.
 */
import { DIRS } from '../../../shared/marble/engine';

/** A push on the screen (right is +x, up is +y) as a grid direction code 0–8. */
export function screenToCode(sx: number, sy: number): number {
  // Screen right = grid (+1, −1); screen up = grid (−1, −1).
  const gx = sx - sy;
  const gy = -sx - sy;
  if (gx * gx + gy * gy < 1e-9) return 0;
  let best = 0;
  let bestDot = -Infinity;
  for (let code = 1; code <= 8; code++) {
    const dot = DIRS[code][0] * gx + DIRS[code][1] * gy;
    if (dot > bestDot) {
      bestDot = dot;
      best = code;
    }
  }
  return best;
}

const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, 1], KeyW: [0, 1],
  ArrowDown: [0, -1], KeyS: [0, -1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};

/** Which direction keys are down. */
export class KeyTracker {
  private down = new Set<string>();

  /** True if the key is one this game uses (so the page shouldn't scroll). */
  press(code: string): boolean {
    if (!(code in KEYS)) return false;
    this.down.add(code);
    return true;
  }

  release(code: string): void {
    this.down.delete(code);
  }

  clear(): void {
    this.down.clear();
  }

  get any(): boolean {
    return this.down.size > 0;
  }

  /** The screen push from the keys: each of x and y is −1, 0 or 1. */
  vector(): [number, number] {
    let x = 0;
    let y = 0;
    for (const code of this.down) {
      x += KEYS[code][0];
      y += KEYS[code][1];
    }
    return [Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))];
  }
}

/** A pointer drag as a screen push (the pointer's y grows downwards, the push's y grows up). Null inside the dead zone. */
export function dragVector(dx: number, dy: number, deadZone: number): [number, number] | null {
  return dx * dx + dy * dy < deadZone * deadZone ? null : [dx, -dy];
}
