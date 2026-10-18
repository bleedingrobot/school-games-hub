/** Preview storage: the browser only, wrapped so training still works if storage is blocked. */
import { emptyState, type TrainingState } from '../../shared/training/records';

const memory = new Map<string, string>();

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key) ?? memory.get(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    const raw = memory.get(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    /* storage blocked: it lives in memory until the page closes */
  }
}

const STATE_KEY = 'training-t1-state';

export function loadState(): TrainingState {
  const s = readJson<Partial<TrainingState>>(STATE_KEY, {});
  return { ...emptyState(), ...s };
}

export const saveState = (state: TrainingState) => writeJson(STATE_KEY, state);
