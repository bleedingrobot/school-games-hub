import { forwardRef } from 'react';
import { sideText } from '../../../shared/bond-match/exact';
import type { Card as DeckCard } from '../../../shared/bond-match/deck';
import { COLOUR_SETS, TEXT } from './strings';
import { FractionBar, Value } from './Value';

/** How many colours matched pairs cycle through. A board has at most 10 pairs, so none repeat. */
export const MATCH_COLOURS = 10;

export type CardState = 'down' | 'up' | 'matched';

interface Props {
  /** Where the card is on the board, from 0. The spoken number is one more. */
  index: number;
  card: DeckCard;
  state: CardState;
  /** The card it matched with, when matched. */
  partner?: number;
  /** Does the deck use both colour sets? Only then is the set said aloud, since otherwise it tells you nothing. */
  twoSets: boolean;
  /** Draw the small bar under a fraction. */
  pictures?: boolean;
  tabIndex: number;
  onFlip: (index: number) => void;
}

/**
 * One card: a real button. When the board has two colour sets, a card's set is its back (a colour, plus a big shape and
 * letter, so never colour alone) and a small corner mark on its face. A matched pair gets its own colour and a tick.
 */
export const Card = forwardRef<HTMLButtonElement, Props>(function Card({ index, card, state, partner, twoSets, pictures = false, tabIndex, onFlip }, ref) {
  const text = sideText(card.side);
  const set = COLOUR_SETS[card.set];
  const number = index + 1;
  const base = state === 'down' ? TEXT.cardDown(number) : state === 'up' ? TEXT.cardUp(number, text) : TEXT.cardMatched(number, text, (partner ?? 0) + 1);
  const picture = pictures && card.side.kind === 'fraction' ? card.side : null;
  const label = twoSets ? `${base}, ${TEXT.setOf(set.name)}` : base;
  return (
    <button
      ref={ref}
      type="button"
      className={`bm-card bm-card--${state} bm-card--set${twoSets ? card.set : 0}${twoSets ? ' bm-card--two' : ''}${card.side.kind === 'fraction' ? ' bm-card--frac' : ''}${picture ? ' bm-card--pic' : ''}`}
      data-index={index}
      data-match-colour={state === 'matched' ? card.pair % MATCH_COLOURS : undefined}
      aria-label={label}
      tabIndex={tabIndex}
      // A matched card can't be flipped again; it stays a button so it can still be read out.
      aria-disabled={state === 'matched' || undefined}
      onClick={() => onFlip(index)}
    >
      <span className="bm-card__inner">
        <span className="bm-card__face bm-card__back" aria-hidden="true">
          {/* The back shows the card's set (shape and letter) when the board has two; otherwise just the game's mark. */}
          {twoSets ? (
            <span className="bm-card__set">
              <span className="bm-card__shape">{set.shape}</span>
              <span className="bm-card__letter">{set.letter}</span>
            </span>
          ) : (
            <span className="bm-card__logo">+</span>
          )}
        </span>
        <span className="bm-card__face bm-card__front" aria-hidden="true">
          <Value text={text} />
          {picture && <FractionBar num={picture.num} den={picture.den} />}
          {state === 'matched' && <span className="bm-card__tick">✓</span>}
          {twoSets && (
            <span className="bm-card__corner">
              {set.shape}
              <span className="bm-card__letter">{set.letter}</span>
            </span>
          )}
        </span>
      </span>
    </button>
  );
});
