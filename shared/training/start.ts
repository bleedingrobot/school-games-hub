/**
 * Where Training starts (22 Oct 2026, TRAINING-PLAN.md section 8): the same starting place the games use. The maths warm-up
 * (or the furthest place the games have reached) puts a student somewhere on the ladder; every times-table step below that is
 * already behind them, so Training doesn't teach it again. Kept out of session.ts so the training server function doesn't
 * bundle the ladder.
 */
import { CAMPAIGN_STEPS } from '../maths/config';
import { LADDER } from '../maths/ladder';
import { floorRank, type LadderInfo } from '../maths/place';

/** How many Training steps (times-table families, in order) the starting place has put behind the student. */
export function trainingPassedSteps(info: LadderInfo): number {
  const floor = floorRank(info);
  // Each table is its own ladder skill now; a Training step (×3, ×4, ×8) is behind them once all its tables are.
  return CAMPAIGN_STEPS.filter((_, step) => LADDER.every((skill, index) => skill.tablesStep !== step || index < floor)).length;
}

export { needsPlacement } from '../maths/warmUp';
