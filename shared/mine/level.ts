/**
 * Making a mine (docs/MINE-PLAN.md, section 3).
 *
 * A level is made from a recipe and a seed, so the browser and the server build exactly the same
 * mine. The mine is a 3D grid of blocks (1 unit each). Rooms sit on a coarse grid and are joined by
 * 5-block tunnels that bend up, down and sideways, like a twisty maze. Keys and doors are placed so
 * the level can always be finished: key 1 is somewhere you can reach with no keys, key 2 is behind
 * door 1, and so on. Question doors are opened by a right answer (a GRANT input), not a key.
 *
 * Everything here is whole numbers and a seeded counter, so a level is identical everywhere.
 */
import {
  ESCAPE_EXTRA_SECONDS, ESCAPE_SPEED, MAX_TARGETS, ROBOT_TYPES, ROOM_HALF_SIZES, ROOM_SPACING, STEPS_PER_SECOND,
  TUNNEL_WIDTH, type RobotType,
} from './config';

export type KeyColour = 'blue' | 'yellow' | 'red';
export type DoorKind = KeyColour | 'question';
export const KEY_COLOURS: readonly KeyColour[] = ['blue', 'yellow', 'red'];
export type PadKind = 'shield' | 'energy' | 'missiles';
export type PickupKind = 'shield' | 'energy' | 'missiles';

export interface Recipe {
  id: string;
  seed: number;
  /** How many rooms across, deep and high. */
  dims: readonly [number, number, number];
  /** Doors on the way to the reactor, in order. Each key colour at most once. */
  doors: readonly DoorKind[];
  /** Which of those doors (by position in `doors`) are question doors drawn as number gates: same rules, a different look. */
  gates?: readonly number[];
  /** Robots in ordinary rooms, and extra guards in the reactor room. */
  robots: number;
  guards: number;
  /** Relative chances of [drone, hunter, turret] and, optionally, brute. */
  mix: readonly [number, number, number] | readonly [number, number, number, number];
  pickups: { shield: number; energy: number; missiles: number };
  pads: readonly PadKind[];
  /** Extra tunnels that make loops, never around a door. */
  loops: number;
  /** The escape timer is the way back at ESCAPE_SPEED times this (more is easier). */
  escapeFactor: number;
}

export interface Room {
  index: number;
  /** Where on the coarse grid. */
  i: number;
  j: number;
  k: number;
  /** The middle block of the room, in blocks. */
  cx: number;
  cy: number;
  cz: number;
  /** Half the room's width, depth and height (not counting the middle block). */
  hx: number;
  hy: number;
  hz: number;
}

export interface Door {
  id: number;
  kind: DoorKind;
  /** A question door drawn as a gate with answer panels (the rules are the same as for any question door). */
  gate: boolean;
  /** The two rooms it sits between. */
  rooms: readonly [number, number];
  /** The blocks that make it up (they are open space until the door is shut by `doorAt`). */
  blocks: number[];
  /** Where its middle is, in world units. */
  x: number;
  y: number;
  z: number;
}

/** The number a GRANT uses for the reactor's console: after all the doors and pads. */
export function reactorTargetId(level: { doors: readonly unknown[]; pads: readonly unknown[] }): number {
  return level.doors.length + level.pads.length;
}

export interface Spot {
  x: number;
  y: number;
  z: number;
}
export interface KeyItem extends Spot {
  colour: KeyColour;
  room: number;
}
export interface Pickup extends Spot {
  kind: PickupKind;
  room: number;
}
export interface Pad extends Spot {
  /** Its number for GRANT: after all the doors. */
  id: number;
  kind: PadKind;
  room: number;
}
export interface RobotSpawn extends Spot {
  type: RobotType;
  room: number;
}

export interface Level {
  recipe: Recipe;
  /** The mine's size in blocks. */
  nx: number;
  ny: number;
  nz: number;
  /** 1 where the rock is solid. Index: x + nx × (y + ny × z). */
  solid: Uint8Array;
  /** For each block, the number of the door that fills it while shut, or −1. */
  doorAt: Int8Array;
  rooms: Room[];
  /** Pairs of room numbers joined by a tunnel. */
  edges: [number, number][];
  start: number;
  reactorRoom: number;
  doors: Door[];
  keys: KeyItem[];
  pickups: Pickup[];
  pads: Pad[];
  robots: RobotSpawn[];
  reactor: Spot;
  exit: Spot;
  /** The path from the start to the reactor, as room numbers. */
  path: number[];
  /** Length of that path in world units. */
  pathLength: number;
  escapeSteps: number;
}

