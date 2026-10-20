/**
 * One run of one course: the picture, the clock, the controls and the pause / finish panels.
 *
 * The physics (shared/marble) moves in fixed 1/60-second steps whatever the screen is doing; this
 * file feeds it one input per step, writes the inputs down (so the run can be replayed exactly),
 * and asks the renderer to draw the latest state. Nothing is saved from here: it reports the finished
 * run through `onDone`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DT, MAX_GEM_BONUSES, RESCUE_GAP_STEPS } from '../../../shared/marble/config';
import type { Course } from '../../../shared/marble/course';
import { clockSteps, makeWorld, medalFor, newRun, stepRun, type ClockMode, type RunState } from '../../../shared/marble/engine';
import { BONUS, decodeInputs, inputPlayer, pushInput, REFUND } from '../../../shared/marble/inputs';
import { plainSetup, type PublicQuestion, type RunSetup } from '../../../shared/marble/maths';
import { QuestionModal, type MarkedAnswer, type ShownQuestion } from '../../maths/QuestionModal';
import { useSound } from '../../sound';
import { playSound } from '../sounds';
import { formatSteps } from './bests';
import { dragVector, KEYS_ARROWS, KEYS_LETTERS, KeyTracker, screenToCode } from './controls';
import { infoFor } from './courseInfo';
import { paletteFor } from './palette';
import { isGoodGuess } from './guess';
import { gateSigns, gemSprites } from './signs';
import type { MarbleView, OtherKind } from './renderer';

/** A recorded run to race against (from src/data/marble.ts). */
export interface GhostRun {
  name: string;
  steps: number;
  inputs: string;
  /** The shortcut doors that were open for that run (it only plays back with the same doors). */
  doors?: number[];
  /** The gems that were right for that run (they took time off, so playing it back needs them too). */
  gems?: number[];
}

export interface FinishedRun {
  courseId: string;
  mode: ClockMode;
  outcome: 'finished' | 'timeout';
  steps: number;
  falls: number;
  checkpoints: number;
  inputs: [number, number][];
  /** True if the run had maths questions (it counts on the with-maths board). */
  maths: boolean;
}

/** The server's mark for an answer (null if it could not be reached). */
export type Marker = (slot: number, answer: number, ms: number) => Promise<{ right: boolean; answer: number } | null>;

type Phase = 'loading' | 'ready' | 'playing' | 'reading' | 'question' | 'paused' | 'finished' | 'timeout' | 'broken';

/** How close (in tiles) the marble has to be to a gate's sign for its question to show. */
const SIGN_RANGE = 7;
/** How close to a number gem trail's gems its question shows. */
const GEM_RANGE = 8;
/** The longest the game waits for a student to read a gate, in milliseconds. */
const READ_TIME_MS = 10_000;

const shown = (q: PublicQuestion): ShownQuestion => ({ id: q.slot, parts: q.parts, spoken: q.spoken, choices: q.choices, choiceLabels: q.choiceLabels, maxLength: q.maxLength, input: q.input });
/** The words on a question, as one line. */
const questionText = (q: PublicQuestion) => q.parts.map((p) => (p === '?' ? '…' : p)).join(' ');

const MEDAL = { gold: '🥇 Gold', silver: '🥈 Silver', bronze: '🥉 Bronze' } as const;
const DEAD_ZONE = 14;

