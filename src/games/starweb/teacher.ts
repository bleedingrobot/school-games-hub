import { ARMS, ARM_GOAL, ARM_NAMES, type Arm } from '../../../shared/classlive/stars';
import { FREE_AFTER_LIT, GOLD, POINT_SKIES_A_DAY, POINTS, SILVER, TABLES } from '../../../shared/starweb/config';
import { fetchStarWebClass, fetchStarWebEnabled, saveStarWebEnabled } from '../../data/starweb';
import { useOtherGameCells } from '../../data/otherGames';
import { useSetting } from '../../teacher/useSetting';
import type { HardestRow } from '../types';

/**
 * Star Web solo on the teacher's Games table (docs/STARWEB-PLAN.md "Teacher"): the on/off switch for the class, a Maths
 * column line, the Progress tab's "tables lit" column and Today's "Hardest right now" (the arm the class lights least).
 * The server checks the switch on every request.
 */
export function useStarWebClassSwitch(classId: string) {
  return useSetting(() => fetchStarWebEnabled(classId), [classId]);
}

export const saveStarWebClassSwitch = (on: boolean, classId: string) => saveStarWebEnabled(on, classId);

export const STARWEB_ABOUT = `Star Web for one (Years 3 to 6): a times fact the student knows well (picked by the server from their own times-table records, within the class's tables) glows in a night sky, and they type the facts they can work out from it: turned around, division, doubling, halving, × 10 and ÷ 10, one group more or less, and other links. Each true, linked fact lights a star in one of seven arms with "how we know". Every arm lit is bronze; ${SILVER} stars silver; ${GOLD} gold. No clock. Help comes slowly when a student is stuck: a nudge, then a hint with the fact's own numbers, then a worked example on a different fact. Each lit sky lights its two tables on a Star Map of tables 2 to 12; Free sky (any fact) opens after ${FREE_AFTER_LIT} lit skies. Points: ${POINTS[1]}, ${POINTS[2]} or ${POINTS[3]} for the first ${POINT_SKIES_A_DAY} lit skies a day, inside the daily points cap. The server re-checks every fact. Nobody is ranked. Off hides it from students.`;

/** The Maths column: how the class is going once anyone has played. Null while loading. */
export function useStarWebSummary(classId: string): string | null {
  const { value, failed } = useSetting(() => fetchStarWebClass(classId), [classId]);
  if (failed) return 'Facts from known times tables';
  if (!value) return null;
  if (!value.players) return 'Facts from known times tables · nobody yet';
  return `Facts from known times tables · ${value.players} playing · ${value.tablesLit} tables lit`;
}

/** The Progress tab's column: tables lit on the Star Map, of 11. */
export const useStarWebCells = (classId: string) => useOtherGameCells(classId, 'starweb', TABLES.length);

/** What each arm asks, in a teacher's words, with a warm-up idea. */
const ARM_WARMUP: Record<Arm, string> = {
  turn: 'Turn it around (7 × 6 from 6 × 7)',
  divide: 'Division undoes it (42 ÷ 6 from 6 × 7)',
  double: 'Double one number (12 × 7 from 6 × 7)',
  halve: 'Halve one number (3 × 7 from 6 × 7)',
  tens: 'Ten times bigger or smaller (60 × 7, 0.6 × 7)',
  near: 'One group more or less (6 × 8 from 6 × 7)',
  wild: 'Other links (42 + 42, 84 ÷ 2)',
};

/**
 * Today's "Hardest right now": the arms the class's Star Map skies of the last 7 days lit least (at most 2, and only when
 * under half the skies lit them). `attempts` is skies played, `correct` skies that lit the arm.
 */
export async function starwebHardest(classId: string): Promise<HardestRow[]> {
  const c = await fetchStarWebClass(classId);
  if (!c.skies) return [];
  return ARMS.map((a) => ({ a, lit: c.arms?.[a] ?? 0 }))
    .filter((x) => x.lit / c.skies < 0.5)
    .sort((x, y) => x.lit - y.lit || ARM_GOAL[y.a] - ARM_GOAL[x.a])
    .slice(0, 2)
    .map((x) => ({ question: `${ARM_NAMES[x.a]} arm: ${ARM_WARMUP[x.a]}`, topic: 'Star Web: derived facts', attempts: c.skies, correct: x.lit, students: c.pupils }));
}
