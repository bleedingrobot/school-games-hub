import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { colourName, normaliseCode, otherSide, prettyCode, type GameKind, type Side } from '../../shared/multiplayer';
import { useAuth } from '../auth/AuthContext';
import { AvatarImage } from '../avatar/AvatarImage';
import {
  ask,
  MultiplayerError,
  fetchLobby,
  fetchMultiplayerEnabled,
  fetchMyOpenGames,
  fetchPlayerCards,
  type Action,
  type FriendGame,
  type LobbyGame,
  type PlayerCard,
} from '../data/multiplayer';
import { askSpace, fetchMyOpenSpaceGames, fetchSpaceLobby, seatsOf, type SpaceGame, type SpaceLobbyGame } from '../data/spaceGames';
import { findGame, GAMES } from '../games/registry';
import type { DesignedBoardId } from '../../shared/space/boards';
import type { Mode } from '../../shared/space/engine';
import { boardLabel, BOARD_NAMES, DESIGNED_BOARD_ORDER } from '../../shared/space/names';

/** How often the list of open games refreshes while the lobby is open. */
export const LOBBY_REFRESH_MS = 5000;

type SideChoice = Side | 'random';
/** What can be started here: the two-player games, and Wormholes & Black Holes for up to 4. */
type LobbyGameKind = GameKind | 'space';
type SpaceBoardChoice = DesignedBoardId | 'galaxy-of-the-day';

/** A game you can join from the list: chess or checkers (mp_games) or space (space_games). */
type OpenGame = { kind: 'friend'; game: LobbyGame } | { kind: 'space'; game: SpaceLobbyGame };

