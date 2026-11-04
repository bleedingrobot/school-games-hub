/**
 * Quick looks as saved with a student's Training data. Nothing here is new storage:
 * - answers are ordinary Training answers whose key starts `sub:` / `gap:` (see keys.ts), and
 * - the few settings that follow the student ride in the Training student row's `typing`
 *   column under the key "q" (that column is free-form and has room), so the database needs no change.
 */
import { STAGES, type StageNumber } from './config';
import { parseKey } from './keys';
import type { Progress, SubAnswer } from './engine';

/** What follows the student from device to device. */
export interface QuickSettings {
  /** Has the starting check been done? */
  placed: boolean;
  /** Where the starting check put them. */
  startStage: StageNumber;
  /** How many stages, from the first, are finished (kept so a stage finished long ago is never forgotten). */
  finished: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** "Keep the picture on the screen" (no flashing). */
  guided: boolean;
}

export const defaultSettings = (): QuickSettings => ({ placed: false, startStage: 1, finished: 0, guided: false });

/** The short form stored in the database. */
export interface PackedSettings {
  p: 0 | 1;
  s: number;
  f: number;
  g: 0 | 1;
  /** Settings version: 2 = the seven stages. Missing = the first four stages. */
  v: 2;
}

export const packSettings = (q: QuickSettings): PackedSettings => ({ p: q.placed ? 1 : 0, s: q.startStage, f: q.finished, g: q.guided ? 1 : 0, v: 2 });

const inRange = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;

/** Old stage numbers (four stages) to the new ones (seven): finished 0,1,2,3,4 and start 1,2,3,4. */
const OLD_FINISHED = [0, 1, 2, 4, 5];
const OLD_START = [0, 1, 3, 4, 5];

/** Reads the short form (new or old), or null if it isn't one (so a bad value is never trusted). */
export function unpackSettings(raw: unknown): QuickSettings | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const q = raw as Record<string, unknown>;
  const keys = Object.keys(q);
  const hasV = keys.includes('v');
  if (keys.length !== (hasV ? 5 : 4) || !['p', 's', 'f', 'g'].every((k) => keys.includes(k))) return null;
  if (hasV && q.v !== 2) return null;
  if (!inRange(q.p, 0, 1) || !inRange(q.s, 1, STAGES.length) || !inRange(q.f, 0, STAGES.length) || !inRange(q.g, 0, 1)) return null;
  let s = q.s;
  let f = q.f;
  // Without a version these are the old four stages, unless a number only the new stages have shows it is already new.
  if (!hasV && s <= 4 && f <= 4) {
    s = OLD_START[s];
    f = OLD_FINISHED[f];
  }
  return { placed: q.p === 1, startStage: s as StageNumber, finished: f as QuickSettings['finished'], guided: q.g === 1 };
}

/** The student's typing column with the Quick looks settings added (or left out when there are none). */
export function typingWithSettings(typing: Record<string, unknown>, quick: QuickSettings | null | undefined): Record<string, unknown> {
  return quick ? { ...typing, q: packSettings(quick) } : typing;
}

/** Splits the typing column back into Training's typing times and the Quick looks settings. */
export function splitTyping(typing: Record<string, unknown> | null | undefined): { typing: Record<number, number[]>; quick: QuickSettings | null } {
  const out: Record<number, number[]> = {};
  for (const [k, v] of Object.entries(typing ?? {})) if (/^[123]$/.test(k) && Array.isArray(v)) out[Number(k)] = v as number[];
  return { typing: out, quick: unpackSettings(typing?.q) };
}

/** A saved answer, as far as this needs. */
export interface SavedLike {
  key: string;
  correct: boolean;
  at: number;
}

/** Quick looks answers (oldest first) out of a student's saved answers. Anything else is left alone. */
export function quickAnswersFrom(saved: readonly SavedLike[]): SubAnswer[] {
  return saved
    .map((a, i) => ({ a, i, k: parseKey(a.key) }))
    .filter((x) => x.k)
    .sort((p, q) => p.a.at - q.a.at || p.i - q.i)
    .map(({ a, k }) => ({ key: a.key, correct: a.correct, at: a.at, helped: k!.helped || undefined }));
}

/** How many stages from the first are finished in a row. */
export function finishedInARow(progress: Progress): QuickSettings['finished'] {
  let n = 0;
  while (n < progress.stages.length && progress.stages[n].finished) n++;
  return n as QuickSettings['finished'];
}
