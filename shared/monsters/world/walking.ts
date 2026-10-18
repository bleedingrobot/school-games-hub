/**
 * Walking rules: which tiles you can step on, turning on the spot, the shortest way to a tapped
 * tile, and where the camera looks. Pure: the screen only draws what these say.
 */
import { DELTA, DIRS, OPPOSITE, type Dir, type Gate, type GameMap, type Thing } from './types';

export const inMap = (map: GameMap, x: number, y: number) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < map.width && y < map.height;

const NO_BADGES: readonly string[] = [];

/**
 * Can't walk here: off the map, a wall tile (tree, house, water), a person or sign, or a gate
 * whose badge you don't hold (`badges` is what you hold; leave it out for "none").
 * Doors and exits can be walked on.
 */
export function isBlocked(map: GameMap, x: number, y: number, badges: readonly string[] = NO_BADGES): boolean {
  if (!inMap(map, x, y)) return true;
  if (map.warps.some((w) => w.x === x && w.y === y)) return false;
  const gate = gateAt(map, x, y);
  if (gate) return !badges.includes(gate.badge);
  return map.blocked[y * map.width + x];
}

export const gateAt = (map: GameMap, x: number, y: number) => map.gates.find((g) => g.x === x && g.y === y);

export const warpAt = (map: GameMap, x: number, y: number) => map.warps.find((w) => w.x === x && w.y === y);
export const thingAt = (map: GameMap, x: number, y: number): Thing | undefined => map.things.find((t) => t.x === x && t.y === y);

/** The direction from one tile to a tile right next to it (or null). */
export function dirBetween(from: { x: number; y: number }, to: { x: number; y: number }): Dir | null {
  for (const d of DIRS) if (from.x + DELTA[d][0] === to.x && from.y + DELTA[d][1] === to.y) return d;
  return null;
}

/**
 * The shortest way to a tile, as a list of directions, or null when there isn't one.
 * It never walks over an exit or door on the way (that would take you off the map), only onto
 * one if that is where you asked to go.
 */
export function findPath(map: GameMap, from: { x: number; y: number }, goal: { x: number; y: number }, badges: readonly string[] = NO_BADGES): Dir[] | null {
  if (from.x === goal.x && from.y === goal.y) return [];
  if (isBlocked(map, goal.x, goal.y, badges)) return null;
  const key = (x: number, y: number) => y * map.width + x;
  const came = new Map<number, { prev: number; dir: Dir }>();
  const seen = new Set<number>([key(from.x, from.y)]);
  const queue: [number, number][] = [[from.x, from.y]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const d of DIRS) {
      const nx = x + DELTA[d][0];
      const ny = y + DELTA[d][1];
      const k = key(nx, ny);
      if (seen.has(k) || isBlocked(map, nx, ny, badges)) continue;
      seen.add(k);
      came.set(k, { prev: key(x, y), dir: d });
      if (nx === goal.x && ny === goal.y) {
        const path: Dir[] = [];
        for (let at = k; at !== key(from.x, from.y); at = came.get(at)!.prev) path.unshift(came.get(at)!.dir);
        return path;
      }
      if (!warpAt(map, nx, ny)) queue.push([nx, ny]);
    }
  }
  return null;
}

/** The shortest way to stand next to a thing, and which way to face it from there. */
export function findPathBeside(map: GameMap, from: { x: number; y: number }, thing: { x: number; y: number }, badges: readonly string[] = NO_BADGES): { path: Dir[]; face: Dir } | null {
  let best: { path: Dir[]; face: Dir } | null = null;
  for (const d of DIRS) {
    const sx = thing.x + DELTA[d][0];
    const sy = thing.y + DELTA[d][1];
    if (isBlocked(map, sx, sy, badges) || warpAt(map, sx, sy)) continue;
    const path = findPath(map, from, { x: sx, y: sy }, badges);
    if (path && (!best || path.length < best.path.length)) best = { path, face: OPPOSITE[d] };
  }
  return best;
}

export type TapPlan =
  | { kind: 'walk'; path: Dir[] }
  | { kind: 'talk'; path: Dir[]; face: Dir; thing: Thing | Gate }
  | { kind: 'none' };

/** What a tap on a tile should do: walk there by the shortest way, or walk up to a person or sign and talk. */
export function planTap(map: GameMap, from: { x: number; y: number }, tx: number, ty: number, badges: readonly string[] = NO_BADGES): TapPlan {
  if (!inMap(map, tx, ty)) return { kind: 'none' };
  // A closed gate is something to talk to, like a sign; an open one is just a tile.
  const thing = thingAt(map, tx, ty) ?? (isBlocked(map, tx, ty, badges) ? gateAt(map, tx, ty) : undefined);
  if (thing) {
    const way = findPathBeside(map, from, thing, badges);
    return way ? { kind: 'talk', path: way.path, face: way.face, thing } : { kind: 'none' };
  }
  const path = findPath(map, from, { x: tx, y: ty }, badges);
  return path && path.length ? { kind: 'walk', path } : { kind: 'none' };
}

/**
 * Where the camera's top-left corner is, in tiles, so the player (at `px`, `py`, which can be
 * between tiles while walking) is in the middle, but the view never goes past the map's edge.
 * A map smaller than the view sits in the middle (the corner is then negative).
 */
export function cameraFor(px: number, py: number, viewW: number, viewH: number, mapW: number, mapH: number): { x: number; y: number } {
  const axis = (p: number, view: number, size: number) => (size <= view ? (size - view) / 2 : Math.min(Math.max(p + 0.5 - view / 2, 0), size - view));
  return { x: axis(px, viewW, mapW), y: axis(py, viewH, mapH) };
}
