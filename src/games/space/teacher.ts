import { fetchMathsSwitch } from '../../data/spaceGames';
import { useSetting } from '../../teacher/useSetting';

/** Mission Control maths for a class (docs/SPACE-MATHS-PLAN.md): the Maths column of the teacher's Games table. */
export function useSpaceMaths(classId: string) {
  return useSetting(() => fetchMathsSwitch(classId), [classId]);
}

export const SPACE_MATHS_ABOUT =
  'Times-table questions at wormholes and black holes, and a question after each turn. They use each student’s own times-table records, and what they answer goes into those records. A wrong answer never costs a student anything.';
