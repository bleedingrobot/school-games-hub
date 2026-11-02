import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useNonMathsGamesOpen } from '../data/nonMathsGames';

/**
 * Wraps a non-maths game's page (data/nonMathsGames.ts): once the class's row says those games are off, the pupil sees a
 * friendly "off for now" screen instead. `on` false skips the check (a maths game on the same page component).
 */
export function NonMathsGate({ on = true, children }: { on?: boolean; children: ReactNode }) {
  const open = useNonMathsGamesOpen();
  // Open while the class's row loads (the switch is on unless a teacher turned it off), so a slow connection never holds a game up.
  if (!on || open !== false) return <>{children}</>;
  return (
    <section className="coming-soon" aria-labelledby="non-maths-off-title">
      <div className="coming-soon__emoji" aria-hidden="true">
        🧮
      </div>
      <h1 id="non-maths-off-title">Maths games only for now</h1>
      <div className="coming-soon__text">
        <p>Your teacher has turned off the non-maths games for your class. Try one of the maths games instead!</p>
        <p>Any game you had going is kept safe for later.</p>
      </div>
      <Link className="button button--primary" to="/">
        Back to home
      </Link>
    </section>
  );
}
