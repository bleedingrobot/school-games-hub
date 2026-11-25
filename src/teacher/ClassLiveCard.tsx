/**
 * The Class Live card near the top of the teacher's Today page (James, 25 Nov 2026 NZ): every Class Live game as a
 * small painted tile. A tile opens the Class Live page on that game's options; the button opens the game picker.
 */
import { Link } from 'react-router';
import { LIVE_GAMES } from '../games/classlive/gameList';
import { classliveOn } from '../games/classlive/switch';
import { painted } from '../games/classlive/paintedArt';
import { showdownOn } from '../games/showdown/switch';
import './class-live-card.css';

export function ClassLiveCard({ classId }: { classId: string }) {
  if (!classliveOn()) return null;
  const base = `/teacher/${classId}/classlive`;
  const games = LIVE_GAMES.filter((g) => g.id !== 'showdown' || showdownOn());
  const hall = painted('pick', 'hall', true);
  return (
    <section className="panel cl-today" aria-labelledby="cl-today-title" style={hall ? { ['--hall' as string]: `url(${hall})` } : undefined}>
      <div className="cl-today__top">
        <div>
          <h2 id="cl-today-title" className="cl-today__title">🌟 Class Live</h2>
          <p className="cl-today__sub">Whole-class games on the big screen. Pupils join on their iPads.</p>
        </div>
        <Link className="cl-today__go" to={base}>Open Class Live →</Link>
      </div>
      <ul className="cl-today__games">
        {games.map((g) => {
          const pic = g.pic();
          return (
            <li key={g.id}>
              <Link className="cl-today__game" to={`${base}?pick=${g.id}`} style={{ ['--tint' as string]: g.tint }}>
                <span className="cl-today__pic" aria-hidden="true">{pic ? <img src={pic} alt="" loading="lazy" /> : <i>{g.emoji}</i>}</span>
                <b>{g.name}</b>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
