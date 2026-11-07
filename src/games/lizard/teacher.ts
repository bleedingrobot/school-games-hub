import { DEN_BUNDLES, GOES_PER_ROUND, GOOD, GOOD_TO_FADE, GOOD_TO_PASS, HARD, TOP_LEVEL } from '../../../shared/lizard/config';
import { DAYS_PER_RAFT, FRIENDS } from '../../../shared/lizard/progress';
import { STEPS } from '../../../shared/lizard/round';
import { fetchLizardClass, fetchLizardEnabled, saveLizardSetting } from '../../data/lizard';
import { useSetting } from '../../teacher/useSetting';

/**
 * Lizard’s Bundles on the teacher's Games table, for the header's class: the on/off switch in the On column, the class's
 * Golden Rafts in the Maths column, and a drawer (src/pages/TeacherLizard.tsx) with the help setting. The server checks
 * the switch on every request.
 */
export function useLizardClassSwitch(classId: string) {
  return useSetting(() => fetchLizardEnabled(classId), [classId]);
}

export const saveLizardEnabled = (on: boolean, classId: string) => saveLizardSetting({ enabled: on }, classId);

const LINE = 'Tens and ones: bundles of ten, then hundreds';

/** The Maths column: what it teaches, and how the class is going once anyone has played. Null while loading. */
export function useLizardSummary(classId: string): string | null {
  const { value, failed } = useSetting(() => fetchLizardClass(classId), [classId]);
  if (failed) return LINE;
  if (!value) return null;
  if (!value.players) return `${LINE} · nobody yet`;
  return `${LINE} · ${value.players} playing · ${value.prizes} Golden Rafts`;
}

const STEP_LIST = STEPS.map((s) => `${s.step} ${s.name}`).join(', ');

export const LIZARD_ABOUT = `For students about 5 to 8: the game talks (with a Voice off button and a Hear it again button). Each day they help Lizard tie sticks into bundles ${GOES_PER_ROUND} times: build a number from bundles of ten and loose sticks, tie ten sticks into a bundle, untie a bundle to make ten ones, read a number from the bundles and sticks, and find ten more or ten less (later a hundred, when ten bundles make a raft). There are ${STEPS.length} steps: ${STEP_LIST}. A child moves on after ${GOOD_TO_PASS} good challenges at a step and never goes back. The help has six levels, from a labelled mat with every count shown (${TOP_LEVEL}) down to numbers only (0), and it fades by the child’s own challenges: ${GOOD_TO_FADE} good challenges (${GOOD} or more of ${GOES_PER_ROUND} right at the first try) take the help down one level, a hard one (${HARD} or fewer) brings one back, a new step brings two back unless the help just faded, and the hundreds start with at least level 3. A wrong try shows why, a second one is “Let’s look together”, then “Now you try”. You can keep the help always on, or off, in Settings (Fades, Always, Off). Each finished day changes one of the ${DEN_BUNDLES} bundles in Lizard’s den from twine to bronze, then silver, then gold, so ${DAYS_PER_RAFT} days of play win a Golden Raft, about a term at 3 or 4 days a week. Missed days lose nothing. Then a new New Zealand friend has a den (${FRIENDS.length} in all). Every go counts towards the student’s tens-and-ones facts. No points: each Golden Raft is an achievement. Nobody is ranked. Off hides it from students.`;
