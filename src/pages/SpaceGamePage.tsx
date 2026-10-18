import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { prettyCode } from '../../shared/multiplayer';
import { boardLabel, MAX_ROCKETS, MIN_ROCKETS } from '../../shared/space/names';
import { AvatarImage } from '../avatar/AvatarImage';
import { seatsOf } from '../data/spaceGames';
import { useSpaceGame, type SpaceSession } from '../space/useSpaceGame';

// The board and its animations load only when a game starts.
const SpaceLive = lazy(() => import('../games/space/SpaceLive').then((m) => ({ default: m.SpaceLive })));
const SpaceGuide = lazy(() => import('../games/space/Guide').then((m) => ({ default: m.SpaceGuide })));

/** /space-game/<id>: a Wormholes & Black Holes game with classmates, from the waiting room to the podium. */
export function SpaceGamePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const loaded = useSpaceGame(id);

  // A rematch (or any other game the server hands back) is a different game: go there.
  const shownId = loaded.state === 'ready' ? loaded.session.game.id : null;
  useEffect(() => {
    if (shownId && shownId !== id) navigate(`/space-game/${shownId}`, { replace: true });
  }, [shownId, id, navigate]);

  if (loaded.state === 'loading') return <p className="loading">Finding your game…</p>;
  if (loaded.state !== 'ready') {
    return (
      <Gone
        emoji="🔍"
        title={loaded.state === 'missing' ? 'We couldn’t find that game' : 'We couldn’t load that game'}
        text={
          loaded.state === 'missing'
            ? 'It might not be one of yours, or you left it. Head back to the lobby to start or join a game.'
            : 'Check the Wi-Fi, then try again.'
        }
      />
    );
  }
  const { session } = loaded;
  const { game } = session;
  if (game.status === 'waiting') return <Waiting session={session} />;
  if (game.status === 'cancelled') return <Gone emoji="👋" title="This game was cancelled" text="Start a new one, or join a friend’s game." />;
  if (game.status === 'expired') {
    return <Gone emoji="⌛" title="Nobody launched in time" text="Games wait for 10 minutes. Start a new one and share the code." />;
  }
  return (
    <Suspense fallback={<p className="loading">Setting up the board…</p>}>
      <SpaceLive session={session} />
    </Suspense>
  );
}

function Gone({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <section className="friend-wait" aria-labelledby="gone-title">
      <div className="friend-wait__card">
        <div className="friend-wait__emoji" aria-hidden="true">
          {emoji}
        </div>
        <h1 id="gone-title">{title}</h1>
        <p>{text}</p>
        <Link to="/lobby" className="button button--primary">
          Go to the lobby
        </Link>
      </div>
    </section>
  );
}

