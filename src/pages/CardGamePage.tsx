import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { prettyCode } from '../../shared/multiplayer';
import { AvatarImage } from '../avatar/AvatarImage';
import { useCardGame, type CardSession } from '../card101/useCardGame';

// The table and its cards load only when a game starts.
const Card101Live = lazy(() => import('../games/card101/Card101Live').then((m) => ({ default: m.Card101Live })));
const Card101Guide = lazy(() => import('../games/card101/Guide').then((m) => ({ default: m.Card101Guide })));

/** /card-game/<id>: a 101 game with classmates, from the waiting room to the podium. */
export function CardGamePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const loaded = useCardGame(id);

  // A rematch is a different game: go there. Leaving the waiting room: back to the lobby.
  const shown = loaded.state === 'ready' ? loaded.session.seat : null;
  useEffect(() => {
    if (!shown) return;
    if (shown.game !== id) navigate(`/card-game/${shown.game}`, { replace: true });
    else if (shown.seat < 0) navigate('/lobby', { replace: true });
  }, [shown, id, navigate]);

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
  const { status } = session.seat;
  if (status === 'waiting') return <Waiting session={session} />;
  if (status === 'cancelled') return <Gone emoji="👋" title="This game was cancelled" text="Start a new one, or join a friend’s game." />;
  if (status === 'expired') {
    return <Gone emoji="⌛" title="Nobody started in time" text="Games wait for 10 minutes. Start a new one and share the code." />;
  }
  return (
    <Suspense fallback={<p className="loading">Shuffling…</p>}>
      <Card101Live session={session} />
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

function Waiting({ session }: { session: CardSession }) {
  const { seat, me, cards, busy, act } = session;
  const { info } = seat;
  const navigate = useNavigate();
  const [help, setHelp] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const players = info.players.filter((p): p is string => p !== null);
  const isHost = info.host === me;
  const hostName = (info.host && cards.get(info.host)?.display_name) ?? 'The host';
  const left = Date.parse(info.expiresAt) - session.serverNow();
  if (left <= 0) {
    return <Gone emoji="⌛" title="Nobody started in time" text="Games wait for 10 minutes. Start a new one and share the code." />;
  }
  const minutes = Math.ceil(left / 60_000);
  const missing = info.wanted - players.length;

  return (
    <section className="friend-wait space-wait" aria-labelledby="wait-title">
      <div className="friend-wait__card">
        <div className="friend-wait__emoji friend-wait__emoji--bounce" aria-hidden="true">
          🃏
        </div>
        <h1 id="wait-title">{isHost ? 'Your card table' : `Waiting to start ${hostName}’s game…`}</h1>
        <p>
          101 · <strong>{info.wanted} players</strong> · {info.settings.target === 50 ? 'Quick game, to 50' : 'Normal game, to 101'}
        </p>
        {info.code && (
          <div className="friend-code">
            <span className="friend-code__label">Tell your classmates this code:</span>
            <span className="friend-code__value" aria-label={`Game code: ${[...info.code].join(' ')}`}>
              {prettyCode(info.code)}
            </span>
            <span className="friend-code__help">They go to “Play a friend” and type it in.</span>
          </div>
        )}
        {info.inLobby && <p className="friend-note">This game is in the lobby too, so anyone can tap to join.</p>}

        <ol className="space-wait__seats" aria-label="Who’s joined">
          {Array.from({ length: info.wanted }, (_, i) => {
            const id = players[i];
            const card = id ? cards.get(id) : undefined;
            return (
              <li key={i} className={id ? 'is-filled' : undefined}>
                {id ? (
                  <>
                    <AvatarImage avatar={card?.avatar} size={44} />
                    <span>
                      {card?.display_name ?? 'A classmate'}
                      {id === me && ' (you)'}
                      {id === info.host && ' · host'}
                    </span>
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

        <p className="friend-wait__time" role="status">
          The cards are dealt as soon as {missing === 1 ? 'one more player joins' : `${missing} more players join`}.
          {isHost && players.length >= 2 && ' Or start now with who’s here.'} The game waits {minutes} more minute
          {minutes === 1 ? '' : 's'}.
        </p>
        {isHost && (
          <button
            type="button"
            className="button button--play"
            disabled={busy || players.length < 2}
            onClick={() => void act({ action: 'start', gameId: seat.game })}
          >
            <span aria-hidden="true">🃏</span> Start now with {players.length}
          </button>
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
            void act({ action: isHost ? 'cancel' : 'leave', gameId: seat.game }).then((done) => {
              if (done && !isHost) navigate('/lobby');
            })
          }
        >
          {isHost ? 'Cancel this game' : 'Leave'}
        </button>
      </div>
      {help && (
        <Suspense fallback={null}>
          <Card101Guide live onClose={() => setHelp(false)} />
        </Suspense>
      )}
    </section>
  );
}
