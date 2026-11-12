/**
 * Sky Dash (docs/TOON-FLAP-PLAN.md, section 9, stage F.7): the classic one-touch mode on an endless course from the run's
 * seed. A bump ends the dash unless a spare feather (one for each check answered right) or the revive potion (if the
 * pupil brought one) saves it. The score is walls flown past. Flaps are recorded like a level run, and the server replays
 * the dash with its own marks (shared/toonflap/dash.ts replayDash), so the score can't be made up.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { DASH_FEATHERS_MAX, STEPS_PER_SECOND } from '../../../shared/toonflap/config';
import { buildDashCourse, dashWalls, earnFeather, newDash, stepDash, type DashState } from '../../../shared/toonflap/dash';
import { encodeFlaps, type StepEvent } from '../../../shared/toonflap/engine';
import { FLYERS, shiny as isShiny, type Progress } from '../../../shared/toonflap/collection';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import { playSound } from '../sounds';
import { useSound } from '../../sound';
import type { DashFinishReply, Picks, StartReply, ToonFlapBackend } from './backend';
import { drawScene, stepTrail, type TrailParticle } from './renderer';
import type { FlyerPose } from './art/art';
import { DASH_LINES } from './guide';
import { PotionIcon } from './MapScreen';
import { factText } from './PlayScreen';

const STEP_MS = 1000 / STEPS_PER_SECOND;
const MAX_STEPS_A_FRAME = 5;

interface Game {
  dash: DashState;
  flaps: number[];
  queued: boolean;
  paused: 'card' | 'leave' | 'end' | null;
  before: Game['paused'];
  shake: number;
  dizzy: number;
  flapAnim: number;
  time: number;
  particles: TrailParticle[];
  finishing: boolean;
}

interface Hud {
  walls: number;
  feathers: number;
  hover: 'start' | 'bump' | 'perch' | null;
  potionUsed: boolean;
}

export function DashScreen({ backend, start, progress, picks, onFinished, onLeave, talk = () => undefined }: {
  backend: ToonFlapBackend;
  start: StartReply;
  progress: Progress;
  picks: Picks;
  /** Null: the dash couldn't be checked. */
  onFinished: (reply: DashFinishReply | null) => void;
  onLeave: () => void;
  talk?: (text: string) => void;
}) {
  const course = useMemo(() => buildDashCourse(start.seed), [start.seed]);
  const { soundOn } = useSound();
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const G = useRef<Game | null>(null);
  if (G.current === null) {
    G.current = { dash: newDash(course), flaps: [], queued: false, paused: null, before: null, shake: 0, dizzy: 0, flapAnim: 0, time: 0, particles: [], finishing: false };
  }
  // A potion comes along if the pupil has one and leaves the box ticked; it is only used on a bump nothing else saved.
  const [bring, setBring] = useState(progress.potions > 0);
  const bringRef = useRef(bring);
  bringRef.current = bring;
  const [hud, setHud] = useState<Hud>({ walls: 0, feathers: 0, hover: 'start', potionUsed: false });
  const [card, setCard] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [announce, setAnnounce] = useState('');
  const talkRef = useRef(talk);
  talkRef.current = talk;
  const flyerId = picks.flyer;
  const shiny = isShiny(progress, FLYERS.find((f) => f.id === flyerId) ?? FLYERS[0]);

  const say = (text: string) => {
    talkRef.current(text);
    setBubble(text);
    setAnnounce(text);
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), 3200);
  };
  const play = (s: Parameters<typeof playSound>[0]) => {
    if (soundRef.current) playSound(s);
  };

  const flap = () => {
    const g = G.current as Game;
    if (g.paused || g.finishing) return;
    g.queued = true;
  };
  const flapRef = useRef(flap);
  flapRef.current = flap;

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
    // The start box already shows the rule, so Bella says it without a bubble.
    talkRef.current(DASH_LINES.start);
    setAnnounce(DASH_LINES.start);

    const end = () => {
      if (g.finishing) return;
      g.finishing = true;
      g.paused = 'end';
      setSaving(true);
      void backend.dashFinish(start.seed, encodeFlaps(g.flaps), bringRef.current).then(onFinished, () => onFinished(null));
    };

    const onEvent = (ev: StepEvent, save: string | null) => {
      const d = g.dash;
      if (ev === 'bump') {
        g.shake = 0.45;
        g.dizzy = 0.9;
        play('knock');
        if (save === 'feather') say(DASH_LINES.feather);
        else if (save === 'potion') say(DASH_LINES.potion);
        else {
          say(DASH_LINES.over);
          end();
        }
      } else if (ev === 'perch') {
        play('item');
        const idx = d.run.perches - 1;
        if (start.maths && start.checks[idx]) {
          g.paused = 'card';
          setCard(idx);
          talkRef.current(DASH_LINES.check);
        }
      } else if (ev === 'finish') {
        play('win');
        end();
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
      const s = g.dash.run;
      if (!g.paused && s.mode !== 'done') {
        acc += dt * 1000;
        let steps = 0;
        while (acc >= STEP_MS && steps < MAX_STEPS_A_FRAME && !g.paused && g.dash.run.mode !== 'done') {
          acc -= STEP_MS;
          steps++;
          const flapNow = g.queued;
          g.queued = false;
          if (flapNow) {
            g.flapAnim = 0.18;
            play('hop');
            g.flaps.push(g.dash.run.t);
          }
          const { event, save } = stepDash(course, g.dash, flapNow, bringRef.current);
          onEvent(event, save);
        }
        if (steps >= MAX_STEPS_A_FRAME) acc = 0;
      } else acc = 0;

      const walls = dashWalls(g.dash);
      const hover = s.mode === 'hover' ? s.hover : null;
      setHud((o) => (o.walls === walls && o.feathers === g.dash.feathers && o.hover === hover && o.potionUsed === g.dash.potionUsed ? o : { walls, feathers: g.dash.feathers, hover, potionUsed: g.dash.potionUsed }));
      stepTrail(g.particles, s.x, s.y, dt, s.mode === 'fly' && !g.paused);
      const pose: FlyerPose = g.dizzy > 0 ? 'dizzy' : s.mode === 'hover' && s.hover === 'perch' ? 'perched' : g.flapAnim > 0 ? 'up' : 'glide';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawScene(ctx, { course, state: s, w, h, time: g.time, reduced, shake: reduced ? 0 : g.shake * 24, flyer: flyerId, shiny, trail: picks.trail, particles: g.particles, pose, labels: null, ghostPath: false });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      clearTimeout(bubbleTimer.current);
    };
    // The dash is made once for this start reply.
  }, []);

  const g = G.current as Game;
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
  const feathers = Array.from({ length: DASH_FEATHERS_MAX }, (_, i) => i < hud.feathers);

  return (
    <div
      className="tf-play tf-play--dash"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('[data-noflap]')) return;
        flap();
      }}
    >
      <div className="tf-stage" ref={stageRef}>
        <canvas ref={canvasRef} className="tf-canvas" role="img" aria-label="Sky Dash. Tap, click or press Space to flap. One bump ends the dash." />
        <div className="tf-hud">
          <div className="tf-hud__left">
            <span className="tf-time" aria-label={`${hud.walls} walls`}>{hud.walls}<small> walls</small></span>
            <span className="tf-chip" aria-label={`${hud.feathers} spare feathers`} title="Spare feathers: each saves you from one bump">
              {feathers.map((on, i) => <span key={i} aria-hidden="true" style={{ opacity: on ? 1 : 0.3 }}>🪶</span>)}
            </span>
            {hud.potionUsed && <span className="tf-chip tf-chip--good">Potion used</span>}
          </div>
          <div className="tf-hud__right">
            <button type="button" className="tf-btn tf-btn--small" data-noflap onClick={askLeave}>Leave</button>
          </div>
        </div>
        {confirm && (
          <div className="tf-confirm" role="alertdialog" aria-label="Leave this dash?" data-noflap>
            <div className="tf-confirm__box">
              <p><strong>Leave this dash?</strong></p>
              <p>It won't be saved.</p>
              <div className="tf-row">
                <button type="button" className="tf-btn" onClick={stay} autoFocus>Keep flying</button>
                <button type="button" className="tf-btn tf-btn--ghost" onClick={onLeave}>Leave</button>
              </div>
            </div>
          </div>
        )}
        {saving && <div className="tf-saving" role="status">Checking your dash…</div>}
      </div>
      <div className="tf-dock">
        {bubble && <div className="tf-bubble" role="status">{bubble}</div>}
        {hud.hover === 'start' && !card && (
          <div className="tf-tap tf-tap--start">
            <span className="tf-tap__text">Tap to start</span>
            <span className="tf-tap__sub">One bump ends the dash. Checks give spare feathers.</span>
            {progress.potions > 0 && (
              <label className="tf-dash-potion" data-noflap>
                <input type="checkbox" checked={bring} onChange={(e) => setBring(e.target.checked)} />
                <PotionIcon /> Bring a revive potion (used only if a bump would end the dash)
              </label>
            )}
          </div>
        )}
        {hud.hover === 'perch' && !card && !confirm && (
          <div className="tf-tap"><span className="tf-tap__text">Tap to fly on</span></div>
        )}
        {hud.hover === 'bump' && !confirm && !saving && (
          <div className="tf-tap tf-tap--small"><span className="tf-tap__text">Tap to fly again</span></div>
        )}
      </div>
      <button type="button" className="tf-pad" data-noflap onPointerDown={(e) => { e.stopPropagation(); flap(); }} onClick={(e) => { if (e.detail === 0) flap(); }}>
        Tap to flap
      </button>
      <p className="tf-sr" aria-live="polite">{announce}</p>
      {q && (
        <div data-noflap>
          <QuestionModal
            question={{ id: q.slot, parts: q.parts, spoken: q.spoken, prompt: q.prompt, choices: q.choices, choiceLabels: q.choiceLabels, maxLength: q.maxLength, input: q.input }}
            title="Check!"
            note="Right answer: a spare feather. The dash is paused."
            onSubmit={async (value, ms): Promise<MarkedAnswer> => {
              const r = await backend.answer(start.seed, q.slot, value, ms);
              return { correct: r.correct, fact: factText(q.parts, r.answer), boxBefore: 0, boxAfter: 0, answer: r.answer, ...(r.correct ? { reward: 'A spare feather!' } : {}) };
            }}
            onDone={(res) => {
              if (res.correct) earnFeather(g.dash);
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
