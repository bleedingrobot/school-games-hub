import { Suspense, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { colourName, prettyCode } from '../../shared/multiplayer';
import { findGame } from '../games/registry';
import { useFriendGame, type FriendSession } from '../multiplayer/useFriendGame';

/** /play/<game id>: a game against another student, from waiting for them to the result. */
export function FriendGamePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const loaded = useFriendGame(id);

  // Both said yes to a rematch: off to the new game.
  const rematch = loaded.state === 'ready' ? loaded.session.game.rematch_game : null;
  useEffect(() => {
    if (rematch) navigate(`/play/${rematch}`, { replace: true });
  }, [rematch, navigate]);

  if (loaded.state === 'loading') return <p className="loading">Finding your game…</p>;
  if (loaded.state !== 'ready') {
    return (
      <Gone
        emoji="🔍"
        title={loaded.state === 'missing' ? 'We couldn’t find that game' : 'We couldn’t load that game'}
        text={
          loaded.state === 'missing'
            ? 'It might not be one of yours. Head back to the lobby to start or join a game.'
            : 'Check the Wi-Fi, then try again.'
        }
      />
    );
  }

  const { session } = loaded;
  const { game } = session;
  if (game.status === 'waiting') return <Waiting session={session} />;
  if (game.status === 'cancelled') {
    return <Gone emoji="👋" title="This game was cancelled" text="Start a new one, or join a friend’s game." />;
  }
  if (game.status === 'expired') {
    return <Gone emoji="⌛" title="Nobody joined in time" text="Games wait for 10 minutes. Start a new one and share the code." />;
  }

  const Live = findGame(game.game)?.Live;
  if (!Live) return <Gone emoji="🎮" title="This game can’t be shown" text="Try again later." />;
  return (
    <Suspense fallback={<p className="loading">Setting up the board…</p>}>
      <Live session={session} />
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

function Waiting({ session }: { session: FriendSession }) {
  const { game, mySide, busy, act } = session;
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const left = Date.parse(game.expires_at) - session.serverNow();
  const name = findGame(game.game)?.name ?? 'the game';
  if (left <= 0) {
    return <Gone emoji="⌛" title="Nobody joined in time" text="Games wait for 10 minutes. Start a new one and share the code." />;
  }
  const minutes = Math.ceil(left / 60_000);

  return (
    <section className="friend-wait" aria-labelledby="wait-title">
      <div className="friend-wait__card">
        <div className="friend-wait__emoji friend-wait__emoji--bounce" aria-hidden="true">
          ⏳
        </div>
        <h1 id="wait-title">Waiting for a friend…</h1>
        <p>
          {name}. You’ll play <strong>{colourName(game.game, mySide)}</strong>.
        </p>
        {game.code && (
          <div className="friend-code">
            <span className="friend-code__label">Tell your friend this code:</span>
            <span className="friend-code__value" aria-label={`Game code: ${[...game.code].join(' ')}`}>
              {prettyCode(game.code)}
            </span>
            <span className="friend-code__help">They go to “Play a friend” and type it in.</span>
          </div>
        )}
        {game.in_lobby && <p className="friend-note">Your game is in the lobby too, so anyone can tap to join.</p>}
        <p className="friend-wait__time" role="status">
          The game starts as soon as someone joins. It waits {minutes} more minute{minutes === 1 ? '' : 's'}.
        </p>
        {session.message && (
          <p className="chess-note" role="alert">
            {session.message}
          </p>
        )}
        <button
          type="button"
          className="button button--light"
          disabled={busy}
          onClick={() => void act({ action: 'cancel', gameId: game.id })}
        >
          Cancel this game
        </button>
      </div>
    </section>
  );
}
