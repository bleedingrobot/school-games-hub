/**
 * Pigeon’s Number Line on the teacher pages (docs/PIGEON-PLAN.md): the Games table's drawer with the help setting for the
 * header's class, and one line on a student's page that opens to show their branch, the keys they find hardest and how they
 * place numbers on the line. Loaded only when opened. The on/off switch is in the Games table row (src/games/pigeon/teacher.ts).
 */
import { DAYS_PER_BRANCH, FRIEND_NAMES, METALS, branchAfter } from '../../shared/pigeon/progress';
import { placingSummary } from '../../shared/pigeon/teacher';
import { stepName, type HelpSetting, type Slip } from '../../shared/pigeon/round';
import { fetchPigeonSettings, fetchPigeonStudent, savePigeonSetting } from '../data/pigeon';
import { SettingChoice, useSetting } from '../teacher/Settings';

const HELP_CHOICES = [
  { value: 'fade', label: 'Fades', detail: 'The help follows each child’s own challenges: it starts with every number marked on the branch (level 5) and comes down a level after two good challenges, comes back one after a hard one, and two when a new step starts.' },
  { value: 'always', label: 'Always on', detail: 'Every go keeps help level 4: every ten marked on the branch.' },
  { value: 'off', label: 'Off', detail: 'Only the two ends of the branch are marked, and there is no Peek button. A wrong tap still brings the marks back for that go.' },
] as const;

/** The drawer on the Games table, for the header's class. */
export function PigeonTeacherSettings({ classId }: { classId: string }) {
  const settings = useSetting(() => fetchPigeonSettings(classId), [classId]);
  return (
    <div className="panel teacher__switch">
      <SettingChoice<HelpSetting>
        label="Branch help"
        about="How many numbers are marked on the branch for each go."
        options={HELP_CHOICES}
        value={settings.value?.help ?? null}
        loadFailed={settings.failed}
        save={(help) => savePigeonSetting({ help }, classId)}
      />
      {settings.value?.enabled === false && <p className="panel__empty">Pigeon’s Number Line is off for this class, so this only matters once it’s on.</p>}
    </div>
  );
}

/** "place100:n63" → "Place 63 on 0 to 100", "tens100:+63" → "Ten more than 63". */
export const keyWords = (key: string): string => {
  const [family, rest] = key.split(':');
  const n = /(\d+)$/.exec(key)?.[1] ?? rest;
  switch (family) {
    case 'place100': return `Place ${n} on 0 to 100`;
    case 'read100': return `Read ${n} on 0 to 100`;
    case 'tens100': return `Ten ${rest.startsWith('+') ? 'more' : 'less'} than ${n}`;
    case 'near10': return `Nearest ten to ${n}`;
    case 'zoom': return `Zoomed line (${rest.split(':')[0] ?? ''}) at ${n}`;
    case 'place1000': return `Place ${n} on 0 to 1000`;
    case 'read1000': return `Read ${n} on 0 to 1000`;
    case 'near100': return `Nearest hundred to ${n}`;
    default: return key;
  }
};

/** The usual slip behind a wrong card, in a few words (a wrong place on the line has a distance, not a slip). */
export const SLIP_WORDS: Record<Slip, string> = {
  reverse: 'turning the digits round (36 for 63)',
  ten: 'picking the wrong ten',
  one: 'picking a number a little off',
  mirror: 'counting from the wrong end, or going the wrong way',
  near: 'picking the further ten',
};

/** "12 of 30 days done on this branch · Step 3 Place any number, help level 2 · 1 Golden Berry Branch · hardest: ...", or null if they haven't played. */
export async function pigeonStudentSummary(student: string): Promise<string | null> {
  const s = await fetchPigeonStudent(student);
  if (!s) return null;
  const branch = branchAfter(s.daysDone);
  const parts = [`${branch.day} of ${DAYS_PER_BRANCH} days done on this branch`, `Step ${s.step} ${stepName(s.step)}, help level ${s.level}`];
  if (branch.prizes) parts.push(`${branch.prizes} Golden Berry Branch${branch.prizes === 1 ? '' : 'es'}`);
  if (s.slip) parts.push(`usual slip: ${SLIP_WORDS[s.slip]}`);
  if (s.hardest?.length) parts.push(`hardest: ${s.hardest.slice(0, 3).map(keyWords).join(', ')}`);
  return parts.join(' · ');
}

const when = (iso: string, options: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-NZ', options);

/** What a student's branch looks like now (the line on their page opens to this). */
export function PigeonStudentPanel({ student }: { student: string }) {
  // Wrapped, because useSetting's null means "still loading" and the server's null means "not played".
  const loaded = useSetting(async () => ({ progress: await fetchPigeonStudent(student) }), [student]);
  if (loaded.failed) return <p className="panel__empty">We couldn’t load Pigeon’s Number Line for this student.</p>;
  if (!loaded.value) return <p className="panel__empty">Loading…</p>;
  if (!loaded.value.progress) return <p className="panel__empty">Not played yet.</p>;
  const { daysDone, lastDay, step, level, lastPlayed, hardest, recent, slip } = loaded.value.progress;
  const branch = branchAfter(daysDone);
  const clusters = METALS.map((metal) => [metal, branch.clusters.filter((m) => m === metal).length] as const)
    .filter(([, n]) => n > 0)
    .map(([metal, n]) => `${n} ${metal === 'green' ? 'unchanged' : metal}`)
    .join(', ');
  const placing = placingSummary(recent ?? []);
  return (
    <section aria-label="Pigeon’s Number Line">
      <p>
        On {FRIEND_NAMES[branch.friend]}’s branch. Clusters: {clusters}. On Step {step} {stepName(step)}, with help level {level} (5 is every number marked, 0 is the two ends only).
        {lastDay && <> Last cluster changed {when(`${lastDay}T12:00:00`, { weekday: 'long', day: 'numeric', month: 'long' })}.</>}
      </p>
      <p>
        Last played {when(lastPlayed, { weekday: 'long', day: 'numeric', month: 'long' })}. Golden Berry Branches so far: {branch.prizes}.
      </p>
      {placing.averageOff !== null && (
        <p>
          Placing numbers (last {placing.taps} first taps): on average {placing.averageOff.toFixed(1)}% of the line away.
          {placing.squashed && <> Big numbers are put too far back (about {Math.abs(placing.bigOff!).toFixed(0)}% short): the line may look squashed to them.</>}
        </p>
      )}
      {slip ? <p>Usual slip: {SLIP_WORDS[slip]}.</p> : <p>No single slip stands out yet.</p>}
      {hardest?.length ? <p>Finding these hardest: {hardest.map(keyWords).join(', ')}.</p> : <p>Nothing is giving trouble right now.</p>}
    </section>
  );
}
