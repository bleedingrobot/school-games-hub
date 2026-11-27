import { MAX_LEVEL } from '../../../shared/bonkers/config';
import { useOtherGameCells, useOtherGameRows } from '../../data/otherGames';
import { useSetting } from '../../teacher/useSetting';
import { fetchBonkersEnabled, saveBonkersEnabled } from './data';

/**
 * Smash Quest on the teacher's Games table (docs/BONKERS-PLAN.md): the on/off switch for the class, a Maths column line
 * and the Progress tab's "hero level" column. The server checks the switch on every request.
 */
export function useBonkersClassSwitch(classId: string) {
  return useSetting(() => fetchBonkersEnabled(classId), [classId]);
}

export const saveBonkersClassSwitch = (on: boolean, classId: string) => saveBonkersEnabled(on, classId);

export const BONKERS_ABOUT = 'Smash Quest (Years 2 to 4): a wacky, simple Dragon Maths. One adventure a school day (saved up to 3): pick 1 of 2 quests from Granny Jetpack, then 4 to 6 monster fights. The hero smashes away on their own, and about twice a fight a maths question from the student’s own focus pops up (always 4 choices) with a surprise damage boost (×2, ×3, or an ABSURD ×10). Right: the boosted smash. Wrong: no smash, the monster smashes back and the right answer is shown. Nothing is ever lost. Stars fill a bar to a trainer, who levels the hero up (10 levels); chests give wacky gear. Points: 2 a fight won, 3 for the quest, 5 for a trainer, inside the daily cap. Off hides it from students.';

/** The Maths column: how the class is going once anyone has played. Null while loading. */
export function useBonkersSummary(classId: string): string | null {
  const rows = useOtherGameRows(classId);
  if (!rows) return null;
  const mine = rows.filter((r) => r.game === 'bonkers');
  if (!mine.length) return 'Questions from each student’s focus · nobody yet';
  const top = Math.max(...mine.map((r) => r.value));
  return `Questions from each student’s focus · ${mine.length} playing · top hero level ${top}`;
}

/** The Progress tab's column: the hero's level, of 10. */
export const useBonkersCells = (classId: string) => useOtherGameCells(classId, 'bonkers', MAX_LEVEL);
