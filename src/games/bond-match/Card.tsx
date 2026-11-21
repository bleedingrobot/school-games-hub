import { forwardRef, useState } from 'react';
import { sideText } from '../../../shared/bond-match/exact';
import type { Card as DeckCard } from '../../../shared/bond-match/deck';
import { TEXT } from './strings';
import { FractionBar, Value } from './Value';

/** How many colours matched pairs cycle through. A board has at most 10 pairs, so none repeat. */
export const MATCH_COLOURS = 10;

export type CardState = 'down' | 'up' | 'matched';

/** The painted pictures for the board (art.ts). Anything missing keeps its CSS look. */
export interface CardArt {
  back?: string;
  stone?: string;
  ripple?: string;
  sparkle?: string;
  onError: (src: string) => void;
}

interface Props {
  /** Where the card is on the board, from 0. The spoken number is one more. */
  index: number;
  card: DeckCard;
  state: CardState;
  /** The card it matched with, when matched. */
  partner?: number;
  /** Which match this card was part of (0 for the first pair found), so each pair gets its own colour. */
  matchNo: number;
  /** Draw the small bar under a fraction. */
  pictures?: boolean;
  art?: CardArt;
  /** Part of a mismatch on show: a small wobble (none with reduced motion). */
  wobble?: boolean;
  tabIndex: number;
  onFlip: (index: number) => void;
}

/** One card: a real button. A matched pair gets its own colour and a tick. */
export const Card = forwardRef<HTMLButtonElement, Props>(function Card({ index, card, state, partner, matchNo, pictures = false, art, wobble = false, tabIndex, onFlip }, ref) {
  const text = sideText(card.side);
  const number = index + 1;
  const base = state === 'down' ? TEXT.cardDown(number) : state === 'up' ? TEXT.cardUp(number, text) : TEXT.cardMatched(number, text, (partner ?? 0) + 1);
  const picture = pictures && card.side.kind === 'fraction' ? card.side : null;
  // The splash plays once, then goes, so it can't stick out past the board afterwards.
  const [splashed, setSplashed] = useState(false);
  return (
    <button
      ref={ref}
      type="button"
      className={`bm-card bm-card--${state}${card.side.kind === 'fraction' ? ' bm-card--frac' : ''}${picture ? ' bm-card--pic' : ''}${wobble ? ' bm-card--wobble' : ''}`}
      data-index={index}
      data-match-colour={state === 'matched' ? matchNo % MATCH_COLOURS : undefined}
      aria-label={base}
      tabIndex={tabIndex}
      // A matched card can't be flipped again; it stays a button so it can still be read out.
      aria-disabled={state === 'matched' || undefined}
      onClick={() => onFlip(index)}
    >
      <span className="bm-card__inner">
        <span className="bm-card__face bm-card__back" aria-hidden="true">
          {/* The painted sea glass, or the CSS gradient with its "+" drawn here. */}
          {art?.back ? <Pic src={art.back} className="bm-card__glass" onError={art.onError} /> : <span className="bm-card__logo">+</span>}
        </span>
        <span className="bm-card__face bm-card__front" aria-hidden="true">
          {art?.stone && <Pic src={art.stone} className="bm-card__stone" onError={art.onError} />}
          <Value text={text} />
          {picture && <FractionBar num={picture.num} den={picture.den} />}
          {state === 'matched' && <span className="bm-card__tick">✓</span>}
        </span>
      </span>
      {/* A match ripples out across the water once and a few sparkles twinkle (both hidden with reduced motion). */}
      {state === 'matched' && !splashed && (
        <span className="bm-card__splash" aria-hidden="true" onAnimationEnd={(e) => { if (e.animationName === (art?.sparkle ? 'bm-sparkle' : 'bm-ripple')) setSplashed(true); }}>
          {art?.ripple ? <Pic src={art.ripple} className="bm-card__ripple" onError={art.onError} /> : <span className="bm-card__ripple bm-card__ripple--css" />}
          {art?.sparkle && <Pic src={art.sparkle} className="bm-card__sparkle" onError={art.onError} />}
        </span>
      )}
    </button>
  );
});

function Pic({ src, className, onError }: { src: string; className: string; onError: (src: string) => void }) {
  return <img className={className} src={src} alt="" draggable={false} decoding="async" onError={() => onError(src)} />;
}
