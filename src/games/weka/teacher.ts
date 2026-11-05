import { DAYS_PER_BASKET, FRIENDS, STONES } from '../../../shared/weka/progress';
import { GOES_PER_ROUND } from '../../../shared/weka/round';
import { fetchWekaClass, fetchWekaEnabled, saveWekaSetting } from '../../data/weka';
import { useSetting } from '../../teacher/useSetting';

/**
 * Weka’s Stepping Stones on the teacher's Games table, for the header's class: the on/off switch in the On column, the class's
 * Golden Picnic Baskets in the Maths column, and a drawer (src/pages/TeacherWeka.tsx) with the help setting. The server checks
 * the switch on every request.
 */
export function useWekaClassSwitch(classId: string) {
  return useSetting(() => fetchWekaEnabled(classId), [classId]);
}

export const saveWekaEnabled = (on: boolean, classId: string) => saveWekaSetting({ enabled: on }, classId);

/** The Maths column: making ten, and how the class is going once anyone has played. Null while loading. */
export function useWekaSummary(classId: string): string | null {
  const { value, failed } = useSetting(() => fetchWekaClass(classId), [classId]);
  if (failed) return 'Making ten to add';
  if (!value) return null;
  if (!value.players) return 'Making ten to add · nobody yet';
  return `Making ten to add · ${value.players} playing · ${value.baskets} Golden Picnic Baskets`;
}

export const WEKA_ABOUT = `For younger students (about 5 to 7), who don’t need to read: the game talks (with a Voice off button and a Hear it again button). Each day they help Weka across a stream of stepping stones ${GOES_PER_ROUND} times, adding across ten by making ten: “Weka is on 8 and hops 5 more” is 8 and 2 to the big rock (10), then 3 more, 13. They move from starting on 9, to 8, to 7 and 6, to all mixed as their maths records show they are ready (never back). Each fact’s help follows the child’s own record of it: every stone numbered and the two steps (to the big rock, then on) while they are learning it; then, once it is secure and quick on two days, the child splits the number first (“split the 5 to get to ten”); faint stones once it is fluent; numbers only once they know it well. Pebble ten-frames show the same question after a right answer while the help is full or split. Help comes back if they slip. From day ${STONES + 1} some goes put the smaller number first (5 + 8: start on the bigger number), and gold days end with two hop-back goes (13 − 5). You can keep the help always on, or off, in Settings. Hints build up after wrong taps (Bella says the make-ten sentence, then a pointing hand), and full help comes back for a child who is stuck. The first finish each day turns one of the ${STONES} big stones on the far bank bronze, then silver, then gold, so ${DAYS_PER_BASKET} days of play win a Golden Picnic Basket, about a term at 3 or 4 days a week. Missed days lose nothing. Then a new New Zealand bird friend comes to a fresh stream (${FRIENDS.length} in all). Every fact counts towards the student’s adding facts to 20. No points: each Golden Picnic Basket is an achievement. Nobody is ranked. Off hides it from students.`;
