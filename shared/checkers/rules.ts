/**
 * Checkers rules (English draughts, also called American checkers), shared by the website
 * and the server. We wrote these ourselves because there's no well-tested library for
 * English checkers; rules.test.ts checks them thoroughly.
 *
 * This is NOT international draughts: the board is 8×8, men only move and capture
 * forwards, kings move one square at a time (no "flying kings"), and you may choose any
 * capture route (you don't have to take the most pieces).
 *
 * The board and the rules:
 * - Only the 32 dark squares are used. They're numbered 1 to 32 in the standard way:
 *   with Red at the top, square 1 is the top row's first dark square from the left, and
 *   32 is the bottom row's last. Each player has a dark square in their near left corner.
 * - Red starts on squares 1–12 and White on 21–32. **Red moves first.** (The official
 *   rules call the side that moves first "Black"; on most boards those pieces are red.)
 * - Men move one square diagonally forwards. Reaching the far row makes a king, which
 *   moves one square diagonally forwards or backwards.
 * - Captures are compulsory: if you can jump, you must. If a piece can keep jumping, it
 *   must, and the whole jump counts as one move. A man that's crowned during a jump stops
 *   there.
 * - You lose when you have no pieces left, or none of your pieces can move.
 * - It's a draw after 40 moves each (80 moves in total) with no capture and no new king.
 *
 * Moves are written in standard checkers notation: "11-15" for a step, and "15x24" or
 * "15x24x31" for a jump, listing every square the piece lands on.
 */

export type Colour = 'red' | 'white';

export interface Piece {
  colour: Colour;
  king: boolean;
}

export interface Position {
  /** The 32 dark squares: board[0] is square 1, board[31] is square 32. */
  board: readonly (Piece | null)[];
  turn: Colour;
  /** Moves in a row with no capture and no new king. 80 (40 each) is a draw. */
  quietPlies: number;
}

export interface CheckersMove {
  /** Every square the piece stands on, from start to finish. */
  path: number[];
  /** The squares of the pieces it jumps over, in order. */
  captures: number[];
  /** True if a man becomes a king on this move. */
  crowns: boolean;
  /** Standard notation: "11-15", "15x24x31". */
  notation: string;
}

export type RuleEnding = 'no-pieces' | 'no-moves' | 'forty-moves';

export interface BoardResult {
  ending: RuleEnding;
  /** Who won, or null for a draw. */
  winner: Colour | null;
}

/** 40 moves each with no capture and no new king. */
export const QUIET_PLIES_FOR_DRAW = 80;

export function otherColour(colour: Colour): Colour {
  return colour === 'red' ? 'white' : 'red';
}

/** Which row (0 = top, Red's back row) and column (0 = left) a square is on. */
export function rowCol(square: number): { row: number; col: number } {
  const row = Math.floor((square - 1) / 4);
  const index = (square - 1) % 4;
  return { row, col: row % 2 === 0 ? index * 2 + 1 : index * 2 };
}

/** The square number at a row and column, or null for a light square or off the board. */
export function squareAt(row: number, col: number): number | null {
  if (row < 0 || row > 7 || col < 0 || col > 7 || (row + col) % 2 === 0) return null;
  return row * 4 + Math.floor(col / 2) + 1;
}

/** The far row, where a man is crowned. */
function crownRow(colour: Colour) {
  return colour === 'red' ? 7 : 0;
}

/** Red men move down the board (towards row 7), White men move up. */
function directions(piece: Piece): [number, number][] {
  const forward = piece.colour === 'red' ? 1 : -1;
  const steps: [number, number][] = [
    [forward, -1],
    [forward, 1],
  ];
  if (piece.king) steps.push([-forward, -1], [-forward, 1]);
  return steps;
}

export function startPosition(): Position {
  const board: (Piece | null)[] = [];
  for (let square = 1; square <= 32; square++) {
    if (square <= 12) board.push({ colour: 'red', king: false });
    else if (square >= 21) board.push({ colour: 'white', king: false });
    else board.push(null);
  }
  return { board, turn: 'red', quietPlies: 0 };
}

export function pieceAt(position: Position, square: number): Piece | null {
  return position.board[square - 1] ?? null;
}

function makeMove(path: number[], captures: number[], crowns: boolean): CheckersMove {
  return { path, captures, crowns, notation: path.join(captures.length > 0 ? 'x' : '-') };
}

