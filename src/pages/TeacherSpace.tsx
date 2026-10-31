import { fetchReactionsEnabled } from '../data/spaceGames';
import { setSpaceReactions } from '../data/teacher';
import { SettingToggle, useSetting } from '../teacher/Settings';

/**
 * Wormholes & Black Holes' settings drawer on the Games table. The maths switch is in the table row; reactions are here (and on
 * Today, with the other lesson controls).
 */
export function SpaceTeacherSettings({ classId }: { classId: string }) {
  const reactions = useSetting(() => fetchReactionsEnabled(classId), [classId]);
  return (
    <div className="panel teacher__switch">
      <SettingToggle
        label="Emoji reactions"
        about="In Wormholes & Black Holes games with classmates."
        value={reactions.value}
        loadFailed={reactions.failed}
        save={(on) => setSpaceReactions(on, classId)}
      />
    </div>
  );
}
