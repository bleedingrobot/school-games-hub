/**
 * Key labels on buttons (James, 21 Nov 2026): a small "Enter", "Esc" or "T" after a button's words, so pupils can see
 * which key presses it. Works for any game's own key list: `keys` maps a key to the CSS selector of the buttons it
 * presses (the same shape as Sky Isles' and Star Trader's KEYS). The label is set as `data-key-label` and drawn by
 * styles.css only while the game's keys are on (`data-keys-on` on the root) and never on touch-only screens.
 * Buttons that already show a number badge (`KeyBadge`) are left alone.
 */
import { useEffect, type RefObject } from 'react';

/** The words on the label for a key. */
export function labelFor(key: string): string {
  const k = key.toLowerCase();
  if (k === 'enter') return 'Enter';
  if (k === 'escape' || k === 'esc') return 'Esc';
  return k.length === 1 ? k.toUpperCase() : key;
}

function setLabel(el: Element, label: string) {
  if (el.getAttribute('data-key-label') !== label) el.setAttribute('data-key-label', label);
}

/**
 * Puts the labels on. With no `keys`, it reads each button's own `data-key` (the kit's way): the first letter, Enter or
 * Esc in it. Number keys are skipped, as those buttons show a `KeyBadge`. With `keys`, the first key listed wins.
 */
export function labelButtons(box: Element, keys?: Record<string, string>) {
  if (!keys) {
    for (const el of box.querySelectorAll('button[data-key]')) {
      const key = (el.getAttribute('data-key') ?? '').split(/\s+/).find((k) => k && !/^\d$/.test(k));
      if (key && !el.querySelector('.kit-key')) setLabel(el, labelFor(key));
    }
    return;
  }
  const done = new Set<Element>();
  for (const [key, selector] of Object.entries(keys)) {
    for (const el of box.querySelectorAll(selector)) {
      if (el.tagName !== 'BUTTON' || done.has(el) || el.querySelector('.kit-key')) continue;
      done.add(el);
      setLabel(el, labelFor(key));
    }
  }
}

/** Labels now, then again after the screen changes (once per batch of changes, so busy games stay quick). */
export function useKeyLabels(root: RefObject<HTMLElement | null>, keys: Record<string, string> | undefined, on: boolean) {
  useEffect(() => {
    const box = root.current;
    if (!box || !on) return;
    box.setAttribute('data-keys-on', '');
    labelButtons(box, keys);
    let queued = false;
    let live = true;
    const watch = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        if (live) labelButtons(box, keys);
      });
    });
    watch.observe(box, { childList: true, subtree: true });
    return () => {
      live = false;
      watch.disconnect();
      box.removeAttribute('data-keys-on');
    };
  }, [root, keys, on]);
}
