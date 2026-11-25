/**
 * Class Live's projector sounds: all made with the Web Audio API (no files), only played on the teacher's screen.
 *
 * Each game has its own sound set (James, 24 Nov 2026: "a massive variety of sounds", across the games and within each):
 *   - Star Web: space. Glass bells, celesta, shimmering pads, whooshes; a bright major scale.
 *   - Serpent Chain: jungle. Marimba, kalimba, wood blocks, log drums, shakers; a minor pentatonic.
 *   - Mystery Mural: gallery. Harp, music box, pizzicato, glockenspiel, card flicks; a lydian scale.
 * Every sound is built fresh each time from random choices (instrument, notes from the game's scale, rhythm, direction,
 * octave), and a choice heard in the last few plays of that sound is drawn again, so nothing repeats twice running.
 *
 * The AudioContext is made on the first sound (browsers need a tap first), busy moments are rate-limited, and every call is
 * wrapped so a browser without audio just stays quiet.
 */
export type Kit = 'stars' | 'serpent' | 'mural' | 'corners' | 'clash';

export type SoundName =
  | 'join' | 'start' | 'over'
  // Star Web
  | 'star' | 'glow' | 'arm' | 'creature' | 'supernova'
  // Serpent Chain
  | 'climb' | 'head' | 'tail' | 'awake'
  // Mystery Mural
  | 'flip' | 'guess' | 'pick' | 'reveal'
  // Four Corners
  | 'tick' | 'tickLast' | 'drumroll' | 'dice' | 'land' | 'caught' | 'safe' | 'grab' | 'power' | 'escape' | 'warp' | 'storm'
  // Shark Bay
  | 'splash' | 'chomp';

export interface ClassLiveSound {
  play(name: SoundName): void;
  /** Which game's sound set to use (the projector sets it when a game opens). */
  setKit(kit: Kit): void;
  muted(): boolean;
  setMuted(on: boolean): void;
}

const KEY = 'classlive-muted';
const BIG: SoundName[] = ['start', 'over', 'creature', 'supernova', 'awake', 'reveal', 'head', 'arm', 'guess', 'drumroll', 'land', 'splash'];

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

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

/** One oscillator with an envelope (a fast rise, then a fall to silence). */
function osc(ctx: Ctx, out: AudioNode, freq: number, at: number, dur: number, type: OscillatorType, peak: number, to?: number, attack = 0.01) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (to) o.frequency.exponentialRampToValueAtTime(to, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + Math.min(attack, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + dur + 0.05);
}

let noiseCache: AudioBuffer | null = null;
function noiseBuffer(ctx: Ctx): AudioBuffer {
  if (noiseCache && noiseCache.sampleRate === ctx.sampleRate) return noiseCache;
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noiseCache = buf;
  return buf;
}

/** Filtered noise: a whoosh, a shaker, a card flick or a cymbal, by its filter and length. */
function hiss(ctx: Ctx, out: AudioNode, at: number, dur: number, from: number, to: number, peak: number, type: BiquadFilterType = 'bandpass', q = 2, rise = 0.4) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, at);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + Math.max(0.005, dur * rise));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(out);
  src.start(at, Math.random() * 1.5);
  src.stop(at + dur + 0.05);
}

type Instrument = (ctx: Ctx, out: AudioNode, f: number, at: number, v: number) => void;

