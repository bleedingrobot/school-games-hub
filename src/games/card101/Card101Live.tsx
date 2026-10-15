/**
 * 101 with classmates: the table for one player, kept up to date from their own seat row.
 *
 * Everything here comes from the seat row (useCardGame): the public info and this player's
 * own view of the cards. The server referees every move; this page only asks. When a clock
 * runs out (the peek, a turn, the pause between rounds), any player's page asks the server
 * "time's up?" and the server checks its own clock.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { GRACE_MS } from '../../../shared/card101/live';
import { swappableSlots, type GameEvent } from '../../../shared/card101/engine';
import type { Slot } from '../../../shared/card101/cards';
import type { CardSession } from '../../card101/useCardGame';
import { useSound } from '../../sound';
import { playSound, type GameSound } from '../sounds';
import { LogPanel, placesFrom, Podium, ScoresPanel, ValuesPanel } from './parts';
import { Scoring } from './Scoring';
import { Table, type Flash, type Seat } from './Table';
import { eventLine, ORDINAL } from './text';
import './card101.css';

/** The last few seconds of a turn show a countdown. */
const SHOW_CLOCK_MS = 10_000;
/** How often to ask again if the server says there's still time (clocks differ a little). */
const TIMES_UP_RETRY_MS = 3_000;

const EVENT_SOUND: Partial<Record<GameEvent['kind'], GameSound>> = {
  draw: 'flick',
  swap: 'tap',
  throw: 'tap',
  knock: 'knock',
  deal: 'flick',
};

