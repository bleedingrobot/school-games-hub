/**
 * Wormholes & Black Holes against 1–3 bots, played on this device from a seed.
 *
 * The rules engine decides everything. This screen only shows what happened: each action
 * gives a list of events, and they're played one at a time (dice, hops, wormholes, items…)
 * before the next action. Rocket positions on screen come from the events, and the panels
 * catch up with the engine's state at the end of each list.
 *
 * Saving: with `saving`, each game is played from a stamped seed the server hands out, and
 * at the end the student's actions go back to the server, which replays the game before
 * saving it (shared/space/save.ts). No seed (no Wi-Fi, or the stand-alone preview) means a
 * practice game that isn't saved.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { randomAvatar } from '../../avatar/avatarParts';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import { useSound } from '../../sound';
import type { BotLevel } from '../../../shared/botGame';
import type { FactStats } from '../../../shared/maths/leitner';
import type { Question } from '../../../shared/maths/skillPack';
import { currentFocus, focusKey, focusNote, type MathsFocus } from '../../../shared/maths/focus';
import type { SkillPack } from '../../../shared/maths/skillPack';
import { TimesTables } from '../../../shared/maths/skillPacks/timesTables';
import { BOT_NAMES } from '../../../shared/space/bot';
import {
  canCharge,
  itemProblem,
  SpaceRuleError,
  usableItems,
  validTargets,
  type SpaceAction,
  type SpaceEvent,
} from '../../../shared/space/engine';
import { ITEMS, type ItemKind } from '../../../shared/space/items';
import { makeSpacePack, pickSpaceQuestion } from '../../../shared/space/mathsQuestion';
import { randomFromSeed } from '../../../shared/space/random';
import { encodeAction, type SpaceGameReport } from '../../../shared/space/save';
import { startSpaceBot, type SpaceBot } from './botThread';
import { Dice, DieFace } from './Dice';
import { BoardOverlays, Choice, ItemPicker, ItemTiles, MissionLog, Podium, RocketsPanel, type Picking } from './parts';
import { SpaceGuide, type GuideTab } from './Guide';
import { loadLessMotion, loadPrefs, mathsOn, passNames, saveLessMotion, savePrefs, setupFrom, SPEED_SCALE, type MathsMode, type SpacePrefs } from './prefs';
import { SpaceBoard, type Seat } from './SpaceBoard';
import { SpaceSettings } from './SpaceSettings';
import { botPlay, botQuestion, decideBot, isStudentsTurn, newSeed, startPassRun, startRun, studentPlay, type SoloRun } from './soloRun';
import { choiceQuestion, itemName, ORDINAL, SEAT_COLOURS, SEAT_SHAPES, squareInfo, type SquareInfo } from './text';
import { useEventPlayer, type Batch } from './useEventPlayer';
import './space.css';

export interface SpacePlayer {
  name: string;
  avatar: unknown;
}

/** How games get saved. Left out (the preview), every game is a practice game. */
export interface SpaceSaving {
  /** A stamped seed from the server, or null if there isn't one to be had. */
  seed(maths: boolean): Promise<{ seed: string; stamp: string } | null>;
  /** Saves a finished game. Throws an error with a message for the student if it can't. */
  save(report: SpaceGameReport): Promise<{ countsForPoints?: boolean } | void>;
  /** Records a game the student left part-way, even while the page is closing. */
  abandon(report: SpaceGameReport): void;
}

/** Mission Control maths: what the teacher allows, the question settings and the student's records. */
export interface SpaceMaths {
  mode: MathsMode;
  enabledTables: number[];
  division: boolean;
  missingFactor?: boolean;
  multipleChoice: boolean;
  /** The student's maths records (times tables, and early facts, adding and division for a focus), so the questions fit what they're learning. */
  facts: FactStats[];
  /** The maths focus when the page opened. Auto, or missing, is the times-table step the student is ready for, as always. */
  focus?: MathsFocus;
  /** Asks for the focus again. It is asked as a new game starts, so a change shows up in the next game and never halfway through one. */
  refreshFocus?: () => Promise<MathsFocus>;
}

const MOMENT_TITLE = { wormhole: 'Wormhole boost', 'black-hole': 'Black hole escape' } as const;
const MOMENT_NOTE = {
  wormhole: 'A right answer flies you 3 squares further.',
  'black-hole': 'A right answer means you only fall half as far.',
} as const;

