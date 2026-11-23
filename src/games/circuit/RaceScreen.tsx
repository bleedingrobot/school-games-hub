/**
 * One go at a road (docs/CIRCUIT-PLAN.md, section 4): the three.js picture (lazy loaded), the dashboard, keys and touch.
 *
 * The physics runs at a fixed 30 steps a second whatever the screen does; if the page falls more than 3 steps behind it
 * drops the time instead of racing to catch up (as OpenRoads does), and the picture draws between the last two steps.
 * Every step's input goes to the recorder, which the server replays at the finish. A crash or fall restarts the road
 * after 1.5 s (kind crashes), with a fresh recording; only the finishing go is sent.
 *
 * Maths (Stage 3): at a recharge port the race pauses (the physics doesn't step, so nothing is recorded) for its question;
 * the server marks it and says how much the port refills, which the physics reads on the next step, as the server's replay
 * will. Before a data gate the question shows over the road, the race slows to a third for about 4 seconds, and the lane
 * the racer is in at the split is its answer; the right lane is an overclock shortcut. A known answer is never asked again
 * after a crash.
 *
 * Stage 4: on roads with checkpoints a crash or fall after one restarts there: the physics does it itself after the 1.5 s
 * pause, so the screen just keeps stepping (recording nothing while the racer is down) and the run stays one recording.
 * Hard mode turns Auto-Pilot off and shows a count-down clock; when it runs out the road starts again (nothing lost).
 *
 * Stage 6, Volt's guide (plan 5.7): a guided go on road 1 teaches one key at a time (steer, then speed, then jump), the key
 * lit on screen; the keys not taught yet do nothing (the recorded inputs are what the physics used, so the replay matches),
 * and the physics bridges every gap until the first jump (RaceOptions.guide, replayed the same on the server). Volt's
 * once-only tips (the first short-circuit tiles, low battery, the first crash, the first data gate) show once a pupil.
 */
import { useEffect, useRef, useState } from 'react';
import { DT, FULL, HALF_REFILL, STEPS_PER_SECOND, TOP_SPEED } from '../../../shared/circuit/config';
import type { RunMaths } from '../../../shared/circuit/maths';
import type { PublicQuestion } from '../../../shared/maths/serverQuestions';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import type { AnswerReply } from './backend';
import { hardSeconds, timeText } from '../../../shared/circuit/game';
import { encodeLog, inputCode, makeRecorder } from '../../../shared/circuit/inputs';
import { newRace, readyToRestart, step, willRespawn, type RaceEvent, type RaceOptions, type RaceState } from '../../../shared/circuit/physics';
import type { Road } from '../../../shared/circuit/road';
import { cellAt } from '../../../shared/circuit/road';
import type { TipId } from '../../../shared/circuit/game';
import { GUIDE, TIP_LINES, voltSays, type GuideStep } from './voiceLines';
import { circuitSound, makeEngine, type CircuitSound } from './audio';
import dashFrame from './art/paint/dash/frame.webp';
import dashSmall from './art/paint/dash/frame-small.webp';
import { Controls } from './controls';
import type { RaceView } from './renderer';
import { Volt } from './Volt';

/** Most steps run for one frame; a slower page drops time instead. */
const MAX_CATCH_UP = 3;
/** A data gate's question shows this many rows before the split; the race runs at SLOW_MOTION for the last SLOW_ROWS (about 4 s at top speed). */
const SHOW_ROWS = 48;
const SLOW_MOTION = 0.35;
const SLOW_ROWS = Math.round(TOP_SPEED * 4 * SLOW_MOTION);
const SOUNDS: Partial<Record<RaceEvent, CircuitSound>> = {
  jump: 'jump', land: 'land', crash: 'crash', bonk: 'bonk', recharge: 'recharge', finish: 'finish', fall: 'fall', outOfBattery: 'flat',
  outOfSignal: 'flat', autopilot: 'autopilot', checkpoint: 'checkpoint', outOfTime: 'flat',
};
/** Tiles with their own sound as the racer drives onto them ('?' only when it boosts). */
const SURFACE: Record<string, CircuitSound> = { '>': 'boost', r: 'resistor', g: 'gel' };
const WHY: Record<string, string> = {
  crashed: 'Crash! Hit walls slower than half speed.',
  fell: 'Off the road! Jump the gaps with Space.',
  outOfBattery: 'Flat battery! Drive a bit slower, or find a blue port.',
  outOfSignal: 'Signal lost! Keep moving to the port.',
  outOfTime: 'Time’s up! Hard mode starts again. Nothing lost.',
};

