/**
 * Weka’s Stepping Stones on the teacher pages (docs/WEKA-PLAN.md): the Games table's drawer with the help setting for the
 * header's class, and one line on a student's page that opens to show their stream and the facts they find hardest.
 * Loaded only when opened. The on/off switch is in the Games table row (src/games/weka/teacher.ts).
 */
import { stepWords } from '../teacher/foundational/config';
import { DAYS_PER_BASKET, METALS, streamAfter } from '../../shared/weka/progress';
import { parseKey, type LandKind } from '../../shared/weka/round';
import type { HelpSetting } from '../../shared/weka/server';
import { fetchWekaSettings, fetchWekaStudent, saveWekaSetting } from '../data/weka';
import { FRIEND_NAMES } from '../games/weka/art';
import { SettingChoice, useSetting } from '../teacher/Settings';
import { SLIP_WORDS } from '../games/weka/words';

const HELP_CHOICES = [
  { value: 'fade', label: 'Fades', detail: 'Each fact gets help to match the child’s record of it: every stone and two steps (to the big rock, then on) while they are learning it, then the child splitting the number first, faint stones once it is fluent, numbers only once they know it well. Pebble ten-frames follow a right answer while help is full or split. Help comes back if they slip.' },
  { value: 'always', label: 'Always on', detail: 'Every stone numbered and the two steps on every go: “8 and 2 make 10, then 3 more”.' },
  { value: 'off', label: 'Off', detail: 'Numbers only, from the first day. Hints still come after wrong taps.' },
] as const;

/** The drawer on the Games table, for the header's class. */
export function WekaTeacherSettings({ classId }: { classId: string }) {
  const settings = useSetting(() => fetchWekaSettings(classId), [classId]);
  return (
    <div className="panel teacher__switch">
      <SettingChoice<HelpSetting>
        label="Help"
        about="How much the stepping stones help with each sum."
        options={HELP_CHOICES}
        value={settings.value?.help ?? null}
        loadFailed={settings.failed}
        save={(help) => saveWekaSetting({ help }, classId)}
      />
      {settings.value?.enabled === false && <p className="panel__empty">Weka’s Stepping Stones is off for this class, so this only matters once it’s on.</p>}
    </div>
  );
}


/** "add:5+8" → "8 + 5" (bigger first, as the game shows it). */
export const factWords = (key: string): string => {
  const fact = parseKey(key);
  return fact ? `${fact.big} + ${fact.small}` : key;
};

/** "Step 2 of 5: Halves to 10 · 12 of 30 days done · 1 Golden Picnic Basket", or null if they haven't played. */
export async function wekaStudentSummary(student: string): Promise<string | null> {
  const s = await fetchWekaStudent(student);
  if (!s) return null;
  const stream = streamAfter(s.daysDone);
  const parts = [stepWords('weka', s.reached), `${stream.day} of ${DAYS_PER_BASKET} days done`];
  if (stream.baskets) parts.push(`${stream.baskets} Golden Picnic Basket${stream.baskets === 1 ? '' : 's'}`);
  if (s.hardest?.length) parts.push(`hardest: ${s.hardest.map(factWords).join(', ')}`);
  if (s.slip && SLIP_WORDS[s.slip]) parts.push(`usual slip: ${SLIP_WORDS[s.slip]}`);
  return parts.join(' · ');
}

/** The teacher's slip line: the commonest kind of first wrong choice, in plain words, or that none stands out yet. */
const slipLine = (slip: LandKind | null | undefined): string => (slip ? `Usual slip: ${SLIP_WORDS[slip]}` : 'No single slip stands out yet');

const when = (iso: string, options: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-NZ', options);

/** What a student's stream looks like now (the line on their page opens to this). */
export function WekaStudentPanel({ student }: { student: string }) {
  // Wrapped, because useSetting's null means "still loading" and the server's null means "not played".
  const loaded = useSetting(async () => ({ progress: await fetchWekaStudent(student) }), [student]);
  if (loaded.failed) return <p className="panel__empty">We couldn’t load Weka’s Stepping Stones for this student.</p>;
  if (!loaded.value) return <p className="panel__empty">Loading…</p>;
  if (!loaded.value.progress) return <p className="panel__empty">Not played yet.</p>;
  const { daysDone, lastStoneDay, reached, lastPlayed, hardest, slip } = loaded.value.progress;
  const stream = streamAfter(daysDone);
  const stones = METALS.map((metal) => [metal, stream.stones.filter((m) => m === metal).length] as const)
    .filter(([, n]) => n > 0)
    .map(([metal, n]) => `${n} ${metal}`)
    .join(', ');
  return (
    <section aria-label="Weka’s Stepping Stones">
      <p>
        Crossing with {FRIEND_NAMES[stream.friend]}. Stones: {stones}. On {stepWords('weka', reached)}.
        {lastStoneDay && <> Last stone changed {when(`${lastStoneDay}T12:00:00`, { weekday: 'long', day: 'numeric', month: 'long' })}.</>}
      </p>
      <p>
        Last played {when(lastPlayed, { weekday: 'long', day: 'numeric', month: 'long' })}. Golden Picnic Baskets so far: {stream.baskets}.
      </p>
      {hardest?.length ? <p>Finding these hardest: {hardest.map(factWords).join(', ')}.</p> : <p>No fact is giving trouble right now.</p>}
      <p>{slipLine(slip)}.</p>
    </section>
  );
}