const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const isCoarse = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export function RunScreen({
  course,
  mode,
  best,
  canTryHard,
  ghost,
  twoPlayer = false,
  setup: givenSetup,
  readTime = false,
  onAnswer,
  onDone,
  onAgain,
  onHard,
  onExit,
}: {
  course: Course;
  mode: ClockMode;
  /** The student's best time for this course and mode (clock steps), before this run. */
  best?: number;
  /** The "try hard mode" button is offered after a finish (the student has finished this course before). */
  canTryHard: boolean;
  /** A see-through marble that replays this recorded run. */
  ghost?: GhostRun | null;
  /** Two marbles on one keyboard: arrow keys and W A S D. Nothing is saved. */
  twoPlayer?: boolean;
  /** The open doors, gates and questions for this run (from the server). Without one: arrows, and no maths. */
  setup?: RunSetup;
  /** Pause when a gate's question comes into view, until the student presses Go. */
  readTime?: boolean;
  /** Marks a pit-stop answer on the server. */
  onAnswer?: Marker;
  onDone: (run: FinishedRun) => { isBest: boolean };
  onAgain: () => void;
  onHard: () => void;
  onExit: () => void;
}) {
  const { soundOn } = useSound();
  // A run with no setup from the server (offline) is a plain one: arrows at the gates, with the doors chosen here.
  const setup = useMemo(() => givenSetup ?? plainSetup(course), [givenSetup, course]);
  const answerRef = useRef(onAnswer);
  answerRef.current = onAnswer;
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const time2Ref = useRef<HTMLSpanElement>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const phaseRef = useRef<Phase>('loading');
  const [falls, setFalls] = useState(0);
  const [checkpoints, setCheckpoints] = useState(0);
  const [announce, setAnnounce] = useState('');
  const [banner, setBanner] = useState<{ kind: 'gate' | 'gems'; question: PublicQuestion } | null>(null);
  const [ask, setAsk] = useState<{ slot: number; question: PublicQuestion; kind: 'pit' | 'quick' | 'rescue'; off: string } | null>(null);
  // "Guess your time" (maths only, never saved): what the student typed, and how it turned out.
  const [guess, setGuess] = useState('');
  const guessRef = useRef('');
  guessRef.current = guess;
  const [guessResult, setGuessResult] = useState<{ guess: number; star: boolean } | null>(null);
  const [toast, setToast] = useState('');
  const resumeRef = useRef<() => void>(() => {});
  const closeAskRef = useRef<(right: boolean) => void>(() => {});
  const askKindRef = useRef<'pit' | 'quick' | 'rescue'>('pit');
  const askOffRef = useRef('');
  const [result, setResult] = useState<{ steps: number; medal: keyof typeof MEDAL | null; isBest: boolean; falls: number; ghost?: 'beat' | 'lost' | 'tie'; winner?: 1 | 2 | 0 } | null>(null);
  const [stickSide, setStickSide] = useState<'left' | 'right'>('right');
  const [showStick, setShowStick] = useState(isCoarse);
  const keys = useRef(new KeyTracker(twoPlayer ? KEYS_ARROWS : undefined));
  const keys2 = useRef(new KeyTracker(KEYS_LETTERS));
  const pointerPush = useRef<[number, number] | null>(null);
  const stickPush = useRef<[number, number] | null>(null);
  const dragStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const restartRef = useRef<() => void>(() => {});

  const goto = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    let disposed = false;
    let raf = 0;
    let view: MarbleView | null = null;
    const world = makeWorld(course, { mode, openDoors: setup.doors, rightGems: setup.rightGems });
    let state: RunState = newRun(world);
    let prev: RunState = { ...state };
    // A ghost and a second player each have a world and a run of their own, stepped together with ours.
    const ghostRuns = ghost && !twoPlayer ? decodeInputs(ghost.inputs) : null;
    const ghostWorld = ghostRuns ? makeWorld(course, { mode, openDoors: ghost?.doors ?? [], rightGems: ghost?.gems ?? [] }) : null;
    let ghostState: RunState | null = ghostWorld ? newRun(ghostWorld) : null;
    let ghostPrev: RunState | null = ghostState ? { ...ghostState } : null;
    let ghostNext = ghostRuns ? inputPlayer(ghostRuns) : null;
    const world2 = twoPlayer ? makeWorld(course, { mode, openDoors: setup.doors, rightGems: setup.rightGems }) : null;
    let state2: RunState | null = world2 ? newRun(world2) : null;
    let prev2: RunState | null = state2 ? { ...state2 } : null;
    const kinds: OtherKind[] = [...(ghostWorld ? ['ghost' as const] : []), ...(world2 ? ['rival' as const] : [])];
    let runs: [number, number][] = [];
    let acc = 0;
    let last = performance.now();
    let slowFrames = 0;
    let frames = 0;
    let lowQuality = false;
    let skip = false;
    let lastFalls = 0;
    let lastChecks = 0;
    let lastPits = 0;
    let lastGems = 0;
    let rescuesAsked = 0;
    let lastRescueAt = -Infinity;
    let nearGate = -1;
    let nearTrail = -1;
    const read = new Set<number>();
    let readTimer = 0;
    let wasGrounded = true;
    let reported = false;
    const reduced = prefersReducedMotion();

    restartRef.current = () => {
      state = newRun(world);
      prev = { ...state };
      if (ghostWorld && ghostRuns) {
        ghostState = newRun(ghostWorld);
        ghostPrev = { ...ghostState };
        ghostNext = inputPlayer(ghostRuns);
      }
      if (world2) {
        state2 = newRun(world2);
        prev2 = { ...state2 };
      }
      runs = [];
      acc = 0;
      lastFalls = 0;
      lastChecks = 0;
      lastPits = 0;
      lastGems = 0;
      rescuesAsked = 0;
      lastRescueAt = -Infinity;
      nearGate = -1;
      nearTrail = -1;
      setGuessResult(null);
      read.clear();
      window.clearTimeout(readTimer);
      setBanner(null);
      setAsk(null);
      setToast('');
      wasGrounded = true;
      reported = false;
      setFalls(0);
      setCheckpoints(0);
      setResult(null);
      setAnnounce('');
      goto('ready');
    };

    const readInput2 = (): number => {
      const k = keys2.current;
      if (!k.any) return 0;
      const [x, y] = k.vector();
      return screenToCode(x, y);
    };

    const readInput = (): number => {
      const k = keys.current;
      if (k.any) {
        const [x, y] = k.vector();
        return screenToCode(x, y);
      }
      const push = stickPush.current ?? pointerPush.current;
      return push ? screenToCode(push[0], push[1]) : 0;
    };

    const say = (text: string) => setAnnounce(text);
    const beep = (s: Parameters<typeof playSound>[0]) => {
      if (soundRef.current) playSound(s);
    };

    // Two players: the first marble over the line wins. Nothing is saved.
    const finishTwo = () => {
      if (reported || !state2) return;
      reported = true;
      const one = state.outcome === 'finished' ? state.finishSteps : Infinity;
      const two = state2.outcome === 'finished' ? state2.finishSteps : Infinity;
      const winner = one === two ? 0 : one < two ? 1 : 2;
      setResult({ steps: Math.min(one, two), medal: null, isBest: false, falls: state.falls, winner });
      beep('win');
      say(winner === 0 ? 'A tie!' : `Player ${winner} wins!`);
      goto('finished');
    };

    const finish = () => {
      if (reported) return;
      reported = true;
      const finished = state.outcome === 'finished';
      const steps = finished ? state.finishSteps : state.steps + state.penalty;
      const { isBest } = onDone({
        courseId: course.def.id, mode, outcome: finished ? 'finished' : 'timeout', steps, falls: state.falls, checkpoints: state.checkpoints.length, inputs: runs, maths: setup.maths,
      });
      // Guess your time: within 10% of the real time is a star. Never saved.
      const wanted = Number(guessRef.current);
      if (finished && setup.maths && !twoPlayer && Number.isFinite(wanted) && wanted > 0) setGuessResult({ guess: wanted, star: isGoodGuess(wanted, steps / 60) });
      if (finished) {
        const ghostResult = ghost && ghostRuns ? (steps < ghost.steps ? 'beat' : steps > ghost.steps ? 'lost' : 'tie') : undefined;
        setResult({ steps, medal: mode === 'up' ? medalFor(course, steps, setup.maths) : null, isBest, falls: state.falls, ghost: ghostResult });
        beep('win');
        say(`Finished in ${formatSteps(steps)}.`);
        goto('finished');
      } else {
        setResult({ steps, medal: null, isBest: false, falls: state.falls });
        beep('end');
        say('Out of time. Try again!');
        goto('timeout');
      }
    };

    // A pit-stop question: the number pad over the course. A right answer takes a couple of seconds off (the BONUS input).
    // `off` is what a right answer takes off, in words ("2 seconds", "half a second").
    const openAsk = (q: PublicQuestion, kind: 'pit' | 'quick' | 'rescue', off = '') => {
      askKindRef.current = kind;
      askOffRef.current = off;
      setAsk({ slot: q.slot, question: q, kind, off });
      goto('question');
    };
    closeAskRef.current = (right: boolean) => {
      if (right) {
        const rescue = askKindRef.current === 'rescue';
        pushInput(runs, rescue ? REFUND : BONUS);
        prev = { ...state };
        stepRun(world, state, rescue ? REFUND : BONUS);
        const off = askOffRef.current.charAt(0).toUpperCase() + askOffRef.current.slice(1);
        setToast(rescue ? 'Right! No time lost for that fall' : `Right! ${off} off your time`);
        beep('item');
        say(rescue ? 'Right! The fall cost you no time.' : `Right! ${off} off your time.`);
        window.setTimeout(() => setToast(''), 2500);
      }
      setAsk(null);
      goto('playing');
    };
    resumeRef.current = () => {
      window.clearTimeout(readTimer);
      if (phaseRef.current === 'reading') goto('playing');
    };

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((t - last) / 1000, 0.1);
      last = t;
      if (!view) return;
      if (phaseRef.current === 'playing') {
        acc += dt;
        let n = 0;
        while (acc >= DT && n < 6 && state.outcome === 'running' && (!state2 || state2.outcome === 'running')) {
          prev = { ...state };
          const input = readInput();
          pushInput(runs, input);
          stepRun(world, state, input);
          if (ghostWorld && ghostState && ghostNext) {
            ghostPrev = { ...ghostState };
            if (ghostState.outcome === 'running') stepRun(ghostWorld, ghostState, ghostNext());
          }
          if (world2 && state2) {
            prev2 = { ...state2 };
            stepRun(world2, state2, readInput2());
          }
          acc -= DT;
          n++;
          if (state.falls > lastFalls) {
            lastFalls = state.falls;
            setFalls(lastFalls);
            beep('black-hole');
            say('You fell. Back on the track.');
            // A rescue question (if the teacher allows them): a right answer takes the fall's time back. Never more than one in twenty seconds of play.
            if (setup.rescue && !state2 && rescuesAsked < setup.rescues.length && state.steps - lastRescueAt >= RESCUE_GAP_STEPS) {
              lastRescueAt = state.steps;
              openAsk(setup.rescues[rescuesAsked++], 'rescue');
              break;
            }
          }
          if (state.checkpoints.length > lastChecks) {
            lastChecks = state.checkpoints.length;
            setCheckpoints(lastChecks);
            beep('item');
            say('Checkpoint!');
          }
          if (wasGrounded && !state.grounded && state.vz > 1) beep('hop');
          wasGrounded = state.grounded;
          // A new pit stop: the clock and the marble stop while the question is answered (the physics simply isn't stepped).
          if (setup.maths && !state2 && state.pitStops.length > lastPits) {
            const group = state.pitStops[lastPits];
            lastPits = state.pitStops.length;
            const q = setup.pits[group];
            if (q) {
              openAsk(q, course.pitKind[group] === 'c' ? 'pit' : 'quick', secondsOff(course.pitValue[group]));
              break;
            }
          }
          if (state.gemsTaken.length > lastGems) {
            lastGems = state.gemsTaken.length;
            beep('item');
            if (lastGems <= MAX_GEM_BONUSES) {
              setToast('Gem! 1 second off');
              say('Right gem. One second off your time.');
            } else {
              setToast(`That's ${MAX_GEM_BONUSES} gems, the most that count`);
            }
            window.setTimeout(() => setToast(''), 2000);
          }
        }
        if (n === 6) acc = 0;
        // The nearest gate whose tunnel hasn't been chosen yet, if its sign is close: its question shows, and the game can wait to be read.
        // (When no gate is near, a number-gem trail's question shows while the marble is among its gems.)
        if (setup.maths && !state2 && phaseRef.current === 'playing') {
          let near = -1;
          course.gates.forEach((gate, i) => {
            if (near >= 0 || state.gateChoices[i] >= 0) return;
            if ((gate.sign[0] + 0.5 - state.x) ** 2 + (gate.sign[1] + 0.5 - state.y) ** 2 < SIGN_RANGE * SIGN_RANGE) near = i;
          });
          let trail = -1;
          if (near < 0) {
            course.gems.forEach((t, i) => {
              if (trail >= 0) return;
              if (t.groups.some((g) => g.spots.some(([gx, gy]) => (gx - state.x) ** 2 + (gy - state.y) ** 2 < GEM_RANGE * GEM_RANGE) || (t.sign[0] + 0.5 - state.x) ** 2 + (t.sign[1] + 0.5 - state.y) ** 2 < SIGN_RANGE * SIGN_RANGE)) trail = i;
            });
          }
          if (trail !== nearTrail) {
            nearTrail = trail;
            if (near < 0) setBanner(trail >= 0 && setup.gems[trail] ? { kind: 'gems', question: setup.gems[trail].question } : null);
          }
          if (near !== nearGate) {
            nearGate = near;
            const gateQuestion = near >= 0 ? (setup.gates[near]?.question ?? null) : null;
            setBanner(gateQuestion ? { kind: 'gate', question: gateQuestion } : trail >= 0 && setup.gems[trail] ? { kind: 'gems', question: setup.gems[trail].question } : null);
            if (near >= 0 && readTime && !read.has(near)) {
              read.add(near);
              goto('reading');
              window.clearTimeout(readTimer);
              readTimer = window.setTimeout(() => phaseRef.current === 'reading' && goto('playing'), READ_TIME_MS);
            }
          }
        }
        if (state2) {
          if (state.outcome !== 'running' || state2.outcome !== 'running') finishTwo();
        } else if (state.outcome !== 'running') finish();
        // Slow device? After a couple of seconds, draw lighter. The physics doesn't change.
        frames++;
        if (frames > 30 && frames <= 150) {
          if (dt > 0.026) slowFrames++;
          if (frames === 150 && slowFrames > 60 && !lowQuality) {
            lowQuality = true;
            view.setLowQuality(true);
          }
        }
      }
      if (timeRef.current) {
        const steps = clockSteps(world, state);
        timeRef.current.textContent = formatSteps(steps);
      }
      if (time2Ref.current && world2 && state2) time2Ref.current.textContent = formatSteps(clockSteps(world2, state2));
      if (lowQuality && skip) {
        skip = false;
        return;
      }
      skip = lowQuality && phaseRef.current === 'playing';
      const others = [
        ...(ghostState && ghostPrev ? [{ prev: ghostPrev, now: ghostState }] : []),
        ...(state2 && prev2 ? [{ prev: prev2, now: state2 }] : []),
      ];
      view.draw(prev, state, phaseRef.current === 'playing' ? Math.min(1, acc / DT) : 1, dt, others);
    };

    const fit = () => {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      if (w > 0 && h > 0) view?.resize(w, h);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(stage);

    import('./renderer')
      .then(({ createView }) => {
        if (disposed) return;
        view = createView(canvas, course, world, paletteFor(course.def.id), reduced, kinds, gateSigns(course, setup), gemSprites(course, setup), setup.maths);
        fit();
        goto('ready');
        raf = requestAnimationFrame((t) => {
          last = t;
          frame(t);
        });
      })
      .catch(() => !disposed && goto('broken'));

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // A question has its own keys.
      if (phaseRef.current === 'question') return;
      const mine = keys.current.press(e.code);
      const second = twoPlayer && keys2.current.press(e.code);
      if (mine || second) {
        e.preventDefault();
        if (phaseRef.current === 'ready') goto('playing');
        else if (phaseRef.current === 'reading') resumeRef.current();
        return;
      }
      if ((e.code === 'Space' || e.code === 'Enter') && phaseRef.current === 'reading' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        resumeRef.current();
        return;
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (phaseRef.current === 'playing') goto('paused');
        else if (phaseRef.current === 'paused') goto('playing');
      } else if (e.code === 'KeyR' && ['playing', 'paused', 'ready'].includes(phaseRef.current)) restartRef.current();
      else if ((e.code === 'Space' || e.code === 'Enter') && phaseRef.current === 'ready' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        goto('playing');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current.release(e.code);
      keys2.current.release(e.code);
    };
    const onBlur = () => {
      keys.current.clear();
      keys2.current.clear();
      if (phaseRef.current === 'playing') goto('paused');
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    const onVisibility = () => document.visibilityState === 'hidden' && phaseRef.current === 'playing' && goto('paused');
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      keys.current.clear();
      keys2.current.clear();
      window.clearTimeout(readTimer);
      view?.dispose();
    };
    // The run is made once per course and mode; the callbacks it uses don't need to restart it.
  }, [course, mode, ghost, twoPlayer, setup, readTime]);

  // ---- dragging with a mouse, trackpad or finger ----
  const onPointerDown = (e: React.PointerEvent) => {
    // Tapping a button, the stick or the guess box (it sits on the course) must not start the run.
    if ((e.target as HTMLElement).closest('button, input, label, .marble-stick')) return;
    if (e.pointerType === 'touch') setShowStick(true);
    dragStart.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      // The pointer is already gone: nothing to hold on to.
    }
    if (phaseRef.current === 'ready') goto('playing');
    else if (phaseRef.current === 'reading') resumeRef.current();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragStart.current;
    if (!d || d.id !== e.pointerId) return;
    pointerPush.current = dragVector(e.clientX - d.x, e.clientY - d.y, DEAD_ZONE);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (dragStart.current?.id === e.pointerId) {
      dragStart.current = null;
      pointerPush.current = null;
    }
  };

  const mark = async (answer: number, ms: number): Promise<MarkedAnswer> => {
    const slot = ask?.slot ?? -1;
    const marker = answerRef.current;
    const reply = marker ? await marker(slot, answer, ms) : null;
    if (!reply) throw new Error('We couldn’t check that one. Try again, or skip it.');
    const q = ask?.question;
    const label = q?.choices && q.choiceLabels ? q.choiceLabels[q.choices.indexOf(reply.answer)] : String(reply.answer);
    return { correct: reply.right, fact: `The answer was ${label}.`, boxBefore: 0, boxAfter: 0, answer: reply.answer, ...(reply.right ? { reward: ask?.kind === 'rescue' ? 'No time lost!' : '2 seconds off!' } : {}) };
  };

  const info = infoFor(course.def.id);
  const hard = mode === 'down';
  const playing = phase === 'playing';

  return (
    <div className="marble-run">
      <div className="marble-hud">
        <div className="marble-hud__title">
          <strong>{info?.name ?? course.def.name}</strong>
          {hard && <span className="marble-hud__flame"> 🔥 Hard mode</span>}
          {twoPlayer && <span> · 2 players</span>}
          {ghost && !twoPlayer && <span> · 👻 {ghost.name} ({formatSteps(ghost.steps)})</span>}
        </div>
        <div className="marble-hud__clock" aria-label={hard ? 'Time left' : 'Time'}>
          {twoPlayer && <span aria-hidden="true">🔵 </span>}
          <span ref={timeRef}>0:00.00</span>
          {twoPlayer && (
            <>
              <span aria-hidden="true"> · 🟠 </span>
              <span ref={time2Ref} aria-label="Player 2 time">0:00.00</span>
            </>
          )}
        </div>
        <div className="marble-hud__stats">
          {twoPlayer ? <span>🔵 arrow keys · 🟠 W A S D</span> : <span>Falls: {falls}</span>}
          <span>Checkpoints: {checkpoints}</span>
        </div>
      </div>

      <div
        className="marble-stage"
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <canvas ref={canvasRef} className="marble-canvas" role="img" aria-label={`The ${info?.name ?? course.def.name} course, seen from above and to the side. Your marble is the blue and white ball.`} />

        {setup.maths && banner && phase !== 'ready' && phase !== 'question' && (
          <div className="marble-gate" role="status">
            <p className="marble-gate__question" aria-label={banner.question.spoken}>
              {banner.kind === 'gate' ? 'Gate' : 'Gems'}: <strong>{questionText(banner.question)}</strong>
            </p>
            <p className="marble-gate__hint">
              {banner.kind === 'gate'
                ? 'Roll into the tunnel with the answer. A wrong tunnel is a dead end.'
                : `Roll through the gem with the answer: 1 second off each (up to ${MAX_GEM_BONUSES}). Wrong gems do nothing.`}
            </p>
            {phase === 'reading' && banner.kind === 'gate' && (
              <button type="button" className="button button--play" onClick={() => resumeRef.current()}>
                Go!
              </button>
            )}
          </div>
        )}
        {toast && <p className="marble-toast" role="status">{toast}</p>}
        {phase === 'question' && ask && (
          <QuestionModal
            question={shown(ask.question)}
            title={ask.kind === 'rescue' ? 'Rescue' : ask.kind === 'quick' ? 'Quick question' : 'Pit stop'}
            note={ask.kind === 'rescue' ? 'You fell! The clock has stopped. A right answer gives back the time the fall cost.' : `The clock has stopped. A right answer takes ${ask.off} off your time.`}
            onSubmit={mark}
            onDone={(result) => closeAskRef.current(result.correct)}
            onClose={() => closeAskRef.current(false)}
            closeLabel="Skip"
          />
        )}

        {phase === 'loading' && <div className="marble-overlay" role="status">Setting up the course…</div>}
        {phase === 'broken' && (
          <div className="marble-overlay" role="alert">
            <p>This game needs 3D graphics, and this device couldn’t start them.</p>
            <button type="button" className="button button--light" onClick={onExit}>Back to courses</button>
          </div>
        )}
        {phase === 'ready' && (
          <div className="marble-overlay marble-overlay--light">
            <p className="marble-overlay__big">{hard ? 'Hard mode: beat the clock!' : 'Ready?'}</p>
            <p>
              {twoPlayer
                ? 'Player 1 (blue) uses the arrow keys. Player 2 (orange) uses W A S D. First over the line wins!'
                : ghost
                  ? `A see-through ghost of ${ghost.name} will race you. Press an arrow key or W A S D, or drag, to start rolling.`
                  : 'Press an arrow key or W A S D, or drag, to start rolling.'}
            </p>
            {setup.maths && !twoPlayer && (
              <label className="marble-guess">
                <span>Guess your time, in seconds (just for fun):</span>
                <input type="number" inputMode="numeric" min={1} max={999} value={guess} onChange={(e) => setGuess(e.target.value.slice(0, 3))} onKeyDown={(e) => e.stopPropagation()} />
              </label>
            )}
            <button type="button" className="button button--play" onClick={() => goto('playing')}>Roll!</button>
          </div>
        )}
        {phase === 'paused' && (
          <div className="marble-overlay">
            <p className="marble-overlay__big">Paused</p>
            <div className="marble-overlay__buttons">
              <button type="button" className="button button--play" onClick={() => goto('playing')}>Keep rolling</button>
              <button type="button" className="button button--light" onClick={() => restartRef.current()}>Start again</button>
              <button type="button" className="button button--light" onClick={onExit}>Courses</button>
            </div>
          </div>
        )}
        {(phase === 'finished' || phase === 'timeout') && result && (
          <div className="marble-overlay" role="dialog" aria-label="Run finished">
            <p className="marble-overlay__big">
              {result.winner !== undefined ? (result.winner === 0 ? 'A tie!' : `Player ${result.winner} wins!`) : phase === 'finished' ? 'Finished!' : 'Out of time'}
            </p>
            {result.winner !== undefined && (
              <p>
                {result.winner === 0 ? '' : `${result.winner === 1 ? '🔵' : '🟠'} `}
                {formatSteps(result.steps)}. This game isn’t saved.
              </p>
            )}
            {phase === 'finished' && result.winner === undefined && (
              <>
                <p className="marble-overlay__time">{formatSteps(result.steps)}{hard && ' 🔥'}</p>
                {result.medal && <p className="marble-overlay__medal">{MEDAL[result.medal]}</p>}
                {result.ghost && ghost && (
                  <p className="marble-overlay__best">
                    {result.ghost === 'beat' ? `👻 You beat ${ghost.name}’s ghost!` : result.ghost === 'tie' ? `👻 A tie with ${ghost.name}!` : `👻 ${ghost.name}’s ghost was ${formatSteps(result.steps - ghost.steps)} faster. Try again!`}
                  </p>
                )}
                {result.isBest && <p className="marble-overlay__best">⭐ New personal best!</p>}
                {guessResult && (
                  <p className="marble-overlay__best">
                    {guessResult.star
                      ? `⭐ Good guess! You said ${guessResult.guess} seconds and it took ${(result.steps / 60).toFixed(1)}.`
                      : `You guessed ${guessResult.guess} seconds. It took ${(result.steps / 60).toFixed(1)}.`}
                  </p>
                )}
                {!result.isBest && best !== undefined && <p>Your best: {formatSteps(best)}</p>}
                <p>{result.falls === 0 ? 'No falls. Smooth!' : `You fell ${result.falls} time${result.falls === 1 ? '' : 's'}.`}</p>
              </>
            )}
            {phase === 'timeout' && <p>The clock ran out. Nothing is lost: have another go.</p>}
            <div className="marble-overlay__buttons">
              <button type="button" className="button button--play" onClick={onAgain}>Roll again</button>
              {phase === 'finished' && !hard && canTryHard && !twoPlayer && (
                <button type="button" className="button button--light" onClick={onHard}>Try hard mode 🔥</button>
              )}
              <button type="button" className="button button--light" onClick={onExit}>Courses</button>
            </div>
          </div>
        )}

        {/* Only while rolling: on a phone it would sit over the Ready, question and finish buttons (dragging anywhere starts a run). */}
        {showStick && (phase === 'playing' || phase === 'reading') && <ThumbStick side={stickSide} onPush={(v) => (stickPush.current = v)} />}
      </div>

      <div className="marble-bar">
        <button type="button" className="button button--light" disabled={!playing && phase !== 'paused'} onClick={() => goto(playing ? 'paused' : 'playing')}>
          {phase === 'paused' ? 'Resume' : 'Pause'}
        </button>
        <button type="button" className="button button--light" onClick={() => restartRef.current()} disabled={phase === 'loading'}>Start again</button>
        <button type="button" className="button button--light" onClick={onExit}>Courses</button>
        {showStick && (
          <button type="button" className="button button--light" onClick={() => setStickSide(stickSide === 'right' ? 'left' : 'right')}>
            Stick on the {stickSide === 'right' ? 'left' : 'right'}
          </button>
        )}
        <p className="marble-bar__help">
          {twoPlayer ? 'Blue: arrow keys. Orange: W A S D. P to pause, R to start again.' : 'Arrow keys or W A S D to roll. Or drag. P to pause, R to start again.'}
        </p>
      </div>

      <div className="sr-only" role="status" aria-live="polite">{announce}</div>
    </div>
  );
}

