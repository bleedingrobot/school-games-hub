/** Class Showdown projector sound, all synthesised with the Web Audio API (no files). iPads stay silent. */
import { speak, canSpeak } from '../../speech';
import { VOICE_FOLDER } from './voiceLines';

export type SoundName = 'roar' | 'hit' | 'bighit' | 'clang' | 'crack' | 'chime' | 'drum' | 'cheer' | 'fanfare' | 'countdown' | 'whoosh';

export interface ShowdownSound {
  play(name: SoundName): void;
  /** `urgent` lines (the end of the round, the start) never wait for the gap after the last line. */
  say(line: string, urgent?: boolean): void;
  muted: boolean;
  setMuted(b: boolean): void;
}

const MUTE_KEY = 'sgh-showdown-muted';

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** A sound that does nothing, for tests. */
export function silentSound(): ShowdownSound {
  return { play() {}, say() {}, muted: true, setMuted() {} };
}

type Ctx = AudioContext;

/** The same (non-hit) sound plays at most once in this long. */
export const SOUND_GAP_MS = 400;
/** The announcer waits this long after a line before the next, and doesn't repeat a line within `LINE_REPEAT_MS`. */
export const SAY_GAP_MS = 1800;
export const LINE_REPEAT_MS = 8000;

/** Whether the announcer may say `line` now. */
export function sayAllowed(now: number, line: string, lastSaid: number, lastLine: Map<string, number>): boolean {
  if (now - lastSaid < SAY_GAP_MS) return false;
  return now - (lastLine.get(line) ?? -Infinity) >= LINE_REPEAT_MS;
}

