import { DAYS_PER_FISH, FRIENDS, PEBBLES } from '../../../shared/korora/progress';
import { GOES_PER_ROUND } from '../../../shared/korora/round';
import { fetchKororaClass, fetchKororaEnabled, saveKororaSetting } from '../../data/korora';
import { useSetting } from '../../teacher/useSetting';

/**
 * Penguin Pairs on the teacher's Games table, for the header's class: the on/off switch in the On column, the class's
 * Golden Fish in the Maths column, and a drawer (src/pages/TeacherKorora.tsx) with the help setting. The server checks
 * the switch on every request.
 */
export function useKororaClassSwitch(classId: string) {
  return useSetting(() => fetchKororaEnabled(classId), [classId]);
}

export const saveKororaEnabled = (on: boolean, classId: string) => saveKororaSetting({ enabled: on }, classId);

/** The Maths column: doubles and halves, and how the class is going once anyone has played. Null while loading. */
export function useKororaSummary(classId: string): string | null {
  const { value, failed } = useSetting(() => fetchKororaClass(classId), [classId]);
  if (failed) return 'Doubles and halves';
  if (!value) return null;
  if (!value.players) return 'Doubles and halves · nobody yet';
  return `Doubles and halves · ${value.players} playing · ${value.fish} Golden Fish`;
}

export const KORORA_ABOUT = `For younger students (about 5 to 7), who don’t need to read: the game talks (with a Voice off button and a Hear it again button). Each day they answer ${GOES_PER_ROUND} goes at Kororā’s mirror pool: doubles (fish on the rock and their reflection in the water) and halves (sharing fish fairly between two chicks), moving from doubles to 5, to halves to 10, to doubles to 10, to halves to 20 as their maths records show they are ready (never back). The pictures help a lot on the first ${PEBBLES} days, faintly for the next ${PEBBLES}, then not at all, when the last goes ask “fair or not?” (odd and even). You can keep the pictures on, or off, in Settings. Hints build up after wrong taps (counting together, then a pointing hand), and the pictures come back for a child who is stuck. The first finish each day turns one of the ${PEBBLES} magic pebbles bronze, then silver, then gold, so ${DAYS_PER_FISH} days of play win a Golden Fish, about a term at 3 or 4 days a week. Missed days lose nothing. Then a new New Zealand bird friend comes to a fresh pool (${FRIENDS.length} in all). Every fact counts towards the student’s doubles, halves and odd-and-even records. No points: each Golden Fish is an achievement. Nobody is ranked. Off hides it from students.`;
