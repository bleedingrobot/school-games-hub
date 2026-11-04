/**
 * Hop's Glow-worm Pond on the teacher pages (docs/HOP-PLAN.md, Stage 4): the Games table's drawer with the hops' step
 * labels on or off for the header's class, and one line on a student's page that opens to show their pond. Loaded only
 * when opened. The on/off switch is in the Games table row (src/games/hop/teacher.ts).
 */
import { DAYS_PER_JAR, METALS, pondAfter } from '../../shared/hop/progress';
import { fetchHopSettings, fetchHopStudent, saveHopSetting } from '../data/hop';
import { FRIEND_NAMES } from '../games/hop/art';
import { SettingToggle, useSetting } from '../teacher/Settings';

/** The drawer on the Games table, for the header's class. */
export function HopTeacherSettings({ classId }: { classId: string }) {
  const settings = useSetting(() => fetchHopSettings(classId), [classId]);
  return (
    <div className="panel teacher__switch">
      <SettingToggle
        label="Step labels on the hops"
        about="On: each hop shows its step (+2) over the arc, bold at first, then faint, then gone as the lily pads turn gold. Off: no labels, from the first day."
        value={settings.value?.labels ?? null}
        loadFailed={settings.failed}
        save={(on) => saveHopSetting({ labels: on }, classId)}
      />
      {settings.value?.enabled === false && <p className="panel__empty">Hop’s Glow-worm Pond is off for this class, so this only matters once it’s on.</p>}
    </div>
  );
}

const STEP_WORD = { 10: 'tens', 5: 'fives', 2: 'twos' } as const;

/** "Day 12 of 30 · counting in fives · 1 Golden Glow Jar", or null if they haven't played. */
export async function hopStudentSummary(student: string): Promise<string | null> {
  const s = await fetchHopStudent(student);
  if (!s) return null;
  const pond = pondAfter(s.daysDone);
  const parts = [`${pond.day} of ${DAYS_PER_JAR} days done on this pond`, `reached counting in ${STEP_WORD[s.reached]}`];
  if (pond.jars) parts.push(`${pond.jars} Golden Glow ${pond.jars === 1 ? 'Jar' : 'Jars'}`);
  return parts.join(' · ');
}

const when = (iso: string, options: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-NZ', options);

/** What a student's pond looks like now (the line on their page opens to this). */
export function HopStudentPanel({ student }: { student: string }) {
  // Wrapped, because useSetting's null means "still loading" and the server's null means "not played".
  const loaded = useSetting(async () => ({ progress: await fetchHopStudent(student) }), [student]);
  if (loaded.failed) return <p className="panel__empty">We couldn’t load Hop’s Glow-worm Pond for this student.</p>;
  if (!loaded.value) return <p className="panel__empty">Loading…</p>;
  if (!loaded.value.progress) return <p className="panel__empty">Not played yet.</p>;
  const { daysDone, lastPadDay, reached, lastPlayed } = loaded.value.progress;
  const pond = pondAfter(daysDone);
  const pads = METALS.map((metal) => [metal, pond.pads.filter((m) => m === metal).length] as const)
    .filter(([, n]) => n > 0)
    .map(([metal, n]) => `${n} ${metal}`)
    .join(', ');
  return (
    <section aria-label="Hop’s Glow-worm Pond">
      <p>
        Helping {FRIEND_NAMES[pond.friend]} across the pond. Lily pads: {pads}. Has reached counting in {STEP_WORD[reached]}.
        {lastPadDay && <> Last pad changed {when(`${lastPadDay}T12:00:00`, { weekday: 'long', day: 'numeric', month: 'long' })}.</>}
      </p>
      <p>
        Last played {when(lastPlayed, { weekday: 'long', day: 'numeric', month: 'long' })}. Golden Glow Jars so far: {pond.jars}.
      </p>
    </section>
  );
}
