import { LAST_LEVEL, POINTS, levelSpec } from '../../../shared/diamond/config';
import { fetchDiamondClass, fetchDiamondEnabled } from '../../data/diamond';
import { useSetting } from '../../teacher/useSetting';

/**
 * Diamond Drop on the teacher's Games table (docs/DIAMOND-PLAN.md, section 6), for the header's class: the on/off switch
 * in the On column, and how far the class has dug in the Maths column. Its maths has no switch: every Hold on! question
 * follows the student's own maths focus. The server checks the switch on every request.
 */
export function useDiamondClassSwitch(classId: string) {
  return useSetting(() => fetchDiamondEnabled(classId), [classId]);
}

/** The Maths column: "Follows focus", and how far the class has got once anyone has played. Null while loading. */
export function useDiamondSummary(classId: string): string | null {
  const { value, failed } = useSetting(() => fetchDiamondClass(classId), [classId]);
  if (failed) return 'Follows focus';
  if (!value) return null;
  if (!value.players) return 'Follows focus · nobody yet';
  return `Follows focus · ${value.pastFive} past level 5 · ${value.found} found the diamond`;
}

export const DIAMOND_ABOUT = `Students swing a claw and drop it to grab gems, digging down ${LAST_LEVEL} levels to the Heart Diamond in ${levelSpec(LAST_LEVEL).place}. When a gem starts to slip, a maths question from the student’s own focus pops up: right, and they hold on; wrong, and the gem falls back (they can grab it again). One new level a day, unlimited tries and replays. Coins buy boosts and silly looks for the claw, never an advantage in maths. Nobody is ranked; the Hall of Diamond Finders shows who reached the bottom. Points: ${POINTS.firstPass} for passing a level for the first time, ${POINTS.newStar} for each new star, ${POINTS.diamond} for the diamond, inside the daily points cap. New Season sends everyone back to level 1 (upgrades and achievements stay). Off hides it from students.`;
