/**
 * Robin’s Berry Basket on the teacher pages (docs/ROBIN-PLAN.md): the Games table's drawer with the help setting for the
 * header's class, and one line on a student's page that opens to show their baskets, step and commonest slip.
 * Loaded only when opened. The on/off switch is in the Games table row (src/games/robin/teacher.ts).
 */
import type { HelpSetting } from '../../shared/kit/help';
import { stepName, type Step } from '../../shared/robin/config';
import { DAYS_PER_FEAST, METALS, basketsAfter } from '../../shared/robin/progress';
import { FRIEND_NAMES } from '../../shared/robin/config';
import { fetchRobinSettings, fetchRobinStudent, saveRobinSetting } from '../data/robin';
import { SettingChoice, useSetting } from '../teacher/Settings';

const HELP_CHOICES = [
  { value: 'fade', label: 'Lots, then fewer', detail: 'The help follows each child’s own challenges: it starts with numbered spaces in the basket, a spoken count and the number shown (level 5), comes down a level after two good challenges, comes back one after a hard one, and two when a new step starts.' },
  { value: 'always', label: 'Some', detail: 'Every go keeps help level 4: numbered spaces in the basket and the spoken count, but no number shown above.' },
  { value: 'off', label: 'Off', detail: 'A pile of berries and an empty basket, and no Peek button. A wrong answer still brings the help back for that go.' },
] as const;

/** The drawer on the Games table, for the header's class. */
export function RobinTeacherSettings({ classId }: { classId: string }) {
  const settings = useSetting(() => fetchRobinSettings(classId), [classId]);
  return (
    <div className="panel teacher__switch">
      <SettingChoice<HelpSetting>
        label="Counting help"
        about="How much the numbered spaces and spoken count help with each go."
        options={HELP_CHOICES}
        value={settings.value?.help ?? null}
        loadFailed={settings.failed}
        save={(help) => saveRobinSetting({ help }, classId)}
      />
      {settings.value?.enabled === false && <p className="panel__empty">Robin’s Berry Basket is off for this class, so this only matters once it’s on.</p>}
    </div>
  );
}

/** "give:n7" → "giving 7", "howmany:n8:ring" → "counting 8 in a ring", "counton:5+1" → "one more than 5". */
export const factWords = (key: string): string => {
  const [kind, rest = '', layout = ''] = key.split(':');
  if (kind === 'give' || kind === 'across') return `giving ${rest.replace('n', '')}`;
  if (kind === 'howmany') return `counting ${rest.replace('n', '')} ${layout === 'line' ? 'in rows' : layout === 'ring' ? 'in a ring' : 'scattered'}`;
  if (kind === 'counton') return `one more than ${rest.split('+')[0]}`;
  return key;
};

const SLIP_WORDS = {
  over: 'giving too many', under: 'giving too few', double: 'counting one twice', skip: 'missing one out', row: 'counting a row short',
  lots: 'guessing a lot too many', same: 'saying the number they started with', again: 'counting on two', one: 'saying one',
} as const;

/** "12 of 30 days done · Step 3 Give up to ten, help level 2 · 1 Golden Berry Feast · usual slip: giving too many", or null if they haven't played. */
export async function robinStudentSummary(student: string): Promise<string | null> {
  const s = await fetchRobinStudent(student);
  if (!s) return null;
  const row = basketsAfter(s.daysDone);
  const parts = [`${row.day} of ${DAYS_PER_FEAST} days done`, `Step ${s.step} ${stepName(s.step as Step)}, help level ${s.level}`];
  if (row.feasts) parts.push(`${row.feasts} Golden Berry Feast${row.feasts === 1 ? '' : 's'}`);
  if (s.slip) parts.push(`usual slip: ${SLIP_WORDS[s.slip]}`);
  if (s.hardest?.length) parts.push(`hardest: ${s.hardest.map(factWords).join(', ')}`);
  return parts.join(' · ');
}

const when = (iso: string, options: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-NZ', options);

/** What a student's baskets look like now (the line on their page opens to this). */
export function RobinStudentPanel({ student }: { student: string }) {
  // Wrapped, because useSetting's null means "still loading" and the server's null means "not played".
  const loaded = useSetting(async () => ({ progress: await fetchRobinStudent(student) }), [student]);
  if (loaded.failed) return <p className="panel__empty">We couldn’t load Robin’s Berry Basket for this student.</p>;
  if (!loaded.value) return <p className="panel__empty">Loading…</p>;
  if (!loaded.value.progress) return <p className="panel__empty">Not played yet.</p>;
  const { daysDone, lastDay, step, level, lastPlayed, hardest, slip } = loaded.value.progress;
  const row = basketsAfter(daysDone);
  const things = METALS.map((metal) => [metal, row.baskets.filter((m) => m === metal).length] as const)
    .filter(([, n]) => n > 0)
    .map(([metal, n]) => `${n} ${metal}`)
    .join(', ');
  return (
    <section aria-label="Robin’s Berry Basket">
      <p>
        With {FRIEND_NAMES[row.friend]}’s baskets: {things}. On Step {step} {stepName(step as Step)}, with help level {level} (5 is the most help, 0 is none).
        {lastDay && <> Last basket changed {when(`${lastDay}T12:00:00`, { weekday: 'long', day: 'numeric', month: 'long' })}.</>}
      </p>
      <p>
        Last played {when(lastPlayed, { weekday: 'long', day: 'numeric', month: 'long' })}. Golden Berry Feasts so far: {row.feasts}.
      </p>
      {slip ? <p>Their usual slip is {SLIP_WORDS[slip]}.</p> : <p>No single slip stands out right now.</p>}
      {hardest?.length ? <p>Finding these hardest: {hardest.map(factWords).join(', ')}.</p> : <p>Nothing is giving trouble right now.</p>}
    </section>
  );
}
