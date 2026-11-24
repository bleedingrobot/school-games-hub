import { useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { supabase } from '../../lib/supabase';
import { showdownOn } from '../showdown/switch';
import { useAuth } from '../../auth/AuthContext';
import { Controller } from './Controller';
import { liveClassLiveLink } from './liveLink';

/** `/#/classlive?room=5`: the pupil's controller. A teacher gets the way to the big screen page instead. */
export function ClassLivePage() {
  const { profile } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // A Class Showdown waiting for this pupil: go to it (both games live on the one Class Live card).
  const lookElsewhere = useCallback(() => {
    void Promise.resolve(supabase.rpc('showdown_here')).then(({ data }) => {
      const room = Array.isArray(data) ? Number((data[0] as { room?: unknown } | undefined)?.room) : NaN;
      if (Number.isSafeInteger(room) && room > 0) navigate(`/showdown?room=${room}`);
    }, () => undefined);
  }, [navigate]);
  if (!profile) return null;
  if (profile.role === 'teacher') {
    return (
      <section className="coming-soon">
        <h1>Class Live</h1>
        <p className="coming-soon__text">You run this one from the big screen page.</p>
        <p>
          <Link className="button button--primary" to="/teacher/classlive">Open the big screen</Link>
        </p>
      </section>
    );
  }
  const raw = Number(params.get('room'));
  const room = Number.isInteger(raw) && raw > 0 ? raw : undefined;
  const typed = params.get('code');
  const code = typed && /^\d{4}$/.test(typed) ? typed : undefined;
  return <Controller link={liveClassLiveLink} me={profile.id} room={room} code={code} avatar={profile.avatar} lookElsewhere={showdownOn() && !room ? lookElsewhere : undefined} />;
}
