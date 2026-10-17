/**
 * How to play Power Clash, in a pop-up, for 8-year-olds. Opens from the "How to play" button
 * or the ? key. Escape or the close button closes it and focus goes back to the button.
 */
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react';
import { LOADOUT_SIZE } from '../../../shared/power-clash/engine';
import { ROUNDS_TO_WIN } from '../../../shared/power-clash/match';
import { POWERS } from './text';

const EXAMPLES: Record<string, string> = {
  'double-trouble': 'Example: you put an X in the corner, then another X in the middle. Two in one go!',
  'body-swap': 'Example: your X is in the corner and their O is in the middle. Swap them, and now your X is in the middle.',
  'freeze-ray': 'Example: freeze the top-middle square. They can’t put anything there on their next turn.',
  'board-wipe': 'Example: they have two in a row. Blast one of their symbols off the board before they get three!',
};

export function PowerClashGuide({ onClose, returnTo }: { onClose: () => void; returnTo: RefObject<HTMLElement | null> }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    box.current?.querySelector<HTMLElement>('.pc-guide__close')?.focus();
    const back = returnTo.current;
    return () => back?.focus?.();
  }, [returnTo]);

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      onClose();
      return;
    }
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
    <div className="pc-guide" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pc-guide__card" role="dialog" aria-modal="true" aria-labelledby="pc-guide-title" ref={box} onKeyDown={onKeyDown}>
        <div className="pc-guide__top">
          <h2 id="pc-guide-title">📖 How to play Power Clash</h2>
          <button type="button" className="pc-guide__close" onClick={onClose} aria-label="Close help">✕</button>
        </div>
        <div className="pc-guide__body" tabIndex={0}>
          <section>
            <h3>The goal</h3>
            <p>
              Get <strong>three of your symbols in a row</strong>, like normal noughts and crosses. Win{' '}
              <strong>{ROUNDS_TO_WIN} rounds</strong> to win the match.
            </p>
          </section>
          <section>
            <h3>On your go</h3>
            <ul>
              <li>You can use <strong>one power</strong> on your go (you don’t have to), then place your symbol.</li>
              <li>You pick {LOADOUT_SIZE} powers before you start. Each power can be used <strong>once</strong> in the match.</li>
              <li>If you can’t place anywhere because every square is frozen, you miss your go.</li>
            </ul>
          </section>
          <section>
            <h3>The four powers</h3>
            <ul className="pc-guide__powers">
              {POWERS.map((p) => (
                <li key={p.id}>
                  <strong><span aria-hidden="true">{p.icon} </span>{p.name}</strong>: {p.blurb}
                  <br />
                  <span className="pc-guide__example">{EXAMPLES[p.id]}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3>What if we both get a line?</h3>
            <p>
              If a power makes <strong>both</strong> players have three in a row at the same time, the player who{' '}
              <strong>just moved wins</strong>. If the board fills up with no line, it’s a draw.
            </p>
          </section>
          <section>
            <h3>Keys</h3>
            <p><kbd>Tab</kbd> and <kbd>Enter</kbd> to choose, <kbd>Esc</kbd> to cancel a power, <kbd>?</kbd> for this help.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
