/**
 * One run of one course: the picture, the clock, the controls and the pause / finish panels.
 *
 * The physics (shared/marble) moves in fixed 1/60-second steps whatever the screen is doing; this
 * file feeds it one input per step, writes the inputs down (so the run can be replayed exactly),
 * and asks the renderer to draw the latest state. Nothing is saved from here: it reports the finished
 * run through `onDone`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { DT } from '../../../shared/marble/config';
import type { Course } from '../../../shared/marble/course';
import { clockSteps, makeWorld, medalFor, newRun, stepRun, type ClockMode, type RunState } from '../../../shared/marble/engine';
import { pushInput } from '../../../shared/marble/inputs';
import { useSound } from '../../sound';
import { playSound } from '../sounds';
import { formatSteps } from './bests';
import { dragVector, KeyTracker, screenToCode } from './controls';
import { infoFor } from './courseInfo';
import { paletteFor } from './palette';
import type { MarbleView } from './renderer';

export interface FinishedRun {
  courseId: string;
  mode: ClockMode;
  outcome: 'finished' | 'timeout';
  steps: number;
  falls: number;
  checkpoints: number;
  inputs: [number, number][];
}

type Phase = 'loading' | 'ready' | 'playing' | 'paused' | 'finished' | 'timeout' | 'broken';

const MEDAL = { gold: '🥇 Gold', silver: '🥈 Silver', bronze: '🥉 Bronze' } as const;
const DEAD_ZONE = 14;

const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const isCoarse = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export function RunScreen({
  course,
  mode,
  best,
  canTryHard,
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
  onDone: (run: FinishedRun) => { isBest: boolean };
  onAgain: () => void;
  onHard: () => void;
  onExit: () => void;
}) {
  const { soundOn } = useSound();
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const phaseRef = useRef<Phase>('loading');
  const [falls, setFalls] = useState(0);
  const [checkpoints, setCheckpoints] = useState(0);
  const [announce, setAnnounce] = useState('');
  const [result, setResult] = useState<{ steps: number; medal: keyof typeof MEDAL | null; isBest: boolean; falls: number } | null>(null);
  const [stickSide, setStickSide] = useState<'left' | 'right'>('right');
  const [showStick, setShowStick] = useState(isCoarse);
  const keys = useRef(new KeyTracker());
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
    const world = makeWorld(course, { mode });
    let state: RunState = newRun(world);
    let prev: RunState = { ...state };
    let runs: [number, number][] = [];
    let acc = 0;
    let last = performance.now();
    let slowFrames = 0;
    let frames = 0;
    let lowQuality = false;
    let skip = false;
    let lastFalls = 0;
    let lastChecks = 0;
    let wasGrounded = true;
    let reported = false;
    const reduced = prefersReducedMotion();

    restartRef.current = () => {
      state = newRun(world);
      prev = { ...state };
      runs = [];
      acc = 0;
      lastFalls = 0;
      lastChecks = 0;
      wasGrounded = true;
      reported = false;
      setFalls(0);
      setCheckpoints(0);
      setResult(null);
      setAnnounce('');
      goto('ready');
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

    const finish = () => {
      if (reported) return;
      reported = true;
      const finished = state.outcome === 'finished';
      const steps = finished ? state.finishSteps : state.steps + state.penalty;
      const { isBest } = onDone({
        courseId: course.def.id, mode, outcome: finished ? 'finished' : 'timeout', steps, falls: state.falls, checkpoints: state.checkpoints.length, inputs: runs,
      });
      if (finished) {
        setResult({ steps, medal: mode === 'up' ? medalFor(course, steps) : null, isBest, falls: state.falls });
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

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((t - last) / 1000, 0.1);
      last = t;
      if (!view) return;
      if (phaseRef.current === 'playing') {
        acc += dt;
        let n = 0;
        while (acc >= DT && n < 6 && state.outcome === 'running') {
          prev = { ...state };
          const input = readInput();
          pushInput(runs, input);
          stepRun(world, state, input);
          acc -= DT;
          n++;
          if (state.falls > lastFalls) {
            lastFalls = state.falls;
            setFalls(lastFalls);
            beep('black-hole');
            say(`You fell. Back to the ${state.checkpoints.length ? 'checkpoint' : 'start'}.`);
          }
          if (state.checkpoints.length > lastChecks) {
            lastChecks = state.checkpoints.length;
            setCheckpoints(lastChecks);
            beep('item');
            say('Checkpoint!');
          }
          if (wasGrounded && !state.grounded && state.vz > 1) beep('hop');
          wasGrounded = state.grounded;
        }
        if (n === 6) acc = 0;
        if (state.outcome !== 'running') finish();
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
      if (lowQuality && skip) {
        skip = false;
        return;
      }
      skip = lowQuality && phaseRef.current === 'playing';
      view.draw(prev, state, phaseRef.current === 'playing' ? Math.min(1, acc / DT) : 1, dt);
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
        view = createView(canvas, course, world, paletteFor(course.def.id), reduced);
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
      if (keys.current.press(e.code)) {
        e.preventDefault();
        if (phaseRef.current === 'ready') goto('playing');
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
    const onKeyUp = (e: KeyboardEvent) => keys.current.release(e.code);
    const onBlur = () => {
      keys.current.clear();
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
      view?.dispose();
    };
    // The run is made once per course and mode; the callbacks it uses don't need to restart it.
  }, [course, mode]);

  // ---- dragging with a mouse, trackpad or finger ----
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, .marble-stick')) return;
    if (e.pointerType === 'touch') setShowStick(true);
    dragStart.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    if (phaseRef.current === 'ready') goto('playing');
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

  const info = infoFor(course.def.id);
  const hard = mode === 'down';
  const playing = phase === 'playing';

  return (
    <div className="marble-run">
      <div className="marble-hud">
        <div className="marble-hud__title">
          <strong>{info?.name ?? course.def.name}</strong>
          {hard && <span className="marble-hud__flame"> 🔥 Hard mode</span>}
        </div>
        <div className="marble-hud__clock" aria-label={hard ? 'Time left' : 'Time'}>
          <span ref={timeRef}>0:00.00</span>
        </div>
        <div className="marble-hud__stats">
          <span>Falls: {falls}</span>
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
            <p>Press an arrow key or W A S D, or drag, to start rolling.</p>
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
            <p className="marble-overlay__big">{phase === 'finished' ? 'Finished!' : 'Out of time'}</p>
            {phase === 'finished' && (
              <>
                <p className="marble-overlay__time">{formatSteps(result.steps)}{hard && ' 🔥'}</p>
                {result.medal && <p className="marble-overlay__medal">{MEDAL[result.medal]}</p>}
                {result.isBest && <p className="marble-overlay__best">⭐ New personal best!</p>}
                {!result.isBest && best !== undefined && <p>Your best: {formatSteps(best)}</p>}
                <p>{result.falls === 0 ? 'No falls. Smooth!' : `You fell ${result.falls} time${result.falls === 1 ? '' : 's'}.`}</p>
              </>
            )}
            {phase === 'timeout' && <p>The clock ran out. Nothing is lost: have another go.</p>}
            <div className="marble-overlay__buttons">
              <button type="button" className="button button--play" onClick={onAgain}>Roll again</button>
              {phase === 'finished' && !hard && canTryHard && (
                <button type="button" className="button button--light" onClick={onHard}>Try hard mode 🔥</button>
              )}
              <button type="button" className="button button--light" onClick={onExit}>Courses</button>
            </div>
          </div>
        )}

        {showStick && phase !== 'loading' && <ThumbStick side={stickSide} onPush={(v) => (stickPush.current = v)} />}
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
        <p className="marble-bar__help">Arrow keys or W A S D to roll. Or drag. P to pause, R to start again.</p>
      </div>

      <div className="sr-only" role="status" aria-live="polite">{announce}</div>
    </div>
  );
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
        e.currentTarget.setPointerCapture?.(e.pointerId);
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