/** The instruments, all made from sine/triangle partials and noise. `v` is loudness (about 0 to 1). */
const INSTRUMENTS = {
  // Space
  glass: (ctx, out, f, at, v) => { osc(ctx, out, f, at, 1.6, 'sine', 0.16 * v); osc(ctx, out, f * 2.76, at, 0.7, 'sine', 0.05 * v); osc(ctx, out, f * 5.4, at, 0.3, 'sine', 0.025 * v); },
  celesta: (ctx, out, f, at, v) => { osc(ctx, out, f, at, 0.9, 'sine', 0.18 * v); osc(ctx, out, f * 2, at, 0.5, 'sine', 0.07 * v); osc(ctx, out, f * 4, at, 0.18, 'triangle', 0.03 * v); },
  shimmer: (ctx, out, f, at, v) => { osc(ctx, out, f, at, 1.4, 'sine', 0.12 * v, f * 1.004); osc(ctx, out, f * 1.5, at + 0.03, 1.2, 'sine', 0.06 * v, f * 1.507); osc(ctx, out, f * 3.01, at, 0.6, 'sine', 0.03 * v); },
  pad: (ctx, out, f, at, v) => { osc(ctx, out, f, at, 2.4, 'triangle', 0.07 * v, undefined, 0.5); osc(ctx, out, f * 1.005, at, 2.4, 'sine', 0.07 * v, undefined, 0.6); },
  // Jungle
  marimba: (ctx, out, f, at, v) => { osc(ctx, out, f, at, 0.5, 'sine', 0.24 * v); osc(ctx, out, f * 4, at, 0.08, 'sine', 0.06 * v); hiss(ctx, out, at, 0.02, f * 3, f * 3, 0.03 * v, 'bandpass', 4, 0.2); },
  kalimba: (ctx, out, f, at, v) => { osc(ctx, out, f, at, 0.7, 'sine', 0.2 * v); osc(ctx, out, f * 5.4, at, 0.12, 'sine', 0.05 * v); osc(ctx, out, f * 2.01, at, 0.25, 'triangle', 0.04 * v); },
  wood: (ctx, out, f, at, v) => { osc(ctx, out, f * 2, at, 0.09, 'triangle', 0.22 * v, f * 1.6); hiss(ctx, out, at, 0.04, f * 4, f * 3, 0.05 * v, 'bandpass', 6, 0.1); },
  logdrum: (ctx, out, f, at, v) => { osc(ctx, out, f / 2, at, 0.45, 'sine', 0.32 * v, f / 2.6); osc(ctx, out, f, at, 0.2, 'triangle', 0.08 * v, f * 0.8); },
  // Gallery
  harp: (ctx, out, f, at, v) => { osc(ctx, out, f, at, 1.2, 'triangle', 0.16 * v); osc(ctx, out, f * 2, at, 0.6, 'sine', 0.06 * v); osc(ctx, out, f * 3, at, 0.25, 'sine', 0.025 * v); },
  musicbox: (ctx, out, f, at, v) => { osc(ctx, out, f * 2, at, 0.8, 'sine', 0.14 * v); osc(ctx, out, f * 8.1, at, 0.1, 'sine', 0.03 * v); },
  pizz: (ctx, out, f, at, v) => { osc(ctx, out, f, at, 0.28, 'triangle', 0.2 * v, f * 0.995); osc(ctx, out, f * 2, at, 0.15, 'sine', 0.05 * v); },
  glock: (ctx, out, f, at, v) => { osc(ctx, out, f * 2, at, 1.0, 'sine', 0.13 * v); osc(ctx, out, f * 5.9, at, 0.25, 'sine', 0.035 * v); },
} satisfies Record<string, Instrument>;
type InstrumentName = keyof typeof INSTRUMENTS;

// ---------------------------------------------------------------------------
// Each game's sound set: a scale, its instruments and a few signature textures
// ---------------------------------------------------------------------------

const KITS: Record<Kit, { root: number; scale: number[]; lead: InstrumentName[]; low: InstrumentName[] }> = {
  stars: { root: 523.25, scale: [0, 2, 4, 7, 9, 11], lead: ['glass', 'celesta', 'shimmer'], low: ['pad', 'shimmer'] },
  serpent: { root: 220, scale: [0, 3, 5, 7, 10], lead: ['marimba', 'kalimba', 'wood'], low: ['logdrum', 'marimba'] },
  mural: { root: 293.66, scale: [0, 2, 4, 6, 7, 9, 11], lead: ['harp', 'musicbox', 'pizz', 'glock'], low: ['harp', 'pizz'] },
  corners: { root: 261.63, scale: [0, 2, 4, 5, 7, 9], lead: ['glock', 'marimba', 'pizz'], low: ['logdrum', 'pizz'] },
  clash: { root: 329.63, scale: [0, 2, 4, 7, 9], lead: ['kalimba', 'glock', 'marimba'], low: ['logdrum', 'wood'] },
};

/** The frequency of scale step `n` (any whole number, wrapping into octaves). */
function note(kit: Kit, n: number): number {
  const { root, scale } = KITS[kit];
  const oct = Math.floor(n / scale.length);
  const step = scale[((n % scale.length) + scale.length) % scale.length];
  return root * 2 ** (oct + step / 12);
}

