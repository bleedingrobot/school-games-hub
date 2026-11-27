/**
 * The Class Live card on the teacher's Today page and the main home page: just the title, a line about it and the
 * button to the game picker (James, 27 Nov 2026 NZ: the game tiles and set-time strip came off).
 */
import { Link } from 'react-router';
import { classliveOn } from '../games/classlive/switch';
import { painted } from '../games/classlive/paintedArt';
import './class-live-card.css';

export function ClassLiveCard({ classId }: { classId: string }) {
  if (!classliveOn()) return null;
  const hall = painted('pick', 'hall', true);
  return (
    <section className="panel cl-today" aria-labelledby="cl-today-title" style={hall ? { ['--hall' as string]: `url(${hall})` } : undefined}>
      <div className="cl-today__top">
        <div>
          <h2 id="cl-today-title" className="cl-today__title">🌟 Class Live</h2>
          <p className="cl-today__sub">Whole-class games on the big screen. Pupils join on their iPads.</p>
        </div>
        <Link className="cl-today__go" to={`/teacher/${classId}/classlive`}>Open Class Live →</Link>
      </div>
    </section>
  );
}
