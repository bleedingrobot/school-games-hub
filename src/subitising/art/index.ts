/**
 * Quick looks painted art, found by name. Until a picture is in this folder the code draws a stand-in, so
 * each painting improves the page with no code change. See README.md for the names.
 */
const FILES = import.meta.glob('./*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export type ArtName = 'garden-scene' | 'bed' | 'friend-happy' | 'friend-calm' | `plant-${1 | 2 | 3 | 4 | 5 | 6 | 7}-${0 | 1 | 2 | 3 | 4}`;

/** Phones and small Chromebooks get the `-small` copy when there is one. */
function narrowScreen(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 700px)').matches;
  } catch {
    return false;
  }
}

/** The URL of a painted picture, or null when it has not been painted yet. */
export function artUrl(name: ArtName, narrow: boolean = narrowScreen()): string | null {
  if (narrow) {
    const small = FILES[`./${name}-small.webp`];
    if (small) return small;
  }
  return FILES[`./${name}.webp`] ?? null;
}
