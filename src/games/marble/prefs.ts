/**
 * A student's Marble Rush choices, kept on this device (one set per student, as the school's devices are shared):
 * whether they want maths when the teacher lets them choose, and whether the game waits for them to read a gate.
 */
export interface MarblePrefs {
  maths: boolean;
  /** Pause when a gate's question comes into view, until they press Go (up to 10 seconds). */
  readTime: boolean;
}

export const DEFAULT_PREFS: MarblePrefs = { maths: true, readTime: true };

const keyFor = (player?: string) => `marble-rush-prefs-v1${player ? `:${player}` : ''}`;

export function loadPrefs(player?: string): MarblePrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(player)) ?? '{}') as Record<string, unknown>;
    return {
      maths: typeof raw.maths === 'boolean' ? raw.maths : DEFAULT_PREFS.maths,
      readTime: typeof raw.readTime === 'boolean' ? raw.readTime : DEFAULT_PREFS.readTime,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: MarblePrefs, player?: string): void {
  try {
    localStorage.setItem(keyFor(player), JSON.stringify(prefs));
  } catch {
    // Storage blocked: the choice just won't be remembered.
  }
}
