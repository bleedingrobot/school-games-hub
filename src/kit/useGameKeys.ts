/**
 * Keyboard keys for any game (James, 20 Nov 2026; docs/plans/game-keys/PLAN.md). The game marks its buttons with
 * `data-key` and calls `useGameKeys(rootRef)`; a key just presses the button already on screen, so it can only do what a
 * tap could, and a greyed-out or hidden button stays untouched.
 *
 * The same keys in every game:
 *   Enter   the main "go on" button: Start, Play, Next, Continue, Play again, Done   (data-key="enter")
 *   1 to 9  the 1st to 9th choice in a row of choices (cards, heroes, maps, modes)    (data-key="1" ... "9")
 *   Esc     Back, Close, Not now                                                       (data-key="esc")
 * A button can take more than one (`data-key="enter 1"`). Letters are allowed (`data-key="s"`) where a game wants them.
 */
import { useEffect, type RefObject } from 'react';

/** Keys pressed this soon after the last one are ignored, so one press can't run through two screens. */
export const KEY_GAP_MS = 350;

/** The `data-key` word for a key press (null: not one of ours). */
export function keyWord(key: string): string | null {
  if (key === 'Enter') return 'enter';
  if (key === 'Escape') return 'esc';
  if (/^[1-9]$/.test(key)) return key;
  if (/^[a-zA-Z]$/.test(key)) return key.toLowerCase();
  return null;
}

function shown(el: HTMLElement): boolean {
  // jsdom (the tests) lays nothing out, so every element there counts as shown.
  return el.getClientRects().length > 0 || import.meta.env.MODE === 'test';
}

/** The button a key means right now inside `root` (null: none). Inside an open pop-up only that pop-up's buttons count. */
export function buttonForKey(root: Element, key: string): HTMLButtonElement | null {
  const word = keyWord(key);
  if (!word) return null;
  const modals = [...document.querySelectorAll('[aria-modal="true"]')];
  const inner = modals.find((m) => root.contains(m));
  if (modals.length && !inner) return null; // a pop-up from outside the game (the maths question) is open
  const scope: Element = inner ?? root;
  for (const el of scope.querySelectorAll<HTMLButtonElement>(`button[data-key~="${word}"]`)) {
    if (!el.disabled && el.getAttribute('aria-disabled') !== 'true' && shown(el)) return el;
  }
  return null;
}

function typing(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** Listens for the keys while `on` (turn it off while the game's own keys are in charge, such as during play). */
export function useGameKeys(root: RefObject<HTMLElement | null>, on = true) {
  useEffect(() => {
    if (!on) return;
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      // Enter on a focused button already presses that button.
      if (e.key === 'Enter' && e.target instanceof HTMLElement && e.target.closest('button, a')) return;
      if (!root.current) return;
      const el = buttonForKey(root.current, e.key);
      if (!el) return;
      e.preventDefault();
      const now = performance.now();
      if (now - last < KEY_GAP_MS) return;
      last = now;
      el.click();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [root, on]);
}