/** The lobby: start a game, join one with a code, or tap an open game. */
export function Lobby() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [open, setOpen] = useState<OpenGame[] | null>(null);
  const [mine, setMine] = useState<FriendGame[]>([]);
  const [mySpace, setMySpace] = useState<SpaceGame[]>([]);
  const [cards, setCards] = useState<Map<string, PlayerCard>>(new Map());
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ where: 'create' | 'join' | 'list'; text: string } | null>(null);

  const [gameKind, setGameKind] = useState<LobbyGameKind>('chess');
  const [side, setSide] = useState<SideChoice>('first');
  const [spaceBoard, setSpaceBoard] = useState<SpaceBoardChoice>('nebula');
  const [spaceMode, setSpaceMode] = useState<Mode>('cosmic');

  // The space game's settings live with the game, which loads only when it's picked.
  const spacePrefs = () => import('../games/space/prefs');
  useEffect(() => {
    if (gameKind !== 'space') return;
    let current = true;
    void spacePrefs().then(({ loadPrefs }) => {
      if (!current) return;
      const saved = loadPrefs();
      setSpaceBoard(saved.board === 'galaxy' ? 'galaxy-of-the-day' : saved.board);
      setSpaceMode(saved.mode);
    });
    return () => {
      current = false;
    };
  }, [gameKind]);
  const [inLobby, setInLobby] = useState(false);
  const [code, setCode] = useState('');

  const refresh = useCallback(async () => {
    try {
      // Space games load separately, so chess and checkers still work if they can't be loaded.
      const [on, lobby, myGames, spaceLobby, mySpaceGames] = await Promise.all([
        fetchMultiplayerEnabled(),
        fetchLobby(),
        fetchMyOpenGames(),
        fetchSpaceLobby().catch(() => []),
        fetchMyOpenSpaceGames().catch(() => []),
      ]);
      setEnabled(on);
      setOpen(
        [
          ...lobby.map((game): OpenGame => ({ kind: 'friend', game })),
          ...spaceLobby.map((game): OpenGame => ({ kind: 'space', game })),
        ].sort((a, b) => b.game.created_at.localeCompare(a.game.created_at)),
      );
      setMine(myGames);
      setMySpace(mySpaceGames);
      setLoadFailed(false);
      const opponents = [
        ...myGames.map((g) => (g.first_player === profile?.id ? g.second_player : g.first_player)),
        ...mySpaceGames.flatMap((g) => seatsOf(g).filter((p) => p !== profile?.id)),
      ].filter((id): id is string => !!id);
      if (opponents.length > 0) setCards(await fetchPlayerCards(opponents));
    } catch {
      setLoadFailed(true);
    }
  }, [profile?.id]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, LOBBY_REFRESH_MS);
    return () => clearInterval(timer);
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
    // The same code box joins any game: chess and checkers first, then space games.
    void go('join', async () => {
      try {
        return friendPath(await ask({ action: 'join', code: tidy }));
      } catch (error) {
        if (!(error instanceof MultiplayerError && error.problem === 'not-found')) throw error;
        return spacePath(await askSpace({ action: 'join', code: tidy }));
      }
    });
  }

  function create() {
    if (gameKind !== 'space') {
      const request: Action = { action: 'create', game: gameKind, side, lobby: inLobby };
      void go('create', async () => friendPath(await ask(request)));
      return;
    }
    void go('create', async () => {
      const { loadPrefs, savePrefs, setupFrom, todaysGalaxy } = await spacePrefs();
      const saved = loadPrefs();
      const galaxy = spaceBoard === 'galaxy-of-the-day';
      const setup = setupFrom({
        ...saved,
        mode: spaceMode,
        board: galaxy ? 'galaxy' : spaceBoard,
        galaxy: galaxy ? todaysGalaxy() : saved.galaxy,
        galaxySize: 100,
      });
      if ('problem' in setup) throw new Error(setup.problem);
      savePrefs({ ...saved, mode: spaceMode, ...(galaxy ? {} : { board: spaceBoard }) });
      return spacePath(await askSpace({ action: 'create', setup, lobby: inLobby }));
    });
  }

  const playing = mine.filter((g) => g.status === 'playing');
  const waiting = mine.find((g) => g.status === 'waiting');
  const spaceGoing = mySpace.filter((g) => g.status === 'playing' || (g.status === 'waiting' && g.host !== profile?.id));
  const spaceWaiting = mySpace.find((g) => g.status === 'waiting' && g.host === profile?.id);
  const spaceName = findGame('space')?.name ?? 'Wormholes & Black Holes';
  const crew = (g: SpaceGame) => {
    const names = seatsOf(g)
      .filter((p): p is string => !!p && p !== profile?.id)
      .map((p) => cards.get(p)?.display_name ?? 'a classmate');
    return names.length === 0 ? 'your classmates' : names.join(', ');
  };
  const gameName = (id: string) => findGame(id)?.name ?? id;

  return (
    <div className="lobby">
      <h1 className="page-title">🤝 Play a friend</h1>

      {loadFailed && !open && <p className="chess-note">We couldn’t load the lobby. Check the Wi-Fi; we’ll keep trying.</p>}

      {(playing.length > 0 || waiting || spaceGoing.length > 0 || spaceWaiting) && (
        <section className="panel" aria-labelledby="mine-title">
          <h2 id="mine-title" className="panel__title">
            Your games
          </h2>
          <ul className="lobby-list">
            {playing.map((g) => {
              const opponentId = g.first_player === profile?.id ? g.second_player : g.first_player;
              const card = opponentId ? cards.get(opponentId) : undefined;
              return (
                <li key={g.id}>
                  <AvatarImage avatar={card?.avatar} size={44} />
                  <span className="lobby-list__what">
                    <strong>
                      {gameName(g.game)} vs {card?.display_name ?? 'a classmate'}
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
                    {spaceName} with {crew(g)}
                  </strong>
                  <span>{g.status === 'playing' ? 'Still going!' : 'Waiting for the host to launch'}</span>
                </span>
                <Link to={spacePath(g)} className="button button--primary">
                  {g.status === 'playing' ? 'Carry on' : 'Open'}
                </Link>
              </li>
            ))}
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

      {enabled === false ? (
        <section className="friend-wait__card lobby-paused" aria-labelledby="paused-title">
          <div className="friend-wait__emoji" aria-hidden="true">
            ⏸️
          </div>
          <h2 id="paused-title">Games against friends are paused</h2>
          <p>Your teacher has paused games against friends for now. You can still play against the bots!</p>
          <Link to="/" className="button button--primary">
            Play a bot
          </Link>
        </section>
      ) : (
        <>
          <div className="lobby-grid">
            <section className="panel" aria-labelledby="create-title">
              <h2 id="create-title" className="panel__title">
                Start a game
              </h2>
              <fieldset className="level-picker">
                <legend>Game</legend>
                <div className="level-picker__options">
                  {GAMES.filter((g) => g.Live || g.id === 'space').map((g) => (
                    <label key={g.id} className="level-picker__option">
                      <input
                        type="radio"
                        name="friend-game"
                        value={g.id}
                        checked={gameKind === g.id}
                        onChange={() => setGameKind(g.id as LobbyGameKind)}
                      />
                      <span>
                        {g.name}
                        {g.id === 'space' && ' (2–4 players)'}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {gameKind === 'space' ? (
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
                            onChange={() => setSpaceBoard(id)}
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
                        <input type="radio" name="space-mode" checked={spaceMode === 'cosmic'} onChange={() => setSpaceMode('cosmic')} />
                        <span>✨ Cosmic (items, stars, everything)</span>
                      </label>
                      <label className="level-picker__option">
                        <input type="radio" name="space-mode" checked={spaceMode === 'classic'} onChange={() => setSpaceMode('classic')} />
                        <span>Classic (just wormholes and black holes)</span>
                      </label>
                    </div>
                  </fieldset>
                </>
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
            </section>

            <section className="panel" aria-labelledby="join-title">
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
          </div>

          <section className="panel" aria-labelledby="open-title">
            <h2 id="open-title" className="panel__title">
              Open games
            </h2>
            {message?.where === 'list' && (
              <p className="chess-note" role="alert">
                {message.text}
              </p>
            )}
            {!open ? (
              <p className="panel__empty">Loading…</p>
            ) : open.length === 0 ? (
              <p className="panel__empty">No open games right now. Start one and choose “Anyone in the lobby”!</p>
            ) : (
              <ul className="lobby-list">
                {open.map((o) =>
                  o.kind === 'friend' ? (
                    <li key={o.game.id}>
                      <AvatarImage avatar={o.game.creator_avatar} size={44} />
                      <span className="lobby-list__what">
                        <strong>
                          {o.game.creator_name} · {gameName(o.game.game)}
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
                  ) : (
                    <li key={o.game.id}>
                      <AvatarImage avatar={o.game.creator_avatar} size={44} />
                      <span className="lobby-list__what">
                        <strong>
                          {o.game.creator_name} · {spaceName}
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
        </>
      )}
    </div>
  );
}

const friendPath = (game: { id: string }) => `/play/${game.id}`;
const spacePath = (game: { id: string }) => `/space-game/${game.id}`;
