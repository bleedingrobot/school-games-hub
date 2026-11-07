/**
 * Lizard’s Bundles on the teacher pages (docs/LIZARD-PLAN.md): the Games table's drawer with the help setting for the
 * header's class, and one line on a student's page that opens to show their den, the keys they find hardest and the slip they
 * make most. Loaded only when opened. The on/off switch is in the Games table row (src/games/lizard/teacher.ts).
 */
import { DAYS_PER_RAFT, FRIEND_NAMES, METALS, denAfter } from '../../shared/lizard/progress';
import { slipSummary, SLIP_WORDS } from '../../shared/lizard/teacher';
import { stepName, type HelpSetting } from '../../shared/lizard/round';
import { fetchLizardSettings, fetchLizardStudent, saveLizardSetting } from '../data/lizard';
import { SettingChoice, useSetting } from '../teacher/Settings';

const HELP_CHOICES = [
  { value: 'fade', label: 'Fades', detail: 'The help follows each child’s own challenges: it starts with a labelled mat and every count shown (level 5) and comes down a level after two good challenges, comes back one after a hard one, and two when a new step starts.' },
  { value: 'always', label: 'Always on', detail: 'Every go keeps help level 4: the labelled mat and colours, without the counts.' },
  { value: 'off', label: 'Off', detail: 'Numbers only, and no Peek button. A wrong try still brings the bundles back for that go.' },
] as const;

/** The drawer on the Games table, for the header's class. */
export function LizardTeacherSettings({ classId }: { classId: string }) {
  const settings = useSetting(() => fetchLizardSettings(classId), [classId]);
  return (
    <div className="panel teacher__switch">
      <SettingChoice<HelpSetting>
        label="Mat help"
        about="How much of the bundles and counts is shown for each go."
        options={HELP_CHOICES}
        value={settings.value?.help ?? null}
        loadFailed={settings.failed}
        save={(help) => saveLizardSetting({ help }, classId)}
      />
      {settings.value?.enabled === false && <p className="panel__empty">Lizard’s Bundles is off for this class, so this only matters once it’s on.</p>}
    </div>
  );
}

/** "pvbuild:n47" becomes "Build 47", "pvten:+47" becomes "Ten more than 47". */
export const keyWords = (key: string): string => {
  const [family, rest] = key.split(':');
  const n = /(\d+)$/.exec(key)?.[1] ?? rest;
  switch (family) {
    case 'pvbuild': return rest.startsWith('t') ? `Tie ${n} sticks` : `Build ${n}`;
    case 'pvread': return `Read ${n}`;
    case 'pvzero': return `Read ${n} (a zero)`;
    case 'pvregroup': return rest.startsWith('b') ? `Tie ${n} sticks into bundles` : `Untie a bundle of ${n}`;
    case 'pvten': return `Ten ${rest.startsWith('+') ? 'more' : 'less'} than ${n}`;
    case 'pvbuild3': return `Build ${n}`;
    case 'pvread3': return `Read ${n}`;
    case 'pvhun': return `A hundred ${rest.startsWith('+') ? 'more' : 'less'} than ${n}`;
    default: return key;
  }
};

/** "12 of 30 days done in this den · Step 3 To 100, and zero, help level 2 · 1 Golden Raft · hardest: ...", or null if they haven't played. */
export async function lizardStudentSummary(student: string): Promise<string | null> {
  const s = await fetchLizardStudent(student);
  if (!s) return null;
  const den = denAfter(s.daysDone);
  const parts = [`${den.day} of ${DAYS_PER_RAFT} days done in this den`, `Step ${s.step} ${stepName(s.step)}, help level ${s.level}`];
  if (den.prizes) parts.push(`${den.prizes} Golden Raft${den.prizes === 1 ? '' : 's'}`);
  if (s.hardest?.length) parts.push(`hardest: ${s.hardest.slice(0, 3).map(keyWords).join(', ')}`);
  return parts.join(' · ');
}

const when = (iso: string, options: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-NZ', options);

/** What a student's den looks like now (the line on their page opens to this). */
export function LizardStudentPanel({ student }: { student: string }) {
  // Wrapped, because useSetting's null means "still loading" and the server's null means "not played".
  const loaded = useSetting(async () => ({ progress: await fetchLizardStudent(student) }), [student]);
  if (loaded.failed) return <p className="panel__empty">We couldn’t load Lizard’s Bundles for this student.</p>;
  if (!loaded.value) return <p className="panel__empty">Loading…</p>;
  if (!loaded.value.progress) return <p className="panel__empty">Not played yet.</p>;
  const { daysDone, lastDay, step, level, lastPlayed, hardest, recent } = loaded.value.progress;
  const den = denAfter(daysDone);
  const bundles = METALS.map((metal) => [metal, den.bundles.filter((m) => m === metal).length] as const)
    .filter(([, n]) => n > 0)
    .map(([metal, n]) => `${n} ${metal === 'twine' ? 'unchanged' : metal}`)
    .join(', ');
  const slips = slipSummary(recent ?? []);
  return (
    <section aria-label="Lizard’s Bundles">
      <p>
        In {FRIEND_NAMES[den.friend]}’s den. Bundles: {bundles}. On Step {step} {stepName(step)}, with help level {level} (5 is a labelled mat with counts, 0 is numbers only).
        {lastDay && <> Last bundle changed {when(`${lastDay}T12:00:00`, { weekday: 'long', day: 'numeric', month: 'long' })}.</>}
      </p>
      <p>
        Last played {when(lastPlayed, { weekday: 'long', day: 'numeric', month: 'long' })}. Golden Rafts so far: {den.prizes}.
      </p>
      {slips.top && (
        <p>
          Slips (last {slips.wrong} wrong first tries): most often {SLIP_WORDS[slips.top]} ({slips.count} times).
        </p>
      )}
      {hardest?.length ? <p>Finding these hardest: {hardest.map(keyWords).join(', ')}.</p> : <p>Nothing is giving trouble right now.</p>}
    </section>
  );
}
