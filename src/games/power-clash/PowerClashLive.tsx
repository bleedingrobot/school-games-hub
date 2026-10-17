import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { legalSkip, placeableSquares, powerBlockedReason, targetChoices } from '../../../shared/power-clash/engine';
import { GRACE_MS, matchIsOver, roundIsOver, seatOf, sideOf } from '../../../shared/power-clash/live';
import { ROUNDS_TO_WIN } from '../../../shared/power-clash/match';
import type { GameEvent, Player, PowerClashState, PowerId } from '../../../shared/power-clash/types';
import { AvatarImage } from '../../avatar/AvatarImage';
import type { PowerSession } from '../../power-clash/usePowerGame';
import { useSound } from '../../sound';
import { playSound } from '../sounds';
import { PowerClashGuide } from './Guide';
import {
  cellFx, cellLabel, describe, LOCK_CALM_MS, LOCK_MS, particles, PowerPanel, SOUNDS, swapVars, useReducedMotion, type Fx,
} from './PowerClashPlay';
import { TEXT, powerInfo, shout, type ShoutKind } from './text';
import './power-clash.css';

/** The spoken warning comes when this many seconds are left on your turn. */
export const WARN_AT_SECONDS = 10;
/** The opponent counts as away once they have been missing from the game for this long. */
const AWAY_AFTER_MS = 8_000;
/** How often a page asks the server to end a turn that has run out (the server checks its own clock). */
const TIMES_UP_EVERY_MS = 3_000;

/**
 * Power Clash with a classmate. All the rules come from the server (and from shared/power-clash,
 * which both use): this page only sends what the student chooses and draws what the server's
 * new state and `events` say. Nothing is played here that the server hasn't confirmed.
 *
 * While it is the other player's turn, or an animation is playing, or a request is on its way,
 * nothing can be pressed. The clock shown is the server's.
 */
