/**
 * The painted pictures (scripts/hop-art.py, tidied into ./art/paint/). Until James paints them (4 Nov 2026, on the gaming
 * PC), `paint` finds nothing and the game draws its stand-ins in code (Art.tsx), so it works either way. Only the
 * pictures' addresses are bundled; the pictures themselves download when shown.
 */
import type { Friend } from '../../../shared/hop/progress';

const FILES = import.meta.glob('./art/paint/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export const paint = (path: string): string | undefined => FILES[`./art/paint/${path}.webp`];

export type Pose = 'wait' | 'crouch' | 'leap' | 'cheer' | 'wave';

/** A friend in a pose. Only Hop has every pose; the others fall back to waiting or cheering. */
export const friendArt = (friend: Friend, pose: Pose) =>
  paint(`friends/${friend}-${pose}`) ?? paint(`friends/${friend}-${pose === 'cheer' || pose === 'wave' ? 'cheer' : 'wait'}`);

export const FRIEND_NAMES: Record<Friend, string> = {
  hop: 'Hop',
  gecko: 'Gecko',
  weta: 'Wētā',
  tuatara: 'Tuatara',
  kiwi: 'Kiwi',
  ruru: 'Ruru',
};
