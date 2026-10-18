/**
 * A course is data: one letter per tile for what it is, and one digit per tile for how high it is.
 * `compileCourse` checks it and makes the lookup the engine uses.
 *
 * Tile letters
 *   .  nothing (a gap, or off the edge): the marble falls
 *   #  flat floor          i  ice (slippery)        m  mud (sticky)
 *   >  <  ^  v  a slope going DOWN towards east, west, north (up the grid) or south.
 *               Its digit is its HIGH edge; the low edge is one level lower.
 *   =  a wall or rail the marble bounces off
 *   b  a bumper (flat floor with a post in the middle)
 *   j  a jump pad          c  a checkpoint        s  the start (exactly one)
 *   f  the finish (one or more)
 *   e w n o  a conveyor belt pushing east, west, north (up the grid) or south
 *   g  a geyser: steams, then throws the marble into the air, on a timer
 *   t  a trapdoor: solid, then drops away, on a timer
 *   q  a gate (a sweeping arm): open, then shut like a wall, on a timer. Gates and trapdoors in the same column share a timer.
 *   A–H  a shortcut door. Shut it is a wall; open it is flat floor. Which are open is decided
 *        before the run starts and never changes during it (this is how maths gates will work).
 */
import { LEVEL, type Surface } from './config';

export interface CourseDef {
  id: string;
  name: string;
  /** Tile letters, one string per row (north to south). */
  rows: readonly string[];
  /** Heights in levels, 0–9 then a–z, same shape as `rows`. */
  heights: readonly string[];
  /** Waypoints (tile coordinates, e.g. [3.5, 2.5] is the middle of tile 3,2) a bot follows to finish the course. Used for reference runs. */
  route: ReadonlyArray<readonly [number, number]>;
  /** Medal times in seconds (count-up mode). */
  medals: { gold: number; silver: number; bronze: number };
  /** Hard mode: seconds on the clock at the start. */
  hardSeconds: number;
  /** Gusts of wind that push the marble: every `period` steps, for `on` steps (after `warn` steps of warning streaks). */
  /** Answer gates, in the order the course meets them (maths questions; docs/MARBLE-PLAN.md section 7). */
  gates?: readonly GateDef[];
  wind?: { dx: number; dy: number; period: number; on: number; warn: number; force: number };
}

/**
 * An answer gate: a sign, then the track splits into tunnels (each a lane ending in a shortcut door). The door of the
 * right tunnel is open for the whole run; the others are shut, so a wrong tunnel is a dead end to back out of.
 * Which tunnel the marble goes into first is the student's answer (the engine writes it down; the server reads it from the replay).
 */
export interface GateDef {
  /** The tile the sign stands over (the question shows when the marble comes near). */
  sign: readonly [number, number];
  /** How many waypoints of `route` come before this gate (the reference bot's way through a tunnel is put in at that point). */
  after: number;
  tunnels: ReadonlyArray<{
    /** Every floor tile of the lane. The first one the marble touches is its choice. */
    cells: ReadonlyArray<readonly [number, number]>;
    /** The tile letter of this tunnel's shortcut door, as a number (0 = A). */
    door: number;
    /** Waypoints through this tunnel, door open. */
    route: ReadonlyArray<readonly [number, number]>;
    /** Waypoints into this tunnel when its door is shut and back out of it (for the bot that guesses wrong first). */
    dead: ReadonlyArray<readonly [number, number]>;
  }>;
}

export type Slope = 'E' | 'W' | 'N' | 'S';

export interface Tile {
  /** The letter. */
  ch: string;
  level: number;
  surface: Surface;
  slope: Slope | null;
  /** 0–7 for A–H, else -1. */
  door: number;
}

export interface Course {
  def: CourseDef;
  width: number;
  height: number;
  tiles: Tile[];
  start: { x: number; y: number };
  /** Lowest floor, in tiles (for working out when a falling marble is gone). */
  floorMin: number;
  doorCount: number;
  gates: readonly GateDef[];
  /** Per tile: gate * 8 + tunnel + 1 for a tunnel tile, else 0. */
  tunnelAt: Uint16Array;
  /** Per checkpoint tile: which pit stop (a block of touching checkpoint tiles is one), else -1. */
  pitAt: Int16Array;
  pitCount: number;
}

