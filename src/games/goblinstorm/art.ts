/**
 * Goblin Storm's painted pictures (docs/GOBLINSTORM-ART-PLAN.md, tidied by scripts/game_art.py into ./art/paint/). Found
 * by file name: only their addresses are bundled, the pictures download when first shown. A picture that is missing or
 * still downloading gives nothing back, and the game keeps drawing its stand-in (look.ts, renderer.ts), so every
 * picture is optional.
 */
const FILES = import.meta.glob('./art/paint/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** The address of a painted picture, e.g. `monsters/castle/goblin`, or undefined if it isn't painted. */
export const paint = (path: string): string | undefined => FILES[`./art/paint/${path}.webp`];

const images = new Map<string, HTMLImageElement | null>();
let loaded = 0;

/** Bumps each time a painted picture finishes downloading, so the canvas knows to rebuild its stamps. */
export const paintedCount = (): number => loaded;

/**
 * A painted picture ready to draw on the canvas, or null while it downloads (or if it isn't painted). Starts the
 * download the first time it is asked for.
 */
export function paintedImage(path: string): HTMLImageElement | null {
  const known = images.get(path);
  if (known !== undefined) return known && known.complete && known.naturalWidth > 0 ? known : null;
  const url = paint(path);
  if (!url || typeof Image !== 'function') {
    images.set(path, null);
    return null;
  }
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => { loaded++; };
  img.onerror = () => { images.set(path, null); };
  img.src = url;
  images.set(path, img);
  return null;
}

export const heroArt = (hero: string, pose: 'stand' | 'hurt') => `heroes/${hero}-${pose}`;
export const monsterArt = (map: string, monster: string) => `monsters/${map}/${monster}`;
export const groundArt = (map: string) => `ground/${map}`;
