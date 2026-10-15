/**
 * The 101 table: green felt, your 2×2 square at the bottom, the other players round the
 * table, the stack and discard pile in the middle. It only draws what the student's
 * view (shared/card101/view.ts) says they can see; the screen around it decides what
 * happens when something is tapped.
 */
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { AvatarImage } from '../../avatar/AvatarImage';
import { cardName, SLOT_NAMES, SLOTS, type Card, type Slot } from '../../../shared/card101/cards';
import type { SeatView } from '../../../shared/card101/view';
import { PlayingCard } from './PlayingCard';

export interface Seat {
  name: string;
  avatar: unknown;
  isStudent: boolean;
  /** "Easy bot", for bots. */
  about?: string;
}

/** Where each seat sits, going clockwise from the student at the bottom. */
const PLACES: Record<number, string[]> = {
  2: ['me', 'top'],
  3: ['me', 'left', 'right'],
  4: ['me', 'left', 'top', 'right'],
};

/** A card that just changed, so it can flash. `n` makes the flash restart. */
export interface Flash {
  seat: number;
  slot: Slot;
  n: number;
}

/** What one seat's four cards look like right now: a card face up, or null for face down. */
export function shownCards(view: SeatView, seat: number): (Card | null)[] {
  if (view.cardsOnTable[seat] === 0) return [];
  const round = view.lastRound;
  if (round && round.hands[seat]?.length) return round.hands[seat];
  return SLOTS.map((slot) => {
    if (seat === view.seat && view.peek) {
      const i = view.peek.slots.indexOf(slot);
      if (i >= 0) return view.peek.cards[i];
    }
    return view.faceUp[seat]?.[slot] ?? null;
  });
}

/** Arrow keys move round your four cards like the square they're in (0 1 / 2 3). */
function squareKeys(event: ReactKeyboardEvent<HTMLElement>) {
  const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 };
  const move = moves[event.key];
  if (move === undefined) return;
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-slot]'));
  const at = buttons.findIndex((b) => b === document.activeElement);
  const from = at < 0 ? 0 : Number(buttons[at].dataset.slot);
  // Step in that direction to the next card you can pick (wrapping round the square).
  for (let step = 1; step <= 4; step++) {
    const slot = (((from + move * step) % 4) + 4) % 4;
    const target = buttons.find((b) => Number(b.dataset.slot) === slot && !b.disabled);
    if (target) {
      target.focus();
      event.preventDefault();
      return;
    }
  }
}

function cardLabel(owner: string, slot: Slot, card: Card | null) {
  return `${owner} card, ${SLOT_NAMES[slot]}: ${card ? `${cardName(card)}, face up` : 'face down'}`;
}

