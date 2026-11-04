/**
 * The captains' portraits (painted on James's PC by scripts/trader-captains-art-gen.py, tidied to 256 px WebP by
 * scripts/trader-captains-art.py). Vite gives each its own URL, so a portrait downloads only when it is shown.
 */
const FILES = import.meta.glob('./captains/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** A captain's portrait by key ("m01" … "f20"); undefined if there is no picture for it. */
export const captainArt = (id: string): string | undefined => FILES[`./captains/${id}.webp`];
