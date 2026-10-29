import { Fragment, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { AvatarImage } from '../avatar/AvatarImage';
import { ClassWarpCard } from '../components/ClassWarpCard';
import { GameCard } from '../components/GameCard';
import { recentGamesFrom, RecentList, type RecentGame } from '../components/MyGames';
import { AchievementList, HeroLevel, nextAchievements, RankBadge } from '../components/Progress';
import type { SeasonClock } from '../../shared/clans/season';
import type { HomeLordSeason } from '../../shared/lord/seasonRoad';
import { fetchMyHomePage, type HomePage } from '../data/homePage';
import type { FriendGame, PlayerCard } from '../data/multiplayer';
import type { MovesByGame } from '../data/movesLeft';
import type { MyProgress } from '../data/progress';
import type { SpaceGame } from '../data/spaceGames';
import type { SeatSummary } from '../data/cardGames';
import type { PowerGame } from '../data/powerGames';
import { findGame, GAMES, POWER_CLASH_ON, gameLabel } from '../games/registry';
import { trainingOn } from '../training/switch';
import { TrainingGateBanner } from '../training/TrainFirst';
import { useTrainingGate } from '../data/trainingGate';
import { BOT_LEVELS, type BotLevel, type DashboardGroup, type GameDefinition } from '../games/types';

// The teacher pages and older tests still find these here.
export { cardRecentGame, friendRecentGame, powerRecentGame, spaceRecentGame, whenPlayed, type RecentGame } from '../components/MyGames';

// The maths box brings the whole maths ladder with it, so it loads on its own.
const MathsFocusCard = lazy(() => import('../components/MathsFocusCard'));
const MathsPathCard = lazy(() => import('../components/MathsPathCard'));
const SeasonStrip = lazy(() => import('../components/SeasonStrip'));
const DragonSeasonStrip = lazy(() => import('../components/DragonSeasonStrip'));

/** How many games Recent games shows here (the profile page shows more). */
const RECENT_SHOWN = 3;

/** How the dashboard groups its games, top to bottom. Each game says its group (`group` in its GameDefinition). */
const GAME_GROUPS: { title: string; group: DashboardGroup }[] = [
  { title: 'Non-maths games', group: 'no-maths' },
  { title: 'Easy maths games', group: 'easy-maths' },
  { title: 'Complex maths games', group: 'complex-maths' },
];

/**
 * The games whose cards show: every game in GAMES, less those whose teacher switch is off (or still loading, so a card
 * never flashes up). Each game's switch hook is called on every render, in GAMES order, which never changes while the
 * page is open.
 */
function useShownGames(): GameDefinition[] {
  const off = new Set<string>();
  for (const game of GAMES) if (game.useTeacherSwitch && game.useTeacherSwitch() !== true) off.add(game.id);
  return GAMES.filter((game) => !off.has(game.id));
}

/**
 * The student's real saved games, against bots and friends, from the home page's one request (my_home_page). It is asked every
 * time the page opens, so everything is up to date straight after a game. `homePage` is that request, for the cards to take their
 * parts from (null until it is sent).
 */
function useMyGames(me: string | undefined) {
  const [homePage, setHomePage] = useState<Promise<HomePage> | null>(null);
  const [recent, setRecent] = useState<RecentGame[] | null>(null);
  const [inProgress, setInProgress] = useState<{ game: FriendGame; opponent: PlayerCard | null }[]>([]);
  const [spaceGoing, setSpaceGoing] = useState<SpaceGame[]>([]);
  const [cardGoing, setCardGoing] = useState<SeatSummary[]>([]);
  const [powerGoing, setPowerGoing] = useState<PowerGame[]>([]);
  const [progress, setProgress] = useState<MyProgress | null>(null);
  // Daily moves left (Dragon Maths, Clan Quest) are only a nicety: no line on the card if they can't be read.
  const [moves, setMoves] = useState<MovesByGame>({});
  // The school's Clan Quest season, for the "This season" strip.
  const [season, setSeason] = useState<SeasonClock | null>(null);
  // The school's Dragon Maths season and the pupil's hero, for its strip.
  const [lordSeason, setLordSeason] = useState<HomeLordSeason | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!me) return;
    let current = true;
    const answer = fetchMyHomePage();
    setHomePage(answer);
    answer.then(
      (home) => {
        if (!current) return;
        setProgress(home.progress);
        setMoves(home.moves);
        setSeason(home.season);
        setLordSeason(home.lordSeason);
        // Space and 101 games with classmates, and Power Clash with a classmate (nothing of it shows before it is switched on).
        setSpaceGoing(home.spaceOpen.filter((g) => g.status === 'playing'));
        setCardGoing(home.cardOpen.filter((g) => g.status === 'playing'));
        if (POWER_CLASH_ON) setPowerGoing(home.powerOpen.filter((g) => g.status === 'playing'));
        setRecent(recentGamesFrom(home, me).slice(0, RECENT_SHOWN));
        setInProgress(
          home.friendOpen
            .filter((g) => g.status === 'playing')
            .map((g) => {
              const opponentId = g.first_player === me ? g.second_player : g.first_player;
              return { game: g, opponent: (opponentId && home.players.get(opponentId)) || null };
            }),
        );
      },
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [me]);
  return { homePage, recent, inProgress, spaceGoing, cardGoing, powerGoing, progress, moves, season, lordSeason, failed };
}

