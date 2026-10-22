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

/** The remembered row if it is less than 5 minutes old; otherwise `read` is called (once, however many callers ask). */
export function rememberedSettings(read: () => Promise<SettingsRow | null>): Promise<SettingsRow | null> {
  watchTab();
  if (kept && Date.now() - kept.at < SETTINGS_KEEP_MS) return Promise.resolve(kept.row);
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
}
