/**
 * Kiwi's Beanstalk on the teacher pages (docs/BEANSTALK-PLAN.md, Stage 4): the Games table's drawer with the leaves'
 * dots on or off for the header's class, and one line on a student's page. Loaded only when opened. The on/off switch is
 * in the Games table row (src/games/beanstalk/teacher.ts).
 */
import { DAYS_PER_EGG, stalkAfter } from '../../shared/beanstalk/progress';
import { fetchBeanstalkSettings, fetchBeanstalkStudent, saveBeanstalkSetting } from '../data/beanstalk';
import { SettingToggle, useSetting } from '../teacher/Settings';

/** The drawer on the Games table, for the header's class. */
export function BeanstalkTeacherSettings({ classId }: { classId: string }) {
  const settings = useSetting(() => fetchBeanstalkSettings(classId), [classId]);
  return (
    <div className="panel teacher__switch">
      <SettingToggle
        label="Dots on the leaves"
        about="On: each leaf shows a ten-frame of dots to count, full at first, then small, then gone as the beanstalk turns gold. Off: numbers only, from the first day."
        value={settings.value?.dots ?? null}
        loadFailed={settings.failed}
        save={(on) => saveBeanstalkSetting({ dots: on }, classId)}
      />
      {settings.value?.enabled === false && <p className="panel__empty">Kiwi’s Beanstalk is off for this class, so this only matters once it’s on.</p>}
    </div>
  );
}

/** "Day 12 of 30 · 1 Golden Egg", or null if they haven't played. */
export async function beanstalkStudentSummary(student: string): Promise<string | null> {
  const s = await fetchBeanstalkStudent(student);
  if (!s) return null;
  const stalk = stalkAfter(s.daysDone);
  const parts = [`${stalk.day} of ${DAYS_PER_EGG} days done on this beanstalk`];
  if (stalk.eggs) parts.push(`${stalk.eggs} Golden ${stalk.eggs === 1 ? 'Egg' : 'Eggs'}`);
  return parts.join(' · ');
}
