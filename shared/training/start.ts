/**
 * Where Training starts (22 Oct 2026, TRAINING-PLAN.md section 8): the same starting place the games use. The maths warm-up
 * (or the furthest place the games have reached) puts a student somewhere on the ladder; every times-table step below that is
 * already behind them, so Training doesn't teach it again. Kept out of session.ts so the training server function doesn't
 * bundle the ladder.
 */
import { LADDER } from '../maths/ladder';
import { floorRank, type LadderInfo } from '../maths/place';

/** How many Training steps (times-table families, in order) the starting place has put behind the student. */
export function trainingPassedSteps(info: LadderInfo): number {
  const floor = floorRank(info);
  return LADDER.filter((skill, index) => skill.stage === 'times-tables' && index < floor).length;
}

/** The class wants the warm-up and this student hasn't done it yet (teachers never have to). */
export function needsPlacement(info: LadderInfo, role: string | null | undefined): boolean {
  return info.on && info.placed === null && role !== 'teacher';
}
