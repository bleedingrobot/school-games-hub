import { GOES_PER_ROUND, GOOD, GOOD_TO_FADE, GOOD_TO_PASS, HARD, TOP_LEVEL } from '../../../shared/swamphen/config';
import { DAYS_PER_GARDEN, FRIENDS, ROWS } from '../../../shared/swamphen/progress';
import { STEPS } from '../../../shared/swamphen/round';
import { fetchSwamphenClass, fetchSwamphenEnabled, saveSwamphenSetting } from '../../data/swamphen';
import { useSetting } from '../../teacher/useSetting';

/**
 * Swamp Hen’s Reed Rows on the teacher's Games table, for the header's class: the on/off switch in the On column, the class's
 * Golden Reed Gardens in the Maths column, and a drawer (src/pages/TeacherSwamphen.tsx) with the help setting. The server checks
 * the switch on every request.
 */
export function useSwamphenClassSwitch(classId: string) {
  return useSetting(() => fetchSwamphenEnabled(classId), [classId]);
}

export const saveSwamphenEnabled = (on: boolean, classId: string) => saveSwamphenSetting({ enabled: on }, classId);

const LINE = 'Equal groups, arrays and the times tables';

/** The Maths column: what it teaches, and how the class is going once anyone has played. Null while loading. */
export function useSwamphenSummary(classId: string): string | null {
  const { value, failed } = useSetting(() => fetchSwamphenClass(classId), [classId]);
  if (failed) return LINE;
  if (!value) return null;
  if (!value.players) return `${LINE} · nobody yet`;
  return `${LINE} · ${value.players} playing · ${value.prizes} Golden Reed Gardens`;
}

const STEP_LIST = STEPS.map((s) => `${s.step} ${s.name}`).join(', ');

export const SWAMPHEN_ABOUT = `For students about 6 to 9, after counting in jumps: the game talks (with a Voice off button and a Hear it again button). Each day they help Swamp Hen plant her reed garden ${GOES_PER_ROUND} times, with equal rows of shoots: plant rows and count the shoots, turn a garden round (3 rows of 5 or 5 rows of 3), find a hidden garden under a mat, share shoots into equal rows, cut a big garden in two to work it out, and finish with the nine times table as ten rows with one row short. There are ${STEPS.length} steps: ${STEP_LIST}. A child moves on after ${GOOD_TO_PASS} good challenges at a step and never goes back. The help has six levels, from every row shaded and counted (${TOP_LEVEL}) down to the sum alone (0), and it fades by the child’s own challenges: ${GOOD_TO_FADE} good challenges (${GOOD} or more of ${GOES_PER_ROUND} right at the first tap) take the help down one level, a hard one (${HARD} or fewer) brings one back, and a new step brings two back unless the help just faded. A wrong tap shows why, a second one is “Let’s look together”, then “Now you try”. You can keep the help always on, or off, in Settings (Fades, Always, Off). Each finished day turns one of the ${ROWS} reed rows from mud to bronze, silver and gold, so ${DAYS_PER_GARDEN} days of play win a Golden Reed Garden, about a term at 3 or 4 days a week. Missed days lose nothing. Then a new friend plants a fresh garden (${FRIENDS.length} in all). Every go counts towards the student’s times-table facts. No points: each Golden Reed Garden is an achievement. Nobody is ranked. Off hides it from students.`;
