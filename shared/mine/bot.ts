/**
 * A pretend pilot that flies a whole level (docs/MINE-PLAN.md, section 11, Stage 1).
 *
 * It plays three jobs: it proves each level can be finished (key rooms in order, question doors
 * answered right, reactor destroyed, escape), it sets the medal times later, and the tests use its
 * recorded inputs to check the server's replay. It plays by the same rules and sends the same
 * inputs a person would, so its recorded run replays to exactly the same finish.
 */
import { ROBOTS, TURN_MAX, USE_RANGE } from './config';
import { MAX_RUN_STEPS } from './config';
import { clockSteps, newRun, stepRun, type RunState, type World } from './engine';
import { GRANT, NO_INPUT, packInput, pushInput, type PilotInput } from './inputs';
import { KEY_COLOURS, type Level } from './level';

export interface BotOptions {
  /** Stop after this many steps even if the level isn't finished. */
  maxSteps?: number;
  /** Fire at robots that can see the ship. On by default. */
  shoot?: boolean;
}

export interface BotRun {
  runs: [number, number][];
  state: RunState;
  /** Where the bot was heading when it stopped (for tests that find out why a level wasn't finished). */
  heading: { goal: number; waypoints: [number, number, number][] };
}

type Goal = { kind: 'key'; colour: number; room: number; x: number; y: number; z: number } | { kind: 'reactor' } | { kind: 'exit' };

function goalsFor(level: Level): Goal[] {
  const goals: Goal[] = [];
  for (const door of level.doors) {
    if (door.kind === 'question') continue;
    const colour = KEY_COLOURS.indexOf(door.kind);
    const key = level.keys.find((k) => k.colour === door.kind);
    if (key) goals.push({ kind: 'key', colour, room: key.room, x: key.x, y: key.y, z: key.z });
  }
  goals.push({ kind: 'reactor' }, { kind: 'exit' });
  return goals;
}

