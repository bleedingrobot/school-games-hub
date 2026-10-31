import { fetchMarbleSwitches } from '../../data/marble';
import { useSetting } from '../../teacher/useSetting';

/**
 * Marble Rush maths for a class (docs/MARBLE-PLAN.md, section 7.3): the Maths column of the teacher's Games table. The rescue
 * questions are in its Settings. The server checks both at the start of every run.
 */
export function useMarbleMaths(classId: string) {
  return useSetting(() => fetchMarbleSwitches(classId).then((s) => s.maths), [classId]);
}

export const MARBLE_MATHS_ABOUT =
  'Answer gates, where the right tunnel is the shortcut, and pit stops at checkpoints. The questions follow each student’s maths focus and their own records, and what they answer goes into those records. A wrong answer only means a longer way round, never a penalty. With maths off the gates just show arrows and the shortcut is open for everyone.';
