import { Link } from 'react-router';
import { fetchShowdownNames, saveShowdownNames } from '../../data/showdown';
import { SettingToggle, useSetting } from '../../teacher/Settings';

/** Class Showdown's drawer on the Games table: first names on the big screen, and the way to the projector page. */
export function ShowdownSettings({ classId }: { classId: string }) {
  const names = useSetting(() => fetchShowdownNames(classId), [classId]);
  return (
    <div className="panel teacher__switch">
      <SettingToggle
        label="Show first names on the big screen"
        about="On: the projector shows students' first names (the leaderboard, big moves, the recap). Off: it shows team colours and numbers only."
        value={names.value}
        loadFailed={names.failed}
        save={(on) => saveShowdownNames(on, classId)}
      />
      <p>
        <Link to={`/teacher/${classId}/showdown`}>Open the projector page</Link>
      </p>
    </div>
  );
}
