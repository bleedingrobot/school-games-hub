/**
 * Games between two students, shared by the website and the "multiplayer" server function.
 *
 * The server uses this to referee: whose turn it is, whether a move is legal, and whether
 * the game has ended. The website uses the very same code to draw the board. Moves are the
 * same short codes as bot games: 'e2e4' for chess, '11-15' or '15x24' for checkers.
 *
 * The two players are called 'first' (moves first: White in chess, Red in checkers) and
 * 'second'.
 */
import * as checkers from './checkers/rules';
import * as chess from './chess/rules';
import { MIN_MOVES_TO_COUNT } from './botGame';

export type GameKind = 'chess' | 'checkers';
export type Side = 'first' | 'second';

export const GAME_KINDS: readonly GameKind[] = ['chess', 'checkers'];

/** If it's your opponent's turn and they haven't moved for this long, you can claim the win. */
export const CLAIM_WIN_AFTER_MS = 2 * 60 * 1000;
/** Each player can offer a draw at most this many times in a game... */
export const MAX_DRAW_OFFERS = 3;
/** ...and must make this many moves of their own between offers. */
export const MOVES_BETWEEN_DRAW_OFFERS = 5;

/** Game codes use these: no vowels (so no rude words) and no lookalikes like O/0 or I/1. */
export const CODE_ALPHABET = 'CDFGHJKMNPQRTVWXY34679';
export const CODE_LENGTH = 5;

export function isGameKind(value: unknown): value is GameKind {
  return GAME_KINDS.includes(value as GameKind);
}

export function otherSide(side: Side): Side {
  return side === 'first' ? 'second' : 'first';
}

/** The colour each side plays, as a word for the screen. */
export function colourName(game: GameKind, side: Side): string {
  if (game === 'chess') return side === 'first' ? 'White' : 'Black';
  return side === 'first' ? 'Red' : 'White';
}

/** The colour code each game's board uses for a side. */
export function chessColour(side: Side): chess.Colour {
  return side === 'first' ? 'white' : 'black';
}
export function checkersColour(side: Side): checkers.Colour {
  return side === 'first' ? 'red' : 'white';
}

/** Whose turn it is after this many moves. */
export function sideToMove(plies: number): Side {
  return plies % 2 === 0 ? 'first' : 'second';
}

/** How many moves a side has made after this many moves in total. */
export function movesBy(side: Side, plies: number): number {
  return side === 'first' ? Math.ceil(plies / 2) : Math.floor(plies / 2);
}

/** A random code, e.g. 'KM4TP'. `random` gives numbers from 0 up to (not including) 1. */
export function makeCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return code;
}

/** Tidies up what a student typed: any case, spaces or dashes are fine. Null if it can't be a code. */
export function normaliseCode(typed: unknown): string | null {
  if (typeof typed !== 'string' || typed.length > 20) return null;
  const code = typed.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== CODE_LENGTH || [...code].some((c) => !CODE_ALPHABET.includes(c))) return null;
  return code;
}

/** Shows a code in two easy-to-read chunks, e.g. 'KM4 TP'. */
export function prettyCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

export interface Ending {
  /** Null for a draw. */
  winner: Side | null;
  reason: string;
}

export type Replayed =
  | { ok: true; toMove: Side; ended: Ending | null }
  | { ok: false };

/** Replays a game's moves and says whose turn it is, or how it ended by the rules. */
export function replayGame(game: GameKind, moves: readonly string[]): Replayed {
  if (game === 'chess') {
    const replayed = chess.replay(moves);
    if (!replayed.ok) return { ok: false };
    const result = replayed.result;
    return {
      ok: true,
      toMove: sideToMove(moves.length),
      ended: result && { winner: result.winner && (result.winner === 'white' ? 'first' : 'second'), reason: result.ending },
    };
  }
  const replayed = checkers.replay(moves);
  if (!replayed.ok) return { ok: false };
  const result = replayed.result;
  return {
    ok: true,
    toMove: sideToMove(moves.length),
    ended: result && { winner: result.winner && (result.winner === 'red' ? 'first' : 'second'), reason: result.ending },
  };
}

/** Is this move legal next? Returns the move in its standard form, or null. */
export function checkMove(game: GameKind, moves: readonly string[], move: unknown): string | null {
  if (typeof move !== 'string' || move.length > 64) return null;
  if (game === 'chess') {
    const replayed = chess.replay(moves);
    if (!replayed.ok || replayed.result) return null;
    const played = chess.playUci(replayed.chess, move);
    return played ? chess.toUci(played) : null;
  }
  const replayed = checkers.replay(moves);
  if (!replayed.ok || replayed.result) return null;
  return checkers.findMove(replayed.position, move)?.notation ?? null;
}

/**
 * Why a side can't offer a draw right now, or null if it can: all its offers are used up, or
 * it must make a few more moves first. The server refuses on this, and the page uses it to
 * say why the button is greyed out.
 */
export function drawOfferBlock(
  side: Side,
  offersMade: number,
  lastOfferPly: number | null,
  plies: number,
): { problem: 'draw-limit' } | { problem: 'draw-wait'; movesLeft: number } | null {
  if (offersMade >= MAX_DRAW_OFFERS) return { problem: 'draw-limit' };
  if (lastOfferPly === null) return null;
  const movesSince = movesBy(side, plies) - movesBy(side, lastOfferPly);
  return movesSince < MOVES_BETWEEN_DRAW_OFFERS ? { problem: 'draw-wait', movesLeft: MOVES_BETWEEN_DRAW_OFFERS - movesSince } : null;
}

/** Recorded games earn nothing in Stage 7 if they were abandoned, or either player made fewer than 10 moves. */
export function countsForPoints(plies: number, reason: string): boolean {
  return reason !== 'abandoned' && movesBy('second', plies) >= MIN_MOVES_TO_COUNT;
}
