/**
 * Bests per bond set and board size, kept in this browser only. Fewest flips and fastest time are
 * remembered separately (the game with the fewest flips is not always the fastest). Nothing is sent
 * anywhere in this stage, and a blocked or full localStorage just means no bests are remembered.
 */
import type { BoardSize } from '../../../shared/bond-match/deck';

const STORAGE_KEY = 'sgh-bond-match-bests';

export interface Best {
  flips: number;
  seconds: number;
}

type Saved = Record<string, Best>;

const keyFor = (bondId: string, size: BoardSize) => `${bondId}:${size}`;

const isBest = (value: unknown): value is Best =>
  typeof value === 'object' && value !== null
  && Number.isInteger((value as Best).flips) && (value as Best).flips > 0
  && Number.isInteger((value as Best).seconds) && (value as Best).seconds >= 0;

function readAll(): Saved {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    if (typeof parsed !== 'object' || parsed === null) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => isBest(v))) as Saved;
  } catch {
    return {};
  }
}

export const loadBest = (bondId: string, size: BoardSize): Best | undefined => readAll()[keyFor(bondId, size)];

export interface RecordedGame {
  /** The bests after this game. */
  best: Best;
  /** The bests before this game, if there were any. */
  before?: Best;
  newFlips: boolean;
  newTime: boolean;
}

/** Remembers a finished game if it beats a best, and says what changed. */
export function recordGame(bondId: string, size: BoardSize, flips: number, seconds: number): RecordedGame {
  const all = readAll();
  const key = keyFor(bondId, size);
  const before = all[key];
  const best: Best = before
    ? { flips: Math.min(before.flips, flips), seconds: Math.min(before.seconds, seconds) }
    : { flips, seconds };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, [key]: best }));
  } catch {
    // Storage blocked or full: the game still works, the best just isn't remembered.
  }
  return { best, before, newFlips: !!before && flips < before.flips, newTime: !!before && seconds < before.seconds };
}

const HIDE_KEY = 'sgh-bond-match-hide-stats';

/** Some kids hate seeing a clock, so flips and time can be hidden. The choice is kept on this device. */
export function loadHideStats(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveHideStats(hide: boolean): void {
  try {
    localStorage.setItem(HIDE_KEY, String(hide));
  } catch {
    // Not remembered. That's fine.
  }
}
