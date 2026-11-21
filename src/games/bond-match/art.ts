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

/** The sea-glass back for a board: teal for whole numbers, blue for decimals, violet for fractions (tinted by tidy). */
export type Glass = 'teal' | 'blue' | 'violet';
export const cardBack = (glass: Glass): string | undefined =>
  paint(glass === 'teal' ? 'cards/card-back' : `cards/card-back-${glass}`);
export const cardStone = (): string | undefined => paint('cards/card-stone');
/** The glow pictures for a match (light on see-through, painted on black and unscreened by tidy). */
export const fx = (name: 'ripple' | 'sparkle'): string | undefined => paint(`fx/${name}`);

/** The finish starfish: gold painted, silver and bronze tinted from it by tidy. */
export type Medal = 'gold' | 'silver' | 'bronze';
export const starfish = (medal: Medal): string | undefined => paint(`rewards/starfish-${medal}`);
/** A player's shell bucket on the versus finish. */
export const bucket = (): string | undefined => paint('rewards/bucket');

/** Pip the crab, the helper and the computer player: waving, cheering or thinking. */
export type PipPose = 'wave' | 'cheer' | 'think';
export const pip = (pose: PipPose): string | undefined => paint(`pip/pip-${pose}`);
/** A player's shell badge: pink for player 1 (or you), blue for player 2. */
export const shell = (colour: 'pink' | 'blue'): string | undefined => paint(`players/shell-${colour}`);
