/**
 * Mine Runner's painted pictures (painted in ComfyUI on James's PC from docs/mine-art/config.json, see
 * docs/MINE-ART-PLAN.md). Every picture is optional: each function gives undefined when there's no painting, and the
 * game then uses its code colours, so nothing ever breaks. Vite turns each file into its own URL, downloaded only when used.
 *
 * Layout:
 *   rock/<1-6>.webp   1024 x 1024 seamless rock, one per mine (greenstone, gold diggings, gold tunnel, coal, glow-worm caves, volcanic)
 */
const FILES = import.meta.glob('./**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** The painted rock for a mine (1 to 6), or undefined. */
export function rockArt(mine: number): string | undefined {
  return FILES[`./rock/${mine}.webp`];
}
