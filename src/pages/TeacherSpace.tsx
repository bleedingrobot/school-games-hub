import { Link } from 'react-router';

/**
 * Wormholes & Black Holes' settings drawer on the Games table. The maths switch is in the table row; the emoji reactions switch
 * is only on Today, with the other lesson controls.
 */
export function SpaceTeacherSettings({ classId }: { classId: string }) {
  return (
    <div className="panel teacher__switch">
      <p>
        Emoji reactions are on the <Link to={`/teacher/${classId}`}>Today tab</Link>.
      </p>
    </div>
  );
}
