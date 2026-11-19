import { MAPS } from '../../../shared/goblinstorm/config';
import { useOtherGameCells } from '../../data/otherGames';

/**
 * The Progress tab's Goblin Storm column (docs/GOBLINSTORM-PLAN.md, stage 5): bosses beaten, of the five maps' bosses,
 * "zz" for a student who hasn't played, and when they last played. Never their maths.
 */
export const useGoblinStormCells = (classId: string) => useOtherGameCells(classId, 'goblinstorm', MAPS.length);
