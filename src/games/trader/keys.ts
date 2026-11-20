/**
 * Keyboard shortcuts for Star Trader (James, 20 Nov 2026), like Sky Isles': Enter moves the turn on (Jump!, Steer
 * through, Carry on) and a letter for each main button. A key only presses a button already on screen and not greyed out,
 * so it can never do more than a tap could.
 */
import { useEffect, type RefObject } from 'react';
import { useKeyLabels } from '../../kit/keyLabels';

/** What each key presses: the first matching button on screen that isn't disabled. */
export const KEYS: Record<string, string> = {
  enter: '[data-key~="go"]',
  t: '[data-coach="tab-trade"]',
  s: '[data-coach="tab-ship"]',
  b: '[data-coach="tab-bank"]',
  m: '[data-coach="tab-map"]',
  j: '[data-coach="tab-map"]',
  f: '[data-coach="tab-forge"]',
  g: '[data-coach="tab-gallery"]',
  h: '[data-coach="help"]',
  y: '[data-key~="yes"]',
  n: '[data-key~="no"]',
  '1': '[data-coach="fight-charge"]',
  '2': '[data-coach="fight-shield"]',
  '3': '[data-coach="fight-flee"]',
};

/** The shortcuts in words, for Bolt's help. */
export const KEY_HELP: [string, string][] = [
  ['Enter', 'Jump! (or Steer through, Carry on). Works straight from the x and y boxes too.'],
  ['T, S, B', 'Trade, Ship, Bank'],
  ['M or J', 'Star chart, to plan a jump'],
  ['F, G', 'Forge, Gallery (once they are open)'],
  ['1, 2, 3', 'In a pirate fight: Charge, Shields, Flee'],
  ['Y, N', 'Take the deal, No thanks'],
  ['H', `Help`],
];

/** The button a key means right now inside `root` (null: none). */
export function buttonFor(root: ParentNode, key: string): HTMLButtonElement | null {
  const selector = KEYS[key.toLowerCase()];
  if (!selector) return null;
  for (const el of root.querySelectorAll<HTMLButtonElement>(selector)) {
    if (el.tagName === 'BUTTON' && !el.disabled) return el;
  }
  return null;
}

function typing(el: EventTarget | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** Listens for the shortcuts while `on`. Off while a maths question or other pop-up covers the game. */
export function useTraderKeys(root: RefObject<HTMLElement | null>, on: boolean) {
  useKeyLabels(root, KEYS, on);
  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const box = root.current;
      if (!box) return;
      if (typing(e.target)) {
        // Typing x and y, Enter jumps; any other typing is left alone.
        if (e.key !== 'Enter' || !e.target.closest('.st-jumpbox')) return;
      } else if (e.key === 'Enter' && e.target instanceof HTMLElement && e.target.closest('button, a, summary')) {
        return; // Enter on a focused button already presses that button.
      }
      const el = buttonFor(box, e.key);
      if (!el) return;
      e.preventDefault();
      el.click();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [root, on]);
}