/** The rooms to fly through from one room to another, using only doors that can be opened by now. */
function route(level: Level, s: RunState, from: number, to: number): number[] {
  if (from === to) return [];
  const doorOf = new Map<string, number>();
  for (const d of level.doors) doorOf.set([...d.rooms].sort((a, b) => a - b).join('-'), d.id);
  const open = (a: number, b: number): boolean => {
    const id = doorOf.get(a < b ? `${a}-${b}` : `${b}-${a}`);
    if (id === undefined) return true;
    const door = level.doors[id];
    if (s.doorsOpen[id] === 1 || door.kind === 'question') return true;
    return s.keys[KEY_COLOURS.indexOf(door.kind)] === 1;
  };
  const before = new Map<number, number>([[from, -1]]);
  const todo = [from];
  for (let q = 0; q < todo.length; q++) {
    const here = todo[q];
    for (const [a, b] of level.edges) {
      const other = a === here ? b : b === here ? a : -1;
      if (other < 0 || before.has(other) || !open(here, other)) continue;
      before.set(other, here);
      todo.push(other);
    }
  }
  if (!before.has(to)) return [];
  const out: number[] = [];
  for (let r = to; r !== from; r = before.get(r) as number) out.push(r);
  return out.reverse();
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

export function flyLevel(w: World, options: BotOptions = {}): BotRun {
  const level = w.level;
  const maxSteps = options.maxSteps ?? MAX_RUN_STEPS;
  const shoot = options.shoot ?? true;
  const s = newRun(w);
  const runs: [number, number][] = [];
  const goals = goalsFor(level);
  let goalAt = 0;
  let waypoints: [number, number, number][] = [];
  let planned = -1;
  /** Steps in a row spent unable to line a target up (it is too far above or below to look at). */
  let cantAim = 0;

  const aim = (tx: number, ty: number, tz: number): { yaw: number; pitch: number; ahead: number; d: number } => {
    const dx = tx - s.px;
    const dy = ty - s.py;
    const dz = tz - s.pz;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const uz = dz / d;
    const ahead = s.fx * ux + s.fy * uy + s.fz * uz;
    let yaw = clamp(Math.round((s.rx * ux + s.ry * uy + s.rz * uz) * 15 * TURN_MAX), -TURN_MAX, TURN_MAX);
    // Right behind us there is no "left or right": just pick one.
    if (ahead < 0 && yaw === 0) yaw = TURN_MAX;
    return {
      yaw,
      pitch: clamp(Math.round((s.ux * ux + s.uy * uy + s.uz * uz) * 15 * TURN_MAX), -TURN_MAX, TURN_MAX),
      ahead,
      d,
    };
  };

  while (s.outcome === 'running' && s.steps < maxSteps) {
    // Answer any question door we are next to.
    let granted = false;
    for (const door of level.doors) {
      if (door.kind !== 'question' || s.doorsOpen[door.id] === 1) continue;
      const d = Math.sqrt((door.x - s.px) ** 2 + (door.y - s.py) ** 2 + (door.z - s.pz) ** 2);
      if (d < USE_RANGE - 0.5) {
        const code = GRANT + door.id;
        pushInput(runs, code);
        stepRun(w, s, code);
        granted = true;
        break;
      }
    }
    if (granted) continue;

    const goal = goals[goalAt];
    if (goal.kind === 'reactor' && s.reactorDown) goalAt++;
    if (goalAt >= goals.length) goalAt = goals.length - 1;
    const now = goals[goalAt];
    if (now.kind === 'key' && s.keys[now.colour] === 1) {
      goalAt++;
      continue;
    }

    // Plan the way when the goal changes, or when we run out of waypoints.
    if (planned !== goalAt || waypoints.length === 0) {
      planned = goalAt;
      const target = now.kind === 'key' ? now.room : now.kind === 'reactor' ? level.reactorRoom : level.start;
      const rooms = route(level, s, s.lastRoom, target);
      waypoints = rooms.map((r) => [level.rooms[r].cx + 0.5, level.rooms[r].cy + 0.5, level.rooms[r].cz + 0.5] as [number, number, number]);
      const last = now.kind === 'key' ? [now.x, now.y, now.z] : now.kind === 'reactor' ? [level.reactor.x, level.reactor.y, level.reactor.z] : [level.exit.x, level.exit.y, level.exit.z];
      waypoints.push(last as [number, number, number]);
    }

    // Where to look: a robot that can see us, or the next waypoint.
    const input: PilotInput = { ...NO_INPUT };
    let fireAt: [number, number, number] | null = null;
    let big = false;
    if (shoot) {
      let best = 1e9;
      for (const r of s.robots) {
        if (!r.alive || !r.alert || !r.seen) continue;
        // Out of energy and missiles: keep flying instead of standing there being shot.
        if (s.energy < 8 && s.missiles === 0) continue;
        const d = Math.sqrt((r.x - s.px) ** 2 + (r.y - s.py) ** 2 + (r.z - s.pz) ** 2);
        if (d < 24 && d < best) {
          best = d;
          fireAt = [r.x, r.y, r.z];
          big = ROBOTS[r.type].hp >= 40;
        }
      }
    }
    const atReactor = now.kind === 'reactor' && Math.sqrt((level.reactor.x - s.px) ** 2 + (level.reactor.y - s.py) ** 2 + (level.reactor.z - s.pz) ** 2) < 9 && waypoints.length <= 1;
    if (!fireAt && atReactor) {
      fireAt = [level.reactor.x, level.reactor.y, level.reactor.z];
      big = true;
    }
    const wp = waypoints[0];
    const look = fireAt ?? wp;
    const a = aim(look[0], look[1], look[2]);
    input.yaw = a.yaw;
    input.pitch = a.pitch;
    if (fireAt) {
      // Only shoot when the shot will really pass through the target (a near miss at long range wastes energy).
      const onTarget = a.ahead > 0.9 && a.d * Math.sqrt(1 - a.ahead * a.ahead) < 0.45;
      if (onTarget) {
        input.fire = true;
        input.missile = big && a.d > 3.5;
      }
      input.tz = 0;
      // Can't look straight up or down in steady flight: slide sideways until the target is in view.
      if (!onTarget && Math.abs(a.pitch) >= TURN_MAX) cantAim++;
      else cantAim = 0;
      if (cantAim > 12) input.tx = Math.floor(cantAim / 24) % 2 === 0 ? 1 : -1;
    } else {
      cantAim = 0;
      const toWp = aim(wp[0], wp[1], wp[2]);
      // Push towards the point along all three of the ship's axes, so it doesn't matter which way the nose points
      // (the nose can't look straight up or down in steady flight).
      const ex = wp[0] - s.px;
      const ey = wp[1] - s.py;
      const ez = wp[2] - s.pz;
      const braking = toWp.d < 3.5 && waypoints.length > 1 && s.vx * s.vx + s.vy * s.vy + s.vz * s.vz > 16;
      if (!braking) {
        // The best of the 26 pushes the keys can make: the one that points closest to the goal.
        const el = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1;
        let bestScore = -2;
        for (let tx = -1; tx <= 1; tx++)
          for (let ty = -1; ty <= 1; ty++)
            for (let tz = -1; tz <= 1; tz++) {
              if (tx === 0 && ty === 0 && tz === 0) continue;
              const px = s.rx * tx + s.ux * ty + s.fx * tz;
              const py = s.ry * tx + s.uy * ty + s.fy * tz;
              const pz = s.rz * tx + s.uz * ty + s.fz * tz;
              const score = (px * ex + py * ey + pz * ez) / (Math.sqrt(px * px + py * py + pz * pz) * el);
              if (score > bestScore + 1e-9) {
                bestScore = score;
                input.tx = tx;
                input.ty = ty;
                input.tz = tz;
              }
            }
      }
      if (toWp.d < (waypoints.length === 1 ? 1.2 : 0.8)) waypoints.shift();
      else if (atReactor) input.tz = 0;
    }
    if (atReactor) input.tz = 0;
    const code = packInput(input);
    pushInput(runs, code);
    stepRun(w, s, code);
  }
  return { runs, state: s, heading: { goal: goalAt, waypoints } };
}

export { clockSteps };
