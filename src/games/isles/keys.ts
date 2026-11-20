/**
 * Keyboard shortcuts for Sky Isles (James, 20 Nov 2026): Enter moves a turn on, B goes to building, and a letter for
 * each main button. Each key just presses the button already on screen (found by its data-pip or data-key), so a key
 * can only do what a tap could, and a greyed-out button stays greyed out.
 */
import { useEffect, type RefObject } from 'react';
import { useKeyLabels } from '../../kit/keyLabels';

/** What each key presses: the first button on screen that matches and isn't disabled. */
export const KEYS: Record<string, string> = {
  // Play a turn, Next, Done building, End turn.
  enter: '[data-pip="play"], [data-pip="next"], [data-pip="end-turn"]',
  b: '[data-key~="b"]',
  escape: '[data-key~="esc"]',
  u: '[data-pip="upgrade"]',
  a: '[data-pip="drift"]',
  d: '[data-pip="decorate"]',
  l: '[data-pip="lighthouse"]',
  r: '[data-pip="race"]',
  z: '[data-key~="undo"]',
  c: '[data-key~="sky"]',
  h: '[data-key~="howto"]',
};

/** The shortcuts in words, for How to play. */
export const KEY_HELP: [string, string][] = [
  ['Enter', 'Play a turn, Next, Done building or End turn'],
  ['B', 'Go to building (or back to the island while building)'],
  ['1 to 9', 'Pick a building spot while building'],
  ['U, A, D, L', 'Upgrade, Anchor land, Decorate, Lighthouse'],
  ['Z', 'Undo the last thing built'],
  ['R', 'Sky Race'],
  ['C, H', 'Class sky, How to play'],
  ['Esc', 'Back to the island while building'],
];

/** The button a key means right now inside `root` (null: none). */
export function buttonFor(root: ParentNode, key: string): HTMLButtonElement | null {
  const k = key.toLowerCase();
  const selector = /^[1-9]$/.test(k) ? `[data-pip="spot-${Number(k) - 1}"]` : KEYS[k];
  if (!selector) return null;
  for (const el of root.querySelectorAll<HTMLButtonElement>(selector)) {
    if (el.tagName === 'BUTTON' && !el.disabled) return el;
  }
  return null;
}

function typing(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** Listens for the shortcuts while `on` (off while the question is open or a pop-up is showing). */
/** Every key with the buttons it presses, for the labels on the buttons. */
const LABELLED: Record<string, string> = { ...KEYS,
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [String(n), `[data-pip="spot-${n - 1}"]`])), };

export function useIslesKeys(root: RefObject<HTMLElement | null>, on: boolean) {
  useKeyLabels(root, LABELLED, on);
  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      // Enter on a focused button already presses that button.
      if (e.key === 'Enter' && e.target instanceof HTMLElement && e.target.closest('button, a')) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const el = root.current && buttonFor(root.current, e.key);
      if (!el) return;
      e.preventDefault();
      el.click();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [root, on]);
}