function Waiting({ session }: { session: SpaceSession }) {
  const { game, me, cards, busy, act } = session;
  const navigate = useNavigate();
  const [bots, setBots] = useState(0);
  const [help, setHelp] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const players = seatsOf(game).filter((p): p is string => p !== null);
  const isHost = game.host === me;
  const hostName = (game.host && cards.get(game.host)?.display_name) ?? 'The host';
  const room = MAX_ROCKETS - players.length;
  const botsWanted = Math.min(bots, room);
  const left = Date.parse(game.expires_at) - session.serverNow();
  if (left <= 0) {
    return <Gone emoji="⌛" title="Nobody launched in time" text="Games wait for 10 minutes. Start a new one and share the code." />;
  }
  const minutes = Math.ceil(left / 60_000);
  const { settings } = game.setup;

  return (
    <section className="friend-wait space-wait" aria-labelledby="wait-title">
      <div className="friend-wait__card">
        <div className="friend-wait__emoji friend-wait__emoji--bounce" aria-hidden="true">
          🚀
        </div>
        <h1 id="wait-title">{isHost ? 'Your rocket crew' : `Waiting for ${hostName} to launch…`}</h1>
        <p>
          Wormholes &amp; Black Holes · <strong>{boardLabel(game.setup.board)}</strong> ·{' '}
          {settings.mode === 'cosmic' ? '✨ Cosmic' : 'Classic'}
        </p>
        {settings.maths && (
          <p className="friend-note">
            <span aria-hidden="true">🧮</span> Mission Control maths: <strong>on</strong>. There are maths questions in this game.
          </p>
        )}
        {game.code && (
          <div className="friend-code">
            <span className="friend-code__label">Tell your classmates this code:</span>
            <span className="friend-code__value" aria-label={`Game code: ${[...game.code].join(' ')}`}>
              {prettyCode(game.code)}
            </span>
            <span className="friend-code__help">They go to “Play a friend” and type it in. Up to 4 can play.</span>
          </div>
        )}
        {game.in_lobby && <p className="friend-note">This game is in the lobby too, so anyone can tap to join.</p>}

        <ol className="space-wait__seats" aria-label="Who’s joined">
          {Array.from({ length: MAX_ROCKETS }, (_, i) => {
            const id = players[i];
            const card = id ? cards.get(id) : undefined;
            const isBot = !id && i - players.length < botsWanted;
            return (
              <li key={i} className={id ? 'is-filled' : isBot ? 'is-bot' : undefined}>
                {id ? (
                  <>
                    <AvatarImage avatar={card?.avatar} size={44} />
                    <span>
                      {card?.display_name ?? 'A classmate'}
                      {id === me && ' (you)'}
                      {id === game.host && ' · host'}
                    </span>
                  </>
                ) : isBot ? (
                  <>
                    <span className="space-wait__empty" aria-hidden="true">
                      🤖
                    </span>
                    <span>A Pilot bot</span>
                  </>
                ) : (
                  <>
                    <span className="space-wait__empty" aria-hidden="true">
                      ·
                    </span>
                    <span className="space-wait__muted">Empty seat</span>
                  </>
                )}
              </li>
            );
          })}
        </ol>

        {isHost ? (
          <>
            {room > 0 && (
              <fieldset className="choice-group space-wait__bots">
                <legend>Fill empty seats with bots?</legend>
                <div className="choice-group__chips">
                  {Array.from({ length: room + 1 }, (_, n) => (
                    <label key={n} className="chip">
                      <input type="radio" name="space-bots" checked={botsWanted === n} onChange={() => setBots(n)} />
                      <span>{n === 0 ? 'No bots' : `${n} bot${n === 1 ? '' : 's'}`}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <button
              type="button"
              className="button button--play"
              disabled={busy || players.length < MIN_ROCKETS}
              onClick={() => void act({ action: 'launch', gameId: game.id, bots: botsWanted })}
            >
              <span aria-hidden="true">🚀</span> Launch!
            </button>
            <p className="friend-wait__time" role="status">
              {players.length < MIN_ROCKETS
                ? 'You need at least one classmate to launch.'
                : `${players.length} students ready. Launch when everyone’s in!`}{' '}
              The game waits {minutes} more minute{minutes === 1 ? '' : 's'}.
            </p>
          </>
        ) : (
          <p className="friend-wait__time" role="status">
            {hostName} launches when everyone’s in. The game waits {minutes} more minute{minutes === 1 ? '' : 's'}.
          </p>
        )}
        {session.message && (
          <p className="chess-note" role="alert">
            {session.message}
          </p>
        )}
        <button type="button" className="button button--light-outline space-wait__help" onClick={() => setHelp(true)}>
          <span aria-hidden="true">📖</span> How to play
        </button>
        <button
          type="button"
          className="button button--light"
          disabled={busy}
          onClick={() =>
            void act({ action: isHost ? 'cancel' : 'leave', gameId: game.id }).then((done) => {
              if (done && !isHost) navigate('/lobby');
            })
          }
        >
          {isHost ? 'Cancel this game' : 'Leave'}
        </button>
      </div>
      {help && (
        <Suspense fallback={null}>
          <SpaceGuide tab="how" onClose={() => setHelp(false)} />
        </Suspense>
      )}
    </section>
  );
}
