import type { Y78Stage } from './y78';

/**
 * One Year 6 skill (docs/plans/ladder-y6/PLAN.md). James, 25 Nov 2026: each one slots in by difficulty, straight after the
 * existing skill `after` (an earlier Year 6 row can be `after` too, so several go in a row). Fluency only: one number or one
 * tap in about 8 s, friendly numbers, nothing to stop and work out.
 */
export interface Y6Row {
  id: string;
  label: string;
  /** 20 characters or fewer, for tight spaces (skillNames.ts). */
  tiny: string;
  stage: Y78Stage | 'rounding';
  /** The ladder skill this one goes straight after: an older skill, or the Year 6 row before it in a run (no two rows share one). */
  after: string;
  tags: readonly string[];
  /** 5 for the Year 5 cards (docs/plans/ladder-y5/PLAN.md), which slot in the same way; 6 when left out. */
  year?: 5;
}
