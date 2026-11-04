/**
 * The painted pictures (scripts/beanstalk-art.py, tidied into ./art/paint/). Only their addresses are bundled; the
 * pictures themselves download when shown. The sparkles, the sky and the stalk are drawn in CSS.
 */
import type { Friend, Metal } from '../../../shared/beanstalk/progress';
import type { Child } from './backend';

const FILES = import.meta.glob('./art/paint/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export const paint = (path: string): string | undefined => FILES[`./art/paint/${path}.webp`];

export type Pose = 'wait' | 'wave' | 'hop' | 'cheer' | 'egg';

/** A friend in a pose. Only Kiwi has every pose; the others fall back to waiting or cheering. */
export const friendArt = (friend: Friend, pose: Pose) =>
  paint(`friends/${friend}-${pose}`) ?? paint(`friends/${friend}-${pose === 'wait' ? 'wait' : 'cheer'}`);

export type ChildPose = 'wave' | 'point' | 'cheer' | 'hold';
export const childArt = (child: Child, pose: ChildPose) => paint(`child/${child}-${pose}`) ?? paint(`child/jack-${pose}`);

export const leafArt = (metal: Metal) => paint(`leaves/${metal}`);

export const FRIEND_NAMES: Record<Friend, string> = {
  kiwi: 'Kiwi',
  tui: 'Tūī',
  kereru: 'Kererū',
  weta: 'Wētā',
  ruru: 'Ruru',
  takahe: 'Takahē',
};
