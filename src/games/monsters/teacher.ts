import { ALL_TOPICS, fetchMonstersEnabled, fetchMonstersSettings } from '../../data/monsters';
import { useSetting } from '../../teacher/useSetting';

/**
 * Maths Monsters on the teacher's Games table (docs/TEACHER-VIEW-PLAN.md, 4.5), for the header's class: the on/off switch in
 * the On column, and how many topics are on in the Maths column ("4 of 6 topics"). The topics and the class report are in
 * its Settings (src/pages/TeacherMonsters.tsx). The server checks the switch on every save.
 */
export function useMonstersClassSwitch(classId: string) {
  return useSetting(() => fetchMonstersEnabled(classId), [classId]);
}

/** "4 of 6 topics", or "All 6 topics". */
export function topicsText(on: number): string {
  return on >= ALL_TOPICS.length ? `All ${ALL_TOPICS.length} topics` : `${on} of ${ALL_TOPICS.length} topics`;
}

/** The Maths column. Null while loading. */
export function useMonstersSummary(classId: string): string | null {
  const settings = useSetting(() => fetchMonstersSettings(classId), [classId]);
  if (settings.failed) return 'Couldn’t load';
  return settings.value && topicsText(settings.value.topics.length);
}

/** Behind the switch's "?". */
export const MONSTERS_ABOUT =
  'A world to walk around where every attack and catch is a maths question, from the topics that are on in its Settings. Off hides it from students and nothing is saved.';
