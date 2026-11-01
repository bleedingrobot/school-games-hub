/** Diamond Drop's picture settings, kept on this device (never on the server). */
const KEY = 'sgh-diamond-prefs';

export interface DiamondPrefs {
  /** "Less motion": no shaking, sparkles or swaying background; trails and catch effects become a small still glow. Follows the device unless the pupil chose. */
  lessMotion: boolean | null;
  /**
   * "Slower game": the whole level runs at two thirds of the speed (20 steps a second instead of 30). The swing, the
   * claw and the clock all slow together, so the rules and the server's replay (which count steps, not seconds) are
   * exactly the same: it only gives more real time to aim.
   */
  slower: boolean;
}

export function loadPrefs(): DiamondPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<DiamondPrefs> | null;
    return { lessMotion: typeof raw?.lessMotion === 'boolean' ? raw.lessMotion : null, slower: raw?.slower === true };
  } catch {
    return { lessMotion: null, slower: false };
  }
}

export function savePrefs(p: DiamondPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Not remembered, that's all.
  }
}

export function wantsLessMotion(p: DiamondPrefs): boolean {
  if (p.lessMotion !== null) return p.lessMotion;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Steps a second for the screen's clock (the rules always count TICKS_PER_SECOND steps as one game second). */
export const stepsPerSecond = (p: DiamondPrefs) => (p.slower ? 20 : 30);
