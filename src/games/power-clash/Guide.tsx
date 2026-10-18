/**
 * How to play Power Clash, in a pop-up, for 8-year-olds. Opens from the "How to play" button
 * or the ? key. Escape or the close button closes it and focus goes back to the button.
 */
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react';
import { LOADOUT_SIZE } from '../../../shared/power-clash/engine';
import { ROUNDS_TO_WIN } from '../../../shared/power-clash/match';
import { POWERS } from './text';

const EXAMPLES: Record<string, string> = {
  'body-swap': 'Example: your X is in the corner and their O is in the middle. Swap them, and now your X is in the middle.',
  'freeze-ray': 'Example: freeze the top-middle square. They can’t put anything there on their next turn.',
  'board-wipe': 'Example: they have two in a row. Blast one of their symbols off the board before they get three!',
  'force-field': 'Example: your X is in the middle and they want to blast it. Put a Force Field on it first. It can’t be swapped or blasted until your next go.',
  'portal-chaos': 'Example: pick any two symbols. The portals throw them to two different squares (the two you picked or any empty one). Nobody knows where they will land!',
  'wild-card': 'Example: the wheel spins and lands on one of: a bonus symbol, a freeze, a swap or a blast. It never ends the round by handing the other player three in a row.',
  'time-heist': 'Example: they just made a great move. Time Heist! It never happened, and they get the power back. Then you place your symbol as normal. You can’t use it on the first go, and it can’t undo another Time Heist.',
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
              <li>You pick {LOADOUT_SIZE} powers before you start. Each power can be used <strong>once in each round</strong> (they come back for the next round).</li>
              <li>If you can’t place anywhere because every square is frozen, you miss your go.</li>
            </ul>
          </section>
          <section>
            <h3>The seven powers</h3>
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
            <h3>Chaos Mode</h3>
            <ul>
              <li>Pick <strong>Chaos Mode</strong> on the first screen (against a bot, or two players on one screen). It plays just like normal, but there is a <strong>surprise after every third go</strong>.</li>
              <li>The surprise is chosen at random and a banner tells you what it was: <strong>Earthquake</strong> (two symbols trade places), <strong>Frost wave</strong> (a square freezes for the player who is next), <strong>Meteor</strong> (a symbol is blasted away), <strong>Lucky star</strong> (the next player places two symbols) or <strong>Recharge</strong> (the next player gets a used power back).</li>
              <li>A surprise never makes a line by itself, and it never touches a protected symbol.</li>
            </ul>
          </section>
          <section>
            <h3>What if we both get a line?</h3>
            <p>
              If a power makes <strong>both</strong> players have three in a row at the same time, the player who{' '}
              <strong>just moved wins</strong>. (Portal Chaos and the Wild Card are kind: they never give <em>only</em> the other player a line.) If the board fills up with no line, it’s a draw.
            </p>
          </section>
          <section>
            <h3>Playing a classmate</h3>
            <ul>
              <li>You each pick your {LOADOUT_SIZE} powers first. Everyone sees them, and nobody can change them once the match starts.</li>
              <li>You have <strong>60 seconds</strong> for your go. If time runs out you just miss that go (you don’t lose), but if you miss three goes in a row the game ends.</li>
              <li>Leaving a game part-way means nobody earns points for it.</li>
            </ul>
          </section>
          <section>
            <h3>Keys</h3>
            <p><kbd>Tab</kbd> and <kbd>Enter</kbd> to choose, <kbd>1</kbd> to <kbd>9</kbd> to place a symbol on a square against a classmate (top left is 1, bottom right is 9), <kbd>Esc</kbd> to cancel a power, <kbd>?</kbd> for this help.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
