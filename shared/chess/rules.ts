/**
 * Chess rules, shared by the website and the server.
 *
 * chess.js does the real work (legal moves, check, castling, en passant, promotion and
 * every draw rule). This file only adds the few things both sides need: replaying a
 * game from its list of moves, and saying how a finished game ended.
 *
 * Moves are stored in "UCI" form: from-square + to-square, plus the promotion piece
 * if there is one. For example "e2e4", "e1g1" (castling), "e7e8q" (promote to a queen).
 */
import { Chess, type Move, type Square } from 'chess.js';

export { Chess };
export type { Move, Square };

export type Colour = 'white' | 'black';
export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

/** How a game finished on the board, by the rules (not by resigning). */
export type RuleEnding = 'checkmate' | 'stalemate' | 'threefold-repetition' | 'fifty-moves' | 'not-enough-pieces';

export interface BoardResult {
  ending: RuleEnding;
  /** Who won, or null for a draw. */
  winner: Colour | null;
}

const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export function isUciMove(text: unknown): text is string {
  return typeof text === 'string' && UCI.test(text);
}

export function colourOf(turn: 'w' | 'b'): Colour {
  return turn === 'w' ? 'white' : 'black';
}

export function toUci(move: Pick<Move, 'from' | 'to' | 'promotion'>): string {
  return move.from + move.to + (move.promotion ?? '');
}

/** Plays one UCI move. Returns the move, or null if it isn't legal here. Never throws. */
export function playUci(chess: Chess, uci: string): Move | null {
  if (!isUciMove(uci)) return null;
  try {
    return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return null;
  }
}

/** Every legal move in the current position, in UCI form. */
export function legalUciMoves(chess: Chess): string[] {
  return chess.moves({ verbose: true }).map(toUci);
}

/**
 * Has the game ended by the rules? Draws end the game automatically: threefold
 * repetition, 50 moves each with no capture or pawn move, and too few pieces to mate.
 */
export function boardResult(chess: Chess): BoardResult | null {
  if (chess.isCheckmate()) {
    // The side to move has been checkmated, so the other side won.
    return { ending: 'checkmate', winner: chess.turn() === 'w' ? 'black' : 'white' };
  }
  if (chess.isStalemate()) return { ending: 'stalemate', winner: null };
  if (chess.isInsufficientMaterial()) return { ending: 'not-enough-pieces', winner: null };
  if (chess.isThreefoldRepetition()) return { ending: 'threefold-repetition', winner: null };
  if (chess.isDrawByFiftyMoves()) return { ending: 'fifty-moves', winner: null };
  return null;
}

export type ReplayResult =
  | { ok: true; chess: Chess; result: BoardResult | null }
  | { ok: false; badMoveIndex: number };

/**
 * Replays a whole game from the starting position. Fails if any move is illegal, or if
 * a move comes after the game has already ended.
 */
export function replay(moves: readonly string[]): ReplayResult {
  const chess = new Chess();
  for (let i = 0; i < moves.length; i++) {
    if (boardResult(chess) || !playUci(chess, moves[i])) return { ok: false, badMoveIndex: i };
  }
  return { ok: true, chess, result: boardResult(chess) };
}
