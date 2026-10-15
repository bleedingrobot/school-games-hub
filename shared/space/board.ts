/**
 * What a Wormholes & Black Holes board is made of, and the fairness rules every board
 * (designed or randomly made) must pass.
 */

export type StarKind =
  | 'red-dwarf'
  | 'yellow-star'
  | 'blue-giant'
  | 'white-dwarf'
  | 'binary-star'
  | 'neutron-star'
  | 'pulsar'
  | 'supernova'
  | 'matariki';

export const STAR_KINDS: readonly StarKind[] = [
  'red-dwarf', 'yellow-star', 'blue-giant', 'white-dwarf', 'binary-star',
  'neutron-star', 'pulsar', 'supernova', 'matariki',
];

export type GravityKind = 'heavy' | 'low' | 'slingshot';

export type Square =
  | { kind: 'wormhole'; to: number }
  | { kind: 'black-hole'; to: number }
  | { kind: 'star'; star: StarKind }
  | { kind: 'gravity'; gravity: GravityKind }
  | { kind: 'gate'; twin: number }
  | { kind: 'mystery' }
  /** What a supernova leaves behind once it has gone off: does nothing. */
  | { kind: 'nebula' };

/** A comet: land anywhere on its tail and ride to its head. It moves forward every round. */
export interface Comet {
  /** The square at the front. */
  head: number;
  /** Squares it covers, counting the head. */
  length: number;
  /** Squares it moves forward each round. */
  speed: number;
}

export type BoardSize = 100 | 50;

export interface Board {
  id: string;
  name: string;
  size: BoardSize;
  /** Special squares by number. Square 1 and the last square are always plain. */
  squares: Record<number, Square>;
  comet: Comet | null;
  /** The mission clock for 4 rockets: after this many rounds the fuel runs out (fewer rockets get more). */
  missionRounds: number;
  /** Whether cosmic events are on unless the settings say otherwise. */
  cosmicEvents: boolean;
}

/** Board squares go back and forth in rows of 10, starting bottom left (square 1). */
export const ROW_LENGTH = 10;

/** Where a square is drawn: row 0 is the top row, col 0 the left. */
export function squareXY(square: number, size: BoardSize): { row: number; col: number } {
  const fromBottom = Math.floor((square - 1) / ROW_LENGTH);
  const along = (square - 1) % ROW_LENGTH;
  const col = fromBottom % 2 === 0 ? along : ROW_LENGTH - 1 - along;
  return { row: size / ROW_LENGTH - 1 - fromBottom, col };
}

export function isLink(square: Square | undefined): square is { kind: 'wormhole' | 'black-hole'; to: number } {
  return square?.kind === 'wormhole' || square?.kind === 'black-hole';
}

/** The squares the comet's tail covers (not its head). */
export function cometTail(comet: Comet): number[] {
  const tail: number[] = [];
  for (let i = 1; i < comet.length; i++) tail.push(comet.head - i);
  return tail;
}

/** Where the comet's head goes next round: forward, wrapping round to the start. */
export function moveComet(comet: Comet, size: BoardSize): Comet {
  const lowest = comet.length + 1; // the tail never covers square 1
  const highest = size - 1; // the head never sits on the last square
  let head = comet.head + comet.speed;
  if (head > highest) head = lowest + (head - highest - 1);
  return { ...comet, head };
}

export interface FairnessOptions {
  /** Wormholes and black holes must be roughly balanced in total distance (Random Galaxy). */
  balanced?: boolean;
}

/** Wormhole distance up divided by black hole distance down must be in this range. */
export const BALANCE_RANGE: readonly [number, number] = [0.75, 1.35];

/** Every problem with a board, in plain words. An empty list means it's fair. */
export function checkBoard(board: Board, options: FairnessOptions = {}): string[] {
  const problems: string[] = [];
  const { size } = board;
  if (size !== 100 && size !== 50) problems.push(`size ${size} isn't 100 or 50`);
  const entries = Object.entries(board.squares).map(([key, square]) => [Number(key), square] as const);
  const mouths = new Set(entries.filter(([, s]) => isLink(s)).map(([n]) => n));
  let up = 0;
  let down = 0;
  let mysteries = 0;

  for (const [n, square] of entries) {
    if (!Number.isInteger(n) || n < 2 || n > size - 1) {
      problems.push(`square ${n} can't be special (only 2 to ${size - 1})`);
      continue;
    }
    if (square.kind === 'wormhole') {
      if (!(square.to > n && square.to <= size - 1)) problems.push(`wormhole ${n} goes to ${square.to}`);
      if (mouths.has(square.to)) problems.push(`wormhole ${n} lands on another hole at ${square.to}`);
      up += square.to - n;
    } else if (square.kind === 'black-hole') {
      if (n <= 5) problems.push(`black hole on square ${n} (none on 1 to 5)`);
      if (!(square.to >= 2 && square.to < n)) problems.push(`black hole ${n} goes to ${square.to}`);
      if (mouths.has(square.to)) problems.push(`black hole ${n} lands on another hole at ${square.to}`);
      down += n - square.to;
    } else if (square.kind === 'gate') {
      const twin = board.squares[square.twin];
      if (twin?.kind !== 'gate' || twin.twin !== n || square.twin === n) problems.push(`gate ${n} has no twin`);
      if (Math.abs(square.twin - n) > size / 4) problems.push(`gates ${n} and ${square.twin} are too far apart`);
    } else if (square.kind === 'mystery') {
      mysteries++;
    }
  }
  if (mysteries > 1) problems.push(`${mysteries} mystery stations (at most 1)`);

  const special = entries.map(([n]) => n).sort((a, b) => a - b);
  for (let i = 1; i < special.length; i++) {
    if (special[i] - special[i - 1] < 2) problems.push(`squares ${special[i - 1]} and ${special[i]} are side by side`);
  }

  if (board.comet) {
    const { head, length, speed } = board.comet;
    if (!(length >= 3 && length <= 8 && speed >= 1 && speed <= 6)) problems.push('the comet is the wrong size or speed');
    if (!(head - length + 1 >= 2 && head <= size - 1)) problems.push(`the comet at ${head} is off the board`);
  }

  if (!(board.missionRounds >= 10 && board.missionRounds <= 200)) problems.push(`mission clock ${board.missionRounds} rounds`);

  if (options.balanced) {
    const ratio = down === 0 ? Infinity : up / down;
    if (ratio < BALANCE_RANGE[0] || ratio > BALANCE_RANGE[1]) {
      problems.push(`wormholes go up ${up} and black holes down ${down}: not balanced`);
    }
  }
  return problems;
}

/**
 * The average number of rolls one rocket needs to dock, counting only wormholes and black
 * holes (any roll finishes). Worked out exactly, not by playing, so it's quick enough to
 * check every Random Galaxy as it's made.
 */
export function expectedRolls(board: Board): number {
  const { size } = board;
  const follow = (n: number) => {
    const square = board.squares[n];
    return isLink(square) ? square.to : n;
  };
  const expected = new Array<number>(size + 1).fill(0);
  for (let pass = 0; pass < 500; pass++) {
    let change = 0;
    for (let n = size - 1; n >= 1; n--) {
      let total = 0;
      for (let die = 1; die <= 6; die++) total += expected[follow(Math.min(size, n + die))];
      const value = 1 + total / 6;
      change = Math.max(change, Math.abs(value - expected[n]));
      expected[n] = value;
    }
    if (change < 1e-6) break;
  }
  return expected[1];
}
