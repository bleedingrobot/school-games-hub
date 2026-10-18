import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { AvatarImage } from '../avatar/AvatarImage';
import { GameCard } from '../components/GameCard';
import { AchievementList, LevelBar, pickAchievements, RankBadge } from '../components/Progress';
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
import { fetchMyProgress, type MyProgress } from '../data/progress';
import { fetchMyOpenSpaceGames, fetchMySpaceStats, fetchRecentSpaceGames, seatsOf, type SpaceGame } from '../data/spaceGames';
import { fetchMyCardStats, fetchMyOpenCardGames, fetchRecentCardGames, type SeatSummary } from '../data/cardGames';
import { fetchMyOpenPowerGames, fetchMyPowerStats, fetchRecentPowerGames, seatsOf as powerSeatsOf, type PowerGame } from '../data/powerGames';
import { findGame, GAMES, POWER_CLASH_ON, gameLabel } from '../games/registry';
import { trainingOn } from '../training/switch';
import { useClansEnabled } from '../games/clans/switch';
import { useLordEnabled } from '../games/lord/switch';
import { useMonstersEnabled } from '../games/monsters/switch';
import { BOT_LEVELS, isRanked, type BotLevel } from '../games/types';
import { BOT_NAMES, placeLabel } from '../../shared/space/names';

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

function botName(level: string, game?: string) {
  if (game === 'space') return `${BOT_NAMES[level as BotLevel] ?? ''} bots`;
  if (game === '101') return `${BOT_LEVELS.find((l) => l.id === level)?.label ?? ''} bots`;
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
  /** Wormholes & Black Holes: the place (null if they left early). */
  place?: number | null;
  /** Wormholes & Black Holes with classmates (rather than one opponent). */
  classmates?: boolean;
  /** Power Clash that ended early: who left. */
  leftBy?: 'me' | 'them' | 'nobody';
}

/** Turns a finished space game with classmates into a Recent games line. */
export function spaceRecentGame(g: SpaceGame, me: string): RecentGame {
  const seat = seatsOf(g).indexOf(me);
  const left = g.ending === 'abandoned' || !!g.seat_info?.[seat]?.left;
  const place = left ? null : (g.places?.[seat] ?? null);
  return {
    id: g.id,
    game: 'space',
    result: place === 1 ? 'won' : 'lost',
    reason: left ? 'abandoned' : (g.ending ?? ''),
    finished_at: g.finished_at ?? g.created_at,
    place,
    classmates: true,
  };
}

/** Turns a finished Power Clash game with a classmate into a Recent games line. */
export function powerRecentGame(g: PowerGame, me: string): RecentGame {
  const seat = powerSeatsOf(g).indexOf(me);
  const abandoned = g.ending === 'abandoned';
  return {
    id: g.id,
    game: 'power-clash',
    result: !abandoned && g.won?.[seat] ? 'won' : 'lost',
    reason: abandoned ? 'abandoned' : 'finished',
    finished_at: g.finished_at ?? g.created_at,
    classmates: true,
    ...(abandoned ? { leftBy: g.leaver === me ? ('me' as const) : g.leaver ? ('them' as const) : ('nobody' as const) } : {}),
  };
}

