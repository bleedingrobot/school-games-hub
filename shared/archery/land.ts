/**
 * The land: a grid of 3 px cells that blasts carve and some arrows add to (docs/ARCHERY-PLAN.md, section 2).
 *
 * It's made by midpoint displacement from a seed, with no smoothing, so it has Scorched Earth's big
 * jagged cliffs and deep narrow valleys (James, 21 Oct 2026). The two archers stand left and right,
 * and the land is remade from the next seed until there's a real hill between them that they can't
 * see over, so angle and power both matter.
 */
import {
  ARCHER_H, ARCHER_W, ARCHER_ZONE_FROM, ARCHER_ZONE_TO, CELL, COLS, FALL_SAFE_CELLS, FIELD_H, HANDS_HEIGHT,
  HILL_MIN_RISE, LAND_END_HIGH, LAND_END_LOW, LAND_MAX_HEIGHT, LAND_MIN_HEIGHT, LAND_MIN_PEAK, LAND_ROUGHNESS_DECAY,
  LAND_START_ROUGHNESS, LAND_TRIES, ROWS, START_HEALTH,
} from './config';
import { makeRandom, mixSeed, type Random } from './random';
import { AIR, DIRT, type Archer, type Land } from './types';

export function emptyLand(): Land {
  return { cells: new Uint8Array(COLS * ROWS) };
}

export function copyLand(land: Land): Land {
  return { cells: land.cells.slice() };
}

/** The cell at (col, row). Off the sides and above the top is air; below the bottom is solid floor. */
export function cellAt(land: Land, col: number, row: number): number {
  if (row >= ROWS) return DIRT;
  if (row < 0 || col < 0 || col >= COLS) return AIR;
  return land.cells[row * COLS + col];
}

/** Is there land at this point of the field (in pixels)? */
export function solidAt(land: Land, x: number, y: number): boolean {
  return cellAt(land, Math.floor(x / CELL), Math.floor(y / CELL)) !== AIR;
}

/** The first solid row from the top in a column (ROWS if the column is empty). */
export function surfaceRow(land: Land, col: number): number {
  for (let r = 0; r < ROWS; r++) if (land.cells[r * COLS + col] !== AIR) return r;
  return ROWS;
}

// ——— Making the land ———

/**
 * Heights of the land's top edge (px above the bottom) at COLS + 1 points, by midpoint displacement:
 * each split moves the middle up or down by up to `scale`, and the scale shrinks by the decay each time.
 * Then, if it went past the top or bottom limit, it's squeezed in (not cut off, so peaks stay sharp),
 * and if its highest peak is too low, it's stretched up so it fills the screen like Scorched Earth's.
 */
export function makeHeights(rng: Random): Float64Array {
  const n = COLS + 1;
  const h = new Float64Array(n);
  const lo = LAND_END_LOW * FIELD_H;
  const hi = LAND_END_HIGH * FIELD_H;
  h[0] = lo + rng.fraction() * (hi - lo);
  h[n - 1] = lo + rng.fraction() * (hi - lo);
  const split = (a: number, b: number, scale: number) => {
    if (b - a < 2) return;
    const m = (a + b) >> 1;
    h[m] = (h[a] + h[b]) / 2 + (rng.fraction() * 2 - 1) * scale;
    split(a, m, scale * LAND_ROUGHNESS_DECAY);
    split(m, b, scale * LAND_ROUGHNESS_DECAY);
  };
  split(0, n - 1, LAND_START_ROUGHNESS * FIELD_H);

  let min = h[0];
  let max = h[0];
  for (let i = 1; i < n; i++) {
    if (h[i] < min) min = h[i];
    if (h[i] > max) max = h[i];
  }
  const floorH = LAND_MIN_HEIGHT * FIELD_H;
  const topH = LAND_MAX_HEIGHT * FIELD_H;
  const lowPeak = max < LAND_MIN_PEAK * FIELD_H;
  if (min < floorH || max > topH || lowPeak) {
    // Too tall is squeezed down; too tame is stretched up so its peak reaches the top limit.
    const newMin = min < floorH ? floorH : min;
    const newMax = max > topH || lowPeak ? topH : max;
    const k = max > min ? (newMax - newMin) / (max - min) : 0;
    for (let i = 0; i < n; i++) h[i] = newMin + (h[i] - min) * k;
  }
  return h;
}

