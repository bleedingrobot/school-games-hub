/**
 * The rules of Bond Match, as pure functions: flip a card, get the new state and what happened.
 * No clock, no random, no screen, so the browser and the server run exactly the same game.
 *
 * A turn is two flips. If the two cards add up to the target and are in the same colour set they
 * match and stay up. If not they stay face up (so the screen can show "3 + 4 = 7") until the next
 * flip, which turns them back first.
 */
import { addExact, sameExact, sideText, sideValue, sumText, type Exact } from './exact';
import { arePartners, type Deck } from './deck';

export interface GameState {
  readonly deck: Deck;
  /** Cards that have been matched, by index. */
  readonly matched: readonly boolean[];
  /** Cards face up and not matched: none, one (waiting for a second flip) or two (a mismatch on show). */
  readonly shown: readonly number[];
  /** Turns taken: a pair of flips counts as one. */
  readonly flips: number;
  /** Every accepted card flip, in order. This is what gets saved and replayed. */
  readonly log: readonly number[];
  readonly finished: boolean;
}

export type GameEvent =
  | { type: 'first'; card: number; text: string }
  | { type: 'match'; cards: [number, number]; texts: [string, string]; sumText: string }
  | {
      type: 'mismatch';
      cards: [number, number];
      /** Each card as drawn ("0.30") and as an exact fraction. */
      texts: [string, string];
      values: [Exact, Exact];
      sum: Exact;
      /** The sum, written the way the cards are ("1.0", "7"), for the "3 + 4 = 7" line. */
      sumText: string;
      /** True when they add up to the target but are in different colour sets, so the screen can say so. */
      sumsToTarget: boolean;
    }
  | { type: 'finish'; flips: number };

export type RefusedReason = 'no-such-card' | 'already-matched' | 'same-card';

export interface FlipResult {
  state: GameState;
  events: GameEvent[];
  /** Set when the flip was not allowed. The state is then the very same object that was passed in. */
  refused?: RefusedReason;
}

export const newGame = (deck: Deck): GameState => ({
  deck,
  matched: deck.cards.map(() => false),
  shown: [],
  flips: 0,
  log: [],
  finished: false,
});

export function flip(state: GameState, index: number): FlipResult {
  const { deck } = state;
  const refuse = (refused: RefusedReason): FlipResult => ({ state, events: [], refused });
  if (!Number.isInteger(index) || index < 0 || index >= deck.cards.length) return refuse('no-such-card');
  if (state.matched[index]) return refuse('already-matched');
  // A mismatch left on show is turned back by this flip. A card already waiting for its partner can't be its own partner.
  const waiting = state.shown.length === 1 ? state.shown[0] : undefined;
  if (waiting === index) return refuse('same-card');
  const log = [...state.log, index];
  const card = deck.cards[index];

  if (waiting === undefined) {
    return { state: { ...state, shown: [index], log }, events: [{ type: 'first', card: index, text: sideText(card.side) }] };
  }

  const other = deck.cards[waiting];
  const texts: [string, string] = [sideText(other.side), sideText(card.side)];
  const flips = state.flips + 1;
  if (arePartners(deck.target, other, card)) {
    const matched = state.matched.map((m, i) => m || i === index || i === waiting);
    const finished = matched.every(Boolean);
    const events: GameEvent[] = [{ type: 'match', cards: [waiting, index], texts, sumText: sumText([other.side, card.side]) }];
    if (finished) events.push({ type: 'finish', flips });
    return { state: { ...state, matched, shown: [], flips, log, finished }, events };
  }
  const values: [Exact, Exact] = [sideValue(other.side), sideValue(card.side)];
  const sum = addExact(values[0], values[1]);
  return {
    state: { ...state, shown: [waiting, index], flips, log },
    events: [{
      type: 'mismatch', cards: [waiting, index], texts, values, sum,
      sumText: sumText([other.side, card.side]), sumsToTarget: sameExact(sum, deck.target),
    }],
  };
}
