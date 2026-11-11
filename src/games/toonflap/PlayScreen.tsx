/**
 * The run: a canvas, a fixed-step loop and a few buttons over the top (docs/TOON-FLAP-PLAN.md, sections 1 and 7).
 *
 * The physics steps 60 times a second whatever the screen is doing (real time is added up and spent in 1/60 s steps). Every
 * flap is recorded as the step number it was applied on, so the server can replay the same run (engine.ts replayRun). The
 * pupil never learns here whether a gap was right: the results screen says.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { BUMP_PENALTY_STEPS, CHECK_BONUS_STEPS, READ_TIME_MAX_SECONDS, START_X, STEPS_PER_SECOND } from '../../../shared/toonflap/config';
import { encodeFlaps, newRun, stepRun, type RunState, type StepEvent } from '../../../shared/toonflap/engine';
import { buildCourse, levelById, LEVELS, type Course } from '../../../shared/toonflap/levels';
import type { Progress } from '../../../shared/toonflap/collection';
import { QuestionModal, type MarkedAnswer, type ShownQuestion } from '../../maths/QuestionModal';
import type { PublicQuestion } from '../../../shared/maths/serverQuestions';
import { playSound } from '../sounds';
import { useSound } from '../../sound';
import type { FinishReply, Picks, StartReply, ToonFlapBackend } from './backend';
import { drawScene, stepTrail, type TrailParticle } from './renderer';
import type { FlyerPose } from './art/art';
import { shiny as isShiny, FLYERS } from '../../../shared/toonflap/collection';
import { GUIDE, SHORT } from './guide';
import { PotionIcon } from './MapScreen';

const STEP_MS = 1000 / STEPS_PER_SECOND;
const MAX_STEPS_A_FRAME = 5;

/**
 * One physics step with the pupil's flap (if any). The flap is recorded as the step it is applied on BEFORE stepping, and
 * only while the run is going: this is exactly what replayRun checks. While the bird hovers no time passes, so the next flap
 * is recorded at the same step number the bird is waiting on.
 */
export function advance(course: Course, state: RunState, flapQueued: boolean, flaps: number[]): StepEvent {
  const flap = flapQueued && state.mode !== 'done';
  if (flap) flaps.push(state.t);
  return stepRun(course, state, flap);
}

const shown = (q: PublicQuestion): ShownQuestion => ({ id: q.slot, parts: q.parts, spoken: q.spoken, prompt: q.prompt, choices: q.choices, choiceLabels: q.choiceLabels, maxLength: q.maxLength, input: q.input });

/** "6 × 7 = 42" from the question's parts, putting the answer where the question mark was. */
export function factText(parts: readonly string[], answer: number): string {
  if (!Number.isFinite(answer)) return '';
  return parts.some((p) => p.includes('?')) ? parts.map((p) => p.replace('?', String(answer))).join(' ') : `${parts.join(' ')} = ${answer}`;
}

type Pause = 'card' | 'read' | 'leave' | 'end' | null;

interface Game {
  state: RunState;
  flaps: number[];
  queued: boolean;
  paused: Pause;
  before: Pause;
  rightChecks: number;
  potionUsed: boolean;
  shake: number;
  dizzy: number;
  flapAnim: number;
  whoosh: number;
  time: number;
  seen: Set<number>;
  bumpTold: boolean;
  pathTold: boolean;
  signTold: boolean;
  particles: TrailParticle[];
  finishing: boolean;
}

interface Hud {
  tenths: number;
  bumps: number;
  perches: number;
  hover: RunState['hover'] | null;
  sign: number | null;
  potionUsed: boolean;
}

