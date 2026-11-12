/** After a Sky Dash: walls flown past, the best, and the class board this season (docs/TOON-FLAP-PLAN.md, section 9). */
import { useEffect, useRef } from 'react';
import type { DashBoard, DashFinishReply } from './backend';
import { PotionIcon } from './MapScreen';
import { DASH_LINES, RESULT_LINES } from './guide';

export function DashBoardTable({ board }: { board: DashBoard }) {
  const mineShown = board.rows.some((r) => r.me);
  const rows = mineShown || !board.mine ? board.rows : [...board.rows, board.mine];
  if (rows.length === 0) return <p className="tf-dim">No dashes in your class yet this season.</p>;
  return (
    <table className="tf-table tf-board">
      <caption className="tf-h3">Class board this season</caption>
      <thead><tr><th scope="col">Place</th><th scope="col">Name</th><th scope="col">Walls</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.place}-${i}`} className={r.me ? 'tf-board__me' : undefined}>
            <td>{r.place}</td>
            <td>{r.me && r.name !== 'You' ? `${r.name} (you)` : r.name}</td>
            <td>{r.walls}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DashResults({ reply, onAgain, onMap, talk }: {
  reply: DashFinishReply | null;
  onAgain: () => void;
  onMap: () => void;
  talk?: (text: string) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    talk?.(!reply ? RESULT_LINES.notChecked : reply.seasonBest ? DASH_LINES.seasonBest : DASH_LINES.over);
    // Said once, as the results open.
  }, []);
  if (!reply) {
    return (
      <section className="tf-results" aria-labelledby="tf-res-h">
        <h2 id="tf-res-h" className="tf-h" tabIndex={-1} ref={heading}>Sky Dash</h2>
        <p className="tf-card-note">{RESULT_LINES.notChecked}</p>
        <div className="tf-row">
          <button type="button" className="tf-btn tf-btn--big" onClick={onAgain}>Dash again</button>
          <button type="button" className="tf-btn tf-btn--ghost" onClick={onMap}>Map</button>
        </div>
      </section>
    );
  }
  return (
    <section className="tf-results" aria-labelledby="tf-res-h">
      <h2 id="tf-res-h" className="tf-h" tabIndex={-1} ref={heading}>Sky Dash</h2>
      <div className="tf-results__main">
        <div className="tf-results__big">
          <p className="tf-results__time" aria-label={`${reply.walls} walls`}>{reply.walls}<small> walls</small></p>
          <p className="tf-dim">Your best ever: {reply.best} walls</p>
          {reply.feathersUsed > 0 && <p>🪶 Spare feathers saved you {reply.feathersUsed} {reply.feathersUsed === 1 ? 'time' : 'times'}.</p>}
          {reply.potionUsed && <p><PotionIcon size={18} /> Your potion brought you back once.</p>}
        </div>
        {reply.board && <DashBoardTable board={reply.board} />}
      </div>
      {(reply.seasonBest || reply.newBest) && (
        <div className="tf-party" role="status">
          {reply.newBest && <p className="tf-party__line">⭐ New best ever!</p>}
          {reply.seasonBest && !reply.newBest && <p className="tf-party__line">⭐ {DASH_LINES.seasonBest}</p>}
        </div>
      )}
      <div className="tf-row tf-row--end">
        <button type="button" className="tf-btn tf-btn--big tf-btn--play" onClick={onAgain}>Dash again</button>
        <button type="button" className="tf-btn tf-btn--ghost" onClick={onMap}>Map</button>
      </div>
    </section>
  );
}