export function Card101Live({ session }: { session: CardSession }) {
  const { seat: row, cards, busy, act } = session;
  const navigate = useNavigate();
  const { soundOn } = useSound();
  const { info, view } = row;
  const id = row.game;
  const mySeat = row.seat;

  const [flash, setFlash] = useState<Flash | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [scoringRound, setScoringRound] = useState<number | null>(null);
  const [showPodium, setShowPodium] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [now, setNow] = useState(() => session.serverNow());
  const flashN = useRef(0);
  const seenVersion = useRef(row.version);

  const seats: Seat[] = info.players.map((player, i) => {
    const card = player ? cards.get(player) : undefined;
    return { name: card?.display_name ?? (player ? 'A classmate' : 'A deleted player'), avatar: card?.avatar, isStudent: i === mySeat };
  });
  const names = seats.map((s) => s.name);

  // Something happened: flash a swapped card, show the knock banner, play sounds, open the scores.
  useEffect(() => {
    if (row.version <= seenVersion.current) return;
    seenVersion.current = row.version;
    for (const event of row.events) {
      const sound = EVENT_SOUND[event.kind];
      if (sound && soundOn) playSound(sound);
      if (event.kind === 'swap') setFlash({ seat: event.seat, slot: event.slot, n: ++flashN.current });
      if (event.kind === 'deal') {
        setFlash(null);
        setScoringRound(null);
      }
      if (event.kind === 'knock') {
        setBanner(event.seat === mySeat ? 'You knocked! Last turn for everyone else.' : `${names[event.seat]} knocked! Last turn!`);
      }
      if (event.kind === 'round-end') setScoringRound(event.result.round);
      if (event.kind === 'game-over') setShowPodium(true);
    }
  }, [row.version, row.events, soundOn, mySeat, names]);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 2600);
    return () => clearTimeout(timer);
  }, [banner]);

  // The clock: tick every half second, and ask the server once time's up.
  useEffect(() => {
    const timer = setInterval(() => setNow(session.serverNow()), 500);
    return () => clearInterval(timer);
  }, [session]);
  const deadline = info.deadline ? Date.parse(info.deadline) : null;
  const timeLeft = deadline === null ? null : deadline - now;
  const askedAt = useRef<{ version: number; at: number } | null>(null);
  const actRef = useRef(act);
  actRef.current = act;
  useEffect(() => {
    if (row.status !== 'playing' || deadline === null || now < deadline + GRACE_MS) return;
    const asked = askedAt.current;
    if (asked && asked.version === row.version && now - asked.at < TIMES_UP_RETRY_MS) return;
    askedAt.current = { version: row.version, at: now };
    void actRef.current({ action: 'times-up', gameId: id });
  }, [now, deadline, row.status, row.version, id]);

  const doAct = useCallback(
    (what: 'stack' | 'discard' | 'throw' | 'knock' | 'peek' | 'next' | Slot) => {
      const version = row.version;
      if (what === 'peek') return void act({ action: 'peek-done', gameId: id });
      if (what === 'next') return void act({ action: 'next', gameId: id });
      if (what === 'stack' || what === 'discard') return void act({ action: 'draw', gameId: id, version, from: what });
      if (what === 'throw' || what === 'knock') return void act({ action: what, gameId: id, version });
      return void act({ action: 'swap', gameId: id, version, slot: what });
    },
    [act, id, row.version],
  );

  // Keyboard: S stack, D discard, K knock, T throw away, Escape closes things.
  const keys = useRef<(event: KeyboardEvent) => void>(() => {});
  keys.current = (event: KeyboardEvent) => {
    if (!view || event.altKey || event.ctrlKey || event.metaKey || busy) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select')) return;
    if (event.key === 'Escape') {
      if (confirming) setConfirming(false);
      else if (showPodium && view.phase === 'over') setShowPodium(false);
      return;
    }
    if (view.phase !== 'play' || view.turn !== mySeat || view.out[mySeat]) return;
    const key = event.key.toLowerCase();
    const holding = view.holding?.seat === mySeat;
    if (!holding && key === 's') doAct('stack');
    else if (!holding && key === 'd') doAct('discard');
    else if (!holding && key === 'k' && view.canKnock) doAct('knock');
    else if (holding && key === 't') doAct('throw');
    else return;
    event.preventDefault();
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => keys.current(event);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // When it becomes my turn to place a card, put focus on my first face-down card.
  const placing = !!view && view.phase === 'play' && view.holding?.seat === mySeat;
  useEffect(() => {
    if (!placing) return;
    document.querySelector<HTMLButtonElement>('.c101-seat--me button.is-pickable, .c101-throw')?.focus({ preventScroll: true });
  }, [placing]);

  if (!view) return <p className="loading">Dealing…</p>;

  const out = view.out[mySeat];
  const over = row.status === 'finished';
  const between = view.phase === 'round-over' || view.phase === 'over';
  const myTurn = !over && !out && view.phase === 'play' && view.turn === mySeat;
  const holding = view.holding?.seat === mySeat ? view.holding : null;
  const open = swappableSlots({ faceUp: view.faceUp.map((h) => h.map((c) => c !== null)) }, mySeat);
  const peeking = !over && view.phase === 'peek' && !!view.peek;
  const lastTurn = view.knocker !== null && view.knocker !== mySeat;
  const turnSeat = view.phase === 'play' && !over ? view.turn : null;
  const iAmReady = info.ready?.[mySeat] ?? false;
  const places = info.places ?? placesFrom(view.totals, view.out);
  const seconds = timeLeft === null ? null : Math.max(0, Math.ceil(timeLeft / 1000));
  const abandoned = info.ending === 'abandoned';

  let status: string;
  if (over) {
    status = abandoned
      ? 'This game stopped: nobody played for 10 minutes.'
      : out
        ? 'The game is over. You were out of this one.'
        : view.winners?.includes(mySeat)
          ? 'You won! 🏆'
          : `You came ${ORDINAL[places[mySeat]]}.`;
  } else if (out) status = 'You’re out of this game. You can watch, or leave.';
  else if (peeking) status = 'Peek! Remember your bottom two cards.';
  else if (view.phase === 'peek') status = 'Waiting for everyone to finish peeking…';
  else if (view.phase === 'round-over') status = iAmReady ? 'Waiting for everyone to see the scores…' : `Round ${view.round} is over.`;
  else if (myTurn && holding)
    status = open.length ? 'Tap a face-down card to swap it in, or throw this one away.' : 'All your cards are face up, so throw this one away.';
  else if (myTurn) status = `${lastTurn ? 'Last turn! ' : 'Your turn! '}Take a card from the stack or the discard pile${view.canKnock ? ', or knock' : ''}.`;
  else if (turnSeat !== null) status = `${names[turnSeat]}’s turn…`;
  else status = '…';

  let knockReason = '';
  if (myTurn && !holding && !view.canKnock) knockReason = view.knocker !== null ? 'Someone has already knocked.' : 'You can knock once everyone has had a turn.';

  const clock =
    seconds !== null && !over && (view.phase !== 'play' || (timeLeft ?? Infinity) <= SHOW_CLOCK_MS) ? (
      <span className={`c101-clock${myTurn && (timeLeft ?? 0) <= SHOW_CLOCK_MS ? ' is-urgent' : ''}`} aria-label={`${seconds} seconds left`}>
        ⏱ {seconds}
      </span>
    ) : null;

  const scoring = between && !over && view.lastRound && scoringRound === view.lastRound.round;
  const finalScoring = over && !abandoned && view.lastRound && scoringRound === view.lastRound.round;
  const lines = row.log.map((e) => eventLine(e, names, mySeat)).filter((l): l is string => !!l);
  const counts = info.counts?.[mySeat];
  const note = over && !abandoned ? (counts ? 'Points added!' : out ? 'Players who leave or run out of time earn nothing.' : 'That game was too short to earn points (it needs 2 full rounds).') : null;

  const overlay = scoring || finalScoring ? (
    <Scoring
      key={`round-${view.lastRound!.round}`}
      result={view.lastRound!}
      seats={seats}
      me={mySeat}
      gameOver={over}
      timeScale={1}
      onRevealed={() => soundOn && view.lastRound!.winners.includes(mySeat) && playSound('win')}
      onNext={() => {
        if (over) {
          setScoringRound(null);
          setShowPodium(true);
        } else {
          setScoringRound(null);
          doAct('next');
        }
      }}
    />
  ) : over && showPodium ? (
    <Podium
      seats={seats}
      places={places}
      totals={view.totals}
      me={mySeat}
      shared={(view.winners?.length ?? 0) > 1}
      note={note}
      about={abandoned ? 'Nobody played for 10 minutes, so it ended with no points.' : out ? 'You were out of this game.' : undefined}
    >
      <button type="button" className="button button--primary" disabled={busy} onClick={() => void act({ action: 'rematch', gameId: id })} autoFocus>
        Rematch
      </button>
      <button type="button" className="button button--light" onClick={() => setShowPodium(false)}>
        Look at the table
      </button>
      <button type="button" className="link-button" onClick={() => navigate('/lobby')}>
        Back to the lobby
      </button>
    </Podium>
  ) : null;

  return (
    <div className="c101-game">
      <h1 className="sr-only">101 with classmates</h1>
      <div className="c101-game__felt">
        <Table
          view={view}
          seats={seats}
          turnSeat={turnSeat}
          thinking={false}
          flash={flash}
          canSwap={myTurn && !!holding && !busy}
          canDraw={myTurn && !holding && !busy}
          onDraw={(from) => doAct(from)}
          onSwap={(slot) => doAct(slot)}
          overlay={overlay}
        >
          <div className="c101-controls">
            <p className={`c101-status${myTurn || peeking ? ' is-mine' : ''}`} role="status" aria-live="polite">
              {status} {clock}
            </p>
            {peeking && (
              <button type="button" className="button button--play" onClick={() => doAct('peek')} disabled={busy} autoFocus>
                I’ve remembered them
              </button>
            )}
            {myTurn && holding && (
              <button type="button" className="button button--light c101-throw" onClick={() => doAct('throw')} disabled={busy} aria-keyshortcuts="T">
                🗑 Throw it away
              </button>
            )}
            {myTurn && !holding && (
              <span className="c101-knock-wrap">
                <button
                  type="button"
                  className="button button--light c101-knock"
                  disabled={!view.canKnock || busy}
                  onClick={() => doAct('knock')}
                  aria-keyshortcuts="K"
                  aria-describedby={knockReason ? 'c101-knock-why' : undefined}
                >
                  ✊ Knock
                </button>
                {knockReason && (
                  <small id="c101-knock-why" className="c101-knock-why">
                    {knockReason}
                  </small>
                )}
              </span>
            )}
            {between && !scoring && !finalScoring && !(over && showPodium) && (
              <button
                type="button"
                className="button button--play"
                onClick={() => (over ? setShowPodium(true) : setScoringRound(view.round))}
              >
                {over ? '🏆 Places' : 'Scores'}
              </button>
            )}
            {session.message && (
              <p className="chess-note" role="alert">
                {session.message}
              </p>
            )}
          </div>
        </Table>
        {banner && (
          <div className="c101-banner" role="alert">
            ✊ {banner}
          </div>
        )}
      </div>

      <aside className="c101-game__side" aria-label="Scores and game log">
        <ScoresPanel seats={seats} view={view} turnSeat={turnSeat} />
        <ValuesPanel />
        <LogPanel lines={lines} note={session.live === 'live' ? 'Live' : 'Reconnecting…'} />
        {confirming ? (
          <div className="chess-confirm" role="group" aria-label="Are you sure?">
            <p>Leave this game? You’ll be out, and it won’t earn you points.</p>
            <div className="chess-actions">
              <button
                type="button"
                className="button button--danger"
                disabled={busy}
                onClick={() => void act({ action: 'leave', gameId: id }).then((done) => done && navigate('/lobby'))}
              >
                Yes, leave
              </button>
              <button type="button" className="button button--light" onClick={() => setConfirming(false)} autoFocus>
                Keep playing
              </button>
            </div>
          </div>
        ) : (
          <div className="c101-actions">
            {over || out ? (
              <button type="button" className="c101-action is-main" onClick={() => navigate('/lobby')}>
                Back to the lobby
              </button>
            ) : (
              <button type="button" className="c101-action" onClick={() => setConfirming(true)}>
                Leave game
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