/** Random choices that are written down, so a sound can be redrawn when it matches one heard just before. */
class Pick {
  sig: string[] = [];
  int(n: number): number { const v = Math.floor(Math.random() * n); this.sig.push(String(v)); return v; }
  one<T>(list: readonly T[]): T { return list[this.int(list.length)]; }
  chance(p: number): boolean { const v = Math.random() < p; this.sig.push(v ? 'y' : 'n'); return v; }
  /** A random amount, not part of the signature (small variety on top). */
  wobble(a: number, b: number): number { return a + Math.random() * (b - a); }
}

type Recipe = (ctx: Ctx, out: AudioNode, kit: Kit, t: number, p: Pick) => void;

/** Notes `count` long, up, down or bouncing, from step `from`. */
function run(p: Pick, from: number, count: number): number[] {
  const shape = p.int(4);
  return Array.from({ length: count }, (_, i) => from + (shape === 0 ? i : shape === 1 ? -i : shape === 2 ? (i % 2 ? i + 1 : i) : i * 2));
}

/** Plays `steps` on an instrument, one every `gap` seconds (with a little human timing). */
function phrase(ctx: Ctx, out: AudioNode, kit: Kit, t: number, inst: InstrumentName, steps: number[], gap: number, v = 1, swing = 0) {
  steps.forEach((s, i) => INSTRUMENTS[inst](ctx, out, note(kit, s), t + i * gap + (i % 2 ? swing : 0) + Math.random() * 0.012, v * (1 - i * 0.04)));
}

/** A chord: steps struck together (or strummed). */
function chord(ctx: Ctx, out: AudioNode, kit: Kit, t: number, inst: InstrumentName, steps: number[], strum: number, v = 1) {
  steps.forEach((s, i) => INSTRUMENTS[inst](ctx, out, note(kit, s), t + i * strum, v * 0.8));
}

const whoosh = (ctx: Ctx, out: AudioNode, t: number, p: Pick, peak = 0.3) => {
  const up = p.chance(0.6);
  const dur = p.one([0.45, 0.6, 0.8, 1.0]);
  const lo = p.one([250, 400, 600]);
  const hi = p.one([2400, 3200, 4500]);
  hiss(ctx, out, t, dur, up ? lo : hi, up ? hi : lo, peak, 'bandpass', p.one([1.5, 3, 6]));
};

const drums = (ctx: Ctx, out: AudioNode, kit: Kit, t: number, p: Pick) => {
  // A short roll in one of several rhythms; the jungle's on log drums, the others on a soft tom.
  const patterns = [[0, 0.2, 0.4, 0.5, 0.6], [0, 0.15, 0.3, 0.6], [0, 0.12, 0.24, 0.36, 0.48, 0.72], [0, 0.3, 0.45, 0.6, 0.9], [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8]];
  const beats = p.one(patterns);
  const base = p.int(3);
  beats.forEach((b, i) => {
    const f = note(kit, -5 + base + (i === beats.length - 1 ? 0 : (i % 3)));
    if (kit === 'serpent') INSTRUMENTS.logdrum(ctx, out, f, t + b, i === beats.length - 1 ? 1.2 : 0.8);
    else { osc(ctx, out, f / 2, t + b, 0.4, 'sine', i === beats.length - 1 ? 0.45 : 0.3, f / 3.5); hiss(ctx, out, t + b, 0.08, 1200, 400, 0.08); }
  });
  if (kit === 'stars') hiss(ctx, out, t + beats[beats.length - 1], 1.2, 6000, 9000, 0.06, 'highpass', 1, 0.05);
  if (kit === 'mural') phrase(ctx, out, kit, t + beats[beats.length - 1], 'glock', [7, 9, 11], 0.08, 0.7);
};