interface Props {
  road: Road;
  /** Road number in its world (1 to 6), for the heading. */
  number: number;
  sound: boolean;
  /** The go's questions, or null with maths off. */
  maths?: RunMaths | null;
  /** Hard mode: no Auto-Pilot, a count-down clock. */
  hard?: boolean;
  /** The pupil's racer colour (RACERS). */
  colour?: string;
  /** Volt's guided go (road 1): one key at a time, the gaps bridged until the first jump. */
  guide?: boolean;
  /** Volt's tips the pupil has seen, and how to save one as seen. */
  seen?: readonly TipId[];
  onSeen?(tip: TipId): void;
  /** Sends a recharge port's answer to the server to be marked. */
  onAnswer?(slot: number, answer: number, ms: number): Promise<AnswerReply>;
  /** The finishing go's inputs and the crashes before it. */
  onFinish(inputs: string, crashes: number, state: RaceState): void;
  onQuit(): void;
}

interface Dash {
  speed: number;
  battery: number;
  signal: number;
  progress: number;
  autoPilot: boolean;
  time: number;
  outcome: RaceState['outcome'];
  /** The data gate whose question is showing (-1: none), and whether the race is in its slow motion. */
  gate: number;
  slow: boolean;
  /** Down, and about to restart at a checkpoint. */
  respawning: boolean;
}

/** Rows to the next data gate's split, or Infinity. */
const toGate = (s: RaceState, road: Road): number => {
  const next = road.gates[s.gatesPassed];
  return next && s.outcome === 'racing' ? next.first - s.z : Infinity;
};

const dashOf = (s: RaceState, road: Road, maths: boolean): Dash => {
  const ahead = toGate(s, road);
  return {
    speed: s.vz / TOP_SPEED, battery: s.battery / FULL, signal: s.signal / FULL, progress: Math.min(1, s.z / road.length),
    autoPilot: s.autoPilotOn, time: s.steps, outcome: s.outcome,
    gate: maths && ahead <= SHOW_ROWS ? s.gatesPassed : -1, slow: maths && ahead <= SLOW_ROWS, respawning: willRespawn(s),
  };
};

const FRACTION = /^(?:(\d+|\?) )?(\d+|\?)\/(\d+|\?)$/;

/** A question on one line over the road: fractions stacked, '?' as a blank, words smaller (every ladder kind; QuestionModal's way). */
function QuestionLine({ q }: { q: PublicQuestion }) {
  const fill = (t: string) => (t === '?' ? <span className="cr-q__blank" /> : t);
  return (
    <span className="cr-q" role="img" aria-label={q.spoken}>
      {q.prompt && <span className="cr-q__prompt">{q.prompt}</span>}
      <span className="cr-q__parts" aria-hidden="true">
        {q.parts.map((part, i) => {
          const f = FRACTION.exec(part);
          if (f) {
            return (
              <span key={i} className="cr-frac">
                {f[1] !== undefined && <span>{fill(f[1])}</span>}
                <span className="cr-frac__stack"><span>{fill(f[2])}</span><span>{fill(f[3])}</span></span>
              </span>
            );
          }
          const gap = /^\?([,;]?)$/.exec(part);
          if (gap) return <span key={i}><span className="cr-q__blank" />{gap[1]}</span>;
          return <span key={i} className={/[a-z]/i.test(part) ? 'cr-q__word' : undefined}>{part}</span>;
        })}
      </span>
    </span>
  );
}

/** Rows before the first short-circuit tile where Volt points at it. */
const SHORT_WARN_ROWS = 28;
/** Steps of steering before the guide moves on to speed. */
const STEER_STEPS = 20;
/** Is the battery low enough for Volt's "Find a blue port!" (once a pupil). */
const BATTERY_TIP = 0.35;

/** The first row with a short-circuit tile, or -1. */
const firstShort = (road: Road): number => {
  const i = road.cells.indexOf('x');
  return i < 0 ? -1 : Math.floor(i / 7);
};

