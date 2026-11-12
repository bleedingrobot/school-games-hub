import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { markSeasonNoteSeen } from '../data/trophies';
import './favourites.css';

/**
 * The once-only "new season" note (profile card P10). The server sends it to a pupil holding trophies from before this season;
 * it is marked seen as soon as it shows, so it never comes back.
 */
export function SeasonNote({ note }: { note: { season: number } | null | undefined }) {
  const [closed, setClosed] = useState(false);
  const season = note?.season;
  useEffect(() => {
    if (season) void markSeasonNoteSeen().catch(() => undefined);
  }, [season]);
  if (!season || closed) return null;
  return (
    <section className="season-note" aria-label={`Season ${season} has started`}>
      <span className="season-note__icon" aria-hidden="true">
        🏆
      </span>
      <p>
        <strong>Season {season} has started!</strong> Your trophies stay in your cabinet. Win them again this season to make
        them silver or gold. <Link to="/profile">See my cabinet</Link>
      </p>
      <button type="button" className="season-note__close" onClick={() => setClosed(true)} aria-label="Close">
        ✕
      </button>
    </section>
  );
}
