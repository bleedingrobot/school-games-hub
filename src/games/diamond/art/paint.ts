/**
 * James's paintings (made in ComfyUI on his gaming PC, tidied by `scripts/diamond-art.py tidy`, see
 * docs/DIAMOND-ART-PLAN.md). Every picture is optional: until a file has downloaded, or when there isn't one, the drawn
 * version in draw.ts shows, so nothing ever breaks.
 *
 * Files live in ./paint/<folder>/<name>.webp, named by the game's own ids. Vite turns each into its own URL, and the
 * browser only downloads a picture when something draws it.
 */
const FILES = import.meta.glob('./paint/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** The URL of a painting, or undefined when there isn't one. */
export const paintFile = (folder: string, name: string): string | undefined => FILES[`./paint/${folder}/${name}.webp`];

const images = new Map<string, HTMLImageElement>();
const listeners = new Set<() => void>();

/** A painting ready to draw, or undefined (starting the download) so the caller draws the old way this time. */
export function paintNow(folder: string, name: string | undefined): HTMLImageElement | undefined {
  const url = name ? paintFile(folder, name) : undefined;
  if (!url || typeof Image === 'undefined') return undefined;
  let img = images.get(url);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.onload = () => listeners.forEach((f) => f());
    img.src = url;
    images.set(url, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : undefined;
}

/** Calls `f` each time a painting finishes downloading, so still pictures can draw again. Gives the way to stop. */
export function onPainting(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/**
 * Draws a cut-out painting centred on (x, y), fitted inside a `w` × `h` box and keeping its shape. Gives false (drawing
 * nothing) when the painting isn't ready.
 */
export function drawPainting(ctx: CanvasRenderingContext2D, img: HTMLImageElement | undefined, x: number, y: number, w: number, h = w): boolean {
  if (!img) return false;
  const k = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
  ctx.drawImage(img, x - dw / 2, y - dh / 2, dw, dh);
  return true;
}

/** Every painting file, for the art test. */
export function allPaintFiles(): string[] {
  return Object.keys(FILES);
}
