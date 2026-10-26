/**
 * Single-letter keys (F for the forest, A to attack...) can be switched off, because screen-reader and voice-control
 * users can press them by accident. On by default. The choice is kept on this browser only.
 */
const KEY = 'dragon-maths-letter-keys';

export function shortcutsOn(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setShortcuts(on: boolean) {
  try {
    window.localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // Storage blocked: the keys just stay on.
  }
}
