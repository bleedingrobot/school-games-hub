import { GRAND_ISLE, TURNS_PER_DAY } from '../../../shared/isles/config';
import { POINTS } from '../../../shared/isles/server';
import { fetchIslesEnabled, saveIslesSetting } from '../../data/isles';
import { useSetting } from '../../teacher/useSetting';

/**
 * Sky Isles on the teacher's Games table (docs/ISLES-PLAN.md, section 10), for the header's class: the on/off switch in
 * the On column, and a drawer (src/pages/TeacherIsles.tsx) with Sky Races on or off, the class's islands and its Hall of
 * the Skies. Its maths has no switch: the sky pilot's question follows each student's own maths focus, so the Maths
 * column says so. The server checks the switches on every request.
 */
export function useIslesClassSwitch(classId: string) {
  return useSetting(() => fetchIslesEnabled(classId), [classId]);
}

export const saveIslesEnabled = (on: boolean, classId: string) => saveIslesSetting({ enabled: on }, classId);

/** The Maths column. The same for every class, so there is nothing to load. */
export const islesSummary = (): string => 'Follows focus';

export const ISLES_ABOUT = `Students grow a floating island in the class’s shared sky: ${TURNS_PER_DAY} short turns a day, each starting with a maths question from the student’s own focus (a right answer is a fair wind: more coins that turn). They build, decorate, visit classmates’ islands, leave free gifts and can race each other’s sky-boats, where nobody loses anything. Nobody is ranked by maths; the Hall of the Skies keeps each season’s top 3 islands by island size. Points: ${POINTS.turn} a turn, ${POINTS.raceWon} for a race won, ${POINTS.grandIsle} for a Grand Isle (${GRAND_ISLE} building spots), ${POINTS.lighthouseStage} for each Sky Lighthouse stage, inside the daily points cap. Off hides it from students.`;
