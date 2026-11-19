import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { colourName, normaliseCode, otherSide, prettyCode, type GameKind, type Side } from '../../shared/multiplayer';
import { useAuth } from '../auth/AuthContext';
import { AvatarImage } from '../avatar/AvatarImage';
import { FavouriteTrophies, useTrophyShelves } from '../trophies/FavouriteTrophies';
import { fetchLobbyPage } from '../data/lobby';
import { ask, MultiplayerError, fetchMultiplayerEnabled, type Action, type FriendGame, type LobbyGame, type PlayerCard } from '../data/multiplayer';
import { askSpace, seatsOf, type SpaceGame, type SpaceLobbyGame } from '../data/spaceGames';
import { askCard, type CardLobbyGame, type SeatSummary } from '../data/cardGames';
import { askPower, seatsOf as powerSeatsOf, type PowerGame, type PowerLobbyGame } from '../data/powerGames';
import { CLAN_QUEST_ON, DRAGON_MATHS_ON, findGame, GAMES, POWER_CLASH_ON } from '../games/registry';
import { archeryOn } from '../games/archery/switch';
import { islesOn } from '../games/isles/switch';
import { GAME_NAMES } from '../components/challengeWords';
import { serverHubAskLink, type AskGame, type HubAsk } from '../data/hubAsks';
import { fetchLobbyHere, livePath, sendChallenge, type HerePlayer, type LobbyHere, type MyGame } from '../data/lobbyHere';
import { useHubAsks } from '../multiplayer/useHubAsks';
import { ChallengesForYou, EMOJI, FIRST, GameTiles, PAUSED, WhosHere, type Tile } from './LobbyFriends';
import { useMathsMode } from '../games/space/mathsMode';
import { useNonMathsGamesOpen } from '../data/nonMathsGames';
import type { DesignedBoardId } from '../../shared/space/boards';
import type { Mode } from '../../shared/space/engine';
import { boardLabel, BOARD_NAMES, DESIGNED_BOARD_ORDER } from '../../shared/space/names';

/**
 * How often the list of open games refreshes while the lobby is open. Each refresh used to be
 * about ten requests, so with a whole class in the lobby 5 seconds was too much for the database
 * (19 Oct 2026); now it is one (S.4). Coming back to the tab refreshes straight away, and creating
 * or joining a game never waits for this.
 */
export const LOBBY_REFRESH_MS = 20000;

type SideChoice = Side | 'random';
/** What can be started here: the two-player games, and Wormholes & Black Holes and 101 for up to 4. */
type LobbyGameKind = GameKind | 'space' | '101' | 'power-clash';
type SpaceBoardChoice = DesignedBoardId | 'galaxy-of-the-day';

/** A game you can join from the list: chess or checkers (mp_games), space (space_games), 101 (card_games) or Power Clash (power_games). */
type OpenGame =
  | { kind: 'friend'; game: LobbyGame }
  | { kind: 'space'; game: SpaceLobbyGame }
  | { kind: '101'; game: CardLobbyGame }
  | { kind: 'power-clash'; game: PowerLobbyGame };

/** Each board game's tile picture. */
const BOARD_EMOJI: Record<string, string> = { chess: '♟️', checkers: '🔴', '101': '🃏', space: '🚀', 'power-clash': '⚡' };

/**
 * The lobby, "Play a friend" (docs/plans/play-anyone/PLAN.md, section D): challenges waiting for me, my games, a tile for
 * every way to play (greyed with the reason and a fix when I can't yet), who's here with what we can play together, the
 * start-a-game form and open games for the board games, and the code box.
 */
