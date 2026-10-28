import { fetchMarbleSwitches, saveMarbleRescue } from '../data/marble';
import { SettingToggle, useSetting } from '../teacher/Settings';

/**
 * Marble Rush's settings drawer on the Games table (docs/MARBLE-PLAN.md, section 7.3). The maths switch is in the table row;
 * the rescue questions after a fall are here. They only happen when maths is on, so with maths off there is nothing to switch.
 */
export function MarbleTeacherSettings({ classId }: { classId: string }) {
  const switches = useSetting(() => fetchMarbleSwitches(classId), [classId]);
  return (
    <div className="panel teacher__switch">
      {switches.value?.maths === 'off' ? (
        <p className="panel__empty">Rescue questions are off while Marble Rush maths is off. Turn maths on in the table to use them.</p>
      ) : (
        <SettingToggle
          label="Rescue questions"
          about="After a fall, a right answer takes back the time the fall cost. Off: falls just cost their few seconds, with no question."
          value={switches.value?.rescue ?? null}
          loadFailed={switches.failed}
          save={(on) => saveMarbleRescue(on, classId)}
        />
      )}
    </div>
  );
}
