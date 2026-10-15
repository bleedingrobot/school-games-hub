/**
 * 101 against 1–3 bots, played on this device from a seed.
 *
 * The rules engine (shared/card101) decides everything; this screen shows the student's
 * view of it. It plays exactly the way `replaySolo` replays a game, so the server can
 * check it in Stage 10.3: the same seeded shuffles, and bots moved with `playOneBot`, one
 * move at a time, with a pause between so the student can follow what they did.
 *
 * Bots think on the page: Medium takes about 2 thousandths of a second a move, so a
 * Web Worker would only add waiting.
 *
 * Saving (Stage 10.3): before a game the page asks the server for a stamped seed. At the
 * end it sends the seed, the stamp and the student's actions, and the server replays the
 * game before saving it (shared/card101/save.ts). No seed (no Wi-Fi, or the stand-alone
 * preview) means a practice game, and the page says so.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { randomAvatar } from '../../avatar/avatarParts';
import { AvatarImage } from '../../avatar/AvatarImage';
import { useSound } from '../../sound';
import { playSound, type GameSound } from '../sounds';
import type { BotLevel } from '../../../shared/botGame';
import { swappableSlots, RuleError, type GameEvent } from '../../../shared/card101/engine';
import { randomFromSeed } from '../../../shared/card101/random';
import type { Card101GameReport } from '../../../shared/card101/save';
import { applySolo, parseStudentAction, playOneBot, startSolo, STUDENT_SEAT, type SoloGame, type StudentAction } from '../../../shared/card101/solo';
import { viewFor, type SeatView } from '../../../shared/card101/view';
import type { Slot } from '../../../shared/card101/cards';
import { Card101Settings, CardValues } from './Card101Settings';
import { loadPrefs, savePrefs, type Card101Prefs } from './prefs';
import { Scoring } from './Scoring';
import { Table, type Flash, type Seat } from './Table';
import { BOT_BIRDS, BOT_LEVEL_NAMES, eventLine, ORDINAL } from './text';
import './card101.css';

export interface Card101Player {
  name: string;
  avatar: unknown;
}

/** How the page saves games. Missing in the stand-alone preview: every game is practice. */
export interface Card101Saving {
  /** A stamped seed from the server, or null if there isn't one (a practice game). */
  seed(): Promise<{ seed: string; stamp: string } | null>;
  save(report: Card101GameReport): Promise<{ countsForPoints?: boolean } | void>;
  /** Records a game left part-way. Must work while the page is closing. */
  abandon(report: Card101GameReport): void;
}

type SaveStatus = 'practice' | 'playing' | 'saving' | 'saved' | 'saved-no-points' | 'error';

/** How long bots take over each step (Normal speed). */
const BOT_DRAW_MS = 900;
const BOT_PLACE_MS = 1000;
/** The peek lasts this long, or until the student says they've remembered. */
export const PEEK_SECONDS = 15;

type Phase = 'student' | 'bots' | 'between';

interface Game {
  key: number;
  seats: Seat[];
  level: BotLevel;
}

