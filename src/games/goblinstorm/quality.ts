/**
 * The effects setting, High or Low, kept on this device only (like the sound setting). Low draws fewer particles and
 * no soft glows. Either way the play screen drops to low by itself while frames are slow. Drawing only: the run is
 * the same whatever this says.
 */
export type Quality = 'high' | 'low';

const KEY = 'goblinstorm-effects';

export function readQuality(): Quality {
  try {
    return localStorage.getItem(KEY) === 'low' ? 'low' : 'high';
  } catch {
    return 'high';
  }
}

export function saveQuality(q: Quality): void {
  try {
    localStorage.setItem(KEY, q);
  } catch {
    // Not remembered on this device; that's fine.
  }
}

/** Seen the map screen's first-time tips on this device. */
const TIPS_KEY = 'goblinstorm-tips-seen';
export function tipsSeen(): boolean {
  try {
    return localStorage.getItem(TIPS_KEY) === '1';
  } catch {
    return false;
  }
}
export function setTipsSeen(): void {
  try {
    localStorage.setItem(TIPS_KEY, '1');
  } catch {
    // Not remembered; the tips show again next time.
  }
}
