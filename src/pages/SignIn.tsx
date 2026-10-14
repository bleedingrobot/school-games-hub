import { Link } from 'react-router';

/** Placeholder only. Real Google sign-in arrives in Stage 3. */
export function SignIn() {
  return (
    <main id="main" className="signin">
      <div className="signin__card">
        <div className="signin__logo" aria-hidden="true">
          🎲
        </div>
        <h1>School Games Hub</h1>
        <p>Play chess and checkers with your classmates.</p>
        <button type="button" className="button button--google" disabled aria-describedby="signin-note">
          Sign in with your school Google account
        </button>
        <p id="signin-note" className="signin__note">
          Sign-in isn't switched on yet — coming soon!
        </p>
        <Link to="/">Look around the hub</Link>
      </div>
    </main>
  );
}
