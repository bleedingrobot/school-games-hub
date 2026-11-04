/**
 * Each publish gives the game files new names and removes the old ones. A tab opened before the publish still asks
 * for the old names when a student opens a game, so the browser says "Failed to fetch dynamically imported module".
 * When that happens we reload the page once to get the new version. The reload adds `?fresh=<time>` so the browser
 * can't hand back its cached copy of the old page, and the mark is tidied away again once the page starts.
 * A short guard stops it looping if the file really is missing.
 */
const KEY = 'fresh-reload-at';
const GUARD_MS = 60_000;
let reloading = false;

/** True once a fresh reload has started, so the crash screen can say so instead of showing an error. */
export function isReloading(): boolean {
  return reloading;
}

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading (CSS )?chunk .* failed/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return CHUNK_ERROR.test(text);
}

/** The page address with a fresh mark, so the reload skips the browser's cached page. */
export function freshUrl(loc: Pick<Location, 'pathname' | 'search' | 'hash'>, now = Date.now()): string {
  const params = new URLSearchParams(loc.search);
  params.set('fresh', String(now));
  return `${loc.pathname}?${params.toString()}${loc.hash}`;
}

/** Load the newest version of the site now. */
export function reloadFresh(): void {
  reloading = true;
  window.location.replace(freshUrl(window.location));
}

/** Reload once for a missing game file. Returns false (and does nothing) if we already tried in the last minute. */
export function reloadForNewVersion(now = Date.now(), go: () => void = reloadFresh): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (now - last < GUARD_MS) return false;
    sessionStorage.setItem(KEY, String(now));
  } catch {
    return false; // no storage means no guard, so don't risk a loop
  }
  go();
  return true;
}

/** Take the `fresh` mark back out of the address bar after a fresh reload. */
export function tidyFreshMark(): void {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('fresh')) return;
  params.delete('fresh');
  const search = params.toString();
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`);
}

/** Catch missing files that Vite sees outside a page draw too (e.g. teacher summaries loaded on demand). */
export function startFreshLoad(): void {
  tidyFreshMark();
  window.addEventListener('vite:preloadError', () => {
    reloadForNewVersion();
  });
}