/** Turns a finished 101 game with classmates (my seat row) into a Recent games line. */
export function cardRecentGame(s: SeatSummary): RecentGame {
  const { info } = s;
  const place = info.ending === 'abandoned' ? null : (info.places?.[s.seat] ?? null);
  const left = !place;
  return {
    id: s.game,
    game: '101',
    result: place === 1 ? 'won' : 'lost',
    reason: left ? 'abandoned' : 'finished',
    finished_at: s.updated_at,
    place,
    classmates: true,
  };
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
  const [spaceGoing, setSpaceGoing] = useState<SpaceGame[]>([]);
  const [spaceStats, setSpaceStats] = useState<{ played: number; firsts: number } | null>(null);
  const [cardGoing, setCardGoing] = useState<SeatSummary[]>([]);
  const [cardStats, setCardStats] = useState<{ played: number; won: number } | null>(null);
  const [powerGoing, setPowerGoing] = useState<PowerGame[]>([]);
  const [powerStats, setPowerStats] = useState<{ played: number; won: number } | null>(null);
  const [progress, setProgress] = useState<MyProgress | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!me) return;
    let current = true;
    // Points load separately, so the games still show if they can't be loaded.
    fetchMyProgress()
      .then((p) => current && setProgress(p))
      .catch(() => {});
    // Space games with classmates load alongside, but never stop the rest from showing.
    Promise.all([
      fetchRecentSpaceGames(5).catch(() => []),
      fetchMyOpenSpaceGames().catch(() => []),
      fetchMySpaceStats().catch(() => null),
    ]).then(([recentSpace, openSpace, totals]) => {
      if (!current) return;
      setSpaceGoing(openSpace.filter((g) => g.status === 'playing'));
      setSpaceStats(totals);
      if (recentSpace.length === 0) return;
      setRecent((prev) =>
        [...(prev ?? []), ...recentSpace.map((g) => spaceRecentGame(g, me))]
          .sort((a, b) => b.finished_at.localeCompare(a.finished_at))
          .slice(0, 5),
      );
    });
    // 101 games with classmates, the same way.
    Promise.all([
      fetchRecentCardGames(5).catch(() => []),
      fetchMyOpenCardGames().catch(() => []),
      fetchMyCardStats().catch(() => null),
    ]).then(([recentCards, openCards, totals]) => {
      if (!current) return;
      setCardGoing(openCards.filter((g) => g.status === 'playing'));
      setCardStats(totals);
      if (recentCards.length === 0) return;
      setRecent((prev) =>
        [...(prev ?? []), ...recentCards.map(cardRecentGame)]
          .sort((a, b) => b.finished_at.localeCompare(a.finished_at))
          .slice(0, 5),
      );
    });
    // Power Clash with a classmate, the same way (nothing to ask before it is switched on).
    if (POWER_CLASH_ON) {
      Promise.all([
        fetchRecentPowerGames(5).catch(() => []),
        fetchMyOpenPowerGames().catch(() => []),
        fetchMyPowerStats().catch(() => null),
      ]).then(([recentPower, openPower, totals]) => {
        if (!current) return;
        setPowerGoing(openPower.filter((g) => g.status === 'playing'));
        setPowerStats(totals);
        if (recentPower.length === 0) return;
        setRecent((prev) =>
          [...(prev ?? []), ...recentPower.map((g) => powerRecentGame(g, me))]
            .sort((a, b) => b.finished_at.localeCompare(a.finished_at))
            .slice(0, 5),
        );
      });
    }
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
        setRecent((prev) =>
          [...(prev ?? []).filter((g) => g.classmates), ...merged]
            .sort((a, b) => b.finished_at.localeCompare(a.finished_at))
            .slice(0, 5),
        );
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
  // 101 with classmates goes in the "Against friends" table with chess and checkers.
  const withCards =
    friendStats && cardStats
      ? [...friendStats, { game: '101', played: cardStats.played, won: cardStats.won, lost: cardStats.played - cardStats.won, drawn: 0 }]
      : friendStats;
  // Power Clash with a classmate goes in the same table (a match is won or lost).
  const friendRows =
    withCards && powerStats
      ? [...withCards, { game: 'power-clash', played: powerStats.played, won: powerStats.won, lost: powerStats.played - powerStats.won, drawn: 0 }]
      : withCards;
  return { recent, stats, friendStats: friendRows, inProgress, spaceGoing, spaceStats, cardGoing, powerGoing, progress, failed };
}

