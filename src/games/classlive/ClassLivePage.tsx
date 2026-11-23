import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { Controller } from './Controller';
import { liveClassLiveLink } from './liveLink';

/** `/#/classlive?room=5`: the pupil's controller. A teacher gets the way to the big screen page instead. */
export function ClassLivePage() {
  const { profile } = useAuth();
  const [params] = useSearchParams();
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
  return <Controller link={liveClassLiveLink} me={profile.id} room={room} />;
}
