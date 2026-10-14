import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { AvatarImage } from '../avatar/AvatarImage';
import { GameCard } from '../components/GameCard';
import { SampleBadge } from '../components/SampleBadge';
import { fetchMyStats, fetchRecentGames, type GameStats } from '../data/botGames';
import {
  fetchFriendStats,
  fetchMyOpenGames,
  fetchPlayerCards,
  fetchRecentFriendGames,
  type FriendGame,
  type FriendStats,
  type PlayerCard,
} from '../data/multiplayer';
import { sampleAchievements, sampleStudent } from '../dev/sampleData';
import { findGame, GAMES } from '../games/registry';
import { BOT_LEVELS, type BotLevel } from '../games/types';

const RESULT_LABEL = { won: 'Won', lost: 'Lost', drawn: 'Draw' } as const;

/** "Today", "Yesterday", "Monday", or a date, in the student's own time zone. */
export function whenPlayed(iso: string, now = new Date()): string {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const then = new Date(iso);
  const daysAgo = Math.round((day(now) - day(then)) / 86_400_000);
  if (daysAgo <= 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo < 7) return then.toLocaleDateString('en-NZ', { weekday: 'long' });
  return then.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
}

function botName(level: string) {
  return `${BOT_LEVELS.find((l) => l.id === level)?.label ?? ''} bot`;
}

/** One line in Recent games: against a bot, or against another student. */
export interface RecentGame {
  id: string;
  game: string;
  result: 'won' | 'lost' | 'drawn';
  reason: string;
  finished_at: string;
  bot_level?: string;
  opponent?: PlayerCard | null;
}

/** Turns a finished friend game into a Recent games line, from this student's side. */
export function friendRecentGame(g: FriendGame, me: string, cards: Map<string, PlayerCard>): RecentGame {
  const mySide = g.second_player === me ? 'second' : 'first';
  const opponentId = mySide === 'first' ? g.second_player : g.first_player;
  return {
    id: g.id,
    game: g.game,
    result: g.winner === null ? 'drawn' : g.winner === mySide ? 'won' : 'lost',
    reason: g.reason ?? '',
    finished_at: g.finished_at ?? g.created_at,
    opponent: (opponentId && cards.get(opponentId)) || null,
  };
}

/** The student's real saved games and stats, against bots and friends. */
function useMyGames(me: string | undefined) {
  const [recent, setRecent] = useState<RecentGame[] | null>(null);
  const [stats, setStats] = useState<GameStats[] | null>(null);
  const [friendStats, setFriendStats] = useState<FriendStats[] | null>(null);
  const [inProgress, setInProgress] = useState<{ game: FriendGame; opponent: PlayerCard | null }[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!me) return;
    let current = true;
    Promise.all([fetchRecentGames(5), fetchMyStats(), fetchRecentFriendGames(5), fetchFriendStats(), fetchMyOpenGames()])
      .then(async ([botGames, totals, friendGames, friendTotals, open]) => {
        const playing = open.filter((g) => g.status === 'playing');
        const ids = [...friendGames, ...playing].flatMap((g) => [g.first_player, g.second_player]);
        const cards = await fetchPlayerCards(ids.filter((id): id is string => !!id && id !== me));
        if (!current) return;
        const merged: RecentGame[] = [
          ...botGames.map((g) => ({ ...g })),
          ...friendGames.map((g) => friendRecentGame(g, me, cards)),
        ];
        merged.sort((a, b) => b.finished_at.localeCompare(a.finished_at));
        setRecent(merged.slice(0, 5));
        setStats(totals);
        setFriendStats(friendTotals);
        setInProgress(
          playing.map((g) => {
            const opponentId = g.first_player === me ? g.second_player : g.first_player;
            return { game: g, opponent: (opponentId && cards.get(opponentId)) || null };
          }),
        );
      })
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [me]);
  return { recent, stats, friendStats, inProgress, failed };
}

export function Dashboard() {
  const { profile } = useAuth();
  const { recent, stats, friendStats, inProgress, failed } = useMyGames(profile?.id);
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

      {inProgress.length > 0 && (
        <section className="in-progress" aria-label="Games still going">
          {inProgress.map(({ game, opponent }) => (
            <div key={game.id} className="in-progress__item">
              <AvatarImage avatar={opponent?.avatar} size={48} />
              <p>
                <strong>Your {findGame(game.game)?.name.toLowerCase()} game</strong> with{' '}
                {opponent?.display_name ?? 'a classmate'} is still going!
              </p>
              <Link to={`/play/${game.id}`} className="button button--play">
                Carry on
              </Link>
            </div>
          ))}
        </section>
      )}

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
            Recent games
          </h2>
          {failed ? (
            <p className="panel__empty">We couldn’t load your games just now.</p>
          ) : !recent ? (
            <p className="panel__empty">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="panel__empty">No games yet. Press Play to start your first one!</p>
          ) : (
            <ul className="recent-list">
              {recent.map((g) => (
                <li key={g.id}>
                  <span className={`result result--${g.result}`}>{RESULT_LABEL[g.result]}</span>
                  <span className="recent-list__what">
                    {g.bot_level ? (
                      <>
                        {findGame(g.game)?.name} vs {botName(g.bot_level)}
                      </>
                    ) : (
                      <>
                        {findGame(g.game)?.name} vs <AvatarImage avatar={g.opponent?.avatar} size={24} />{' '}
                        {g.opponent?.display_name ?? 'a classmate'}
                      </>
                    )}
                    {g.reason === 'abandoned' && (
                      <span className="recent-list__note">{g.result === 'won' ? ' (they left)' : ' (left early)'}</span>
                    )}
                  </span>
                  <span className="recent-list__when">{whenPlayed(g.finished_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-labelledby="stats-title">
          <h2 id="stats-title" className="panel__title">
            My stats
          </h2>
          <StatsTable caption="Against bots" stats={stats} />
          <StatsTable caption="Against friends" stats={friendStats} />
          <p className="level-line">
            Level {sampleStudent.level} — {sampleStudent.pointsToNextLevel} points to level{' '}
            {sampleStudent.level + 1} <SampleBadge />
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

function StatsTable({ caption, stats }: { caption: string; stats: { game: string; played: number; won: number; lost: number; drawn: number }[] | null }) {
  return (
    <table className="stats-table">
      <caption>{caption}</caption>
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
          const s = stats?.find((row) => row.game === game.id) ?? { played: 0, won: 0, lost: 0, drawn: 0 };
          const show = (n: number) => (stats ? n : '–');
          return (
            <tr key={game.id}>
              <th scope="row">{game.name}</th>
              <td>{show(s.played)}</td>
              <td>{show(s.won)}</td>
              <td>{show(s.lost)}</td>
              <td>{show(s.drawn)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
