import { DAYS_PER_JAR, FRIENDS, PADS } from '../../../shared/hop/progress';
import { HOPS_PER_ROUND } from '../../../shared/hop/round';
import { fetchHopClass, fetchHopEnabled, saveHopSetting } from '../../data/hop';
import { useSetting } from '../../teacher/useSetting';

/**
 * Hop's Glow-worm Pond on the teacher's Games table (docs/HOP-PLAN.md, Stage 4), for the header's class: the on/off
 * switch in the On column, the class's Golden Glow Jars in the Maths column, and a drawer (src/pages/TeacherHop.tsx)
 * with the hops' step labels on or off. The server checks the switch on every request.
 */
export function useHopClassSwitch(classId: string) {
  return useSetting(() => fetchHopEnabled(classId), [classId]);
}

export const saveHopEnabled = (on: boolean, classId: string) => saveHopSetting({ enabled: on }, classId);

/** The Maths column: skip counting, and how the class is going once anyone has played. Null while loading. */
export function useHopSummary(classId: string): string | null {
  const { value, failed } = useSetting(() => fetchHopClass(classId), [classId]);
  if (failed) return 'Skip counting';
  if (!value) return null;
  if (!value.players) return 'Skip counting · nobody yet';
  return `Skip counting · ${value.players} playing · ${value.jars} Golden Glow ${value.jars === 1 ? 'Jar' : 'Jars'}`;
}

export const HOP_ABOUT = `For younger students (about 5 to 7), who don’t need to read: the game talks (with a Voice off button). Each day they tap the right glow-worm for ${HOPS_PER_ROUND} hops across the pond, counting in tens, then fives, then twos as they show they are ready (the steps come from their maths records, and never go back). Each hop shows its step (+2) while that fact is new for the student, then faintly, then not at all, so the help follows what each student knows and comes back after a slip (or never, with the labels off in Settings); the last ${PADS} days of a pond also count back. The first finish each day turns one of the ${PADS} magic lily pads bronze, then silver, then gold, so ${DAYS_PER_JAR} days of play win a Golden Glow Jar, about a term at 3 or 4 days a week. Missed days lose nothing. Then a new New Zealand friend crosses a fresh pond (${FRIENDS.length} in all). A wrong glow-worm just wobbles back. Every hop counts towards the student’s skip counting in the maths records. No points: each Golden Glow Jar is an achievement. Nobody is ranked. Off hides it from students.`;
