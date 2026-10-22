/**
 * The land: a grid of 3 px cells that blasts carve and some arrows add to (docs/ARCHERY-PLAN.md, sections 2 and 3).
 *
 * It's made by midpoint displacement from a seed, with no smoothing, so it has Scorched Earth's big
 * jagged cliffs and deep narrow valleys (James, 21 Oct 2026). The two archers stand left and right,
 * and the land is remade from the next seed until there's a real hill (or building) between them that
 * they can't see over, so angle and power both matter.
 *
 * Each world adds its own twist: Forest trees, Desert sand that slides, Snow's slippery slopes and
 * ice blocks, and the City's tough buildings.
 */
import {
  ARCHER_H, ARCHER_W, ARCHER_ZONE_FROM, ARCHER_ZONE_TO, BUILDING_CHIP, BUILDING_GAP_MAX, BUILDING_GAP_MIN,
  BUILDING_H_MAX, BUILDING_H_MIN, BUILDING_NEAR, BUILDING_NEAR_RISE, BUILDING_SKIP, BUILDING_W_MAX, BUILDING_W_MIN, CELL, COLS, FALL_SAFE_CELLS, FIELD_H,
  HANDS_HEIGHT, HILL_MIN_RISE, ICE_BLOCKS_MAX, ICE_BLOCKS_MIN, ICE_CLEARANCE, ICE_H_MAX, ICE_H_MIN, ICE_W_MAX, ICE_W_MIN,
  LAND_END_HIGH, LAND_END_LOW, LAND_MAX_HEIGHT, LAND_MIN_HEIGHT, LAND_STYLE, LAND_TRIES, ROWS, SAND_MAX_MOVES,
  SAND_MAX_STEP, SAND_REACH, SNOW_SLIDE_MAX, START_HEALTH, TREE_BLAST_SCALE, TREE_CLEARANCE, TREE_HALF_MAX,
  TREE_HALF_MIN, TREE_HEIGHT_MAX, TREE_HEIGHT_MIN, TREES_MAX, TREES_MIN, type LandStyle,
} from './config';
import { makeRandom, mixSeed, type Random } from './random';
import { AIR, BUILDING, DIRT, ICE, TREE, type Archer, type Land, type WorldId } from './types';

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
  return solidFrom(land, col, 0);
}

/** The first solid row in a column at or below `row` (ROWS if there's none). */
function solidFrom(land: Land, col: number, row: number): number {
  for (let r = row < 0 ? 0 : row; r < ROWS; r++) if (land.cells[r * COLS + col] !== AIR) return r;
  return ROWS;
}

// ——— Making the land ———

/**
 * Heights of the land's top edge (px above the bottom) at COLS + 1 points, by midpoint displacement:
 * each split moves the middle up or down by up to `scale`, and the scale shrinks by the decay each time.
 * Then, if it went past the top or bottom limit, it's squeezed in (not cut off, so peaks stay sharp),
 * and if its highest peak is too low, it's stretched up so it fills the screen like Scorched Earth's.
 */
export function makeHeights(rng: Random, style: LandStyle = LAND_STYLE.forest): Float64Array {
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
    split(a, m, scale * style.roughnessDecay);
    split(m, b, scale * style.roughnessDecay);
  };
  split(0, n - 1, style.startRoughness * FIELD_H);

  let min = h[0];
  let max = h[0];
  for (let i = 1; i < n; i++) {
    if (h[i] < min) min = h[i];
    if (h[i] > max) max = h[i];
  }
  const floorH = LAND_MIN_HEIGHT * FIELD_H;
  const topH = style.maxHeight * FIELD_H;
  const lowPeak = max < style.minPeak * FIELD_H;
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

