import { DAYS_PER_NEST, FLOWERS, FRIENDS } from '../../../shared/tui/progress';
import { GOES_PER_ROUND, GOOD, GOOD_TO_FADE, GOOD_TO_PASS, HARD, NEW_STEP_HELP, STEPS, TOP_LEVEL } from '../../../shared/tui/round';
import { fetchTuiClass, fetchTuiEnabled, saveTuiSetting } from '../../data/tui';
import { useSetting } from '../../teacher/useSetting';

/**
 * Tūī’s Ten Tree on the teacher's Games table, for the header's class: the on/off switch in the On column, the class's
 * Golden Nests in the Maths column, and a drawer (src/pages/TeacherTui.tsx) with the help setting. The server checks
 * the switch on every request.
 */
export function useTuiClassSwitch(classId: string) {
  return useSetting(() => fetchTuiEnabled(classId), [classId]);
}

export const saveTuiEnabled = (on: boolean, classId: string) => saveTuiSetting({ enabled: on }, classId);

/** The Maths column: teen numbers as ten and some more, and how the class is going once anyone has played. Null while loading. */
export function useTuiSummary(classId: string): string | null {
  const { value, failed } = useSetting(() => fetchTuiClass(classId), [classId]);
  if (failed) return 'Teen numbers as ten and some more';
  if (!value) return null;
  if (!value.players) return 'Teen numbers as ten and some more · nobody yet';
  return `Teen numbers as ten and some more · ${value.players} playing · ${value.nests} Golden Nests`;
}

const STEP_LIST = STEPS.map((s) => `${s.step} ${s.name}`).join(', ');

export const TUI_ABOUT = `For younger students (about 5 to 7), who don’t need to read: the game talks (with a Voice off button and a Hear it again button). Each day they help Tūī fill up for winter ${GOES_PER_ROUND} times, seeing a teen number as a full ten and some more: ten berries on a branch and 4 more is 14, “10 + 4”. There are ${STEPS.length} steps: ${STEP_LIST}. A child moves on after ${GOOD_TO_PASS} good challenges at a step and never goes back. The picture help has six levels, from every berry counted in (${TOP_LEVEL}) down to numbers only (0), and it fades by the child’s own challenges: ${GOOD_TO_FADE} good challenges (${GOOD} or more of ${GOES_PER_ROUND} right at the first tap) take the help down one level, a hard one (${HARD} or fewer) brings one back, and a new step brings ${NEW_STEP_HELP} back. After every right answer the arrow cards show the number in pieces (10 and 4 make 14). You can keep the help always on, or off, in Settings (Fades, Always, Off). Each finished day turns one of the ${FLOWERS} kōwhai flowers bronze, then silver, then gold, so ${DAYS_PER_NEST} days of play win a Golden Nest, about a term at 3 or 4 days a week. Missed days lose nothing. Then a new New Zealand bird friend comes to a fresh tree (${FRIENDS.length} in all). Every go counts towards the student’s “ten and” facts. No points: each Golden Nest is an achievement. Nobody is ranked. Off hides it from students.`;
