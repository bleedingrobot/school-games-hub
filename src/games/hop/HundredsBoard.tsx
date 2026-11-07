/**
 * The hundreds board helper: a button on the play screen opens a 1 to 100 board the child can use while counting.
 * Tapping a number lights it up (tap again to turn it off), so they can mark the numbers they count through.
 * It only helps the child see: nothing on it is sent to the server or counted.
 */
import { useState } from 'react';
import { WORDS } from './words';

/** 1 to 100, or 101 to 200 while counting past 100 (the same ten by ten board, so the tens line up). */
const numbers = (high: boolean) => Array.from({ length: 100 }, (_, i) => i + 1 + (high ? 100 : 0));

/**
 * `counting` (set while Hop counts the row in "Let's look together"): the board is shown open with these numbers lit, in
 * gold, as well as the ones the child lit. They go when the counting ends.
 */
export function HundredsBoard({ counting = null, high = false }: { counting?: readonly number[] | null; high?: boolean }) {
  const [openByChild, setOpen] = useState(false);
  const open = openByChild || counting !== null;
  const [lit, setLit] = useState<ReadonlySet<number>>(new Set());
  const toggle = (n: number) =>
    setLit((was) => {
      const next = new Set(was);
      if (!next.delete(n)) next.add(n);
      return next;
    });

  return (
    <>
      <button type="button" className="hp-button hp-board-toggle" aria-expanded={open} aria-controls="hp-board" onClick={() => setOpen(!openByChild)}>
        <span aria-hidden="true">🔢 </span>
        {open ? WORDS.boardHide : high ? WORDS.boardShowHigh : WORDS.boardShow}
      </button>
      {open && (
        <div className="hp-board" id="hp-board" role="group" aria-label={WORDS.board}>
          <div className="hp-board__grid">
            {numbers(high).map((n) => (
              <button
                key={n}
                type="button"
                className={`hp-board__cell${lit.has(n) || counting?.includes(n) ? ' hp-board__cell--lit' : ''}${n % 10 === 0 ? ' hp-board__cell--ten' : ''}`}
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