export function RaceScreen({ road, number, sound, maths = null, hard = false, colour, guide = false, seen = [], onSeen, onAnswer, onFinish, onQuit }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const controls = useRef(new Controls());
  const [started, setStarted] = useState(false);
  const startedRef = useRef(false);
  // Each port's refill, filled in as the server marks answers (the physics reads it on the step after the port).
  const refills = useRef<number[]>(maths ? maths.ports.map(() => HALF_REFILL) : []);
  const answered = useRef(new Set<number>());
  const clock = hard ? hardSeconds(road.def.id) * STEPS_PER_SECOND : 0;
  const raceOpts = useRef<RaceOptions>({
    ...(maths ? { refills: refills.current, gateRight: maths.gates.map((g) => g.rightLane) } : {}),
    autoPilot: !hard, timeLimit: clock, guide,
  });
  // The guided go's step (null: not guided, or done) and the tips seen (this go adds to them at once).
  const [teach, setTeach] = useState<GuideStep | null>(guide ? 'steer' : null);
  const teachRef = useRef(teach);
  teachRef.current = teach;
  const seenRef = useRef(new Set<TipId>(seen));
  const onSeenRef = useRef(onSeen);
  onSeenRef.current = onSeen;
  const [voltLine, setVoltLine] = useState<{ text: string; point: boolean } | null>(null);
  const paused = useRef(false);
  const [ask, setAsk] = useState<{ port: number; question: PublicQuestion } | null>(null);
  const askRef = useRef(ask);
  askRef.current = ask;
  const resume = useRef(() => {});
  /** When the last port question closed: the Escape that skipped it must not also leave the race. */
  const closedAt = useRef(-1e9);
  const [dash, setDash] = useState<Dash>(() => dashOf(newRace(road, raceOpts.current), road, !!maths));
  const [crashes, setCrashes] = useState(0);
  const [tip, setTip] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  const quitRef = useRef(onQuit);
  quitRef.current = onQuit;

  const go = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStarted(true);
    if (soundRef.current) circuitSound('go');
  };

  useEffect(() => {
    box.current?.focus();
  }, []);

  // Volt says each guide step as it comes (with the sound on); the last one fades after a few seconds.
  useEffect(() => {
    if (!teach) return;
    voltSays(GUIDE[teach], soundRef.current);
    if (teach === 'go') {
      const t = setTimeout(() => setTeach(null), 5000);
      return () => clearTimeout(t);
    }
  }, [teach]);

  // Keys: the race keys, Enter to start, Escape back to the roads.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // A port question is open (or has only just closed): its box has the keys (Escape skips it there).
      if (askRef.current || performance.now() - closedAt.current < 400) return;
      if (e.code === 'Escape') {
        quitRef.current();
        return;
      }
      if ((e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') && !startedRef.current) {
        e.preventDefault();
        go();
        return;
      }
      if (controls.current.press(e.code)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => controls.current.release(e.code);
    const blur = () => controls.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // The loop: fixed steps, recorded inputs, the picture between steps.
  useEffect(() => {
    let view: RaceView | null = null;
    let stopped = false;
    let frame = 0;
    const opts = raceOpts.current;
    let cur = newRace(road, opts);
    let prev = cur;
    let lastPort = -1;
    let recorder = makeRecorder();
    let lost = 0;
    let acc = 0;
    let last = performance.now();
    let dashSteps = 0;
    let slowFrames = 0;
    let frames = 0;
    let sentFinish = false;
    let tipTimer: ReturnType<typeof setTimeout> | null = null;
    const engine = makeEngine();
    let lastSurface = '.';
    let lastTick = -1;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const showTip = (text: string, ms = 2500) => {
      setTip(text);
      if (tipTimer) clearTimeout(tipTimer);
      tipTimer = setTimeout(() => setTip(null), ms);
    };
    // Volt's once-only tips: said once a pupil, saved as seen at once.
    let voltTimer: ReturnType<typeof setTimeout> | null = null;
    const once = (id: Exclude<TipId, 'guide'>, point = false): boolean => {
      if (seenRef.current.has(id)) return false;
      seenRef.current.add(id);
      onSeenRef.current?.(id);
      setVoltLine({ text: TIP_LINES[id], point });
      voltSays(TIP_LINES[id], soundRef.current);
      if (voltTimer) clearTimeout(voltTimer);
      voltTimer = setTimeout(() => setVoltLine(null), 5500);
      return true;
    };
    const shortRow = firstShort(road);
    let steered = 0;

    resume.current = () => {
      paused.current = false;
      last = performance.now();
      acc = 0;
      controls.current.clear();
    };

    const fit = () => {
      const el = box.current;
      if (el && view) view.resize(el.clientWidth, el.clientHeight);
    };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    if (box.current && observer) observer.observe(box.current);

    import('./renderer').then(({ createView }) => {
      if (stopped || !canvas.current) return;
      try {
        view = createView(canvas.current, road, { reduced, gates: maths ? maths.gates.map((g) => g.labels) : null, hard, colour, guide });
        fit();
      } catch {
        showTip('This device can’t draw the 3D road. Try another browser.', 60_000);
      }
    }).catch(() => showTip('The road couldn’t load. Check the internet and try again.', 60_000));

    const tick = (now: number) => {
      if (stopped) return;
      frame = requestAnimationFrame(tick);
      const seconds = Math.min(0.25, Math.max(0, (now - last) / 1000));
      last = now;
      if (startedRef.current && !paused.current) {
        // Before a data gate with maths, the race runs slower so there's time to read the signs.
        const slowNow = maths !== null && toGate(cur, road) <= SLOW_ROWS;
        acc = Math.min(acc + seconds * (slowNow ? SLOW_MOTION : 1), MAX_CATCH_UP * DT);
        while (acc >= DT && !paused.current) {
          acc -= DT;
          if (cur.outcome === 'racing') {
            const raw = controls.current.input(cur.vz);
            // The guided go: keys not taught yet do nothing (what's recorded is what the physics used).
            const now = teachRef.current;
            const input = now === 'steer' ? { ...raw, accel: 0 as const, jump: false } : now === 'speed' ? { ...raw, jump: false } : raw;
            if (now === 'steer' && input.turn !== 0 && ++steered === STEER_STEPS) setTeach((t) => (t === 'steer' ? 'speed' : t));
            else if (now === 'speed' && cur.vz >= TOP_SPEED * 0.5) setTeach((t) => (t === 'speed' ? 'jump' : t));
            recorder.record(cur, inputCode(input));
            prev = cur;
            const r = step(cur, input, road);
            cur = r.state;
            if (guide && r.events.includes('jump')) {
              if (teachRef.current === 'jump') setTeach('go');
              view?.bridgesTo(cur.bridges);
            }
            if (r.events.length) {
              view?.events(r.events, cur);
              if (soundRef.current) {
                for (const e of r.events) {
                  const s = SOUNDS[e];
                  if (s) circuitSound(s);
                }
              }
              if (r.events.includes('autopilot')) showTip('Auto-Pilot saved that jump!', 1600);
              if (r.events.includes('checkpoint')) showTip('Checkpoint! Crash now and you restart here.', 1800);
              if (r.events.includes('recharge')) {
                const full = !maths || (refills.current[lastPort] ?? HALF_REFILL) >= 1;
                showTip(full ? 'Recharged! Full battery and signal.' : 'Half charge. Keep going!', 1600);
              }
              if (r.events.includes('port') && maths) {
                // Maths on: the race waits here for the port's question (only once a go: a known answer isn't asked again).
                lastPort = cur.pendingPort;
                const question = maths.ports[lastPort];
                if (question && !answered.current.has(lastPort)) {
                  paused.current = true;
                  controls.current.clear();
                  setAsk({ port: lastPort, question });
                }
              }
              if (r.events.includes('gate') && maths) {
                const g = cur.gatesPassed - 1;
                const gate = maths.gates[g];
                if (gate) {
                  const label = gate.labels[road.gates[g].lanes.indexOf(gate.rightLane)] ?? '';
                  const right = cur.choices[g] === gate.rightLane;
                  view?.gateResult(g, gate.rightLane);
                  if (soundRef.current) circuitSound(right ? 'gateRight' : 'gateWrong');
                  showTip(right ? `Right lane: ${label}! Overclock!` : `The answer was ${label}.`, 2600);
                }
              }
            }
            // Driving onto a boost, resistor or gel tile has its sound; the hard-mode clock ticks in its last 10 seconds.
            const row = Math.floor(cur.z);
            const surface = cur.grounded && cur.outcome === 'racing' ? cellAt(road, Math.floor(cur.x), row) : '.';
            if (surface !== lastSurface && soundRef.current) {
              const boostedGate = surface === '?' && (!maths || cur.boostGate === road.gateAt[row]);
              const s = boostedGate ? 'boost' : SURFACE[surface];
              if (s && SURFACE[lastSurface] !== s) circuitSound(s);
            }
            lastSurface = surface;
            if (clock > 0 && cur.outcome === 'racing') {
              const left = Math.ceil((clock - cur.steps) / STEPS_PER_SECOND);
              if (left <= 10 && left > 0 && left !== lastTick && soundRef.current) circuitSound('tick');
              lastTick = left;
            }
            if (cur.outcome !== 'racing' && cur.outcome !== 'finished') {
              lost++;
              setCrashes(lost);
              // The first crash ever: Volt's kind tip, once. After that the short reason.
              if (!once('crash')) showTip(WHY[cur.outcome] ?? 'Try again!', 1500);
            } else if (cur.outcome === 'racing') {
              if (shortRow >= 0 && cur.z >= shortRow - SHORT_WARN_ROWS && cur.z < shortRow) once('short', true);
              if (cur.battery < FULL * BATTERY_TIP) once('battery');
              if (maths && cur.gatesPassed < road.gates.length && road.gates[cur.gatesPassed].first - cur.z <= SHOW_ROWS) once('gate', true);
            }
          } else if (cur.outcome === 'finished') {
            prev = cur;
            if (!sentFinish) {
              sentFinish = true;
              const inputs = encodeLog(recorder.log);
              const at = cur;
              setTimeout(() => finishRef.current(inputs, lost, at), 900);
            }
          } else {
            // Crashed, fell or ran flat: after 1.5 s the physics restarts at the last checkpoint (same recording), or the
            // road starts again with a fresh recording.
            prev = cur;
            const r = step(cur, { turn: 0, accel: 0, jump: false }, road);
            cur = r.state;
            if (r.events.includes('respawn')) {
              prev = cur;
              controls.current.clear();
              view?.respawned(cur);
              showTip('Back to the checkpoint!', 1400);
            }
            if (readyToRestart(cur)) {
              cur = newRace(road, opts);
              prev = cur;
              recorder = makeRecorder();
              controls.current.clear();
              view?.restart();
              if (guide) view?.bridgesTo(cur.bridges);
            }
          }
          if (++dashSteps % 3 === 0) setDash(dashOf(cur, road, maths !== null));
        }
        if (cur.battery < FULL * 0.25 && cur.outcome === 'racing' && dashSteps % 90 === 0) showTip('Battery low! Find a blue port, or ease off the speed.');
      }
      engine.set(cur.vz / TOP_SPEED, soundRef.current && startedRef.current && !paused.current && cur.outcome === 'racing');
      view?.draw(prev, cur, startedRef.current && !paused.current ? acc / DT : 1, seconds);
      // Too slow for 30 steps a second (a busy iPad)? Drop the bloom and pixels once.
      frames++;
      slowFrames = seconds > 1 / 24 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (frames > 60 && slowFrames > 45 && view?.lower()) {
        slowFrames = 0;
        setSlow(true);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      if (tipTimer) clearTimeout(tipTimer);
      if (voltTimer) clearTimeout(voltTimer);
      engine.stop();
      view?.dispose();
    };
  }, [road, maths, hard, colour, clock, guide]);

  /** Marks a port answer on the server; the port's refill follows the mark. */
  const markPort = async (value: number, ms: number): Promise<MarkedAnswer> => {
    const open = askRef.current;
    if (!open || !onAnswer) throw new Error('We couldn’t check that one. Skip it for a half charge.');
    const reply = await onAnswer(open.port, value, ms);
    refills.current[open.port] = reply.right ? 1 : HALF_REFILL;
    answered.current.add(open.port);
    const q = open.question;
    const label = q.choices && q.choiceLabels ? (q.choiceLabels[q.choices.indexOf(reply.answer)] ?? String(reply.answer)) : String(reply.answer);
    return { correct: reply.right, fact: `The answer was ${label}. Half charge this time.`, boxBefore: 0, boxAfter: 0, answer: reply.answer, ...(reply.right ? { reward: 'Full battery and signal!' } : {}) };
  };
  const closePort = () => {
    const open = askRef.current;
    // Skipped (or never marked): the server counts it unanswered, which is a half charge.
    if (open) answered.current.add(open.port);
    closedAt.current = performance.now();
    askRef.current = null;
    setAsk(null);
    resume.current();
    box.current?.focus();
  };
  const gateShown = maths && dash.gate >= 0 ? maths.gates[dash.gate] : null;

  const hold = (pad: 'left' | 'right' | 'jump', on: boolean) => () => {
    controls.current.touch[pad] = on;
    if (on) go();
  };
  const lever = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    controls.current.lever = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
    go();
  };
  const leverShown = controls.current.lever;

  return (
    <div className="cr-race" ref={box} tabIndex={-1} aria-label={`Road ${number}: ${road.def.name}`}>
      <canvas ref={canvas} className="cr-race__canvas" aria-hidden="true" />
      <div className="cr-dash" role="group" aria-label="Dashboard">
        <div className="cr-dash__top">
          <button type="button" className="cr-glass" onClick={onQuit} aria-label="Back to the roads (Escape)">← Roads</button>
          <span className="cr-dash__name">{number > 0 ? `${number}. ` : ''}{road.def.name}</span>
          {crashes > 0 && <span className="cr-dash__crashes">Crashes: {crashes}</span>}
          {hard ? (
            <span className="cr-light cr-light--off" title="Hard mode: no Auto-Pilot">
              <span aria-hidden="true" className="cr-light__dot" /> <span className="cr-light__word">Auto-Pilot</span> off
            </span>
          ) : (
            <span className={`cr-light${dash.autoPilot ? ' cr-light--on' : ''}`} title="Auto-Pilot quietly saves near-miss jumps">
              <span aria-hidden="true" className="cr-light__dot" /> <span className="cr-light__word">Auto-Pilot</span>
            </span>
          )}
        </div>
        <div className="cr-dash__progress" aria-label={`Road ${Math.round(dash.progress * 100)}% done`}>
          <span style={{ width: `${dash.progress * 100}%` }} />
        </div>
        {/* The painted dashboard (Stage 5): battery and signal in its two round gauges, the time and speed on its screen. */}
        <div className="cr-panel" style={{ ['--cr-dash' as string]: `url(${dashFrame})`, ['--cr-dash-small' as string]: `url(${dashSmall})` }}>
          <Ring side="left" label="Battery" value={dash.battery} colour={dash.battery < 0.25 ? '#f87171' : '#4ade80'} flash={dash.battery < 0.25} />
          <div className="cr-panel__screen">
            {hard ? (
              <span className={`cr-dash__time cr-dash__time--hard${clock - dash.time < 10 * STEPS_PER_SECOND ? ' cr-dash__time--low' : ''}`} aria-label="Time left">
                🔥 {timeText(Math.max(0, clock - dash.time))}
              </span>
            ) : (
              <span className="cr-dash__time" aria-label="Time">{timeText(dash.time)}</span>
            )}
            <Meter label="Speed" value={dash.speed} colour="#22d3ee" />
          </div>
          <Ring side="right" label="Signal" value={dash.signal} colour={dash.signal < 0.25 ? '#f87171' : '#c084fc'} flash={dash.signal < 0.25} />
        </div>
      </div>
      <Volt
        point={!!voltLine?.point}
        line={voltLine?.text ?? (teach ? GUIDE[teach] : null) ?? tip ?? (!started ? (hard ? `Hard mode: no Auto-Pilot, beat the clock (${hardSeconds(road.def.id)}s)!` : 'Arrows steer and speed up. Space jumps. Reach the big port!') : null)}
      />
      {teach && teach !== 'go' && <TeachKeys step={teach} />}
      {!started && (
        <div className="cr-ready">
          <h2 className="cr-ready__title">{number > 0 ? `${number}. ` : ''}{road.def.name}{hard && <span className="cr-fire"> 🔥 Hard</span>}</h2>
          <button type="button" className="cr-btn cr-btn--go" onClick={go} autoFocus>GO <small>(Enter)</small></button>
        </div>
      )}
      {slow && <span className="cr-slow">Lighter look for this device</span>}
      {gateShown && !ask && (
        <div className={`cr-gate${dash.slow ? ' cr-gate--slow' : ''}`} role="status">
          <p className="cr-gate__label">Data gate</p>
          <p className="cr-gate__question"><QuestionLine q={gateShown.question} /></p>
          <p className="cr-gate__lanes" aria-label={`Lanes, left to right: ${gateShown.labels.filter((l) => l !== null).join(', ')}`}>
            {gateShown.labels.map((l, i) => (l === null ? null : <span key={i} className="cr-gate__lane">{l}</span>))}
          </p>
          <p className="cr-gate__hint">Steer into the lane with the answer. The right lane is an overclock shortcut!</p>
        </div>
      )}
      {ask && (
        <QuestionModal
          question={{ ...ask.question, id: ask.question.slot }}
          title="Recharge port"
          note="The race is paused. Right: full battery and signal. Wrong: half."
          onSubmit={markPort}
          onDone={closePort}
          onClose={closePort}
          closeLabel="Skip (half charge)"
          spot="circuit-port"
          choiceKeys
        />
      )}
      <div className="cr-touch" aria-hidden="true">
        <div className="cr-touch__pads">
          <button type="button" tabIndex={-1} className={`cr-pad${teach === 'steer' ? ' cr-pad--lit' : ''}`} onPointerDown={hold('left', true)} onPointerUp={hold('left', false)} onPointerLeave={hold('left', false)} onPointerCancel={hold('left', false)}>◀</button>
          <button type="button" tabIndex={-1} className={`cr-pad${teach === 'steer' ? ' cr-pad--lit' : ''}`} onPointerDown={hold('right', true)} onPointerUp={hold('right', false)} onPointerLeave={hold('right', false)} onPointerCancel={hold('right', false)}>▶</button>
        </div>
        <div className="cr-touch__right">
          <button type="button" tabIndex={-1} className={`cr-pad cr-pad--jump${teach === 'jump' ? ' cr-pad--lit' : ''}`} onPointerDown={hold('jump', true)} onPointerUp={hold('jump', false)} onPointerLeave={hold('jump', false)} onPointerCancel={hold('jump', false)}>JUMP</button>
          <div className={`cr-lever${teach === 'speed' ? ' cr-lever--lit' : ''}`} onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); lever(e); }} onPointerMove={(e) => { if (e.buttons) lever(e); }}>
            <span className="cr-lever__label">SPEED</span>
            <span className="cr-lever__thumb" style={{ bottom: `${(leverShown ?? dash.speed) * 100}%` }} />
          </div>
        </div>
      </div>
      {dash.outcome !== 'racing' && dash.outcome !== 'finished' && <p className="cr-sr" role="status">{WHY[dash.outcome]}{dash.respawning ? ' Back to the checkpoint.' : ''}</p>}
    </div>
  );
}