/** Time off in words: "2 seconds", "1 second", "half a second". */
export function secondsOff(steps: number): string {
  if (steps === 30) return 'half a second';
  const sec = steps / 60;
  return sec === 1 ? '1 second' : `${sec} seconds`;
}

/** A thumb stick for touch screens: drag the knob the way you want to roll. */
function ThumbStick({ side, onPush }: { side: 'left' | 'right'; onPush: (v: [number, number] | null) => void }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState<[number, number]>([0, 0]);
  const active = useRef<number | null>(null);
  const RADIUS = 48;

  const update = (e: React.PointerEvent) => {
    const base = baseRef.current;
    if (!base) return;
    const r = base.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    setKnob([dx, dy]);
    onPush(dragVector(dx, dy, 12));
  };
  const end = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId) return;
    active.current = null;
    setKnob([0, 0]);
    onPush(null);
  };

  return (
    <div
      className={`marble-stick marble-stick--${side}`}
      ref={baseRef}
      aria-hidden="true"
      onPointerDown={(e) => {
        active.current = e.pointerId;
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          // The pointer is already gone.
        }
        update(e);
      }}
      onPointerMove={(e) => active.current === e.pointerId && update(e)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="marble-stick__knob" style={{ transform: `translate(${knob[0]}px, ${knob[1]}px)` }} />
    </div>
  );
}
