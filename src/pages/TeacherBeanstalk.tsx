/**
 * Kiwi's Beanstalk on the teacher pages (docs/BEANSTALK-PLAN.md, Stage 4): the Games table's drawer with the leaves'
 * dots on or off for the header's class, and one line on a student's page that opens to show their beanstalk. Loaded only
 * when opened. The on/off switch is in the Games table row (src/games/beanstalk/teacher.ts).
 */
import { dotsFor, DAYS_PER_EGG, METALS, stageTarget, stalkAfter } from '../../shared/beanstalk/progress';
import { fetchBeanstalkSettings, fetchBeanstalkStudent, saveBeanstalkSetting } from '../data/beanstalk';
import { FRIEND_NAMES } from '../games/beanstalk/art';
import { SLIP_WORDS } from '../games/beanstalk/words';
import type { MistakeKind } from '../../shared/beanstalk/round';
import { SettingToggle, useSetting } from '../teacher/Settings';

/** The drawer on the Games table, for the header's class. */
export function BeanstalkTeacherSettings({ classId }: { classId: string }) {
  const settings = useSetting(() => fetchBeanstalkSettings(classId), [classId]);
  return (
    <div className="panel teacher__switch">
      <SettingToggle
        label="Dots on the leaves"
        about="On: each leaf shows a ten-frame of dots to count. Each student’s dots follow how they are doing: they fade after two good days in a row and come back after a hard one. Off: numbers only for everyone."
        value={settings.value?.dots ?? null}
        loadFailed={settings.failed}
        save={(on) => saveBeanstalkSetting({ dots: on }, classId)}
      />
      {settings.value?.enabled === false && <p className="panel__empty">Kiwi’s Beanstalk is off for this class, so this only matters once it’s on.</p>}
    </div>
  );
}

/** "Bonds to 100 · day 12 of 30 on this beanstalk · 1 Golden Egg" (their own sum), or null if they haven't played. */
export async function beanstalkStudentSummary(student: string): Promise<string | null> {
  const s = await fetchBeanstalkStudent(student);
  if (!s) return null;
  const stalk = stalkAfter(s.daysDone);
  const parts = [`Bonds to ${stageTarget(s)}`, `${stalk.day} of ${DAYS_PER_EGG} days done on this beanstalk`];
  if (stalk.eggs) parts.push(`${stalk.eggs} Golden ${stalk.eggs === 1 ? 'Egg' : 'Eggs'}`);
  if (s.slip) parts.push(`usual slip: ${SLIP_WORDS[s.slip]}`);
  return parts.join(' · ');
}

/** The teacher's slip line: the commonest kind of first wrong choice, in plain words, or that none stands out yet. */
const slipLine = (slip: MistakeKind | null | undefined): string => (slip ? `Usual slip: ${SLIP_WORDS[slip]}` : 'No single slip stands out yet');

const DOTS = { full: 'full ten-frames', small: 'small ten-frames', none: 'numbers only' } as const;

/** What a student's beanstalk looks like now (the line on their page opens to this). */
export function BeanstalkStudentPanel({ student }: { student: string }) {
  // Wrapped, because useSetting's null means "still loading" and the server's null means "not played".
  const loaded = useSetting(async () => ({ progress: await fetchBeanstalkStudent(student) }), [student]);
  if (loaded.failed) return <p className="panel__empty">We couldn’t load Kiwi’s Beanstalk for this student.</p>;
  if (!loaded.value) return <p className="panel__empty">Loading…</p>;
  if (!loaded.value.progress) return <p className="panel__empty">Not played yet.</p>;
  const { daysDone, lastLeafDay, help, stage, slip } = loaded.value.progress;
  const stalk = stalkAfter(daysDone);
  const leaves = METALS.map((metal) => [metal, stalk.leaves.filter((m) => m === metal).length] as const)
    .filter(([, n]) => n > 0)
    .map(([metal, n]) => `${n} ${metal}`)
    .join(', ');
  return (
    <section aria-label="Kiwi’s Beanstalk">
      <p>
        Helping {FRIEND_NAMES[stalk.friend]} with pairs that make {stageTarget({ stage })}. Leaves: {leaves}.
        {lastLeafDay && <> Last leaf changed {new Date(`${lastLeafDay}T12:00:00`).toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' })}.</>}
      </p>
      <p>Next time the leaves show {DOTS[dotsFor(help)]} (unless dots are off for the class). The dots follow how their days go: two good days in a row (8 or more of 10 pairs right first time) take a step off, a hard day brings one back. Golden Eggs so far: {stalk.eggs}.</p>
      <p>{slipLine(slip)}.</p>
    </section>
  );
}
