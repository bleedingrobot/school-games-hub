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

/** Starts downloading pictures before a screen needs them. */
export function preload(...urls: (string | undefined)[]) {
  for (const url of urls) if (url) new Image().src = url;
}

/** Every file the game could use, for the art test. */
export function allPaintFiles(): string[] {
  return Object.keys(FILES);
}
