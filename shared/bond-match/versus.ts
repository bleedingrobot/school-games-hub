/**
 * Two players on one board (pass-and-play, or a player against the computer). Built on the same engine as
 * the solo game: this file only adds whose turn it is and how many pairs each player has won.
 *
 * A match scores a pair and the same player goes again. A mismatch passes the turn.
 */
import { flip, newGame, type FlipResult, type GameEvent, type GameState } from './engine';
import type { Deck } from './deck';

export type Player = 0 | 1;

export interface VersusState {
  readonly game: GameState;
  /** Whose go it is. */
  readonly turn: Player;
  /** Pairs won by each player. */
  readonly pairs: readonly [number, number];
}

export interface VersusResult {
  state: VersusState;
  events: GameEvent[];
  refused?: FlipResult['refused'];
}

export const newVersus = (deck: Deck, first: Player = 0): VersusState => ({ game: newGame(deck), turn: first, pairs: [0, 0] });

export const otherPlayer = (p: Player): Player => (p === 0 ? 1 : 0);

export function versusFlip(state: VersusState, index: number): VersusResult {
  if (state.game.finished) return { state, events: [], refused: 'already-matched' };
  const r = flip(state.game, index);
  if (r.refused) return { state, events: [], refused: r.refused };
  let { turn, pairs } = state;
  for (const e of r.events) {
    if (e.type === 'match') pairs = turn === 0 ? [pairs[0] + 1, pairs[1]] : [pairs[0], pairs[1] + 1];
    if (e.type === 'mismatch') turn = otherPlayer(turn);
  }
  return { state: { game: r.state, turn, pairs }, events: r.events };
}

/** The winner once the board is clear, or 'tie'. Undefined while the game is still going. */
export function winnerOf(state: VersusState): Player | 'tie' | undefined {
  if (!state.game.finished) return undefined;
  const [a, b] = state.pairs;
  return a === b ? 'tie' : a > b ? 0 : 1;
}
