import { CHOICES, HEROES, MAPS, RUN_SECONDS } from '../../../shared/goblinstorm/config';
import { fetchGoblinStormEnabled } from '../../data/goblinstorm';
import { useOtherGameCells } from '../../data/otherGames';
import { useSetting } from '../../teacher/useSetting';

/**
 * Goblin Storm on the teacher's Games table (docs/GOBLINSTORM-PLAN.md): the on/off switch in the On column, and one line in
 * the Maths column. The server checks the switch on every request.
 */
export function useGoblinStormClassSwitch(classId: string) {
  return useSetting(() => fetchGoblinStormEnabled(classId), [classId]);
}

/** The Maths column: its questions follow each student's own focus. */
export const useGoblinStormSummary = (): string => 'Follows focus';

export const GOBLINSTORM_ABOUT = `A survive-the-swarm game for Years 3 to 6: students steer a hero for ${RUN_SECONDS / 60} minutes while their weapons fire by themselves, collecting gems to level up. Every third level-up stops for one question from the student's own maths focus: right gives ${CHOICES.right} upgrade cards to pick from, right and quick gives ${CHOICES.quick}, wrong gives ${CHOICES.wrong} and shows the right answer. The server makes and marks every question and replays every run, so nothing can be faked. 5 runs a day (Unlimited today lifts it; extra runs earn gold but no points). ${HEROES.length} heroes and ${MAPS.length} maps open by playing; gold buys small upgrades. Points: 5 for a run played to the end, 5 more for beating a boss, inside the daily points cap. The class board shows bosses beaten and best runs, never maths. Off hides it from students.`;

/**
 * The Progress tab's Goblin Storm column (docs/GOBLINSTORM-PLAN.md, stage 5): bosses beaten, of the five maps' bosses,
 * "zz" for a student who hasn't played, and when they last played. Never their maths.
 */
export const useGoblinStormCells = (classId: string) => useOtherGameCells(classId, 'goblinstorm', MAPS.length);
