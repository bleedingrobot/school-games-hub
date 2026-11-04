/**
 * The Star Forge's painted pictures (docs/TRADER-SYSTEM-ART-PLAN.md), by the names in ./viewer/types.ts. Every picture is
 * optional: when a file isn't there the viewer draws its own in code, so each lookup gives a URL or null.
 *
 * Files live in ./art/paint/<group>/<name>.webp. Vite turns each into its own URL; nothing downloads until the viewer
 * asks for it. The big "-hd" copies are only picked on the 'incredible' level, so a Chromebook never downloads them.
 */
import type { CloudKind, PlanetKind, RingKind, SunKind } from '../../../../shared/trader/system';
import type { GraphicsLevel } from './viewer/types';

const FILES = import.meta.glob('./art/paint/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const file = (name: string): string | null => FILES[`./art/paint/${name}.webp`] ?? null;

/** A picture by its path inside paint/ without ".webp" ("planets/ocean-2"), the -hd copy on 'incredible' when there is one. */
export function forgeArt(name: string, level: GraphicsLevel = 'normal'): string | null {
  return (level === 'incredible' ? file(`${name}-hd`) : null) ?? file(name);
}

/** A planet's surface map (2:1), by its kind and painted surface (0 to SURFACES - 1). */
export const planetArt = (kind: PlanetKind, surface: number, level?: GraphicsLevel) => forgeArt(`planets/${kind}-${surface}`, level);
/** The bump (normal) map painted for the same surface. */
export const planetNormalArt = (kind: PlanetKind, surface: number, level?: GraphicsLevel) => forgeArt(`planets/${kind}-${surface}-normal`, level);
/** Lights that show on the night side (cities, lava). */
export const nightArt = (kind: PlanetKind) => forgeArt(`night/${kind}`);
export const cloudArt = (kind: CloudKind, level?: GraphicsLevel) => (kind === 'none' ? null : forgeArt(`clouds/${kind}`, level));
export const sunArt = (kind: SunKind) => forgeArt(`suns/${kind}`);
/** A ring's strip: across the picture is from the inside edge to the outside edge. */
export const ringArt = (kind: RingKind) => forgeArt(`rings/${kind}`);
export const moonArt = (look: number) => forgeArt(`moons/${look}`);
/** The all-round sky behind the system (2:1 panorama). */
export const skyArt = (background: number, level?: GraphicsLevel) => forgeArt(`skies/${background}`, level);
export const techArt = (name: string) => forgeArt(`tech/${name}`);
export const postcardArt = (life: string, creature: number) => forgeArt(`postcards/${life}-${creature}`);
export const buttonArt = (group: string, key: string) => forgeArt(`buttons/${group}-${key}`);

/** Every painted file there is (for an art test). */
export const allForgeArt = (): string[] => Object.keys(FILES);