/** Fills each column from its height down to the bottom. */
export function landFromHeights(h: Float64Array): Land {
  const land = emptyLand();
  for (let c = 0; c < COLS; c++) {
    const height = (h[c] + h[c + 1]) / 2;
    const top = ROWS - Math.floor(height / CELL);
    for (let r = top < 0 ? 0 : top; r < ROWS; r++) land.cells[r * COLS + c] = DIRT;
  }
  return land;
}

/** The first column an archer standing at x covers, and the last. */
export function archerCols(x: number): [number, number] {
  return [Math.floor((x - ARCHER_W / 2) / CELL), Math.floor((x + ARCHER_W / 2) / CELL) - 1];
}

/** An archer standing on the land with their box starting at column c0. */
function archerAt(c0: number, row: number): Archer {
  return { x: c0 * CELL + ARCHER_W / 2, y: row * CELL, health: START_HEALTH, shield: 0, popped: false };
}

/** Makes a flat spot the archer's width at `row` (clears above it, fills below it). */
function flatten(land: Land, c0: number, row: number) {
  const w = ARCHER_W / CELL;
  for (let c = c0; c < c0 + w; c++) {
    for (let r = 0; r < ROWS; r++) land.cells[r * COLS + c] = r < row ? AIR : DIRT;
  }
}

/**
 * Picks a spot in one side's zone. Half the time the archer stays where they landed (a ledge or a
 * slope, flattened); the other half they walk downhill to the bottom of a dip, inside the zone.
 */
function pickSpot(land: Land, rng: Random, from: number, to: number): number {
  let c = rng.range(from, to);
  if (rng.int(2) === 0) {
    for (let guard = 0; guard < COLS; guard++) {
      const here = surfaceRow(land, c + 1);
      const left = c > from ? surfaceRow(land, c) : -1;
      const right = c < to ? surfaceRow(land, c + 2) : -1;
      if (left > here && left >= right) c--;
      else if (right > here) c++;
      else break;
    }
  }
  return c;
}

/** Puts the two archers on the land (left, then right) and flattens their spots. */
export function placeArchers(land: Land, rng: Random): [Archer, Archer] {
  const w = ARCHER_W / CELL;
  const from = Math.floor(COLS * ARCHER_ZONE_FROM);
  const to = Math.floor(COLS * ARCHER_ZONE_TO) - w;
  const left = pickSpot(land, rng, from, to);
  const right = pickSpot(land, rng, COLS - w - to, COLS - w - from);
  const mid = (c: number) => surfaceRow(land, c + (w >> 1));
  const lRow = mid(left);
  const rRow = mid(right);
  flatten(land, left, lRow);
  flatten(land, right, rRow);
  return [archerAt(left, lRow), archerAt(right, rRow)];
}

/** Can the two archers see each other (hands to hands) in a straight line with no land in the way? */
export function canSee(land: Land, a: Archer, b: Archer): boolean {
  const ax = a.x, ay = a.y - HANDS_HEIGHT, bx = b.x, by = b.y - HANDS_HEIGHT;
  const dx = bx - ax, dy = by - ay;
  const n = Math.ceil(Math.sqrt(dx * dx + dy * dy));
  for (let i = 1; i < n; i++) {
    if (solidAt(land, ax + (dx * i) / n, ay + (dy * i) / n)) return false;
  }
  return true;
}

/** How many px the highest land between the archers rises above the higher archer's feet. */
export function hillRise(land: Land, a: Archer, b: Archer): number {
  const [l, r] = a.x < b.x ? [a, b] : [b, a];
  const from = archerCols(l.x)[1] + 1;
  const to = archerCols(r.x)[0] - 1;
  let top = ROWS;
  for (let c = from; c <= to; c++) {
    const s = surfaceRow(land, c);
    if (s < top) top = s;
  }
  return Math.min(l.y, r.y) - top * CELL;
}

/** The land made for a round, with the archers placed. `passed` is false if every try failed the checks. */
export interface RoundLand {
  land: Land;
  archers: [Archer, Archer];
  tries: number;
  passed: boolean;
}

