import { COUNCIL_SIZE, POINT_REIGNS_PER_DAY, POINTS, YEARS } from '../../../shared/kingdom/config';
import { fetchKingdomEnabled } from '../../data/kingdom';
import { useSetting } from '../../teacher/useSetting';

/**
 * Kingdom Keeper on the teacher's Games table (docs/KINGDOM-PLAN.md, section 7), for the header's class: the on/off switch in
 * the On column, and nothing to open. Its maths has no switch: each adviser's question follows the student's own maths focus,
 * so the Maths column says so. The server checks the switch on every request.
 */
export function useKingdomClassSwitch(classId: string) {
  return useSetting(() => fetchKingdomEnabled(classId), [classId]);
}

/** The Maths column. The same for every class, so there is nothing to load. */
export const kingdomSummary = (): string => 'Follows focus';

const most = POINTS.finish + POINTS.good + POINTS.legendary;

export const KINGDOM_ABOUT = `Students rule the city of Riverstone for ${YEARS} years, deciding each year how much land to buy or sell, how much grain to feed the people and how many acres to plant (the classic game Hamurabi). Each year ${COUNCIL_SIZE} advisers ask a maths question from the student’s own focus; a right answer wins a boon for the year, and a wrong one just doesn’t. Nobody is ranked. Points: ${POINTS.finish} for ruling all ${YEARS} years (${most} for a Legendary reign), ${POINTS.early} for a reign that ends early, from each student’s first ${POINT_REIGNS_PER_DAY} reigns a day, inside the daily points cap. Off hides it from students.`;
