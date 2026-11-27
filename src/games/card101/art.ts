/**
 * The painted pictures (scripts/game_art.py 101, tidied into ./art/paint/; list in docs/101-art/config.json, plan in
 * docs/101-ART-PLAN.md). Anything not painted yet finds nothing here and keeps its drawn look, so the game works either
 * way. Only the pictures' addresses are bundled; the pictures download when shown. Copied from Bond Match's art.ts.
 *
 * Three of Bond Match's painted pictures are borrowed as they are (read only, never changed here): the sea-glass tile
 * and Pip the crab for two card backs, and the sparkle for a round win.
 */
import seaGlassUrl from '../bond-match/art/paint/cards/card-back.webp?url';
import pipUrl from '../bond-match/art/paint/pip/pip-wave.webp?url';
import sparkleUrl from '../bond-match/art/paint/fx/sparkle.webp?url';

const FILES = import.meta.glob('./art/paint/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export const paint = (path: string): string | undefined => FILES[`./art/paint/${path}.webp`];

/** A painted place: the 1600 px picture, with the 800 px copy for phones. */
export interface Scene {
  src: string;
  srcSet?: string;
}

export function scene(name: 'bach-day' | 'bach-evening'): Scene | undefined {
  const big = paint(`back/${name}`);
  if (!big) return undefined;
  const small = paint(`back/${name}-800`);
  return { src: big, srcSet: small ? `${small} 800w, ${big} 1600w` : undefined };
}

/** The table's wood and the felt mat (tiling textures). */
export const texture = (name: 'wood' | 'felt'): string | undefined => paint(`table/${name}`);
/** A painted card back (the art inside the white frame). */
export const backPicture = (name: string): string | undefined => paint(`backs/${name}`);
/** A bot's bird portrait. */
export const bird = (name: 'kea' | 'tui' | 'weka'): string | undefined => paint(`birds/${name}`);
export const trophy = (medal: 'gold' | 'silver' | 'bronze'): string | undefined => paint(`rewards/trophy-${medal}`);
export const knockBurst = (): string | undefined => paint('fx/knock-burst');

/** Borrowed from Bond Match. */
export const BORROWED = { seaGlass: seaGlassUrl, pip: pipUrl, sparkle: sparkleUrl } as const;
