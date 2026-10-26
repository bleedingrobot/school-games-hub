/**
 * Wormholes & Black Holes with classmates: the board and controls for a game the server runs.
 *
 * The server rolls every die and runs the rules. Each change arrives as a new version of the
 * game row with the events that made it; this screen plays those events in order (the same
 * animations as the bot game) and only then lets the student act. If it missed some versions
 * (Wi-Fi blip, a sleeping laptop), it reads them from the game's log and plays them together.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { randomAvatar } from '../../avatar/avatarParts';
import { useSound } from '../../sound';
import { BOT_NAMES } from '../../../shared/space/bot';
import { itemProblem, MATHS_CHARGE_STEPS, usableItems, validTargets } from '../../../shared/space/engine';
import { ITEMS, type ItemKind } from '../../../shared/space/items';
import { LIVE_BOT_CALLSIGNS, LIVE_BOT_LEVEL, REACTIONS, REACTION_GAP_SECONDS, MAX_REACTIONS, timesUpDelayMs, type Reaction } from '../../../shared/space/live';
import { randomFromSeed } from '../../../shared/space/random';
import { fetchReactionsEnabled, fetchSpaceLog, seatsOf, type SpaceAction, type SpaceGame, type SpaceMathsReply } from '../../data/spaceGames';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import { skipRule, spendSkip, useSkipRule } from '../../maths/questionLog';
import type { PlayerCard } from '../../data/multiplayer';
import type { SpaceSession } from '../../space/useSpaceGame';
import { Dice, DieFace } from './Dice';
import { arrowKeys, BoardOverlays, Choice, ItemPicker, ItemTiles, MissionLog, Podium, RocketsPanel, type Picking } from './parts';
import { SpaceGuide, type GuideTab } from './Guide';
import { loadLessMotion, loadPrefs, saveLessMotion, SPEED_SCALE } from './prefs';
import { SpaceBoard, type Seat } from './SpaceBoard';
import { ANSWER_FIRST, ANSWER_FIRST_BUTTON, choiceQuestion, itemName, ORDINAL, SEAT_COLOURS, SEAT_SHAPES, squareInfo, type SquareInfo } from './text';
import { useEventPlayer, type Batch } from './useEventPlayer';
import './space.css';

/** A missed stretch longer than this isn't replayed: the board just jumps to now. */
const MAX_REPLAY_VERSIONS = 8;
const HIDE_REACTIONS_KEY = 'sgh-space-hide-reactions';
const BUBBLE_MS = 2000;
/** The ring timer shows for the last this-many seconds. */
const RING_SECONDS = 10;
/** A wormhole or black hole question shows a 20-second countdown. */
const QUESTION_SECONDS = 20;

type ShownQuestion = NonNullable<SpaceMathsReply['question']>;
const MOMENT_TITLE = { wormhole: 'Wormhole boost', 'black-hole': 'Black hole escape' } as const;
const MOMENT_NOTE = {
  wormhole: 'A right answer flies you 3 squares further.',
  'black-hole': 'A right answer means you only fall half as far.',
} as const;

/** The wormhole or black hole question on screen (it stays until the student has seen how they did). */
interface MomentCard {
  /** The game version it was asked at. */
  version: number;
  question: ShownQuestion;
  moment: keyof typeof MOMENT_TITLE;
  /** When the countdown ends, by the server's clock. */
  endsAt: number;
  submitted: boolean;
}

/** The question after my turn, on the side card. `turns` is how many turns I'd finished when it was asked. */
interface ChargeCard {
  turns: number;
  question: ShownQuestion;
  right?: boolean;
}

const factText = (parts: string[], answer: number) => parts.map((p) => (p === '?' ? String(answer) : p)).join(' ');

