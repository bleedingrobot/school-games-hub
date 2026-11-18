/**
 * Questions come in the order the track meets them (James, 19 Nov 2026: a gate's question used to pop up while a pit stop
 * before it was still to come, so the maths came out of order). Every stop, gate and number-gem trail is put in order along the
 * course's route; a gate's or trail's question only shows once everything before it is done. Display only: it never changes a run.
 */
import type { Course } from '../../../shared/marble/course';

export type OrderStep = { kind: 'stop' | 'gate' | 'gems'; index: number; pos: number };

/** How close (in tiles) the marble has to be to a gate's sign for its question to show. */
export const SIGN_RANGE = 7;
/** How close to a number gem trail's gems its question shows. */
export const GEM_RANGE = 8;
/** How close to a trail's last gems counts as having rolled past the trail. */
const PASSED_RANGE = 1.5;

/** How far along the route (in tiles) a point is: where it lands on the nearest stretch of the route. */
function along(route: ReadonlyArray<readonly [number, number]>, x: number, y: number): number {
  let best = Infinity;
  let pos = 0;
  let run = 0;
  for (let i = 0; i + 1 < route.length; i++) {
    const [ax, ay] = route[i];
    const [bx, by] = route[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
    const d = (ax + t * dx - x) ** 2 + (ay + t * dy - y) ** 2;
    const len = Math.sqrt(len2);
    if (d < best - 1e-9) {
      best = d;
      pos = run + t * len;
    }
    run += len;
  }
  return pos;
}

/** Every stop, gate and gem trail on the course, in the order the track meets them. */
export function questionOrder(course: Course): OrderStep[] {
  const route = course.def.route;
  const steps: OrderStep[] = [];
  const sums = new Map<number, [number, number, number]>();
  for (let i = 0; i < course.tiles.length; i++) {
    const s = course.pitAt[i];
    if (s < 0) continue;
    const t = sums.get(s) ?? [0, 0, 0];
    t[0] += (i % course.width) + 0.5;
    t[1] += Math.floor(i / course.width) + 0.5;
    t[2]++;
    sums.set(s, t);
  }
  sums.forEach(([sx, sy, n], s) => steps.push({ kind: 'stop', index: s, pos: along(route, sx / n, sy / n) }));
  course.gates.forEach((g, i) => steps.push({ kind: 'gate', index: i, pos: along(route, g.sign[0] + 0.5, g.sign[1] + 0.5) }));
  course.gems.forEach((t, i) => steps.push({ kind: 'gems', index: i, pos: along(route, t.sign[0] + 0.5, t.sign[1] + 0.5) }));
  return steps.sort((a, b) => a.pos - b.pos);
}

const near = (x: number, y: number, px: number, py: number, range: number) => (px - x) ** 2 + (py - y) ** 2 < range * range;

/**
 * The question to show now, if any: the first gate or trail not yet done, and only when nothing before it is still to come and
 * the marble is near it. `passed` remembers the trails rolled past (kept by the caller between frames, cleared on a restart).
 */
export function questionToShow(
  course: Course,
  order: readonly OrderStep[],
  state: { x: number; y: number; pitStops: readonly number[]; gateChoices: readonly number[] },
  passed: Set<number>,
): { kind: 'gate' | 'gems'; index: number } | null {
  const { x, y } = state;
  course.gems.forEach((t, i) => {
    const last = t.groups[t.groups.length - 1];
    if (last?.spots.some(([gx, gy]) => near(x, y, gx, gy, PASSED_RANGE))) passed.add(i);
  });
  const done = (s: OrderStep) =>
    s.kind === 'stop' ? state.pitStops.includes(s.index) : s.kind === 'gate' ? state.gateChoices[s.index] >= 0 : passed.has(s.index);
  // Anything before a stop or gate that is done counts as done too (a marble that somehow skipped it isn't held up for ever).
  let from = 0;
  order.forEach((s, i) => {
    if (s.kind !== 'gems' && done(s)) from = i + 1;
  });
  for (let i = from; i < order.length; i++) {
    const s = order[i];
    if (done(s)) continue;
    if (s.kind === 'stop') return null;
    if (s.kind === 'gate') {
      const g = course.gates[s.index];
      return near(x, y, g.sign[0] + 0.5, g.sign[1] + 0.5, SIGN_RANGE) ? { kind: 'gate', index: s.index } : null;
    }
    const t = course.gems[s.index];
    const isNear = near(x, y, t.sign[0] + 0.5, t.sign[1] + 0.5, SIGN_RANGE) || t.groups.some((g) => g.spots.some(([gx, gy]) => near(x, y, gx, gy, GEM_RANGE)));
    if (isNear) return { kind: 'gems', index: s.index };
    // A trail is a bonus, not a must: if the marble isn't near it, the next gate or stop can still have its turn.
  }
  return null;
}
