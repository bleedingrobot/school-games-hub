import { BERRY_CLUSTERS, GOES_PER_ROUND, GOOD, GOOD_TO_FADE, GOOD_TO_PASS, HARD, TOP_LEVEL } from '../../../shared/pigeon/config';
import { DAYS_PER_BRANCH, FRIENDS } from '../../../shared/pigeon/progress';
import { STEPS } from '../../../shared/pigeon/round';
import { fetchPigeonClass, fetchPigeonEnabled, savePigeonSetting } from '../../data/pigeon';
import { useSetting } from '../../teacher/useSetting';

/**
 * Pigeon’s Number Line on the teacher's Games table, for the header's class: the on/off switch in the On column, the class's
 * Golden Berry Branches in the Maths column, and a drawer (src/pages/TeacherPigeon.tsx) with the help setting. The server checks
 * the switch on every request.
 */
export function usePigeonClassSwitch(classId: string) {
  return useSetting(() => fetchPigeonEnabled(classId), [classId]);
}

export const savePigeonEnabled = (on: boolean, classId: string) => savePigeonSetting({ enabled: on }, classId);

const LINE = 'The number line: placing, reading and comparing numbers';

/** The Maths column: what it teaches, and how the class is going once anyone has played. Null while loading. */
export function usePigeonSummary(classId: string): string | null {
  const { value, failed } = useSetting(() => fetchPigeonClass(classId), [classId]);
  if (failed) return LINE;
  if (!value) return null;
  if (!value.players) return `${LINE} · nobody yet`;
  return `${LINE} · ${value.players} playing · ${value.prizes} Golden Berry Branches`;
}

const STEP_LIST = STEPS.map((s) => `${s.step} ${s.name}`).join(', ');

export const PIGEON_ABOUT = `For students about 6 to 9: the game talks (with a Voice off button and a Hear it again button). Each day they help Pigeon fly the berry branch ${GOES_PER_ROUND} times: place a number on a line from 0 to 100 (later to 1000), read the number at an arrow, find ten more or ten less, say which ten is closer, and zoom in on part of the line. There are ${STEPS.length} steps: ${STEP_LIST}. A child moves on after ${GOOD_TO_PASS} good challenges at a step and never goes back. The help has six levels, from every number marked on the branch (${TOP_LEVEL}) down to the two ends only (0), and it fades by the child’s own challenges: ${GOOD_TO_FADE} good challenges (${GOOD} or more of ${GOES_PER_ROUND} right at the first tap) take the help down one level, a hard one (${HARD} or fewer) brings one back, a new step brings two back unless the help just faded, and a new line length (the zoom, the long branch) starts with at least level 3. A wrong tap shows why, a second one is “Let’s look together”, then “Now you try”. You can keep the help always on, or off, in Settings (Fades, Always, Off). Each finished day turns one of the ${BERRY_CLUSTERS} berry clusters bronze, then silver, then gold, so ${DAYS_PER_BRANCH} days of play win a Golden Berry Branch, about a term at 3 or 4 days a week. Missed days lose nothing. Then a new New Zealand bird friend flies a fresh branch (${FRIENDS.length} in all). Every go counts towards the student’s number-line facts. No points: each Golden Berry Branch is an achievement. Nobody is ranked. Off hides it from students.`;