export function Lobby() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [open, setOpen] = useState<OpenGame[] | null>(null);
  const [mine, setMine] = useState<FriendGame[]>([]);
  const [mySpace, setMySpace] = useState<SpaceGame[]>([]);
  const [myCards, setMyCards] = useState<SeatSummary[]>([]);
  const [myPower, setMyPower] = useState<PowerGame[]>([]);
  const [cards, setCards] = useState<Map<string, PlayerCard>>(new Map());
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ where: 'create' | 'join' | 'list'; text: string } | null>(null);

  const [gameKind, setGameKind] = useState<LobbyGameKind>('chess');
  // With the class's non-maths games off, only the space game can be started or joined here.
  const nonMathsShut = useNonMathsGamesOpen() === false;
  useEffect(() => {
    if (nonMathsShut) setGameKind('space');
  }, [nonMathsShut]);
  const shownOpen = open && nonMathsShut ? open.filter((o) => o.kind === 'space') : open;
  const [side, setSide] = useState<SideChoice>('first');
  const [spaceBoard, setSpaceBoard] = useState<SpaceBoardChoice>('nebula');
  const [spaceMode, setSpaceMode] = useState<Mode>('cosmic');
  // Mission Control maths: what the teacher allows, and (if students choose) what the host picked.
  const mathsMode = useMathsMode() ?? 'off';
  const [spaceMaths, setSpaceMaths] = useState(true);
  const [cardPlayers, setCardPlayers] = useState(3);
  const [cardTarget, setCardTarget] = useState<50 | 101>(50);

  // The space game's settings live with the game, which loads only when it's picked. The
  // student's last choices fill in the form, unless they've already changed it.
  const spacePrefs = () => import('../games/space/prefs');
  const spaceTouched = useRef(false);
  useEffect(() => {
    if (gameKind !== 'space' || spaceTouched.current) return;
    let current = true;
    void spacePrefs().then(({ loadPrefs }) => {
      if (!current || spaceTouched.current) return;
      const saved = loadPrefs();
      setSpaceBoard(saved.board === 'galaxy' ? 'galaxy-of-the-day' : saved.board);
      setSpaceMode(saved.mode);
      setSpaceMaths(saved.maths);
    });
    return () => {
      current = false;
    };
  }, [gameKind]);
  const pickSpaceBoard = (board: SpaceBoardChoice) => {
    spaceTouched.current = true;
    setSpaceBoard(board);
  };
  const pickSpaceMode = (mode: Mode) => {
    spaceTouched.current = true;
    setSpaceMode(mode);
  };
  const [inLobby, setInLobby] = useState(false);
  const [code, setCode] = useState('');
  /** A board game's tile was tapped: its start form shows. */
  const [startOpen, setStartOpen] = useState(false);

  // The live games (stage 3): what I can start, my fights, and who's here. The hub banner doesn't show on this page, so
  // this page says "I'm here" for the hub and lists the challenges itself.
  const [here, setHere] = useState<LobbyHere | null>(null);
  const [focus, setFocus] = useState<AskGame | null>(null);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState('');
  const hubAsks = useHubAsks(profile?.role === 'student' ? serverHubAskLink : undefined, profile?.id);

  // One request for the open games, my own games and the other players' names (S.4); the switch comes from the remembered
  // settings read (S.1). If either fails, the lobby keeps what it has and says so if it has nothing yet. Asks again for whoever
  // signs in.
  const refresh = useCallback(async () => {
    void fetchLobbyHere().then((h) => h && setHere(h));
    try {
      const [on, lobby] = await Promise.all([fetchMultiplayerEnabled(), fetchLobbyPage()]);
      // Power Clash is not on the lobby until James switches it on.
      const powerLobby = POWER_CLASH_ON ? lobby.powerLobby : [];
      setEnabled(on);
      setOpen(
        [
          ...lobby.friendLobby.map((game): OpenGame => ({ kind: 'friend', game })),
          ...lobby.spaceLobby.map((game): OpenGame => ({ kind: 'space', game })),
          ...lobby.cardLobby.map((game): OpenGame => ({ kind: '101', game })),
          ...powerLobby.map((game): OpenGame => ({ kind: 'power-clash', game })),
        ].sort((a, b) => b.game.created_at.localeCompare(a.game.created_at)),
      );
      setMine(lobby.friendOpen);
      setMySpace(lobby.spaceOpen);
      setMyCards(lobby.cardOpen);
      setMyPower(POWER_CLASH_ON ? lobby.powerOpen : []);
      setCards(lobby.players);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, [profile?.id]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, LOBBY_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  async function go(where: 'create' | 'join' | 'list', request: () => Promise<string>) {
    setBusy(true);
    setMessage(null);
    try {
      navigate(await request());
    } catch (error) {
      setMessage({ where, text: error instanceof Error ? error.message : 'Something went wrong. Please try again.' });
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  function joinWithCode(event: FormEvent) {
    event.preventDefault();
    const tidy = normaliseCode(code);
    if (!tidy) {
      setMessage({ where: 'join', text: 'Codes are 5 letters and numbers, like KM4 TP.' });
      return;
    }
    // The same code box joins any game: chess and checkers first, then space games, then 101, then Power Clash.
    const notFound = (error: unknown) => error instanceof MultiplayerError && error.problem === 'not-found';
    void go('join', async () => {
      try {
        return friendPath(await ask({ action: 'join', code: tidy }));
      } catch (error) {
        if (!notFound(error)) throw error;
      }
      try {
        return spacePath(await askSpace({ action: 'join', code: tidy }));
      } catch (error) {
        if (!notFound(error)) throw error;
      }
      try {
        return cardPath(await askCard({ action: 'join', code: tidy }));
      } catch (error) {
        if (!notFound(error) || !POWER_CLASH_ON) throw error;
      }
      return powerPath(await askPower({ action: 'join', code: tidy }));
    });
  }

  function create() {
    if (gameKind === 'power-clash') {
      void go('create', async () => powerPath(await askPower({ action: 'create', lobby: inLobby })));
      return;
    }
    if (gameKind === '101') {
      void go('create', async () =>
        cardPath(await askCard({ action: 'create', players: cardPlayers, settings: { target: cardTarget }, lobby: inLobby })),
      );
      return;
    }
    if (gameKind !== 'space') {
      const request: Action = { action: 'create', game: gameKind, side, lobby: inLobby };
      void go('create', async () => friendPath(await ask(request)));
      return;
    }
    void go('create', async () => {
      const [{ loadPrefs, mathsOn, savePrefs, setupFrom, todaysGalaxy }, { DESIGNED_BOARDS }] = await Promise.all([
        spacePrefs(),
        import('../../shared/space/boards'),
      ]);
      const saved = loadPrefs();
      const galaxy = spaceBoard === 'galaxy-of-the-day';
      const withMaths = { ...saved, maths: spaceMaths };
      // Cosmic events come with the board (on for Deep Space), as on the bot game's settings.
      const setup = setupFrom(
        {
          ...withMaths,
          mode: spaceMode,
          board: galaxy ? 'galaxy' : spaceBoard,
          galaxy: galaxy ? todaysGalaxy() : saved.galaxy,
          galaxySize: 100,
          cosmicEvents: galaxy ? saved.cosmicEvents : DESIGNED_BOARDS[spaceBoard].cosmicEvents,
        },
        mathsOn(mathsMode, withMaths),
      );
      if ('problem' in setup) throw new Error(setup.problem);
      savePrefs({ ...saved, mode: spaceMode, ...(mathsMode === 'choose' ? { maths: spaceMaths } : {}), ...(galaxy ? {} : { board: spaceBoard }) });
      return spacePath(await askSpace({ action: 'create', setup, lobby: inLobby }));
    });
  }

  const playing = mine.filter((g) => g.status === 'playing');
  const waiting = mine.find((g) => g.status === 'waiting');
  const spaceGoing = mySpace.filter((g) => g.status === 'playing' || (g.status === 'waiting' && g.host !== profile?.id));
  const spaceWaiting = mySpace.find((g) => g.status === 'waiting' && g.host === profile?.id);
  const spaceName = findGame('space')?.name ?? 'Wormholes & Black Holes';
  /** The other players' names in a game, or none (when they show as "your classmates" or "a classmate"). */
  const others = (ids: (string | null | undefined)[]) =>
    ids.filter((p): p is string => !!p && p !== profile?.id).map((p) => cards.get(p)?.display_name ?? 'a classmate');
  const crewOf = (g: SpaceGame) => others(seatsOf(g));
  const gameName = (id: string) => findGame(id)?.name ?? id;
  const powerName = findGame('power-clash')?.name ?? 'Power Clash';
  const powerGoing = myPower.filter((g) => g.status === 'playing' || (g.status === 'waiting' && g.host !== profile?.id));
  const powerWaiting = myPower.find((g) => g.status === 'waiting' && g.host === profile?.id);
  const powerMatesOf = (g: PowerGame) => others(powerSeatsOf(g));
  const cardGoing = myCards.filter((g) => g.status === 'playing' || (g.status === 'waiting' && g.info.host !== profile?.id));
  const cardWaiting = myCards.find((g) => g.status === 'waiting' && g.info.host === profile?.id);
  const tableOf = (g: SeatSummary) => others(g.info.players);

  const shelves = useTrophyShelves([
    ...(shownOpen ?? []).map((o) => o.game.creator_name),
    ...playing.map((g) => cards.get((g.first_player === profile?.id ? g.second_player : g.first_player) ?? '')?.display_name),
    ...spaceGoing.flatMap(crewOf),
    ...powerGoing.flatMap(powerMatesOf),
    ...cardGoing.flatMap(tableOf),
  ]);
  /** Names with each one's favourite trophies beside it (profile card P6). */
  const withTrophies = (names: string[], none: string) =>
    names.length === 0
      ? none
      : names.map((n, i) => (
          <Fragment key={`${n}-${i}`}>
            {i > 0 && ', '}
            {n}
            <FavouriteTrophies shelf={shelves[n]} />
          </Fragment>
        ));

  // ---- The live games and the tiles (stage 3) ----
  const boardsOpen = enabled !== false;
  const liveGames = ([archeryOn() && 'archery', DRAGON_MATHS_ON && 'dragon-maths', CLAN_QUEST_ON && 'clan-quest'] as const).filter(
    (g): g is AskGame => !!g,
  );
  const liveGoing = here?.going ?? [];

  const sayYes = (a: HubAsk) => {
    hubAsks.drop(a);
    navigate(`/${a.game}?ask=${a.id}`);
  };
  const sayNo = (a: HubAsk) => {
    hubAsks.drop(a);
    void serverHubAskLink.decline(a);
  };
  async function challenge(game: AskGame, them: HerePlayer) {
    setSending(true);
    setProblem('');
    try {
      const why = await sendChallenge(game, them);
      if (why === null) {
        navigate(livePath(game));
        return;
      }
      setProblem(why);
      void refresh();
    } catch {
      setProblem('That couldn’t be sent just now. Please try again.');
    } finally {
      setSending(false);
    }
  }

  const myTile = (id: MyGame, name: string, emoji: string, blurb: string, onPick: () => void): Tile => {
    const state = here?.me[id];
    return {
      id,
      name,
      emoji,
      blurb,
      why: !here ? 'Checking…' : state === 'off' ? PAUSED : state === 'none' ? FIRST[id].why : null,
      fix: state === 'none' ? { label: FIRST[id].fix, to: FIRST[id].to } : undefined,
      picked: focus === id,
      onPick,
    };
  };
  const pickLive = (game: AskGame) => () => {
    setFocus(game);
    setStartOpen(false);
    document.getElementById('whos-here')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };
  const tiles: Tile[] = [
    ...GAMES.filter((g) => g.Live || g.id === 'space' || g.id === '101' || g.id === 'power-clash').map(
      (g): Tile => ({
        id: g.id,
        name: g.name,
        emoji: BOARD_EMOJI[g.id] ?? '🎲',
        blurb: g.id === 'space' || g.id === '101' ? '2–4 players. Start a game or join one' : 'Start a game or join one',
        why: enabled === false || (nonMathsShut && g.group === 'no-maths') ? PAUSED : null,
        picked: startOpen && gameKind === g.id,
        onPick: () => {
          setGameKind(g.id as LobbyGameKind);
          setStartOpen(true);
          setFocus(null);
          setTimeout(() => document.getElementById('create-title')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 50);
        },
      }),
    ),
    ...liveGames.map((g) => myTile(g, g === 'archery' ? 'Archery fight' : g === 'dragon-maths' ? 'Dragon Maths clash' : 'Clan duel', EMOJI[g], 'Pick someone who’s here', pickLive(g))),
    ...(islesOn() ? [myTile('isles', 'Sky race', '☁️', 'Race another island', () => navigate('/isles?open=race'))] : []),
    ...(CLAN_QUEST_ON ? [myTile('raid', 'Village Raid', '🏰', 'Raid a village', () => navigate('/clan-quest?open=raid'))] : []),
  ];

  return (
    <div className="lobby">
      <h1 className="page-title">🤝 Play a friend</h1>

      {loadFailed && !open && <p className="chess-note">We couldn’t load the lobby. Check the Wi-Fi; we’ll keep trying.</p>}

      <ChallengesForYou asks={hubAsks.asks} serverNow={hubAsks.serverNow} onYes={sayYes} onNo={sayNo} />

      {(playing.length > 0 || waiting || spaceGoing.length > 0 || spaceWaiting || cardGoing.length > 0 || cardWaiting || powerGoing.length > 0 || powerWaiting || liveGoing.length > 0) && (
        <section className="panel" aria-labelledby="mine-title">
          <h2 id="mine-title" className="panel__title">
            Your games
          </h2>
          <ul className="lobby-list">
            {liveGoing.map((g) => (
              <li key={`${g.game}:${g.id}`}>
                <span className="lobby-list__emoji" aria-hidden="true">
                  {EMOJI[g.game]}
                </span>
                <span className="lobby-list__what">
                  <strong>
                    {GAME_NAMES[g.game]} vs {g.with}
                  </strong>
                  <span>{g.status === 'asked' ? `Waiting for ${g.with} to say yes` : 'Still going!'}</span>
                </span>
                <Link to={livePath(g.game)} className="button button--primary">
                  {g.status === 'asked' ? 'Open' : 'Carry on'}
                </Link>
              </li>
            ))}
            {playing.map((g) => {
              const opponentId = g.first_player === profile?.id ? g.second_player : g.first_player;
              const card = opponentId ? cards.get(opponentId) : undefined;
              return (
                <li key={g.id}>
                  <AvatarImage avatar={card?.avatar} size={44} />
                  <span className="lobby-list__what">
                    <strong>
                      {gameName(g.game)} vs {card?.display_name ?? 'a classmate'}
                      <FavouriteTrophies shelf={card ? shelves[card.display_name] : undefined} />
                    </strong>
                    <span>Still going!</span>
                  </span>
                  <Link to={`/play/${g.id}`} className="button button--primary">
                    Carry on
                  </Link>
                </li>
              );
            })}
            {spaceGoing.map((g) => (
              <li key={g.id}>
                <span className="lobby-list__emoji" aria-hidden="true">
                  🚀
                </span>
                <span className="lobby-list__what">
                  <strong>
                    {spaceName} with {withTrophies(crewOf(g), 'your classmates')}
                  </strong>
                  <span>{g.status === 'playing' ? 'Still going!' : 'Waiting for the host to launch'}</span>
                </span>
                <Link to={spacePath(g)} className="button button--primary">
                  {g.status === 'playing' ? 'Carry on' : 'Open'}
                </Link>
              </li>
            ))}
            {cardGoing.map((g) => (
              <li key={g.game}>
                <span className="lobby-list__emoji" aria-hidden="true">
                  🃏
                </span>
                <span className="lobby-list__what">
                  <strong>101 with {withTrophies(tableOf(g), 'your classmates')}</strong>
                  <span>{g.status === 'playing' ? 'Still going!' : 'Waiting for more players'}</span>
                </span>
                <Link to={cardPath({ id: g.game })} className="button button--primary">
                  {g.status === 'playing' ? 'Carry on' : 'Open'}
                </Link>
              </li>
            ))}
            {powerGoing.map((g) => (
              <li key={g.id}>
                <span className="lobby-list__emoji" aria-hidden="true">
                  ⚡
                </span>
                <span className="lobby-list__what">
                  <strong>
                    {powerName} with {withTrophies(powerMatesOf(g), 'a classmate')}
                  </strong>
                  <span>{g.status === 'playing' ? 'Still going!' : 'Waiting to start'}</span>
                </span>
                <Link to={powerPath(g)} className="button button--primary">
                  {g.status === 'playing' ? 'Carry on' : 'Open'}
                </Link>
              </li>
            ))}
            {powerWaiting && (
              <li>
                <span className="lobby-list__emoji" aria-hidden="true">
                  ⏳
                </span>
                <span className="lobby-list__what">
                  <strong>Your {powerName} game is waiting</strong>
                  <span>
                    Code {powerWaiting.code && prettyCode(powerWaiting.code)} · {powerSeatsOf(powerWaiting).filter(Boolean).length} of 2
                    joined
                  </span>
                </span>
                <Link to={powerPath(powerWaiting)} className="button button--light">
                  Open
                </Link>
              </li>
            )}
            {cardWaiting && (
              <li>
                <span className="lobby-list__emoji" aria-hidden="true">
                  ⏳
                </span>
                <span className="lobby-list__what">
                  <strong>Your 101 game is waiting</strong>
                  <span>
                    Code {cardWaiting.info.code && prettyCode(cardWaiting.info.code)} ·{' '}
                    {cardWaiting.info.players.filter(Boolean).length} of {cardWaiting.info.wanted} joined
                  </span>
                </span>
                <Link to={cardPath({ id: cardWaiting.game })} className="button button--light">
                  Open
                </Link>
              </li>
            )}
            {spaceWaiting && (
              <li>
                <span className="lobby-list__emoji" aria-hidden="true">
                  ⏳
                </span>
                <span className="lobby-list__what">
                  <strong>Your {spaceName} game is waiting</strong>
                  <span>
                    Code {spaceWaiting.code && prettyCode(spaceWaiting.code)} · {seatsOf(spaceWaiting).filter(Boolean).length} of 4
                    joined
                  </span>
                </span>
                <Link to={spacePath(spaceWaiting)} className="button button--light">
                  Open
                </Link>
              </li>
            )}
            {waiting && (
              <li>
                <span className="lobby-list__emoji" aria-hidden="true">
                  ⏳
                </span>
                <span className="lobby-list__what">
                  <strong>Your {gameName(waiting.game)} game is waiting</strong>
                  <span>Code {waiting.code && prettyCode(waiting.code)}</span>
                </span>
                <Link to={`/play/${waiting.id}`} className="button button--light">
                  Open
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}

      <section className="panel" aria-labelledby="pick-title">
        <h2 id="pick-title" className="panel__title">
          Pick a game
        </h2>
        <GameTiles tiles={tiles} />
      </section>

      {startOpen && boardsOpen && (
        <section className="panel lobby-start" aria-labelledby="create-title">
          <h2 id="create-title" className="panel__title">
            Start a game
          </h2>
          <p className="lobby-start__which">
            <strong>{gameName(gameKind)}</strong>
            {(gameKind === 'space' || gameKind === '101') && ' (2–4 players)'}
          </p>
          <div className="lobby-grid lobby-grid--one">
              {gameKind === '101' ? (
                <>
                  <fieldset className="level-picker">
                    <legend>Players</legend>
                    <div className="level-picker__options">
                      {[2, 3, 4].map((n) => (
                        <label key={n} className="level-picker__option">
                          <input type="radio" name="card-players" checked={cardPlayers === n} onChange={() => setCardPlayers(n)} />
                          <span>{n} players</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="level-picker">
                    <legend>Game length</legend>
                    <div className="level-picker__options">
                      <label className="level-picker__option">
                        <input type="radio" name="card-target" checked={cardTarget === 50} onChange={() => setCardTarget(50)} />
                        <span>Quick: to 50 (about 10–15 minutes)</span>
                      </label>
                      <label className="level-picker__option">
                        <input type="radio" name="card-target" checked={cardTarget === 101} onChange={() => setCardTarget(101)} />
                        <span>Normal: to 101 (about 20–30 minutes)</span>
                      </label>
                    </div>
                  </fieldset>
                </>
              ) : gameKind === 'space' ? (
                <>
                  <fieldset className="level-picker">
                    <legend>Board</legend>
                    <div className="level-picker__options">
                      {[...DESIGNED_BOARD_ORDER, 'galaxy-of-the-day' as const].map((id) => (
                        <label key={id} className="level-picker__option">
                          <input
                            type="radio"
                            name="space-board"
                            checked={spaceBoard === id}
                            onChange={() => pickSpaceBoard(id)}
                          />
                          <span>{id === 'galaxy-of-the-day' ? 'Galaxy of the day' : BOARD_NAMES[id]}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="level-picker">
                    <legend>Mode</legend>
                    <div className="level-picker__options">
                      <label className="level-picker__option">
                        <input type="radio" name="space-mode" checked={spaceMode === 'cosmic'} onChange={() => pickSpaceMode('cosmic')} />
                        <span>✨ Cosmic (items, stars, everything)</span>
                      </label>
                      <label className="level-picker__option">
                        <input type="radio" name="space-mode" checked={spaceMode === 'classic'} onChange={() => pickSpaceMode('classic')} />
                        <span>Classic (just wormholes and black holes)</span>
                      </label>
                    </div>
                  </fieldset>
                  {mathsMode === 'choose' && (
                    <fieldset className="level-picker">
                      <legend>Mission Control maths</legend>
                      <div className="level-picker__options">
                        <label className="level-picker__option">
                          <input type="radio" name="space-maths" checked={spaceMaths} onChange={() => setSpaceMaths(true)} />
                          <span>On: maths questions for everyone in the game</span>
                        </label>
                        <label className="level-picker__option">
                          <input type="radio" name="space-maths" checked={!spaceMaths} onChange={() => setSpaceMaths(false)} />
                          <span>Off</span>
                        </label>
                      </div>
                    </fieldset>
                  )}
                  {mathsMode === 'on' && <p className="friend-note">Mission Control maths is on for everyone in this game.</p>}
                </>
              ) : gameKind === 'power-clash' ? (
                <p className="friend-note">
                  Two players. You each pick 3 powers, then play noughts and crosses where the first to win 3 rounds wins.
                </p>
              ) : (
                <fieldset className="level-picker">
                  <legend>Your pieces</legend>
                  <div className="level-picker__options">
                    {(
                      [
                        ['first', `${colourName(gameKind, 'first')} (you go first)`],
                        ['second', colourName(gameKind, 'second')],
                        ['random', 'Surprise me'],
                      ] as const
                    ).map(([value, text]) => (
                      <label key={value} className="level-picker__option">
                        <input
                          type="radio"
                          name="friend-side"
                          value={value}
                          checked={side === value}
                          onChange={() => setSide(value)}
                        />
                        <span>{text}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <fieldset className="level-picker">
                <legend>Who can join?</legend>
                <div className="level-picker__options">
                  <label className="level-picker__option">
                    <input type="radio" name="friend-who" checked={!inLobby} onChange={() => setInLobby(false)} />
                    <span>A friend with the code</span>
                  </label>
                  <label className="level-picker__option">
                    <input type="radio" name="friend-who" checked={inLobby} onChange={() => setInLobby(true)} />
                    <span>Anyone in the lobby</span>
                  </label>
                </div>
              </fieldset>
              <button
                type="button"
                className="button button--play"
                disabled={busy}
                onClick={create}
              >
                <span aria-hidden="true">▶</span> Start game
              </button>
              {message?.where === 'create' && (
                <p className="chess-note" role="alert">
                  {message.text}
                </p>
              )}
          </div>
        </section>
      )}

      {boardsOpen && (
        <section className="panel" aria-labelledby="open-title">
          <h2 id="open-title" className="panel__title">
            Open games
          </h2>
            {message?.where === 'list' && (
              <p className="chess-note" role="alert">
                {message.text}
              </p>
            )}
            {!shownOpen ? (
              <p className="panel__empty">Loading…</p>
            ) : shownOpen.length === 0 ? (
              <p className="panel__empty">No open games right now. Start one and choose “Anyone in the lobby”!</p>
            ) : (
              <ul className="lobby-list">
                {shownOpen.map((o) =>
                  o.kind === 'friend' ? (
                    <li key={o.game.id}>
                      <AvatarImage avatar={o.game.creator_avatar} size={44} />
                      <span className="lobby-list__what">
                        <strong>
                          {o.game.creator_name} · {gameName(o.game.game)}
                          <FavouriteTrophies shelf={shelves[o.game.creator_name]} />
                        </strong>
                        <span>
                          You’d play {colourName(o.game.game, o.game.open_side)}
                          {o.game.open_side === 'first' ? ' and go first' : ''}. They play{' '}
                          {colourName(o.game.game, otherSide(o.game.open_side))}.
                        </span>
                      </span>
                      <button
                        type="button"
                        className="button button--primary"
                        disabled={busy}
                        onClick={() => void go('list', async () => friendPath(await ask({ action: 'join', gameId: o.game.id })))}
                      >
                        Join
                      </button>
                    </li>
                  ) : o.kind === 'power-clash' ? (
                    <li key={o.game.id}>
                      <AvatarImage avatar={o.game.creator_avatar} size={44} />
                      <span className="lobby-list__what">
                        <strong>
                          {o.game.creator_name} · {powerName}
                          <FavouriteTrophies shelf={shelves[o.game.creator_name]} />
                        </strong>
                        <span>Two players. Pick three powers, first to win 3 rounds.</span>
                      </span>
                      <button
                        type="button"
                        className="button button--primary"
                        disabled={busy}
                        onClick={() => void go('list', async () => powerPath(await askPower({ action: 'join', gameId: o.game.id })))}
                      >
                        Join
                      </button>
                    </li>
                  ) : o.kind === '101' ? (
                    <li key={o.game.id}>
                      <AvatarImage avatar={o.game.creator_avatar} size={44} />
                      <span className="lobby-list__what">
                        <strong>
                          {o.game.creator_name} · 101
                          <FavouriteTrophies shelf={shelves[o.game.creator_name]} />
                        </strong>
                        <span>
                          {o.game.target === 50 ? 'Quick game, to 50' : 'Normal game, to 101'}. {o.game.players} of {o.game.wanted} joined.
                        </span>
                      </span>
                      <button
                        type="button"
                        className="button button--primary"
                        disabled={busy}
                        onClick={() => void go('list', async () => cardPath(await askCard({ action: 'join', gameId: o.game.id })))}
                      >
                        Join
                      </button>
                    </li>
                  ) : (
                    <li key={o.game.id}>
                      <AvatarImage avatar={o.game.creator_avatar} size={44} />
                      <span className="lobby-list__what">
                        <strong>
                          {o.game.creator_name} · {spaceName}
                          <FavouriteTrophies shelf={shelves[o.game.creator_name]} />
                        </strong>
                        <span>
                          {boardLabel(o.game.board)}, {o.game.mode === 'classic' ? 'Classic' : 'Cosmic'}. {o.game.players} of 4 joined.
                        </span>
                      </span>
                      <button
                        type="button"
                        className="button button--primary"
                        disabled={busy}
                        onClick={() => void go('list', async () => spacePath(await askSpace({ action: 'join', gameId: o.game.id })))}
                      >
                        Join
                      </button>
                    </li>
                  ),
                )}
              </ul>
            )}
        </section>
      )}

      {liveGames.length > 0 && (
        <WhosHere
          online={here?.online ?? null}
          me={here?.me ?? null}
          games={liveGames}
          focus={focus}
          onClearFocus={() => setFocus(null)}
          sending={sending}
          problem={problem}
          onSend={(g, them) => void challenge(g, them)}
        />
      )}

      {boardsOpen && (
        <section className="panel lobby-code" aria-labelledby="join-title">
          <h2 id="join-title" className="panel__title">
            Join with a code
          </h2>
              <form className="code-form" onSubmit={joinWithCode}>
                <label htmlFor="game-code">Type the code your friend gives you</label>
                <input
                  id="game-code"
                  className="code-form__input"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
                  placeholder="KM4 TP"
                  autoComplete="off"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={8}
                />
                <button type="submit" className="button button--primary" disabled={busy || code.trim() === ''}>
                  Join game
                </button>
              </form>
              {message?.where === 'join' && (
                <p className="chess-note" role="alert">
                  {message.text}
                </p>
              )}
        </section>
      )}
    </div>
  );
}


const friendPath = (game: { id: string }) => `/play/${game.id}`;
const spacePath = (game: { id: string }) => `/space-game/${game.id}`;
const powerPath = (game: { id: string }) => `/power-game/${game.id}`;
const cardPath = (seat: { id: string } | { game: string }) => `/card-game/${'game' in seat ? seat.game : seat.id}`;
