import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { prettyCode } from '../../shared/multiplayer';
import type { PowerId } from '../../shared/power-clash/types';
import { AvatarImage } from '../avatar/AvatarImage';
import { PowerPicker } from '../games/power-clash/PowerPicker';
import { powerNames } from '../games/power-clash/text';
import { usePowerGame, type PowerSession } from '../power-clash/usePowerGame';

// The board and its animations load only when a game starts.
const PowerClashLive = lazy(() => import('../games/power-clash/PowerClashLive').then((m) => ({ default: m.PowerClashLive })));
const PowerClashGuide = lazy(() => import('../games/power-clash/Guide').then((m) => ({ default: m.PowerClashGuide })));

const DEFAULT_POWERS: PowerId[] = ['body-swap', 'freeze-ray', 'board-wipe'];

/** /power-game/<id>: a Power Clash game with a classmate, from the waiting room to the final score. */
export function PowerGamePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const loaded = usePowerGame(id);

  // A rematch is a different game: go there. Leaving the waiting room: back to the lobby.
  const shown = loaded.state === 'ready' ? loaded.session : null;
  useEffect(() => {
    if (!shown) return;
    if (shown.game.id !== id) navigate(`/power-game/${shown.game.id}`, { replace: true });
    else if (shown.mySeat < 0) navigate('/lobby', { replace: true });
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
  const { game } = session;
  if (game.id !== id || session.mySeat < 0) return <p className="loading">Finding your game…</p>;
  if (game.status === 'waiting') return <Waiting session={session} />;
  if (game.status === 'cancelled') return <Gone emoji="👋" title="This game was cancelled" text="Start a new one, or join a friend’s game." />;
  if (game.status === 'expired') {
    return <Gone emoji="⌛" title="Nobody started in time" text="Games wait for 10 minutes. Start a new one and share the code." />;
  }
  return (
    <Suspense fallback={<p className="loading">Setting up the board…</p>}>
      <PowerClashLive session={session} />
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

function Waiting({ session }: { session: PowerSession }) {
  const { game, me, mySeat, cards, busy, act } = session;
  const navigate = useNavigate();
  const [help, setHelp] = useState(false);
  const helpButton = useRef<HTMLButtonElement>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const mine = game.loadouts[mySeat];
  const [picked, setPicked] = useState<PowerId[]>(mine ?? DEFAULT_POWERS);
  const [changing, setChanging] = useState(false);
  const locked = !!mine && !changing;
  const otherSeat = mySeat === 0 ? 1 : 0;
  const otherId = otherSeat === 0 ? game.seat1 : game.seat2;
  const theirs = game.loadouts[otherSeat];
  const isHost = game.host === me;
  const hostName = (game.host && cards.get(game.host)?.display_name) ?? 'The host';
  const otherName = (otherId && cards.get(otherId)?.display_name) ?? 'your classmate';
  const left = Date.parse(game.expires_at) - session.serverNow();
  if (left <= 0) {
    return <Gone emoji="⌛" title="Nobody started in time" text="Games wait for 10 minutes. Start a new one and share the code." />;
  }
  const minutes = Math.ceil(left / 60_000);
  const players = [game.seat1, game.seat2];

  async function lockIn() {
    if (picked.length !== 3) return;
    if (await act({ action: 'set-powers', gameId: game.id, powers: picked })) setChanging(false);
  }

  return (
    <section className="friend-wait space-wait pcl__wait" aria-labelledby="wait-title">
      <div className="friend-wait__card">
        <div className="friend-wait__emoji friend-wait__emoji--bounce" aria-hidden="true">
          ⚡
        </div>
        <h1 id="wait-title">{isHost ? 'Your Power Clash' : `Power Clash with ${hostName}`}</h1>
        <p>
          Tic-Tac-Toe: Power Clash · <strong>first to 3 rounds</strong>
        </p>
        {game.code && !otherId && (
          <div className="friend-code">
            <span className="friend-code__label">Tell your classmate this code:</span>
            <span className="friend-code__value" aria-label={`Game code: ${[...game.code].join(' ')}`}>
              {prettyCode(game.code)}
            </span>
            <span className="friend-code__help">They go to “Play a friend” and type it in.</span>
          </div>
        )}
        {game.in_lobby && !otherId && <p className="friend-note">This game is in the lobby too, so anyone can tap to join.</p>}

        <ol className="space-wait__seats" aria-label="Who’s joined">
          {[0, 1].map((i) => {
            const id = players[i];
            const card = id ? cards.get(id) : undefined;
            const ready = !!game.loadouts[i];
            return (
              <li key={i} className={id ? 'is-filled' : undefined}>
                {id ? (
                  <>
                    <AvatarImage avatar={card?.avatar} size={44} />
                    <span>
                      {card?.display_name ?? 'A classmate'}
                      {id === me && ' (you)'}
                      {id === game.host && ' · host'}
                      <span className="pcl__ready">{ready ? ' · powers picked ✓' : ' · choosing powers…'}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="space-wait__empty" aria-hidden="true">
                      ·
                    </span>
                    <span className="space-wait__muted">Waiting for a classmate…</span>
                  </>
                )}
              </li>
            );
          })}
        </ol>

        {locked ? (
          <div className="pcl__locked" role="status">
            <p>
              <strong>Your powers:</strong> {powerNames(mine)}.
            </p>
            <p>{otherId ? (theirs ? 'Starting…' : `Waiting for ${otherName} to pick their powers…`) : 'Waiting for a classmate to join…'}</p>
            <button type="button" className="button button--light-outline" disabled={busy} onClick={() => setChanging(true)}>
              Change my powers
            </button>
          </div>
        ) : (
          <>
            <p className="pcl__lead">
              Pick <strong>3 different powers</strong>. Each can be used once a round. You’ll both see everyone’s powers when the
              match starts, and they can’t change after that.
            </p>
            <PowerPicker value={picked} onChange={setPicked} disabled={busy} title="Your powers" />
            <button type="button" className="button button--play" disabled={busy || picked.length !== 3} onClick={() => void lockIn()}>
              <span aria-hidden="true">⚡</span> {mine ? 'Lock in my new powers' : 'Lock in my powers'}
            </button>
          </>
        )}
        <p className="friend-wait__time" role="status">
          The match starts as soon as you’ve both picked. The game waits {minutes} more minute{minutes === 1 ? '' : 's'}.
        </p>
        {session.message && (
          <p className="chess-note" role="alert">
            {session.message}
          </p>
        )}
        <button type="button" className="button button--light-outline space-wait__help" ref={helpButton} onClick={() => setHelp(true)}>
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
          <PowerClashGuide onClose={() => setHelp(false)} returnTo={helpButton} />
        </Suspense>
      )}
    </section>
  );
}
