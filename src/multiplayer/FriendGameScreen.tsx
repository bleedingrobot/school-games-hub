import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { CLAIM_WIN_AFTER_MS, colourName, sideToMove } from '../../shared/multiplayer';
import { useAuth } from '../auth/AuthContext';
import { AvatarImage } from '../avatar/AvatarImage';
import { playSound, type GameSound } from '../games/sounds';
import { useSound } from '../sound';
import type { FriendSession } from './useFriendGame';

export interface MoveRow {
  number: number;
  first?: string;
  second?: string;
}

type Outcome = 'won' | 'lost' | 'drawn';

/** How a game ended, from this player's side. `{them}` becomes the opponent's name. */
export type EndingText = Record<string, Partial<Record<Outcome, string>>>;

const COMMON_ENDINGS: EndingText = {
  resigned: { won: '{them} resigned. Well played!', lost: 'You resigned. Good effort. Have another go!' },
  abandoned: {
    won: '{them} didn’t move for 2 minutes, so you win.',
    lost: 'You didn’t move for 2 minutes, so {them} claimed the win.',
  },
  'agreed-draw': { drawn: 'You both agreed to a draw.' },
};

/** Show the "waiting for them" timer once their turn has gone on this long. */
const SHOW_TIMER_AFTER_MS = 30_000;
/** Remind the student it's their move once their turn has gone on this long. */
const NUDGE_AFTER_MS = 60_000;

export interface FriendGameScreenProps {
  session: FriendSession;
  board: ReactNode;
  rows: MoveRow[];
  /** A warning for the player whose turn it is, e.g. "Check!" (or null). */
  alert: string | null;
  /** An extra tip under the status, e.g. the must-jump hint. */
  note?: ReactNode;
  endings: EndingText;
  /** The sound for the last move, so the opponent's moves can be heard. */
  lastMoveSound: GameSound | null;
  /** Captured pieces, drawn by the game: [the opponent's captures, mine]. */
  captured?: [ReactNode, ReactNode];
}

function clock(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Ticks once a second, so timers on the screen move. */
function useTick(on: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!on) return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [on]);
}