const cadence = (ctx: Ctx, out: AudioNode, kit: Kit, t: number, p: Pick) => {
  // The end: one of several closing tunes, then a held chord.
  const tunes = [[4, 5, 6, 7], [7, 6, 4, 7], [2, 4, 5, 9], [5, 4, 2, 0, 7], [0, 2, 4, 7, 11]];
  const tune = p.one(tunes);
  const lead = p.one(KITS[kit].lead);
  phrase(ctx, out, kit, t, lead, tune, p.one([0.14, 0.18, 0.22]), 1.1);
  const end = t + tune.length * 0.18;
  chord(ctx, out, kit, end, p.one(KITS[kit].low), [0, 2, 4, 7].map((s) => s + p.int(2) * KITS[kit].scale.length), 0.03, 1.2);
  hiss(ctx, out, end, 1.6, 5000, 2000, 0.06, 'highpass', 1, 0.05);
};

/** What each sound is, in each game. Shared sounds (join, start, over) take on the game's own instruments. */
const RECIPES: Record<SoundName, Recipe> = {
  join: (ctx, out, kit, t, p) => {
    const inst = p.one(KITS[kit].lead);
    const s = p.int(7) + 2;
    INSTRUMENTS[inst](ctx, out, note(kit, s), t, 0.9);
    if (p.chance(0.5)) INSTRUMENTS[inst](ctx, out, note(kit, s + p.one([2, 3, 4])), t + p.one([0.08, 0.12]), 0.6);
    if (kit === 'stars' && p.chance(0.4)) hiss(ctx, out, t, 0.5, 5000, 8000, 0.04, 'highpass');
    if (kit === 'serpent' && p.chance(0.4)) hiss(ctx, out, t, 0.18, 4000, 6000, 0.08, 'bandpass', 3, 0.2);
  },
  start: (ctx, out, kit, t, p) => {
    drums(ctx, out, kit, t, p);
    if (p.chance(0.6)) chord(ctx, out, kit, t + 0.9, p.one(KITS[kit].lead), [0, 2, 4], p.one([0, 0.04, 0.08]), 0.9);
  },
  over: (ctx, out, kit, t, p) => cadence(ctx, out, kit, t, p),

  // ---- Star Web ----
  star: (ctx, out, kit, t, p) => {
    whoosh(ctx, out, t, p, 0.22);
    const inst = p.one(KITS[kit].lead);
    const notes = run(p, p.int(5) + 3, p.one([2, 3, 4]));
    phrase(ctx, out, kit, t + 0.55 + p.wobble(0, 0.15), inst, notes, p.one([0.06, 0.09, 0.12]), 0.9);
  },
  glow: (ctx, out, kit, t, p) => {
    const s = p.int(6) + 4;
    INSTRUMENTS[p.one(['shimmer', 'glass'] as const)](ctx, out, note(kit, s), t, 0.8);
    osc(ctx, out, note(kit, s) * 0.5, t, 0.8, 'sine', 0.08, note(kit, s) * 0.75);
  },
  arm: (ctx, out, kit, t, p) => {
    const inst = p.one(KITS[kit].lead);
    const steps = run(p, p.int(3), 5);
    phrase(ctx, out, kit, t, inst, steps, p.one([0.07, 0.1]), 1);
    chord(ctx, out, kit, t + 0.5, 'pad', [0, 2, 4].map((s) => s + p.int(3)), 0, 1.2);
  },
  creature: (ctx, out, kit, t, p) => {
    // A whale-like call gliding in the deep, under a slow pad.
    const base = note(kit, -6 + p.int(3));
    const shape = p.int(3);
    osc(ctx, out, base, t, 2.6, 'sine', 0.22, base * (shape === 0 ? 1.5 : shape === 1 ? 0.75 : 1.33), 0.4);
    osc(ctx, out, base * 2.01, t + 0.3, 2.0, 'sine', 0.05, base * 2.4, 0.4);
    chord(ctx, out, kit, t + 0.4, 'pad', [0, 4, 7].map((s) => s - 3 + p.int(2)), 0.25, 1.3);
    hiss(ctx, out, t, 2.8, 300, 900, 0.05, 'lowpass', 1, 0.5);
  },
  supernova: (ctx, out, kit, t, p) => {
    hiss(ctx, out, t, 1.6, 200, 8000, 0.35, 'bandpass', 1, 0.1);
    osc(ctx, out, 55, t, 1.4, 'sine', 0.4, 30);
    chord(ctx, out, kit, t + 0.15, 'shimmer', [0, 2, 4, 7, 9].map((s) => s + p.int(2) * 5), 0.02, 1.2);
    const cascade = run(p, 14, 8).map((s) => s - 6);
    phrase(ctx, out, kit, t + 0.5, p.one(['glass', 'celesta'] as const), cascade, 0.07, 0.8);
  },

  // ---- Serpent Chain ----
  climb: (ctx, out, kit, t, p) => {
    const inst = p.one(KITS[kit].lead);
    const s = p.int(8) + 1;
    INSTRUMENTS[inst](ctx, out, note(kit, s), t, 0.9);
    const grace = p.int(3);
    if (grace === 1) INSTRUMENTS[inst](ctx, out, note(kit, s + 1), t + 0.07, 0.6);
    if (grace === 2) INSTRUMENTS.wood(ctx, out, note(kit, s - 2), t + 0.1, 0.5);
    if (p.chance(0.35)) hiss(ctx, out, t, 0.12, 5000, 7000, 0.05, 'bandpass', 3, 0.3);
  },
  head: (ctx, out, kit, t, p) => {
    const inst = p.one(['kalimba', 'marimba'] as const);
    phrase(ctx, out, kit, t, inst, run(p, p.int(3) + 2, 6), p.one([0.07, 0.09]), 1, 0.02);
    INSTRUMENTS.logdrum(ctx, out, note(kit, -3), t + 0.5, 1);
  },
  tail: (ctx, out, kit, t, p) => {
    // A rattle, then a breathy flute slide.
    for (let i = 0; i < p.one([3, 4, 6]); i++) hiss(ctx, out, t + i * 0.06, 0.08, 4500, 6500, 0.08, 'bandpass', 4, 0.2);
    const a = note(kit, 5 + p.int(4));
    osc(ctx, out, a, t + 0.3, 0.7, 'sine', 0.12, a * (p.chance(0.5) ? 1.5 : 0.75), 0.1);
    hiss(ctx, out, t + 0.3, 0.6, a, a, 0.03, 'bandpass', 10, 0.3);
  },
  awake: (ctx, out, kit, t, p) => {
    // A deep growl and a log-drum pattern.
    const g = p.one([70, 80, 90]);
    osc(ctx, out, g, t, 1.7, 'sawtooth', 0.14, g * 0.55, 0.2);
    osc(ctx, out, g * 0.66, t, 1.9, 'sine', 0.3, g * 0.4, 0.2);
    hiss(ctx, out, t, 1.5, 600, 150, 0.22, 'lowpass', 1, 0.3);
    drums(ctx, out, kit, t + 0.9, p);
  },

  // ---- Mystery Mural ----
  flip: (ctx, out, kit, t, p) => {
    // A card flick, then one plucked note (a different instrument and note most times).
    hiss(ctx, out, t, p.one([0.05, 0.07, 0.09]), p.one([2500, 3500, 5000]), 1500, 0.12, 'bandpass', 2, 0.15);
    const inst = p.one(KITS[kit].lead);
    const s = p.int(9) + 2;
    INSTRUMENTS[inst](ctx, out, note(kit, s), t + 0.05, 0.85);
    if (p.chance(0.3)) INSTRUMENTS[inst](ctx, out, note(kit, s + p.one([2, 4])), t + 0.14, 0.5);
  },
  guess: (ctx, out, kit, t, p) => {
    // A harp glissando, then a question in the music box.
    const up = p.chance(0.7);
    const gl = Array.from({ length: 10 }, (_, i) => (up ? i : 10 - i));
    phrase(ctx, out, kit, t, 'harp', gl, 0.04, 0.7);
    phrase(ctx, out, kit, t + 0.55, p.one(KITS[kit].lead), p.one([[4, 5, 6], [2, 4, 3], [7, 6, 8], [5, 7, 6, 9]]), 0.2, 1);
  },
  pick: (ctx, out, kit, t, p) => {
    INSTRUMENTS[p.one(['musicbox', 'glock', 'pizz'] as const)](ctx, out, note(kit, p.int(7) + 4), t, 0.7);
  },
  reveal: (ctx, out, kit, t, p) => {
    // A rising shimmer while the tiles turn in a wave, a timpani roll, then the fanfare.
    hiss(ctx, out, t, 1.8, 400, 5000, 0.25, 'bandpass', 1, 0.8);
    for (let i = 0; i < 14; i++) osc(ctx, out, 98, t + i * 0.12, 0.2, 'sine', 0.05 + i * 0.012, 90);
    phrase(ctx, out, kit, t + 0.2, 'harp', run(p, 0, 12).map((s) => Math.abs(s)), 0.13, 0.6);
    cadence(ctx, out, kit, t + 1.8, p);
  },
  // ---- Shark Bay: a big splash and a cartoon chomp ----
  splash: (ctx, out, _kit, t, p) => {
    hiss(ctx, out, t, 1.1, 7000, 600, 0.4, 'bandpass', 0.8, 0.02);
    hiss(ctx, out, t + 0.05, 0.9, 900, 200, 0.3, 'lowpass', 1, 0.05);
    osc(ctx, out, p.one([140, 170, 200, 240]), t, 0.5, 'sine', 0.4, 50);
    const sparkle = p.one([600, 800, 1000]);
    for (let i = 0; i < 6; i++) osc(ctx, out, sparkle + i * 140, t + 0.15 + i * 0.07, 0.12, 'sine', 0.05, 300);
  },
  chomp: (ctx, out, _kit, t, p) => {
    const f = p.one([100, 120, 140, 170]);
    const bites = p.one([2, 3, 4]);
    for (let i = 0; i < bites; i++) {
      osc(ctx, out, f, t + i * 0.18, 0.14, 'square', 0.18, f * 0.5);
      hiss(ctx, out, t + i * 0.18, 0.07, 3500, 1500, 0.2, 'bandpass', 2, 0.01);
    }
  },
  // ---- Four Corners ----
  tick: (ctx, out, kit, t, p) => {
    const f = p.one([900, 1100, 1300]);
    osc(ctx, out, f, t, 0.06, 'triangle', 0.18, f * 0.8);
    hiss(ctx, out, t, 0.03, 3000, 2000, 0.05, 'bandpass', 4, 0.1);
    if (p.chance(0.3)) INSTRUMENTS.wood(ctx, out, note(kit, p.int(4) + 4), t, 0.4);
  },
  tickLast: (ctx, out, kit, t, p) => {
    const f = p.one([1500, 1800, 2100]);
    osc(ctx, out, f, t, 0.1, 'square', 0.1, f * 0.9);
    osc(ctx, out, f * 1.5, t, 0.08, 'sine', 0.08);
    hiss(ctx, out, t, 0.04, 5000, 3000, 0.08, 'bandpass', 5, 0.1);
    if (p.chance(0.4)) INSTRUMENTS.pizz(ctx, out, note(kit, p.int(3) + 7), t, 0.5);
  },
  drumroll: (ctx, out, _kit, t, p) => {
    // A snare roll from noise that speeds up and swells, over a low rumble.
    const dur = p.one([2.3, 2.5, 2.7]);
    const rate = p.one([14, 18, 22]);
    const top = p.one([3000, 4000, 5000]);
    let at = 0;
    for (let i = 0; at < dur; i++) {
      const k = at / dur;
      hiss(ctx, out, t + at, 0.07, top, top * 0.5, 0.06 + k * 0.2, 'bandpass', 1.2, 0.1);
      osc(ctx, out, 180 - k * 40, t + at, 0.06, 'triangle', 0.04 + k * 0.08);
      at += 1 / (rate + k * rate * 1.2) + (i % 2 ? 0.004 : 0);
    }
    hiss(ctx, out, t, dur, 120, 400, 0.18, 'lowpass', 1, 0.9);
    if (p.chance(0.5)) hiss(ctx, out, t + dur - 0.6, 0.6, 3000, 9000, 0.1, 'highpass', 1, 0.9);
  },
  dice: (ctx, out, _kit, t, p) => {
    // Wooden clacks that start wide apart and bunch up, like a die tumbling to rest.
    const n = p.one([9, 11, 13]);
    const base = p.one([500, 650, 800]);
    let at = 0;
    for (let i = 0; i < n; i++) {
      const gap = 0.26 - i * (0.2 / n);
      const v = 0.9 - i * (0.5 / n);
      INSTRUMENTS.wood(ctx, out, base * (1 + (i % 3) * 0.18) * p.wobble(0.9, 1.1), t + at, v);
      hiss(ctx, out, t + at, 0.05, 2500, 1200, 0.08 * v, 'bandpass', 3, 0.1);
      at += Math.max(0.05, gap * p.wobble(0.7, 1.2));
    }
  },
  land: (ctx, out, kit, t, p) => {
    // A big boom with a crash, a brass-like stab, and a low shake.
    osc(ctx, out, 110, t, 1.2, 'sine', 0.55, 38);
    osc(ctx, out, 70, t, 0.9, 'sawtooth', 0.12, 40);
    hiss(ctx, out, t, 1.4, 6000, 800, 0.3, 'highpass', 1, 0.02);
    hiss(ctx, out, t, 1.2, 400, 100, 0.3, 'lowpass', 1, 0.05);
    chord(ctx, out, kit, t + 0.05, p.one(['glock', 'marimba'] as const), [0, 2, 4, 7].map((s) => s + p.int(2) * 3), 0.0, 1.3);
    if (p.chance(0.5)) INSTRUMENTS.logdrum(ctx, out, note(kit, -3), t + 0.2, 1.2);
  },
  caught: (ctx, out, kit, t, p) => {
    // A clang of the jail door, then a comic slide down (wah-wah), never scary.
    const f = p.one([420, 520, 620]);
    [1, 2.76, 5.4, 8.9].forEach((m, i) => osc(ctx, out, f * m, t, 0.9 - i * 0.15, 'sine', 0.2 / (i + 1)));
    hiss(ctx, out, t, 0.06, 4000, 2500, 0.2, 'bandpass', 2, 0.05);
    const shape = p.int(3);
    const steps = shape === 0 ? [4, 3, 1] : shape === 1 ? [5, 3, 2, 0] : [3, 2, 0];
    phrase(ctx, out, kit, t + 0.3, p.one(['pizz', 'marimba'] as const), steps, p.one([0.14, 0.18]), 0.9);
  },
  safe: (ctx, out, kit, t, p) => {
    const s = p.int(4) + 4;
    const inst = p.one(KITS[kit].lead);
    phrase(ctx, out, kit, t, inst, p.one([[0, 2], [0, 4], [0, 2, 4]]).map((x) => s + x), p.one([0.07, 0.09]), 0.9);
    hiss(ctx, out, t, 0.4, 5000, 8000, 0.03, 'highpass', 1, 0.2);
  },
  grab: (ctx, out, kit, t, p) => {
    const s = p.int(4) + 5;
    INSTRUMENTS[p.one(['pizz', 'glock', 'marimba'] as const)](ctx, out, note(kit, s), t, 0.9);
    osc(ctx, out, note(kit, s + 4), t + 0.07, 0.25, 'sine', 0.12, note(kit, s + 4) * 1.5);
    if (p.chance(0.4)) hiss(ctx, out, t, 0.1, 3000, 6000, 0.05, 'bandpass', 3, 0.3);
  },
  power: (ctx, out, kit, t, p) => {
    hiss(ctx, out, t, 0.7, 800, 7000, 0.15, 'bandpass', 3, 0.7);
    phrase(ctx, out, kit, t + 0.05, p.one(['glock', 'celesta', 'glass'] as const), run(p, 2, 6).map((s) => Math.abs(s) + 3), p.one([0.05, 0.07]), 0.9);
    INSTRUMENTS.shimmer(ctx, out, note(kit, 12), t + 0.45, 0.8);
  },
  escape: (ctx, out, kit, t, p) => {
    // A key-turn rattle, then a jingly little tune.
    for (let i = 0; i < 4; i++) hiss(ctx, out, t + i * 0.05, 0.04, 4000, 6000, 0.1, 'bandpass', 5, 0.2);
    const tune = p.one([[4, 6, 5, 7, 9], [2, 4, 7, 5, 9], [4, 5, 7, 9, 11]]);
    phrase(ctx, out, kit, t + 0.25, p.one(['marimba', 'glock', 'pizz'] as const), tune, p.one([0.1, 0.13]), 1, 0.01);
    chord(ctx, out, kit, t + 0.25 + tune.length * 0.12, 'glock', [0, 2, 4].map((s) => s + 7), 0.02, 0.8);
  },
  warp: (ctx, out, _kit, t, p) => {
    const dur = p.one([0.5, 0.6, 0.7]);
    if (p.chance(0.5)) hiss(ctx, out, t, 0.1, 3000, 5000, 0.06, 'highpass', 1, 0.3);
    hiss(ctx, out, t, dur, 300, 6000, 0.25, 'bandpass', 4, 0.5);
    hiss(ctx, out, t + dur, 0.4, 6000, 400, 0.2, 'bandpass', 4, 0.2);
    const a = p.one([300, 400, 500]);
    osc(ctx, out, a, t, dur, 'sine', 0.12, a * 5);
    osc(ctx, out, a * 5, t + dur, 0.35, 'sine', 0.1, a);
  },
  storm: (ctx, out, _kit, t, p) => {
    // A gust of wind: filtered noise that swells and fades, with a faint howl.
    const lo = p.one([300, 500, 700]);
    hiss(ctx, out, t, 1.5, lo, lo * 3, 0.3, 'bandpass', 1.5, 0.45);
    hiss(ctx, out, t + 0.1, 1.4, lo * 2.5, lo, 0.15, 'bandpass', 3, 0.5);
    const h = p.one([380, 440, 520]);
    osc(ctx, out, h, t + 0.2, 1.2, 'sine', 0.04, h * 1.15, 0.5);
  },
};