export function makeShowdownSound(): ShowdownSound {
  let ctx: Ctx | null = null;
  let master: GainNode | null = null;
  let noiseBuf: AudioBuffer | null = null;
  let hitTimes: number[] = [];
  const lastSound = new Map<string, number>();
  const lastLine = new Map<string, number>();
  let lastSaid = 0;

  const api: ShowdownSound = {
    muted: readMuted(),
    setMuted(b) {
      api.muted = b;
      try { localStorage.setItem(MUTE_KEY, String(b)); } catch { /* storage blocked */ }
      if (master && ctx) master.gain.setTargetAtTime(b ? 0 : 0.7, ctx.currentTime, 0.01);
    },
    play(name) {
      if (api.muted) return;
      try {
        if (name === 'hit' || name === 'bighit') {
          const now = Date.now();
          hitTimes = hitTimes.filter((t) => now - t < 1000);
          if (hitTimes.length >= 5) return;
          hitTimes.push(now);
        } else {
          // The same sound fired by many pupils at once (every pupil's shield in solo) plays once.
          const now = Date.now();
          if (now - (lastSound.get(name) ?? 0) < SOUND_GAP_MS) return;
          lastSound.set(name, now);
        }
        const c = ensure();
        if (!c || !master) return;
        if (c.state === 'suspended') void c.resume().catch(() => {});
        SOUNDS[name](c, master, c.currentTime);
      } catch {
        // Sound is never worth a crash.
      }
    },
    say(line, urgent = false) {
      if (api.muted || !line) return;
      // Never two lines on top of each other, and never the same line again straight away: in solo each pupil's shield
      // held or broke on its own, and the announcer said it once per pupil (24 Nov 2026).
      const now = Date.now();
      if (!sayAllowed(now, line, urgent ? -Infinity : lastSaid, lastLine)) return;
      lastSaid = now;
      lastLine.set(line, now);
      try {
        speak(line, VOICE_FOLDER);
      } catch {
        if (canSpeak()) {
          try {
            const u = new SpeechSynthesisUtterance(line);
            u.pitch = 0.5; u.rate = 0.8;
            window.speechSynthesis.speak(u);
          } catch { /* nothing to do */ }
        }
      }
    },
  };

  function ensure(): Ctx | null {
    if (ctx) return ctx;
    const AC = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = api.muted ? 0 : 0.7;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  // ---- building blocks ----
  function env(c: Ctx, out: AudioNode, t: number, peak: number, attack: number, dur: number): GainNode {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(out);
    return g;
  }
  function tone(c: Ctx, out: AudioNode, t: number, type: OscillatorType, f0: number, f1: number, peak: number, attack: number, dur: number, detune = 0): void {
    const o = c.createOscillator();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o.connect(env(c, out, t, peak, attack, dur));
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function noise(c: Ctx, out: AudioNode, t: number, ftype: BiquadFilterType, f0: number, f1: number, peak: number, attack: number, dur: number): void {
    if (!noiseBuf) return;
    const s = c.createBufferSource();
    s.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = ftype;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    s.connect(f);
    f.connect(env(c, out, t, peak, attack, dur));
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  const SOUNDS: Record<SoundName, (c: Ctx, out: AudioNode, t: number) => void> = {
    roar(c, o, t) {
      tone(c, o, t, 'sawtooth', 110, 55, 0.35, 0.15, 1.4, -12);
      tone(c, o, t, 'sawtooth', 118, 50, 0.35, 0.15, 1.4, 12);
      noise(c, o, t, 'lowpass', 1200, 200, 0.4, 0.1, 1.3);
    },
    hit(c, o, t) {
      noise(c, o, t, 'bandpass', 1800, 600, 0.5, 0.003, 0.12);
      tone(c, o, t, 'sine', 160, 60, 0.6, 0.003, 0.15);
    },
    bighit(c, o, t) {
      noise(c, o, t, 'lowpass', 3000, 300, 0.8, 0.003, 0.35);
      tone(c, o, t, 'sine', 120, 35, 0.9, 0.005, 0.6);
      tone(c, o, t, 'triangle', 220, 70, 0.4, 0.003, 0.25);
    },
    clang(c, o, t) {
      [1, 2.76, 5.4, 8.93, 11.34].forEach((m, i) => tone(c, o, t, 'sine', 330 * m, 330 * m, 0.25 / (i + 1), 0.002, 1.6 - i * 0.15));
      noise(c, o, t, 'highpass', 4000, 4000, 0.3, 0.002, 0.08);
    },
    crack(c, o, t) {
      noise(c, o, t, 'highpass', 800, 3000, 0.7, 0.002, 0.3);
      noise(c, o, t + 0.07, 'bandpass', 2500, 900, 0.5, 0.002, 0.2);
      tone(c, o, t, 'square', 90, 40, 0.3, 0.002, 0.15);
    },
    chime(c, o, t) {
      [784, 988, 1175, 1568].forEach((f, i) => {
        tone(c, o, t + i * 0.09, 'sine', f, f, 0.3, 0.005, 0.9);
        tone(c, o, t + i * 0.09, 'sine', f * 2, f * 2, 0.1, 0.005, 0.5);
      });
    },
    drum(c, o, t) {
      const hits = 14;
      for (let i = 0; i < hits; i++) {
        const tt = t + i * (2 / hits);
        const f = i % 3 === 2 ? 95 : 130;
        tone(c, o, tt, 'sine', f * 1.6, f, 0.45 + i * 0.02, 0.003, 0.18);
        noise(c, o, tt, 'bandpass', 900, 500, 0.12, 0.002, 0.05);
      }
    },
    cheer(c, o, t) {
      noise(c, o, t, 'bandpass', 800, 2200, 0.6, 0.6, 2.0);
      noise(c, o, t, 'bandpass', 1500, 1000, 0.3, 0.8, 1.8);
    },
    fanfare(c, o, t) {
      const chords = [[262, 330, 392], [330, 392, 523], [392, 523, 659], [523, 659, 784]];
      chords.forEach((ch, i) => {
        const tt = t + i * 0.22;
        const dur = i === chords.length - 1 ? 1.2 : 0.3;
        ch.forEach((f) => {
          const g = c.createGain();
          g.gain.value = 1;
          const lp = c.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 1800;
          lp.connect(o);
          tone(c, lp, tt, 'sawtooth', f, f, 0.18, 0.03, dur, -6);
          tone(c, lp, tt, 'sawtooth', f, f, 0.18, 0.03, dur, 6);
        });
      });
    },
    countdown(c, o, t) {
      tone(c, o, t, 'square', 880, 880, 0.3, 0.005, 0.18);
    },
    whoosh(c, o, t) {
      noise(c, o, t, 'bandpass', 300, 3500, 0.5, 0.2, 0.6);
    },
  };

  return api;
}