/** A small repeatable stream of whole numbers (exact everywhere). */
export function makeRng(seed: number): () => number {
  let s = (Math.floor(Math.abs(seed)) % 2147483646) + 1;
  return () => {
    s = (s * 48271) % 2147483647;
    return s;
  };
}

export function blockIndex(level: { nx: number; ny: number }, x: number, y: number, z: number): number {
  return x + level.nx * (y + level.ny * z);
}

export function makeLevel(recipe: Recipe): Level {
  const rng = makeRng(recipe.seed);
  const pick = (n: number) => rng() % n;
  const [rx, ry, rz] = recipe.dims;
  const count = rx * ry * rz;
  const S = ROOM_SPACING;
  const nx = rx * S;
  const ny = ry * S;
  const nz = rz * S;
  const index = (i: number, j: number, k: number) => i + rx * (j + ry * k);

  // Rooms.
  const rooms: Room[] = [];
  for (let k = 0; k < rz; k++)
    for (let j = 0; j < ry; j++)
      for (let i = 0; i < rx; i++) {
        rooms.push({
          index: index(i, j, k), i, j, k,
          cx: i * S + S / 2, cy: j * S + S / 2, cz: k * S + S / 2,
          hx: ROOM_HALF_SIZES[pick(ROOM_HALF_SIZES.length)],
          hy: ROOM_HALF_SIZES[pick(ROOM_HALF_SIZES.length)],
          hz: ROOM_HALF_SIZES[pick(ROOM_HALF_SIZES.length)],
        });
      }

  const neighbours = (r: number): number[] => {
    const { i, j, k } = rooms[r];
    const out: number[] = [];
    if (i > 0) out.push(index(i - 1, j, k));
    if (i < rx - 1) out.push(index(i + 1, j, k));
    if (j > 0) out.push(index(i, j - 1, k));
    if (j < ry - 1) out.push(index(i, j + 1, k));
    if (k > 0) out.push(index(i, j, k - 1));
    if (k < rz - 1) out.push(index(i, j, k + 1));
    return out;
  };

  // A twisty maze: a random walk that always goes on from the newest room (a "depth-first" spanning tree).
  const start = pick(count);
  const seen = new Uint8Array(count);
  const parent = new Int32Array(count).fill(-1);
  const tree: [number, number][] = [];
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const here = stack[stack.length - 1];
    const options = neighbours(here).filter((n) => !seen[n]);
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const next = options[pick(options.length)];
    seen[next] = 1;
    parent[next] = here;
    tree.push([here, next]);
    stack.push(next);
  }

  // How far each room is from the start along the tree, and the farthest one holds the reactor.
  const depth = new Int32Array(count).fill(-1);
  depth[start] = 0;
  const queue = [start];
  const adj: number[][] = Array.from({ length: count }, () => []);
  for (const [a, b] of tree) {
    adj[a].push(b);
    adj[b].push(a);
  }
  for (let q = 0; q < queue.length; q++) {
    const here = queue[q];
    for (const n of adj[here]) if (depth[n] < 0) {
      depth[n] = depth[here] + 1;
      queue.push(n);
    }
  }
  let reactorRoom = start;
  for (let r = 0; r < count; r++) if (depth[r] > depth[reactorRoom]) reactorRoom = r;
  const path: number[] = [];
  for (let r = reactorRoom; r !== -1; r = parent[r]) path.push(r);
  path.reverse();
  const edgesOnPath = path.length - 1;
  if (edgesOnPath < recipe.doors.length + 1) throw new Error(`level ${recipe.id}: the way to the reactor is too short for ${recipe.doors.length} doors`);
  if (recipe.doors.length + recipe.pads.length + 1 > MAX_TARGETS) throw new Error(`level ${recipe.id}: too many doors and pads`);

  // Doors sit on evenly spaced steps of the way to the reactor.
  const doorEdges: number[] = []; // door i is between path[e − 1] and path[e]
  for (let d = 0; d < recipe.doors.length; d++) doorEdges.push(Math.max(d + 1, Math.floor(((d + 1) * edgesOnPath) / (recipe.doors.length + 1))));
  for (let d = 1; d < doorEdges.length; d++) if (doorEdges[d] <= doorEdges[d - 1]) doorEdges[d] = doorEdges[d - 1] + 1;
  const edgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const doorOfEdge = new Map<string, number>();
  doorEdges.forEach((e, d) => doorOfEdge.set(edgeKey(path[e - 1], path[e]), d));

  // Extra tunnels (loops) only join rooms that are already on the same side of every door, so no door can be walked around.
  const region = new Int32Array(count).fill(-1);
  let regions = 0;
  for (let r = 0; r < count; r++) {
    if (region[r] >= 0) continue;
    region[r] = regions;
    const todo = [r];
    while (todo.length) {
      const here = todo.pop() as number;
      for (const n of adj[here]) if (region[n] < 0 && !doorOfEdge.has(edgeKey(here, n))) {
        region[n] = regions;
        todo.push(n);
      }
    }
    regions++;
  }
  const edges: [number, number][] = tree.map(([a, b]) => [a, b]);
  const joined = new Set(edges.map(([a, b]) => edgeKey(a, b)));
  const spare: [number, number][] = [];
  for (let r = 0; r < count; r++) for (const n of neighbours(r)) if (n > r && !joined.has(edgeKey(r, n)) && region[r] === region[n]) spare.push([r, n]);
  for (let l = 0; l < recipe.loops && spare.length; l++) {
    const at = pick(spare.length);
    edges.push(spare[at]);
    spare.splice(at, 1);
  }

  // Carve the rock: everything solid, then rooms, then tunnels.
  const solid = new Uint8Array(nx * ny * nz).fill(1);
  const doorAt = new Int8Array(nx * ny * nz).fill(-1);
  const at = (x: number, y: number, z: number) => x + nx * (y + ny * z);
  const carve = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => {
    for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) solid[at(x, y, z)] = 0;
  };
  for (const r of rooms) carve(r.cx - r.hx, r.cx + r.hx, r.cy - r.hy, r.cy + r.hy, r.cz - r.hz, r.cz + r.hz);
  const tw = (TUNNEL_WIDTH - 1) / 2;
  for (const [a, b] of edges) {
    const A = rooms[a];
    const B = rooms[b];
    carve(Math.min(A.cx, B.cx) - tw, Math.max(A.cx, B.cx) + tw, Math.min(A.cy, B.cy) - tw, Math.max(A.cy, B.cy) + tw, Math.min(A.cz, B.cz) - tw, Math.max(A.cz, B.cz) + tw);
  }

  // Doors: a flat slab across the tunnel, half way between the two rooms.
  const doors: Door[] = recipe.doors.map((kind, id) => {
    const a = rooms[path[doorEdges[id] - 1]];
    const b = rooms[path[doorEdges[id]]];
    const mx = (a.cx + b.cx) / 2;
    const my = (a.cy + b.cy) / 2;
    const mz = (a.cz + b.cz) / 2;
    const axis = a.cx !== b.cx ? 0 : a.cy !== b.cy ? 1 : 2;
    const blocks: number[] = [];
    for (let u = -tw; u <= tw; u++)
      for (let v = -tw; v <= tw; v++) {
        const bx = axis === 0 ? mx : mx + u;
        const by = axis === 1 ? my : axis === 0 ? my + u : my + v;
        const bz = axis === 2 ? mz : mz + v;
        const idx = at(bx, by, bz);
        doorAt[idx] = id;
        blocks.push(idx);
      }
    return { id, kind, gate: kind === 'question' && (recipe.gates ?? []).includes(id), rooms: [a.index, b.index] as const, blocks, x: mx + 0.5, y: my + 0.5, z: mz + 0.5 };
  });

  // Keys: each in a room you can reach before its door (never the start or reactor room), spread out.
  const keys: KeyItem[] = [];
  const keyRooms = new Set<number>();
  const doorEdgeSet = (from: number) => {
    const blocked = new Set<string>();
    doorEdges.forEach((e, d) => {
      if (d >= from) blocked.add(edgeKey(path[e - 1], path[e]));
    });
    return blocked;
  };
  doors.forEach((door, d) => {
    if (door.kind === 'question') return;
    const blocked = doorEdgeSet(d);
    const reach = new Uint8Array(count);
    reach[start] = 1;
    const todo = [start];
    while (todo.length) {
      const here = todo.pop() as number;
      for (const n of adj[here]) if (!reach[n] && !blocked.has(edgeKey(here, n))) {
        reach[n] = 1;
        todo.push(n);
      }
    }
    let options: number[] = [];
    for (let r = 0; r < count; r++) if (reach[r] && r !== start && r !== reactorRoom && !keyRooms.has(r)) options.push(r);
    if (options.length === 0) options = [start];
    const room = options[pick(options.length)];
    keyRooms.add(room);
    keys.push({ colour: door.kind as KeyColour, room, ...spotIn(rooms[room], rng, 1) });
  });

  // Pickups, pads and robots go in rooms away from the start.
  const others: number[] = [];
  for (let r = 0; r < count; r++) if (r !== start) others.push(r);
  const anyRoom = () => others[pick(others.length)];
  const pickups: Pickup[] = [];
  (['shield', 'energy', 'missiles'] as const).forEach((kind) => {
    for (let n = 0; n < recipe.pickups[kind]; n++) {
      const room = anyRoom();
      pickups.push({ kind, room, ...spotIn(rooms[room], rng, 1) });
    }
  });
  const pads: Pad[] = recipe.pads.map((kind, n) => {
    const room = anyRoom();
    return { id: doors.length + n, kind, room, ...spotIn(rooms[room], rng, 1) };
  });
  const mix = [recipe.mix[0], recipe.mix[1], recipe.mix[2], recipe.mix[3] ?? 0];
  const total = mix[0] + mix[1] + mix[2] + mix[3];
  const robotType = (): RobotType => {
    let roll = pick(total);
    for (let t = 0; t < 4; t++) {
      if (roll < mix[t]) return ROBOT_TYPES[t];
      roll -= mix[t];
    }
    return 'drone';
  };
  const robots: RobotSpawn[] = [];
  for (let n = 0; n < recipe.robots; n++) {
    const room = anyRoom();
    robots.push({ type: robotType(), room, ...spotIn(rooms[room], rng, 0, true) });
  }
  const rr = rooms[reactorRoom];
  for (let n = 0; n < recipe.guards; n++) robots.push({ type: robotType(), room: reactorRoom, ...spotIn(rr, rng, 0, true) });

  // The reactor is in the middle of its room and the exit is the start room (you leave the way you came in).
  const reactor = { x: rr.cx + 0.5, y: rr.cy + 0.5, z: rr.cz + 0.5 };
  const sr = rooms[start];
  const exit = { x: sr.cx + 0.5, y: sr.cy + 0.5, z: sr.cz + 0.5 };
  const pathLength = edgesOnPath * S;
  const escapeSteps = (Math.floor((pathLength / ESCAPE_SPEED) * recipe.escapeFactor) + ESCAPE_EXTRA_SECONDS) * STEPS_PER_SECOND;

  return { recipe, nx, ny, nz, solid, doorAt, rooms, edges, start, reactorRoom, doors, keys, pickups, pads, robots, reactor, exit, path, pathLength, escapeSteps };
}

