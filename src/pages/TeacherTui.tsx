/**
 * Tūī’s Ten Tree on the teacher pages (docs/TUI-PLAN.md): the Games table's drawer with the help setting for the
 * header's class, and one line on a student's page that opens to show their tree and the facts they find hardest.
 * Loaded only when opened. The on/off switch is in the Games table row (src/games/tui/teacher.ts).
 */
import { DAYS_PER_NEST, FRIEND_NAMES, METALS, treeAfter } from '../../shared/tui/progress';
import { stepName, type HelpSetting } from '../../shared/tui/round';
import { fetchTuiSettings, fetchTuiStudent, saveTuiSetting } from '../data/tui';
import { SettingChoice, useSetting } from '../teacher/Settings';

const HELP_CHOICES = [
  { value: 'fade', label: 'Fades', detail: 'The picture help follows each child’s own challenges: it starts at every berry counted in (level 5) and comes down a level after two good challenges, comes back one after a hard one, and two when a new step starts.' },
  { value: 'always', label: 'Always on', detail: 'Every go keeps help level 4: every berry, with the sum written under the picture.' },
  { value: 'off', label: 'Off', detail: 'Numbers only, and no Peek button. A wrong tap still brings the picture back for that go.' },
] as const;

/** The drawer on the Games table, for the header's class. */
export function TuiTeacherSettings({ classId }: { classId: string }) {
  const settings = useSetting(() => fetchTuiSettings(classId), [classId]);
  return (
    <div className="panel teacher__switch">
      <SettingChoice<HelpSetting>
        label="Picture help"
        about="How much the berries help with each go."
        options={HELP_CHOICES}
        value={settings.value?.help ?? null}
        loadFailed={settings.failed}
        save={(help) => saveTuiSetting({ help }, classId)}
      />
      {settings.value?.enabled === false && <p className="panel__empty">Tūī’s Ten Tree is off for this class, so this only matters once it’s on.</p>}
    </div>
  );
}

/** "tenand:4" → "10 + 4". */
export const factWords = (key: string): string => {
  const n = /^tenand:(\d+)$/.exec(key)?.[1];
  return n ? `10 + ${n}` : key;
};

/** "12 of 30 days done at this tree · Step 3 How many more?, help level 2 · 1 Golden Nest · hardest: 10 + 4, 10 + 7", or null if they haven't played. */
export async function tuiStudentSummary(student: string): Promise<string | null> {
  const s = await fetchTuiStudent(student);
  if (!s) return null;
  const tree = treeAfter(s.daysDone);
  const parts = [`${tree.day} of ${DAYS_PER_NEST} days done at this tree`, `Step ${s.step} ${stepName(s.step)}, help level ${s.level}`];
  if (tree.nests) parts.push(`${tree.nests} Golden Nest${tree.nests === 1 ? '' : 's'}`);
  if (s.hardest?.length) parts.push(`hardest: ${s.hardest.map(factWords).join(', ')}`);
  return parts.join(' · ');
}

const when = (iso: string, options: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-NZ', options);

/** What a student's tree looks like now (the line on their page opens to this). */
export function TuiStudentPanel({ student }: { student: string }) {
  // Wrapped, because useSetting's null means "still loading" and the server's null means "not played".
  const loaded = useSetting(async () => ({ progress: await fetchTuiStudent(student) }), [student]);
  if (loaded.failed) return <p className="panel__empty">We couldn’t load Tūī’s Ten Tree for this student.</p>;
  if (!loaded.value) return <p className="panel__empty">Loading…</p>;
  if (!loaded.value.progress) return <p className="panel__empty">Not played yet.</p>;
  const { daysDone, lastFlowerDay, step, level, lastPlayed, hardest } = loaded.value.progress;
  const tree = treeAfter(daysDone);
  const flowers = METALS.map((metal) => [metal, tree.flowers.filter((m) => m === metal).length] as const)
    .filter(([, n]) => n > 0)
    .map(([metal, n]) => `${n} ${metal}`)
    .join(', ');
  return (
    <section aria-label="Tūī’s Ten Tree">
      <p>
        At {FRIEND_NAMES[tree.friend]}’s tree. Flowers: {flowers}. On Step {step} {stepName(step)}, with help level {level} (5 is every berry counted in, 0 is numbers only).
        {lastFlowerDay && <> Last flower changed {when(`${lastFlowerDay}T12:00:00`, { weekday: 'long', day: 'numeric', month: 'long' })}.</>}
      </p>
      <p>
        Last played {when(lastPlayed, { weekday: 'long', day: 'numeric', month: 'long' })}. Golden Nests so far: {tree.nests}.
      </p>
      {hardest?.length ? <p>Finding these hardest: {hardest.map(factWords).join(', ')}.</p> : <p>No fact is giving trouble right now.</p>}
    </section>
  );
}
