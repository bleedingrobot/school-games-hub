/**
 * Order Up! on the teacher pages (docs/ORDERUP-PLAN.md): the Games table's drawer with the help setting and the class's most
 * common mistakes, for the header's class. Loaded only when opened. The on/off switch is in the Games table row
 * (src/games/orderup/teacher.ts).
 */
import type { HelpSetting } from '../../shared/orderup/server';
import { fetchOrderUpClass, fetchOrderUpSettings, saveOrderUpSetting } from '../data/orderup';
import { SLIP_WORDS } from '../games/orderup/words';
import { SettingChoice, useSetting } from '../teacher/Settings';

const HELP_CHOICES = [
  { value: 'fade', label: 'Fades', detail: 'Each level starts on full help (the order card points to the rule before each step, and short bags come first). After good sets on two different days it steps down to hints after mistakes; a hard set brings full help back.' },
  { value: 'always', label: 'Always full', detail: 'The order card points to the rule before every step, on every level.' },
  { value: 'hints', label: 'Hints only', detail: 'A hint after each wrong tap, and nothing more: no walking down the order card together and no glowing pair.' },
] as const;

/** The drawer on the Games table, for the header's class. */
export function OrderUpTeacherSettings({ classId }: { classId: string }) {
  const settings = useSetting(() => fetchOrderUpSettings(classId), [classId]);
  const report = useSetting(() => fetchOrderUpClass(classId), [classId]);
  const slips = report.value?.slips.slice(0, 5) ?? [];
  return (
    <div className="panel teacher__switch">
      <SettingChoice<HelpSetting>
        label="Help"
        about="How much the order card helps with each step."
        options={HELP_CHOICES}
        value={settings.value?.help ?? null}
        loadFailed={settings.failed}
        save={(help) => saveOrderUpSetting({ help }, classId)}
      />
      {settings.value?.enabled === false && <p className="panel__empty">Order Up! is off for this class, so this only matters once it’s on.</p>}
      <h4>Common mistakes (last 30 days)</h4>
      {report.failed ? (
        <p className="panel__empty">We couldn’t load the class’s mistakes.</p>
      ) : !report.value ? (
        <p className="panel__empty">Loading…</p>
      ) : slips.length ? (
        <ul>
          {slips.map((s) => <li key={s.kind}>{SLIP_WORDS[s.kind] ?? s.kind}: {s.pupils} pupil{s.pupils === 1 ? '' : 's'}</li>)}
        </ul>
      ) : (
        <p className="panel__empty">No mistakes yet.</p>
      )}
    </div>
  );
}