/** Makes a flat spot the archer's width at `row`: clears above it, and fills any gap below it with dirt. */
function flatten(land: Land, c0: number, row: number) {
  const w = ARCHER_W / CELL;
  for (let c = c0; c < c0 + w; c++) {
    for (let r = 0; r < ROWS; r++) {
      const i = r * COLS + c;
      if (r < row) land.cells[i] = AIR;
      else if (land.cells[i] === AIR) land.cells[i] = DIRT;
    }
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

/**
 * Makes a round's land in a world from its seed, remaking it from the next seed until it's properly hilly.
 * The checks look at the land itself (with the City's buildings, which are part of it). The Forest's
 * trees and the Snow's ice blocks are added after the checks, so they never stand in for a real hill.
 */
export function makeRoundLand(seed: number, world: WorldId): RoundLand {
  let last: RoundLand | null = null;
  for (let t = 0; t < LAND_TRIES; t++) {
    const rng = makeRandom(mixSeed(seed, t));
    const land = landFromHeights(makeHeights(rng, LAND_STYLE[world]));
    if (world === 'city') addBuildings(land, rng);
    const archers = placeArchers(land, rng);
    if (world === 'city') lowerBuildingsNear(land, archers);
    const passed = !canSee(land, archers[0], archers[1]) && hillRise(land, archers[0], archers[1]) >= HILL_MIN_RISE;
    last = { land, archers, tries: t + 1, passed };
    if (passed) break;
  }
  const done = last!;
  // The extras use their own numbers, so they never change the land or where the archers stand.
  const extras = makeRandom(mixSeed(seed, 500 + done.tries));
  if (world === 'forest') plantTrees(done.land, extras, done.archers);
  else if (world === 'snow') placeIce(done.land, extras, done.archers);
  return done;
}

// ——— The worlds' own land ———

/** Is any column from c0 to c1 within `gap` cells of an archer's box? */
function nearArcher(archers: readonly Archer[], c0: number, c1: number, gap: number): boolean {
  for (const a of archers) {
    const [a0, a1] = archerCols(a.x);
    if (c1 >= a0 - gap && c0 <= a1 + gap) return true;
  }
  return false;
}

/** The highest and lowest ground (surface rows) across columns c0 to c1. */
function groundSpan(land: Land, c0: number, c1: number): [number, number] {
  let hi = ROWS, lo = 0;
  for (let c = c0; c <= c1; c++) {
    const s = surfaceRow(land, c);
    if (s < hi) hi = s;
    if (s > lo) lo = s;
  }
  return [hi, lo];
}

/** Fills the air in column c from row `top` down to the first solid cell with `kind`. */
function fillDown(land: Land, c: number, top: number, kind: number) {
  for (let r = top < 0 ? 0 : top; r < ROWS && land.cells[r * COLS + c] === AIR; r++) land.cells[r * COLS + c] = kind;
}

/**
 * The City's buildings: a street of flat-roofed blocks with gaps between them, standing on the ground.
 * Their roofs are ledges an archer can stand on. Each column of a building reaches down to the ground,
 * so there's never a gap under one.
 */
function addBuildings(land: Land, rng: Random) {
  const topLimit = ROWS - Math.floor(LAND_MAX_HEIGHT * ROWS);
  let c = rng.range(BUILDING_GAP_MIN, BUILDING_GAP_MAX);
  while (c < COLS) {
    const w = rng.range(BUILDING_W_MIN, BUILDING_W_MAX);
    const h = rng.range(BUILDING_H_MIN, BUILDING_H_MAX);
    const skip = rng.fraction() < BUILDING_SKIP;
    const c1 = c + w - 1 < COLS ? c + w - 1 : COLS - 1;
    if (!skip) {
      const [ground] = groundSpan(land, c, c1);
      const roof = ground - h < topLimit ? topLimit : ground - h;
      for (let col = c; col <= c1; col++) fillDown(land, col, roof, BUILDING);
    }
    c = c1 + 1 + rng.range(BUILDING_GAP_MIN, BUILDING_GAP_MAX);
  }
}

/** Cuts the buildings beside each archer down to a low wall (BUILDING_NEAR, BUILDING_NEAR_RISE). */
function lowerBuildingsNear(land: Land, archers: readonly Archer[]) {
  for (const a of archers) {
    const [a0, a1] = archerCols(a.x);
    const lowest = Math.floor(a.y / CELL) - BUILDING_NEAR_RISE;
    for (let c = a0 - BUILDING_NEAR < 0 ? 0 : a0 - BUILDING_NEAR; c <= a1 + BUILDING_NEAR && c < COLS; c++) {
      for (let r = 0; r < lowest; r++) if (land.cells[r * COLS + c] === BUILDING) land.cells[r * COLS + c] = AIR;
    }
  }
}

/**
 * The Forest's trees: pine shapes standing on fairly level ground, kept away from the archers. Each
 * column of a tree reaches down to the ground, so a tree has no gaps under it.
 */
function plantTrees(land: Land, rng: Random, archers: readonly Archer[]) {
  const want = rng.range(TREES_MIN, TREES_MAX);
  let planted = 0;
  for (let tries = 0; tries < want * 6 && planted < want; tries++) {
    const half = rng.range(TREE_HALF_MIN, TREE_HALF_MAX);
    const height = rng.range(TREE_HEIGHT_MIN, TREE_HEIGHT_MAX);
    const c = rng.range(half, COLS - 1 - half);
    if (nearArcher(archers, c - half, c + half, TREE_CLEARANCE)) continue;
    const [hi, lo] = groundSpan(land, c - half, c + half);
    if (hi >= ROWS || lo - hi > half + 1) continue; // too steep for a tree
    const base = surfaceRow(land, c);
    for (let dx = -half; dx <= half; dx++) {
      const reach = half + 1 - (dx < 0 ? -dx : dx);
      fillDown(land, c + dx, base - Math.floor((height * reach) / (half + 1)), TREE);
    }
    planted++;
  }
}

/** The Snow's ice blocks: sitting on the ground, kept away from the archers. */
function placeIce(land: Land, rng: Random, archers: readonly Archer[]) {
  const want = rng.range(ICE_BLOCKS_MIN, ICE_BLOCKS_MAX);
  let placed = 0;
  for (let tries = 0; tries < want * 6 && placed < want; tries++) {
    const w = rng.range(ICE_W_MIN, ICE_W_MAX);
    const h = rng.range(ICE_H_MIN, ICE_H_MAX);
    const c0 = rng.range(0, COLS - w);
    const c1 = c0 + w - 1;
    if (nearArcher(archers, c0, c1, ICE_CLEARANCE)) continue;
    const [hi, lo] = groundSpan(land, c0, c1);
    if (hi >= ROWS || lo - hi > 4) continue; // too uneven to sit on
    for (let c = c0; c <= c1; c++) fillDown(land, c, hi - h, ICE);
    placed++;
  }
}

// ——— Blasts, dirt and falling ———

/** The columns a circle covers, kept inside the field. */
function circleCols(x: number, r: number): [number, number] {
  const c0 = Math.floor((x - r) / CELL);
  const c1 = Math.floor((x + r) / CELL);
  return [c0 < 0 ? 0 : c0, c1 >= COLS ? COLS - 1 : c1];
}

/** The rows a circle covers, kept inside the field. */
function circleRows(y: number, r: number): [number, number] {
  const r0 = Math.floor((y - r) / CELL);
  const r1 = Math.floor((y + r) / CELL);
  return [r0 < 0 ? 0 : r0, r1 >= ROWS ? ROWS - 1 : r1];
}

/**
 * A blast at (x, y) of radius r: clears dirt and ice whose middle is within r px. Trees are easy to blast
 * away (TREE_BLAST_SCALE × r) and buildings are tough, so only a chip comes off (BUILDING_CHIP × r).
 * Returns the columns it reached.
 */
export function carve(land: Land, x: number, y: number, r: number): [number, number] {
  const reach = r * TREE_BLAST_SCALE;
  const [c0, c1] = circleCols(x, reach);
  const [r0, r1] = circleRows(y, reach);
  const rr = r * r;
  const rt = reach * reach;
  const rb = r * BUILDING_CHIP * (r * BUILDING_CHIP);
  for (let row = r0; row <= r1; row++) {
    const cy = row * CELL + CELL / 2 - y;
    for (let col = c0; col <= c1; col++) {
      const i = row * COLS + col;
      const v = land.cells[i];
      if (v === AIR) continue;
      const cx = col * CELL + CELL / 2 - x;
      const d = cx * cx + cy * cy;
      if (d <= (v === TREE ? rt : v === BUILDING ? rb : rr)) land.cells[i] = AIR;
    }
  }
  return [c0, c1];
}

/** Adds a ball of dirt of radius r at (x, y) (only into air). Returns the columns it touched. */
export function addDirt(land: Land, x: number, y: number, r: number): [number, number] {
  const [c0, c1] = circleCols(x, r);
  const [r0, r1] = circleRows(y, r);
  const rr = r * r;
  for (let row = r0; row <= r1; row++) {
    const cy = row * CELL + CELL / 2 - y;
    for (let col = c0; col <= c1; col++) {
      const cx = col * CELL + CELL / 2 - x;
      const i = row * COLS + col;
      if (cx * cx + cy * cy <= rr && land.cells[i] === AIR) land.cells[i] = DIRT;
    }
  }
  return [c0, c1];
}

/** Does this kind of cell fall when there's nothing under it? Dirt and trees do; ice and buildings stay put. */
export function falls(kind: number): boolean {
  return kind === DIRT || kind === TREE;
}

/**
 * Loose dirt falls: in each column from c0 to c1, any dirt (or tree) with a gap under it drops until it
 * lands. Ice and buildings stay put and hold up what's on them. Returns true if anything moved.
 */
export function settle(land: Land, c0: number, c1: number): boolean {
  let moved = false;
  for (let c = c0 < 0 ? 0 : c0; c <= c1 && c < COLS; c++) {
    let w = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      const i = r * COLS + c;
      const v = land.cells[i];
      if (v === AIR) continue;
      if (!falls(v)) {
        w = r - 1;
        continue;
      }
      if (r !== w) {
        land.cells[w * COLS + c] = v;
        land.cells[i] = AIR;
        moved = true;
      }
      w--;
    }
  }
  return moved;
}

/** Is the cell (col, row) inside the box of an archer who's still in the round? */
function inArcherCell(archers: readonly Archer[], col: number, row: number): boolean {
  for (const a of archers) {
    if (a.popped) continue;
    const [a0, a1] = archerCols(a.x);
    if (col < a0 || col > a1) continue;
    const feet = Math.floor(a.y / CELL);
    if (row >= feet - ARCHER_H / CELL && row < feet) return true;
  }
  return false;
}

/**
 * The Desert's sand slides: within SAND_REACH columns of what a blast touched, a column of sand that
 * stands more than SAND_MAX_STEP cells above a neighbour drops its top cell onto that neighbour, until
 * nothing more can slide (at most SAND_MAX_MOVES cells). Only sand (dirt) slides, never into an archer.
 * The Earth Shaker uses the same crumbling with its own reach, step and limit, in every world.
 * Returns how many cells moved.
 */
export function slideSand(
  land: Land, c0: number, c1: number, archers: readonly Archer[], reach = SAND_REACH, maxStep = SAND_MAX_STEP, maxMoves = SAND_MAX_MOVES,
): number {
  const lo = c0 - reach < 0 ? 0 : c0 - reach;
  const hi = c1 + reach >= COLS ? COLS - 1 : c1 + reach;
  const top = new Int32Array(hi - lo + 1);
  for (let c = lo; c <= hi; c++) top[c - lo] = surfaceRow(land, c);
  let moves = 0;
  let moved = true;
  while (moved && moves < maxMoves) {
    moved = false;
    for (let c = lo; c <= hi && moves < maxMoves; c++) {
      const t = top[c - lo];
      if (t >= ROWS || land.cells[t * COLS + c] !== DIRT) continue;
      // Slide to the lower neighbour (the left one if they're level).
      let to = -1;
      let toTop = t + maxStep;
      if (c > lo && top[c - 1 - lo] > toTop) {
        to = c - 1;
        toTop = top[c - 1 - lo];
      }
      if (c < hi && top[c + 1 - lo] > toTop) {
        to = c + 1;
        toTop = top[c + 1 - lo];
      }
      if (to < 0 || inArcherCell(archers, to, toTop - 1)) continue;
      land.cells[t * COLS + c] = AIR;
      land.cells[(toTop - 1) * COLS + to] = DIRT;
      top[c - lo] = solidFrom(land, c, t + 1);
      top[to - lo] = toTop - 1;
      moved = true;
      moves++;
    }
  }
  return moves;
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

/** Is the archer's box at (x, y) inside the field and clear of land? */
function boxClear(land: Land, x: number, y: number): boolean {
  const [c0, c1] = archerCols(x);
  if (c0 < 0 || c1 >= COLS) return false;
  const feet = Math.floor(y / CELL);
  for (let r = feet - ARCHER_H / CELL; r < feet; r++) {
    for (let c = c0; c <= c1; c++) if (cellAt(land, c, r) !== AIR) return false;
  }
  return true;
}

/** How many cells an archer at (x, y) would fall before landing. */
function dropDepth(land: Land, x: number, y: number): number {
  const probe: Archer = { x, y, health: 0, shield: 0, popped: false };
  return dropArcher(land, probe);
}

/**
 * Snow is slippery: an archer standing on a slope slides downhill, one cell at a time, falling as they
 * go, until they're on level ground, in a dip, against a wall or another archer, or SNOW_SLIDE_MAX
 * cells on. A step "downhill" is one that drops them at least a cell; if both ways do, the deeper one
 * wins (the left on a tie). Returns how far they slid and each drop on the way (for fall damage).
 */
export function slideArcher(land: Land, archers: readonly Archer[], i: number): { slid: number; drops: number[] } {
  const a = archers[i];
  const drops: number[] = [];
  let slid = 0;
  for (; slid < SNOW_SLIDE_MAX; slid++) {
    let dir = 0;
    let deepest = 0;
    for (const d of [-1, 1]) {
      const nx = a.x + d * CELL;
      if (!boxClear(land, nx, a.y)) continue;
      let blocked = false;
      for (let j = 0; j < archers.length; j++) {
        const b = archers[j];
        if (j !== i && !b.popped && Math.abs(b.x - nx) < ARCHER_W && Math.abs(b.y - a.y) < ARCHER_H) blocked = true;
      }
      if (blocked) continue;
      const depth = dropDepth(land, nx, a.y);
      if (depth > deepest) {
        deepest = depth;
        dir = d;
      }
    }
    if (dir === 0) break;
    a.x += dir * CELL;
    drops.push(dropArcher(land, a));
  }
  return { slid, drops };
}

/** True if a point (in px) is inside an archer's box. */
export function inArcherBox(a: Archer, x: number, y: number): boolean {
  return x >= a.x - ARCHER_W / 2 && x < a.x + ARCHER_W / 2 && y >= a.y - ARCHER_H && y < a.y;
}

/** How many cells of fall count for damage. */
export function fallCells(fell: number): number {
  return fell > FALL_SAFE_CELLS ? fell : 0;
}
