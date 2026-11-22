/**
 * One go at a road (docs/CIRCUIT-PLAN.md, section 4): the three.js picture (lazy loaded), the dashboard, keys and touch.
 *
 * The physics runs at a fixed 30 steps a second whatever the screen does; if the page falls more than 3 steps behind it
 * drops the time instead of racing to catch up (as OpenRoads does), and the picture draws between the last two steps.
 * Every step's input goes to the recorder, which the server replays at the finish. A crash or fall restarts the road
 * after 1.5 s (kind crashes), with a fresh recording; only the finishing go is sent.
 */
import { useEffect, useRef, useState } from 'react';
import { DT, FULL, TOP_SPEED } from '../../../shared/circuit/config';
import { timeText } from '../../../shared/circuit/game';
import { encodeLog, inputCode, makeRecorder } from '../../../shared/circuit/inputs';
import { newRace, readyToRestart, step, type RaceEvent, type RaceState } from '../../../shared/circuit/physics';
import type { Road } from '../../../shared/circuit/road';
import { playSound, type GameSound } from '../sounds';
import { Controls } from './controls';
import type { RaceView } from './renderer';
import { Volt } from './Volt';

/** Most steps run for one frame; a slower page drops time instead. */
const MAX_CATCH_UP = 3;
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
}

const dashOf = (s: RaceState, length: number): Dash => ({
  speed: s.vz / TOP_SPEED, battery: s.battery / FULL, signal: s.signal / FULL, progress: Math.min(1, s.z / length),
  autoPilot: s.autoPilotOn, time: s.steps, outcome: s.outcome,
});

export function RaceScreen({ road, number, sound, onFinish, onQuit }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const controls = useRef(new Controls());
  const [started, setStarted] = useState(false);
  const startedRef = useRef(false);
  const [dash, setDash] = useState<Dash>(() => dashOf(newRace(road), road.length));
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
    let cur = newRace(road);
    let prev = cur;
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

    const fit = () => {
      const el = box.current;
      if (el && view) view.resize(el.clientWidth, el.clientHeight);
    };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    if (box.current && observer) observer.observe(box.current);

    import('./renderer').then(({ createView }) => {
      if (stopped || !canvas.current) return;
      try {
        view = createView(canvas.current, road, { reduced });
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
      if (startedRef.current) {
        acc = Math.min(acc + seconds, MAX_CATCH_UP * DT);
        while (acc >= DT) {
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
              if (r.events.includes('recharge')) showTip('Recharged! Full battery and signal.', 1600);
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
              cur = newRace(road);
              prev = cur;
              recorder = makeRecorder();
              controls.current.clear();
              view?.restart();
            }
          }
          if (++dashSteps % 3 === 0) setDash(dashOf(cur, road.length));
        }
        if (cur.battery < FULL * 0.25 && cur.outcome === 'racing' && dashSteps % 90 === 0) showTip('Battery low! Find a blue port, or ease off the speed.');
      }
      view?.draw(prev, cur, startedRef.current ? acc / DT : 1, seconds);
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
  }, [road]);

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
          <span className="cr-dash__name">{number}. {road.def.name}</span>
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
          <h2 className="cr-ready__title">{number}. {road.def.name}</h2>
          <button type="button" className="cr-btn cr-btn--go" onClick={go} autoFocus>GO <small>(Enter)</small></button>
        </div>
      )}
      {slow && <span className="cr-slow">Lighter look for this device</span>}
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