/** Makes a round's land from its seed, remaking it from the next seed until it's properly hilly. */
export function makeRoundLand(seed: number): RoundLand {
  let last: RoundLand | null = null;
  for (let t = 0; t < LAND_TRIES; t++) {
    const rng = makeRandom(mixSeed(seed, t));
    const land = landFromHeights(makeHeights(rng));
    const archers = placeArchers(land, rng);
    const passed = !canSee(land, archers[0], archers[1]) && hillRise(land, archers[0], archers[1]) >= HILL_MIN_RISE;
    last = { land, archers, tries: t + 1, passed };
    if (passed) return last;
  }
  return last!;
}

// ——— Blasts, dirt and falling ———

/** The columns a circle covers, kept inside the field. */
function circleCols(x: number, r: number): [number, number] {
  const c0 = Math.floor((x - r) / CELL);
  const c1 = Math.floor((x + r) / CELL);
  return [c0 < 0 ? 0 : c0, c1 >= COLS ? COLS - 1 : c1];
}

function paintCircle(land: Land, x: number, y: number, r: number, value: number): [number, number] {
  const [c0, c1] = circleCols(x, r);
  let r0 = Math.floor((y - r) / CELL);
  let r1 = Math.floor((y + r) / CELL);
  if (r0 < 0) r0 = 0;
  if (r1 >= ROWS) r1 = ROWS - 1;
  const rr = r * r;
  for (let row = r0; row <= r1; row++) {
    const cy = row * CELL + CELL / 2 - y;
    for (let col = c0; col <= c1; col++) {
      const cx = col * CELL + CELL / 2 - x;
      if (cx * cx + cy * cy <= rr) land.cells[row * COLS + col] = value;
    }
  }
  return [c0, c1];
}

/** A blast: clears every cell whose middle is within r px of (x, y). Returns the columns it touched. */
export function carve(land: Land, x: number, y: number, r: number): [number, number] {
  return paintCircle(land, x, y, r, AIR);
}

/** Adds a ball of dirt of radius r at (x, y). Returns the columns it touched. */
export function addDirt(land: Land, x: number, y: number, r: number): [number, number] {
  return paintCircle(land, x, y, r, DIRT);
}

/**
 * Loose dirt falls: in each column from c0 to c1, any dirt with a gap under it drops until it lands.
 * Only dirt falls (Stage 2's buildings and ice will stay put and hold dirt up). Returns true if anything moved.
 */
export function settle(land: Land, c0: number, c1: number): boolean {
  let moved = false;
  for (let c = c0 < 0 ? 0 : c0; c <= c1 && c < COLS; c++) {
    let w = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      const i = r * COLS + c;
      const v = land.cells[i];
      if (v === AIR) continue;
      if (v !== DIRT) {
        w = r - 1;
        continue;
      }
      if (r !== w) {
        land.cells[w * COLS + c] = DIRT;
        land.cells[i] = AIR;
        moved = true;
      }
      w--;
    }
  }
  return moved;
}

/** Is there land (or the bottom of the field) right under the archer's feet? */
export function standing(land: Land, a: Archer): boolean {
  const row = Math.floor(a.y / CELL);
  const [c0, c1] = archerCols(a.x);
  for (let c = c0; c <= c1; c++) if (cellAt(land, c, row) !== AIR) return true;
  return false;
}

/**
 * Drops an archer with nothing under them until they land, and returns how many cells they fell.
 * Their feet stay on the cell grid. The caller turns the fall into damage (`fallDamage`).
 */
export function dropArcher(land: Land, a: Archer): number {
  let fell = 0;
  while (!standing(land, a)) {
    a.y += CELL;
    fell++;
  }
  return fell;
}

/** True if a point (in px) is inside an archer's box. */
export function inArcherBox(a: Archer, x: number, y: number): boolean {
  return x >= a.x - ARCHER_W / 2 && x < a.x + ARCHER_W / 2 && y >= a.y - ARCHER_H && y < a.y;
}

/** How many cells of fall count for damage. */
export function fallCells(fell: number): number {
  return fell > FALL_SAFE_CELLS ? fell : 0;
}