/** A "still going" line: what it is, and a Carry on button. */
function GoingLine({ emoji, to, children }: { emoji: ReactNode; to: string; children: ReactNode }) {
  return (
    <div className="in-progress__item">
      <span className="in-progress__emoji" aria-hidden={typeof emoji === 'string' ? true : undefined}>
        {emoji}
      </span>
      <p>{children}</p>
      <Link to={to} className="button button--play">
        Carry on
      </Link>
    </div>
  );
}

export function Dashboard() {
  const { profile } = useAuth();
  const meId = profile?.id;
  const pupil = profile?.role !== 'teacher';
  const { homePage, recent, inProgress, spaceGoing, cardGoing, powerGoing, progress, moves, season, lordSeason, failed } = useMyGames(meId);
  // The cards wait for the home page's answer, or ask for themselves if there is nobody to ask it for.
  const cardsFrom = meId ? homePage : undefined;
  const pointsFor = new Map(progress?.recent.map((r) => [r.id, r.points]));
  const shownGames = useShownGames();
  const seasonShown = pupil && season && season.clockOn && season.number > 0 && shownGames.some((g) => g.id === 'clan-quest') ? season : null;
  const lordSeasonShown = pupil && lordSeason && shownGames.some((g) => g.id === 'dragon-maths') ? lordSeason : null;
  // With both strips showing, each says which game it is.
  const bothSeasons = !!seasonShown && !!lordSeasonShown;
  const [levels, setLevels] = useState<Record<string, BotLevel>>({});
  const [featured, setFeatured] = useState(GAMES[0].id);
  const levelFor = (gameId: string) => levels[gameId] ?? 'easy';

  const featuredGame = findGame(featured) ?? GAMES[0];
  const featuredLevel = BOT_LEVELS.find((l) => l.id === levelFor(featuredGame.id))!;
  // Training before games: the cards still open (to the "Training first" screen), but look resting until a session is done.
  const gate = useTrainingGate();
  const gamesLocked = trainingOn() && gate.ready && gate.locked;

  return (
    <div className="dashboard">
      <section className="hero" aria-labelledby="hero-title">
        <Link to="/profile" className="hero__avatar" aria-label="Change my avatar">
          <AvatarImage avatar={profile?.avatar} size={64} />
        </Link>
        <div className="hero__text">
          <p className="hero__hello">Kia ora,</p>
          <h1 id="hero-title">{profile?.display_name}</h1>
          {progress && (
            <div className="hero__meta">
              <HeroLevel progress={progress} />
              {progress.games.map((g) => (
                <RankBadge key={g.game} rank={g.rank.rank} game={g.game} />
              ))}
            </div>
          )}
        </div>
        <div className="hero__play">
          <Link className="button button--play hero__go" to={`/${featuredGame.id}?bot=${featuredLevel.id}`}>
            <span aria-hidden="true">▶</span> Play
          </Link>
          {pupil && (
            <Link className="hero__warp" to="/warp">
              <span aria-hidden="true">🌀</span> Class Warp
            </Link>
          )}
          <p className="hero__play-hint">
            {featuredGame.name} vs {featuredLevel.label} bot
          </p>
        </div>
      </section>

      <TrainingGateBanner />

      {pupil && <ClassWarpCard homePage={cardsFrom} />}

      {(inProgress.length > 0 || spaceGoing.length > 0 || cardGoing.length > 0 || powerGoing.length > 0) && (
        <section className="in-progress" aria-label="Games still going">
          {powerGoing.slice(0, 1).map((game) => (
            <GoingLine key={game.id} emoji="⚡" to={`/power-game/${game.id}`}>
              <strong>Your {gameLabel('power-clash')} game</strong> with a classmate is still going!
            </GoingLine>
          ))}
          {cardGoing.slice(0, 1).map((game) => (
            <GoingLine key={game.game} emoji="🃏" to={`/card-game/${game.game}`}>
              <strong>Your 101 game</strong> with classmates is still going!
            </GoingLine>
          ))}
          {spaceGoing.slice(0, 1).map((game) => (
            <GoingLine key={game.id} emoji="🚀" to={`/space-game/${game.id}`}>
              <strong>Your {findGame('space')?.name} game</strong> with classmates is still going!
            </GoingLine>
          ))}
          {inProgress.slice(0, 2).map(({ game, opponent }) => (
            <GoingLine key={game.id} emoji={<AvatarImage avatar={opponent?.avatar} size={32} />} to={`/play/${game.id}`}>
              <strong>Your {findGame(game.game)?.name.toLowerCase()} game</strong> with {opponent?.display_name ?? 'a classmate'} is
              still going!
            </GoingLine>
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

      <section className={gamesLocked ? 'game-groups game-groups--locked' : 'game-groups'} aria-labelledby="games-title">
        <h2 id="games-title" className="sr-only">
          Pick a game
        </h2>
        {GAME_GROUPS.map((group) => {
          const groupGames = shownGames.filter((g) => g.group === group.group);
          if (groupGames.length === 0) return null;
          return (
            <Fragment key={group.title}>
              <div className={`game-group game-group--${group.group}`}>
                <h3 className="game-group__label">
                  <span>{group.title}</span>
                </h3>
                {/* The season timelines sit with their games, in the complex maths games (James, 29 Oct 2026): Clan Quest's and
                    Dragon Maths', side by side on wide screens. */}
                {group.group === 'complex-maths' && (seasonShown || lordSeasonShown) && (
                  <div className={bothSeasons ? 'season-strips season-strips--two' : 'season-strips'}>
                    <Suspense fallback={null}>
                      {seasonShown && <SeasonStrip clock={seasonShown} title={bothSeasons ? 'Clan Quest this season' : undefined} />}
                      {lordSeasonShown && <DragonSeasonStrip season={lordSeasonShown} title={bothSeasons ? 'Dragon Maths this season' : undefined} />}
                    </Suspense>
                  </div>
                )}
                <div className="game-grid">
                  {groupGames.map((game) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      level={levelFor(game.id)}
                      moves={moves[game.id]}
                      onLevelChange={(level) => {
                        setLevels((prev) => ({ ...prev, [game.id]: level }));
                        setFeatured(game.id);
                      }}
                    />
                  ))}
                </div>
              </div>
              {/* Training has a line of its own, under the non-maths games. */}
              {group.group === 'no-maths' && trainingOn() && (
                <div className="game-group game-group--training">
                  <h3 className="game-group__label">
                    <span>Training</span>
                  </h3>
                  <div className="game-grid">
                    <Link to="/training" className="link-tile">
                      <span className="link-tile__emoji" aria-hidden="true">
                        🧮
                      </span>
                      <span>
                        <strong>Multiplication and division training</strong>
                        <span>A few minutes a day to build your facts</span>
                      </span>
                    </Link>
                    <Link to="/training?quick=1" className="link-tile">
                      <span className="link-tile__emoji" aria-hidden="true">
                        👀
                      </span>
                      <span>
                        <strong>Quick looks</strong>
                        <span>Flash a picture, tap how many you saw</span>
                      </span>
                    </Link>
                  </div>
                </div>
              )}
            </Fragment>
          );
        })}
      </section>

      <nav className="quick-links" aria-label="More">
        <Link to="/lobby" className="quick-link">
          <span aria-hidden="true">🤝</span> <strong>Play a friend</strong> <span className="quick-link__note">Lobby or game code</span>
        </Link>
        <Link to="/leaderboard" className="quick-link">
          <span aria-hidden="true">🏅</span> <strong>Leaderboard</strong> <span className="quick-link__note">See the top players this week</span>
        </Link>
        <Link to="/profile#stats" className="quick-link">
          <span aria-hidden="true">📊</span> <strong>See my stats</strong>
        </Link>
      </nav>

      <div className="panel-grid">
        <section className="panel" aria-labelledby="recent-title">
          <div className="panel__head">
            <h2 id="recent-title" className="panel__title">
              Recent games
            </h2>
            {recent && recent.length > 0 && (
              <Link to="/profile#stats" className="panel__link">
                See more
              </Link>
            )}
          </div>
          {failed ? (
            <p className="panel__empty">We couldn’t load your games just now.</p>
          ) : !recent ? (
            <p className="panel__empty">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="panel__empty">No games yet. Press Play to start your first one!</p>
          ) : (
            <RecentList games={recent} pointsFor={pointsFor} />
          )}
        </section>

        {pupil && (
          <Suspense fallback={null}>
            <MathsFocusCard homePage={cardsFrom} path={<MathsPathCard homePage={cardsFrom} folded />} />
          </Suspense>
        )}

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
              <AchievementList achievements={nextAchievements(progress.achievements)} showGame compact />
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