/** A fresh seed for a game played on this device. */
function newSeed(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `local-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

function makeSeats(solo: SoloGame, player: Card101Player, level: BotLevel): Seat[] {
  return Array.from({ length: solo.game.players }, (_, i) =>
    i === STUDENT_SEAT
      ? { name: player.name, avatar: player.avatar, isStudent: true }
      : {
          name: BOT_BIRDS[i - 1],
          avatar: randomAvatar(randomFromSeed(`${solo.setup.seed}:avatar:${i}`)),
          isStudent: false,
          about: `${BOT_LEVEL_NAMES[level]} bot`,
        },
  );
}

/** Places from totals: lowest is 1st, ties share a place. */
export function placesFrom(totals: readonly number[], out: readonly boolean[]): number[] {
  return totals.map((t, i) => (out[i] ? 0 : 1 + totals.filter((u, j) => !out[j] && u < t).length));
}

/** The colour of a score bar: green, then amber after 75% of the way, then red after 90%. */
export function barLevel(total: number, target: number): 'ok' | 'warn' | 'danger' {
  const share = total / target;
  return share >= 0.9 ? 'danger' : share >= 0.75 ? 'warn' : 'ok';
}

const EVENT_SOUND: Partial<Record<GameEvent['kind'], GameSound>> = {
  draw: 'flick',
  swap: 'tap',
  throw: 'tap',
  knock: 'knock',
  deal: 'flick',
};

export function Card101Solo({
  player,
  level,
  onLevelChange,
  saving,
  timeScale = 1,
}: {
  player: Card101Player;
  level: BotLevel;
  onLevelChange: (level: BotLevel) => void;
  saving?: Card101Saving;
  /** Tests set this to 0 so nothing waits. */
  timeScale?: number;
}) {
  const { soundOn } = useSound();
  const [prefs, setPrefsState] = useState<Card101Prefs>(loadPrefs);
  const [game, setGame] = useState<Game | null>(null);
  const [view, setView] = useState<SeatView | null>(null);
  const [phase, setPhaseState] = useState<Phase>('bots');
  const [log, setLog] = useState<string[]>([]);
  const [hint, setHint] = useState('');
  const [banner, setBanner] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [scoringRound, setScoringRound] = useState<number | null>(null);
  const [showPodium, setShowPodium] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [peekLeft, setPeekLeft] = useState(PEEK_SECONDS);
  const [starting, setStarting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('practice');
  const [saveMessage, setSaveMessage] = useState('');

  const soloRef = useRef<SoloGame | null>(null);
  const gameRef = useRef<Game | null>(null);
  const keyRef = useRef(0);
  const phaseRef = useRef<Phase>('bots');
  /** Everything the student did, in order: what's sent to the server. */
  const actionsRef = useRef<StudentAction[]>([]);
  /** The current game's stamp; null for a practice game. */
  const stampRef = useRef<string | null>(null);
  /** Seeds already sent to the server (finished or left), so nothing is sent twice. */
  const sentRef = useRef(new Set<string>());
  const startingRef = useRef(false);
  const flashN = useRef(0);
  const live = useRef({ scale: timeScale, sound: soundOn });
  live.current = { scale: timeScale, sound: soundOn };

  useEffect(
    () => () => {
      keyRef.current++; // stops bots still playing
    },
    [],
  );

  function reportFor(solo: SoloGame, ending: Card101GameReport['ending']): Card101GameReport | null {
    const stamp = stampRef.current;
    if (!stamp) return null;
    const { seed, bots, level: botLevel, settings } = solo.setup;
    return { game: '101', seed, stamp, bots, level: botLevel, settings, actions: [...actionsRef.current], ending };
  }

  /** Saves the game as soon as the rules engine says it's over (while the scoring shows). */
  async function saveFinished(solo: SoloGame) {
    const report = reportFor(solo, 'finished');
    if (!saving || !report || sentRef.current.has(report.seed)) return;
    sentRef.current.add(report.seed);
    setSaveStatus('saving');
    try {
      const answer = await saving.save(report);
      if (soloRef.current === solo) setSaveStatus(answer && answer.countsForPoints === false ? 'saved-no-points' : 'saved');
    } catch (error) {
      if (soloRef.current !== solo) return;
      setSaveMessage(error instanceof Error && error.message ? error.message : 'We couldn’t save this game.');
      setSaveStatus('error');
    }
  }

  /** If the student leaves a game part-way (after doing something), it's recorded as left early. */
  const leftEarly = useRef(() => {});
  leftEarly.current = () => {
    const solo = soloRef.current;
    if (!saving || !solo || solo.game.phase === 'over' || actionsRef.current.length === 0) return;
    const report = reportFor(solo, 'abandoned');
    if (!report || sentRef.current.has(report.seed)) return;
    sentRef.current.add(report.seed);
    saving.abandon(report);
  };
  useEffect(() => {
    const onHide = () => leftEarly.current();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      onHide();
    };
  }, []);

  function setPrefs(next: Card101Prefs) {
    setPrefsState(next);
    savePrefs(next);
  }
  function setPhase(next: Phase) {
    phaseRef.current = next;
    setPhaseState(next);
  }
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms * live.current.scale));

  /** Shows what just happened: log lines, a flash on a swapped card, the knock banner, sounds. */
  function show(events: GameEvent[]) {
    const g = gameRef.current;
    if (!g) return;
    const names = g.seats.map((s) => s.name);
    const lines = events.map((e) => eventLine(e, names, STUDENT_SEAT)).filter((l): l is string => !!l);
    if (lines.length) setLog((prev) => [...prev, ...lines].slice(-60));
    for (const event of events) {
      const sound = EVENT_SOUND[event.kind];
      if (sound && live.current.sound) playSound(sound);
      if (event.kind === 'swap') setFlash({ seat: event.seat, slot: event.slot, n: ++flashN.current });
      if (event.kind === 'knock') {
        setBanner(event.seat === STUDENT_SEAT ? 'You knocked! Last turn for everyone else.' : `${names[event.seat]} knocked! Last turn!`);
        const key = keyRef.current;
        setTimeout(() => key === keyRef.current && setBanner(null), 2600 * Math.max(live.current.scale, 0.01));
      }
      if (event.kind === 'deal') setFlash(null);
      if (event.kind === 'round-end') setScoringRound(event.result.round);
    }
    const solo = soloRef.current!;
    setView(viewFor(solo.game, STUDENT_SEAT));
    if (solo.game.phase === 'over') void saveFinished(solo);
  }

  /** Plays the bots until it's the student's move, or the round is over. */
  async function run() {
    const key = keyRef.current;
    const solo = soloRef.current;
    if (!solo) return;
    for (let guard = 0; guard < 5000; guard++) {
      if (key !== keyRef.current) return;
      const g = solo.game;
      if (g.phase === 'over' || g.phase === 'round-over') {
        setPhase('between');
        return;
      }
      const botToMove = g.phase === 'peek' ? g.peeked.some((done, s) => !done && s !== STUDENT_SEAT) : g.turn !== STUDENT_SEAT;
      if (!botToMove) {
        setPhase('student');
        return;
      }
      setPhase('bots');
      if (g.phase === 'play') await wait(g.holding ? BOT_PLACE_MS : BOT_DRAW_MS);
      if (key !== keyRef.current) return;
      const move = playOneBot(solo);
      if (!move) continue;
      show(move.events);
    }
  }

  async function start() {
    if (startingRef.current) return;
    leftEarly.current();
    let stamped: { seed: string; stamp: string } | null = null;
    if (saving) {
      startingRef.current = true;
      setStarting(true);
      keyRef.current++; // stops the old game while the seed comes
      stamped = await saving.seed().catch(() => null);
      startingRef.current = false;
      setStarting(false);
    }
    const key = ++keyRef.current;
    const { solo, events } = startSolo({ seed: stamped?.seed ?? newSeed(), bots: prefs.bots, level, settings: { target: prefs.target } });
    const next: Game = { key, seats: makeSeats(solo, player, level), level };
    stampRef.current = stamped?.stamp ?? null;
    setSaveStatus(stamped ? 'playing' : 'practice');
    setSaveMessage('');
    soloRef.current = solo;
    gameRef.current = next;
    actionsRef.current = [];
    setGame(next);
    setLog([]);
    setHint('');
    setBanner(null);
    setFlash(null);
    setScoringRound(null);
    setShowPodium(false);
    setConfirming(false);
    setPeekLeft(PEEK_SECONDS);
    show(events);
    window.scrollTo({ top: 0 });
    void run();
  }

  function leave() {
    leftEarly.current();
    keyRef.current++;
    soloRef.current = null;
    gameRef.current = null;
    setGame(null);
    setView(null);
  }

  const act = useRef<(text: StudentAction) => void>(() => {});
  act.current = (text: StudentAction) => {
    const solo = soloRef.current;
    if (!solo) return;
    const isNext = text === 'next';
    if (!isNext && phaseRef.current !== 'student') return;
    if (isNext && phaseRef.current !== 'between') return;
    const parsed = parseStudentAction(text)!;
    let events: GameEvent[];
    try {
      events = applySolo(solo, parsed.actor, parsed.action);
    } catch (error) {
      if (error instanceof RuleError) {
        setHint(error.message);
        return;
      }
      throw error;
    }
    actionsRef.current.push(text);
    setHint('');
    if (isNext) {
      setScoringRound(null);
      setPeekLeft(PEEK_SECONDS);
    }
    show(events);
    void run();
  };
  const doAct = useCallback((text: StudentAction) => act.current(text), []);

  // The peek: 15 seconds to remember your bottom two cards (unless you say you're done).
  const peeking = phase === 'student' && !!view?.peek;
  useEffect(() => {
    if (!peeking || timeScale === 0) return;
    if (peekLeft <= 0) {
      doAct('peek');
      return;
    }
    const timer = setTimeout(() => setPeekLeft((n) => n - 1), 1000 * timeScale);
    return () => clearTimeout(timer);
  }, [peeking, peekLeft, timeScale, doAct]);

  // Keyboard: S stack, D discard, K knock, T throw away, Escape closes things.
  const keys = useRef<(event: KeyboardEvent) => void>(() => {});
  keys.current = (event: KeyboardEvent) => {
    if (!view || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select')) return;
    if (event.key === 'Escape') {
      if (confirming) setConfirming(false);
      else if (showPodium) setShowPodium(false);
      return;
    }
    if (phaseRef.current !== 'student' || view.phase !== 'play') return;
    const key = event.key.toLowerCase();
    const holding = view.holding?.seat === STUDENT_SEAT;
    if (!holding && key === 's') doAct('draw:stack');
    else if (!holding && key === 'd') doAct('draw:discard');
    else if (!holding && key === 'k') doAct('knock');
    else if (holding && key === 't') doAct('throw');
    else return;
    event.preventDefault();
  };
  useEffect(() => {
    if (!game) return;
    const onKey = (event: KeyboardEvent) => keys.current(event);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game]);

  // Keep the newest line of the game log in sight.
  const logRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = logRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [log]);

  // When it becomes the student's turn to place a card, put focus on their first face-down card.
  const placing = phase === 'student' && view?.phase === 'play' && view.holding?.seat === STUDENT_SEAT;
  useEffect(() => {
    if (!placing) return;
    document.querySelector<HTMLButtonElement>('.c101-seat--me button.is-pickable, .c101-throw')?.focus({ preventScroll: true });
  }, [placing]);

  // ---------- Settings screen ----------

  if (!game || !view) {
    return (
      <Card101Settings prefs={prefs} onChange={setPrefs} level={level} onLevelChange={onLevelChange} onStart={() => void start()} starting={starting} saves={!!saving} />
    );
  }

  // ---------- The game ----------

  const { seats } = game;
  const myTurn = phase === 'student' && view.phase === 'play' && view.turn === STUDENT_SEAT;
  const holding = view.holding?.seat === STUDENT_SEAT ? view.holding : null;
  const open = swappableSlots({ faceUp: view.faceUp.map((h) => h.map((c) => c !== null)) }, STUDENT_SEAT);
  const lastTurn = view.knocker !== null && view.knocker !== STUDENT_SEAT;
  const over = view.phase === 'over';
  const between = view.phase === 'round-over' || over;
  const turnSeat = view.phase === 'play' ? view.turn : null;
  const places = placesFrom(view.totals, view.out);
  const target = view.settings.target;

  let status: string;
  if (peeking) status = 'Peek! Remember your bottom two cards.';
  else if (view.phase === 'peek') status = 'Everyone’s peeking…';
  else if (over) status = view.winners?.includes(STUDENT_SEAT) ? 'You won! 🏆' : `You came ${ORDINAL[places[STUDENT_SEAT]]}.`;
  else if (between) status = `Round ${view.round} is over.`;
  else if (myTurn && holding)
    status = open.length
      ? 'Tap a face-down card to swap it in, or throw this one away.'
      : 'All your cards are face up, so throw this one away.';
  else if (myTurn) status = `${lastTurn ? 'Last turn! ' : 'Your turn! '}Take a card from the stack or the discard pile${view.canKnock ? ', or knock' : ''}.`;
  else if (turnSeat !== null) status = `${seats[turnSeat].name} is thinking…`;
  else status = '…';

  let knockReason = '';
  if (myTurn && !holding && !view.canKnock) knockReason = view.knocker !== null ? 'Someone has already knocked.' : 'You can knock once everyone has had a turn.';

  const scoring = between && view.lastRound && scoringRound === view.lastRound.round;
  const overlay = scoring ? (
    <Scoring
      key={view.lastRound!.round}
      result={view.lastRound!}
      seats={seats}
      me={STUDENT_SEAT}
      gameOver={over}
      timeScale={timeScale}
      onRevealed={() => live.current.sound && view.lastRound!.winners.includes(STUDENT_SEAT) && playSound('win')}
      onNext={() => {
        if (over) {
          setScoringRound(null);
          setShowPodium(true);
        } else doAct('next');
      }}
    />
  ) : over && showPodium ? (
    <Podium
      seats={seats}
      places={places}
      totals={view.totals}
      shared={(view.winners?.length ?? 0) > 1}
      saveNote={saveNote(saveStatus, saveMessage, !!saving)}
    >
      <button type="button" className="button button--primary" onClick={() => void start()} disabled={starting} autoFocus>
        Play again
      </button>
      <button type="button" className="button button--light" onClick={() => setShowPodium(false)}>
        Look at the table
      </button>
      <button type="button" className="link-button" onClick={leave}>
        Change settings
      </button>
    </Podium>
  ) : null;

  return (
    <div className="c101-game">
      <h1 className="sr-only">101</h1>
      <div className="c101-game__felt">
        <Table
          view={view}
          seats={seats}
          turnSeat={turnSeat}
          thinking={phase === 'bots'}
          flash={flash}
          canSwap={myTurn && !!holding}
          canDraw={myTurn && !holding}
          onDraw={(from) => doAct(from === 'stack' ? 'draw:stack' : 'draw:discard')}
          onSwap={(slot: Slot) => doAct(`swap:${slot}`)}
          overlay={overlay}
        >
          <div className="c101-controls">
            <p className={`c101-status${myTurn || peeking ? ' is-mine' : ''}`} role="status" aria-live="polite">
              {status}
            </p>
            {peeking && (
              <button type="button" className="button button--play" onClick={() => doAct('peek')} autoFocus>
                I’ve remembered them {timeScale > 0 && <span className="c101-countdown">{peekLeft}</span>}
              </button>
            )}
            {myTurn && holding && (
              <button type="button" className="button button--light c101-throw" onClick={() => doAct('throw')} aria-keyshortcuts="T">
                🗑 Throw it away
              </button>
            )}
            {myTurn && !holding && (
              <span className="c101-knock-wrap">
                <button
                  type="button"
                  className="button button--light c101-knock"
                  disabled={!view.canKnock}
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
            {between && !scoring && !showPodium && (
              <button type="button" className="button button--play" onClick={() => (over ? setShowPodium(true) : setScoringRound(view.round))}>
                {over ? '🏆 Places' : 'Scores'}
              </button>
            )}
            {hint && (
              <p className="chess-note" role="alert">
                {hint}
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
        <section className="c101-panel" aria-labelledby="c101-scores-title">
          <h2 id="c101-scores-title" className="c101-panel__title">
            Scores <span>Round {view.round} · to {target}</span>
          </h2>
          <ul className="c101-scores">
            {seats.map((seat, i) => {
              const total = view.totals[i];
              const last = view.history.at(-1)?.hands[i];
              return (
                <li key={i} className={`c101-score${turnSeat === i ? ' is-turn' : ''}${view.out[i] ? ' is-out' : ''}`}>
                  <AvatarImage avatar={seat.avatar} size={30} />
                  <span className="c101-score__name">{seat.isStudent ? 'You' : seat.name}</span>
                  <span className="c101-score__total" aria-label={`${total} of ${target}${last != null ? `, last hand ${last}` : ''}`}>
                    {total}
                    {last != null && <small>+{last}</small>}
                  </span>
                  <span className={`c101-bar is-${barLevel(total, target)}`} aria-hidden="true">
                    <span style={{ width: `${Math.min(100, (total / target) * 100)}%` }} />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="c101-panel c101-panel--values" aria-labelledby="c101-values-title">
          <h2 id="c101-values-title" className="c101-panel__title">
            Card values
          </h2>
          <CardValues />
          <p className="c101-panel__note">Pairs cancel out. Three of a kind: the whole hand is 0.</p>
        </section>

        <section className="c101-panel c101-log" aria-labelledby="c101-log-title">
          <h2 id="c101-log-title" className="c101-panel__title">
            What happened <span>{LOG_SAVE_NOTE[saveStatus]}</span>
          </h2>
          <ol ref={logRef} aria-live="polite" aria-relevant="additions">
            {log.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </section>

        {confirming ? (
          <div className="chess-confirm" role="group" aria-label="Are you sure?">
            <p>Start again? This game will end.</p>
            <div className="chess-actions">
              <button type="button" className="button button--danger" onClick={() => void start()} disabled={starting}>
                Yes, start again
              </button>
              <button type="button" className="button button--light" onClick={() => setConfirming(false)} autoFocus>
                Keep playing
              </button>
            </div>
          </div>
        ) : (
          <div className="c101-actions">
            {over ? (
              <button type="button" className="c101-action is-main" onClick={() => void start()} disabled={starting}>
                Play again
              </button>
            ) : (
              <button type="button" className="c101-action" onClick={() => setConfirming(true)}>
                New game
              </button>
            )}
            <button type="button" className="c101-action" onClick={leave}>
              Settings
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

const LOG_SAVE_NOTE: Record<SaveStatus, string> = {
  practice: 'Practice game: not saved',
  playing: 'Saved when you finish',
  saving: 'Saving…',
  saved: 'Saved ✓',
  'saved-no-points': 'Saved ✓',
  error: 'Not saved',
};

/** The line on the podium about saving. */
function saveNote(status: SaveStatus, message: string, canSave: boolean): string | null {
  switch (status) {
    case 'practice':
      return canSave ? 'Practice game: we couldn’t reach the server at the start, so this one isn’t saved.' : null;
    case 'playing':
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'Saved! Points added.';
    case 'saved-no-points':
      return 'Saved. That game was too short to earn points (it needs 2 full rounds).';
    case 'error':
      return message;
  }
}

const MEDALS = ['', '🥇', '🥈', '🥉', '4️⃣'];

function Podium({
  seats,
  places,
  totals,
  shared,
  saveNote,
  children,
}: {
  seats: readonly Seat[];
  places: number[];
  totals: number[];
  shared: boolean;
  saveNote: string | null;
  children: ReactNode;
}) {
  const mine = places[STUDENT_SEAT];
  const title = mine === 1 ? (shared ? 'You shared the win!' : 'You won!') : `You came ${ORDINAL[mine]}`;
  const about = mine === 1 ? 'Lowest total wins. Great remembering!' : 'Lowest total wins. Have another go!';
  const order = seats.map((_, i) => i).filter((i) => places[i] > 0).sort((a, b) => places[a] - places[b] || totals[a] - totals[b]);
  return (
    <div className="chess-result c101-podium" role="dialog" aria-modal="true" aria-labelledby="c101-result-title">
      <div className={`chess-result__card chess-result__card--${mine === 1 ? 'won' : 'drawn'}`}>
        <div className="chess-result__emoji" aria-hidden="true">
          {mine === 1 ? '🏆' : MEDALS[mine]}
        </div>
        <h2 id="c101-result-title">{title}</h2>
        <p>{about}</p>
        <ol className="c101-podium__list">
          {order.map((i) => (
            <li key={i} className={i === STUDENT_SEAT ? 'is-me' : ''}>
              <span aria-hidden="true">{MEDALS[places[i]]}</span>
              <span className="sr-only">{ORDINAL[places[i]]}:</span>
              <AvatarImage avatar={seats[i].avatar} size={32} />
              <span>{seats[i].isStudent ? 'You' : seats[i].name}</span>
              <strong>{totals[i]}</strong>
            </li>
          ))}
        </ol>
        {saveNote && (
          <p className="c101-podium__save" role="status">
            {saveNote}
          </p>
        )}
        <div className="chess-result__buttons">{children}</div>
      </div>
    </div>
  );
}
