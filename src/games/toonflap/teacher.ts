import { BUMP_PENALTY_STEPS, CHECK_BONUS_STEPS, POINT_RUNS_A_DAY, POINTS, STEPS_PER_SECOND, TAILWIND_STEPS, UNLOCK_RUNS } from '../../../shared/toonflap/config';
import { LEVELS } from '../../../shared/toonflap/levels';
import { fetchToonFlapClass, fetchToonFlapEnabled, saveToonFlapSetting } from '../../data/toonflap';
import { useSetting } from '../../teacher/useSetting';

/**
 * Toon Flap on the teacher's Games table, for the header's class: the on/off switch in the On column, how the class is going
 * in the Maths column, and a drawer (src/pages/TeacherToonFlap.tsx) with the maths and read-time settings. The server checks
 * the switch on every request.
 */
export function useToonFlapClassSwitch(classId: string) {
  return useSetting(() => fetchToonFlapEnabled(classId), [classId]);
}

export const saveToonFlapEnabled = (on: boolean, classId: string) => saveToonFlapSetting({ enabled: on }, classId);

/** The Maths column: times tables on the way, and how the class is going once anyone has played. Null while loading. */
export function useToonFlapSummary(classId: string): string | null {
  const { value, failed } = useSetting(() => fetchToonFlapClass(classId), [classId]);
  if (failed) return 'Times-table checks in flight';
  if (!value) return null;
  if (!value.players) return 'Times-table checks in flight · nobody yet';
  return `Times-table checks in flight · ${value.players} playing · ${value.levels} levels finished · ${value.golds} golds`;
}

const s = (steps: number) => steps / STEPS_PER_SECOND;

export const TOONFLAP_ABOUT = `A flappy-style flight through ${LEVELS.length} cartoon worlds (Years 3 to 6): tap to flap through the gaps to the nest, racing a medal time. Bumping a wall never ends the run; it adds ${s(BUMP_PENALTY_STEPS)} seconds. Perches are checks: the clock stops for a maths question from the student's own focus (or their times tables), and a right answer takes ${s(CHECK_BONUS_STEPS)} seconds off. From level 3, a sign shows a quick sum and the student flies through the gap with the right answer for a ${s(TAILWIND_STEPS)}-second tailwind. Questions are never read aloud; the guide and tips are (Bella's voice, with a Voice off button). The server makes and marks every question and replays every flight, so times can't be faked. One new level opens each day. Finishing a level ${UNLOCK_RUNS} times unlocks a new flyer; flyers and trails only change the look. Points: ${POINTS.finish} for a finish, ${POINTS.firstFinish} for a first finish and ${POINTS.newGold} for a new gold, for the first ${POINT_RUNS_A_DAY} finished flights a day, inside the daily points cap. A break is suggested after 30 flights in a day. Nobody is ranked. Off hides it from students.`;
