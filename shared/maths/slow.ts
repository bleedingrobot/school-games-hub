/**
 * Question types that take two steps (James, 24 Nov 2026: "12 seconds for two-step types"): 5s + 3 = 18, sharing in a ratio,
 * 20% off $45. A right answer within `SLOW_QUICK_MS` counts as quick for these, instead of the pack's 8 seconds. One-step
 * types keep the pack's quick time. Listed by mastery key (question type), so one skill can hold both kinds.
 *
 * Kept apart from untimed.ts on purpose: these are still timed, as recall is the point of the hub.
 */
import { Y78_SLOW_KEYS } from './skillPacks/y78';

export const SLOW_QUICK_MS = 12_000;

/** Mastery keys of two-step types. Each Year 7-8 card adds its own. */
export const SLOW_KEYS: ReadonlySet<string> = new Set<string>(Y78_SLOW_KEYS);

/** The quick time for one answer's record: 12 s for a two-step type, otherwise the pack's own. */
export const quickMsForKey = (key: string, packQuickMs: number): number => (SLOW_KEYS.has(key) ? Math.max(SLOW_QUICK_MS, packQuickMs) : packQuickMs);
