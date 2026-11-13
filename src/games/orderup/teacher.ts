import { ORDERUP } from '../../../shared/orderup/config';
import { fetchOrderUpClass, fetchOrderUpEnabled, saveOrderUpSetting } from '../../data/orderup';
import { useOtherGameCells } from '../../data/otherGames';
import { useSetting } from '../../teacher/useSetting';
import type { TeacherAlert } from '../types';

/**
 * Order Up! on the teacher's Games table, for the header's class: the on/off switch, how the class is going in the Maths column,
 * a drawer (src/pages/TeacherOrderUp.tsx) with the help setting and the class's common mistakes, the Progress tab's "level
 * passed" column, and Today's "Needs you" for pupils stuck on a level. The server checks the switch on every request.
 */
export function useOrderUpClassSwitch(classId: string) {
  return useSetting(() => fetchOrderUpEnabled(classId), [classId]);
}

export const saveOrderUpEnabled = (on: boolean, classId: string) => saveOrderUpSetting({ enabled: on }, classId);

/** The Maths column: order of operations, and how the class is going once anyone has played. Null while loading. */
export function useOrderUpSummary(classId: string): string | null {
  const { value, failed } = useSetting(() => fetchOrderUpClass(classId), [classId]);
  if (failed) return 'Order of operations';
  if (!value) return null;
  if (!value.pupils.length) return 'Order of operations · nobody yet';
  const stuck = value.pupils.filter((p) => p.stuck).length;
  return `Order of operations · ${value.pupils.length} started${stuck ? ` · ${stuck} stuck` : ''}`;
}

/** Today's "Needs you": pupils stuck on a level (three hard sets in a row). No names: the screen may be projected. */
export async function orderUpAlerts(classId: string): Promise<TeacherAlert[]> {
  const c = await fetchOrderUpClass(classId);
  const stuck = c.pupils.filter((p) => p.stuck).length;
  if (!stuck) return [];
  return [{ id: 'orderup-stuck', text: `Order Up!: ${stuck} pupil${stuck === 1 ? ' is' : 's are'} stuck on a level (3 hard sets in a row).`, section: 'games/orderup' }];
}

export const ORDERUP_ABOUT = `An Activity, not a game: it sits on the pupils' Activities page (Years 5 to 8). Calm practice of the order of operations on take-away bags: pupils tap the two numbers that go together first, type that step's answer, and the bag collapses (4 + 3 × 5 → 4 + 15 → 19) while a ticket writes the working line by line. An order card in four colours (brackets, exponents, × ÷, + −) lights the rule for each step. ${ORDERUP.levels} levels: left to right, × ÷ first, brackets, then (coming) exponents, all together, placing brackets and word problems. A level is passed with ${ORDERUP.passBags} good bags out of ${ORDERUP.setSize} (at most one wrong tap each). Hints follow each mistake and are read aloud; a second wrong tap walks down the order card together, a third makes the right pair glow. Help starts full on each level and fades after good sets on two different days; it comes back after a hard set. You can keep it always full, or hints only, in Settings. Every bag counts on the order-of-operations row of the Skill map. No points and no leaderboard: each level passed is an achievement. Off hides it from students.`;

/** The Progress tab's Order Up! column: the level passed, of seven. */
export const useOrderUpCells = (classId: string) => useOtherGameCells(classId, 'orderup', ORDERUP.levels);