const SLOPES: Record<string, Slope> = { '>': 'E', '<': 'W', '^': 'N', v: 'S' };
const KNOWN = new Set('.#im><^v=bjcsfABCDEFGHewnogtq'.split(''));

export function compileCourse(def: CourseDef): Course {
  const height = def.rows.length;
  const width = def.rows[0]?.length ?? 0;
  if (!height || !width) throw new Error(`${def.id}: empty course`);
  if (def.heights.length !== height) throw new Error(`${def.id}: heights need ${height} rows`);
  const tiles: Tile[] = [];
  let start: Course['start'] | null = null;
  let floorMin = Infinity;
  let doorCount = 0;
  let finishes = 0;
  for (let y = 0; y < height; y++) {
    if (def.rows[y].length !== width || def.heights[y].length !== width) throw new Error(`${def.id}: row ${y} is not ${width} wide`);
    for (let x = 0; x < width; x++) {
      const ch = def.rows[y][x];
      if (!KNOWN.has(ch)) throw new Error(`${def.id}: unknown tile "${ch}" at ${x},${y}`);
      const lv = parseInt(def.heights[y][x], 36);
      if (Number.isNaN(lv)) throw new Error(`${def.id}: bad height at ${x},${y}`);
      const door = ch >= 'A' && ch <= 'H' ? ch.charCodeAt(0) - 65 : -1;
      if (door >= 0) doorCount = Math.max(doorCount, door + 1);
      if (ch === 's') {
        if (start) throw new Error(`${def.id}: more than one start`);
        start = { x: x + 0.5, y: y + 0.5 };
      }
      if (ch === 'f') finishes++;
      const surface: Surface = ch === 'i' ? 'ice' : ch === 'm' ? 'mud' : 'normal';
      const slope = SLOPES[ch] ?? null;
      if (ch !== '.' && ch !== '=') floorMin = Math.min(floorMin, (slope ? lv - 1 : lv) * LEVEL);
      tiles.push({ ch, level: lv, surface, slope, door });
    }
  }
  if (!start) throw new Error(`${def.id}: no start`);
  if (!finishes) throw new Error(`${def.id}: no finish`);
  const gates = def.gates ?? [];
  const tunnelAt = new Uint16Array(width * height);
  const doorsUsed = new Set<number>();
  gates.forEach((g, gi) => {
    if (g.tunnels.length < 2 || g.tunnels.length > 3) throw new Error(`${def.id}: gate ${gi} needs 2 or 3 tunnels`);
    g.tunnels.forEach((t, ti) => {
      if (t.door < 0 || t.door >= doorCount || doorsUsed.has(t.door)) throw new Error(`${def.id}: gate ${gi} tunnel ${ti} has a bad or shared door`);
      doorsUsed.add(t.door);
      for (const [x, y] of t.cells) {
        if (x < 0 || y < 0 || x >= width || y >= height) throw new Error(`${def.id}: gate ${gi} tunnel ${ti} is off the course`);
        tunnelAt[y * width + x] = gi * 8 + ti + 1;
      }
    });
  });
  // Touching checkpoint tiles make one pit stop.
  const pitAt = new Int16Array(width * height).fill(-1);
  let pitCount = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i].ch !== 'c' || pitAt[i] >= 0) continue;
    const todo = [i];
    pitAt[i] = pitCount;
    while (todo.length) {
      const at = todo.pop() as number;
      const x = at % width;
      const y = Math.floor(at / width);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (tiles[ni].ch === 'c' && pitAt[ni] < 0) {
          pitAt[ni] = pitCount;
          todo.push(ni);
        }
      }
    }
    pitCount++;
  }
  return { def, width, height, tiles, start, floorMin, doorCount, gates, tunnelAt, pitAt, pitCount };
}
