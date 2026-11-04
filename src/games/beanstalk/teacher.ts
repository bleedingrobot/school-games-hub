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

/** The Maths column: bonds to 10, and how the class is going once anyone has played. Null while loading. */
export function useBeanstalkSummary(classId: string): string | null {
  const { value, failed } = useSetting(() => fetchBeanstalkClass(classId), [classId]);
  if (failed) return 'Bonds to 10';
  if (!value) return null;
  if (!value.players) return 'Bonds to 10 · nobody yet';
  return `Bonds to 10 · ${value.players} playing · ${value.eggs} Golden ${value.eggs === 1 ? 'Egg' : 'Eggs'}`;
}

export const BEANSTALK_ABOUT = `For younger students (about 5 to 7), who don’t need to read: the game talks (with a Voice off button). Each day they tap ${PAIRS_PER_ROUND} pairs of floating leaves that make 10, and the stalk grows up to Kiwi. The next beanstalk’s pairs make 100 (70 + 30), the one after that 1000 (700 + 300), then round again. Each leaf shows its number and a ten-frame of dots (each dot a ten or a hundred on the bigger beanstalks); the dots are full for the first ${LEAVES_ON_STALK} days, small for the next ${LEAVES_ON_STALK}, then gone (or off altogether, in Settings). The first finish each day turns one of the ${LEAVES_ON_STALK} magic leaves bronze, then silver, then gold, so ${DAYS_PER_EGG} days of play win a Golden Egg, about a term at 3 or 4 days a week. Missed days lose nothing. Then a new New Zealand friend is stuck up a new beanstalk (${FRIENDS.length} in all). A wrong pair just wobbles back. Every pair counts towards the student’s bonds to 10, 100 or 1000 in the maths records. No points: each Golden Egg is an achievement. Nobody is ranked. Off hides it from students.`;
