import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { colourName, normaliseCode, otherSide, prettyCode, type GameKind, type Side } from '../../shared/multiplayer';
import { useAuth } from '../auth/AuthContext';
import { AvatarImage } from '../avatar/AvatarImage';
import {
  ask,
  fetchLobby,
  fetchMultiplayerEnabled,
  fetchMyOpenGames,
  fetchPlayerCards,
  type Action,
  type FriendGame,
  type LobbyGame,
  type PlayerCard,
} from '../data/multiplayer';
import { findGame, GAMES } from '../games/registry';

/** How often the list of open games refreshes while the lobby is open. */
export const LOBBY_REFRESH_MS = 5000;

type SideChoice = Side | 'random';

/** The lobby: start a game, join one with a code, or tap an open game. */
export function Lobby() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [open, setOpen] = useState<LobbyGame[] | null>(null);
  const [mine, setMine] = useState<FriendGame[]>([]);
  const [cards, setCards] = useState<Map<string, PlayerCard>>(new Map());
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ where: 'create' | 'join' | 'list'; text: string } | null>(null);

  const [gameKind, setGameKind] = useState<GameKind>('chess');
  const [side, setSide] = useState<SideChoice>('first');
  const [inLobby, setInLobby] = useState(false);
  const [code, setCode] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [on, lobby, myGames] = await Promise.all([fetchMultiplayerEnabled(), fetchLobby(), fetchMyOpenGames()]);
      setEnabled(on);
      setOpen(lobby);
      setMine(myGames);
      setLoadFailed(false);
      const opponents = myGames
        .map((g) => (g.first_player === profile?.id ? g.second_player : g.first_player))
        .filter((id): id is string => !!id);
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

  async function go(where: 'create' | 'join' | 'list', request: Action) {
    setBusy(true);
    setMessage(null);
    try {
      const game = await ask(request);
      navigate(`/play/${game.id}`);
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
    void go('join', { action: 'join', code: tidy });
  }

  const playing = mine.filter((g) => g.status === 'playing');
  const waiting = mine.find((g) => g.status === 'waiting');
  const gameName = (id: string) => findGame(id)?.name ?? id;

  return (
    <div className="lobby">
      <h1 className="page-title">🤝 Play a friend</h1>

      {loadFailed && !open && <p className="chess-note">We couldn’t load the lobby. Check the Wi-Fi; we’ll keep trying.</p>}

      {(playing.length > 0 || waiting) && (
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
                  {GAMES.filter((g) => g.Live).map((g) => (
                    <label key={g.id} className="level-picker__option">
                      <input
                        type="radio"
                        name="friend-game"
                        value={g.id}
                        checked={gameKind === g.id}
                        onChange={() => setGameKind(g.id as GameKind)}
                      />
                      <span>{g.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
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
                onClick={() => void go('create', { action: 'create', game: gameKind, side, lobby: inLobby })}
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
                {open.map((g) => (
                  <li key={g.id}>
                    <AvatarImage avatar={g.creator_avatar} size={44} />
                    <span className="lobby-list__what">
                      <strong>
                        {g.creator_name} · {gameName(g.game)}
                      </strong>
                      <span>
                        You’d play {colourName(g.game, g.open_side)}
                        {g.open_side === 'first' ? ' and go first' : ''}. They play{' '}
                        {colourName(g.game, otherSide(g.open_side))}.
                      </span>
                    </span>
                    <button
                      type="button"
                      className="button button--primary"
                      disabled={busy}
                      onClick={() => void go('list', { action: 'join', gameId: g.id })}
                    >
                      Join
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
