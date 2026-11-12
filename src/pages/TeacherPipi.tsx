/**
 * Pipi's Hidden Shells on the teacher pages (docs/PIPI-PLAN.md): the Games table's drawer with the help in the sand on or
 * off for the header's class, and one line on a student's page that opens to show their beach. Loaded only when opened.
 * The on/off switch is in the Games table row (src/games/pipi/teacher.ts).
 */
import { stepWords } from '../teacher/foundational/config';
import { beachAfter, DAYS_PER_PEARL, METALS } from '../../shared/pipi/progress';
import { fetchPipiSettings, fetchPipiStudent, savePipiSetting } from '../data/pipi';
import { FRIEND_NAMES } from '../games/pipi/art';
import { SettingToggle, useSetting } from '../teacher/Settings';
import type { WrongKind } from '../../shared/pipi/round';
import { SLIP_WORDS } from '../games/pipi/words';

/** The drawer on the Games table, for the header's class. */
export function PipiTeacherSettings({ classId }: { classId: string }) {
  const settings = useSetting(() => fetchPipiSettings(classId), [classId]);
  return (
    <div className="panel teacher__switch">
      <SettingToggle
        label="Help"
        about="Outlines in the sand where the hiding shells are. On: the pipi sit in a five-frame or ten-frame and the hiding ones leave an outline, bold at first, then faint, then gone, split by split as each student shows they know it. A student who gets three goes in a row wrong at the first try sees the frame and outlines again for the rest of that round. Off: no frame and no outlines, from the first day."
        value={settings.value?.help ?? null}
        loadFailed={settings.failed}
        save={(on) => savePipiSetting({ help: on }, classId)}
      />
      {settings.value?.enabled === false && <p className="panel__empty">Pipi’s Hidden Shells is off for this class, so this only matters once it’s on.</p>}
    </div>
  );
}

/** "Step 2 of 5: Halves to 10 · 12 of 30 days done · 1 Golden Pearl", or null if they haven't played. */
export async function pipiStudentSummary(student: string): Promise<string | null> {
  const s = await fetchPipiStudent(student);
  if (!s) return null;
  const beach = beachAfter(s.daysDone);
  const parts = [stepWords('pipi', s.reached), `${beach.day} of ${DAYS_PER_PEARL} days done`];
  if (beach.pearls) parts.push(`${beach.pearls} Golden ${beach.pearls === 1 ? 'Pearl' : 'Pearls'}`);
  if (s.slip && SLIP_WORDS[s.slip]) parts.push(`usual slip: ${SLIP_WORDS[s.slip]}`);
  return parts.join(' · ');
}

/** The teacher's slip line: the commonest kind of first wrong choice, in plain words, or that none stands out yet. */
const slipLine = (slip: WrongKind | null | undefined): string => (slip ? `Usual slip: ${SLIP_WORDS[slip]}` : 'No single slip stands out yet');

const when = (iso: string, options: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-NZ', options);

/** What a student's beach looks like now (the line on their page opens to this). */
export function PipiStudentPanel({ student }: { student: string }) {
  // Wrapped, because useSetting's null means "still loading" and the server's null means "not played".
  const loaded = useSetting(async () => ({ progress: await fetchPipiStudent(student) }), [student]);
  if (loaded.failed) return <p className="panel__empty">We couldn’t load Pipi’s Hidden Shells for this student.</p>;
  if (!loaded.value) return <p className="panel__empty">Loading…</p>;
  if (!loaded.value.progress) return <p className="panel__empty">Not played yet.</p>;
  const { daysDone, lastShellDay, reached, lastPlayed, slip } = loaded.value.progress;
  const beach = beachAfter(daysDone);
  const shells = METALS.map((metal) => [metal, beach.shells.filter((m) => m === metal).length] as const)
    .filter(([, n]) => n > 0)
    .map(([metal, n]) => `${n} ${metal}`)
    .join(', ');
  return (
    <section aria-label="Pipi’s Hidden Shells">
      <p>
        On the beach with {FRIEND_NAMES[beach.friend]}. Magic shells: {shells}. On {stepWords('pipi', reached)}.
        {lastShellDay && <> Last shell changed {when(`${lastShellDay}T12:00:00`, { weekday: 'long', day: 'numeric', month: 'long' })}.</>}
      </p>
      <p>
        Last played {when(lastPlayed, { weekday: 'long', day: 'numeric', month: 'long' })}. Golden Pearls so far: {beach.pearls}.
      </p>
      <p>{slipLine(slip)}.</p>
    </section>
  );
}
