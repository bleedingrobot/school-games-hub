import { DAYS_PER_FEAST } from '../../../shared/robin/progress';
import { FRIENDS, GOES_PER_ROUND, STEPS, BASKETS, TOP_LEVEL } from '../../../shared/robin/config';
import { ROUND_OF_TEN } from '../../../shared/kit/help';
import { fetchRobinClass, fetchRobinEnabled, saveRobinSetting } from '../../data/robin';
import { useSetting } from '../../teacher/useSetting';

/**
 * Robin’s Berry Basket on the teacher's Games table, for the header's class: the on/off switch in the On column, the class's
 * Golden Berry Feasts in the Maths column, and a drawer (src/pages/TeacherRobin.tsx) with the help setting. The server checks
 * the switch on every request.
 */
export function useRobinClassSwitch(classId: string) {
  return useSetting(() => fetchRobinEnabled(classId), [classId]);
}

export const saveRobinEnabled = (on: boolean, classId: string) => saveRobinSetting({ enabled: on }, classId);

/** The Maths column: the equals sign as a see-saw, and how the class is going once anyone has played. Null while loading. */
export function useRobinSummary(classId: string): string | null {
  const { value, failed } = useSetting(() => fetchRobinClass(classId), [classId]);
  if (failed) return 'Counting out a set';
  if (!value) return null;
  if (!value.players) return 'Counting out a set · nobody yet';
  return `Counting out a set · ${value.players} playing · ${value.feasts} Golden Berry Feasts`;
}

const STEP_LIST = STEPS.map((s) => `${s.step} ${s.name}`).join(', ');

export const ROBIN_ABOUT = `For younger students (about 5 to 7), who don’t need to read: the game talks (with a Voice off button and a Hear it again button). Each day they do ${GOES_PER_ROUND} goes of counting out a set: giving exactly N berries into Robin’s basket, saying how many berries there are, and (later) one more than a covered plate. There are ${STEPS.length} steps: ${STEP_LIST}. A child moves on after 2 good challenges at a step and never goes back. The counting help has six levels, from numbered spaces in the basket, a spoken count and the number shown (${TOP_LEVEL}) down to a bare pile (0), and it fades by the child’s own challenges: 2 good challenges (${ROUND_OF_TEN.good} or more of ${GOES_PER_ROUND} right at the first try) take the help down one level, a hard one (${ROUND_OF_TEN.hard} or fewer) brings one back at once, and a new step brings two back unless the help just faded. A wrong answer never shows the answer: a short line says which way the count went wrong. You can keep the help always on, or off, in Settings (Lots then fewer, Some, Off). Each finished day turns one of the ${BASKETS} baskets bronze, then silver, then gold, so ${DAYS_PER_FEAST} days of play win a Golden Berry Feast, about a term at 3 or 4 days a week. Missed days lose nothing. Then a new friend comes to pick berries (${FRIENDS.length} in all). Each student’s page shows the slip they make most (too many, too few, missing one out, counting one twice). No points: each Golden Berry Feast is an achievement. Nobody is ranked. Off hides it from students.`;
