/** The 101 settings a student last picked, remembered on this device. */
import type { Target } from '../../../shared/card101/engine';

export interface Card101Prefs {
  /** 1 to 3 bots. */
  bots: 1 | 2 | 3;
  /** 101, or 50 for a Quick game. */
  target: Target;
}

export const DEFAULT_PREFS: Card101Prefs = { bots: 2, target: 101 };

const KEY = 'sgh-101-prefs';

export function loadPrefs(): Card101Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Card101Prefs> | null;
    return {
      bots: saved?.bots === 1 || saved?.bots === 2 || saved?.bots === 3 ? saved.bots : DEFAULT_PREFS.bots,
      target: saved?.target === 50 ? 50 : 101,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Card101Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Private window or storage blocked: the settings just aren't remembered.
  }
}
