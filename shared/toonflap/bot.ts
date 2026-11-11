/**
 * A bot that flies a Toon Flap course. The sim (scripts/toonflap-sim.mjs) uses it to prove every level can be flown with
 * no bumps, to set the medal times, and (with `wobble`) to see how many bumps a less careful flyer gets.
 */
import { BIRD_HALF, WALL_WIDTH } from './config';
import { gapsAt, newRun, stepRun, type RunState } from './engine';
import type { Course } from './levels';

export interface BotOptions {
  /** For each answer sign, the gap to fly through (default: the middle one). */
  gaps?: readonly number[];
  /** 0 = perfect. Bigger numbers aim less carefully and react late now and then (seeded, so the same every time). */
  wobble?: number;
  seed?: number;
}

const copy = (s: RunState): RunState => ({ ...s, picks: [...s.picks] });

/** The bot's simple rule: where to aim, and whether to flap now. */
function aim(course: Course, s: RunState, opts: BotOptions, aimOff: number): boolean {
  const wall = course.walls[s.nextWall];
  let target = 5;
  if (wall) {
    const ahead = Math.max(0, (wall.x - s.x) / course.speed) * 60;
    const gaps = gapsAt(wall, s.t + Math.round(ahead) + 6);
    const pick = wall.answer !== undefined ? (opts.gaps?.[wall.answer] ?? Math.floor(gaps.length / 2)) : 0;
    target = gaps[Math.min(pick, gaps.length - 1)].y;
    // Still inside the wall before: keep to its gap until clear of it.
    const prev = course.walls[s.nextWall - 1];
    if (prev && prev.x + WALL_WIDTH >= s.x - BIRD_HALF - 0.1) {
      const pg = gapsAt(prev, s.t);
      target = pg.reduce((b, g) => (Math.abs(g.y - s.y) < Math.abs(b.y - s.y) ? g : b), pg[0]).y;
    }
  }
  const look = copy(s);
  let low = look.y;
  for (let k = 0; k < 4 && look.mode === 'fly'; k++) {
    stepRun(course, look, false);
    low = Math.min(low, look.y);
  }
  return low < target + aimOff - 0.45 && s.vy < 1;
}

/** Does flapping now (or not), then flying by the simple rule for a while, end in a bump? */
function rolloutBumps(course: Course, s: RunState, first: boolean, opts: BotOptions, steps = 70): boolean {
  const look = copy(s);
  for (let k = 0; k < steps && look.mode === 'fly'; k++) {
    const flap = k === 0 ? first : aim(course, look, opts, 0);
    if (stepRun(course, look, flap) === 'bump') return true;
  }
  return false;
}

export function botRun(course: Course, opts: BotOptions = {}): { state: RunState; flaps: number[] } {
  const s = newRun(course);
  const flaps: number[] = [];
  const wobble = opts.wobble ?? 0;
  let seed = opts.seed ?? 12345;
  const random = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  let aimOff = 0;
  let late = 0;
  for (let guard = 0; s.mode !== 'done' && guard < 200000; guard++) {
    let flap = false;
    if (s.mode === 'hover') flap = true;
    else {
      if (wobble > 0 && s.t % 30 === 0) aimOff = (random() * 2 - 1) * wobble;
      flap = aim(course, s, opts, aimOff);
      // A careful flyer also thinks ahead: try both, flying on its usual way for a second after, and take the one with no bump.
      if (wobble === 0) {
        const other = !flap;
        if (rolloutBumps(course, s, flap, opts) && !rolloutBumps(course, s, other, opts)) flap = other;
      }
      if (flap && wobble > 0 && late === 0 && random() < wobble * 0.08) late = 1 + Math.floor(random() * 10);
      if (late > 0) {
        late--;
        flap = false;
      }
    }
    if (flap) flaps.push(s.t);
    stepRun(course, s, flap);
  }
  return { state: s, flaps };
}

interface Node {
  s: RunState;
  flap: boolean;
  parent: Node | null;
}

/**
 * The careful bot: a search that tries flapping and not flapping at every step, drops every path that bumps (or picks
 * the wrong answer gap), merges paths that are in the same place, and keeps the `width` best. If it finishes, the level
 * can be flown with no bumps. Returns null if it can't find a way.
 */
export function planRun(course: Course, opts: { gaps?: readonly number[]; width?: number } = {}): { state: RunState; flaps: number[] } | null {
  const width = opts.width ?? 200;
  const want = opts.gaps ?? course.signs.map((sg) => Math.floor(course.walls[sg.wall].gaps.length / 2));
  let beam: Node[] = [{ s: newRun(course), flap: false, parent: null }];
  for (let guard = 0; guard < 20000; guard++) {
    const done = beam.find((n) => n.s.mode === 'done');
    if (done) {
      const flaps: number[] = [];
      for (let n: Node | null = done; n && n.parent; n = n.parent) if (n.flap) flaps.push(n.parent.s.t);
      return done.s.outcome === 'finished' ? { state: done.s, flaps: flaps.reverse() } : null;
    }
    const next = new Map<string, Node>();
    for (const node of beam) {
      // Hovering (start or perch): the only way on is a flap.
      for (const flap of node.s.mode === 'hover' ? [true] : [false, true]) {
        const s = copy(node.s);
        if (stepRun(course, s, flap) === 'bump') continue;
        if (s.picks.some((p, i) => p !== null && p !== want[i])) continue;
        const key = `${s.t}|${Math.round(s.y * 30)}|${Math.round(s.vy * 4)}|${s.mode}`;
        if (!next.has(key)) next.set(key, { s, flap, parent: node });
      }
    }
    if (next.size === 0) return null;
    let list = [...next.values()];
    if (list.length > width) {
      // Keep the paths nearest the middle of the next opening (they have the most room either way).
      const score = (n: Node) => {
        const wall = course.walls[n.s.nextWall];
        if (!wall) return Math.abs(n.s.y - 5);
        // Where the opening will be when the bird gets there (sliding walls move).
        const gaps = gapsAt(wall, n.s.t + Math.round((Math.max(0, wall.x - n.s.x) / course.speed) * 60));
        const g = gaps[wall.answer !== undefined ? Math.min(want[wall.answer] ?? 0, gaps.length - 1) : 0];
        return Math.abs(n.s.y - g.y) + Math.abs(n.s.vy) * 0.05;
      };
      list = list.map((n) => ({ n, v: score(n) })).sort((a, b) => a.v - b.v).slice(0, width).map((o) => o.n);
    }
    beam = list;
  }
  return null;
}
