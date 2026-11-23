import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { Controller } from './Controller';
import { liveShowdownLink } from './liveLink';

/** `/#/showdown?room=5`: the pupil's controller. A teacher gets the way to the projector page instead. */
export function ShowdownPage() {
  const { profile } = useAuth();
  const [params] = useSearchParams();
  if (!profile) return null;
  if (profile.role === 'teacher') {
    return (
      <section className="coming-soon">
        <h1>Class Showdown</h1>
        <p className="coming-soon__text">You run this one from the projector page.</p>
        <p>
          <Link className="button button--primary" to="/teacher/showdown">Open the projector page</Link>
        </p>
      </section>
    );
  }
  const raw = Number(params.get('room'));
  const room = Number.isInteger(raw) && raw > 0 ? raw : undefined;
  return <Controller link={liveShowdownLink} me={profile.id} room={room} />;
}
