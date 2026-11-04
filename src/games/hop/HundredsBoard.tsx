/**
 * The hundreds board helper: a button on the play screen opens a 1 to 100 board the child can use while counting.
 * Tapping a number lights it up (tap again to turn it off), so they can mark the numbers they count through.
 * It only helps the child see: nothing on it is sent to the server or counted.
 */
import { useState } from 'react';
import { WORDS } from './words';

const NUMBERS = Array.from({ length: 100 }, (_, i) => i + 1);

export function HundredsBoard() {
  const [open, setOpen] = useState(false);
  const [lit, setLit] = useState<ReadonlySet<number>>(new Set());
  const toggle = (n: number) =>
    setLit((was) => {
      const next = new Set(was);
      if (!next.delete(n)) next.add(n);
      return next;
    });

  return (
    <>
      <button type="button" className="hp-button hp-board-toggle" aria-expanded={open} aria-controls="hp-board" onClick={() => setOpen(!open)}>
        <span aria-hidden="true">🔢 </span>
        {open ? WORDS.boardHide : WORDS.boardShow}
      </button>
      {open && (
        <div className="hp-board" id="hp-board" role="group" aria-label={WORDS.board}>
          <div className="hp-board__grid">
            {NUMBERS.map((n) => (
              <button
                key={n}
                type="button"
                className={`hp-board__cell${lit.has(n) ? ' hp-board__cell--lit' : ''}${n % 10 === 0 ? ' hp-board__cell--ten' : ''}`}
                aria-pressed={lit.has(n)}
                onClick={() => toggle(n)}
              >
                {n}
              </button>
            ))}
          </div>
          {lit.size > 0 && (
            <button type="button" className="hp-board__clear" onClick={() => setLit(new Set())}>
              {WORDS.boardClear}
            </button>
          )}
        </div>
      )}
    </>
  );
}
