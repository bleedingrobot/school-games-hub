/**
 * The saved key for a picture. `sub:<type>-<n>` is Flash and Identify (the answer is n), and
 * `gap:<type>-<n>` is Missing Spots (n counters are showing, the answer is how many are missing).
 * The server can work out the right answer from the key alone, so it needs no seed.
 */
import { FRAME_CAPACITY, STAGE_OF_TYPE, type PictureType, type StageNumber } from './config';

export type Activity = 'flash' | 'gap';

export interface ParsedKey {
  activity: Activity;
  type: PictureType;
  n: number;
  stage: StageNumber;
  /** The whole number the student should give. */
  answer: number;
}

export const subKey = (type: PictureType, n: number) => `sub:${type}-${n}`;
export const gapKey = (type: PictureType, n: number) => `gap:${type}-${n}`;

const KEY = /^(sub|gap):([a-z]{3,8})-(\d{1,2})$/;

/** Reads a key, or returns null if it isn't one of ours. */
export function parseKey(key: string): ParsedKey | null {
  const m = KEY.exec(key);
  if (!m) return null;
  const type = m[2] as PictureType;
  const stage = STAGE_OF_TYPE.get(type);
  if (!stage) return null;
  const n = Number(m[3]);
  if (m[1] === 'sub') return { activity: 'flash', type, n, stage, answer: n };
  const capacity = FRAME_CAPACITY[type];
  if (!capacity || n < 1 || n >= capacity) return null;
  return { activity: 'gap', type, n, stage, answer: capacity - n };
}
