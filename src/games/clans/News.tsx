import type { Session } from './session';

/** The news: lines the computer writes (fights won, bosses beaten, buildings built, raids), and what raiders did to your clan. Clan names only. */
export function News({ session, onBack }: { session: Session; onBack: () => void }) {
  const news = session.news ?? [];
  const notes = session.notes ?? [];
  return (
    <section className="cq-place" aria-label="News">
      <div className="cq-place__head">
        <h2>News</h2>
        <button type="button" className="cq-btn" onClick={onBack}>Back</button>
      </div>
      {notes.length > 0 && (
        <div className="cq-panel" role="group" aria-label="Just for you">
          <h3>Just for you</h3>
          <ul>{notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      )}
      <div className="cq-panel">
        <h3>The last few days</h3>
        {news.length === 0 ? <p className="cq-soft">Nothing to report yet.</p> : <ul>{news.map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}</ul>}
        <p className="cq-soft">These lines are written by the game. They only ever name clans, never people.</p>
      </div>
    </section>
  );
}