function SeatInfo({ seat, view, index, thinking }: { seat: Seat; view: SeatView; index: number; thinking: boolean }) {
  const knocked = view.knocker === index;
  const out = view.out[index];
  return (
    <div className="c101-seat__info">
      <AvatarImage avatar={seat.avatar} size={36} />
      <span className="c101-seat__name">
        {seat.isStudent ? 'You' : seat.name}
        {seat.about && <small>{seat.about}</small>}
      </span>
      {knocked && <span className="c101-badge c101-badge--knock">✊ Knocked</span>}
      {out && <span className="c101-badge">Left</span>}
      {thinking && (
        <span className="c101-thinking" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
    </div>
  );
}

export function Table({
  view,
  seats,
  turnSeat,
  thinking,
  flash,
  canSwap,
  canDraw,
  onDraw,
  onSwap,
  children,
  overlay,
}: {
  view: SeatView;
  seats: readonly Seat[];
  /** Whose turn to show (null between rounds). */
  turnSeat: number | null;
  /** A bot is deciding. */
  thinking: boolean;
  flash: Flash | null;
  /** The student is holding a card and can swap it into a face-down spot. */
  canSwap: boolean;
  /** The student can take a card from the stack or discard pile. */
  canDraw: boolean;
  onDraw: (from: 'stack' | 'discard') => void;
  onSwap: (slot: Slot) => void;
  /** The student's controls, under their cards. */
  children: ReactNode;
  /** The scoring show or podium, over the felt. */
  overlay?: ReactNode;
}) {
  const me = view.seat;
  const places = PLACES[view.players];
  const holding = view.holding;
  const myHolding = holding && holding.seat === me ? holding : null;
  const between = view.phase === 'round-over' || view.phase === 'over';

  const renderSeat = (index: number) => {
    const seat = seats[index];
    const cards = shownCards(view, index);
    const isMe = index === me;
    const isTurn = turnSeat === index && !between;
    const theirHolding = !isMe && holding && holding.seat === index ? holding : null;
    const owner = isMe ? 'Your' : `${seat.name}’s`;
    return (
      <section
        key={index}
        className={`c101-seat c101-seat--${places[index]}${isTurn ? ' is-turn' : ''}${view.out[index] ? ' is-out' : ''}`}
        aria-label={isMe ? 'Your cards' : `${seat.name}’s cards`}
      >
        <SeatInfo seat={seat} view={view} index={index} thinking={thinking && isTurn && !isMe} />
        <div className="c101-seat__row">
          {cards.length > 0 && (
            <div className="c101-square" role={isMe ? 'group' : undefined} aria-label={isMe ? 'Your four cards' : undefined} onKeyDown={isMe ? squareKeys : undefined}>
              {SLOTS.map((slot) => {
                const card = cards[slot];
                const flashing = flash && flash.seat === index && flash.slot === slot;
                const peeking = isMe && view.peek?.slots.includes(slot);
                const cls = `c101-slot${card ? ' is-up' : ''}${peeking ? ' is-peek' : ''}`;
                const face = <PlayingCard key={flashing ? `f${flash.n}` : 'c'} card={card} className={flashing ? 'is-new' : ''} />;
                if (!isMe) {
                  return (
                    <div key={slot} className={cls} role="img" aria-label={cardLabel(owner, slot, card)}>
                      {face}
                    </div>
                  );
                }
                const swappable = canSwap && !view.faceUp[me]?.[slot];
                return (
                  <button
                    key={slot}
                    type="button"
                    data-slot={slot}
                    className={`${cls}${swappable ? ' is-pickable' : ''}`}
                    disabled={!swappable}
                    onClick={() => onSwap(slot)}
                    aria-label={swappable ? `Swap with your ${SLOT_NAMES[slot]} card (face down)` : cardLabel(owner, slot, card)}
                  >
                    {face}
                    {peeking && <span className="c101-slot__tag">Remember!</span>}
                  </button>
                );
              })}
            </div>
          )}
          {theirHolding && (
            <div
              className="c101-held c101-held--small"
              role="img"
              aria-label={`${seat.name} is holding ${theirHolding.card ? `the ${cardName(theirHolding.card)}` : 'a card from the stack'}`}
            >
              <PlayingCard card={theirHolding.card} />
            </div>
          )}
        </div>
        {isMe && children}
      </section>
    );
  };

  return (
    <div className={`c101-table c101-table--${view.players}`}>
      {seats.map((_, i) => (i === me ? null : renderSeat(i)))}
      <div className="c101-middle">
        <button
          type="button"
          className="c101-pile c101-pile--stack"
          disabled={!canDraw || view.stackCount === 0}
          onClick={() => onDraw('stack')}
          aria-label={`Stack: ${view.stackCount} cards. Take the top card`}
          aria-keyshortcuts="S"
        >
          <span className="c101-pile__cards">
            {view.stackCount > 1 && <PlayingCard card={null} className="c101-pile__under" />}
            {view.stackCount > 0 ? <PlayingCard card={null} /> : <span className="c101-pile__empty" />}
          </span>
          <span className="c101-pile__label">
            Stack <small>{view.stackCount}</small>
          </span>
        </button>
        <button
          type="button"
          className="c101-pile c101-pile--discard"
          disabled={!canDraw || !view.discardTop}
          onClick={() => onDraw('discard')}
          aria-label={view.discardTop ? `Discard pile: ${cardName(view.discardTop)}. Take it` : 'Discard pile: empty'}
          aria-keyshortcuts="D"
        >
          <span className="c101-pile__cards">
            {view.discardTop ? <PlayingCard key={view.discardTop} card={view.discardTop} className="is-landing" /> : <span className="c101-pile__empty" />}
          </span>
          <span className="c101-pile__label">Discard</span>
        </button>
        {myHolding && (
          <div className="c101-held c101-held--mine" role="img" aria-label={`Your new card: ${cardName(myHolding.card!)}`}>
            <PlayingCard card={myHolding.card} className="is-drawn" />
            <span className="c101-pile__label">Your new card</span>
          </div>
        )}
      </div>
      {renderSeat(me)}
      {overlay}
    </div>
  );
}
