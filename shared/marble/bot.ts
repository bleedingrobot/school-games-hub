/**
 * A simple bot that steers a marble along a course's waypoints. It makes each course's
 * reference run (the proof the course can be finished, and where the gold time comes from).
 */
import type { Course } from './course';
import { DIRS, clockSteps, gateOpen, geyserPhase, makeWorld, newRun, stepRun, trapdoorSolid, type RunOptions, type RunState, type World } from './engine';
import { BONUS, pushInput, type InputRuns } from './inputs';

/**
 * True if the next tile or two along the marble's way is a hazard it should wait for: a gate that is shut or about to
 * shut, or a trapdoor that is about to drop away. (A person would watch the timing too.)
 */
function mustWait(w: World, s: RunState, ux: number, uy: number): boolean {
  // A geyser: stop about two tiles short and go when it is about to puff, so the marble arrives as it throws.
  for (let reach = 0.5; reach <= 2.6; reach += 0.5) {
    const gx = Math.floor(s.x + ux * reach);
    const gy = Math.floor(s.y + uy * reach);
    if (gx < 0 || gy < 0 || gx >= w.course.width || gy >= w.course.height) continue;
    if (w.course.tiles[gy * w.course.width + gx].ch === 'g') {
      const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
      const ahead = speed > 2 ? 14 : 40;
      if (geyserPhase(w.t + ahead, gx, gy) !== 2 || geyserPhase(w.t + ahead - 10, gx, gy) === 0) return true;
      break;
    }
  }
  // (A marble on a belt takes a few tiles to stop, so look a good way ahead.)
  for (const reach of [0.9, 1.7, 2.6, 3.5]) {
    const tx = Math.floor(s.x + ux * reach);
    const ty = Math.floor(s.y + uy * reach);
    if (tx < 0 || ty < 0 || tx >= w.course.width || ty >= w.course.height) continue;
    const ch = w.course.tiles[ty * w.course.width + tx].ch;
    // Crossing takes under a second; the hazard must stay friendly for that long.
    if (ch === 'q' && ![5, 30, 55, 80].every((d) => gateOpen(w.t + d, tx))) return true;
    if (ch === 't' && !(trapdoorSolid(w.t, tx) && trapdoorSolid(w.t + 70, tx))) return true;
  }
  return false;
}

export interface BotOptions extends RunOptions {
  /** At every answer gate, roll into a tunnel that is shut first (a student who guessed wrong), then back out and through the open one. */
  wrongFirst?: boolean;
  /** Answer every pit stop right (a BONUS input takes the seconds off). The right gems come from `rightGems`. */
  answers?: boolean;
}

/**
 * The waypoints for a run: the course's route with each gate's way through put in (through the open door; a shut one first if
 * `wrongFirst`), and a detour to the right gem of each gem group.
 */
export function routeFor(course: Course, openDoors: readonly number[], wrongFirst = false, rightGems: readonly number[] = []): ReadonlyArray<readonly [number, number]> {
  const events: Array<{ after: number; points: Array<readonly [number, number]> }> = [];
  for (const gate of course.gates) {
    const open = gate.tunnels.find((t) => openDoors.includes(t.door)) ?? gate.tunnels[0];
    const points: Array<readonly [number, number]> = [];
    if (wrongFirst) {
      const wrong = gate.tunnels.find((t) => t !== open);
      if (wrong) points.push(...wrong.dead, course.def.route[gate.after - 1]);
    }
    points.push(...open.route);
    events.push({ after: gate.after, points });
  }
  course.gems.forEach((trail, t) => {
    trail.groups.forEach((group, g) => {
      const gem = course.gemList.find((spot, id) => spot.trail === t && spot.group === g && rightGems.includes(id));
      if (gem) events.push({ after: group.after, points: [[gem.x, gem.y]] });
    });
  });
  events.sort((a, b) => a.after - b.after);
  const out: Array<readonly [number, number]> = [];
  const main = course.def.route;
  let at = 0;
  for (const e of events) {
    out.push(...main.slice(at, e.after), ...e.points);
    at = Math.max(at, e.after);
  }
  out.push(...main.slice(at));
  // A waypoint on top of the one before it would look like a sharp turn to the bot.
  return out.filter((p, i) => i === 0 || p[0] !== out[i - 1][0] || p[1] !== out[i - 1][1]);
}

export interface BotRun {
  runs: [number, number][];
  state: RunState;
}

/** Aims at the next waypoint, taking whichever of the 8 directions points closest to it. */
export function botRun(course: Course, options: BotOptions = {}, maxSteps = 60 * 120): BotRun {
  const w = makeWorld(course, options);
  const s = newRun(w);
  const runs: [number, number][] = [];
  let at = 0;
  const route = routeFor(course, options.openDoors ?? [], options.wrongFirst, options.rightGems ?? []);
  let pitsAnswered = 0;
  // A right answer at a pit stop is a BONUS input, right after the marble reaches it.
  const takeBonus = () => {
    if (options.answers && s.pitStops.length > pitsAnswered) {
      pitsAnswered = s.pitStops.length;
      pushInput(runs, BONUS);
      stepRun(w, s, BONUS);
    }
  };
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
    // Slow down before a sharp corner coming up (momentum would carry the marble off the track):
    // look along the route for the first sharp turn and keep to a speed that can stop in time.
    const speedNow = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    let cornerBrake = false;
    {
      let along = dist;
      for (let j = at; j < route.length - 1 && along < 6; j++) {
        const [ax, ay] = route[j];
        const [bx, by] = route[j + 1];
        const [px, py] = j === at ? [s.x, s.y] : route[j - 1];
        const d1x = ax - px, d1y = ay - py, d2x = bx - ax, d2y = by - ay;
        const l1 = Math.sqrt(d1x * d1x + d1y * d1y) || 1;
        const l2 = Math.sqrt(d2x * d2x + d2y * d2y) || 1;
        if ((d1x * d2x + d1y * d2y) / (l1 * l2) < 0.5) {
          cornerBrake = speedNow > 0.5 + 0.8 * along;
          break;
        }
        along += l2;
      }
    }
    if (mustWait(w, s, ux, uy) || cornerBrake) {
      // Hold still (push against the way we are going) until it is safe.
      const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
      let brake = 0;
      if (speed > 0.25) {
        let bd = -Infinity;
        for (let code = 1; code <= 8; code++) {
          const d = -(DIRS[code][0] * s.vx + DIRS[code][1] * s.vy);
          if (d > bd) {
            bd = d;
            brake = code;
          }
        }
      }
      pushInput(runs, brake);
      stepRun(w, s, brake);
      takeBonus();
      continue;
    }
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
    takeBonus();
  }
  return { runs, state: s };
}

export type { InputRuns };
export { clockSteps };
