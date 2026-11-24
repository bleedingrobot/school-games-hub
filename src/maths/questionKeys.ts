/**
 * The keyboard for a maths question box (QuestionModal, PracticalAsk), wherever the keyboard focus is: the box doesn't need
 * a click before the student can type (James, 24 Nov 2026). Digits, Backspace and Enter type the answer; 1 to 9 pick a
 * choice; Escape closes when the box allows it.
 *
 * The keys are read on the window, before the game's own keys (capture), and a key the box uses doesn't reach the game
 * (no flapping the bird while typing 7). Only the newest open box listens, so two boxes on screen never both type.
 * Keys typed into a text box, select or editable area, and keys with Ctrl, Cmd or Alt, are left alone.
 */
import { useEffect, useRef, type RefObject } from 'react';

/** The open boxes, oldest first; only the last one listens. */
const open: symbol[] = [];

function typingInField(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/**
 * Calls `onKey` for each key press meant for the box. `onKey` returns true when it used the key (then the key goes no
 * further). Enter on a button inside the box is left to press that button.
 */
export function useQuestionKeys(box: RefObject<HTMLElement | null>, onKey: (event: KeyboardEvent) => boolean) {
  const latest = useRef(onKey);
  latest.current = onKey;
  useEffect(() => {
    const me = Symbol('question box');
    open.push(me);
    const listen = (e: KeyboardEvent) => {
      if (open[open.length - 1] !== me) return;
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || typingInField(e.target)) return;
      if (e.key === 'Enter' && e.target instanceof HTMLElement && e.target.closest('button') && box.current?.contains(e.target)) return;
      if (!latest.current(e)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', listen, true);
    return () => {
      window.removeEventListener('keydown', listen, true);
      const at = open.indexOf(me);
      if (at >= 0) open.splice(at, 1);
    };
  }, [box]);
}

/** The choice a number key picks (1 is the first), or undefined. */
export function choiceForKey<T>(key: string, choices: readonly T[] | undefined): T | undefined {
  return choices && /^[1-9]$/.test(key) ? choices[Number(key) - 1] : undefined;
}
