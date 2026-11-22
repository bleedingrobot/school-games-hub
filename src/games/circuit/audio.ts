/**
 * Circuit Racer's sounds (Stage 5), made in the browser like the shared ones (no files to download), and only played with
 * the sound switch on. The shared sounds (src/games/sounds.ts) are used where they fit; the rest live here so no other game
 * changes: an engine hum that rises with speed, a landing thump, the overclock boost, resistor drag, the gel slide, the
 * wrong-lane buzz and the hard-mode clock ticks.
 */
import { playSound } from '../sounds';

let context: AudioContext | null = null;
const ctx = (): AudioContext | null => {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
};

/** One note sliding from `from` to `to` Hz, shaped by a quick rise and a fall. */
function note(from: number, to: number, seconds: number, volume: number, type: OscillatorType, delay = 0) {
  const c = ctx();
  if (!c) return;
  const at = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + seconds);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + Math.min(0.02, seconds / 4));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + seconds + 0.02);
}

/** A short burst of filtered noise (a whoosh or a hiss). */
function noise(seconds: number, volume: number, fromHz: number, toHz: number, delay = 0) {
  const c = ctx();
  if (!c) return;
  const at = c.currentTime + delay;
  const buffer = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * seconds)), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.5;
  filter.frequency.setValueAtTime(fromHz, at);
  filter.frequency.exponentialRampToValueAtTime(toHz, at + seconds);
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(at);
  src.stop(at + seconds);
}

export type CircuitSound =
  | 'jump' | 'land' | 'boost' | 'resistor' | 'gel' | 'recharge' | 'gateRight' | 'gateWrong' | 'checkpoint' | 'crash' | 'bonk'
  | 'fall' | 'flat' | 'finish' | 'tick' | 'autopilot' | 'go';

export function circuitSound(sound: CircuitSound) {
  switch (sound) {
    case 'jump': return playSound('hop');
    case 'land': note(140, 70, 0.12, 0.18, 'sine'); return noise(0.08, 0.08, 900, 300);
    case 'boost': note(300, 1200, 0.35, 0.08, 'sawtooth'); return noise(0.35, 0.12, 600, 5000);
    case 'resistor': return note(110, 80, 0.3, 0.09, 'square');
    case 'gel': return note(700, 260, 0.4, 0.07, 'sine');
    case 'recharge': return playSound('heal');
    case 'gateRight': return playSound('item');
    case 'gateWrong': note(220, 200, 0.18, 0.1, 'square'); return note(180, 160, 0.22, 0.1, 'square', 0.16);
    case 'checkpoint': return playSound('medal');
    case 'crash': return playSound('boom');
    case 'bonk': return playSound('knock');
    case 'fall': return playSound('black-hole');
    case 'flat': return playSound('end');
    case 'finish': return playSound('badge');
    case 'tick': return note(1800, 1700, 0.05, 0.08, 'square');
    case 'autopilot': return playSound('zap');
    case 'go': [440, 440, 880].forEach((f, i) => note(f, f, i === 2 ? 0.35 : 0.12, 0.12, 'triangle', i * 0.18)); return;
  }
}

/** The engine: a low hum (two detuned saws through a soft filter) whose pitch and loudness follow the speed. */
export interface Engine {
  /** `speed` 0 to 1; `on` false fades it out (paused, crashed, finished, or sound switched off). */
  set(speed: number, on: boolean): void;
  stop(): void;
}

export function makeEngine(): Engine {
  let parts: { oscs: OscillatorNode[]; filter: BiquadFilterNode; gain: GainNode } | null = null;
  const start = () => {
    const c = ctx();
    if (!c) return null;
    const gain = c.createGain();
    gain.gain.value = 0.0001;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    const oscs = [0, 7].map((detune) => {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 55;
      o.detune.value = detune;
      o.connect(filter);
      o.start();
      return o;
    });
    filter.connect(gain).connect(c.destination);
    return { oscs, filter, gain };
  };
  return {
    set(speed, on) {
      if (!on && !parts) return;
      parts ??= start();
      const c = context;
      if (!parts || !c) return;
      const t = c.currentTime;
      const s = Math.max(0, Math.min(1.3, speed));
      for (const o of parts.oscs) o.frequency.setTargetAtTime(48 + s * 120, t, 0.08);
      parts.filter.frequency.setTargetAtTime(300 + s * 1400, t, 0.08);
      parts.gain.gain.setTargetAtTime(on ? 0.018 + s * 0.035 : 0.0001, t, on ? 0.08 : 0.05);
    },
    stop() {
      if (!parts) return;
      const p = parts;
      parts = null;
      try {
        p.gain.gain.setTargetAtTime(0.0001, context?.currentTime ?? 0, 0.03);
        for (const o of p.oscs) o.stop((context?.currentTime ?? 0) + 0.2);
      } catch {
        // Already stopped.
      }
    },
  };
}
