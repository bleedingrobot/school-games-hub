/**
 * The saved key for a picture. `sub:<type>-<n>` is Flash and Identify (the answer is n), and
 * `gap:<type>-<n>` is Missing Spots (n counters are showing, the answer is how many are missing).
 * The server can work out the right answer from the key alone, so it needs no seed.
 *
 * An answer given with help (the picture stayed on screen after a struggle) is saved under
 * `subh:` / `gaph:` instead, so it never counts towards a stage, and never uses up the room kept
 * for the answers that do. The database keeps no spare column for it, and the key is the place
 * the server already reads.
 */
import { FRAME_CAPACITY, STAGE_OF_TYPE, stageOf, type PictureType, type StageNumber } from './config';

export type Activity = 'flash' | 'gap';

export interface ParsedKey {
  activity: Activity;
  type: PictureType;
  n: number;
  stage: StageNumber;
  /** Saved with help, so it says nothing about the stage. */
  helped: boolean;
  /** The whole number the student should give. */
  answer: number;
}

export const subKey = (type: PictureType, n: number) => `sub:${type}-${n}`;
export const gapKey = (type: PictureType, n: number) => `gap:${type}-${n}`;

/** The saved key for an answer given with help. */
export const helpedKey = (key: string) => key.replace(/^(sub|gap):/, '$1h:');

/** The key without the "helped" mark. */
export const plainKey = (key: string) => key.replace(/^(sub|gap)h:/, '$1:');

/** Is this one of ours (helped or not), by its start alone? */
export const isQuickKey = (key: string) => /^(sub|gap)h?:/.test(key);

const KEY = /^(sub|gap)(h?):([a-z]{3,8})-(0|[1-9]\d?)$/;

/** Reads a key, or returns null if it isn't one of ours. */
export function parseKey(key: string): ParsedKey | null {
  const m = KEY.exec(key);
  if (!m) return null;
  const type = m[3] as PictureType;
  const stage = STAGE_OF_TYPE.get(type);
  if (!stage) return null;
  const n = Number(m[4]);
  const helped = m[2] === 'h';
  const def = stageOf(stage);
  // A picture's number stays inside its stage (a made-up `sub:line-99` is not a picture we ever show).
  if (m[1] === 'sub' && (n < def.min || n > def.max)) return null;
  if (m[1] === 'sub') return { activity: 'flash', type, n, stage, helped, answer: n };
  const capacity = FRAME_CAPACITY[type];
  if (!capacity || n < 1 || n >= capacity) return null;
  return { activity: 'gap', type, n, stage, helped, answer: capacity - n };
}
