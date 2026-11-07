import { DAYS_PER_BELL } from '../../../shared/parrot/progress';
import { FRIENDS, GOES_PER_ROUND, STEPS, THINGS, TOP_LEVEL } from '../../../shared/parrot/config';
import { ROUND_OF_TEN } from '../../../shared/kit/help';
import { fetchParrotClass, fetchParrotEnabled, saveParrotSetting } from '../../data/parrot';
import { useSetting } from '../../teacher/useSetting';

/**
 * Parrot’s See-saw on the teacher's Games table, for the header's class: the on/off switch in the On column, the class's
 * Golden Bells in the Maths column, and a drawer (src/pages/TeacherParrot.tsx) with the help setting. The server checks
 * the switch on every request.
 */
export function useParrotClassSwitch(classId: string) {
  return useSetting(() => fetchParrotEnabled(classId), [classId]);
}

export const saveParrotEnabled = (on: boolean, classId: string) => saveParrotSetting({ enabled: on }, classId);

/** The Maths column: the equals sign as a see-saw, and how the class is going once anyone has played. Null while loading. */
export function useParrotSummary(classId: string): string | null {
  const { value, failed } = useSetting(() => fetchParrotClass(classId), [classId]);
  if (failed) return 'The equals sign as a see-saw';
  if (!value) return null;
  if (!value.players) return 'The equals sign as a see-saw · nobody yet';
  return `The equals sign as a see-saw · ${value.players} playing · ${value.bells} Golden Bells`;
}

const STEP_LIST = STEPS.map((s) => `${s.step} ${s.name}`).join(', ');

export const PARROT_ABOUT = `For younger students (about 5 to 7), who don’t need to read: the game talks (with a Voice off button and a Hear it again button). Each day they keep Parrot’s see-saw level ${GOES_PER_ROUND} times, finding the missing number in a sum with an equals sign (8 = 5 + ?): the equals sign means “the same as”, not “the answer comes next”. There are ${STEPS.length} steps: ${STEP_LIST}. A child moves on after 2 good challenges at a step and never goes back. The picture help has six levels, from stones with a live see-saw (${TOP_LEVEL}) down to the equation alone (0), and it fades by the child’s own challenges: 2 good challenges (${ROUND_OF_TEN.good} or more of ${GOES_PER_ROUND} right at the first tap) take the help down one level, a hard one (${ROUND_OF_TEN.hard} or fewer) brings one back at once, and a new step brings two back unless the help just faded. A wrong answer never shows the answer: the see-saw tips, and a short line says which way it went wrong. You can keep the help always on, or off, in Settings (Fades, Always, Off). Each finished day turns one of the ${THINGS} shiny things on the bell rope bronze, then silver, then gold, so ${DAYS_PER_BELL} days of play win a Golden Bell, about a term at 3 or 4 days a week. Missed days lose nothing. Then a new friend comes to the see-saw (${FRIENDS.length} in all). Each student’s page shows the slip they make most: copying a number from the sum, giving the total, or adding everything. No points: each Golden Bell is an achievement. Nobody is ranked. Off hides it from students.`;