/** Every complete jump the piece on `from` can make. Each one carries on as far as it can. */
function jumpsFrom(position: Position, from: number): CheckersMove[] {
  const piece = pieceAt(position, from)!;
  const board = [...position.board];
  // The jumping piece has left its square, so it could even land back there.
  board[from - 1] = null;
  const found: CheckersMove[] = [];

  function explore(at: number, path: number[], captured: number[]) {
    const { row, col } = rowCol(at);
    let canJump = false;
    for (const [dr, dc] of directions(piece)) {
      const over = squareAt(row + dr, col + dc);
      const land = squareAt(row + 2 * dr, col + 2 * dc);
      if (over === null || land === null) continue;
      const victim = board[over - 1];
      // Jumped pieces stay on the board until the move ends, so they can't be jumped twice
      // and can't be landed on.
      if (!victim || victim.colour === piece.colour || captured.includes(over) || board[land - 1]) continue;
      canJump = true;
      const nextPath = [...path, land];
      const nextCaptured = [...captured, over];
      if (!piece.king && rowCol(land).row === crownRow(piece.colour)) {
        // Crowned during a jump: the move ends here.
        found.push(makeMove(nextPath, nextCaptured, true));
      } else {
        explore(land, nextPath, nextCaptured);
      }
    }
    if (!canJump && captured.length > 0) found.push(makeMove(path, captured, false));
  }

  explore(from, [from], []);
  return found;
}

function stepsFrom(position: Position, from: number): CheckersMove[] {
  const piece = pieceAt(position, from)!;
  const { row, col } = rowCol(from);
  const moves: CheckersMove[] = [];
  for (const [dr, dc] of directions(piece)) {
    const to = squareAt(row + dr, col + dc);
    if (to === null || pieceAt(position, to)) continue;
    moves.push(makeMove([from, to], [], !piece.king && rowCol(to).row === crownRow(piece.colour)));
  }
  return moves;
}

function ownSquares(position: Position): number[] {
  const squares: number[] = [];
  for (let square = 1; square <= 32; square++) {
    if (pieceAt(position, square)?.colour === position.turn) squares.push(square);
  }
  return squares;
}

/**
 * Every legal move for the side to move. If any jump is possible, only jumps are legal
 * (captures are compulsory), but the player may pick whichever jump they like.
 */
export function legalMoves(position: Position): CheckersMove[] {
  const mine = ownSquares(position);
  const jumps = mine.flatMap((square) => jumpsFrom(position, square));
  if (jumps.length > 0) return jumps;
  return mine.flatMap((square) => stepsFrom(position, square));
}

/** True when the side to move has a capture, and so must take one. */
export function mustCapture(position: Position): boolean {
  return ownSquares(position).some((square) => jumpsFrom(position, square).length > 0);
}

/** Makes a move (assumed legal: get it from legalMoves). Returns the new position. */
export function applyMove(position: Position, move: CheckersMove): Position {
  const board = [...position.board];
  const from = move.path[0];
  const to = move.path[move.path.length - 1];
  const piece = board[from - 1]!;
  board[from - 1] = null;
  for (const square of move.captures) board[square - 1] = null;
  board[to - 1] = { colour: piece.colour, king: piece.king || move.crowns };
  const quiet = move.captures.length === 0 && !move.crowns;
  return { board, turn: otherColour(position.turn), quietPlies: quiet ? position.quietPlies + 1 : 0 };
}

/** Finds a legal move from its notation, e.g. "11-15" or "15x24x31". Null if it isn't legal here. */
export function findMove(position: Position, notation: string): CheckersMove | null {
  return legalMoves(position).find((move) => move.notation === notation) ?? null;
}

/** Has the game ended by the rules? */
export function boardResult(position: Position): BoardResult | null {
  const winner = otherColour(position.turn);
  if (ownSquares(position).length === 0) return { ending: 'no-pieces', winner };
  if (legalMoves(position).length === 0) return { ending: 'no-moves', winner };
  if (position.quietPlies >= QUIET_PLIES_FOR_DRAW) return { ending: 'forty-moves', winner: null };
  return null;
}

export type ReplayResult =
  | { ok: true; position: Position; played: CheckersMove[]; result: BoardResult | null }
  | { ok: false; badMoveIndex: number };

/**
 * Replays a whole game from the starting position. Fails if any move is illegal, or if
 * a move comes after the game has already ended.
 */
export function replay(moves: readonly string[]): ReplayResult {
  let position = startPosition();
  const played: CheckersMove[] = [];
  for (let i = 0; i < moves.length; i++) {
    const move = boardResult(position) ? null : findMove(position, moves[i]);
    if (!move) return { ok: false, badMoveIndex: i };
    position = applyMove(position, move);
    played.push(move);
  }
  return { ok: true, position, played, result: boardResult(position) };
}

/**
 * Builds a position from a picture, for tests and puzzles. Rows go top (Red's side) to
 * bottom, using the 4 dark squares of each row: r/w = man, R/W = king, . = empty.
 */
export function positionFromRows(rows: string[], turn: Colour = 'red', quietPlies = 0): Position {
  const codes = rows.join('').replace(/\s/g, '');
  if (codes.length !== 32) throw new Error('A board needs 32 squares');
  const board = [...codes].map((code): Piece | null => {
    if (code === '.') return null;
    return { colour: code.toLowerCase() === 'r' ? 'red' : 'white', king: code === code.toUpperCase() };
  });
  return { board, turn, quietPlies };
}
