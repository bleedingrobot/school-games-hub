import { fetchMineEnabled, fetchMineMaths } from '../../data/mine';
import { useSetting } from '../../teacher/useSetting';

/**
 * Mine Runner on the teacher's Games table (docs/TEACHER-VIEW-PLAN.md, section 4.5): the On column and the Maths column, both for
 * the header's class (docs/MINE-PLAN.md, section 7). The server checks both at the start of every run, so nobody can start a dive
 * while the game is off, or a maths dive while maths is off.
 */
export function useMineClassSwitch(classId: string) {
  return useSetting(() => fetchMineEnabled(classId), [classId]);
}

export function useMineClassMaths(classId: string) {
  return useSetting(() => fetchMineMaths(classId), [classId]);
}

export const MINE_ABOUT =
  'Fly a ship through twisting mines, find keys, blow up the reactor and race to the exit. Best times go on a board for your school only (display names and avatars, nothing else). A first finish earns 2 points, and beating your own best earns 1 point once a day for each mine. Off hides it from students.';

export const MINE_MATHS_ABOUT =
  'Questions at the question doors and power-up pads. They follow each student’s maths focus and their own records, and what they answer goes into those records. A wrong answer at a door costs a little shield and a few seconds, never the whole run; at a pad it costs nothing. With maths off the doors are open, the pads do nothing, and times go on separate “without maths” boards.';