export function Dashboard() {
  const { profile } = useAuth();
  const { recent, stats, friendStats, inProgress, spaceGoing, spaceStats, cardGoing, powerGoing, progress, failed } = useMyGames(profile?.id);
  const pointsFor = new Map(progress?.recent.map((r) => [r.id, r.points]));
  const monstersOn = useMonstersEnabled() === true;
  const lordOn = useLordEnabled() === true;
  const clansOn = useClansEnabled() === true;
  const shownGames = GAMES.filter((g) => (g.id !== 'monsters' || monstersOn) && (g.id !== 'dragon-maths' || lordOn) && (g.id !== 'clan-quest' || clansOn));
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
          {progress && (
            <div className="hero__meta">
              <span>Level {progress.level}</span>
              <span>{progress.points} points</span>
              {progress.games.map((g) => (
                <RankBadge key={g.game} rank={g.rank.rank} game={g.game} />
              ))}
            </div>
          )}
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

      {(inProgress.length > 0 || spaceGoing.length > 0 || cardGoing.length > 0 || powerGoing.length > 0) && (
        <section className="in-progress" aria-label="Games still going">
          {powerGoing.slice(0, 1).map((game) => (
            <div key={game.id} className="in-progress__item">
              <span className="in-progress__emoji" aria-hidden="true">
                ⚡
              </span>
              <p>
                <strong>Your {gameLabel('power-clash')} game</strong> with a classmate is still going!
              </p>
              <Link to={`/power-game/${game.id}`} className="button button--play">
                Carry on
              </Link>
            </div>
          ))}
          {cardGoing.slice(0, 1).map((game) => (
            <div key={game.game} className="in-progress__item">
              <span className="in-progress__emoji" aria-hidden="true">
                🃏
              </span>
              <p>
                <strong>Your 101 game</strong> with classmates is still going!
              </p>
              <Link to={`/card-game/${game.game}`} className="button button--play">
                Carry on
              </Link>
            </div>
          ))}
          {spaceGoing.slice(0, 1).map((game) => (
            <div key={game.id} className="in-progress__item">
              <span className="in-progress__emoji" aria-hidden="true">
                🚀
              </span>
              <p>
                <strong>Your {findGame('space')?.name} game</strong> with classmates is still going!
              </p>
              <Link to={`/space-game/${game.id}`} className="button button--play">
                Carry on
              </Link>
            </div>
          ))}
          {inProgress.slice(0, 2).map(({ game, opponent }) => (
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
          {inProgress.length > 2 && (
            <p className="in-progress__more">
              <Link to="/lobby">
                {inProgress.length - 2} more game{inProgress.length === 3 ? '' : 's'} still going: see them in the lobby
              </Link>
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="games-title">
        <h2 id="games-title" className="section-title">
          Pick a game
        </h2>
        <div className="game-grid">
          {shownGames.map((game) => (
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
        {trainingOn() && profile?.role === 'student' && (
          <Link to="/training" className="link-card link-card--training">
            <span className="link-card__emoji" aria-hidden="true">
              🧮
            </span>
            <span>
              <strong>Facts training</strong>
              <span>A few minutes a day to build your facts</span>
            </span>
          </Link>
        )}
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
                  {g.leftBy ? (
                    <span className="result result--drawn">Ended</span>
                  ) : g.game === 'space' || (g.game === '101' && g.classmates) ? (
                    <span className={`result result--${g.place === 1 ? 'won' : 'drawn'}`}>{placeLabel(g.place)}</span>
                  ) : (
                    <span className={`result result--${g.result}`}>{RESULT_LABEL[g.result]}</span>
                  )}
                  <span className="recent-list__what">
                    {g.bot_level ? (
                      <>
                        {findGame(g.game)?.name} vs {botName(g.bot_level, g.game)}
                      </>
                    ) : g.game === 'power-clash' && g.classmates ? (
                      <>{gameLabel(g.game)} with a classmate</>
                    ) : g.classmates ? (
                      <>{findGame(g.game)?.name} with classmates</>
                    ) : (
                      <>
                        {findGame(g.game)?.name} vs <AvatarImage avatar={g.opponent?.avatar} size={24} />{' '}
                        {g.opponent?.display_name ?? 'a classmate'}
                      </>
                    )}
                    {g.leftBy && (
                      <span className="recent-list__note">
                        {g.leftBy === 'me' ? ' (you left)' : g.leftBy === 'them' ? ' (they left)' : ' (ended early)'}
                      </span>
                    )}
                    {g.reason === 'abandoned' && !g.leftBy && g.game !== 'space' && !(g.game === '101' && g.classmates) && (
                      <span className="recent-list__note">{g.result === 'won' ? ' (they left)' : ' (left early)'}</span>
                    )}
                  </span>
                  {pointsFor.has(g.id) && <span className="recent-list__points">+{pointsFor.get(g.id)}</span>}
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
          <SpaceStatsLine stats={stats} classmates={spaceStats} />
          {progress && <LevelBar progress={progress} />}
        </section>

        <section className="panel" aria-labelledby="achievements-title">
          <h2 id="achievements-title" className="panel__title">
            Achievements
            {progress && (
              <span className="panel__count">
                {progress.achievements.filter((a) => a.earnedAt).length} of {progress.achievements.length}
              </span>
            )}
          </h2>
          {progress ? (
            <>
              <AchievementList achievements={pickAchievements(progress.achievements)} showGame />
              <p className="panel__more">
                <Link to="/profile#achievements">See them all</Link>
              </p>
            </>
          ) : (
            <p className="panel__empty">Loading…</p>
          )}
        </section>
      </div>
    </div>
  );
}

/** Games with real wins and losses: the ranked ones, and 101 and Power Clash (no badge, but you win or lose). */
const hasWinLoss = (game: (typeof GAMES)[number]) => isRanked(game) || game.id === '101' || game.id === 'power-clash';

/** Wormholes & Black Holes is luck, so it gets a line of its own rather than won/lost columns. */
function SpaceStatsLine({
  stats,
  classmates,
}: {
  stats: GameStats[] | null;
  classmates: { played: number; firsts: number } | null;
}) {
  const space = stats?.find((row) => row.game === 'space');
  const played = (space?.played ?? 0) + (classmates?.played ?? 0);
  const firsts = (space?.won ?? 0) + (classmates?.firsts ?? 0);
  if (!played) return null;
  return (
    <p className="stats-line">
      🚀 {findGame('space')?.name}: {played} game{played === 1 ? '' : 's'}, 1st place {firsts} time
      {firsts === 1 ? '' : 's'}
    </p>
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
        {GAMES.filter(hasWinLoss).map((game) => {
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
