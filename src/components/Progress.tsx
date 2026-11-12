import { Link } from 'react-router';
import { RANKS, type Achievement, type MyProgress, type Rank } from '../data/progress';
import type { TrophyShelf } from '../data/trophies';
import { TrophyCount } from '../trophies/FavouriteTrophies';
import { gameLabel } from '../games/registry';

export function RankBadge({ rank, game }: { rank: Rank; game?: string }) {
  const { label, emoji } = RANKS[rank];
  const gameName = game ? gameLabel(game) : undefined;
  return (
    <span className={`rank-badge rank-badge--${rank}`}>
      <span aria-hidden="true">{emoji}</span> {gameName ? `${gameName}: ${label}` : label}
    </span>
  );
}

/** The home page's welcome strip: "🏆 5 trophies" with the favourite three, "140 points", and a link to how points work. */
export function HeroPoints({ progress, shelf }: { progress: Pick<MyProgress, 'points'>; shelf: TrophyShelf | undefined }) {
  return (
    <span className="hero-level">
      <TrophyCount shelf={shelf} />
      <span>{progress.points} points</span>
      <Link to="/points" className="hero-level__link">
        How points work
      </Link>
    </span>
  );
}

/**
 * The home page's few achievements: the ones nearest to being earned, topped up with the newest earned ones when nearly
 * everything is earned.
 */
export function nextAchievements(all: Achievement[], count = 3): Achievement[] {
  const next = all
    .filter((a) => !a.earnedAt)
    .sort((a, b) => b.progress / b.goal - a.progress / a.goal)
    .slice(0, count);
  const earned = all
    .filter((a) => a.earnedAt)
    .sort((a, b) => (b.earnedAt ?? '').localeCompare(a.earnedAt ?? ''))
    .slice(0, count - next.length);
  return [...next, ...earned];
}

/**
 * The achievements worth showing on the dashboard: the newest ones earned, then the ones
 * nearest to being earned.
 */
export function pickAchievements(all: Achievement[], count = 6): Achievement[] {
  const earned = all
    .filter((a) => a.earnedAt)
    .sort((a, b) => (b.earnedAt ?? '').localeCompare(a.earnedAt ?? ''))
    .slice(0, Math.ceil(count / 2));
  const next = all
    .filter((a) => !a.earnedAt)
    .sort((a, b) => b.progress / b.goal - a.progress / a.goal)
    .slice(0, count - earned.length);
  return [...earned, ...next];
}

export function AchievementList({
  achievements,
  showGame = false,
  compact = false,
}: {
  achievements: Achievement[];
  showGame?: boolean;
  /** Small badges in a row (the home page), rather than a list with bars. */
  compact?: boolean;
}) {
  return (
    <ul className={`achievement-list${compact ? ' achievement-list--compact' : ''}`}>
      {achievements.map((a) => {
        const done = a.earnedAt !== null;
        // Badges (Silver, Gold, Champion) are done or not: no "1/2" counts.
        const counted = a.measure !== 'rank' && a.goal > 1;
        const name = showGame ? `${a.name} (${gameLabel(a.game) ?? a.game})` : a.name;
        return (
          <li key={a.id} className={done ? 'is-done' : undefined}>
            <span className="achievement-list__emoji" aria-hidden="true">
              {a.emoji}
            </span>
            <span className="achievement-list__body">
              <span className="achievement-list__name">
                {name}
                <span className="achievement-list__count">
                  {done ? '✓ Earned' : counted ? `${a.progress}/${a.goal}` : 'Not yet'}
                </span>
              </span>
              <progress
                max={a.goal}
                value={done ? a.goal : a.progress}
                aria-label={`${name}: ${done ? 'earned' : counted ? `${a.progress} of ${a.goal}` : 'not yet'}`}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
