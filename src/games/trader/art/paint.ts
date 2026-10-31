/**
 * The painted pictures (made by James with Z-Image Turbo in ComfyUI, tidied by scripts/trader-art.py, see
 * docs/TRADER-ART-PLAN.md). Every picture is optional: when a file isn't there yet, the game draws what it drew before
 * (art/planets.ts, art/ships.ts), so nothing breaks while pictures arrive one screen at a time.
 *
 * Files live in ./paint/<group>/<name>.webp. Vite turns each one into its own URL, and the browser only downloads a
 * picture when a screen shows it.
 */
import { PIRATE_TIERS } from '../../../../shared/trader/config';

const FILES = import.meta.glob('./paint/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** "Your moon" → "your-moon". The same rule names the files the script writes. */
export const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const file = (group: string, name: string): string | undefined => FILES[`./paint/${group}/${name}.webp`];

/** The name of the moon you buy, as its painting is called. */
export const MOON = 'Your moon';

/**
 * A planet's flat surface map, to wrap round a ball (2:1, left and right edges already blended). By the planet's name
 * ("Io") or MOON. `small` is the 256 × 128 copy for the star chart and cards.
 */
export const planetMap = (name: string, small?: boolean) => (small && file('planets', `${slug(name)}-small`)) || file('planets', slug(name));

/** A trader ship by its name in SHIPS ("Beetle"), side-on facing right and cut out. `card` is the 160 px copy for the shipyard. */
export const shipArt = (name: string, card?: boolean) => (card && file('ships', `${slug(name)}-card`)) || file('ships', slug(name));

/** The painting for each pirate in PIRATE_TIERS, in the same order. */
export const PIRATE_ART = ['pirate-scrappy', 'pirate-raider', 'pirate-captain'] as const;

/** A pirate by its tier (0 scrappy … 2 captain), side-on facing right and cut out. `card` is the 160 px copy. */
export function pirateArt(tier: number, card?: boolean): string | undefined {
  const name = PIRATE_ART[tier];
  if (!name || tier >= PIRATE_TIERS.length) return undefined;
  return (card && file('ships', `${name}-card`)) || file('ships', name);
}

/** A painting that has downloaded, with its pixels for code that reads them (the turning globe). */
export interface Painting {
  img: HTMLImageElement;
  w: number;
  h: number;
  /** RGBA, one 32-bit number per pixel, row by row. */
  pixels: Uint32Array;
}

// Only the last few paintings keep their pixels (a full planet map is 2 MB of them); older ones download again if needed.
const KEEP = 6;
const paintings = new Map<string, Painting | null>();
const loading = new Map<string, Promise<Painting | null>>();

/** Downloads a painting and reads its pixels. Null when it can't be read (missing, or no canvas), so the drawn version stays. */
export function loadPainting(url: string): Promise<Painting | null> {
  const known = paintings.get(url);
  if (known !== undefined) return Promise.resolve(known);
  let p = loading.get(url);
  if (!p) {
    p = new Promise<Painting | null>((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const g = c.getContext('2d', { willReadFrequently: true });
          if (!g) throw new Error('no canvas');
          g.drawImage(img, 0, 0);
          const data = g.getImageData(0, 0, c.width, c.height).data;
          resolve({ img, w: c.width, h: c.height, pixels: new Uint32Array(data.buffer, data.byteOffset, data.byteLength / 4) });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    }).then((painting) => {
      loading.delete(url);
      paintings.set(url, painting);
      while (paintings.size > KEEP) paintings.delete(paintings.keys().next().value as string);
      return painting;
    });
    loading.set(url, p);
  }
  return p;
}

/** The painting if it has downloaded; otherwise starts the download and gives undefined (draw the old way this frame). */
export function paintingNow(url: string | undefined): Painting | undefined {
  if (!url) return undefined;
  const known = paintings.get(url);
  if (known === undefined) void loadPainting(url);
  return known ?? undefined;
}

/** Starts downloading pictures before a screen needs them. */
export function preload(...urls: (string | undefined)[]) {
  for (const url of urls) if (url) new Image().src = url;
}

/** Every file the game could use, for the art test. */
export function allPaintFiles(): string[] {
  return Object.keys(FILES);
}
