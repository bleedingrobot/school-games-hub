/**
 * Parrot’s See-saw on the teacher pages (docs/PARROT-PLAN.md): the Games table's drawer with the help setting for the
 * header's class, and one line on a student's page that opens to show their rope, step and commonest slip.
 * Loaded only when opened. The on/off switch is in the Games table row (src/games/parrot/teacher.ts).
 */
import type { HelpSetting } from '../../shared/kit/help';
import { stepName, type Step } from '../../shared/parrot/config';
import { DAYS_PER_BELL, METALS, ropeAfter } from '../../shared/parrot/progress';
import { FRIEND_NAMES } from '../../shared/parrot/config';
import { fetchParrotSettings, fetchParrotStudent, saveParrotSetting } from '../data/parrot';
import { SettingChoice, useSetting } from '../teacher/Settings';

const HELP_CHOICES = [
  { value: 'fade', label: 'Fades', detail: 'The picture help follows each child’s own challenges: it starts at stones with a live see-saw (level 5) and comes down a level after two good challenges, comes back one after a hard one, and two when a new step starts.' },
  { value: 'always', label: 'Always on', detail: 'Every go keeps help level 4: stones, and the see-saw tips when the child checks.' },
  { value: 'off', label: 'Off', detail: 'The equation alone, and no Peek button. A wrong tap still brings the picture back for that go.' },
] as const;

/** The drawer on the Games table, for the header's class. */
export function ParrotTeacherSettings({ classId }: { classId: string }) {
  const settings = useSetting(() => fetchParrotSettings(classId), [classId]);
  return (
    <div className="panel teacher__switch">
      <SettingChoice<HelpSetting>
        label="Picture help"
        about="How much the stones and the see-saw help with each go."
        options={HELP_CHOICES}
        value={settings.value?.help ?? null}
        loadFailed={settings.failed}
        save={(help) => saveParrotSetting({ help }, classId)}
      />
      {settings.value?.enabled === false && <p className="panel__empty">Parrot’s See-saw is off for this class, so this only matters once it’s on.</p>}
    </div>
  );
}

/** "eqmiss:8=5+?" → "8 = 5 + ?". */
export const factWords = (key: string): string =>
  key.replace(/^eq[a-z]+:/, '').replace(/[=+−-]/g, (c) => ` ${c === '-' ? '−' : c} `).replace(/\s+/g, ' ').trim();

const SLIP_WORDS = { copy: 'copying a number from the sum', total: 'giving the total', all: 'adding everything' } as const;

/** "12 of 30 days done on this rope · Step 3 Swap places, help level 2 · 1 Golden Bell · usual slip: copying a number from the sum", or null if they haven't played. */
export async function parrotStudentSummary(student: string): Promise<string | null> {
  const s = await fetchParrotStudent(student);
  if (!s) return null;
  const rope = ropeAfter(s.daysDone);
  const parts = [`${rope.day} of ${DAYS_PER_BELL} days done on this rope`, `Step ${s.step} ${stepName(s.step as Step)}, help level ${s.level}`];
  if (rope.bells) parts.push(`${rope.bells} Golden Bell${rope.bells === 1 ? '' : 's'}`);
  if (s.slip) parts.push(`usual slip: ${SLIP_WORDS[s.slip]}`);
  if (s.hardest?.length) parts.push(`hardest: ${s.hardest.map(factWords).join(', ')}`);
  return parts.join(' · ');
}

const when = (iso: string, options: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-NZ', options);

/** What a student's rope looks like now (the line on their page opens to this). */
export function ParrotStudentPanel({ student }: { student: string }) {
  // Wrapped, because useSetting's null means "still loading" and the server's null means "not played".
  const loaded = useSetting(async () => ({ progress: await fetchParrotStudent(student) }), [student]);
  if (loaded.failed) return <p className="panel__empty">We couldn’t load Parrot’s See-saw for this student.</p>;
  if (!loaded.value) return <p className="panel__empty">Loading…</p>;
  if (!loaded.value.progress) return <p className="panel__empty">Not played yet.</p>;
  const { daysDone, lastDay, step, level, lastPlayed, hardest, slip } = loaded.value.progress;
  const rope = ropeAfter(daysDone);
  const things = METALS.map((metal) => [metal, rope.things.filter((m) => m === metal).length] as const)
    .filter(([, n]) => n > 0)
    .map(([metal, n]) => `${n} ${metal}`)
    .join(', ');
  return (
    <section aria-label="Parrot’s See-saw">
      <p>
        At {FRIEND_NAMES[rope.friend]}’s see-saw. Shiny things: {things}. On Step {step} {stepName(step as Step)}, with help level {level} (5 is stones with a live see-saw, 0 is the equation alone).
        {lastDay && <> Last shiny thing changed {when(`${lastDay}T12:00:00`, { weekday: 'long', day: 'numeric', month: 'long' })}.</>}
      </p>
      <p>
        Last played {when(lastPlayed, { weekday: 'long', day: 'numeric', month: 'long' })}. Golden Bells so far: {rope.bells}.
      </p>
      {slip ? <p>Their usual slip is {SLIP_WORDS[slip]}.</p> : <p>No single slip stands out right now.</p>}
      {hardest?.length ? <p>Finding these hardest: {hardest.map(factWords).join(', ')}.</p> : <p>No fact is giving trouble right now.</p>}
    </section>
  );
}
