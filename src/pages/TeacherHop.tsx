/**
 * Hop's Glow-worm Pond on the teacher pages (docs/HOP-PLAN.md, Stage 4): the Games table's drawer with the hops' step
 * labels on or off for the header's class, and one line on a student's page that opens to show their pond. Loaded only
 * when opened. The on/off switch is in the Games table row (src/games/hop/teacher.ts).
 */
import { stepWords } from '../teacher/foundational/config';
import { DAYS_PER_JAR, METALS, pondAfter } from '../../shared/hop/progress';
import { fetchHopSettings, fetchHopStudent, saveHopSetting } from '../data/hop';
import { FRIEND_NAMES } from '../games/hop/art';
import { SettingToggle, useSetting } from '../teacher/Settings';
import type { HopMistake } from '../../shared/hop/round';
import { SLIP_WORDS } from '../games/hop/words';

/** The drawer on the Games table, for the header's class. */
export function HopTeacherSettings({ classId }: { classId: string }) {
  const settings = useSetting(() => fetchHopSettings(classId), [classId]);
  return (
    <div className="panel teacher__switch">
      <SettingToggle
        label="Help"
        about="Step labels (like +2) over each hop. On: each hop shows its step (+2) over the arc, bold at first, then faint, then gone, fact by fact as each student shows they know it. A student who gets three hops in a row wrong at the first try sees the labels again for the rest of that round. Off: no labels, from the first day."
        value={settings.value?.labels ?? null}
        loadFailed={settings.failed}
        save={(on) => saveHopSetting({ labels: on }, classId)}
      />
      {settings.value?.enabled === false && <p className="panel__empty">Hop’s Glow-worm Pond is off for this class, so this only matters once it’s on.</p>}
    </div>
  );
}

/** "Day 12 of 30 · counting in fives · 1 Golden Glow Jar", or null if they haven't played. */
export async function hopStudentSummary(student: string): Promise<string | null> {
  const s = await fetchHopStudent(student);
  if (!s) return null;
  const pond = pondAfter(s.daysDone);
  const parts = [stepWords('hop', s.reached), `${pond.day} of ${DAYS_PER_JAR} days done`];
  if (pond.jars) parts.push(`${pond.jars} Golden Glow ${pond.jars === 1 ? 'Jar' : 'Jars'}`);
  if (s.slip && SLIP_WORDS[s.slip]) parts.push(`usual slip: ${SLIP_WORDS[s.slip]}`);
  return parts.join(' · ');
}

/** The teacher's slip line: the commonest kind of first wrong choice, in plain words, or that none stands out yet. */
const slipLine = (slip: HopMistake | null | undefined): string => (slip ? `Usual slip: ${SLIP_WORDS[slip]}` : 'No single slip stands out yet');

const when = (iso: string, options: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-NZ', options);

/** What a student's pond looks like now (the line on their page opens to this). */
export function HopStudentPanel({ student }: { student: string }) {
  // Wrapped, because useSetting's null means "still loading" and the server's null means "not played".
  const loaded = useSetting(async () => ({ progress: await fetchHopStudent(student) }), [student]);
  if (loaded.failed) return <p className="panel__empty">We couldn’t load Hop’s Glow-worm Pond for this student.</p>;
  if (!loaded.value) return <p className="panel__empty">Loading…</p>;
  if (!loaded.value.progress) return <p className="panel__empty">Not played yet.</p>;
  const { daysDone, lastPadDay, reached, lastPlayed, slip } = loaded.value.progress;
  const pond = pondAfter(daysDone);
  const pads = METALS.map((metal) => [metal, pond.pads.filter((m) => m === metal).length] as const)
    .filter(([, n]) => n > 0)
    .map(([metal, n]) => `${n} ${metal}`)
    .join(', ');
  return (
    <section aria-label="Hop’s Glow-worm Pond">
      <p>
        Helping {FRIEND_NAMES[pond.friend]} across the pond. Lily pads: {pads}. On {stepWords('hop', reached)}.
        {lastPadDay && <> Last pad changed {when(`${lastPadDay}T12:00:00`, { weekday: 'long', day: 'numeric', month: 'long' })}.</>}
      </p>
      <p>
        Last played {when(lastPlayed, { weekday: 'long', day: 'numeric', month: 'long' })}. Golden Glow Jars so far: {pond.jars}.
      </p>
      <p>{slipLine(slip)}.</p>
    </section>
  );
}
