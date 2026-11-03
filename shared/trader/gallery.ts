/**
 * The class gallery and its stickers (docs/TRADER-SYSTEM-PLAN.md, section 7; stage S.8). Shared by the trader server
 * function and the browser.
 */
import type { SystemDesign } from './system';

/** The six friendly stickers a visitor can leave on a classmate's system. No typing anywhere. */
export const STICKERS = [
  { id: 'wow', emoji: '🌟', name: 'Wow' },
  { id: 'planets', emoji: '🪐', name: 'Cool planets' },
  { id: 'life', emoji: '👽', name: 'Love the life' },
  { id: 'tech', emoji: '🚀', name: 'Great tech' },
  { id: 'pretty', emoji: '🌈', name: 'Pretty' },
  { id: 'amazing', emoji: '🤯', name: 'Amazing' },
] as const;

export type StickerId = (typeof STICKERS)[number]['id'];

export const isSticker = (x: unknown): x is StickerId => STICKERS.some((s) => s.id === x);

/** One system in the gallery, as the server function sends it. */
export interface GalleryEntry {
  /** The owner's id (for leaving a sticker). */
  id: string;
  /** The owner's display name. */
  name: string;
  design: SystemDesign;
  mine: boolean;
  /** A short-lived link to the saved picture, or null if there is none yet. */
  picture: string | null;
  /** Your own system: how many of each sticker it has (never who). A classmate's: the sticker you gave it, or null. */
  stickers: Partial<Record<StickerId, number>> | StickerId | null;
}

/** The gallery picture: drawn by the pupil's own browser, 512 × 288 .webp. */
export const PICTURE_WIDTH = 512;
export const PICTURE_HEIGHT = 288;
export const MAX_PICTURE_BYTES = 40_000;
/** A picture is saved at most once every this many minutes. */
export const PICTURE_GAP_MINUTES = 5;

/** True if the bytes are a .webp file (RIFF....WEBP). */
export function isWebp(bytes: Uint8Array): boolean {
  const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  return bytes.length > 12 && tag(0) === 'RIFF' && tag(8) === 'WEBP';
}