/** The question on the side card after your turn: waiting to be answered, or answered and waiting for your next turn. */
interface ChargeCard {
  question: Question;
  done?: { right: boolean; answer: number; ms: number; at: number };
}

const isOver = (run: SoloRun) => run.state.phase === 'over';

type SaveStatus = 'practice' | 'playing' | 'saving' | 'saved' | 'saved-no-points' | 'error';

const CALLSIGNS = ['Kea', 'Tūī', 'Weka'];
/** Bots think for about a second (Normal speed). */
const BOT_THINK_MS = { min: 800, extra: 400 };

type Phase = 'animating' | 'thinking' | 'student' | 'over';

interface Game {
  key: number;
  seats: Seat[];
  studentSeat: number;
  level: BotLevel;
  /** People taking turns on this device: never saved. */
  pass: boolean;
}

/** A queued list of events, and whose they are (for fact cards in pass-and-play). */
type Queued = Batch & { me?: number };

function makeSeats(run: SoloRun, player: SpacePlayer, level: BotLevel, names: string[]): Seat[] {
  if (run.passAndPlay) {
    return run.state.rockets.map((_, i) => ({
      colour: SEAT_COLOURS[i],
      shape: SEAT_SHAPES[i],
      isStudent: false,
      name: names[i],
      avatar: i === 0 && names[0] === player.name ? player.avatar : randomAvatar(randomFromSeed(`${run.setup.seed}:avatar:${i}`)),
    }));
  }
  let bot = 0;
  return run.state.rockets.map((_, i) => {
    const isStudent = i === run.studentSeat;
    const base = { colour: SEAT_COLOURS[i], shape: SEAT_SHAPES[i], isStudent };
    if (isStudent) return { ...base, name: player.name, avatar: player.avatar };
    const callsign = CALLSIGNS[bot++];
    return { ...base, name: `${BOT_NAMES[level]} ${callsign}`, avatar: randomAvatar(randomFromSeed(`${run.setup.seed}:avatar:${i}`)) };
  });
}

