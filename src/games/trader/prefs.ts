/** Star Trader's picture settings, kept on this device (never on the server). */
const KEY = 'sgh-trader-prefs';

export interface TraderPrefs {
  /** "Less motion": still planets, no shaking, short effects. Follows the device unless the pupil chose. */
  lessMotion: boolean | null;
  simple: boolean;
}

export function loadPrefs(): TraderPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<TraderPrefs> | null;
    return { lessMotion: typeof raw?.lessMotion === 'boolean' ? raw.lessMotion : null, simple: raw?.simple === true };
  } catch {
    return { lessMotion: null, simple: false };
  }
}

export function savePrefs(p: TraderPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Not remembered, that's all.
  }
}

export function wantsLessMotion(p: TraderPrefs): boolean {
  if (p.lessMotion !== null) return p.lessMotion;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
