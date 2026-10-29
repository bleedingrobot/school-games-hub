/**
 * The painted course pictures on the picker cards and Play buttons (art plan stage G.5, docs/MARBLE-ART-PLAN.md).
 * Made with ComfyUI on James's PC; tidied to ./art/cards/<course id>.webp. A course with no picture shows the plain card.
 */
const FILES = import.meta.glob('./art/cards/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export const cardArt = (courseId: string): string | undefined => FILES[`./art/cards/${courseId}.webp`];