function liveSeats(game: SpaceGame, cards: Map<string, PlayerCard>, mySeat: number): Seat[] {
  const players = seatsOf(game);
  let bot = 0;
  return (game.seat_info ?? []).map((info, i) => {
    const base = { colour: SEAT_COLOURS[i], shape: SEAT_SHAPES[i], isStudent: i === mySeat };
    if (info.bot) {
      const callsign = LIVE_BOT_CALLSIGNS[bot++];
      return { ...base, name: `${BOT_NAMES[LIVE_BOT_LEVEL]} ${callsign}`, avatar: randomAvatar(randomFromSeed(`${game.id}:avatar:${i}`)) };
    }
    const id = players[i];
    const card = id ? cards.get(id) : undefined;
    return { ...base, name: card?.display_name ?? 'A classmate', avatar: card?.avatar };
  });
}

function loadHideReactions(): boolean {
  try {
    return localStorage.getItem(HIDE_REACTIONS_KEY) === 'true';
  } catch {
    return false;
  }
}

export function SpaceLive({ session, timeScale = 1 }: { session: SpaceSession; timeScale?: number }) {
  const { game, mySeat, cards, act, busy } = session;
  const { soundOn } = useSound();
  const [lessMotion, setLessMotionState] = useState(loadLessMotion);
  const live = useRef({ scale: 1, calm: false, sound: false });
  live.current = { scale: SPEED_SCALE[loadPrefs().speed] * timeScale, calm: lessMotion, sound: soundOn };
  const screen = useEventPlayer(live);
  const { view, rockets, turnSeat, dice, log, toast, banner, fact, setFact } = screen;

  const [animating, setAnimating] = useState(true);
  const [shownVersion, setShownVersion] = useState<number | null>(null);
  const [picking, setPicking] = useState<Picking | null>(null);
  const [info, setInfo] = useState<({ n: number } & SquareInfo) | null>(null);
  const [guide, setGuide] = useState<GuideTab | null>(null);
  const [hint, setHint] = useState('');
  const [showPodium, setShowPodium] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [now, setNow] = useState(() => session.serverNow());
  const [reactionsOn, setReactionsOn] = useState(false);
  const [hideReactions, setHideReactions] = useState(loadHideReactions);
  const [bubbles, setBubbles] = useState<(string | null)[]>([]);
  const [reactedAt, setReactedAt] = useState(0);
  const [timesUpTry, setTimesUpTry] = useState(0);
  const [moment, setMoment] = useState<MomentCard | null>(null);
  const [charge, setCharge] = useState<ChargeCard | null>(null);
  const skips = useSkipRule();
  /** The "turns finished" count I last asked (or skipped) the after-turn question for. */
  const chargeAsked = useRef<number | null>(null);

  const seats = liveSeats(game, cards, mySeat);
  const seatsRef = useRef(seats);
  seatsRef.current = seats;
  const shown = useRef<number | null>(null);
  const queue = useRef<(() => Promise<Batch | null>)[]>([]);
  const pumping = useRef(false);
  const alive = useRef(true);
  const panelRef = useRef<HTMLElement>(null);
  const cast = () => ({ names: seatsRef.current.map((s) => s.name), me: mySeat >= 0 ? mySeat : null });

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function pump() {
    if (pumping.current) return;
    pumping.current = true;
    setAnimating(true);
    try {
      for (let next = queue.current.shift(); next; next = queue.current.shift()) {
        const batch = await next();
        if (!alive.current) return;
        if (!batch) continue;
        if (batch.events.length > 0) await screen.animate(batch, cast(), () => alive.current);
        else screen.jumpTo(batch.state);
      }
    } finally {
      pumping.current = false;
      if (alive.current) {
        setAnimating(false);
        setShownVersion(shown.current);
      }
    }
  }

  // Each new version of the game: play what happened.
  useEffect(() => {
    const g = game;
    if (!g.state) return;
    const state = g.state;
    if (shown.current === null) {
      // Opening the game (or coming back to it): fill in the log, show the board as it is now.
      shown.current = g.version;
      screen.reset(state);
      queue.current.push(async () => {
        const entries = await fetchSpaceLog(g.id, 0, 30);
        for (const entry of entries) for (const event of entry.events) screen.logEvent(event, cast());
        return null;
      });
      if (g.status === 'finished') setShowPodium(true);
      void pump();
      return;
    }
    if (g.version <= shown.current) return;
    const from = shown.current;
    shown.current = g.version;
    if (g.version === from + 1) {
      queue.current.push(async () => ({ events: g.events, state }));
    } else {
      queue.current.push(async () => {
        if (g.version - from > MAX_REPLAY_VERSIONS) return { events: [], state };
        const entries = await fetchSpaceLog(g.id, from, MAX_REPLAY_VERSIONS);
        const complete = entries.length === g.version - from;
        return { events: complete ? entries.flatMap((e) => e.events) : [], state };
      });
    }
    void pump();
  }, [game.version, game.id]);

  const settled = !animating && shownVersion === game.version && !!view;
  const over = game.status === 'finished';
  useEffect(() => {
    if (settled && over) setShowPodium(true);
  }, [settled, over]);

  // The clock.
  const playing = game.status === 'playing';
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setNow(session.serverNow()), 500);
    return () => clearInterval(timer);
  }, [playing, session]);
  const deadline = game.turn_deadline ? Date.parse(game.turn_deadline) : null;
  const secondsLeft = deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));

  // When the clock runs out, one of the pages tells the server (the next player's first).
  useEffect(() => {
    if (!playing || deadline === null || mySeat < 0 || !game.state || !game.seat_info) return;
    const wait = deadline - session.serverNow() + timesUpDelayMs({ state: game.state, seats: game.seat_info }, mySeat);
    const timer = setTimeout(async () => {
      const done = await act({ action: 'times-up', gameId: game.id });
      if (!done && alive.current) setTimeout(() => setTimesUpTry((n) => n + 1), 3000);
    }, Math.max(0, wait));
    return () => clearTimeout(timer);
  }, [game.version, game.turn_deadline, playing, mySeat, timesUpTry]);

  // Reactions: is the teacher's switch on?
  useEffect(() => {
    if (!playing) return;
    let current = true;
    const check = () => void fetchReactionsEnabled().then((on) => current && setReactionsOn(on));
    check();
    const timer = setInterval(check, 60_000);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [playing]);

  // A new reaction pops up over the sender's rocket for 2 seconds.
  const lastReaction = game.reactions?.last;
  const seenReaction = useRef<number | null>(null);
  useEffect(() => {
    const id = lastReaction?.id ?? 0;
    if (seenReaction.current === null) {
      seenReaction.current = id;
      return;
    }
    if (!lastReaction || id <= seenReaction.current) return;
    seenReaction.current = id;
    if (hideReactions) return;
    const { seat, emoji } = lastReaction;
    setBubbles((b) => Object.assign([...b], { [seat]: emoji }));
    const timer = setTimeout(() => setBubbles((b) => Object.assign([...b], { [seat]: null })), BUBBLE_MS);
    return () => clearTimeout(timer);
  }, [lastReaction, hideReactions]);

  const myInfo = mySeat >= 0 ? game.seat_info?.[mySeat] : undefined;
  const onAutopilot = !!myInfo?.autopilot;
  const myTurn = settled && playing && !!view && view.turn === mySeat && view.phase !== 'over' && !onAutopilot;

  // ---------- Mission Control maths ----------
  const mathsOn = game.setup.settings.maths && mySeat >= 0;
  const myTurns = myInfo?.stats.turns ?? 0;
  const asking = myTurn && view?.phase === 'choice' && view.pending?.kind === 'question' ? view.pending : null;

  // A wormhole or black hole question: ask the server for it when I land, and keep it on screen until I've seen how I did.
  useEffect(() => {
    if (!mathsOn || !asking || moment) return;
    const version = game.version;
    let current = true;
    session.ask({ action: 'question', gameId: game.id, kind: 'moment', version }).then(
      (reply) => {
        if (!current || !reply.question) return;
        setMoment({
          version,
          question: reply.question,
          moment: asking.moment ?? 'wormhole',
          endsAt: Math.min(deadline ?? Infinity, session.serverNow() + QUESTION_SECONDS * 1000),
          submitted: false,
        });
      },
      (error: unknown) => current && setHint(error instanceof Error ? error.message : 'We couldn’t get your question.'),
    );
    return () => {
      current = false;
    };
  }, [mathsOn, !!asking, game.version, moment === null]);
  // The game moved on without an answer (the time ran out): close the question.
  useEffect(() => {
    if (moment && !moment.submitted && game.version !== moment.version) setMoment(null);
  }, [game.version, moment]);

  // The question after my turn: ask for it once for each turn I finish, and show it on the side card
  // until I answer, skip it, or roll.
  useEffect(() => {
    if (!mathsOn || !settled || !playing || onAutopilot || !!myInfo?.left || myTurns < 1) return;
    if (chargeAsked.current === myTurns || (myTurn && view?.turnInfo.rolled)) return;
    chargeAsked.current = myTurns;
    let current = true;
    session.ask({ action: 'question', gameId: game.id, kind: 'charge' }).then(
      (reply) => current && reply.question && setCharge({ turns: myTurns, question: reply.question }),
      () => {
        // Not asked this time (the game moved on): try again after the next change.
        if (chargeAsked.current === myTurns) chargeAsked.current = null;
      },
    );
    return () => {
      current = false;
    };
  }, [mathsOn, settled, playing, onAutopilot, myTurns, game.version]);

  /** Sends my typed answer; the server marks it and says how I did. */
  async function markWith(request: SpaceAction, question: ShownQuestion): Promise<MarkedAnswer> {
    const reply = await session.ask(request);
    if (reply.right === undefined || reply.answer === undefined) throw new Error('We couldn’t check that one. Try again.');
    return { correct: reply.right, answer: reply.answer, fact: factText(question.parts, reply.answer), boxBefore: 0, boxAfter: 0 };
  }

  function send(request: SpaceAction) {
    setHint('');
    setPicking(null);
    setInfo(null);
    void act(request);
  }
  function roll() {
    if (!myTurn || view?.phase !== 'ready') return;
    // Rolling past an unanswered Mission Control card skips it, so the class's skip switch decides (questionLog.ts).
    const pastCard = mathsOn && !!charge && charge.turns === myTurns && charge.right === undefined && !view.turnInfo.rolled;
    if (pastCard && !skipRule().canSkip) {
      setHint(ANSWER_FIRST);
      return;
    }
    if (pastCard) spendSkip();
    send({ action: 'roll', gameId: game.id, version: game.version });
  }
  function choose(option: number) {
    if (myTurn && view?.phase === 'choice') send({ action: 'choose', gameId: game.id, version: game.version, option });
  }
  function useItem(item: ItemKind, extra: { target?: number; value?: number } = {}) {
    if (!myTurn) return;
    send({ action: 'use-item', gameId: game.id, version: game.version, item, ...extra });
  }
  function chooseItem(item: ItemKind) {
    if (!myTurn || !view) return;
    const problem = itemProblem(view, item, mySeat);
    if (problem) {
      setHint(problem);
      return;
    }
    if (ITEMS[item].targeted) setPicking({ item, kind: 'target' });
    else if (item === 'navigator') setPicking({ item, kind: 'navigator' });
    else useItem(item);
  }
  function setLessMotion(on: boolean) {
    setLessMotionState(on);
    saveLessMotion(on);
  }
  function toggleHideReactions() {
    const next = !hideReactions;
    setHideReactions(next);
    setBubbles([]);
    try {
      localStorage.setItem(HIDE_REACTIONS_KEY, String(next));
    } catch {
      // Not remembered, but still works for this visit.
    }
  }

  // Keyboard: Space/Enter rolls, 1–3 use items, number keys pick cards and dice, Escape closes things.
  const keys = useRef<(event: KeyboardEvent) => void>(() => {});
  keys.current = (event: KeyboardEvent) => {
    if (!view) return;
    const target = event.target as HTMLElement | null;
    if (guide || target?.closest('input, textarea, select')) return;
    if (event.key === '?') {
      setGuide('how');
      return;
    }
    if (event.key === 'Escape') {
      if (picking) setPicking(null);
      else if (info) setInfo(null);
      else if (fact) setFact(null);
      else if (confirmLeave) setConfirmLeave(false);
      else if (showPodium) setShowPodium(false);
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || !myTurn || busy) return;
    if (event.key === ' ' || event.key === 'Enter') {
      if (target?.closest('button, a, summary')) return;
      if (view.phase === 'ready' && !picking) {
        event.preventDefault();
        roll();
      }
      return;
    }
    if (!/^[1-6]$/.test(event.key)) return;
    const n = Number(event.key);
    if (picking?.kind === 'navigator') {
      event.preventDefault();
      useItem('navigator', { value: n });
    } else if (view.phase === 'choice' && view.pending) {
      const kind = view.pending.kind;
      if ((kind === 'mystery' && n <= 3) || (kind === 'binary' && n <= 2)) {
        event.preventDefault();
        choose(n - 1);
      }
    } else if (view.phase === 'ready' && !picking && n <= 3) {
      const item = view.rockets[mySeat].items[n - 1];
      if (item) {
        event.preventDefault();
        chooseItem(item);
      }
    }
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => keys.current(event);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const choiceKey = myTurn && view ? `${game.version}:${view.phase}:${picking?.item ?? ''}` : '';
  useEffect(() => {
    if (!choiceKey) return;
    panelRef.current?.querySelector<HTMLButtonElement>('.space-choice button')?.focus({ preventScroll: true });
  }, [choiceKey]);

  if (!view) return <p className="loading">Setting up the board…</p>;

  const me = mySeat >= 0 ? view.rockets[mySeat] : null;
  const pending = myTurn && view.phase === 'choice' ? view.pending : null;
  const canRoll = myTurn && view.phase === 'ready' && !picking && !busy;
  // The question card is still open: rolling now skips it, and the Roll button says what that costs.
  const chargeWaiting = canRoll && mathsOn && !!charge && charge.turns === myTurns && charge.right === undefined && !view.turnInfo.rolled;
  // The class's skip switch is off (or no skips are left): Roll waits for an answer. The turn timer still runs (James).
  const answerFirst = chargeWaiting && !skips.canSkip;
  const usable = myTurn && view.phase === 'ready' ? usableItems(view, mySeat) : [];
  const targets = myTurn && picking?.kind === 'target' ? validTargets(view, picking.item, mySeat) : [];
  const positions = rockets.map((r) => r.pos);
  const cosmic = view.settings.mode === 'cosmic';
  const finished = over && settled;
  const places = game.places ?? [];
  const left = !!myInfo?.left;
  const ring = playing && settled && secondsLeft !== null && secondsLeft <= RING_SECONDS && turnSeat !== null;
  const players = seatsOf(game);
  const present = session.present;

  const clock = ring ? ` (⏱ ${secondsLeft})` : '';
  let status: string;
  if (finished) {
    if (game.ending === 'abandoned') status = 'Everyone left, so the game stopped.';
    else if (left || mySeat < 0) status = 'The game is over.';
    else status = places[mySeat] === 1 ? 'You won! 🏆' : `You came ${ORDINAL[places[mySeat]]}.`;
  } else if (!settled || turnSeat === null) status = 'Off you go…';
  else if (onAutopilot) status = 'Autopilot is flying your rocket.';
  else if (pending) status = choiceQuestion(pending) + clock;
  else if (picking?.kind === 'target') status = `Who should the ${itemName(picking.item)} hit? Tap a rocket.`;
  else if (picking?.kind === 'navigator') status = 'Navigator: pick your roll.';
  else if (myTurn && view.turnInfo.rollAgainUsed && !view.turnInfo.rolled) status = `You rolled a 6: roll again!${clock}`;
  else if (myTurn && view.turnInfo.itemUsed) status = `Now roll!${clock}`;
  else if (myTurn) status = (usable.length > 0 ? 'Your turn! Use an item, or roll.' : 'Your turn! Roll the dice.') + clock;
  else status = `${seats[turnSeat]?.name ?? 'Someone'}’s turn${clock}`;

  const boardLabel = `${view.board.name} board, ${view.board.size} squares. ${seats
    .map((s, i) => `${s.isStudent ? 'You are' : `${s.name} is`} on square ${positions[i]}`)
    .join('. ')}.`;

  const note = (i: number) => {
    const info = game.seat_info?.[i];
    if (!info || info.bot) return <span className="space-players__note"> · bot</span>;
    if (info.autopilot) return <span className="space-players__note"> · 🤖 autopilot</span>;
    const id = players[i];
    if (playing && present && id && !present.includes(id)) return <span className="space-players__note"> · away</span>;
    return null;
  };

  const sentReactions = mySeat >= 0 ? (game.reactions?.sent?.[mySeat] ?? 0) : MAX_REACTIONS;
  const reactionWait = Date.now() - reactedAt < REACTION_GAP_SECONDS * 1000;
  const canReact = reactionsOn && playing && mySeat >= 0 && !left && sentReactions < MAX_REACTIONS;

  let saveNote: string;
  if (game.ending === 'abandoned') saveNote = 'Nobody earns points for this one.';
  else if (left || mySeat < 0) saveNote = 'You left part-way, so this game doesn’t earn you points.';
  else if (game.counts?.[mySeat]) saveNote = 'Saved! Taking part earns points (your first 6 classmates games each day).';
  else saveNote = 'Saved. That game was too short to earn points.';

  return (
    <div className={`space-game${lessMotion ? ' is-calm' : ''}`} style={{ '--rows': view.board.size / 10 } as CSSProperties}>
      <h1 className="sr-only">Wormholes &amp; Black Holes</h1>
      <div className="space-game__board">
        <SpaceBoard
          state={view}
          seats={seats}
          positions={positions}
          fx={rockets.map((r) => r.fx)}
          moveMs={rockets.map((r) => r.ms)}
          turn={finished ? null : turnSeat}
          targets={targets}
          onTarget={(seat) => picking && useItem(picking.item, { target: seat })}
          onSquare={(n) => setInfo(info?.n === n ? null : { n, ...squareInfo(view, n, seats.map((s) => s.name)) })}
          selected={info?.n ?? null}
          label={boardLabel}
          bubbles={bubbles}
        />
        <BoardOverlays
          banner={banner}
          toast={toast}
          info={info}
          onCloseInfo={() => setInfo(null)}
          fact={fact}
          onCloseFact={() => setFact(null)}
          onOpenChart={() => setGuide('chart')}
        />
        {finished && showPodium && (
          <Podium seats={seats} places={places} mine={left || mySeat < 0 ? null : places[mySeat]} ending={game.ending} saveNote={saveNote}>
            <button
              type="button"
              className="button button--primary"
              disabled={busy}
              onClick={() => void act({ action: 'rematch', gameId: game.id })}
              autoFocus
            >
              {game.rematch_game ? 'Join the rematch' : 'Rematch'}
            </button>
            <button type="button" className="button button--light" onClick={() => setShowPodium(false)}>
              Look at the board
            </button>
            <Link to="/lobby" className="link-button">
              Back to the lobby
            </Link>
            {session.message && (
              <p className="chess-note" role="alert">
                {session.message}
              </p>
            )}
          </Podium>
        )}
      </div>

      <aside className="space-game__side" aria-label="Game controls">
        <section className="space-panel space-turn" ref={panelRef} aria-label="Your turn">
          <p className={`turn-status${myTurn ? ' is-mine' : ''}`} role="status" aria-live="polite">
            {status}
          </p>
          <div className="space-turn__row">
            <div className="space-turn__dice">
              {dice ? <Dice values={dice.values} rolling={dice.rolling} calm={lessMotion} /> : <DieFace value={6} />}
              {dice && <span className="space-turn__who">{seats[dice.seat]?.isStudent ? 'You' : seats[dice.seat]?.name}</span>}
            </div>
            {ring && (
              <span
                className={`space-timer${turnSeat === mySeat ? ' is-mine' : ''}`}
                style={{ '--left': `${(secondsLeft! / RING_SECONDS) * 360}deg` } as CSSProperties}
                aria-hidden="true"
              >
                {secondsLeft}
              </span>
            )}
            {finished ? (
              <button type="button" className="button button--primary space-roll" onClick={() => setShowPodium(true)}>
                🏆 Places
              </button>
            ) : onAutopilot ? (
              <button
                type="button"
                className="button button--play space-roll"
                disabled={busy}
                onClick={() => void act({ action: 'take-controls', gameId: game.id })}
              >
                🕹️ Take the controls
              </button>
            ) : (
              <button type="button" className="button button--play space-roll" disabled={!canRoll || answerFirst} onClick={roll} aria-keyshortcuts="Space">
                {answerFirst ? (
                  ANSWER_FIRST_BUTTON
                ) : (
                  <>
                    🎲 {view.turnInfo.rollAgainUsed && myTurn && !view.turnInfo.rolled ? 'Roll again' : 'Roll'}
                    {chargeWaiting && ` without the +${MATHS_CHARGE_STEPS}`}
                  </>
                )}
              </button>
            )}
          </div>
          {onAutopilot && !finished && (
            <p className="space-panel__empty">
              You ran out of time 3 times, or left. Take the controls to keep playing for fun: this game won’t earn you points.
            </p>
          )}
          {(hint || (session.message && !showPodium)) && (
            <p className="chess-note" role="alert">
              {hint || session.message}
            </p>
          )}

          {pending && pending.kind !== 'question' && me && <Choice pending={pending} items={me.items} onChoose={choose} disabled={busy} />}
          {picking && (
            <ItemPicker
              picking={picking}
              targets={targets}
              seats={seats}
              positions={positions}
              onTarget={(seat) => useItem(picking.item, { target: seat })}
              onNumber={(n) => useItem('navigator', { value: n })}
              onCancel={() => setPicking(null)}
            />
          )}
          {cosmic && me && <ItemTiles items={me.items} usable={(item) => usable.includes(item) && !picking && !busy} onUse={chooseItem} />}
        </section>

        {mathsOn && playing && !onAutopilot && !left && (
          view.turnInfo.mathsCharge && myTurn ? (
            <section className="space-panel space-charge" aria-label="Mission Control charge">
              <p className="space-charge__note" role="status">
                ⚡ +{MATHS_CHARGE_STEPS} charged from your answer
              </p>
            </section>
          ) : charge && charge.turns === myTurns && !(myTurn && view.turnInfo.rolled) ? (
            charge.right ? (
              <section className="space-panel space-charge" aria-label="Mission Control charge">
                <p className="space-charge__note" role="status">
                  ⚡ Right! +{MATHS_CHARGE_STEPS} is ready for your next roll
                </p>
              </section>
            ) : charge.right === undefined ? (
              <section className="space-panel space-charge" aria-label="Mission Control question">
                <QuestionModal
                  inline
                  key={`${charge.turns}-${charge.question.id}`}
                  question={charge.question}
                  title="Mission Control"
                  note={`Answer for +${MATHS_CHARGE_STEPS} on your next roll. It’s up to you.`}
                  onSubmit={(answer, ms) =>
                    markWith({ action: 'answer', gameId: game.id, kind: 'charge', answer, ms }, charge.question)
                  }
                  onDone={(result: MarkedAnswer) => setCharge({ ...charge, right: result.correct })}
                  onClose={() => setCharge(null)}
                  closeLabel="Skip"
                  timeScale={timeScale}
                />
              </section>
            ) : null
          ) : null
        )}

        <RocketsPanel view={view} seats={seats} positions={positions} turnSeat={turnSeat} over={finished} note={note} />

        {reactionsOn && playing && mySeat >= 0 && (
          <section className="space-panel space-reactions" aria-label="Reactions">
            <div className="space-reactions__row" role="group" aria-label="Send a reaction" onKeyDown={arrowKeys}>
              {REACTIONS.map((emoji: Reaction) => (
                <button
                  key={emoji}
                  type="button"
                  className="space-reaction"
                  disabled={!canReact || reactionWait || hideReactions}
                  onClick={() => {
                    setReactedAt(Date.now());
                    setTimeout(() => setReactedAt(0), REACTION_GAP_SECONDS * 1000);
                    void act({ action: 'react', gameId: game.id, emoji });
                  }}
                  aria-label={`Send ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
              <button
                type="button"
                className="space-reaction space-reaction--hide"
                onClick={toggleHideReactions}
                aria-pressed={hideReactions}
                title={hideReactions ? 'Show reactions' : 'Hide reactions'}
                aria-label={hideReactions ? 'Show reactions' : 'Hide reactions'}
              >
                🙈
              </button>
            </div>
          </section>
        )}

        <section className="space-panel space-log" aria-labelledby="space-log-title">
          <h2 id="space-log-title" className="space-panel__title">
            Mission log <span>{session.live === 'live' ? 'Live' : 'Reconnecting…'}</span>
          </h2>
          <MissionLog lines={log} />
        </section>

        {confirmLeave ? (
          <div className="chess-confirm" role="group" aria-label="Are you sure?">
            <p>Leave the game? Autopilot will fly your rocket, and this game won’t earn you points.</p>
            <div className="chess-actions">
              <button
                type="button"
                className="button button--danger"
                disabled={busy}
                onClick={() => void act({ action: 'leave', gameId: game.id }).then(() => setConfirmLeave(false))}
              >
                Yes, leave
              </button>
              <button type="button" className="button button--light" onClick={() => setConfirmLeave(false)} autoFocus>
                Keep playing
              </button>
            </div>
          </div>
        ) : (
          <div className="space-actions">
            {playing && !left && (
              <button type="button" className="space-action" onClick={() => setConfirmLeave(true)}>
                Leave game
              </button>
            )}
            <button type="button" className="space-action" onClick={() => setLessMotion(!lessMotion)} aria-pressed={lessMotion}>
              {lessMotion ? '✓ Less motion' : 'Less motion'}
            </button>
            <button type="button" className="space-action" onClick={() => setGuide('how')} aria-keyshortcuts="?">
              How to play
            </button>
            <Link to="/lobby" className="space-action">
              Lobby
            </Link>
          </div>
        )}
      </aside>
      {moment && (
        <QuestionModal
          key={moment.question.id}
          question={moment.question}
          title={MOMENT_TITLE[moment.moment]}
          note={MOMENT_NOTE[moment.moment]}
          onSubmit={(answer, ms) => {
            setMoment((m) => (m ? { ...m, submitted: true } : m));
            return markWith(
              { action: 'answer', gameId: game.id, kind: 'moment', version: moment.version, answer, ms },
              moment.question,
            );
          }}
          onDone={() => setMoment(null)}
          timeScale={timeScale}
          secondsLeft={moment.submitted ? null : Math.max(0, Math.ceil((moment.endsAt - now) / 1000))}
        />
      )}
      {guide && <SpaceGuide tab={guide} onClose={() => setGuide(null)} />}
    </div>
  );
}
