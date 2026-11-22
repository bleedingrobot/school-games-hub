/**
 * Circuit Racer's road format (docs/CIRCUIT-PLAN.md, section 3): our own text grid.
 *
 * A road is a list of rows, the start first. Each row is 7 letters, one per lane, left to right:
 *
 *   .  gap (nothing)          g  cooling gel (slippery: no steering)
 *   -  plain trace            +  recharge port (full battery and signal)
 *   >  overclock (speed up)   1 2 3  blocks, 0.5 / 0.75 / 1.0 high
 *   r  resistor (slow down)   t  tunnel (a data cable: floor with a roof)
 *   x  short circuit (boom)   ?  data gate lane (from world 2)
 *
 * A row may end with ` xN` to repeat it N times (`"--...-- x6"`), so long straight bits stay short in a PR.
 * Each road also sets its own gravity, battery (seconds at top speed) and signal (seconds).
 *
 * Maths spots (Stage 3): a run of rows with `+` is one recharge port; a run of rows with `?` is one data gate, and the
 * lanes with `?` in its first row (the split row) are its signed lanes, left to right (2 to 4). Every port and gate asks
 * one question, so they are at least QUESTION_GAP rows apart, and no short-circuit tile sits near a gate.
 *
 * Checkpoints (Stage 4): a row ending with ` @` puts a checkpoint on its first row. Roads over a minute have them: crash or
 * fall after one and the racer restarts there (physics.ts), on the plain trace nearest the middle.
 */
import { BLOCK_HEIGHTS, GATE_CLEAR_ROWS, GATE_LANES, LANES, QUESTION_GAP, type World } from './config';

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

/** A recharge port or data gate: its first and last rows. */
export interface Spot {
  first: number;
  last: number;
}

/** A data gate: its rows and its signed lanes (the lanes with `?` in its split row, left to right). */
export interface GateSpot extends Spot {
  lanes: number[];
}

export interface Road {
  def: RoadDef;
  /** Rows after repeats are expanded. Crossing the end of the last row finishes the road. */
  length: number;
  /** Every cell, row by row (row * LANES + lane). */
  cells: string;
  /** Recharge ports and data gates, in road order. */
  ports: Spot[];
  gates: GateSpot[];
  /** For each row: the port or gate it belongs to, or -1. */
  portAt: number[];
  gateAt: number[];
  /** Checkpoint rows, in road order (rows marked ` @`). */
  checkpoints: number[];
}

const ROW = /^([.\->rxg+123t?]{7})(?: x([1-9]\d{0,3}))?( @)?$/;

/** Reads a road, or throws with the row that is wrong. */
export function parseRoad(def: RoadDef): Road {
  let cells = '';
  const checkpoints: number[] = [];
  def.rows.forEach((text, i) => {
    const m = ROW.exec(text);
    if (!m) throw new Error(`${def.id}: row ${i + 1} "${text}" is not 7 road letters (${CELLS}), with an optional " xN" and " @"`);
    if (m[3]) {
      if (!m[1].includes('-')) throw new Error(`${def.id}: the checkpoint on row ${i + 1} needs a plain trace to restart on`);
      checkpoints.push(cells.length / LANES);
    }
    cells += m[1].repeat(m[2] ? Number(m[2]) : 1);
  });
  if (cells.length === 0) throw new Error(`${def.id}: no rows`);
  const length = cells.length / LANES;
  const rowHas = (row: number, cell: Cell) => cells.slice(row * LANES, row * LANES + LANES).includes(cell);
  const spots = (cell: Cell): { list: Spot[]; at: number[] } => {
    const list: Spot[] = [];
    const at: number[] = [];
    for (let row = 0; row < length; row++) {
      if (!rowHas(row, cell)) at.push(-1);
      else {
        if (row === 0 || !rowHas(row - 1, cell)) list.push({ first: row, last: row });
        list[list.length - 1].last = row;
        at.push(list.length - 1);
      }
    }
    return { list, at };
  };
  const p = spots('+');
  const g = spots('?');
  const gates: GateSpot[] = g.list.map((spot) => ({ ...spot, lanes: [...Array(LANES).keys()].filter((lane) => cells[spot.first * LANES + lane] === '?') }));
  const road: Road = { def, length, cells, ports: p.list, gates, portAt: p.at, gateAt: g.at, checkpoints };
  checkMathsSpots(road);
  return road;
}

/** Throws if the ports and gates break the rules: one question at a time, 2 to 4 signed lanes, no short circuits near a gate. */
function checkMathsSpots(road: Road): void {
  const id = road.def.id;
  const all = [...road.ports, ...road.gates].sort((a, b) => a.first - b.first);
  for (let i = 1; i < all.length; i++) {
    if (all[i].first - all[i - 1].last - 1 < QUESTION_GAP) throw new Error(`${id}: rows ${all[i - 1].last + 1} and ${all[i].first + 1} are two questions less than ${QUESTION_GAP} rows apart`);
  }
  for (const gate of road.gates) {
    if (gate.lanes.length < GATE_LANES.min || gate.lanes.length > GATE_LANES.max) throw new Error(`${id}: the gate at row ${gate.first + 1} needs ${GATE_LANES.min} to ${GATE_LANES.max} lanes`);
    for (let row = Math.max(0, gate.first - GATE_CLEAR_ROWS); row <= gate.last; row++) {
      if (road.cells.slice(row * LANES, row * LANES + LANES).includes('x')) throw new Error(`${id}: a short circuit at row ${row + 1} is too near the gate at row ${gate.first + 1}`);
    }
  }
}

/** Where a racer restarts at a checkpoint row: the plain-trace lane nearest the middle (left first). */
export function restartLane(road: Road, row: number): number {
  for (const d of [0, -1, 1, -2, 2, -3, 3]) if (cellAt(road, 3 + d, row) === '-') return 3 + d;
  return 3;
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
