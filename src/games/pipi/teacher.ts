import { DAYS_PER_PEARL, FRIENDS, SHELLS } from '../../../shared/pipi/progress';
import { GOES_PER_ROUND } from '../../../shared/pipi/round';
import { fetchPipiClass, fetchPipiEnabled, savePipiSetting } from '../../data/pipi';
import { useSetting } from '../../teacher/useSetting';

/**
 * Pipi's Hidden Shells on the teacher's Games table (docs/PIPI-PLAN.md): the on/off switch in the On column, the class's
 * Golden Pearls in the Maths column, and a drawer (src/pages/TeacherPipi.tsx) with the help in the sand on or off. The
 * server checks the switch on every request.
 */
export function usePipiClassSwitch(classId: string) {
  return useSetting(() => fetchPipiEnabled(classId), [classId]);
}

export const savePipiEnabled = (on: boolean, classId: string) => savePipiSetting({ enabled: on }, classId);

/** The Maths column: part-whole, and how the class is going once anyone has played. Null while loading. */
export function usePipiSummary(classId: string): string | null {
  const { value, failed } = useSetting(() => fetchPipiClass(classId), [classId]);
  if (failed) return 'Parts of numbers to 10';
  if (!value) return null;
  if (!value.players) return 'Parts of numbers to 10 · nobody yet';
  return `Parts of numbers to 10 · ${value.players} playing · ${value.pearls} Golden ${value.pearls === 1 ? 'Pearl' : 'Pearls'}`;
}

export const PIPI_ABOUT = `For younger students (about 5 to 7), who don’t need to read: the game talks (with a Voice off button). Each day a family of pipi sits on the sand and a wave sends some of them digging down; for ${GOES_PER_ROUND} goes the student taps the shell with how many are hiding (7 altogether, 4 showing: 3 hiding). Wholes start at 3 to 5, then 6 and 7, then 8 to 10, moving up on their own as the student’s maths records show they are ready (and never going back). The pipi sit in a five-frame or ten-frame with outlines where the hiding ones are on the first ${SHELLS} days, with faint outlines for the next ${SHELLS}, then with no help at all (or with no help from the start, in Settings); later days also ask how many altogether and swap the hiding ones over. The first finish each day turns one of the ${SHELLS} magic shells bronze, then silver, then gold, so ${DAYS_PER_PEARL} days of play win a Golden Pearl, about a term at 3 or 4 days a week. Missed days lose nothing. Then a new New Zealand friend joins (${FRIENDS.length} in all). A wrong shell just wobbles back. Every go counts towards the student’s part-whole facts in the maths records. No points: each Golden Pearl is an achievement. Nobody is ranked. Off hides it from students.`;
