/**
 * Swamp Hen’s Reed Rows on the teacher pages (docs/SWAMPHEN-PLAN.md): the Games table's drawer with the help setting for the
 * header's class, and one line on a student's page that opens to show their garden, the keys they find hardest and the slip
 * they make most. Loaded only when opened. The on/off switch is in the Games table row (src/games/swamphen/teacher.ts).
 */
import { pictureHelp, stepWords } from '../teacher/foundational/config';
import { DAYS_PER_GARDEN, FRIEND_NAMES, METALS, gardenAfter } from '../../shared/swamphen/progress';
import { SLIP_WORDS, slipSummary } from '../../shared/swamphen/teacher';
import { type HelpSetting } from '../../shared/swamphen/round';
import { fetchSwamphenSettings, fetchSwamphenStudent, saveSwamphenSetting } from '../data/swamphen';
import { SettingChoice, useSetting } from '../teacher/Settings';

const HELP_CHOICES = [
  { value: 'fade', label: 'Fades', detail: 'The help follows each child’s own challenges: it starts with the rows shaded and the total counted (level 5) and comes down a level after two good challenges, comes back one after a hard one, and two when a new step starts.' },
  { value: 'always', label: 'Always on', detail: 'Every go keeps help level 4: the rows drawn, without the total counted.' },
  { value: 'off', label: 'Off', detail: 'Only the sum is shown, and there is no Peek button. A wrong answer still brings the picture back for that go.' },
] as const;

/** The drawer on the Games table, for the header's class. */
export function SwamphenTeacherSettings({ classId }: { classId: string }) {
  const settings = useSetting(() => fetchSwamphenSettings(classId), [classId]);
  return (
    <div className="panel teacher__switch">
      <SettingChoice<HelpSetting>
        label="Garden help"
        about="How much of the picture is drawn for each go."
        options={HELP_CHOICES}
        value={settings.value?.help ?? null}
        loadFailed={settings.failed}
        save={(help) => saveSwamphenSetting({ help }, classId)}
      />
      {settings.value?.enabled === false && <p className="panel__empty">Swamp Hen’s Reed Rows is off for this class, so this only matters once it’s on.</p>}
    </div>
  );
}

/** "rows:4x6" → "4 rows of 6", "share:24/4" → "Share 24 into 4 rows". */
export const keyWords = (key: string): string => {
  const [family, rest = ''] = key.split(':');
  const m = /^(\d+)[x/](\d+)$/.exec(rest);
  if (!m) return key;
  const [, a, b] = m;
  switch (family) {
    case 'rows': return `Plant ${a} rows of ${b}`;
    case 'turn': return `Turn ${a} rows of ${b}`;
    case 'which': return `Which garden is ${a} rows of ${b}`;
    case 'share': return `Share ${a} into ${b} rows`;
    case 'cut': return `Cut ${a} rows of ${b}`;
    default: return key;
  }
};

/** "Step 3 of 6: Give 6 to 10 · 12 of 30 days done · picture help 2 of 5 · 1 Golden Reed Garden · hardest: ...", or null if they haven't played. */
export async function swamphenStudentSummary(student: string): Promise<string | null> {
  const s = await fetchSwamphenStudent(student);
  if (!s) return null;
  const garden = gardenAfter(s.daysDone);
  const parts = [stepWords('swamphen', s.step), `${garden.day} of ${DAYS_PER_GARDEN} days done`, pictureHelp(s.level)];
  if (garden.prizes) parts.push(`${garden.prizes} Golden Reed Garden${garden.prizes === 1 ? '' : 's'}`);
  const slips = slipSummary(s.recent ?? []);
  if (slips.most && SLIP_WORDS[slips.most]) parts.push(`usual slip: ${SLIP_WORDS[slips.most]}`);
  if (s.hardest?.length) parts.push(`hardest: ${s.hardest.slice(0, 3).map(keyWords).join(', ')}`);
  return parts.join(' · ');
}

const when = (iso: string, options: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-NZ', options);

/** What a student's garden looks like now (the line on their page opens to this). */
export function SwamphenStudentPanel({ student }: { student: string }) {
  // Wrapped, because useSetting's null means "still loading" and the server's null means "not played".
  const loaded = useSetting(async () => ({ progress: await fetchSwamphenStudent(student) }), [student]);
  if (loaded.failed) return <p className="panel__empty">We couldn’t load Swamp Hen’s Reed Rows for this student.</p>;
  if (!loaded.value) return <p className="panel__empty">Loading…</p>;
  if (!loaded.value.progress) return <p className="panel__empty">Not played yet.</p>;
  const { daysDone, lastDay, step, level, lastPlayed, hardest, recent } = loaded.value.progress;
  const garden = gardenAfter(daysDone);
  const rows = METALS.map((metal) => [metal, garden.rows.filter((m) => m === metal).length] as const)
    .filter(([, n]) => n > 0)
    .map(([metal, n]) => `${n} ${metal === 'mud' ? 'unchanged' : metal}`)
    .join(', ');
  const slips = slipSummary(recent ?? []);
  return (
    <section aria-label="Swamp Hen’s Reed Rows">
      <p>
        In {FRIEND_NAMES[garden.friend]}’s garden. Rows: {rows}. On {stepWords('swamphen', step)}, with {pictureHelp(level)} (5 is the rows shaded and counted, 0 is the sum alone).
        {lastDay && <> Last row changed {when(`${lastDay}T12:00:00`, { weekday: 'long', day: 'numeric', month: 'long' })}.</>}
      </p>
      <p>
        Last played {when(lastPlayed, { weekday: 'long', day: 'numeric', month: 'long' })}. Golden Reed Gardens so far: {garden.prizes}.
      </p>
      {slips.most ? <p>Usual slip: they {SLIP_WORDS[slips.most]}.</p> : <p>No single slip stands out yet.</p>}
      {hardest?.length ? <p>Finding these hardest: {hardest.map(keyWords).join(', ')}.</p> : <p>Nothing is giving trouble right now.</p>}
    </section>
  );
}
