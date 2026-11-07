import { DAYS_PER_EGG, FRIENDS, LEAVES_ON_STALK, stalkAfter } from '../../../shared/beanstalk/progress';
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

/** "Bonds to 10", "Bonds to 10 and 100" or "Bonds to 10, 100 and 1000": the sums the pupils are on (a beanstalk adds up to 10, 100 or 1000). */
export function bondsLine(targets: Iterable<number>): string {
  const sums = [...new Set(targets)].sort((a, b) => a - b);
  if (sums.length === 0) return 'Bonds to 10, 100 and 1000';
  return `Bonds to ${sums.length === 1 ? sums[0] : `${sums.slice(0, -1).join(', ')} and ${sums[sums.length - 1]}`}`;
}

/** The sums the class's pupils are on now, from their finished days. Null if that can't be read (the line then names all three). */
async function sumsInUse(classId: string): Promise<number[] | null> {
  try {
    const { classGames } = await import('../../data/foundational');
    const raw = (await classGames(classId)) as Record<string, { beanstalk?: { daysDone?: number } }>;
    return Object.values(raw).flatMap((p) => (typeof p.beanstalk?.daysDone === 'number' ? [stalkAfter(p.beanstalk.daysDone).target] : []));
  } catch {
    return null;
  }
}

/** The Maths column: the sums the class is on, and how the class is going once anyone has played. Null while loading. */
export function useBeanstalkSummary(classId: string): string | null {
  const { value, failed } = useSetting(async () => ({ class: await fetchBeanstalkClass(classId), sums: await sumsInUse(classId) }), [classId]);
  if (failed) return 'Bonds to 10, 100 and 1000';
  if (!value) return null;
  const bonds = bondsLine(value.sums ?? []);
  if (!value.class.players) return `${bonds} · nobody yet`;
  return `${bonds} · ${value.class.players} playing · ${value.class.eggs} Golden ${value.class.eggs === 1 ? 'Egg' : 'Eggs'}`;
}

export const BEANSTALK_ABOUT = `For younger students (about 5 to 7), who don’t need to read: the game talks (with a Voice off button). Each day they tap ${PAIRS_PER_ROUND} pairs of floating leaves that make 10, and the stalk grows up to Kiwi. The next beanstalk’s pairs make 100 (70 + 30), the one after that 1000 (700 + 300), then round again. Each leaf shows its number and a ten-frame of dots (each dot a ten or a hundred on the bigger beanstalks); the dots are full for the first ${LEAVES_ON_STALK} days, small for the next ${LEAVES_ON_STALK}, then gone (or off altogether, in Settings). The first finish each day turns one of the ${LEAVES_ON_STALK} magic leaves bronze, then silver, then gold, so ${DAYS_PER_EGG} days of play win a Golden Egg, about a term at 3 or 4 days a week. Missed days lose nothing. Then a new New Zealand friend is stuck up a new beanstalk (${FRIENDS.length} in all). A wrong pair just wobbles back. Every pair counts towards the student’s bonds to 10, 100 or 1000 in the maths records. No points: each Golden Egg is an achievement. Nobody is ranked. Off hides it from students.`;