export function PowerClashLive({ session, tick = 1000 }: { session: PowerSession; /** Tests speed the clock up. */ tick?: number }) {
  const { game: row, me, cards, busy, act, live, present, serverNow } = session;
  const lg = row.game!;
  const { match } = lg;
  const { state } = match;
  const mySeat = session.mySeat;
  const mySide: Player = sideOf(mySeat);
  const foeSide: Player = mySide === 'X' ? 'O' : 'X';
  const foeId = (mySeat === 0 ? row.seat2 : row.seat1) ?? null;
  const nameOfSeat = (seat: number) => {
    const id = seat === 0 ? row.seat1 : row.seat2;
    return id === me ? 'You' : ((id && cards.get(id)?.display_name) || 'Your classmate');
  };
  const nameOf = (side: Player) => nameOfSeat(seatOf(side));
  const foeName = nameOf(foeSide);
  const avatarOf = (side: Player) => {
    const id = seatOf(side) === 0 ? row.seat1 : row.seat2;
    return id ? cards.get(id)?.avatar : undefined;
  };

  const finished = row.status === 'finished';
  const abandoned = finished && row.ending === 'abandoned';
  const roundOver = roundIsOver(lg);
  const matchOver = matchIsOver(lg);
  const myTurn = !finished && !roundOver && state.active === mySide;

  const [selected, setSelected] = useState<{ power: PowerId; picked: number[] } | null>(null);
  const [message, setMessage] = useState('');
  const [fx, setFx] = useState<Fx | null>(null);
  const [shoutText, setShoutText] = useState('');
  const [animating, setAnimating] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [now, setNow] = useState(() => serverNow());
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  const [foeAway, setFoeAway] = useState(false);
  const [warning, setWarning] = useState('');
  const helpButton = useRef<HTMLButtonElement>(null);
  const plays = useRef(0);
  const timers = useRef<number[]>([]);
  const shown = useRef<{ id: string; version: number; round: number; state: PowerClashState } | null>(null);
  const warned = useRef<string | null>(null);
  const tapRef = useRef<(square: number) => void>(() => {});
  const lastTimesUp = useRef(0);
  const { soundOn } = useSound();
  const calm = useReducedMotion();
  const settings = useRef({ soundOn, calm });
  settings.current = { soundOn, calm };

  // The clock on the screen: it only ever shows the server's deadline.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(serverNow()), tick);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  /** Shows what just happened: the message, animations, shouts and sound. The server has already decided it. */
  function showEvents(prev: PowerClashState, events: GameEvent[], matchNow: typeof match, mine: boolean) {
    setSelected(null);
    const kinds = events.map((e) => e.kind);
    const timedOut = kinds.includes('skip') && !legalSkip(prev);
    const who = mine ? 'You' : foeName;
    setMessage(
      timedOut
        ? mine
          ? 'Time ran out, so you missed your go.'
          : `Time ran out, so ${foeName} missed their go.`
        : mine
          ? describe(kinds)
          : describe(kinds) && `${who}: ${describe(kinds)}`,
    );
    const wipe = events.find((e) => e.kind === 'wipe');
    plays.current += 1;
    setFx({ key: plays.current, events, wiped: wipe ? prev.board[wipe.square] : null });

    let big: ShoutKind | null;
    if (matchNow.winner) big = 'match';
    else if (kinds.includes('win')) big = 'win';
    else if (kinds.includes('draw')) big = 'draw';
    else {
      big =
        (['body-swap', 'freeze-ray', 'board-wipe', 'double-trouble'] as const).find((p) =>
          kinds.includes(p === 'freeze-ray' ? 'freeze' : p === 'board-wipe' ? 'wipe' : p),
        ) ?? (kinds.includes('skip') ? 'skip' : null);
    }
    setShoutText(big ? shout(big, plays.current) : '');

    if (settings.current.soundOn) {
      const order: GameEvent['kind'][] = ['win', 'draw', 'wipe', 'freeze', 'body-swap', 'double-trouble', 'skip', 'place'];
      const first = order.find((k) => kinds.includes(k));
      if (first) playSound(SOUNDS[first]!);
    }

    setAnimating(true);
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [
      window.setTimeout(() => setAnimating(false), settings.current.calm ? LOCK_CALM_MS : LOCK_MS),
      window.setTimeout(() => setShoutText(''), 1800),
    ];
  }

  // Every new version from the server: animate what happened (mine or theirs). The first look at a game animates nothing.
  useEffect(() => {
    const prev = shown.current;
    shown.current = { id: row.id, version: row.version, round: match.round, state };
    if (!prev || prev.id !== row.id || row.version <= prev.version) return;
    if (match.round !== prev.round) {
      setSelected(null);
      setMessage('');
      setFx(null);
      setShoutText('');
      return;
    }
    if (row.events.length === 0) return;
    const mover = row.events.find((e): e is Extract<GameEvent, { player: Player }> => 'player' in e);
    showEvents(prev.state, row.events, match, mover?.player === mySide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id, row.version]);

  // The spoken warning, once per turn, for the player whose turn it is.
  const deadlineMs = row.deadline ? Date.parse(row.deadline) : null;
  const secondsLeft = deadlineMs === null ? null : Math.max(0, Math.ceil((deadlineMs - now) / 1000));
  useEffect(() => {
    if (!row.deadline || finished) {
      setWarning('');
      return;
    }
    const key = `${row.id}:${row.deadline}`;
    if (warned.current !== key && myTurn && secondsLeft !== null && secondsLeft > 0 && secondsLeft <= WARN_AT_SECONDS) {
      warned.current = key;
      setWarning(`${secondsLeft} seconds left on your turn.`);
    }
    if (warned.current !== key) setWarning('');
  }, [row.id, row.deadline, finished, myTurn, secondsLeft]);

  // The clock ran out: ask the server to move on. It checks its own clock, so asking early does nothing.
  useEffect(() => {
    if (finished || deadlineMs === null || busy) return;
    if (serverNow() < deadlineMs + GRACE_MS + 250) return;
    if (Date.now() - lastTimesUp.current < TIMES_UP_EVERY_MS) return;
    lastTimesUp.current = Date.now();
    void act({ action: 'times-up', gameId: row.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, finished, deadlineMs, busy, row.id]);

  // Is the other player here? Missing for a few seconds counts as away.
  useEffect(() => {
    const missing = present !== null && foeId !== null && !present.includes(foeId);
    if (!missing || finished) {
      setFoeAway(false);
      return;
    }
    const timer = window.setTimeout(() => setFoeAway(true), AWAY_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [present, foeId, finished]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
      if (e.key === '?') setHelpOpen(true);
      // Keyboard play: 1 to 9 are the squares, left to right, top to bottom.
      if (/^[1-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
        tapRef.current(Number(e.key) - 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const locked = busy || animating || !myTurn;
  const frozenNow = new Set(state.frozen.map((f) => f.square));
  const choices = selected ? targetChoices(state, selected.power, selected.picked) : placeableSquares(state);

  function send(request: Parameters<typeof act>[0]) {
    void act(request);
  }

  function choosePower(power: PowerId) {
    if (locked) return;
    if (selected?.power === power) {
      setSelected(null);
      return;
    }
    const reason = powerBlockedReason(state, power);
    if (reason) {
      setMessage(reason);
      return;
    }
    if (powerInfo(power).steps.length === 0) {
      send({ action: 'use-power', gameId: row.id, version: row.version, power, targets: [] });
      return;
    }
    setMessage('');
    setSelected({ power, picked: [] });
  }

  function tapSquare(square: number) {
    if (locked || !choices.includes(square)) return;
    if (!selected) {
      send({ action: 'place', gameId: row.id, version: row.version, square });
      return;
    }
    const picked = [...selected.picked, square];
    if (picked.length === powerInfo(selected.power).steps.length) {
      send({ action: 'use-power', gameId: row.id, version: row.version, power: selected.power, targets: picked });
    } else {
      setSelected({ ...selected, picked });
    }
  }
  tapRef.current = tapSquare;

  // ---- What the status line says ----
  const leaverName = row.leaver ? (row.leaver === me ? 'You' : foeName) : null;
  let prompt: string;
  if (abandoned) {
    prompt = row.leaver === me ? 'You left the game.' : row.leaver ? `${foeName} left the game.` : 'This game ended because nobody played for a while.';
  } else if (matchOver) {
    prompt = match.winner === mySide ? 'You win the match!' : `${nameOf(match.winner as Player)} wins the match.`;
  } else if (state.status === 'draw') {
    prompt = 'A draw! Nobody wins this round.';
  } else if (roundOver) {
    prompt = state.status === mySide ? 'You win the round!' : `${nameOf(state.status as Player)} wins the round.`;
  } else if (!myTurn) {
    prompt = `Waiting for ${foeName}…`;
  } else if (selected) {
    prompt = powerInfo(selected.power).steps[selected.picked.length];
  } else if (legalSkip(state)) {
    prompt = 'Every square is frozen, so you miss your go.';
  } else if (state.placesLeft === 2) {
    prompt = 'Your go: place your first symbol (then one more!)';
  } else if (state.powerThisTurn) {
    prompt = 'Your go: now place your symbol';
  } else {
    prompt = 'Your go: pick a power or a square';
  }

  const iPressedNext = lg.ready[mySeat];
  const boardKinds = fx?.events.map((e) => e.kind) ?? [];
  const boardFx = [
    boardKinds.includes('double-trouble') ? 'pc__board--zap' : '',
    boardKinds.includes('wipe') || boardKinds.includes('win') ? 'pc__board--shake' : '',
    boardKinds.includes('win') ? 'pc__board--win' : '',
    boardKinds.includes('draw') ? 'pc__board--draw' : '',
  ].join(' ');
  const connection = !online || live === 'down';
  const rematchWaiting = finished && row.rematch_game !== null;

  const help = helpOpen ? <PowerClashGuide onClose={() => setHelpOpen(false)} returnTo={helpButton} /> : null;
  const clock =
    secondsLeft === null || finished ? null : (
      <span className={`pcl__clock ${secondsLeft <= WARN_AT_SECONDS ? 'pcl__clock--low' : ''}`} aria-hidden="true">
        ⏱ {secondsLeft}
      </span>
    );

  return (
    <section className={`pc pcl ${calm ? 'pc--calm' : ''}`} aria-label={`${TEXT.name} with ${foeName}`}>
      <header className="pc__top">
        <h1>{TEXT.name}</h1>
        <button type="button" className="button button--light pc__help" ref={helpButton} onClick={() => setHelpOpen(true)}>
          How to play <kbd>?</kbd>
        </button>
        <p className="pc__score" aria-label="Score">
          <span className="pc__x pcl__who">
            <AvatarImage avatar={avatarOf('X')} size={28} /> {nameOf('X')} X {match.score.X}
          </span>
          <span className="pc__round">
            Round {match.round} · first to {ROUNDS_TO_WIN}
            {clock && <> · {clock}</>}
          </span>
          <span className="pc__o pcl__who">
            {nameOf('O')} O {match.score.O} <AvatarImage avatar={avatarOf('O')} size={28} />
          </span>
        </p>
      </header>

      {connection && (
        <p className="pcl__banner" role="status">
          We lost the connection. Your game is safe: we keep trying to get back in.
        </p>
      )}
      {foeAway && !connection && !finished && (
        <p className="pcl__banner pcl__banner--soft" role="status">
          {foeName} isn’t here right now. The game waits, but turns still have a 60-second clock.
        </p>
      )}

      <div className="pc__table">
        <PowerPanel
          player="X"
          match={match}
          selected={selected}
          onChoose={choosePower}
          locked={locked}
          name={nameOf('X')}
          readOnly={mySide !== 'X'}
          turnLabel={mySide === 'X' ? undefined : '← their go'}
        />
        <section className="pc__middle">
          <p className="pc__prompt" role="status" aria-live="polite" aria-atomic="true">{prompt}</p>
          <p className="pc__shout" aria-hidden="true" key={fx?.key}>{shoutText}</p>
          <div className={`pc__board ${boardFx}`} role="group" aria-label="Board" aria-busy={locked}>
            {state.board.map((cell, i) => {
              const enabled = !finished && !roundOver && !locked && choices.includes(i);
              const winning = state.line?.includes(i);
              const frozen = frozenNow.has(i) && cell === null;
              const chosen = selected?.picked.includes(i);
              return (
                <button
                  type="button"
                  className={[
                    'pc__cell',
                    cell ? `pc__cell--${cell}` : '',
                    enabled ? 'pc__cell--open' : '',
                    enabled && selected ? 'pc__cell--target' : '',
                    winning ? 'pc__cell--win' : '',
                    frozen ? 'pc__cell--frozen' : '',
                    chosen ? 'pc__cell--chosen' : '',
                    cellFx(fx, i),
                  ].join(' ')}
                  key={`${i}-${fx?.key ?? 0}`}
                  style={swapVars(fx, i)}
                  disabled={!enabled}
                  aria-label={`${cellLabel(i, cell, frozen)} (key ${i + 1})`}
                  onClick={() => tapSquare(i)}
                >
                  {cell ?? ''}
                  {frozen ? <span className="pc__ice" aria-hidden="true">❄️</span> : null}
                  {fx?.wiped && boardKinds.includes('wipe') && fx.events.some((e) => e.kind === 'wipe' && e.square === i) ? (
                    <span className={`pc__fly pc__fly--${fx.wiped}`} aria-hidden="true">{fx.wiped}</span>
                  ) : null}
                  {!calm ? particles(fx, i) : null}
                </button>
              );
            })}
          </div>
          <p className="pc__message" role="status" aria-live="polite">{message || session.message}</p>
          <p className="pcl__sr" role="status" aria-live="assertive">{warning}</p>
          <div className="pc__actions">
            {selected ? (
              <button type="button" className="button button--light" onClick={() => setSelected(null)}>
                Cancel power
              </button>
            ) : null}
            {myTurn && legalSkip(state) ? (
              <button
                type="button"
                className="button button--primary"
                disabled={locked}
                onClick={() => send({ action: 'skip', gameId: row.id, version: row.version })}
              >
                Miss my go
              </button>
            ) : null}
            {!finished && roundOver && !matchOver ? (
              <button
                type="button"
                className="button button--play"
                disabled={busy || iPressedNext}
                onClick={() => send({ action: 'next', gameId: row.id, round: match.round })}
              >
                {iPressedNext ? `Waiting for ${foeName}…` : 'Next round'}
              </button>
            ) : null}
            {finished ? (
              <>
                <button type="button" className="button button--play" disabled={busy} onClick={() => send({ action: 'rematch', gameId: row.id })}>
                  {rematchWaiting ? 'Join the rematch' : 'Rematch'}
                </button>
                <Link to="/lobby" className="button button--light">
                  Back to the lobby
                </Link>
              </>
            ) : null}
          </div>
          {finished && rematchWaiting && <p className="pcl__note" role="status">{foeName} wants a rematch!</p>}
          {finished && (
            <p className="pcl__note">
              {abandoned
                ? `A game that ends early doesn’t earn points${leaverName === 'You' ? '' : ' for anyone'}.`
                : 'Finished games with a classmate earn points (your first few each day). Look at Recent games on your dashboard.'}
            </p>
          )}
        </section>
        <div className="pc__col">
          <PowerPanel
            player="O"
            match={match}
            selected={selected}
            onChoose={choosePower}
            locked={locked}
            name={nameOf('O')}
            readOnly={mySide !== 'O'}
            turnLabel={mySide === 'O' ? undefined : '← their go'}
          />
          {!finished && (
            <div className="pc__extras">
              {leaving ? (
                <div className="pcl__confirm" role="group" aria-label="Leave the game?">
                  <p>Leave? {foeName} will be told, and nobody earns points for this game.</p>
                  <button
                    type="button"
                    className="button button--primary"
                    disabled={busy}
                    onClick={() => {
                      send({ action: 'leave', gameId: row.id });
                      setLeaving(false);
                    }}
                  >
                    Yes, leave
                  </button>
                  <button type="button" className="button button--light" onClick={() => setLeaving(false)}>
                    Keep playing
                  </button>
                </div>
              ) : (
                <button type="button" className="button button--light pc__leave" onClick={() => setLeaving(true)}>
                  Leave game
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {help}
    </section>
  );
}
