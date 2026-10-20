/**
 * One run of a level: the picture, the heads-up display, the controls, pause, the map, question doors and pads, and the
 * finish screen. The rules run in `MineSession` at a fixed 30 steps a second; this draws between steps.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import { useSound } from '../../sound';
import { playSound } from '../sounds';
import { DT, MAX_ENERGY, MAX_SHIELD, REACTOR_HP } from '../../../shared/mine/config';
import { packInput } from '../../../shared/mine/inputs';
import { Controls } from './controls';
import { nextGoal } from './guide';
import { formatClock, type LevelInfo } from './levels';
import { MineMap } from './MineMap';
import { SettingsPanel } from './Settings';
import { TouchControls } from './TouchControls';
import { loadBests, saveBests, showTouchControls, withFinish, wantsLessMotion, type MinePrefs } from './prefs';
import type { MineView } from './renderer';
import { MineSession, type MineEvent, type UseTarget } from './session';
import { TRIAL_NOTE, trialFact, trialQuestion } from './trialMaths';

export interface FinishedRun {
  outcome: 'finished' | 'timeout';
  steps: number;
  deaths: number;
  robotsKilled: number;
  wrongAnswers: number;
}

interface Hud {
  shield: number;
  energy: number;
  missiles: number;
  keys: [number, number, number];
  clock: number;
  escapeLeft: number;
  reactorDown: boolean;
  reactorHp: number;
  goal: { label: string; angle: number; ahead: boolean; behind: boolean; metres: number; final: boolean };
  canUse: boolean;
  useLabel: string;
}

const KEY_NAMES = ['Blue', 'Yellow', 'Red'] as const;
const KEY_COLOUR_CLASS = ['blue', 'yellow', 'red'] as const;

const PAD_WORDS = { shield: 'shield', energy: 'energy', missiles: 'missiles' } as const;

function describeEvent(e: MineEvent): string | null {
  switch (e.kind) {
    case 'key': return `You got the ${e.colour} key!`;
    case 'door': return e.byKey ? 'The door is open.' : 'Right! The door is open.';
    case 'pickup': return e.what === 'shield' ? 'Shield +30' : e.what === 'energy' ? 'Energy +40' : 'Missiles +3';
    case 'pad': return `Right! ${PAD_WORDS[e.padKind][0].toUpperCase()}${PAD_WORDS[e.padKind].slice(1)} filled up.`;
    case 'reactor-down': return 'The reactor is down! Fly back to the exit before time runs out.';
    case 'rebuilt': return 'Your ship was rebuilt. 20 seconds added.';
    case 'wrong': return 'Not quite. Shield −20 and 6 seconds added.';
    default: return null;
  }
}

function goalInfo(session: MineSession): Hud['goal'] {
  const s = session.state;
  const g = nextGoal(session.world, s);
  const dx = g.x - s.px;
  const dy = g.y - s.py;
  const dz = g.z - s.pz;
  const right = dx * s.rx + dy * s.ry + dz * s.rz;
  const up = dx * s.ux + dy * s.uy + dz * s.uz;
  const fwd = dx * s.fx + dy * s.fy + dz * s.fz;
  const metres = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const lateral = Math.sqrt(right * right + up * up);
  return { label: g.label, angle: (Math.atan2(right, up) * 180) / Math.PI, ahead: fwd > 0 && lateral < fwd * 0.3, behind: fwd < 0 && lateral < -fwd * 0.3, metres, final: g.final };
}

function readHud(session: MineSession): Hud {
  const s = session.state;
  const target = session.target();
  return {
    shield: s.shield, energy: s.energy, missiles: s.missiles, keys: [...s.keys] as [number, number, number], clock: session.clock,
    escapeLeft: s.escapeLeft, reactorDown: s.reactorDown === 1, reactorHp: s.reactorHp,
    goal: goalInfo(session),
    canUse: target !== null,
    useLabel: target ? (target.kind === 'door' ? 'Answer to open the door' : `Answer for ${PAD_WORDS[target.padKind]}`) : '',
  };
}

export function MineRun({
  level, prefs, onPrefs, player, trial, onFinish, onAgain, onNext, onExit,
}: {
  level: LevelInfo;
  prefs: MinePrefs;
  onPrefs: (p: MinePrefs) => void;
  player: string;
  /** Question doors and pads use the trial questions (preview only). */
  trial: boolean;
  onFinish: (run: FinishedRun) => void;
  onAgain: () => void;
  onNext: (() => void) | null;
  onExit: () => void;
}) {
  const { soundOn } = useSound();
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  // Steady or free flight is decided when the run starts and never changes during it.
  const steadyAtStart = useRef(prefs.steady);
  const session = useMemo(() => new MineSession(level.recipe, { steady: steadyAtStart.current }), [level.recipe]);
  const controls = useMemo(() => new Controls(), []);
  const viewRef = useRef<MineView | null>(null);
  const [problem, setProblem] = useState('');
  const [hud, setHud] = useState<Hud>(() => readHud(session));
  const [message, setMessage] = useState('');
  const [hit, setHit] = useState(0);
  const [paused, setPaused] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [question, setQuestion] = useState<{ target: UseTarget; q: ReturnType<typeof trialQuestion> } | null>(null);
  const [finished, setFinished] = useState<{ run: FinishedRun; isBest: boolean; best: number | null } | null>(null);
  const [needsStart, setNeedsStart] = useState(true);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const blocked = useRef(true);
  blocked.current = paused || mapOpen || question !== null || finished !== null || needsStart;
  const heading = useRef<HTMLHeadingElement>(null);
  const runHeading = useRef<HTMLHeadingElement>(null);
  const messageTimer = useRef<number | undefined>(undefined);
  const touch = showTouchControls(prefs);
  const lessMotion = wantsLessMotion(prefs);
  const lastSound = useRef<Record<string, number>>({});

  controls.settings = { sensitivity: prefs.sensitivity, invertY: prefs.invertY, lock: prefs.lock };

  const say = useCallback((text: string) => {
    setMessage(text);
    window.clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(() => setMessage(''), 3200);
  }, []);

  const beep = useCallback((sound: Parameters<typeof playSound>[0], gapMs = 0) => {
    if (!soundRef.current) return;
    const now = performance.now();
    if (gapMs && now - (lastSound.current[sound] ?? -1e9) < gapMs) return;
    lastSound.current[sound] = now;
    playSound(sound);
  }, []);

  const openQuestion = useCallback(() => {
    if (blocked.current || !trial) return;
    const target = session.target();
    if (!target) return;
    controls.clear();
    setQuestion({ target, q: trialQuestion() });
  }, [controls, session, trial]);

  const pause = useCallback(() => {
    controls.clear();
    if (document.pointerLockElement) document.exitPointerLock?.();
    setPaused(true);
  }, [controls]);

  // The picture, the loop and the keyboard live for as long as the run does.
  useEffect(() => {
    const el = canvas.current;
    const holder = stage.current;
    if (!el || !holder) return;
    let raf = 0;
    let gone = false;
    let view: MineView | null = null;
    let acc = 0;
    let last = performance.now();
    let hudAt = 0;
    let slow = 0;
    let frames = 0;
    let ratioNow = 1;
    let hitTimer = 0;

    // A hook for the browser checks (add ?debug to the address): lets a script fly the ship by recorded inputs.
    if (new URLSearchParams(window.location.search).has('debug')) (window as unknown as { __mineSession?: MineSession }).__mineSession = session;

    const size = () => {
      const r = holder.getBoundingClientRect();
      view?.resize(r.width, r.height);
    };

    void import('./renderer')
      .then((m) => {
        if (gone) return;
        view = m.createView(el, session, { lessMotion });
        viewRef.current = view;
        if (new URLSearchParams(window.location.search).has('debug')) (window as unknown as { __mineStats?: () => unknown }).__mineStats = () => view?.stats();
        ratioNow = view.stats().pixelRatio;
        size();
        setNeedsStart(false);
        frame(performance.now());
      })
      .catch(() => {
        if (!gone) setProblem('Your device could not show the 3D view. Try another browser, or ask your teacher.');
      });

    function handle(events: MineEvent[]) {
      view?.react(events);
      for (const e of events) {
        const text = describeEvent(e);
        if (text) say(text);
        if (e.kind === 'laser') beep('zap', 120);
        else if (e.kind === 'missile') beep('boom', 200);
        else if (e.kind === 'robot-down' || e.kind === 'boom') beep('boom', 120);
        else if (e.kind === 'key' || e.kind === 'pickup') beep('item');
        else if (e.kind === 'door') beep('door');
        else if (e.kind === 'pad') beep('shield');
        else if (e.kind === 'hurt') {
          beep('alert', 400);
          setHit((n) => n + 1);
          window.clearTimeout(hitTimer);
          hitTimer = window.setTimeout(() => setHit(0), 350);
        } else if (e.kind === 'wrong' || e.kind === 'rebuilt') {
          beep('end', 400);
          setHit((n) => n + 1);
          window.clearTimeout(hitTimer);
          hitTimer = window.setTimeout(() => setHit(0), 350);
        } else if (e.kind === 'reactor-down') beep('chaos');
      }
    }

    function frame(now: number) {
      if (gone) return;
      raf = requestAnimationFrame(frame);
      const seconds = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!blocked.current && session.running) {
        acc += seconds;
        let n = 0;
        while (acc >= DT && n < 5 && session.running) {
          session.step(packInput(controls.sample()));
          acc -= DT;
          n++;
        }
        if (n === 5) acc = 0;
      }
      if (session.events.length) {
        const events = session.events;
        session.events = [];
        handle(events);
      }
      const t = session.target();
      view?.highlight(t ? t.kind : null, t ? t.id : -1);
      view?.draw(blocked.current ? 1 : Math.min(1, acc / DT), blocked.current ? 0 : seconds);
      if (now - hudAt > 100) {
        hudAt = now;
        setHud(readHud(session));
      }
      // A slow device gets a softer picture to keep the speed up.
      frames++;
      if (seconds > 0.045 && !blocked.current) slow++;
      if (frames >= 60) {
        if (slow > 25 && ratioNow > 0.55) ratioNow = view?.setQuality(ratioNow - 0.25) ?? ratioNow;
        frames = 0;
        slow = 0;
      }
      if (!session.running) {
        const s = session.state;
        const run: FinishedRun = { outcome: s.outcome === 'finished' ? 'finished' : 'timeout', steps: s.finishSteps, deaths: s.deaths, robotsKilled: s.robotsKilled, wrongAnswers: s.wrongAnswers };
        cancelAnimationFrame(raf);
        if (document.pointerLockElement) document.exitPointerLock?.();
        controls.clear();
        setHud(readHud(session));
        let isBest = false;
        let best: number | null = null;
        if (run.outcome === 'finished' && !level.practice) {
          const next = withFinish(loadBests(player), level.id, run.steps);
          isBest = next.isBest;
          best = next.bests[level.id];
          saveBests(next.bests, player);
          beep('win');
        } else if (run.outcome === 'finished') beep('win');
        onFinish(run);
        setFinished({ run, isBest, best });
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (blocked.current) return;
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        pause();
        return;
      }
      if (e.code === 'KeyM') {
        e.preventDefault();
        controls.clear();
        setMapOpen(true);
        return;
      }
      if (e.code === 'Enter' || e.code === 'KeyU') {
        e.preventDefault();
        openQuestion();
        return;
      }
      if (controls.keyDown(e.code)) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => controls.keyUp(e.code);
    const onBlur = () => {
      controls.clear();
      if (!blocked.current) pause();
    };
    const onLock = () => {
      if (!document.pointerLockElement && prefsRef.current.lock && !blocked.current) pause();
    };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === el && !blocked.current) controls.mouseMoved(e.movementX, e.movementY);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('pointerlockchange', onLock);
    document.addEventListener('mousemove', onMouseMove);
    const resizer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(size);
    resizer?.observe(holder);
    window.addEventListener('resize', size);

    return () => {
      gone = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(hitTimer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('pointerlockchange', onLock);
      document.removeEventListener('mousemove', onMouseMove);
      resizer?.disconnect();
      window.removeEventListener('resize', size);
      if (document.pointerLockElement) document.exitPointerLock?.();
      view?.dispose();
      viewRef.current = null;
    };
    // The run lives as long as its session; prefs are read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => () => window.clearTimeout(messageTimer.current), []);

  // Mouse: drag to look (or captured look), click to fire.
  const drag = useRef<{ id: number; x: number; y: number; moved: number; at: number } | null>(null);
  function pointerDown(e: React.PointerEvent) {
    if (blocked.current || e.pointerType === 'touch') return;
    const el = canvas.current;
    if (prefs.lock && document.pointerLockElement !== el) {
      try {
        void Promise.resolve(el?.requestPointerLock()).catch(() => undefined);
      } catch {
        // Not allowed here (for example inside a frame): drag to look still works.
      }
    }
    if (prefs.lock && document.pointerLockElement === el) {
      controls.setMouseButtons(e.button === 0 || (e.buttons & 1) === 1, e.button === 2 || (e.buttons & 2) === 2);
      return;
    }
    if (e.button === 2) {
      controls.setMouseButtons(false, true);
      return;
    }
    el?.setPointerCapture?.(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, at: performance.now() };
  }
  function pointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || blocked.current) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    d.moved += Math.abs(dx) + Math.abs(dy);
    controls.mouseMoved(dx, dy);
  }
  function pointerUp(e: React.PointerEvent) {
    controls.setMouseButtons(false, false);
    const d = drag.current;
    if (d && d.id === e.pointerId) {
      if (d.moved < 6 && performance.now() - d.at < 300) controls.tap();
      drag.current = null;
    }
  }

  // Focus: each new screen's heading takes it.
  useEffect(() => {
    if (paused || finished || problem) heading.current?.focus();
  }, [paused, finished, problem]);
  useEffect(() => {
    runHeading.current?.focus({ preventScroll: true });
  }, []);

  function resume() {
    setPaused(false);
    runHeading.current?.focus({ preventScroll: true });
  }

  function onSubmit(value: number): MarkedAnswer {
    const q = question!.q;
    return { correct: value === q.answer, fact: trialFact(q), boxBefore: 0, boxAfter: 0, answer: q.answer };
  }
  function onAnswered(result: MarkedAnswer) {
    const target = question!.target;
    setQuestion(null);
    session.answered(target, result.correct);
    if (!result.correct && target.kind === 'pad') {
      const left = session.padTriesLeft(target.id);
      say(left > 0 ? `No problem, nothing lost. ${left} ${left === 1 ? 'try' : 'tries'} left on this pad.` : 'No tries left on this pad.');
    }
    runHeading.current?.focus({ preventScroll: true });
  }

  const goal = hud.goal;
  const bar = (v: number, max: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  const escapeSeconds = Math.ceil(hud.escapeLeft * DT);
  const target = session.target();
  const finishedWell = finished?.run.outcome === 'finished';

  return (
    <section className="mn-run" aria-label={`${level.name}: flying`} data-less-motion={lessMotion || undefined}>
      <h2 ref={runHeading} tabIndex={-1} className="mn-sr">{level.name}</h2>
      <div
        ref={stage}
        className="mn-stage"
        tabIndex={-1}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvas} className="mn-canvas" role="img" aria-label="The view from your ship, flying through the mine." />
      </div>

      <div className="mn-hud" aria-hidden={problem ? true : undefined}>
        <div className="mn-hud__left">
          <div className="mn-bar mn-bar--shield" data-low={hud.shield < 30 || undefined}>
            <span className="mn-bar__label">Shield</span>
            <span className="mn-bar__track"><span className="mn-bar__fill" style={{ width: bar(hud.shield, MAX_SHIELD) }} /></span>
            <span className="mn-bar__num">{Math.max(0, Math.ceil(hud.shield))}</span>
          </div>
          <div className="mn-bar mn-bar--energy">
            <span className="mn-bar__label">Energy</span>
            <span className="mn-bar__track"><span className="mn-bar__fill" style={{ width: bar(hud.energy, MAX_ENERGY) }} /></span>
            <span className="mn-bar__num">{Math.ceil(hud.energy)}</span>
          </div>
          <div className="mn-stats">
            <span className="mn-stat" aria-label={`${hud.missiles} missiles`}>🚀 {hud.missiles}</span>
            <span className="mn-keys" aria-label={`Keys held: ${hud.keys.map((k, i) => (k ? KEY_NAMES[i] : null)).filter(Boolean).join(', ') || 'none'}`}>
              {hud.keys.map((k, i) => (
                <span key={i} className={`mn-key mn-key--${KEY_COLOUR_CLASS[i]}`} data-have={k === 1 || undefined} aria-hidden="true">{k ? '🔑' : ''}</span>
              ))}
            </span>
          </div>
          {!hud.reactorDown && hud.reactorHp < REACTOR_HP && (
            <div className="mn-bar mn-bar--reactor">
              <span className="mn-bar__label">Reactor</span>
              <span className="mn-bar__track"><span className="mn-bar__fill" style={{ width: bar(hud.reactorHp, REACTOR_HP) }} /></span>
            </div>
          )}
        </div>

        <div className="mn-hud__top">
          <div className="mn-clock" role="timer" aria-label={`Time ${formatClock(hud.clock)}`}>{formatClock(hud.clock)}</div>
          {hud.reactorDown && (
            <div className="mn-escape" data-urgent={escapeSeconds <= 15 || undefined}>
              Escape! {escapeSeconds}s
            </div>
          )}
          {prefs.arrow && (
            <div className="mn-goal" aria-label={`Next goal: ${goal.label}, ${Math.round(goal.metres)} metres`}>
              <span className="mn-goal__arrow" aria-hidden="true" data-here={goal.ahead || undefined} style={{ transform: goal.ahead ? undefined : `rotate(${goal.angle}deg)` }}>
                {goal.ahead ? '◎' : '➤'}
              </span>
              <span className="mn-goal__text" aria-hidden="true">
                {goal.label}
                <small>{goal.behind ? 'behind you · ' : goal.ahead ? 'ahead · ' : ''}{Math.round(goal.metres)} m</small>
              </span>
            </div>
          )}
        </div>

        <div className="mn-hud__right">
          <button type="button" className="button button--light mn-btn mn-hudbtn" onClick={() => { controls.clear(); setMapOpen(true); }}>Map</button>
          <button type="button" className="button button--light mn-btn mn-hudbtn" onClick={pause}>Pause</button>
        </div>

        <div className="mn-cross" aria-hidden="true" />
        {hit > 0 && <div key={hit} className="mn-hurt" aria-hidden="true" />}
        <p className="mn-toast" role="status" aria-live="polite">{message}</p>
        {target && trial && (
          <button type="button" className="button button--play mn-btn mn-use" onClick={openQuestion}>
            {hud.useLabel} <kbd>Enter</kbd>
          </button>
        )}
        <p className="mn-rotate">Turn your phone sideways for a better view.</p>
        {touch && <TouchControls controls={controls} hand={prefs.hand} canUse={target !== null && trial} onUse={openQuestion} />}
      </div>

      {needsStart && !problem && <p className="mn-loading" role="status">Starting the mine…</p>}

      {problem && (
        <div className="mn-overlay" role="alertdialog" aria-labelledby="mn-problem-title">
          <div className="mn-panel">
            <h2 id="mn-problem-title" ref={heading} tabIndex={-1}>The 3D view won’t start</h2>
            <p>{problem}</p>
            <button type="button" className="button button--play mn-btn" onClick={onExit}>Back to the mines</button>
          </div>
        </div>
      )}

      {paused && !finished && (
        <div className="mn-overlay" role="dialog" aria-modal="true" aria-labelledby="mn-pause-title" onKeyDown={(e) => e.key === 'Escape' && resume()}>
          <div className="mn-panel mn-panel--wide mn-pause">
            <h2 id="mn-pause-title" ref={heading} tabIndex={-1}>Paused</h2>
            <div className="mn-row mn-pause__buttons">
              <button type="button" className="button button--play mn-btn" onClick={resume}>Resume</button>
              <button type="button" className="button button--light mn-btn" onClick={onAgain}>Start again</button>
              <button type="button" className="button button--light mn-btn" onClick={onExit}>Back to the mines</button>
            </div>
            <SettingsPanel prefs={prefs} onChange={onPrefs} inRun />
          </div>
        </div>
      )}

      {mapOpen && !finished && (
        <MineMap session={session} onClose={() => { setMapOpen(false); runHeading.current?.focus({ preventScroll: true }); }} />
      )}

      {question && (
        <QuestionModal
          question={question.q}
          title={question.target.kind === 'door' ? 'Question door' : `Power-up pad: ${PAD_WORDS[question.target.padKind]}`}
          note={`${TRIAL_NOTE} ${question.target.kind === 'door' ? 'A wrong answer costs 20 shield and 6 seconds.' : 'A wrong answer costs nothing.'}`}
          onSubmit={onSubmit}
          onDone={onAnswered}
          onClose={() => { setQuestion(null); runHeading.current?.focus({ preventScroll: true }); }}
          closeLabel="Not now"
        />
      )}

      {finished && (
        <div className="mn-overlay" role="dialog" aria-modal="true" aria-labelledby="mn-finish-title">
          <div className="mn-panel">
            <h2 id="mn-finish-title" ref={heading} tabIndex={-1}>{finishedWell ? 'You made it out!' : hud.reactorDown ? 'The mine caved in' : 'Time ran out'}</h2>
            {finishedWell ? (
              <>
                <p className="mn-bigtime">{formatClock(finished.run.steps)}</p>
                {level.practice ? <p>Nice flying. Practice times are not saved.</p> : finished.isBest ? <p><strong>A new best time on this device!</strong></p> : finished.best !== null && <p>Your best here: {formatClock(finished.best)}</p>}
              </>
            ) : (
              <p>{hud.reactorDown ? 'You did not reach the exit in time. Have another go: you know the way now.' : 'That was a very long dive. Have another go.'}</p>
            )}
            <ul className="mn-facts">
              <li>Robots destroyed: {finished.run.robotsKilled}</li>
              <li>Ship rebuilt: {finished.run.deaths} {finished.run.deaths === 1 ? 'time' : 'times'}</li>
              {finished.run.wrongAnswers > 0 && <li>Wrong answers: {finished.run.wrongAnswers}</li>}
            </ul>
            <div className="mn-row">
              <button type="button" className="button button--play mn-btn" onClick={onAgain}>{finishedWell ? 'Fly it again' : 'Try again'}</button>
              {finishedWell && onNext && <button type="button" className="button button--light mn-btn" onClick={onNext}>Next mine</button>}
              <button type="button" className="button button--light mn-btn" onClick={onExit}>Back to the mines</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
