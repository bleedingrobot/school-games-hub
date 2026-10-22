/**
 * Where src/data/trainingGate.ts remembers the Training before games answer for a minute. On its own, importing nothing, so
 * the test setup can forget it between tests without loading Supabase (like settingsMemory.ts).
 */
export const trainingLockMemory: { kept: unknown; pending: unknown } = { kept: null, pending: null };

/** Forget the remembered answer (tests, and after a teacher changes the switch). */
export function forgetTrainingLock() {
  trainingLockMemory.kept = null;
  trainingLockMemory.pending = null;
}
