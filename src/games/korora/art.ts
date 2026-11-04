/**
 * The painted pictures (scripts/korora-art.py, tidied into ./art/paint/). Until James paints them on the gaming PC,
 * `paint` finds nothing and the game draws its clay stand-ins in code (KororaArt.tsx), so it works either way. Only the
 * pictures' addresses are bundled; the pictures themselves download when shown.
 */
import type { Friend } from '../../../shared/korora/progress';

const FILES = import.meta.glob('./art/paint/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export const paint = (path: string): string | undefined => FILES[`./art/paint/${path}.webp`];

export type Pose = 'wait' | 'dive' | 'gulp' | 'cheer';

/** A friend in a pose. Only Two-Shoes (id korora) has every pose; the others fall back to waiting or cheering. */
export const friendArt = (friend: Friend, pose: Pose) =>
  paint(`friends/${friend}-${pose}`) ?? paint(`friends/${friend}-${pose === 'cheer' || pose === 'gulp' ? 'cheer' : 'wait'}`);

export const FRIEND_NAMES: Record<Friend, string> = {
  korora: 'Two-Shoes',
  hoiho: 'Hoiho',
  kiwi: 'Kiwi',
  pukeko: 'Pūkeko',
  kereru: 'Kererū',
  takahe: 'Takahē',
};
