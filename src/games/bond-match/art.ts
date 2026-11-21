/**
 * The painted pictures (scripts/game_art.py bond-match, tidied into ./art/paint/; list in docs/bond-match-art/config.json).
 * Anything not painted yet finds nothing here and keeps its CSS look, so the game works either way. Only the pictures'
 * addresses are bundled; the pictures themselves download when shown. Copied from Korora (src/games/korora/art.ts).
 */
const FILES = import.meta.glob('./art/paint/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export const paint = (path: string): string | undefined => FILES[`./art/paint/${path}.webp`];

/** A painted place (back-beach, back-pool-day...): the 1600 px picture, with the 800 px copy for phones. */
export interface Scene {
  src: string;
  srcSet?: string;
}

export function scene(name: 'beach' | 'pool-day' | 'pool-evening' | 'sunset'): Scene | undefined {
  const big = paint(`back/${name}`);
  if (!big) return undefined;
  const small = paint(`back/${name}-800`);
  return { src: big, srcSet: small ? `${small} 800w, ${big} 1600w` : undefined };
}
