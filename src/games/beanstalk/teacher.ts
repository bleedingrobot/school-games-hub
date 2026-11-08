import { DAYS_PER_EGG, FRIENDS, LEAVES_ON_STALK } from '../../../shared/beanstalk/progress';
import { PAIRS_PER_ROUND } from '../../../shared/beanstalk/round';
import { fetchBeanstalkClass, fetchBeanstalkEnabled, saveBeanstalkSetting } from '../../data/beanstalk';
import { useSetting } from '../../teacher/useSetting';

/**
 * Kiwi's Beanstalk on the teacher's Games table (docs/BEANSTALK-PLAN.md, Stage 4), for the header's class: the on/off
 * switch in the On column, the class's Golden Eggs in the Maths column, and a drawer (src/pages/TeacherBeanstalk.tsx)
 * with the leaves' dots on or off. The server checks the switch on every request.
 */
export function useBeanstalkClassSwitch(classId: string) {
  return useSetting(() => fetchBeanstalkEnabled(classId), [classId]);
}

export const saveBeanstalkEnabled = (on: boolean, classId: string) => saveBeanstalkSetting({ enabled: on }, classId);

/** The Maths column: how the class is going once anyone has played. Each student is on their own sum now (S21; the teacher's view of the stages is S23). Null while loading. */
export function useBeanstalkSummary(classId: string): string | null {
  const { value, failed } = useSetting(() => fetchBeanstalkClass(classId), [classId]);
  const bonds = 'Bonds, each on their own sum';
  if (failed) return bonds;
  if (!value) return null;
  if (!value.players) return `${bonds} · nobody yet`;
  return `${bonds} · ${value.players} playing · ${value.eggs} Golden ${value.eggs === 1 ? 'Egg' : 'Eggs'}`;
}

export const BEANSTALK_ABOUT = `For younger students (about 5 to 7), who don’t need to read: the game talks (with a Voice off button). Each day they tap ${PAIRS_PER_ROUND} pairs of floating leaves that make 10, and the stalk grows up to Kiwi. The sum follows each student, not the calendar: they stay on bonds to 10 until they are steady (two good days with the facts secure), then move up to 20, then 100 (70 + 30), then 1000 (700 + 300); after two hard days in a row they step back one. About 2 pairs in 10 are older sums, and the pairs they find hardest come up most. The sum never goes round to 10 again. Each leaf shows its number and a ten-frame of dots (each dot a ten or a hundred on the bigger beanstalks); the dots start full and follow each student: two good days in a row (8 or more of the ${PAIRS_PER_ROUND} pairs right at the first tap) make them small, then gone; a hard day (4 or fewer) brings a step back; three pairs in a row with a wrong first tap show the full dots for the rest of that round; a new sum starts full again (or off altogether, in Settings). The first finish each day turns one of the ${LEAVES_ON_STALK} magic leaves bronze, then silver, then gold, so ${DAYS_PER_EGG} days of play win a Golden Egg, about a term at 3 or 4 days a week. Missed days lose nothing. Then a new New Zealand friend is stuck up a new beanstalk (${FRIENDS.length} in all). A wrong pair just wobbles back. Every pair counts towards the student’s bonds to 10, 100 or 1000 in the maths records. No points: each Golden Egg is an achievement. Nobody is ranked. Off hides it from students.`;
