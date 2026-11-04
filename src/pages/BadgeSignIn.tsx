/**
 * /#/badge/<code>: where a pupil's QR badge takes them (docs/BADGE-SIGN-IN-PLAN.md). Signs them in, then opens the home page.
 * Whoever was signed in on this device before is swapped for the badge's pupil.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { codeFromScan, signInWithBadge } from '../data/badge';
import { FriendlyError } from '../data/profile';
import './badges.css';

export function BadgeSignIn() {
  const { code: raw = '' } = useParams();
  const { status, profile } = useAuth();
  const [who, setWho] = useState<string | null>(null);
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
    signInWithBadge(code).then(setWho, (e: unknown) =>
      setProblem(e instanceof FriendlyError ? e.message : 'That badge didn’t work. Try again.'),
    );
  }, [raw]);

  // In once the site has loaded this pupil's own profile (not the last person's on this device).
  if (who && status === 'signed-in' && profile?.id === who) return <Navigate to="/" replace />;

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
