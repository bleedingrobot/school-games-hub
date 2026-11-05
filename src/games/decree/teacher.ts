import { POINT_REIGNS_PER_DAY, POINTS } from '../../../shared/decree/config';
import { fetchDecreeEnabled } from '../../data/decree';
import { useSetting } from '../../teacher/useSetting';

/**
 * Royal Decree on the teacher's Games table (docs/DECREE-PLAN.md): the on/off switch in the On column, and nothing to open.
 * Its maths has no switch: every third villager's question follows the student's own maths focus, so the Maths column says
 * so. The server checks the switch on every request.
 */
export function useDecreeClassSwitch(classId: string) {
  return useSetting(() => fetchDecreeEnabled(classId), [classId]);
}

/** The Maths column. The same for every class, so there is nothing to load. */
export const decreeSummary = (): string => 'Follows focus';

const most = POINTS.played + POINTS.perYear * POINTS.yearsCounted + POINTS.full;

export const DECREE_ABOUT = `Students rule the village of Riverstone by saying yes or no to villagers’ requests, keeping Food, Gold, Happiness and Safety above zero. Every third villager asks a maths question from the student’s own focus; a right answer helps a little, and a wrong one just doesn’t. Nobody is ranked. Points: ${POINTS.played} for any reign, +${POINTS.perYear} for each year lived (up to ${POINTS.yearsCounted}) and +${POINTS.full} for a full reign (${most} at most), from each student’s first ${POINT_REIGNS_PER_DAY} reigns a day, inside the daily points cap. Off hides it from students.`;
