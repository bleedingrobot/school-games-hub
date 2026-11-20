import { useState } from 'react';
import { Link } from 'react-router';
import { newsToShow, NEWS_SHOWN, type NewsItem } from './hubNews';
import './whats-new.css';

const keyFor = (me: string) => `hub-news-seen:${me}`;

function readSeen(me: string): string[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(keyFor(me)) ?? '[]');
    return Array.isArray(saved) ? saved.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function writeSeen(me: string, ids: string[]) {
  try {
    window.localStorage.setItem(keyFor(me), JSON.stringify(ids.slice(-60)));
  } catch {
    /* it just shows again next time */
  }
}

/**
 * The small "What's new" box at the top of the home page. It shows the newest few lines (hubNews.ts). Lines this device hasn't
 * seen yet have a "New" tag; ✕ marks them all seen and hides the box until something newer goes live.
 */
export function WhatsNew({ me, today, canSee }: { me: string; today: string; canSee: (game: string) => boolean }) {
  const news = newsToShow(today, canSee);
  const [seen, setSeen] = useState<string[]>(() => readSeen(me));
  const [more, setMore] = useState(false);
  const unseen = news.filter((n) => !seen.includes(n.id));
  if (unseen.length === 0) return null;
  // Unseen lines first, then the rest, newest first in each.
  const ordered = [...unseen, ...news.filter((n) => seen.includes(n.id))];
  const shown = more ? ordered : ordered.slice(0, NEWS_SHOWN);
  const close = () => {
    const all = [...new Set([...seen, ...news.map((n) => n.id)])];
    writeSeen(me, all);
    setSeen(all);
  };
  return (
    <section className="whats-new" aria-labelledby="whats-new-title">
      <div className="whats-new__head">
        <h2 id="whats-new-title" className="whats-new__title">
          <span aria-hidden="true">✨</span> What’s new
        </h2>
        <button type="button" className="whats-new__close" onClick={close} aria-label="Got it, hide what’s new">
          ✕
        </button>
      </div>
      <ul className="whats-new__list">
        {shown.map((n) => (
          <NewsLine key={n.id} item={n} isNew={!seen.includes(n.id)} />
        ))}
      </ul>
      {ordered.length > NEWS_SHOWN && (
        <button type="button" className="whats-new__more" onClick={() => setMore((m) => !m)} aria-expanded={more}>
          {more ? 'Less' : `${ordered.length - NEWS_SHOWN} more`}
        </button>
      )}
    </section>
  );
}

function NewsLine({ item, isNew }: { item: NewsItem; isNew: boolean }) {
  const to = item.to ?? (item.game ? `/${item.game}` : undefined);
  return (
    <li className="whats-new__item">
      <span className="whats-new__emoji" aria-hidden="true">
        {item.emoji}
      </span>
      <p>
        {isNew && <span className="whats-new__tag">New</span>}
        <strong>{item.title}:</strong> {item.text}
        {to && (
          <>
            {' '}
            <Link to={to}>Have a look</Link>
          </>
        )}
      </p>
    </li>
  );
}
