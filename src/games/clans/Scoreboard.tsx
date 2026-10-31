import { useEffect, useState } from 'react';
import type { HallRow } from '../../data/clans';
import { Hall } from './Hall';
import { pretendBoard, type ScoreRow } from './fame';
import type { Session } from './session';
import { bannerArt } from './art';

/**
 * The Scoreboard: the top ten clans by fame, and your own clan. Clan names and fame only: no pupil's name, and never anything about maths.
 * With a server the rows come from the database (`load`); on the test page they are pretend clans.
 */
export function Scoreboard({ session, load, hall, onBack }: { session: Session; load?: () => Promise<ScoreRow[]>; hall?: () => Promise<HallRow[] | null>; onBack: () => void }) {
  const [rows, setRows] = useState<ScoreRow[] | null>(load ? null : pretendBoard(session));
  const [failed, setFailed] = useState(false);
  const [showHall, setShowHall] = useState(false);
  /** The Hall button shows only once the database has said it has a Hall (an older database does not). */
  const [hallThere, setHallThere] = useState(false);
  useEffect(() => {
    if (!hall) return;
    let current = true;
    hall().then((r) => current && setHallThere(r !== null), () => current && setHallThere(true));
    return () => {
      current = false;
    };
  }, [hall]);

  useEffect(() => {
    if (!load) {
      setRows(pretendBoard(session));
      return;
    }
    let current = true;
    setFailed(false);
    load().then((r) => current && setRows(r), () => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [load, session.fame, session]);

  if (showHall && hall) return <Hall load={hall} onBack={() => setShowHall(false)} />;
  return (
    <section className="cq-scoreboard" aria-label="Scoreboard">
      <h2>Scoreboard</h2>
      <p className="cq-soft">
        Season {session.season ?? 1}. Fame comes from winning in the Mines, beating bosses, wars and raids, and from helping the class build in the village.
        It never comes from maths scores. Only clan names are shown.
      </p>
      <p>Your fame: <strong>{session.fame ?? 0}</strong></p>
      {failed ? (
        <p className="cq-note" role="alert">We couldn't load the scoreboard just now.</p>
      ) : !rows ? (
        <p role="status">Loading the scoreboard…</p>
      ) : (
        <table className="cq-table">
          <caption className="cq-soft">The top ten clans by fame, and your clan</caption>
          <thead>
            <tr><th scope="col">Place</th><th scope="col">Clan</th><th scope="col">Fame</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.place}-${r.name}-${r.isMe}`} className={r.isMe ? 'cq-me' : undefined} aria-current={r.isMe ? 'true' : undefined}>
                <td>{r.place}</td>
                <th scope="row">{bannerArt(r.name) ? <img className="cq-rowbanner" src={bannerArt(r.name)} alt="" /> : <span className="cq-rowbanner" aria-hidden="true" />}{r.name}{r.isMe && <span className="cq-soft"> (you)</span>}</th>
                <td>{r.fame}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="cq-actions">
        {hall && hallThere && <button type="button" className="cq-btn cq-btn--hot" onClick={() => setShowHall(true)}>Hall of Legends</button>}
        <button type="button" className="cq-btn" onClick={onBack}>Back to the clan</button>
      </div>
    </section>
  );
}
