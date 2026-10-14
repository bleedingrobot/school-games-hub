import type { ReactNode } from 'react';
import { Link } from 'react-router';

export function ComingSoon({ emoji, title, children }: { emoji: string; title: string; children: ReactNode }) {
  return (
    <section className="coming-soon">
      <div className="coming-soon__emoji" aria-hidden="true">
        {emoji}
      </div>
      <h1>{title}</h1>
      <p className="coming-soon__tag">Coming soon!</p>
      <div className="coming-soon__text">{children}</div>
      <Link className="button button--primary" to="/">
        Back to home
      </Link>
    </section>
  );
}
