import { Fragment, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { AvatarImage } from '../avatar/AvatarImage';
import { ClassWarpCard } from '../components/ClassWarpCard';
import { ActivityCard, GameCard } from '../components/GameCard';
import { nzDay } from '../../shared/monsters/world/battleCap';
import { spottedNote } from '../../shared/monsters/world/weather';
import { recentGamesFrom, RecentList, type RecentGame } from '../components/MyGames';
import { AchievementList, HeroLevel, nextAchievements, RankBadge } from '../components/Progress';
import type { SeasonClock } from '../../shared/clans/season';
import type { HomeLordSeason } from '../../shared/lord/seasonRoad';
import { fetchMyHomePage, type HomePage, type TopGames } from '../data/homePage';
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
import { refreshSettings } from '../data/classSettings';
import { FRESH_HOME_MS, forgetSettingsOlderThan } from '../data/settingsMemory';
import { useNonMathsGamesOpen } from '../data/nonMathsGames';
import { useHomeLayout } from '../data/homeLayout';
import { useNextParts } from '../data/nextParts';
import { BOT_LEVELS, type BotLevel, type DashboardGroup, type GameDefinition } from '../games/types';

// The teacher pages and older tests still find these here.
export { cardRecentGame, friendRecentGame, powerRecentGame, spaceRecentGame, whenPlayed, type RecentGame } from '../components/MyGames';

// The maths box brings the whole maths ladder with it, so it loads on its own.
const MathsFocusCard = lazy(() => import('../components/MathsFocusCard'));
const MathsPathCard = lazy(() => import('../components/MathsPathCard'));
const SeasonStrip = lazy(() => import('../components/SeasonStrip'));
const DragonSeasonStrip = lazy(() => import('../components/DragonSeasonStrip'));

/** Where Quick looks goes among the cards: after Robin, or first of the foundational games while Robin is off. */
function quickLooksAt(tiles: { id: string; group?: DashboardGroup }[]): number {
  const robin = tiles.findIndex((t) => t.id === 'robin');
  if (robin >= 0) return robin + 1;
  const first = tiles.findIndex((t) => t.group === 'foundational');
  return first >= 0 ? first : tiles.length;
}

/**
 * The "My games" row at the top (dashboard plan D2, James 11 Nov 2026): pinned games, then the pupil's most played, in place of the
 * big Play button and the Pinned section. Set to false to go back to the old Pinned section and the Play button exactly as before
 * (James asked to keep that way back, 12 Nov 2026).
 */
const MY_GAMES_ON = true;

/** How many games My games fills up to with most-played games (pinned games always all show). */
const MY_GAMES_SHOWN = 4;

/** How many games Recent games shows here (the profile page shows more). */
const RECENT_SHOWN = 3;

/** How the dashboard groups its games, top to bottom. Each game says its group (`group` in its GameDefinition). */
const GAME_GROUPS: { title: string; group: DashboardGroup }[] = [
  // The early-years games, at the top (James, 4 Nov 2026). New early games join with `group: 'foundational'`.
  { title: 'Foundational skills', group: 'foundational' },
  { title: 'Non-maths games', group: 'no-maths' },
  { title: 'Easy maths games', group: 'easy-maths' },
  { title: 'Complex maths games', group: 'complex-maths' },
];

/**
 * The games whose cards show: every game in GAMES, less those whose teacher switch is off (or still loading, so a card
 * never flashes up), and less the non-maths games once the class's row says they are off (they are on unless a teacher
 * turned them off, so they show while it loads). Each game's switch hook is called on every render, in GAMES order, which
 * never changes while the page is open.
 */
function useShownGames(nonMathsOpen: boolean | null): GameDefinition[] {
  const off = new Set<string>();
  for (const game of GAMES) if (game.useTeacherSwitch && game.useTeacherSwitch() !== true) off.add(game.id);
  return GAMES.filter((game) => !off.has(game.id) && (nonMathsOpen !== false || game.group !== 'no-maths'));
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
  const [topGames, setTopGames] = useState<TopGames | null>(null);
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
        setTopGames(home.topGames);
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
  return { homePage, recent, inProgress, spaceGoing, cardGoing, powerGoing, progress, moves, season, lordSeason, topGames, failed };
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

/** A card on the home page and the group it sits in. */
interface Tile {
  id: string;
  group: DashboardGroup | undefined;
  card: ReactNode;
}

/**
 * One section of games: a heading that folds it away or opens it again, and what is in it. While it is folded the heading
 * says how many games are inside.
 */
function GameGroup({
  id,
  title,
  count,
  collapsed,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`game-group game-group--${id}${collapsed ? ' is-collapsed' : ''}`}>
      <h3 className="game-group__label">
        <button type="button" className="game-group__toggle" aria-expanded={!collapsed} aria-controls={`games-${id}`} onClick={onToggle}>
          <span className="game-group__name">
            {id === 'pinned' && <span aria-hidden="true">{title === 'Pinned' ? '📌 ' : '⭐ '}</span>}
            {title}
          </span>
          {collapsed && count !== undefined && count > 0 && (
            <span className="game-group__count">
              {count} game{count === 1 ? '' : 's'}
            </span>
          )}
          <span className="game-group__line" aria-hidden="true" />
          <span className="game-group__chevron" aria-hidden="true">
            {collapsed ? 'Show' : 'Hide'}
          </span>
        </button>
      </h3>
      <div id={`games-${id}`} className="game-group__body" hidden={collapsed}>
        {children}
      </div>
    </div>
  );
}

/**
 * The pupil's home page. It reads the class settings fresh when it opens if the remembered row is more than 30 seconds old
 * (before any switch hook asks, so one request still serves every card), and again when the tab comes back into view after
 * that long (one request; the page restarts only if a value changed), so a game the teacher just turned on shows up without a reload. Other pages keep the 5-minute memory.
 */
export function Dashboard() {
  useState(() => forgetSettingsOlderThan(FRESH_HOME_MS));
  const [round, setRound] = useState(0);
  useEffect(() => {
    let hiddenAt: number | null = null;
    const onChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else if (hiddenAt !== null && Date.now() - hiddenAt > FRESH_HOME_MS) {
        hiddenAt = null;
        // One fresh read; the page starts again (so every card shows it) only if a value really changed.
        void refreshSettings().then((changed) => changed && setRound((r) => r + 1), () => {});
      }
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return <DashboardPage key={round} />;
}

function DashboardPage() {
  const { profile } = useAuth();
  const meId = profile?.id;
  const pupil = profile?.role !== 'teacher';
  const { homePage, recent, spaceGoing, progress, moves, season, lordSeason, topGames, failed, ...going } = useMyGames(meId);
  // The cards wait for the home page's answer, or ask for themselves if there is nobody to ask it for.
  const cardsFrom = meId ? homePage : undefined;
  const pointsFor = new Map(progress?.recent.map((r) => [r.id, r.points]));
  const nonMathsOpen = useNonMathsGamesOpen();
  const shownGames = useShownGames(nonMathsOpen);
  // The daily Foundational games' "next part" chips: one request, only when one of them is showing.
  // Teachers get them too, for their own goes, so they see what the class sees (James, 5 Nov 2026).
  const nextParts = useNextParts(meId, shownGames.some((g) => g.nextPart));
  // Chess and checkers, 101 and Power Clash games still going wait quietly while the non-maths games are off.
  const nonMathsShut = nonMathsOpen === false;
  const inProgress = nonMathsShut ? [] : going.inProgress;
  const cardGoing = nonMathsShut ? [] : going.cardGoing;
  const powerGoing = nonMathsShut ? [] : going.powerGoing;
  // Teachers see the season strips too, so they know what their class sees (James, 30 Oct 2026).
  const seasonShown = season && season.clockOn && season.number > 0 && shownGames.some((g) => g.id === 'clan-quest') ? season : null;
  const lordSeasonShown = lordSeason && shownGames.some((g) => g.id === 'dragon-maths') ? lordSeason : null;
  // With both strips showing, each says which game it is.
  const bothSeasons = !!seasonShown && !!lordSeasonShown;
  const [levels, setLevels] = useState<Record<string, BotLevel>>({});
  const [featured, setFeatured] = useState(GAMES[0].id);
  const levelFor = (gameId: string) => levels[gameId] ?? 'easy';

  // The big Play button: a maths game while the class has the non-maths games off.
  const featuredGame =
    nonMathsOpen === false ? (shownGames.find((g) => g.Play) ?? GAMES[0]) : (findGame(featured) ?? GAMES[0]);
  const featuredLevel = BOT_LEVELS.find((l) => l.id === levelFor(featuredGame.id))!;
  // Training before games: the cards still open (to the "Training first" screen), but look resting until a session is done.
  const gate = useTrainingGate();
  const gamesLocked = trainingOn() && gate.ready && gate.locked;

  // Each person's own layout: folded-away sections and games pinned to the top (James, 4 Nov 2026).
  const { isCollapsed, toggleCollapsed, isPinned, togglePinned, layout } = useHomeLayout(meId);
  // Every card on the page, with the group it belongs in. A pinned card moves to Pinned, at the top.
  const tiles: Tile[] = shownGames
    .filter((game) => GAME_GROUPS.some((g) => g.group === game.group))
    .map((game) => ({
      id: game.id,
      group: game.group,
      card: (
        <GameCard
          key={game.id}
          game={game}
          level={levelFor(game.id)}
          moves={moves[game.id]}
          note={game.id === 'monsters' ? spottedNote(nzDay(Date.now())) : undefined}
          nextPartDone={nextParts[game.id]}
          onLevelChange={(level) => {
            setLevels((prev) => ({ ...prev, [game.id]: level }));
            setFeatured(game.id);
          }}
          pinned={isPinned(game.id)}
          onPinChange={() => togglePinned(game.id)}
        />
      ),
    }));
  // Quick looks is a training activity, but it sits with the foundational games (James, 4 Nov 2026), straight after Robin's
  // counting: seeing small numbers at a glance comes next (James, 10 Nov 2026).
  if (trainingOn())
    tiles.splice(quickLooksAt(tiles), 0, {
      id: 'quick-looks',
      group: 'foundational',
      card: (
        <ActivityCard
          key="quick-looks"
          id="quick-looks"
          name="Quick looks"
          tagline="Flash a picture, tap how many you saw"
          to="/training?quick=1"
          colours={['#4f9e45', '#8fcdf0']}
          pinned={isPinned('quick-looks')}
          onPinChange={() => togglePinned('quick-looks')}
        />
      ),
    });
  // Training's card, in the same look as the games (dashboard plan D1). It has its own section, but can be pinned like a game.
  const trainingTile: Tile | null = trainingOn()
    ? {
        id: 'training',
        group: undefined,
        card: (
          <ActivityCard
            key="training"
            id="training"
            name="Multiplication and division training"
            tagline="A few minutes a day to build your facts"
            to="/training"
            colours={['#2f6fb5', '#7fc4e8']}
            pinned={isPinned('training')}
            onPinChange={() => togglePinned('training')}
          />
        ),
      }
    : null;
  if (trainingTile) tiles.push(trainingTile);
  // In the order they were pinned (a pinned game the class can't see right now just waits).
  const pinnedTiles = layout.pinned.flatMap((id) => tiles.filter((t) => t.id === id));
  // My games: every pinned game, then the pupil's most played, up to MY_GAMES_SHOWN. A pupil with neither sees their class's most
  // played instead. A most-played game also stays in its own section; only pinned games move out of theirs.
  const fill = (ids: string[]) => ids.flatMap((id) => tiles.filter((t) => t.id === id && !isPinned(t.id)));
  const played = fill(topGames?.mine ?? []);
  const popular = pinnedTiles.length === 0 && played.length === 0;
  const myTiles = [...pinnedTiles, ...(popular ? fill(topGames?.classGames ?? []) : played)].slice(0, Math.max(MY_GAMES_SHOWN, pinnedTiles.length));
  const topTiles = MY_GAMES_ON ? myTiles : pinnedTiles;
  // The season timelines sit under My games when Clan Quest or Dragon Maths is in it, otherwise with the complex maths games.
  const seasonsOnTop = MY_GAMES_ON && topTiles.some((t) => t.id === 'clan-quest' || t.id === 'dragon-maths');
  const seasonStrips = (seasonShown || lordSeasonShown) && (
    <div className={bothSeasons ? 'season-strips season-strips--two' : 'season-strips'}>
      <Suspense fallback={null}>
        {seasonShown && <SeasonStrip clock={seasonShown} title={bothSeasons ? 'Clan Quest this season' : undefined} />}
        {lordSeasonShown && <DragonSeasonStrip season={lordSeasonShown} title={bothSeasons ? 'Dragon Maths this season' : undefined} />}
      </Suspense>
    </div>
  );

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
          {!MY_GAMES_ON && (
            <Link className="button button--play hero__go" to={`/${featuredGame.id}?bot=${featuredLevel.id}`}>
              <span aria-hidden="true">▶</span> Play
            </Link>
          )}
          {pupil && (
            <Link className="hero__warp" to="/warp">
              <span aria-hidden="true">🌀</span> Class Warp
            </Link>
          )}
          {!MY_GAMES_ON && (
            <p className="hero__play-hint">
              {featuredGame.name} vs {featuredLevel.label} bot
            </p>
          )}
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
        {topTiles.length > 0 && (
          <GameGroup
            id="pinned"
            title={!MY_GAMES_ON ? 'Pinned' : popular ? 'Popular in your class' : 'My games'}
            count={topTiles.length}
            collapsed={isCollapsed('pinned')}
            onToggle={() => toggleCollapsed('pinned')}
          >
            <div className={MY_GAMES_ON ? 'game-grid game-grid--mine' : 'game-grid'}>{topTiles.map((tile) => tile.card)}</div>
            {seasonsOnTop && seasonStrips}
          </GameGroup>
        )}
        {GAME_GROUPS.map((group) => {
          const groupTiles = tiles.filter((t) => t.group === group.group && !isPinned(t.id));
          // Training sits under the non-maths games, and stays when they are switched off.
          const training = group.group === 'no-maths' && trainingOn();
          // A group whose games are all pinned keeps its heading, so it is clear where they went.
          const hasGames = tiles.some((t) => t.group === group.group);
          if (!hasGames && !training) return null;
          return (
            <Fragment key={group.title}>
              {hasGames && (
                <GameGroup
                  id={group.group}
                  title={group.title}
                  count={groupTiles.length}
                  collapsed={isCollapsed(group.group)}
                  onToggle={() => toggleCollapsed(group.group)}
                >
                  {/* The season timelines sit with their games, in the complex maths games (James, 29 Oct 2026): Clan Quest's and
                      Dragon Maths', side by side on wide screens. */}
                  {group.group === 'complex-maths' && !seasonsOnTop && seasonStrips}
                  {groupTiles.length > 0 ? (
                    <div className="game-grid">{groupTiles.map((tile) => tile.card)}</div>
                  ) : (
                    <p className="game-group__empty">All pinned to the top.</p>
                  )}
                </GameGroup>
              )}
              {/* Training has a line of its own, under the non-maths games. */}
              {training && (
                <GameGroup id="training" title="Training" collapsed={isCollapsed('training')} onToggle={() => toggleCollapsed('training')}>
                  {isPinned('training') ? (
                    <p className="game-group__empty">Pinned to the top.</p>
                  ) : (
                    <div className="game-grid">{trainingTile?.card}</div>
                  )}
                </GameGroup>
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
