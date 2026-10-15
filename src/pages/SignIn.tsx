import { Navigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import banner from '../assets/dps-banner.png';
import kids from '../assets/dps-kids.png';

export function SignIn() {
  const { status, message, signIn } = useAuth();
  if (status === 'signed-in') return <Navigate to="/" replace />;

  return (
    <main id="main" className="signin">
      <section className="signin__intro">
        <img className="signin__banner" src={banner} alt="Douglas Park School: nurture, explore, create" width={412} height={77} />
        <h1>School Games Hub</h1>
        <p className="signin__lead">
          Play chess, checkers, Wormholes &amp; Black Holes and 101 against bots or your classmates.
        </p>
        <img className="signin__kids" src={kids} alt="" width={235} height={241} />
      </section>
      <section className="signin__card" aria-labelledby="signin-title">
        <div className="signin__head">
          <span className="signin__logo" aria-hidden="true">
            🎲
          </span>
          <div>
            <h2 id="signin-title">Student sign in</h2>
            <p className="signin__note">Use your Douglas Park school account.</p>
          </div>
        </div>
        {message && (
          <p className="signin__message" role="alert">
            {message}
          </p>
        )}
        <button
          type="button"
          className="button button--google"
          onClick={() => void signIn()}
          disabled={status === 'loading'}
        >
          <GoogleLogo /> Sign in with your school Google account
        </button>
        <div className="signin__list">
          <h3>What you can do</h3>
          <ol>
            <li>Play four games against friendly bots.</li>
            <li>Play classmates with a game code.</li>
            <li>Earn points, badges and achievements.</li>
            <li>Climb the school leaderboard.</li>
            <li>Make your own avatar.</li>
          </ol>
        </div>
      </section>
    </main>
  );
}

function GoogleLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.9-6.2z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.2C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}