export function PlayScreen({ backend, start, progress, picks, onFinished, onLeave, guide = false, tip = false, talk = () => undefined, onSkipGuide }: {
  backend: ToonFlapBackend;
  /** The guided first go: Pī's bubbles and the dotted path (level 1). */
  guide?: boolean;
  /** This level's first-time tip, and the help bubbles (the pupil's help setting). */
  tip?: boolean;
  /** Bella says a line (only fixed lines are ever said: see guide.ts). */
  talk?: (text: string) => void;
  onSkipGuide?: () => void;
  start: StartReply;
  progress: Progress;
  picks: Picks;
  onFinished: (reply: FinishReply) => void;
  onLeave: () => void;
}) {
  const def = levelById(start.level) ?? LEVELS[0];
  const course = useMemo(() => buildCourse(def, start.gentle), [def, start.gentle]);
  const { soundOn } = useSound();
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const goTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const G = useRef<Game | null>(null);
  if (G.current === null) {
    G.current = { state: newRun(course), flaps: [], queued: false, paused: null, before: null, rightChecks: 0, potionUsed: false, shake: 0, dizzy: 0, flapAnim: 0, whoosh: 0, time: 0, seen: new Set(), bumpTold: false, pathTold: false, signTold: false, particles: [], finishing: false };
  }
  const [hud, setHud] = useState<Hud>({ tenths: 0, bumps: 0, perches: 0, hover: 'start', sign: null, potionUsed: false });
  const [card, setCard] = useState<number | null>(null);
  const [reading, setReading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [guiding, setGuiding] = useState(guide);
  // Help bubbles: the guide or the tip. Read inside the loop, so kept in a ref.
  const helpRef = useRef(guide || tip);
  const talkRef = useRef(talk);
  talkRef.current = talk;

  const flyerId = picks.flyer;
  const shiny = isShiny(progress, FLYERS.find((f) => f.id === flyerId) ?? FLYERS[0]);
  const labels = useMemo(() => (start.maths ? start.signs.map((s) => s.labels) : null), [start]);

  const say = (text: string) => {
    talkRef.current(text);
    setBubble(text);
    setAnnounce(text);
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), 4200);
  };
  const play = (s: Parameters<typeof playSound>[0]) => {
    if (soundRef.current) playSound(s);
  };

  const go = () => {
    clearTimeout(goTimer.current);
    const g = G.current as Game;
    if (g.paused === 'read') g.paused = null;
    g.queued = false;
    setReading(false);
  };
  const flap = () => {
    const g = G.current as Game;
    if (g.paused === 'read') return go();
    if (g.paused || g.finishing) return;
    if (helpRef.current && guiding && !g.pathTold && g.state.mode === 'hover' && g.state.hover === 'start') {
      g.pathTold = true;
      setTimeout(() => helpRef.current && say(GUIDE.path), 1400);
    }
    g.queued = true;
  };
  const skipGuide = () => {
    helpRef.current = false;
    setGuiding(false);
    onSkipGuide?.();
    say(GUIDE.skipped);
  };
  const flapRef = useRef(flap);
  flapRef.current = flap;

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'ArrowUp' && e.code !== 'Space') return;
      const t = e.target as HTMLElement | null;
      if (t && /^(BUTTON|INPUT|TEXTAREA|SELECT|A)$/.test(t.tagName)) return;
      e.preventDefault();
      if (!e.repeat) flapRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // the loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !stage || !ctx) return;
    const g = G.current as Game;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let dpr = 1;
    let w = 0;
    let h = 0;
    const resize = () => {
      const r = stage.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    ro?.observe(stage);
    if (guide) say(GUIDE.start);
    else if (tip) say(def.newThing);

    const onEvent = (ev: StepEvent) => {
      const s = g.state;
      if (ev === 'bump') {
        g.shake = 0.45;
        g.dizzy = 0.9;
        play('knock');
        if (!g.bumpTold && helpRef.current) {
          g.bumpTold = true;
          say(GUIDE.bump);
        } else setAnnounce('Bump. Plus 3 seconds.');
      } else if (ev === 'perch') {
        play('item');
        const idx = s.perches - 1;
        if (start.maths && start.checks[idx]) {
          g.paused = 'card';
          setCard(idx);
          talkRef.current(helpRef.current ? GUIDE.check : SHORT.check);
        } else if (helpRef.current) say(GUIDE.rest);
        else setAnnounce(GUIDE.rest);
      } else if (ev === 'pick') {
        g.whoosh = 0.6;
        play('wormhole');
      } else if (ev === 'finish' && !g.finishing) {
        g.finishing = true;
        g.paused = 'end';
        play('win');
        if (helpRef.current) say(GUIDE.nest);
        setSaving(true);
        void backend.finish(start.seed, encodeFlaps(g.flaps), g.potionUsed).then(onFinished);
      }
    };

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      g.time += dt;
      g.shake = Math.max(0, g.shake - dt);
      g.dizzy = Math.max(0, g.dizzy - dt);
      g.flapAnim = Math.max(0, g.flapAnim - dt);
      g.whoosh = Math.max(0, g.whoosh - dt);
      const over = () => g.state.mode === 'done';
      if (!g.paused && !over()) {
        acc += dt * 1000;
        let steps = 0;
        while (acc >= STEP_MS && steps < MAX_STEPS_A_FRAME && !g.paused && !over()) {
          acc -= STEP_MS;
          steps++;
          const queued = g.queued;
          g.queued = false;
          if (queued) {
            g.flapAnim = 0.18;
            play('hop');
          }
          onEvent(advance(course, g.state, queued, g.flaps));
        }
        if (steps >= MAX_STEPS_A_FRAME) acc = 0;
      } else acc = 0;

      // an answer sign shows once the bird reaches it, and stays until the wall is flown through
      const s = g.state;
      if (start.maths) {
        course.signs.forEach((sign) => {
          if (!g.seen.has(sign.i) && s.x >= sign.x) {
            g.seen.add(sign.i);
            const info = start.signs[sign.i];
            if (info) setAnnounce(`Answer sign: ${info.parts.join(' ')}`);
            if (info && helpRef.current && !g.signTold) {
              g.signTold = true;
              say(GUIDE.sign);
            }
            if (start.readTime && info) {
              g.paused = 'read';
              setReading(true);
              clearTimeout(goTimer.current);
              goTimer.current = setTimeout(go, READ_TIME_MAX_SECONDS * 1000);
            }
          }
        });
      }
      const sign = start.maths ? (course.signs.find((x) => g.seen.has(x.i) && s.picks[x.i] === null)?.i ?? null) : null;

      // the clock the pupil sees
      const steps = s.t + (s.bumps - (g.potionUsed ? 1 : 0)) * BUMP_PENALTY_STEPS - g.rightChecks * CHECK_BONUS_STEPS;
      const tenths = Math.max(0, Math.floor(steps / (STEPS_PER_SECOND / 10)));
      const hover = s.mode === 'hover' ? s.hover : null;
      setHud((o) => (o.tenths === tenths && o.bumps === s.bumps && o.perches === s.perches && o.hover === hover && o.sign === sign && o.potionUsed === g.potionUsed ? o : { tenths, bumps: s.bumps, perches: s.perches, hover, sign, potionUsed: g.potionUsed }));
      if (barRef.current) barRef.current.style.width = `${Math.max(0, Math.min(1, (s.x - START_X) / (course.nestX - START_X))) * 100}%`;

      stepTrail(g.particles, s.x, s.y, dt, s.mode === 'fly' && !g.paused);
      const pose: FlyerPose = g.dizzy > 0 ? 'dizzy' : s.mode === 'hover' && s.hover === 'perch' ? 'perched' : s.mode === 'done' ? 'cheer' : g.flapAnim > 0 ? 'up' : 'glide';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawScene(ctx, { course, state: s, w, h, time: g.time, reduced, shake: reduced ? 0 : g.shake * 24, flyer: flyerId, shiny, trail: picks.trail, particles: g.particles, pose, labels, ghostPath: def.n === 1 && helpRef.current });
      if (g.whoosh > 0 && !reduced) {
        // a few speed lines behind the bird: the pick was made, the results will say how it went
        ctx.strokeStyle = `rgba(255,255,255,${g.whoosh})`;
        ctx.lineWidth = 3;
        const bx = w * 0.3;
        const by = h / 2;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(bx - 20 - i * 14, by + (i - 2) * 16);
          ctx.lineTo(bx - 90 - i * 14, by + (i - 2) * 16);
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      clearTimeout(goTimer.current);
      clearTimeout(bubbleTimer.current);
    };
    // The run is made once for this start reply.
  }, []);

  const g = G.current as Game;
  const sec = (hud.tenths / 10).toFixed(1);
  const bumpsLeft = hud.bumps - (hud.potionUsed ? 1 : 0);
  const canPotion = progress.potions > 0 && !hud.potionUsed && hud.bumps > 0;
  const activeSign = hud.sign !== null ? start.signs[hud.sign] : undefined;
  const marks = course.perches.map((p) => (p.x - START_X) / (course.nestX - START_X));

  const askLeave = () => {
    if (g.paused === 'card' || g.finishing) return;
    g.before = g.paused;
    g.paused = 'leave';
    setConfirm(true);
  };
  const stay = () => {
    g.paused = g.before;
    g.before = null;
    g.queued = false;
    setConfirm(false);
  };

  const q = card !== null ? start.checks[card] : null;

  return (
    <div
      className="tf-play"
      ref={rootRef}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('[data-noflap]')) return;
        flap();
      }}
    >
      <div className="tf-stage" ref={stageRef}>
        <canvas ref={canvasRef} className="tf-canvas" role="img" aria-label={`${def.name}. Tap, click or press Space to flap.`} />
        <div className="tf-bar" aria-hidden="true">
          <div className="tf-bar__fill" ref={barRef} />
          {marks.map((m, i) => (
            <span key={i} className={`tf-bar__mark${hud.perches > i ? ' tf-bar__mark--done' : ''}`} style={{ left: `${m * 100}%` }}>✓</span>
          ))}
          <span className="tf-bar__nest">🪺</span>
        </div>
        <div className="tf-hud">
          <div className="tf-hud__left">
            <span className="tf-time" aria-label={`Time ${sec} seconds`}>{sec}<small> s</small></span>
            <span className="tf-chip">Bumps {bumpsLeft}</span>
            {start.gentle && <span className="tf-chip" title="Gentle wings">🪶</span>}
          </div>
          <div className="tf-hud__right">
            {guiding && <button type="button" className="tf-btn tf-btn--small tf-btn--ghost" data-noflap onClick={skipGuide}>Skip guide</button>}
            <button type="button" className="tf-btn tf-btn--small" data-noflap onClick={askLeave}>Leave</button>
          </div>
        </div>
        {confirm && (
          <div className="tf-confirm" role="alertdialog" aria-label="Leave this flight?" data-noflap>
            <div className="tf-confirm__box">
              <p><strong>Leave this flight?</strong></p>
              <p>This run won't be saved.</p>
              <div className="tf-row">
                <button type="button" className="tf-btn" onClick={stay} autoFocus>Keep flying</button>
                <button type="button" className="tf-btn tf-btn--ghost" onClick={onLeave}>Leave</button>
              </div>
            </div>
          </div>
        )}
        {saving && <div className="tf-saving" role="status">Checking your flight…</div>}
      </div>
      {/* In portrait this sits below the flying area so nothing covers the gaps; in landscape it lies over it. */}
      <div className="tf-dock">
        {activeSign && (
          <div className="tf-sign" role="status">
            <span className="tf-sign__label">Fly through the answer</span>
            <span className="tf-sign__sum">{activeSign.parts.join(' ')}</span>
          </div>
        )}
        {reading && !confirm && (
          <div className="tf-go-wrap" data-noflap>
            <button type="button" className="tf-btn tf-btn--go" onClick={go} autoFocus>Go</button>
            <span className="tf-go-note">Read it, then tap Go. The clock is stopped.</span>
          </div>
        )}
        {(canPotion || hud.potionUsed) && (
          <div className="tf-potion" data-noflap>
            {hud.potionUsed ? <span className="tf-chip tf-chip--good">Potion used: −3 s</span> : (
              <button type="button" className="tf-btn tf-btn--potion" onClick={() => { g.potionUsed = true; setAnnounce('Potion used. Minus 3 seconds.'); }}>
                <PotionIcon /> Use a potion (cancels one bump)
              </button>
            )}
          </div>
        )}
        {bubble && <div className="tf-bubble" role="status">{bubble}</div>}
        {hud.hover === 'start' && !card && (
          <div className="tf-tap tf-tap--start">
            {def.n === 1 && <span className="tf-tap__hand" aria-hidden="true">👆</span>}
            <span className="tf-tap__text">Tap to start</span>
            <span className="tf-tap__sub">Tap, click or press Space</span>
          </div>
        )}
        {hud.hover === 'perch' && !card && !confirm && (
          <div className="tf-tap">
            <span className="tf-tap__text">{start.maths && start.checks[hud.perches - 1] ? 'Tap to fly on' : 'A rest. Tap to fly on.'}</span>
          </div>
        )}
        {hud.hover === 'bump' && !confirm && (
          <div className="tf-tap tf-tap--small">
            <span className="tf-tap__text">Tap to fly again</span>
          </div>
        )}
      </div>
      <button type="button" className="tf-pad" data-noflap onPointerDown={(e) => { e.stopPropagation(); flap(); }} onClick={(e) => { if (e.detail === 0) flap(); }}>
        Tap to flap
      </button>
      <p className="tf-sr" aria-live="polite">{announce}</p>
      {q && (
        <div data-noflap>
          <QuestionModal
            question={shown(q)}
            title="Check!"
            note="Right answer: 3 seconds off. The clock is stopped."
            onSubmit={async (value, ms): Promise<MarkedAnswer> => {
              const r = await backend.answer(start.seed, q.slot, value, ms);
              return { correct: r.correct, fact: factText(q.parts, r.answer), boxBefore: 0, boxAfter: 0, answer: r.answer, ...(r.correct ? { reward: '3 seconds off!' } : {}) };
            }}
            onDone={(res) => {
              if (res.correct) g.rightChecks++;
              g.paused = null;
              g.queued = false;
              setCard(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
