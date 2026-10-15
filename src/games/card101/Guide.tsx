/**
 * How to play 101, in a pop-up. Written from docs/101-RULES.md. The examples are scored by
 * the real scoring code (shared/card101/score.ts), so they always match the game.
 * Opens from the settings screen, the game (the "How to play" button or the ? key) and the
 * waiting room. Escape or ✕ closes it, and focus goes back to where it was.
 */
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { cardName, type Card } from '../../../shared/card101/cards';
import { scoreHand } from '../../../shared/card101/score';
import { CardValues } from './Card101Settings';
import { PlayingCard } from './PlayingCard';
import { scoreLines } from './text';
import './card101.css';

/** The examples from the rules: hands that show each scoring rule. */
export const EXAMPLES: Card[][] = [
  ['7H', '7S', '4D', 'KC'],
  ['5H', '5S', '5D', 'QC'],
  ['3H', 'QS', '6D', 'AC'],
  ['3S', '9H', '9C', '5D'],
  ['3H', '3C', '9S', '7D'],
  ['3D', 'JS', 'QH', '2C'],
];

export function Card101Guide({ onClose, live = false }: { onClose: () => void; live?: boolean }) {
  const box = useRef<HTMLDivElement>(null);

  // Focus the close button when it opens, and give focus back to whatever had it when it closes.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('.c101-guide__close')?.focus();
    return () => before?.focus?.();
  }, []);

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      onClose();
      return;
    }
    // Keep Tab inside the pop-up.
    if (event.key === 'Tab' && box.current) {
      const focusable = Array.from(box.current.querySelectorAll<HTMLElement>('button, [href], [tabindex="0"]'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    }
  }

  return (
    <div className="c101-guide" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="c101-guide__card" role="dialog" aria-modal="true" aria-labelledby="c101-guide-title" ref={box} onKeyDown={onKeyDown}>
        <div className="c101-guide__top">
          <h2 id="c101-guide-title">📖 How to play 101</h2>
          <button type="button" className="c101-guide__close" onClick={onClose} aria-label="Close help">
            ✕
          </button>
        </div>
        <div className="c101-guide__body" tabIndex={0}>
          <section>
            <h3>The aim</h3>
            <p>
              Get the <strong>lowest</strong> hand each round. Your hands add up from round to round. When anyone’s total reaches{' '}
              <strong>101</strong> (or 50 in a Quick game), the game ends and the <strong>lowest total wins</strong>.
            </p>
            <CardValues />
          </section>

          <section>
            <h3>Each round</h3>
            <ol>
              <li>Everyone gets 4 cards face down, in a square.</li>
              <li>
                <strong>Peek</strong> at your <strong>bottom two</strong> cards. You only see them once, so remember them!
              </li>
              <li>
                On your turn, take the top card of the <strong>stack</strong> (only you see it) or the <strong>discard pile</strong>.
              </li>
              <li>
                <strong>Swap</strong> it for one of your face-down cards, or <strong>throw it away</strong>. A card you swap in goes{' '}
                <strong>face up</strong> for everyone to see, and it stays there for the rest of the round.
              </li>
              <li>
                Think you’re lowest? <strong>Knock</strong> instead of taking a card (once everyone has had a turn). Everyone else
                gets <strong>one last turn</strong>, then all the cards turn over and the hands are scored.
              </li>
            </ol>
          </section>

          <section>
            <h3>Scoring a hand</h3>
            <ol>
              <li>
                <strong>Three of a kind</strong> (or four): the whole hand is 0.
              </li>
              <li>
                <strong>Pairs</strong> anywhere in your square cancel out: both are 0.
              </li>
              <li>
                Each <strong>3</strong> is 0 <strong>and</strong> cancels your highest card that’s still counting.
              </li>
              <li>Add up what’s left.</li>
            </ol>
            <ul className="c101-guide__examples">
              {EXAMPLES.map((hand) => {
                const score = scoreHand(hand);
                const { steps, sum } = scoreLines(hand, score);
                return (
                  <li key={hand.join('')}>
                    <span className="sr-only">{hand.map(cardName).join(', ')}:</span>
                    <span className="c101-guide__hand">
                      {hand.map((card) => (
                        <PlayingCard key={card} card={card} />
                      ))}
                    </span>
                    <span className="c101-guide__working">
                      {steps.map((line) => (
                        <span key={line}>{line} </span>
                      ))}
                      <strong>{sum.replace('Hand: ', 'Scores ')}</strong>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h3>{live ? 'Playing classmates' : 'Good to know'}</h3>
            <ul>
              <li>Two players with the same lowest hand both win the round.</li>
              <li>A shared lowest total at the end is a shared win.</li>
              {live ? (
                <>
                  <li>You have 60 seconds for each turn. Run out of time 3 turns in a row, or press Leave, and you’re out.</li>
                  <li>The peek lasts 15 seconds. After that nobody can show you those cards again, not even a reload.</li>
                </>
              ) : (
                <li>Bots only see what you would see. They can’t peek at your cards!</li>
              )}
              <li>
                Keys: <kbd>S</kbd> stack, <kbd>D</kbd> discard pile, <kbd>K</kbd> knock, <kbd>T</kbd> throw away, arrow keys and{' '}
                <kbd>Enter</kbd> to swap, <kbd>?</kbd> this help.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
