import { Link } from 'react-router';
import { AvatarImage } from '../avatar/AvatarImage';
import type { RecentTrophy } from '../data/boards';
import { TrophyArt } from './TrophyArt';
import './recentTrophies.css';

const METAL: Record<RecentTrophy['tier'], string> = { bronze: 'bronze', silver: 'silver', gold: 'gold' };

/**
 * The home page's "New trophies" strip (leaderboard plan L3): who won which trophy this week at my school, and what for, in the
 * trophy's own "how to win" words. Comes in the home page's one request; nothing shows when nobody won one this week.
 */
export function RecentTrophies({ trophies }: { trophies: RecentTrophy[] }) {
  if (trophies.length === 0) return null;
  return (
    <section className="recent-trophies" aria-labelledby="recent-trophies-title">
      <div className="recent-trophies__head">
        <h2 id="recent-trophies-title">🏆 New trophies</h2>
        <Link to="/leaderboard?board=hall" className="recent-trophies__all">
          Hall of fame
        </Link>
      </div>
      <ul className="recent-trophies__list">
        {trophies.map((t) => (
          <li key={`${t.trophy}-${t.at}-${t.name ?? ''}`} className="recent-trophies__item">
            <TrophyArt id={t.trophy} game={t.game} kind={t.kind} tier={t.tier} size={44} />
            <span className="recent-trophies__text">
              <span className="recent-trophies__who">
                <AvatarImage avatar={t.avatar} size={22} />
                <strong>{t.name ?? 'A classmate'}</strong>
              </span>
              <span className="recent-trophies__what">
                {t.title}
                {t.kind === 'trophy' && <span className="recent-trophies__metal"> · {METAL[t.tier]}</span>}
              </span>
              <span className="recent-trophies__how">{t.how}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
