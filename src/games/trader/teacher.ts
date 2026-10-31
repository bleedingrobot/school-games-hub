import type { MathsSwitch } from '../../../shared/space/mathsSwitch';
import { fetchTraderSettings, saveTraderSettings, type TraderSettings } from '../../data/trader';
import { useSetting } from '../../teacher/useSetting';

/**
 * Star Trader on the teacher's Games table (docs/TEACHER-VIEW-PLAN.md, section 4.5), for the header's class: the on/off switch in
 * the On column, the 3-way maths switch in the Maths column, and jumps a day and the bank in its Settings. All four are saved
 * together by one call (`teacher_set_trader`), so each change reads the class's others first. The server checks every setting
 * on every request.
 */
async function change(classId: string, patch: Partial<TraderSettings>): Promise<void> {
  const now = await fetchTraderSettings(classId);
  await saveTraderSettings({ ...now, ...patch }, classId);
}

export function useTraderClassSettings(classId: string) {
  return useSetting(() => fetchTraderSettings(classId), [classId]);
}

export function useTraderClassSwitch(classId: string) {
  return useSetting(async () => (await fetchTraderSettings(classId)).enabled, [classId]);
}

export function useTraderClassMaths(classId: string) {
  return useSetting(async (): Promise<MathsSwitch> => (await fetchTraderSettings(classId)).maths, [classId]);
}

export const saveTraderEnabled = (enabled: boolean, classId: string) => change(classId, { enabled });
export const saveTraderMaths = (maths: MathsSwitch, classId: string) => change(classId, { maths });
export const saveTraderJumps = (jumps: number, classId: string) => change(classId, { jumps });
export const saveTraderLoans = (loans: boolean, classId: string) => change(classId, { loans });

export const TRADER_ABOUT =
  'A trading game: students fly a small ship between planets, buy cargo cheap and sell it dear, upgrade their ship, deal with pirates and save up to buy a moon. They type the coordinates of the planet they want to visit. Nobody is ranked. Off hides it from students.';

export const TRADER_MATHS_ABOUT =
  'Maths checks on trades, laser rounds and space junk, from each student’s maths focus. With maths off, lasers always fire at full power and space junk is always steered safely. “Students choose” counts as on for now (students get their own switch in a later update).';
