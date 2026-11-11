/**
 * Remembers the signed-in person's settings row for 5 minutes, so the game switches cost one request instead of one per
 * switch per page. Callers asking at the same moment share the one request, and a failed read is not remembered.
 *
 * It is forgotten on sign-out (or when someone else signs in), when the tab comes back after being hidden for more than
 * 5 minutes, and straight after a teacher changes a setting from this device. The server still checks every switch
 * itself; this only decides what the screen shows.
 *
 * This file imports nothing, so the test setup can forget the row between tests without loading Supabase.
 */
export type SettingsRow = Record<string, unknown>;

export const SETTINGS_KEEP_MS = 5 * 60 * 1000;
/** The pupil's home page wants a fresher row than other pages: it re-reads when the remembered one is older than this. */
export const FRESH_HOME_MS = 30_000;

let kept: { row: SettingsRow; at: number } | null = null;
let pending: Promise<SettingsRow | null> | null = null;
// Goes up each time the row is forgotten, so a read that was already on its way can't put an old row back.
let generation = 0;
let hiddenAt: number | null = null;
let watching = false;

function watchTab() {
  if (watching || typeof document === 'undefined') return;
  watching = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
    } else {
      if (hiddenAt !== null && Date.now() - hiddenAt > SETTINGS_KEEP_MS) forgetSettings();
      hiddenAt = null;
    }
  });
}

/** The remembered row if it is younger than `maxAgeMs` (5 minutes unless said); otherwise `read` is called (once, however many callers ask). */
export function rememberedSettings(
  read: () => Promise<SettingsRow | null>,
  maxAgeMs: number = SETTINGS_KEEP_MS,
): Promise<SettingsRow | null> {
  watchTab();
  if (kept && Date.now() - kept.at < maxAgeMs) return Promise.resolve(kept.row);
  if (pending) return pending;
  const mine = generation;
  const request = read().then(
    (row) => {
      if (mine === generation) {
        pending = null;
        if (row) kept = { row, at: Date.now() };
      }
      return row;
    },
    (error: unknown) => {
      if (mine === generation) pending = null;
      throw error;
    },
  );
  pending = request;
  return request;
}

export function forgetSettings(): void {
  generation += 1;
  kept = null;
  pending = null;
  for (const listener of forgotten) listener();
}

/** Called whenever the remembered row is forgotten (a teacher saved something): lets "Changed by…" lines read again. */
const forgotten = new Set<() => void>();
export function onSettingsForgotten(listener: () => void): () => void {
  forgotten.add(listener);
  return () => void forgotten.delete(listener);
}

/** Forgets the remembered row only if it is older than `maxAgeMs` (the home page uses FRESH_HOME_MS). Returns whether it did. */
export function forgetSettingsOlderThan(maxAgeMs: number): boolean {
  if (!kept || Date.now() - kept.at < maxAgeMs) return false;
  forgetSettings();
  return true;
}

/**
 * Puts a freshly read row in place of the remembered one. Returns true only if a value differs, so the caller can leave the
 * screen alone when nothing changed (the remembered row is still marked as just read).
 */
export function replaceSettingsIfChanged(row: SettingsRow): boolean {
  const changed = !kept || JSON.stringify(kept.row) !== JSON.stringify(row);
  if (changed) generation += 1;
  pending = null;
  kept = { row, at: Date.now() };
  return changed;
}