/** The guided go's key, lit on screen: the arrows to steer, then for speed, then Space to jump. */
function TeachKeys({ step }: { step: Exclude<GuideStep, 'go'> }) {
  const keys = step === 'steer' ? ['←', '→'] : step === 'speed' ? ['↑', '↓'] : ['Space'];
  const word = step === 'steer' ? 'Steer' : step === 'speed' ? 'Speed' : 'Jump';
  return (
    <div className={`cr-teach cr-teach--${step}`} aria-hidden="true">
      <span className="cr-teach__word">{word}</span>
      <span className="cr-teach__keys">
        {keys.map((k) => <kbd key={k} className={`cr-key${k === 'Space' ? ' cr-key--wide' : ''}`}>{k}</kbd>)}
      </span>
    </div>
  );
}

function Meter({ label, value, colour, flash = false }: { label: string; value: number; colour: string; flash?: boolean }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <span className={`cr-meter${flash ? ' cr-meter--flash' : ''}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <span className="cr-meter__label">{label}</span>
      <span className="cr-meter__bar"><span style={{ width: `${pct}%`, background: colour }} /></span>
    </span>
  );
}

/** A round gauge in one of the painted dashboard's two rings: a glowing arc and the percent in the middle. */
function Ring({ side, label, value, colour, flash = false }: { side: 'left' | 'right'; label: string; value: number; colour: string; flash?: boolean }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const C = 2 * Math.PI * 42;
  return (
    <span className={`cr-ring cr-ring--${side}${flash ? ' cr-ring--flash' : ''}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="42" className="cr-ring__track" />
        <circle cx="50" cy="50" r="42" className="cr-ring__arc" style={{ stroke: colour, strokeDasharray: `${(C * pct) / 100} ${C}` }} />
      </svg>
      <span className="cr-ring__num" style={{ color: colour }}>{pct}</span>
      <span className="cr-ring__label">{label}</span>
    </span>
  );
}
