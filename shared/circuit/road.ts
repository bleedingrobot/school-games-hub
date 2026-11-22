/**
 * Circuit Racer's road format (docs/CIRCUIT-PLAN.md, section 3): our own text grid.
 *
 * A road is a list of rows, the start first. Each row is 7 letters, one per lane, left to right:
 *
 *   .  gap (nothing)          g  cooling gel (slippery: no steering)
 *   -  plain trace            +  recharge port (full battery and signal)
 *   >  overclock (speed up)   1 2 3  blocks, 0.5 / 0.75 / 1.0 high
 *   r  resistor (slow down)   t  tunnel (a data cable: floor with a roof)
 *   x  short circuit (boom)   ?  data gate (from world 2; plain trace until Stage 3)
 *
 * A row may end with ` xN` to repeat it N times (`"--...-- x6"`), so long straight bits stay short in a PR.
 * Each road also sets its own gravity, battery (seconds at top speed) and signal (seconds).
 */
import { BLOCK_HEIGHTS, LANES, type World } from './config';

export type Cell = '.' | '-' | '>' | 'r' | 'x' | 'g' | '+' | '1' | '2' | '3' | 't' | '?';
const CELLS = '.->rxg+123t?';

export interface RoadDef {
  id: string;
  name: string;
  world: World;
  gravity: number;
  /** Seconds the battery lasts at top speed. */
  battery: number;
  /** Seconds the signal lasts. */
  signal: number;
  rows: readonly string[];
}

export interface Road {
  def: RoadDef;
  /** Rows after repeats are expanded. Crossing the end of the last row finishes the road. */
  length: number;
  /** Every cell, row by row (row * LANES + lane). */
  cells: string;
}

const ROW = /^([.\->rxg+123t?]{7})(?: x([1-9]\d{0,3}))?$/;

/** Reads a road, or throws with the row that is wrong. */
export function parseRoad(def: RoadDef): Road {
  let cells = '';
  def.rows.forEach((text, i) => {
    const m = ROW.exec(text);
    if (!m) throw new Error(`${def.id}: row ${i + 1} "${text}" is not 7 road letters (${CELLS}), with an optional " xN"`);
    cells += m[1].repeat(m[2] ? Number(m[2]) : 1);
  });
  if (cells.length === 0) throw new Error(`${def.id}: no rows`);
  return { def, length: cells.length / LANES, cells };
}

/** The cell in a lane and row. Outside the road (either side, before the start, after the end) is a gap. */
export function cellAt(road: Road, lane: number, row: number): Cell {
  if (lane < 0 || lane >= LANES || row < 0 || row >= road.length) return '.';
  return road.cells[row * LANES + lane] as Cell;
}

/** The height of a block cell's top, or 0 for a floor tile, or null for a gap. */
export function topOf(cell: Cell): number | null {
  if (cell === '.') return null;
  if (cell === '1' || cell === '2' || cell === '3') return BLOCK_HEIGHTS[cell];
  return 0;
}

/** How many of a cell kind a road has (rows where it appears), e.g. recharge ports. */
export function countRuns(road: Road, cell: Cell): number {
  let n = 0;
  let before = false;
  for (let row = 0; row < road.length; row++) {
    const here = road.cells.slice(row * LANES, row * LANES + LANES).includes(cell);
    if (here && !before) n++;
    before = here;
  }
  return n;
}
