/**
 * The painted pictures (scripts/game_art.py, tidied into ./art/paint/). If one is missing `paint` returns undefined and
 * the game draws its stand-in in code (Art.tsx), so it works either way. Only the pictures' addresses are bundled.
 */
const FILES = import.meta.glob('./art/paint/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export const paint = (path: string): string | undefined => FILES[`./art/paint/${path}.webp`];

export type MonkeyKind = 'brown' | 'grey' | 'gold';
