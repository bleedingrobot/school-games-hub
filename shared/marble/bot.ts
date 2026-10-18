/**
 * A simple bot that steers a marble along a course's waypoints. It makes each course's
 * reference run (the proof the course can be finished, and where the gold time comes from).
 */
import type { Course } from './course';
import { DIRS, clockSteps, makeWorld, newRun, stepRun, type RunOptions, type RunState } from './engine';
import { pushInput, type InputRuns } from './inputs';

export interface BotRun {
  runs: [number, number][];
  state: RunState;
}

/** Aims at the next waypoint, taking whichever of the 8 directions points closest to it. */
export function botRun(course: Course, options: RunOptions = {}, maxSteps = 60 * 120): BotRun {
  const w = makeWorld(course, options);
  const s = newRun(w);
  const runs: [number, number][] = [];
  let at = 0;
  const route = course.def.route;
  while (s.outcome === 'running' && s.steps < maxSteps) {
    let [tx, ty] = route[Math.min(at, route.length - 1)];
    if (at < route.length - 1 && (tx - s.x) ** 2 + (ty - s.y) ** 2 < 0.8 * 0.8) {
      at++;
      [tx, ty] = route[at];
    }
    // Aim at the waypoint, and push against any sideways drift (ice carries a marble off line).
    const rx = tx - s.x;
    const ry = ty - s.y;
    const dist = Math.sqrt(rx * rx + ry * ry) || 1;
    const ux = rx / dist;
    const uy = ry / dist;
    const along = s.vx * ux + s.vy * uy;
    const dx = ux * 3 - 0.6 * (s.vx - along * ux);
    const dy = uy * 3 - 0.6 * (s.vy - along * uy);
    let best = 0;
    let bestDot = -Infinity;
    for (let code = 1; code <= 8; code++) {
      const dot = DIRS[code][0] * dx + DIRS[code][1] * dy;
      if (dot > bestDot) {
        bestDot = dot;
        best = code;
      }
    }
    pushInput(runs, best);
    stepRun(w, s, best);
  }
  return { runs, state: s };
}

export type { InputRuns };
export { clockSteps };
