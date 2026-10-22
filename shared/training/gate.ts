/**
 * Training before games (James, 22 Oct 2026): are the games locked for this student right now?
 *
 * In a class with the switch on, the games open for `gamesOpenHours` after the student last finished a Training session (a
 * whole facts session or a whole Quick looks round). Teachers are never locked; the server already leaves them out of `on`.
 *
 * The finish time comes from two places, and the newer wins: the server's (my_training_lock), and the one this device
 * remembers, so a student whose Wi-Fi dropped at the end of a session is let in straight away.
 */
import { TRAINING_CONFIG, type TrainingConfig } from './config';

export interface GateInput {
  /** Whether the lock applies to this student (their class's switch is on and they are not a teacher). */
  on: boolean;
  /** When the server says they last finished a session, ms since 1970, or null for never. */
  lastFinishedAt: number | null;
  /** When this device saw them finish one, or null. */
  localFinishedAt: number | null;
  now: number;
}

export interface Gate {
  locked: boolean;
  /** While open (and the lock applies), when the games lock again. Null when the lock doesn't apply or they are locked. */
  openUntil: number | null;
}

export const OPEN: Gate = { locked: false, openUntil: null };

export function trainingGate(input: GateInput, config: TrainingConfig = TRAINING_CONFIG): Gate {
  if (!input.on) return OPEN;
  const last = Math.max(input.lastFinishedAt ?? -Infinity, input.localFinishedAt ?? -Infinity);
  // A time from the future (a device clock set ahead) counts as now, so it can't open the games for longer.
  const finished = Math.min(last, input.now);
  const until = finished + config.gate.gamesOpenHours * 3_600_000;
  return until > input.now ? { locked: false, openUntil: until } : { locked: true, openUntil: null };
}

/** "3:40 pm" in New Zealand time, for "Games open until 3:40 pm". */
export function clockTime(ms: number): string {
  return new Date(ms)
    .toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Pacific/Auckland' })
    .replace(/\s/g, ' ')
    .toLowerCase();
}
