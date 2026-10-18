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
  wind?: { dx: number; dy: number; period: number; on: number; warn: number; force: number };
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
  return { def, width, height, tiles, start, floorMin, doorCount };
}
