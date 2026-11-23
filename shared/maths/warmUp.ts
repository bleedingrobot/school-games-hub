/**
 * Who must do the maths warm-up before the games open (James, 22 Oct 2026; juniors left out 23 Nov 2026). Kept tiny and free of
 * the ladder so the game gate can ask it without loading the ladder code.
 */
import type { LadderInfo } from './place';

/** Years 1-3 never get the warm-up: they start at the bottom of the ladder and move up as they play. */
export const WARM_UP_FROM_YEAR = 4;

export const isJuniorClass = (yearLevel: number | null | undefined): boolean =>
  typeof yearLevel === 'number' && yearLevel >= 1 && yearLevel < WARM_UP_FROM_YEAR;

/** The class wants the warm-up and this student hasn't done it yet (teachers and juniors never have to). */
export function needsPlacement(info: LadderInfo, role: string | null | undefined): boolean {
  return info.on && info.placed === null && role !== 'teacher' && !isJuniorClass(info.yearLevel);
}