/** A stand-in AudioContext that does nothing, for drawing a sound's choices without playing it. */
function quietContext(): Ctx {
  const nothing: unknown = new Proxy(function () { /* does nothing */ }, {
    get: (_t, key) => (key === 'sampleRate' || key === 'currentTime' ? 0 : nothing),
    apply: () => nothing,
    set: () => true,
  });
  return nothing as Ctx;
}
const QUIET = typeof Proxy === 'function' ? quietContext() : null;

/** How many recent plays of a sound a new one must differ from. */
const FRESH = 3;

export function makeClassLiveSound(): ClassLiveSound {
  let mute = readMuted();
  let kit: Kit = 'stars';
  let ctx: Ctx | null = null;
  let master: GainNode | null = null;
  const recent: number[] = [];
  const last: Partial<Record<SoundName, number>> = {};
  const heard: Partial<Record<string, string[]>> = {};
  return {
    play(name) {
      if (mute) return;
      try {
        const now = Date.now();
        if (now - (last[name] ?? 0) < 120) return;
        while (recent.length && now - recent[0] > 1000) recent.shift();
        if (recent.length >= 7 && !BIG.includes(name)) return;
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
        // Draw the sound's choices; draw again (a few times) while they match one of the last few.
        const key = `${kit}:${name}`;
        const before = heard[key] ?? [];
        let p = new Pick();
        for (let i = 0; i < 6 && QUIET; i++) {
          p = new Pick();
          // A dry run on a context that does nothing: the choices only.
          RECIPES[name](QUIET, QUIET.destination, kit, 0, p);
          if (!before.includes(p.sig.join(','))) break;
        }
        const sig = p.sig;
        let i = 0;
        // Replay the chosen draw: the same choices in the same order, now heard.
        const again = new Pick();
        again.int = (n: number) => { const v = Number(sig[i++] ?? 0) % n; again.sig.push(String(v)); return v; };
        again.chance = () => { const v = sig[i++] === 'y'; again.sig.push(v ? 'y' : 'n'); return v; };
        RECIPES[name](ctx, master as GainNode, kit, ctx.currentTime + 0.01, again);
        heard[key] = [...before, sig.join(',')].slice(-FRESH);
      } catch { /* no audio here: stay quiet */ }
    },
    setKit(k) {
      kit = k;
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
  return { play: () => undefined, setKit: () => undefined, muted: () => mute, setMuted: (on) => void (mute = on) };
}

/** For the tests: the choices a sound would make, without any audio. */
export function drawChoices(name: SoundName, kit: Kit): string {
  const p = new Pick();
  if (QUIET) RECIPES[name](QUIET, QUIET.destination, kit, 0, p);
  return p.sig.join(',');
}

export const SOUND_NAMES = Object.keys(RECIPES) as SoundName[];

/** Plays one version of a sound on a given context (the listening check renders every sound offline with it). */
export function playOn(ctx: Ctx, name: SoundName, kit: Kit): void {
  RECIPES[name](ctx, ctx.destination, kit, 0.01, new Pick());
}
