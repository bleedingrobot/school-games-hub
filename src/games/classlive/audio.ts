/**
 * Class Live's projector sounds: all made with the Web Audio API (no files), only played on the teacher's screen. The
 * AudioContext is made on the first sound (browsers need a tap first), repeats are rate-limited, and every call is wrapped
 * so a browser without audio just stays quiet.
 */
export type SoundName = 'twinkle' | 'whoosh' | 'chime' | 'glow' | 'swell' | 'fanfare' | 'drum' | 'roar' | 'hop' | 'flip' | 'reveal';

export interface ClassLiveSound {
  play(name: SoundName): void;
  muted(): boolean;
  setMuted(on: boolean): void;
}

const KEY = 'classlive-muted';
const BIG: SoundName[] = ['swell', 'fanfare', 'drum', 'roar', 'reveal'];

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
function keepMuted(on: boolean) {
  try {
    if (on) window.localStorage.setItem(KEY, '1');
    else window.localStorage.removeItem(KEY);
  } catch { /* storage can be blocked */ }
}

type Ctx = AudioContext;

function tone(ctx: Ctx, out: AudioNode, freq: number, at: number, dur: number, type: OscillatorType, peak: number, to?: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (to) o.frequency.exponentialRampToValueAtTime(to, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.03, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + dur + 0.05);
}

function noise(ctx: Ctx, out: AudioNode, at: number, dur: number, from: number, to: number, peak: number) {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 2;
  f.frequency.setValueAtTime(from, at);
  f.frequency.exponentialRampToValueAtTime(to, at + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(out);
  src.start(at);
}

/** Each sound has three takes, played in turn, each a little higher or lower too, so a sound heard 30 times in a game
 *  never sounds the same twice running (James, 24 Nov 2026: more variety in the sounds). */
export const TAKES = 3;
const SHIFT = [1, 1.122, 0.891];
const TWINKLES = [[1568, 2093], [1760, 2349], [1319, 1976, 2637]];
const CHIMES = [[1047, 1319, 1568, 2093], [1568, 1319, 1568, 2093], [1175, 1397, 1760, 2349]];
const FANFARES = [[523, 659, 784, 1047, 784, 1047, 1319], [392, 523, 659, 784, 659, 784, 1047], [587, 740, 880, 1175, 880, 1175, 1480]];

function voice(ctx: Ctx, out: AudioNode, name: SoundName, take: number, jitter: number) {
  const t = ctx.currentTime + 0.01;
  const v = take % TAKES;
  const k = SHIFT[v] * jitter;
  switch (name) {
    case 'twinkle':
      TWINKLES[v].forEach((f, i) => tone(ctx, out, f * jitter, t + i * 0.09, 0.35 + i * 0.05, 'sine', 0.22 - i * 0.05));
      break;
    case 'whoosh':
      noise(ctx, out, t, [0.7, 0.55, 0.9][v], 300 * k, [3200, 4200, 2400][v] * jitter, 0.35);
      break;
    case 'chime':
      CHIMES[v].forEach((f, i) => tone(ctx, out, f * jitter, t + i * 0.1, 1.1, 'sine', 0.2));
      break;
    case 'glow':
      tone(ctx, out, 660 * k, t, 0.7, 'triangle', 0.2, 990 * k);
      tone(ctx, out, 1320 * k, t + 0.1, 0.6, 'sine', 0.1);
      break;
    case 'swell':
      [196, 247, 294, 392].forEach((f, i) => tone(ctx, out, f * k, t + i * 0.15, 2.4, 'sawtooth', 0.07, f * k * 1.5));
      tone(ctx, out, 98 * k, t, 2.6, 'sine', 0.25, 147 * k);
      break;
    case 'fanfare':
      FANFARES[v].map((f) => f * jitter).forEach((f, i) => {
        tone(ctx, out, f, t + i * 0.13, i === 6 ? 1.2 : 0.3, 'square', 0.1);
        tone(ctx, out, f / 2, t + i * 0.13, i === 6 ? 1.2 : 0.3, 'triangle', 0.14);
      });
      noise(ctx, out, t + 0.9, 1.0, 4000, 800, 0.12);
      break;
    case 'roar':
      tone(ctx, out, 90 * k, t, 1.6, 'sawtooth', 0.22, 45 * k);
      tone(ctx, out, 135 * k, t + 0.05, 1.5, 'square', 0.08, 60 * k);
      tone(ctx, out, 60 * k, t, 1.8, 'sine', 0.35, 38 * k);
      noise(ctx, out, t, [1.4, 1.1, 1.7][v], 700 * k, 150 * k, 0.3);
      if (v === 1) tone(ctx, out, 180 * jitter, t + 0.5, 0.9, 'sawtooth', 0.08, 70);
      break;
    case 'hop':
      tone(ctx, out, 520 * k, t, 0.14, 'triangle', 0.18, 880 * k);
      break;
    case 'flip':
      tone(ctx, out, 420 * k, t, 0.12, 'triangle', 0.18, 840 * k);
      tone(ctx, out, 1760 * k, t + 0.1, 0.25, 'sine', 0.1);
      break;
    case 'reveal':
      // A rising shimmer while the tiles flip in a wave, then the fanfare.
      noise(ctx, out, t, 1.8, 400, 5000, 0.3);
      [392, 494, 587, 784].forEach((f, i) => tone(ctx, out, f * k, t + i * 0.28, 0.9, 'triangle', 0.14));
      FANFARES[v].map((f) => f * jitter).forEach((f, i) => {
        tone(ctx, out, f, t + 1.8 + i * 0.13, i === 6 ? 1.4 : 0.3, 'square', 0.1);
        tone(ctx, out, f / 2, t + 1.8 + i * 0.13, i === 6 ? 1.4 : 0.3, 'triangle', 0.14);
      });
      break;
    case 'drum':
      tone(ctx, out, 140 * k, t, 0.5, 'sine', 0.6, 40);
      noise(ctx, out, t, 0.12, 900 * k, 300, 0.2);
      if (v === 2) { tone(ctx, out, 160 * jitter, t + 0.16, 0.4, 'sine', 0.45, 45); noise(ctx, out, t + 0.16, 0.1, 1000, 300, 0.15); }
      break;
  }
}

export function makeClassLiveSound(): ClassLiveSound {
  let mute = readMuted();
  let ctx: Ctx | null = null;
  let master: GainNode | null = null;
  const recent: number[] = [];
  const last: Partial<Record<SoundName, number>> = {};
  const takes: Partial<Record<SoundName, number>> = {};
  return {
    play(name) {
      if (mute) return;
      try {
        const now = Date.now();
        if (now - (last[name] ?? 0) < 150) return;
        while (recent.length && now - recent[0] > 1000) recent.shift();
        if (recent.length >= 6 && !BIG.includes(name)) return;
        last[name] = now;
        recent.push(now);
        if (!ctx) {
          const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (!AC) return;
          ctx = new AC();
          master = ctx.createGain();
          master.gain.value = 0.6;
          master.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
        const take = takes[name] ?? 0;
        takes[name] = take + 1;
        voice(ctx, master as GainNode, name, take, 0.97 + Math.random() * 0.06);
      } catch { /* no audio here: stay quiet */ }
    },
    muted: () => mute,
    setMuted(on) {
      mute = on;
      keepMuted(on);
    },
  };
}

export function silentSound(): ClassLiveSound {
  let mute = false;
  return { play: () => undefined, muted: () => mute, setMuted: (on) => void (mute = on) };
}
