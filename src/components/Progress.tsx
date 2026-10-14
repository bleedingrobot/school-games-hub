import { Link } from 'react-router';
import { RANKS, levelProgress, type Achievement, type MyProgress, type Rank } from '../data/progress';
import { findGame } from '../games/registry';

export function RankBadge({ rank, game }: { rank: Rank; game?: string }) {
  const { label, emoji } = RANKS[rank];
  const gameName = game ? findGame(game)?.name : undefined;
  return (
    <span className={`rank-badge rank-badge--${rank}`}>
      <span aria-hidden="true">{emoji}</span> {gameName ? `${gameName}: ${label}` : label}
    </span>
  );
}

/** "Level 4" with a bar showing how far to the next level. */
export function LevelBar({ progress }: { progress: Pick<MyProgress, 'points' | 'level' | 'levelStart' | 'nextLevelAt'> }) {
  const toGo = progress.nextLevelAt - progress.points;
  return (
    <div className="level-bar">
      <div className="level-bar__text">
        <strong>Level {progress.level}</strong>
        <span>
          {toGo} point{toGo === 1 ? '' : 's'} to level {progress.level + 1}
        </span>
      </div>
      <progress
        max={1}
        value={levelProgress(progress)}
        aria-label={`Level ${progress.level}: ${toGo} points to level ${progress.level + 1}`}
      />
      <Link to="/points" className="level-bar__link">
        How points work
      </Link>
    </div>
  );
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

export function AchievementList({ achievements, showGame = false }: { achievements: Achievement[]; showGame?: boolean }) {
  return (
    <ul className="achievement-list">
      {achievements.map((a) => {
        const done = a.earnedAt !== null;
        // Badges (Silver, Gold, Champion) are done or not: no "1/2" counts.
        const counted = a.measure !== 'rank' && a.goal > 1;
        const name = showGame ? `${a.name} (${findGame(a.game)?.name ?? a.game})` : a.name;
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