export function SpaceSolo({
  player,
  level,
  onLevelChange,
  saving,
  maths,
  timeScale = 1,
}: {
  player: SpacePlayer;
  level: BotLevel;
  onLevelChange: (level: BotLevel) => void;
  saving?: SpaceSaving;
  /** Mission Control maths. Left out: no maths. */
  maths?: SpaceMaths;
  /** Tests set this to 0 so animations don't wait. */
  timeScale?: number;
}) {
  const { soundOn } = useSound();
  const [prefs, setPrefsState] = useState<SpacePrefs>(loadPrefs);
  const [lessMotion, setLessMotionState] = useState(loadLessMotion);
  const [problem, setProblem] = useState('');
  const [game, setGame] = useState<Game | null>(null);
  const [phase, setPhaseState] = useState<Phase>('animating');
  const [picking, setPicking] = useState<Picking | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showPodium, setShowPodium] = useState(false);
  const [info, setInfo] = useState<({ n: number } & SquareInfo) | null>(null);
  const [guide, setGuide] = useState<GuideTab | null>(null);
  const [hint, setHint] = useState('');
  const [starting, setStarting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('practice');
  const [saveMessage, setSaveMessage] = useState('');

  // The student's records for the questions, kept for the visit so they carry from game to game.
  // Pass-and-play gets a fresh pack each game: nobody's records, and nothing is saved.
  const [packFocus, setPackFocus] = useState<MathsFocus>(() => currentFocus(maths?.focus));
  const [pack, setPack] = useState<SkillPack>(() => makeSpacePack(maths?.facts ?? [], packFocus, maths));
  const passPack = useRef<SkillPack | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [charge, setCharge] = useState<ChargeCard | null>(null);
  const mathsMode: MathsMode = maths?.mode ?? 'off';

  const runRef = useRef<SoloRun | null>(null);
  const gameRef = useRef<Game | null>(null);
  const keyRef = useRef(0);
  const queue = useRef<Queued[]>([]);
  const pumpingFor = useRef<number | null>(null);
  const phaseRef = useRef<Phase>('animating');
  const botRef = useRef<SpaceBot | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const live = useRef({ scale: 1, calm: false, sound: false });
  const screen = useEventPlayer(live);
  const { view, setView, rockets, turnSeat, setTurnSeat, dice, log, toast, banner, fact, setFact } = screen;
  /** The current game's stamp; null for a practice game. */
  const stampRef = useRef<string | null>(null);
  /** Seeds already sent to the server (finished or left), so nothing is sent twice. */
  const sentRef = useRef(new Set<string>());
  const startingRef = useRef(false);
  live.current = { scale: SPEED_SCALE[prefs.speed] * timeScale, calm: lessMotion, sound: soundOn };

  useEffect(() => {
    botRef.current = startSpaceBot();
    return () => {
      keyRef.current++; // stops any game still animating
      botRef.current?.close();
      botRef.current = null;
    };
  }, []);

  function reportFor(run: SoloRun, ending: SpaceGameReport['ending']): SpaceGameReport | null {
    const stamp = stampRef.current;
    if (!stamp) return null;
    const { seed, board, settings, bots, level: botLevel } = run.setup;
    return {
      game: 'space', seed, stamp, board, settings, bots, level: botLevel, actions: run.studentActions.map(encodeAction), ending,
      ...(run.mathsAnswers.length > 0 ? { answers: run.mathsAnswers } : {}),
    };
  }

  /** Saves the game once the rules engine says it's over (before the animations finish). */
  async function saveFinished(run: SoloRun) {
    const report = reportFor(run, 'finished');
    if (!saving || !report || sentRef.current.has(report.seed)) return;
    sentRef.current.add(report.seed);
    const mine = runRef.current === run;
    if (mine) setSaveStatus('saving');
    try {
      const answer = await saving.save(report);
      if (runRef.current === run) setSaveStatus(answer && answer.countsForPoints === false ? 'saved-no-points' : 'saved');
    } catch (error) {
      if (runRef.current !== run) return;
      setSaveMessage(error instanceof Error && error.message ? error.message : 'We couldn’t save this game.');
      setSaveStatus('error');
    }
  }

  /** If the student leaves a game part-way (after doing something), it's recorded as left early. */
  const leftEarly = useRef(() => {});
  leftEarly.current = () => {
    const run = runRef.current;
    if (!saving || !run || run.state.phase === 'over' || run.studentActions.length === 0) return;
    const report = reportFor(run, 'abandoned');
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

  function setPrefs(next: SpacePrefs) {
    setPrefsState(next);
    savePrefs(next);
  }
  function setLessMotion(on: boolean) {
    setLessMotionState(on);
    saveLessMotion(on);
  }
  function setPhase(next: Phase) {
    phaseRef.current = next;
    setPhaseState(next);
  }
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms * live.current.scale));

  async function animate(batch: Queued, key: number) {
    const g = gameRef.current!;
    const me = g.pass ? (batch.me ?? null) : g.studentSeat;
    await screen.animate(batch, { names: g.seats.map((seat) => seat.name), me }, () => key === keyRef.current);
  }

  /** Plays queued events, then the bots, until it's the student's turn or the game ends. */
  async function pump() {
    const key = keyRef.current;
    if (pumpingFor.current === key) return;
    pumpingFor.current = key;
    try {
      for (;;) {
        if (key !== keyRef.current) return;
        const batch = queue.current.shift();
        if (batch) {
          setPhase('animating');
          await animate(batch, key);
          continue;
        }
        const run = runRef.current!;
        if (run.state.phase === 'over') {
          void saveFinished(run);
          setPhase('over');
          setTurnSeat(null);
          await wait(400);
          if (key === keyRef.current) setShowPodium(true);
          return;
        }
        if (isStudentsTurn(run)) {
          setPhase('student');
          return;
        }
        setPhase('thinking');
        const started = Date.now();
        botRef.current ??= startSpaceBot();
        const question = botQuestion(run);
        const answer = await botRef.current.decide(question);
        const think = (BOT_THINK_MS.min + Math.random() * BOT_THINK_MS.extra) * Math.min(1, live.current.scale);
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, think - (Date.now() - started))));
        if (key !== keyRef.current) return;
        let events: SpaceEvent[];
        try {
          events = botPlay(run, answer);
        } catch {
          // Something went wrong with the worker's answer: think again on the page.
          events = botPlay(run, decideBot(question));
        }
        queue.current.push({ events, state: run.state });
        if (isOver(run)) void saveFinished(run);
      }
    } finally {
      if (pumpingFor.current === key) pumpingFor.current = null;
    }
  }

  // ---------- Starting and acting ----------

  async function start() {
    if (startingRef.current) return;
    const setup = setupFrom(prefs, mathsOn(mathsMode, prefs));
    if ('problem' in setup) {
      setProblem(setup.problem);
      return;
    }
    leftEarly.current();
    const pass = prefs.who === 'pass';
    // A new game follows the focus as it is now (a teacher may have set or ended one since the last game).
    if (maths?.refreshFocus && !pass) {
      const latest = await Promise.race([maths.refreshFocus().catch(() => null), new Promise<null>((done) => window.setTimeout(() => done(null), 1500))]);
      const next = currentFocus(latest ?? packFocus);
      if (focusKey(next) !== focusKey(packFocus)) {
        setPack(makeSpacePack(pack.stats(), next, maths));
        setPackFocus(next);
      }
    }
    let stamped: { seed: string; stamp: string } | null = null;
    if (saving && !pass) {
      startingRef.current = true;
      setStarting(true);
      keyRef.current++; // stops the old game while the seed comes
      stamped = await saving.seed(!!setup.settings.maths).catch(() => null);
      startingRef.current = false;
      setStarting(false);
    }
    let started: ReturnType<typeof startRun>;
    try {
      const seed = stamped?.seed ?? newSeed();
      started = pass
        ? startPassRun({ seed, board: setup.board, settings: setup.settings }, prefs.players)
        : startRun({ seed, board: setup.board, settings: setup.settings, bots: prefs.bots, level });
    } catch {
      setProblem('We couldn’t make that galaxy. Try another code.');
      return;
    }
    stampRef.current = stamped?.stamp ?? null;
    passPack.current = pass ? new TimesTables() : null;
    setQuestion(null);
    setCharge(null);
    setSaveStatus(stamped ? 'playing' : 'practice');
    setSaveMessage('');
    const { run, events } = started;
    const key = ++keyRef.current;
    const next: Game = {
      key,
      seats: makeSeats(run, player, level, passNames(prefs, player.name)),
      studentSeat: run.studentSeat,
      level,
      pass,
    };
    runRef.current = run;
    gameRef.current = next;
    queue.current = [{ events, state: run.state }];
    screen.reset(run.state);
    setProblem('');
    setGame(next);
    setPicking(null);
    setConfirming(false);
    setShowPodium(false);
    setInfo(null);
    setHint('');
    window.scrollTo({ top: 0 });
    void pump();
  }

  function leave() {
    leftEarly.current();
    keyRef.current++;
    runRef.current = null;
    gameRef.current = null;
    setCharge(null);
    setGame(null);
    setView(null);
  }

  function act(action: SpaceAction) {
    const run = runRef.current;
    if (!run || phaseRef.current !== 'student') return;
    const seat = run.state.turn;
    let events: SpaceEvent[];
    try {
      events = studentPlay(run, action);
    } catch (error) {
      if (error instanceof SpaceRuleError) {
        setHint(error.message);
        return;
      }
      throw error;
    }
    setPhase('animating');
    setHint('');
    setPicking(null);
    setInfo(null);
    // Rolling closes an unanswered question (skipped: nothing happens). When your turn ends, a new one opens.
    if (action.kind === 'roll') setCharge(null);
    if (run.state.settings.maths && !run.passAndPlay && seat === run.studentSeat && run.state.turn !== seat && run.state.phase !== 'over') {
      const q = pickQuestion();
      setCharge(q ? { question: q } : null);
    }
    queue.current.push({ events, state: run.state, me: seat });
    void pump();
  }

  function chooseItem(item: ItemKind) {
    const run = runRef.current;
    if (!run || phaseRef.current !== 'student') return;
    const problem = itemProblem(run.state, item);
    if (problem) {
      setHint(problem);
      return;
    }
    if (ITEMS[item].targeted) setPicking({ item, kind: 'target' });
    else if (item === 'navigator') setPicking({ item, kind: 'navigator' });
    else act({ kind: 'use-item', item });
  }

  // Keyboard: Space/Enter rolls, 1–3 use items, Escape closes things.
  const keys = useRef<(event: KeyboardEvent) => void>(() => {});
  keys.current = (event: KeyboardEvent) => {
    if (!game || !view) return;
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
      else if (confirming) setConfirming(false);
      else if (showPodium) setShowPodium(false);
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const myTurn = phaseRef.current === 'student';
    if (event.key === ' ' || event.key === 'Enter') {
      if (target?.closest('button, a, summary')) return;
      if (myTurn && view.phase === 'ready' && !picking) {
        event.preventDefault();
        act({ kind: 'roll' });
      }
      return;
    }
    if (!/^[1-6]$/.test(event.key) || !myTurn) return;
    const n = Number(event.key);
    if (picking?.kind === 'navigator') {
      event.preventDefault();
      act({ kind: 'use-item', item: 'navigator', value: n });
    } else if (view.phase === 'choice' && view.pending) {
      const kind = view.pending.kind;
      if ((kind === 'mystery' && n <= 3) || (kind === 'binary' && n <= 2)) {
        event.preventDefault();
        act({ kind: 'choose', option: n - 1 });
      }
    } else if (view.phase === 'ready' && !picking && n <= 3) {
      const g = gameRef.current!;
      const item = view.rockets[g.pass ? view.turn : g.studentSeat].items[n - 1];
      if (item) {
        event.preventDefault();
        chooseItem(item);
      }
    }
  };
  useEffect(() => {
    if (!game) return;
    const onKey = (event: KeyboardEvent) => keys.current(event);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game]);

  // When a choice or a picker opens, put keyboard focus on its first button.
  const choiceKey = phase === 'student' && view ? `${view.turnsTaken}:${view.phase}:${view.pending?.kind ?? ''}:${picking?.item ?? ''}` : '';
  useEffect(() => {
    if (!choiceKey) return;
    panelRef.current?.querySelector<HTMLButtonElement>('.space-choice button')?.focus({ preventScroll: true });
  }, [choiceKey]);

  // A Mission Control question: picked when it's asked (from this student's records), dropped when answered.
  const askingKey =
    phase === 'student' && view?.phase === 'choice' && view.pending?.kind === 'question'
      ? `${view.turnsTaken}:${view.pending.moment ?? 'wormhole'}:${view.pending.square}`
      : '';
  useEffect(() => {
    if (!askingKey) {
      setQuestion(null);
      return;
    }
    setQuestion(pickQuestion());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askingKey]);

  // An answered charge question is sent as soon as your next turn starts (before you roll).
  useEffect(() => {
    const run = runRef.current;
    const done = charge?.done;
    if (!run || !charge || !done || phase !== 'student' || run.passAndPlay || !canCharge(run.state)) return;
    run.mathsAnswers.push({ parts: charge.question.parts, given: done.answer, ms: done.ms, at: done.at, key: charge.question.factKey });
    setCharge(null);
    act({ kind: 'charge', right: done.right });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charge, phase]);
  const answered = useRef<{ answer: number; ms: number } | null>(null);

  /** The next question for this student, from their records at the step they're ready for. */
  function pickQuestion(): Question | null {
    return pickSpaceQuestion(passPack.current ?? pack, maths);
  }

  // ---------- Settings screen ----------

  if (!game || !view) {
    return (
      <>
      <SpaceSettings
        onHelp={setGuide}
        prefs={prefs}
        onChange={setPrefs}
        level={level}
        onLevelChange={onLevelChange}
        lessMotion={lessMotion}
        onLessMotion={setLessMotion}
        problem={problem}
        onStart={() => void start()}
        starting={starting}
        saving={!!saving}
        playerName={player.name}
        mathsMode={mathsMode}
        focusNote={focusNote(packFocus)}
      />
      {guide && <SpaceGuide tab={guide} onClose={() => setGuide(null)} />}
      </>
    );
  }

  // ---------- The game ----------

  const { seats, pass } = game;
  // In pass-and-play, "me" is whoever's turn it is.
  const studentSeat = pass ? view.turn : game.studentSeat;
  const me = view.rockets[studentSeat];
  const who = pass ? seats[studentSeat].name : 'You';
  const myTurn = phase === 'student';
  const pending = myTurn && view.phase === 'choice' ? view.pending : null;
  const canRoll = myTurn && view.phase === 'ready' && !picking;
  const usable = myTurn && view.phase === 'ready' ? usableItems(view, studentSeat) : [];
  const targets = myTurn && picking?.kind === 'target' ? validTargets(view, picking.item, studentSeat) : [];
  const positions = rockets.map((r) => r.pos);
  const cosmic = view.settings.mode === 'cosmic';
  const over = view.phase === 'over' && phase === 'over';
  const places = view.places ?? [];

  const winner = seats[places.indexOf(1)]?.name ?? '';
  let status: string;
  if (over && pass) status = `${winner} won! 🏆`;
  else if (over) {
    const place = places[studentSeat];
    status = place === 1 ? 'You won! 🏆' : `You came ${ORDINAL[place]}.`;
  } else if (pending) status = pass ? `${who}: ${choiceQuestion(pending)}` : choiceQuestion(pending);
  else if (picking?.kind === 'target') status = `Who should the ${itemName(picking.item)} hit? Tap a rocket.`;
  else if (picking?.kind === 'navigator') status = 'Navigator: pick your roll.';
  else if (myTurn && view.turnInfo.rollAgainUsed && !view.turnInfo.rolled) status = `${who} rolled a 6: roll again!`;
  else if (myTurn && view.turnInfo.itemUsed) status = pass ? `${who}: now roll!` : 'Now roll!';
  else if (myTurn && pass) status = `${who}’s turn! ${usable.length > 0 ? 'Use an item, or roll.' : 'Roll the dice.'}`;
  else if (myTurn) status = usable.length > 0 ? 'Your turn! Use an item, or roll.' : 'Your turn! Roll the dice.';
  else if (phase === 'thinking' && turnSeat !== null) status = `${seats[turnSeat].name} is thinking…`;
  else if (turnSeat !== null && turnSeat !== studentSeat) status = `${seats[turnSeat].name}’s turn`;
  else status = 'Off you go…';

  const boardLabel = `${view.board.name} board, ${view.board.size} squares. ${seats
    .map((s, i) => `${s.isStudent ? 'You are' : `${s.name} is`} on square ${positions[i]}`)
    .join('. ')}.`;

  return (
    <div
      className={`space-game${lessMotion ? ' is-calm' : ''}`}
      style={{ '--rows': view.board.size / 10 } as CSSProperties}
    >
      <h1 className="sr-only">Wormholes &amp; Black Holes</h1>
      <div className="space-game__board">
        <SpaceBoard
          state={view}
          seats={seats}
          positions={positions}
          fx={rockets.map((r) => r.fx)}
          moveMs={rockets.map((r) => r.ms)}
          turn={over ? null : turnSeat}
          targets={targets}
          onTarget={(seat) => picking && act({ kind: 'use-item', item: picking.item, target: seat })}
          onSquare={(n) => setInfo(info?.n === n ? null : { n, ...squareInfo(view, n, seats.map((s) => s.name)) })}
          selected={info?.n ?? null}
          label={boardLabel}
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
        {over && showPodium && (
          <Podium
            seats={seats}
            places={places}
            mine={pass ? null : places[studentSeat]}
            ending={view.ending}
            saveNote={pass ? 'Pass-and-play games aren’t saved.' : saveNote(saveStatus, saveMessage, !!saving)}
            heading={
              pass
                ? {
                    title: view.ending === 'docked' ? `${winner} docked first!` : `${winner} got the furthest!`,
                    about:
                      view.ending === 'mission-clock'
                        ? 'The fuel ran out, so places go by how far everyone got.'
                        : 'First to the space station. Great flying, everyone!',
                  }
                : undefined
            }
          >
            <button type="button" className="button button--primary" onClick={() => void start()} autoFocus>
              Play again
            </button>
            <button type="button" className="button button--light" onClick={() => setShowPodium(false)}>
              Look at the board
            </button>
            <button type="button" className="link-button" onClick={leave}>
              Change settings
            </button>
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
              {dice && <span className="space-turn__who">{seats[dice.seat].isStudent ? 'You' : seats[dice.seat].name}</span>}
            </div>
            {over ? (
              <button type="button" className="button button--primary space-roll" onClick={() => setShowPodium(true)}>
                🏆 Places
              </button>
            ) : (
              <button
                type="button"
                className="button button--play space-roll"
                disabled={!canRoll}
                onClick={() => act({ kind: 'roll' })}
                aria-keyshortcuts="Space"
              >
                🎲 {view.turnInfo.rollAgainUsed && myTurn && !view.turnInfo.rolled ? 'Roll again' : 'Roll'}
              </button>
            )}
          </div>
          {hint && (
            <p className="chess-note" role="alert">
              {hint}
            </p>
          )}

          {pending && pending.kind !== 'question' && (
            <Choice pending={pending} items={me.items} onChoose={(option) => act({ kind: 'choose', option })} />
          )}

          {picking && (
            <ItemPicker
              picking={picking}
              targets={targets}
              seats={seats}
              positions={positions}
              onTarget={(seat) => act({ kind: 'use-item', item: picking.item, target: seat })}
              onNumber={(n) => act({ kind: 'use-item', item: 'navigator', value: n })}
              onCancel={() => setPicking(null)}
            />
          )}

          {cosmic && <ItemTiles items={me.items} usable={(item) => usable.includes(item) && !picking} onUse={chooseItem} />}
        </section>

        {view.settings.maths && !pass && !over && (view.turnInfo.mathsCharge && myTurn ? (
          <section className="space-panel space-charge" aria-label="Mission Control charge">
            <p className="space-charge__note" role="status">
              ⚡ +1 charged from your answer
            </p>
          </section>
        ) : (
          charge?.done?.right ? (
            <section className="space-panel space-charge" aria-label="Mission Control charge">
              <p className="space-charge__note" role="status">
                ⚡ Right! +1 is ready for your next roll
              </p>
            </section>
          ) : (
          charge && !charge.done && (
            <section className="space-panel space-charge" aria-label="Mission Control question">
              <QuestionModal
                inline
                key={charge.question.id}
                question={charge.question}
                title="Mission Control"
                note="Answer for +1 on your next roll. It’s up to you."
                onSubmit={(answer, ms) => {
                  answered.current = { answer, ms };
                  return pack.recordAnswer(charge.question, answer, ms);
                }}
                onDone={(result: MarkedAnswer) => {
                  const given = answered.current;
                  if (given) setCharge({ question: charge.question, done: { right: result.correct, answer: given.answer, ms: Math.round(given.ms), at: Date.now() } });
                  else setCharge(null);
                }}
                onClose={() => setCharge(null)}
                closeLabel="Skip"
                timeScale={timeScale}
              />
            </section>
          )
          )
        ))}

        <RocketsPanel view={view} seats={seats} positions={positions} turnSeat={turnSeat} over={over} />

        <section className="space-panel space-log" aria-labelledby="space-log-title">
          <h2 id="space-log-title" className="space-panel__title">
            Mission log <span>{pass ? 'Pass-and-play: not saved' : LOG_SAVE_NOTE[saveStatus]}</span>
          </h2>
          <MissionLog lines={log} />
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
          <div className="space-actions">
            {over ? (
              <button type="button" className="space-action is-main" onClick={() => void start()} disabled={starting}>
                {starting ? 'Getting ready…' : 'Play again'}
              </button>
            ) : (
              <button type="button" className="space-action" onClick={() => setConfirming(true)}>
                New game
              </button>
            )}
            <button type="button" className="space-action" onClick={() => setLessMotion(!lessMotion)} aria-pressed={lessMotion}>
              {lessMotion ? '✓ Less motion' : 'Less motion'}
            </button>
            <button type="button" className="space-action" onClick={() => setGuide('how')} aria-keyshortcuts="?">
              How to play
            </button>
            <button type="button" className="space-action" onClick={leave}>
              Settings
            </button>
          </div>
        )}
      </aside>
      {question && pending?.kind === 'question' && (
        <QuestionModal
          key={question.id}
          question={question}
          title={MOMENT_TITLE[pending.moment ?? 'wormhole']}
          note={MOMENT_NOTE[pending.moment ?? 'wormhole']}
          onSubmit={(answer, ms) => {
            answered.current = { answer, ms };
            return (passPack.current ?? pack).recordAnswer(question, answer, ms);
          }}
          onDone={(result: MarkedAnswer) => {
            const given = answered.current;
            const run = runRef.current;
            // The server checks every answer against the question shown (shared/space/save.ts).
            if (given && run && !run.passAndPlay) {
              run.mathsAnswers.push({ parts: question.parts, given: given.answer, ms: Math.round(given.ms), at: Date.now(), key: question.factKey });
            }
            setQuestion(null);
            act({ kind: 'choose', option: result.correct ? 1 : 0 });
          }}
          timeScale={timeScale}
        />
      )}
      {guide && <SpaceGuide tab={guide} onClose={() => setGuide(null)} />}
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
      return 'Saved! You earned points for taking part.';
    case 'saved-no-points':
      return 'Saved. That game was too short to earn points.';
    case 'error':
      return message;
  }
}
