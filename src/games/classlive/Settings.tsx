import { Link } from 'react-router';
import { fetchClassLiveNames, saveClassLiveNames } from '../../data/classlive';
import { SettingToggle, useSetting } from '../../teacher/Settings';

/** Class Live's drawer on the Games table: first names on the big screen, and the way to the projector page. */
export function ClassLiveSettings({ classId }: { classId: string }) {
  const names = useSetting(() => fetchClassLiveNames(classId), [classId]);
  return (
    <div className="panel teacher__switch">
      <SettingToggle
        label="Show first names on the big screen"
        about="On: the projector shows students' first names next to the facts they find and in the shout-outs. Off: it shows coloured dots only."
        value={names.value}
        loadFailed={names.failed}
        save={(on) => saveClassLiveNames(on, classId)}
      />
      <p>
        <Link to={`/teacher/${classId}/classlive`}>Open the big screen</Link>
      </p>
    </div>
  );
}
