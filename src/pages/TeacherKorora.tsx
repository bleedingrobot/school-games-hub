/**
 * Penguin Pairs on the teacher pages (docs/KORORA-PLAN.md): the Games table's drawer with the help setting for the
 * header's class, and one line on a student's page that opens to show their pool and the facts they find hardest.
 * Loaded only when opened. The on/off switch is in the Games table row (src/games/korora/teacher.ts).
 */
import { stepWords } from '../teacher/foundational/config';
import { DAYS_PER_FISH, METALS, poolAfter } from '../../shared/korora/progress';
import { type WrongKind } from '../../shared/korora/round';
import type { HelpSetting } from '../../shared/korora/server';
import { fetchKororaSettings, fetchKororaStudent, saveKororaSetting } from '../data/korora';
import { FRIEND_NAMES } from '../games/korora/art';
import { SettingChoice, useSetting } from '../teacher/Settings';
import { SLIP_WORDS } from '../games/korora/words';

const HELP_CHOICES = [
  { value: 'fade', label: 'Fades', detail: 'Each go’s picture is full while that fact is new for the student, then faint, then words and numbers only, fact by fact as each student shows they know it. It comes back after a slip, and for the rest of a round after three goes in a row wrong at the first try. Hints still come after wrong taps.' },
  { value: 'always', label: 'Always on', detail: 'The full pictures every day: the reflection with lines to each fish, and halves shared out one by one.' },
  { value: 'off', label: 'Off', detail: 'Words and numbers only, from the first day. Hints still come after wrong taps.' },
] as const;

/** The drawer on the Games table, for the header's class. */
export function KororaTeacherSettings({ classId }: { classId: string }) {
  const settings = useSetting(() => fetchKororaSettings(classId), [classId]);
  return (
    <div className="panel teacher__switch">
      <SettingChoice<HelpSetting>
        label="Help"
        about="How much the pictures help with each double and half."
        options={HELP_CHOICES}
        value={settings.value?.help ?? null}
        loadFailed={settings.failed}
        save={(help) => saveKororaSetting({ help }, classId)}
      />
      {settings.value?.enabled === false && <p className="panel__empty">Penguin Pairs is off for this class, so this only matters once it’s on.</p>}
    </div>
  );
}


/** "dbl:7" → "double 7", "half:14" → "half of 14", "oddeven:9" → "is 9 odd or even?" */
export const factWords = (key: string): string => {
  const [kind, n] = key.split(':');
  return kind === 'dbl' ? `double ${n}` : kind === 'half' ? `half of ${n}` : `is ${n} odd or even?`;
};

/** "Step 2 of 5: Halves to 10 · 12 of 30 days done · 1 pair of gold shoes", or null if they haven't played. */
export async function kororaStudentSummary(student: string): Promise<string | null> {
  const s = await fetchKororaStudent(student);
  if (!s) return null;
  const pool = poolAfter(s.daysDone);
  const parts = [stepWords('korora', s.reached), `${pool.day} of ${DAYS_PER_FISH} days done`];
  if (pool.fish) parts.push(`${pool.fish} ${pool.fish === 1 ? 'pair' : 'pairs'} of gold shoes`);
  if (s.hardest?.length) parts.push(`hardest: ${s.hardest.map(factWords).join(', ')}`);
  if (s.slip && SLIP_WORDS[s.slip]) parts.push(`usual slip: ${SLIP_WORDS[s.slip]}`);
  return parts.join(' · ');
}

/** The teacher's slip line: the commonest kind of first wrong choice, in plain words, or that none stands out yet. */
const slipLine = (slip: WrongKind | null | undefined): string => (slip ? `Usual slip: ${SLIP_WORDS[slip]}` : 'No single slip stands out yet');

const when = (iso: string, options: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-NZ', options);

/** What a student's pool looks like now (the line on their page opens to this). */
export function KororaStudentPanel({ student }: { student: string }) {
  // Wrapped, because useSetting's null means "still loading" and the server's null means "not played".
  const loaded = useSetting(async () => ({ progress: await fetchKororaStudent(student) }), [student]);
  if (loaded.failed) return <p className="panel__empty">We couldn’t load Penguin Pairs for this student.</p>;
  if (!loaded.value) return <p className="panel__empty">Loading…</p>;
  if (!loaded.value.progress) return <p className="panel__empty">Not played yet.</p>;
  const { daysDone, lastPebbleDay, reached, lastPlayed, hardest, slip } = loaded.value.progress;
  const pool = poolAfter(daysDone);
  const pebbles = METALS.map((metal) => [metal, pool.pebbles.filter((m) => m === metal).length] as const)
    .filter(([, n]) => n > 0)
    .map(([metal, n]) => `${n} ${metal}`)
    .join(', ');
  return (
    <section aria-label="Penguin Pairs">
      <p>
        Crossing with {FRIEND_NAMES[pool.friend]}. Stepping stones: {pebbles}. On {stepWords('korora', reached)}.
        {lastPebbleDay && <> Last pebble changed {when(`${lastPebbleDay}T12:00:00`, { weekday: 'long', day: 'numeric', month: 'long' })}.</>}
      </p>
      <p>
        Last played {when(lastPlayed, { weekday: 'long', day: 'numeric', month: 'long' })}. Gold dancing shoes so far: {pool.fish}.
      </p>
      {hardest?.length ? <p>Finding these hardest: {hardest.map(factWords).join(', ')}.</p> : <p>No fact is giving trouble right now.</p>}
      <p>{slipLine(slip)}.</p>
    </section>
  );
}
