/**
 * What one player is allowed to know. This is the ONLY way card information leaves the
 * server in a classmates game: every function reply, every live update and every bot
 * goes through `viewFor` and `eventsFor`.
 *
 * A player may see: the top of the discard pile; a card they've just drawn, while they
 * hold it; a card anyone took from the discard pile (everyone saw it face up); every
 * card swapped into a hand (those go in face up); their bottom two cards during the
 * peek, and never again; and everyone's cards once a round is over. Nothing else: never
 * the stack, never anyone's face-down cards, not even their own. `view.test.ts` plays thousands of games and checks every view for leaks.
 */
import { PEEK_SLOTS, type Card, type Slot } from './cards';
import { canKnock, type Game, type GameEvent, type Phase, type RoundResult, type Settings } from './engine';

export interface SeatView {
  seat: number;
  players: number;
  settings: Settings;
  round: number;
  phase: Phase;
  /** Whose turn it is (only means something while phase is "play"). */
  turn: number;
  starter: number;
  totals: number[];
  out: boolean[];
  /** How many cards each player has on the table (4, or 0 once they're out). */
  cardsOnTable: number[];
  /** Everyone's face-up cards by slot (swapped in this round); null where a card is face down. */
  faceUp: (Card | null)[][];
  stackCount: number;
  discardTop: Card | null;
  /** Someone is holding a card they drew. `card` is there only if it's yours or came off the discard pile. */
  holding: { seat: number; from: 'stack' | 'discard'; card: Card | null } | null;
  /** Your bottom two cards, only while your peek is on. */
  peek: { slots: readonly Slot[]; cards: Card[] } | null;
  /** Who has finished their peek this round. */
  peeked: boolean[];
  turnsThisRound: number[];
  knocker: number | null;
  owesLastTurn: boolean[];
  canKnock: boolean;
  /** Skipped turns in a row (3 and you're out). */
  skips: number[];
  /** The round that's just ended, with every hand face up (only between rounds and at the end). */
  lastRound: RoundResult | null;
  /** Every round so far, without the cards: hand scores and totals, for the scoreboard. */
  history: { round: number; hands: (number | null)[]; winners: number[]; knocker: number | null; totals: number[] }[];
  winners: number[] | null;
}

export function viewFor(game: Game, seat: number): SeatView {
  const holding = game.holding
    ? {
        seat: game.turn,
        from: game.holding.from,
        card: game.turn === seat || game.holding.from === 'discard' ? game.holding.card : null,
      }
    : null;
  const peekOn = game.phase === 'peek' && !game.out[seat] && !game.peeked[seat];
  const roundShown = game.phase === 'round-over' || game.phase === 'over';
  const last = game.results[game.results.length - 1];
  return {
    seat,
    players: game.players,
    settings: { ...game.settings },
    round: game.round,
    phase: game.phase,
    turn: game.turn,
    starter: game.starter,
    totals: [...game.totals],
    out: [...game.out],
    cardsOnTable: game.hands.map((hand) => hand.length),
    faceUp: game.hands.map((hand, s) => hand.map((card, slot) => (game.faceUp[s][slot] ? card : null))),
    stackCount: game.stack.length,
    discardTop: game.discard.length ? game.discard[game.discard.length - 1] : null,
    holding,
    peek: peekOn ? { slots: PEEK_SLOTS, cards: PEEK_SLOTS.map((slot) => game.hands[seat][slot]) } : null,
    peeked: [...game.peeked],
    turnsThisRound: [...game.turnsThisRound],
    knocker: game.knocker,
    owesLastTurn: [...game.owesLastTurn],
    canKnock: canKnock(game, seat),
    skips: [...game.skips],
    // Only the round that's just ended, and only while its cards are still the ones on the table.
    lastRound: roundShown && last && last.round === game.round ? structuredClone(last) : null,
    history: game.results.map((r) => ({
      round: r.round,
      hands: r.scores.map((s) => (s ? s.total : null)),
      winners: [...r.winners],
      knocker: r.knocker,
      totals: [...r.totals],
    })),
    winners: game.winners ? [...game.winners] : null,
  };
}

/**
 * The events one player may see. A card drawn from the stack is shown only to the
 * player who drew it, and only while they're still holding it (`game` is the game
 * after the events), so once it's swapped in it's gone from their screen too.
 */
export function eventsFor(events: readonly GameEvent[], seat: number, game: Game): GameEvent[] {
  return events.map((event): GameEvent => {
    if (event.kind === 'round-end') {
      // Face-up hands, but only while that round's cards are still on the table.
      const shown = (game.phase === 'round-over' || game.phase === 'over') && game.round === event.result.round;
      return shown ? structuredClone(event) : { kind: 'round-end', result: { ...structuredClone(event.result), hands: [] } };
    }
    if (event.kind !== 'draw' || event.from !== 'stack') return structuredClone(event);
    const stillHolding = game.phase === 'play' && game.turn === seat && game.holding?.card === event.card;
    if (event.seat === seat && stillHolding) return { ...event };
    return { kind: 'draw', seat: event.seat, from: 'stack' };
  });
}