export function FriendGameScreen({ session, board, rows, alert, note, endings, lastMoveSound, captured }: FriendGameScreenProps) {
  const { profile } = useAuth();
  const { soundOn } = useSound();
  const { game, mySide, opponentSide, opponent, busy, act } = session;
  const [confirming, setConfirming] = useState(false);
  const [showResult, setShowResult] = useState(game.status === 'finished');
  const them = opponent?.display_name ?? 'Your opponent';

  const playing = game.status === 'playing';
  const finished = game.status === 'finished';
  const toMove = sideToMove(game.moves.length);
  const myTurn = playing && toMove === mySide;
  useTick(playing);

  // Sounds: the opponent's moves, and the end of the game.
  const seen = useRef({ moves: game.moves.length, status: game.status });
  useEffect(() => {
    const before = seen.current;
    seen.current = { moves: game.moves.length, status: game.status };
    if (!soundOn) return;
    if (game.status === 'finished' && before.status !== 'finished') {
      playSound(game.winner === mySide ? 'win' : 'end');
    } else if (game.moves.length > before.moves && sideToMove(game.moves.length - 1) !== mySide && lastMoveSound) {
      playSound(lastMoveSound);
    }
  }, [game.moves.length, game.status, game.winner, mySide, soundOn, lastMoveSound]);

  // The result pops up when the game ends.
  useEffect(() => {
    if (finished) setShowResult(true);
    setConfirming(false);
  }, [finished]);

  const waited = playing && game.turn_started_at ? session.serverNow() - Date.parse(game.turn_started_at) : 0;
  const canClaim = playing && !myTurn && waited >= CLAIM_WIN_AFTER_MS;

  const outcome: Outcome | null = !finished ? null : game.winner === null ? 'drawn' : game.winner === mySide ? 'won' : 'lost';
  const headline = outcome && {
    won: { emoji: '🏆', title: 'You won!' },
    lost: { emoji: '💪', title: `${them} won this time` },
    drawn: { emoji: '🤝', title: 'It’s a draw!' },
  }[outcome];
  const explanation =
    outcome && game.reason && (endings[game.reason] ?? COMMON_ENDINGS[game.reason])?.[outcome]?.replaceAll('{them}', them);

  let status: string;
  if (headline) status = headline.title;
  else if (myTurn) status = alert ?? 'Your turn';
  else status = `Waiting for ${them} to move…`;

  const iWantRematch = mySide === 'first' ? game.first_wants_rematch : game.second_wants_rematch;
  const theyWantRematch = mySide === 'first' ? game.second_wants_rematch : game.first_wants_rematch;
  const rematchButton = !opponent ? null : iWantRematch ? (
    <p className="friend-note" role="status">
      Waiting for {them} to say yes to a rematch…
    </p>
  ) : (
    <button
      type="button"
      className="button button--primary"
      disabled={busy}
      onClick={() => void act({ action: 'rematch', gameId: game.id })}
      autoFocus
    >
      {theyWantRematch ? `Yes, rematch ${them}!` : 'Rematch'}
    </button>
  );

  const offerFromThem = playing && game.draw_offer === opponentSide;
  const offerFromMe = playing && game.draw_offer === mySide;

  return (
    <div className="chess-game friend-game">
      <div className="chess-game__board">
        {board}

        {finished && showResult && headline && (
          <div className="chess-result" role="dialog" aria-modal="true" aria-labelledby="result-title">
            <div className={`chess-result__card chess-result__card--${outcome}`}>
              <div className="chess-result__emoji" aria-hidden="true">
                {headline.emoji}
              </div>
              <h2 id="result-title">{headline.title}</h2>
              {explanation && <p>{explanation}</p>}
              <p className="chess-result__save">✓ Saved to your games</p>
              {theyWantRematch && !iWantRematch && <p className="friend-note">{them} wants a rematch!</p>}
              <div className="chess-result__buttons">
                {rematchButton}
                <button type="button" className="button button--light" onClick={() => setShowResult(false)}>
                  Look at the board
                </button>
                <Link to="/lobby" className="link-button">
                  Back to the lobby
                </Link>
              </div>
              {session.message && (
                <p className="chess-result__save" role="alert">
                  {session.message}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <aside className="chess-game__side" aria-label="Game information">
        <PlayerCard
          avatar={opponent?.avatar}
          name={them}
          colour={colourName(game.game, opponentSide)}
          isTurn={playing && !myTurn}
          away={session.opponentAway}
          captured={captured?.[0]}
        />
        <PlayerCard
          avatar={profile?.avatar}
          name={profile?.display_name ?? 'You'}
          colour={`${colourName(game.game, mySide)} (you)`}
          isTurn={myTurn}
          captured={captured?.[1]}
        />

        <p className={`turn-status${myTurn && alert ? ' is-check' : ''}`} role="status" aria-live="polite">
          {status}
        </p>
        {myTurn && note}

        {session.live === 'down' && playing && (
          <p className="friend-note">📡 Live updates have dropped. We’ll keep checking for moves every few seconds.</p>
        )}
        {session.opponentAway && !canClaim && (
          <p className="friend-note">
            😴 {them} seems to be away. If they don’t move within 2 minutes of their turn starting, you can claim the
            win.
          </p>
        )}
        {playing && !myTurn && waited >= SHOW_TIMER_AFTER_MS && !canClaim && (
          <p className="friend-note friend-note--timer">
            ⏱ {them} has been thinking for {clock(waited)}. You can claim the win at 2:00.
          </p>
        )}
        {myTurn && waited >= NUDGE_AFTER_MS && (
          <p className="friend-note friend-note--timer" role="alert">
            ⏱ Your move! After 2:00, {them} can claim the win. ({clock(waited)} so far)
          </p>
        )}
        {canClaim && (
          <div className="friend-offer" role="group" aria-label="Claim the win">
            <p>
              {them} hasn’t moved for {clock(waited)}. You can claim the win, or keep waiting.
            </p>
            <button
              type="button"
              className="button button--primary"
              disabled={busy}
              onClick={() => void act({ action: 'claim-win', gameId: game.id })}
            >
              🏆 Claim the win
            </button>
          </div>
        )}

        {offerFromThem && (
          <div className="friend-offer" role="group" aria-label="Draw offer">
            <p>🤝 {them} offers a draw. Do you agree?</p>
            <div className="chess-actions">
              <button
                type="button"
                className="button button--primary"
                disabled={busy}
                onClick={() => void act({ action: 'answer-draw', gameId: game.id, accept: true })}
              >
                Yes, draw
              </button>
              <button
                type="button"
                className="button button--light"
                disabled={busy}
                onClick={() => void act({ action: 'answer-draw', gameId: game.id, accept: false })}
              >
                No, keep playing
              </button>
            </div>
          </div>
        )}
        {offerFromMe && <p className="friend-note">You offered a draw. Waiting for {them} to answer…</p>}

        {session.message && !(finished && showResult) && (
          <p className="chess-note" role="alert">
            {session.message}
          </p>
        )}

        {finished ? (
          <div className="chess-actions">
            {!showResult && (
              <button type="button" className="button button--primary" onClick={() => setShowResult(true)}>
                Show result
              </button>
            )}
            <Link to="/lobby" className="button button--light">
              Lobby
            </Link>
          </div>
        ) : confirming ? (
          <div className="chess-confirm" role="group" aria-label="Are you sure?">
            <p>Give up this game? It will count as a loss.</p>
            <div className="chess-actions">
              <button
                type="button"
                className="button button--danger"
                disabled={busy}
                onClick={() => void act({ action: 'resign', gameId: game.id })}
              >
                Yes, resign
              </button>
              <button type="button" className="button button--light" onClick={() => setConfirming(false)} autoFocus>
                Keep playing
              </button>
            </div>
          </div>
        ) : (
          <div className="chess-actions">
            <button
              type="button"
              className="button button--light"
              disabled={busy || !!game.draw_offer}
              onClick={() => void act({ action: 'offer-draw', gameId: game.id })}
            >
              🤝 Offer a draw
            </button>
            <button type="button" className="button button--light" onClick={() => setConfirming(true)}>
              🏳️ Resign
            </button>
          </div>
        )}

        <section className="move-list" aria-labelledby="moves-title">
          <h2 id="moves-title">Moves</h2>
          {rows.length === 0 ? (
            <p className="move-list__empty">
              {mySide === 'first'
                ? `You go first. ${colourName(game.game, 'first')} always starts!`
                : `${them} goes first. ${colourName(game.game, 'first')} always starts!`}
            </p>
          ) : (
            <ol>
              {rows.map((row) => (
                <li key={row.number}>
                  <span className="move-list__number">{row.number}.</span>
                  <span>{row.first}</span>
                  <span>{row.second ?? ''}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </aside>
    </div>
  );
}

function PlayerCard(props: {
  avatar: unknown;
  name: string;
  colour: string;
  isTurn: boolean;
  away?: boolean;
  captured?: ReactNode;
}) {
  return (
    <div className={`player-card${props.isTurn ? ' is-turn' : ''}`}>
      <AvatarImage avatar={props.avatar} size={48} />
      <div>
        <strong>{props.name}</strong>
        <span className="player-card__colour">
          {props.colour}
          {props.away && <span className="away-badge"> · away</span>}
        </span>
      </div>
      {props.captured}
    </div>
  );
}
