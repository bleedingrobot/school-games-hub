import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchMyClass, myClassFrom } from '../data/classes';
import { partOf, type HomePage } from '../data/homePage';

const SKIP_KEY = 'classWarpSkipped';

function wasSkipped(): boolean {
  try {
    return window.localStorage.getItem(SKIP_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * The "Join your class" step for a student who isn't in a class yet. Skippable: a student with no class plays
 * everything. Once they skip, the Class Warp button on the home page is still there for later.
 *
 * On the home page it takes its part of the page's one request (`homePage`, null while that is on its way); anywhere else it asks
 * for itself.
 */
export function ClassWarpCard({ homePage }: { homePage?: Promise<HomePage> | null }) {
  const [needsClass, setNeedsClass] = useState(false);
  const [skipped, setSkipped] = useState(wasSkipped);

  useEffect(() => {
    if (homePage === null) return;
    let current = true;
    partOf(homePage, 'myClass', myClassFrom, fetchMyClass)
      .then((mine) => current && setNeedsClass(mine.className === null && mine.waitingFor === null))
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [homePage]);

  if (!needsClass || skipped) return null;
  return (
    <section className="in-progress" aria-label="Join your class">
      <div className="in-progress__item class-warp-card">
        <span className="in-progress__emoji" aria-hidden="true">
          🌀
        </span>
        <p>
          <strong>Join your class!</strong> Got a code from your teacher? Type it in to warp into your class.
        </p>
        <Link to="/warp" className="button button--play">
          Join
        </Link>
        <button
          type="button"
          className="button button--light-outline class-warp-card__skip"
          onClick={() => {
            try {
              window.localStorage.setItem(SKIP_KEY, '1');
            } catch {
              /* private window: it just comes back next time */
            }
            setSkipped(true);
          }}
        >
          Not now
        </button>
      </div>
    </section>
  );
}
