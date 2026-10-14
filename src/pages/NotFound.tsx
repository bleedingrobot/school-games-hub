import { Link } from 'react-router';

export function NotFound() {
  return (
    <section className="coming-soon">
      <div className="coming-soon__emoji" aria-hidden="true">
        🧭
      </div>
      <h1>Oops, wrong square!</h1>
      <p>We couldn't find that page.</p>
      <Link className="button button--primary" to="/">
        Back to home
      </Link>
    </section>
  );
}
