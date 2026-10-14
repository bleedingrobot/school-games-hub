import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { AvatarImage } from '../avatar/AvatarImage';
import { GameCard } from '../components/GameCard';
import { SampleBadge } from '../components/SampleBadge';
import {
  sampleAchievements,
  sampleRecentGames,
  sampleStats,
  sampleStudent,
} from '../dev/sampleData';
import { findGame, GAMES } from '../games/registry';
import { BOT_LEVELS, type BotLevel } from '../games/types';

const RESULT_LABEL = { won: 'Won', lost: 'Lost', drawn: 'Draw' } as const;

export function Dashboard() {
  const { profile } = useAuth();
  const [levels, setLevels] = useState<Record<string, BotLevel>>({});
  const [featured, setFeatured] = useState(GAMES[0].id);
  const levelFor = (gameId: string) => levels[gameId] ?? 'easy';

  const featuredGame = findGame(featured) ?? GAMES[0];
  const featuredLevel = BOT_LEVELS.find((l) => l.id === levelFor(featuredGame.id))!;

  return (
    <div className="dashboard">
      <section className="hero" aria-labelledby="hero-title">
        <Link to="/profile" className="hero__avatar" aria-label="Change my avatar">
          <AvatarImage avatar={profile?.avatar} size={120} />
        </Link>
        <div className="hero__text">
          <p className="hero__hello">Kia ora,</p>
          <h1 id="hero-title">{profile?.display_name}</h1>
          <div className="hero__meta">
            <span className="rank-badge">🥈 {sampleStudent.rankBadge}</span>
            <span>Level {sampleStudent.level}</span>
            <span>{sampleStudent.points} points</span>
            <SampleBadge />
          </div>
        </div>
        <div className="hero__play">
          <Link className="button button--play" to={`/${featuredGame.id}?bot=${featuredLevel.id}`}>
            <span aria-hidden="true">▶</span> Play
          </Link>
          <p className="hero__play-hint">
            {featuredGame.name} vs {featuredLevel.label} bot
          </p>
        </div>
      </section>

      <section aria-labelledby="games-title">
        <h2 id="games-title" className="section-title">
          Pick a game
        </h2>
        <div className="game-grid">
          {GAMES.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              level={levelFor(game.id)}
              onLevelChange={(level) => {
                setLevels((prev) => ({ ...prev, [game.id]: level }));
                setFeatured(game.id);
              }}
            />
          ))}
        </div>
      </section>

      <div className="link-grid">
        <Link to="/lobby" className="link-card link-card--lobby">
          <span className="link-card__emoji" aria-hidden="true">
            🤝
          </span>
          <span>
            <strong>Play a friend</strong>
            <span>Join the lobby or use a game code</span>
          </span>
        </Link>
        <Link to="/leaderboard" className="link-card link-card--board">
          <span className="link-card__emoji" aria-hidden="true">
            🏅
          </span>
          <span>
            <strong>Leaderboard</strong>
            <span>See the top players this week</span>
          </span>
        </Link>
      </div>

      <div className="panel-grid">
        <section className="panel" aria-labelledby="recent-title">
          <h2 id="recent-title" className="panel__title">
            Recent games <SampleBadge />
          </h2>
          <ul className="recent-list">
            {sampleRecentGames.map((g) => (
              <li key={g.id}>
                <span className={`result result--${g.result}`}>{RESULT_LABEL[g.result]}</span>
                <span className="recent-list__what">
                  {findGame(g.gameId)?.name} vs {g.opponent}
                </span>
                <span className="recent-list__when">{g.when}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel" aria-labelledby="stats-title">
          <h2 id="stats-title" className="panel__title">
            My stats <SampleBadge />
          </h2>
          <table className="stats-table">
            <thead>
              <tr>
                <th scope="col">Game</th>
                <th scope="col">Played</th>
                <th scope="col">Won</th>
                <th scope="col">Lost</th>
                <th scope="col">Draw</th>
              </tr>
            </thead>
            <tbody>
              {GAMES.map((game) => {
                const s = sampleStats[game.id as keyof typeof sampleStats];
                if (!s) return null;
                return (
                  <tr key={game.id}>
                    <th scope="row">{game.name}</th>
                    <td>{s.played}</td>
                    <td>{s.won}</td>
                    <td>{s.lost}</td>
                    <td>{s.drawn}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="level-line">
            Level {sampleStudent.level} — {sampleStudent.pointsToNextLevel} points to level{' '}
            {sampleStudent.level + 1}
          </p>
        </section>

        <section className="panel" aria-labelledby="achievements-title">
          <h2 id="achievements-title" className="panel__title">
            Achievements <SampleBadge />
          </h2>
          <ul className="achievement-list">
            {sampleAchievements.map((a) => {
              const done = Math.min(a.progress, a.goal);
              return (
                <li key={a.id} className={done === a.goal ? 'is-done' : undefined}>
                  <span className="achievement-list__emoji" aria-hidden="true">
                    {a.emoji}
                  </span>
                  <span className="achievement-list__body">
                    <span className="achievement-list__name">
                      {a.name}
                      <span className="achievement-list__count">
                        {done}/{a.goal}
                      </span>
                    </span>
                    <progress max={a.goal} value={done} aria-label={`${a.name}: ${done} of ${a.goal}`} />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
