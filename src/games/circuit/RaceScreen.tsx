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
 */
import { useEffect, useRef, useState } from 'react';
import { DT, FULL, HALF_REFILL, TOP_SPEED } from '../../../shared/circuit/config';
import type { RunMaths } from '../../../shared/circuit/maths';
import type { PublicQuestion } from '../../../shared/maths/serverQuestions';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import type { AnswerReply } from './backend';
import { timeText } from '../../../shared/circuit/game';
import { encodeLog, inputCode, makeRecorder } from '../../../shared/circuit/inputs';
import { newRace, readyToRestart, step, type RaceEvent, type RaceOptions, type RaceState } from '../../../shared/circuit/physics';
import type { Road } from '../../../shared/circuit/road';
import { playSound, type GameSound } from '../sounds';
import { Controls } from './controls';
import type { RaceView } from './renderer';
import { Volt } from './Volt';

/** Most steps run for one frame; a slower page drops time instead. */
const MAX_CATCH_UP = 3;
/** A data gate's question shows this many rows before the split; the race runs at SLOW_MOTION for the last SLOW_ROWS (about 4 s at top speed). */
const SHOW_ROWS = 48;
const SLOW_MOTION = 0.35;
const SLOW_ROWS = Math.round(TOP_SPEED * 4 * SLOW_MOTION);
const SOUNDS: Partial<Record<RaceEvent, GameSound>> = {
  jump: 'hop', crash: 'boom', bonk: 'knock', recharge: 'heal', finish: 'win', fall: 'end', outOfBattery: 'end', outOfSignal: 'end', autopilot: 'zap',
};
const WHY: Record<string, string> = {
  crashed: 'Crash! Hit walls slower than half speed.',
  fell: 'Off the road! Jump the gaps with Space.',
  outOfBattery: 'Flat battery! Drive a bit slower, or find a blue port.',
  outOfSignal: 'Signal lost! Keep moving to the port.',
};

interface Props {
  road: Road;
  /** Road number in its world (1 to 6), for the heading. */
  number: number;
  sound: boolean;
  /** The go's questions, or null with maths off. */
  maths?: RunMaths | null;
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
    gate: maths && ahead <= SHOW_ROWS ? s.gatesPassed : -1, slow: maths && ahead <= SLOW_ROWS,
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

export function RaceScreen({ road, number, sound, maths = null, onAnswer, onFinish, onQuit }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const controls = useRef(new Controls());
  const [started, setStarted] = useState(false);
  const startedRef = useRef(false);
  // Each port's refill, filled in as the server marks answers (the physics reads it on the step after the port).
  const refills = useRef<number[]>(maths ? maths.ports.map(() => HALF_REFILL) : []);
  const answered = useRef(new Set<number>());
  const raceOpts = useRef<RaceOptions>(maths ? { refills: refills.current, gateRight: maths.gates.map((g) => g.rightLane) } : {});
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
  };

  useEffect(() => {
    box.current?.focus();
  }, []);

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
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const showTip = (text: string, ms = 2500) => {
      setTip(text);
      if (tipTimer) clearTimeout(tipTimer);
      tipTimer = setTimeout(() => setTip(null), ms);
    };

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
        view = createView(canvas.current, road, { reduced, gates: maths ? maths.gates.map((g) => g.labels) : null });
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
            const input = controls.current.input(cur.vz);
            recorder.record(cur, inputCode(input));
            prev = cur;
            const r = step(cur, input, road);
            cur = r.state;
            if (r.events.length) {
              view?.events(r.events, cur);
              if (soundRef.current) {
                for (const e of r.events) {
                  const s = SOUNDS[e];
                  if (s) playSound(s);
                }
              }
              if (r.events.includes('autopilot')) showTip('Auto-Pilot saved that jump!', 1600);
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
                  if (soundRef.current && right) playSound('zap');
                  showTip(right ? `Right lane: ${label}! Overclock!` : `The answer was ${label}.`, 2600);
                }
              }
            }
            if (cur.outcome !== 'racing' && cur.outcome !== 'finished') {
              lost++;
              setCrashes(lost);
              showTip(WHY[cur.outcome] ?? 'Try again!', 1500);
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
            // Crashed, fell or ran flat: the road restarts after 1.5 s, with a fresh recording.
            prev = cur;
            cur = step(cur, { turn: 0, accel: 0, jump: false }, road).state;
            if (readyToRestart(cur)) {
              cur = newRace(road, opts);
              prev = cur;
              recorder = makeRecorder();
              controls.current.clear();
              view?.restart();
            }
          }
          if (++dashSteps % 3 === 0) setDash(dashOf(cur, road, maths !== null));
        }
        if (cur.battery < FULL * 0.25 && cur.outcome === 'racing' && dashSteps % 90 === 0) showTip('Battery low! Find a blue port, or ease off the speed.');
      }
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
      view?.dispose();
    };
  }, [road, maths]);

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
          <span className="cr-dash__time" aria-label="Time">{timeText(dash.time)}</span>
        </div>
        <div className="cr-dash__progress" aria-label={`Road ${Math.round(dash.progress * 100)}% done`}>
          <span style={{ width: `${dash.progress * 100}%` }} />
        </div>
        <div className="cr-dash__meters">
          <Meter label="Speed" value={dash.speed} colour="#22d3ee" />
          <Meter label="Battery" value={dash.battery} colour={dash.battery < 0.25 ? '#f87171' : '#4ade80'} flash={dash.battery < 0.25} />
          <Meter label="Signal" value={dash.signal} colour={dash.signal < 0.25 ? '#f87171' : '#c084fc'} flash={dash.signal < 0.25} />
          <span className={`cr-light${dash.autoPilot ? ' cr-light--on' : ''}`} title="Auto-Pilot quietly saves near-miss jumps">
            <span aria-hidden="true" className="cr-light__dot" /> Auto-Pilot
          </span>
          {crashes > 0 && <span className="cr-dash__crashes">Crashes: {crashes}</span>}
        </div>
      </div>
      <Volt
        line={tip ?? (!started ? 'Arrows steer and speed up. Space jumps. Reach the big port!' : null)}
      />
      {!started && (
        <div className="cr-ready">
          <h2 className="cr-ready__title">{number > 0 ? `${number}. ` : ''}{road.def.name}</h2>
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
          <button type="button" tabIndex={-1} className="cr-pad" onPointerDown={hold('left', true)} onPointerUp={hold('left', false)} onPointerLeave={hold('left', false)} onPointerCancel={hold('left', false)}>◀</button>
          <button type="button" tabIndex={-1} className="cr-pad" onPointerDown={hold('right', true)} onPointerUp={hold('right', false)} onPointerLeave={hold('right', false)} onPointerCancel={hold('right', false)}>▶</button>
        </div>
        <div className="cr-touch__right">
          <button type="button" tabIndex={-1} className="cr-pad cr-pad--jump" onPointerDown={hold('jump', true)} onPointerUp={hold('jump', false)} onPointerLeave={hold('jump', false)} onPointerCancel={hold('jump', false)}>JUMP</button>
          <div className="cr-lever" onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); lever(e); }} onPointerMove={(e) => { if (e.buttons) lever(e); }}>
            <span className="cr-lever__label">SPEED</span>
            <span className="cr-lever__thumb" style={{ bottom: `${(leverShown ?? dash.speed) * 100}%` }} />
          </div>
        </div>
      </div>
      {dash.outcome !== 'racing' && dash.outcome !== 'finished' && <p className="cr-sr" role="status">{WHY[dash.outcome]}</p>}
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