/** A spot inside a room, at least `margin` blocks from its walls, on a whole number of blocks (+ ½ to be in the middle of one). */
function spotIn(room: Room, rng: () => number, margin: number, clearOfShafts = false): Spot {
  const span = (half: number) => Math.max(0, half - margin);
  const off = (half: number) => (rng() % (2 * span(half) + 1)) - span(half);
  let dx = off(room.hx);
  let dy = off(room.hy);
  // Robots stay out of the middle column, so a shaft going up or down through a room is never blocked by one.
  for (let tries = 0; clearOfShafts && Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && tries < 12; tries++) {
    dx = off(room.hx);
    dy = off(room.hy);
  }
  return { x: room.cx + dx + 0.5, y: room.cy + dy + 0.5, z: room.cz + off(room.hz) + 0.5 };
}

/** The room a spot is inside (its walls plus a block), or −1 if it is in a tunnel. */
export function roomAt(level: Level, x: number, y: number, z: number): number {
  const S = ROOM_SPACING;
  const i = Math.floor(x / S);
  const j = Math.floor(y / S);
  const k = Math.floor(z / S);
  const [rx, ry, rz] = level.recipe.dims;
  if (i < 0 || j < 0 || k < 0 || i >= rx || j >= ry || k >= rz) return -1;
  const r = level.rooms[i + rx * (j + ry * k)];
  if (Math.abs(x - (r.cx + 0.5)) <= r.hx + 0.5 && Math.abs(y - (r.cy + 0.5)) <= r.hy + 0.5 && Math.abs(z - (r.cz + 0.5)) <= r.hz + 0.5) return r.index;
  return -1;
}

