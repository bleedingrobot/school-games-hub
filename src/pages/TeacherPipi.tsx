/**
 * Pipi's Hidden Shells on the teacher pages (docs/PIPI-PLAN.md): the Games table's drawer with the help in the sand on or
 * off for the header's class, and one line on a student's page that opens to show their beach. Loaded only when opened.
 * The on/off switch is in the Games table row (src/games/pipi/teacher.ts).
 */
import { beachAfter, DAYS_PER_PEARL, METALS } from '../../shared/pipi/progress';
import { fetchPipiSettings, fetchPipiStudent, savePipiSetting } from '../data/pipi';
import { FRIEND_NAMES } from '../games/pipi/art';
import { SettingToggle, useSetting } from '../teacher/Settings';

/** The drawer on the Games table, for the header's class. */
export function PipiTeacherSettings({ classId }: { classId: string }) {
  const settings = useSetting(() => fetchPipiSettings(classId), [classId]);
  return (
    <div className="panel teacher__switch">
      <SettingToggle
        label="Help in the sand"
        about="On: the pipi sit in a five-frame or ten-frame and the hiding ones leave an outline, bold at first, then faint, then gone, split by split as each student shows they know it. A student who gets three goes in a row wrong at the first try sees the frame and outlines again for the rest of that round. Off: no frame and no outlines, from the first day."
        value={settings.value?.help ?? null}
        loadFailed={settings.failed}
        save={(on) => savePipiSetting({ help: on }, classId)}
      />
      {settings.value?.enabled === false && <p className="panel__empty">Pipi’s Hidden Shells is off for this class, so this only matters once it’s on.</p>}
    </div>
  );
}

const LEVEL_WORDS = { 1: 'wholes 3 to 5', 2: 'wholes 6 and 7', 3: 'wholes 8 to 10' } as const;

/** "12 of 30 days done on this beach · reached wholes 6 and 7 · 1 Golden Pearl", or null if they haven't played. */
export async function pipiStudentSummary(student: string): Promise<string | null> {
  const s = await fetchPipiStudent(student);
  if (!s) return null;
  const beach = beachAfter(s.daysDone);
  const parts = [`${beach.day} of ${DAYS_PER_PEARL} days done on this beach`, `reached ${LEVEL_WORDS[s.reached]}`];
  if (beach.pearls) parts.push(`${beach.pearls} Golden ${beach.pearls === 1 ? 'Pearl' : 'Pearls'}`);
  return parts.join(' · ');
}

const when = (iso: string, options: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-NZ', options);

/** What a student's beach looks like now (the line on their page opens to this). */
export function PipiStudentPanel({ student }: { student: string }) {
  // Wrapped, because useSetting's null means "still loading" and the server's null means "not played".
  const loaded = useSetting(async () => ({ progress: await fetchPipiStudent(student) }), [student]);
  if (loaded.failed) return <p className="panel__empty">We couldn’t load Pipi’s Hidden Shells for this student.</p>;
  if (!loaded.value) return <p className="panel__empty">Loading…</p>;
  if (!loaded.value.progress) return <p className="panel__empty">Not played yet.</p>;
  const { daysDone, lastShellDay, reached, lastPlayed } = loaded.value.progress;
  const beach = beachAfter(daysDone);
  const shells = METALS.map((metal) => [metal, beach.shells.filter((m) => m === metal).length] as const)
    .filter(([, n]) => n > 0)
    .map(([metal, n]) => `${n} ${metal}`)
    .join(', ');
  return (
    <section aria-label="Pipi’s Hidden Shells">
      <p>
        On the beach with {FRIEND_NAMES[beach.friend]}. Magic shells: {shells}. Has reached {LEVEL_WORDS[reached]}.
        {lastShellDay && <> Last shell changed {when(`${lastShellDay}T12:00:00`, { weekday: 'long', day: 'numeric', month: 'long' })}.</>}
      </p>
      <p>
        Last played {when(lastPlayed, { weekday: 'long', day: 'numeric', month: 'long' })}. Golden Pearls so far: {beach.pearls}.
      </p>
    </section>
  );
}
