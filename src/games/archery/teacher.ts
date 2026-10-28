import { fetchArcheryDuels, fetchArcheryEnabled } from '../../data/archery';
import { useSetting } from '../../teacher/useSetting';

/**
 * Archery Challenge on the teacher's Games table (docs/ARCHERY-PLAN.md, section 7, Stage 7), for the header's class: the on/off
 * switch in the On column, and whether classmate fights are on as its one-line summary (docs/TEACHER-VIEW-PLAN.md, 4.5). Its
 * maths is the speed rounds, which are always there, so it has no maths switch. The server checks both switches on every
 * request.
 */
export function useArcheryClassSwitch(classId: string) {
  return useSetting(() => fetchArcheryEnabled(classId), [classId]);
}

export function useArcheryDuels(classId: string) {
  return useSetting(() => fetchArcheryDuels(classId), [classId]);
}

/** The Maths column: "Classmate fights on" or "off". Null while loading. */
export function useArcherySummary(classId: string): string | null {
  const duels = useArcheryDuels(classId);
  if (duels.failed) return 'Couldn’t load';
  if (duels.value === null) return null;
  return `Classmate fights ${duels.value ? 'on' : 'off'}`;
}

/** Behind the switch's "?". The points are in its Settings, which load only when opened (they need the speed-round rules). */
export const ARCHERY_ABOUT =
  'Two archers on hills take turns aiming (angle and power, with wind) and shooting over-the-top arrows. Coins come only from maths speed rounds, which follow each student’s maths focus, and buy arrows, shields and bows in the Armory. There’s no aiming help: students try and adjust. A New Season wipes everyone’s coins and gear. Off hides it from students.';
