/**
 * /#/badge/<code>: where a pupil's QR badge takes them (docs/BADGE-SIGN-IN-PLAN.md). Signs them in, then loads the home
 * page afresh, the same way a Google sign-in comes back to the site, so every part of the site starts out signed in as
 * this pupil. Whoever was signed in on this device before is swapped for the badge's pupil.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { codeFromScan, signInWithBadge } from '../data/badge';
import { FriendlyError } from '../data/profile';
import { freshUrl } from '../freshLoad';
import './badges.css';

/** Open the home page with a full page load (not just a change of page inside the site). */
export function openHomeAfresh(go: (url: string) => void = (url) => window.location.replace(url)): void {
  go(freshUrl({ pathname: window.location.pathname, search: window.location.search, hash: '#/' }));
}

export function BadgeSignIn({ goHome = openHomeAfresh }: { goHome?: () => void } = {}) {
  const { code: raw = '' } = useParams();
  const [problem, setProblem] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = codeFromScan(raw);
    if (!code) {
      setProblem('That isn’t a sign-in badge.');
      return;
    }
    signInWithBadge(code).then(
      () => goHome(),
      (e: unknown) => setProblem(e instanceof FriendlyError ? e.message : 'That badge didn’t work. Try again.'),
    );
  }, [raw, goHome]);

  return (
    <main id="main" className="badge-in">
      {problem ? (
        <div className="badge-in__card" role="alert">
          <p className="badge-in__big" aria-hidden="true">🙈</p>
          <h1>Oops!</h1>
          <p>{problem}</p>
          <Link className="button button--primary" to="/sign-in" replace>
            Try again
          </Link>
        </div>
      ) : (
        <div className="badge-in__card" role="status">
          <p className="badge-in__big badge-in__spin" aria-hidden="true">⭐</p>
          <h1>Signing you in…</h1>
        </div>
      )}
    </main>
  );
}