/**
 * The six levels. Fixed seeds, so the boards compare like with like. The first two are gentle (few robots, only
 * slow drones), so nearly everyone finishes them in their first lesson; levels 5 and 6 are the real challenge.
 */
export const RECIPES: readonly Recipe[] = [
  { id: 'l1', seed: 101, dims: [3, 3, 2], doors: ['blue', 'question'], robots: 3, guards: 1, mix: [1, 0, 0], pickups: { shield: 3, energy: 2, missiles: 2 }, pads: ['shield'], loops: 1, escapeFactor: 3.4 },
  { id: 'l2', seed: 202, dims: [4, 3, 2], doors: ['blue', 'question', 'question'], gates: [2], robots: 5, guards: 1, mix: [5, 1, 0], pickups: { shield: 3, energy: 3, missiles: 3 }, pads: ['shield', 'missiles'], loops: 2, escapeFactor: 3 },
  { id: 'l3', seed: 303, dims: [4, 4, 2], doors: ['blue', 'question', 'yellow', 'question'], gates: [3], robots: 10, guards: 3, mix: [3, 3, 1], pickups: { shield: 4, energy: 3, missiles: 3 }, pads: ['shield', 'energy', 'missiles'], loops: 3, escapeFactor: 2.3 },
  { id: 'l4', seed: 404, dims: [4, 4, 3], doors: ['blue', 'question', 'yellow', 'question', 'question'], gates: [3], robots: 14, guards: 4, mix: [2, 3, 2, 1], pickups: { shield: 5, energy: 4, missiles: 4 }, pads: ['shield', 'energy', 'missiles'], loops: 3, escapeFactor: 2.1 },
  { id: 'l5', seed: 505, dims: [5, 4, 3], doors: ['blue', 'question', 'yellow', 'question', 'red', 'question'], gates: [3, 5], robots: 18, guards: 5, mix: [2, 3, 3, 1], pickups: { shield: 6, energy: 5, missiles: 5 }, pads: ['shield', 'shield', 'energy', 'missiles'], loops: 4, escapeFactor: 1.9 },
  { id: 'l6', seed: 606, dims: [5, 5, 3], doors: ['blue', 'question', 'yellow', 'question', 'red', 'question', 'question'], gates: [3, 6], robots: 24, guards: 6, mix: [2, 3, 3, 2], pickups: { shield: 7, energy: 6, missiles: 6 }, pads: ['shield', 'shield', 'energy', 'energy', 'missiles'], loops: 5, escapeFactor: 1.7 },
];

/**
 * Hard mode: the same mine (same seed, so the same tunnels, keys and doors) with more robots, tougher kinds, fewer
 * pickups and a shorter escape timer. Its times go on their own board (`l1:hard`).
 */
export function hardRecipe(r: Recipe): Recipe {
  const m = r.mix;
  return {
    ...r,
    id: `${r.id}:hard`,
    robots: Math.ceil(r.robots * 1.5),
    guards: r.guards + 2,
    mix: [Math.max(1, m[0] - 1), m[1] + 2, m[2] + 1, (m[3] ?? 0) + 1],
    pickups: { shield: Math.max(1, r.pickups.shield - 1), energy: r.pickups.energy, missiles: Math.max(1, r.pickups.missiles - 1) },
    escapeFactor: Math.max(1.3, r.escapeFactor - 0.4),
  };
}

export function recipeById(id: string): Recipe | undefined {
  if (id.endsWith(':hard')) {
    const base = RECIPES.find((r) => r.id === id.slice(0, -5));
    return base && hardRecipe(base);
  }
  return RECIPES.find((r) => r.id === id);
}
