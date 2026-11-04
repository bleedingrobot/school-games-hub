/**
 * The painted pictures, in the paper cut-out look James picked (4 Nov 2026), listed in scripts/pipi-art.py and tidied
 * into ./art/paint/. Until James paints them on the gaming PC (ComfyUI), `paint` finds nothing and the game draws its
 * paper stand-ins in code (PipiArt.tsx), so it works either way. Numbers are always drawn in code, never painted.
 */
import type { Friend } from '../../../shared/pipi/progress';

const FILES = import.meta.glob('./art/paint/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export const paint = (path: string): string | undefined => FILES[`./art/paint/${path}.webp`];

export type PipiPose = 'sit' | 'dig' | 'pop' | 'wave';
export type FriendPose = 'wait' | 'cheer' | 'wave';

export const FRIEND_NAMES: Record<Friend, string> = {
  pipi: 'Pipi',
  korora: 'Kororā',
  tuatara: 'Tuatara',
  weta: 'Wētā',
  kiwi: 'Kiwi',
  tui: 'Tūī',
};
