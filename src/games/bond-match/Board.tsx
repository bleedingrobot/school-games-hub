import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { Card as DeckCard } from '../../../shared/bond-match/deck';
import { Card } from './Card';
import { TEXT } from './strings';

/** Four cards across (two for a board of four), so Small is 3 rows, Medium 4 and Large 5, and a card stays big on a phone. */
export const columnsFor = (cards: number): number => (cards <= 4 ? 2 : 4);

interface Props {
  cards: readonly DeckCard[];
  matched: readonly boolean[];
  /** The card each matched card paired with (-1 for the rest), and which match it was, from the game. */
  pairedWith: readonly number[];
  matchNo: readonly number[];
  /** Cards turned face up and not matched (one waiting, or two on show as a mismatch). */
  shown: readonly number[];
  reducedMotion: boolean;
  setLabel: string;
  /** Draw the small fraction pictures on fraction cards. */
  pictures?: boolean;
  onFlip: (index: number) => void;
}

const MOVES: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/**
 * The grid of cards. It scales to the screen (a card is never under 64px, see bond-match.css).
 * One card is in the tab order; the arrow keys move between cards and Enter or Space flips.
 */
export function Board({ cards, matched, pairedWith, matchNo, shown, reducedMotion, setLabel, pictures, onFlip }: Props) {
  const cols = columnsFor(cards.length);
  const rows = Math.ceil(cards.length / cols);
  const [focus, setFocus] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent) {
    const move = MOVES[e.key];
    if (!move) return;
    e.preventDefault();
    const col = focus % cols + move[0];
    const row = Math.floor(focus / cols) + move[1];
    if (col < 0 || col >= cols || row < 0 || row >= rows) return;
    const next = row * cols + col;
    if (next >= cards.length) return;
    setFocus(next);
    refs.current[next]?.focus();
  }

  return (
    <div
      className={`bm-board${reducedMotion ? ' bm-board--still' : ''}`}
      role="group"
      aria-label={TEXT.board(setLabel)}
      style={{ '--bm-cols': cols, '--bm-rows': rows } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      {cards.map((card, i) => (
        <Card
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          index={i}
          card={card}
          state={matched[i] ? 'matched' : shown.includes(i) ? 'up' : 'down'}
          partner={matched[i] && pairedWith[i] >= 0 ? pairedWith[i] : undefined}
          matchNo={matchNo[i]}
          pictures={pictures}
          tabIndex={i === focus ? 0 : -1}
          onFlip={(index) => { setFocus(index); onFlip(index); }}
        />
      ))}
    </div>
  );
}
