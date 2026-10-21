/**
 * Archery Challenge's fight screen picture (docs/ARCHERY-PLAN.md, section 10): a 2D canvas with our
 * own art drawn in code. It only reads the engine's results (rounds, shot records, land) and shows
 * them: nothing here changes the rules.
 *
 * - Its own requestAnimationFrame loop: a fixed 60-steps-a-second update (particles, camera, archers)
 *   with drawing blended between steps.
 * - Static layers (sky, far and middle backgrounds, the land, the overlay) are drawn once to off-screen
 *   canvases and shown as images; after a shot only the changed part of the land is redrawn.
 * - Automatic simpler graphics when frames are slow for a while (counted in stats().slowSwitches).
 *
 * James's rules (21 Oct 2026): no aiming help of any kind (a flying arrow's trail fades within half a
 * second and nothing stays on screen), no blood ever, top-notch graphics that stay smooth on Chromebooks.
 */
import { arrowKind } from '../../../shared/archery/arrows';
import { CELL, COLS, HANDS_HEIGHT, ROWS, WORLD_WIND_MAX } from '../../../shared/archery/config';
import { carve, copyLand, dropArcher } from '../../../shared/archery/land';
import { AIR, BUILDING, DIRT, ICE, TREE, type Archer, type Land, type Round, type ShotRecord, type WorldId } from '../../../shared/archery/types';
import { arrowLength, arrowLook, arrowShape, drawFigure, type ArrowLook, type Figure, ARROW_STYLES } from './art/archers';
import { PAD_TOP, PAD_X, cloudSprite, makeOverlay, makeSky, paintFar, paintMid, tumbleSprite, type Sprite } from './art/backdrop';
import { Fx, badge } from './art/fx';
import { LandArt } from './art/land';
import { computeLayout, type Layout, type ViewInsets } from './art/layout';
import { OL, TAU, clamp, ease, lerp, rng, rr } from './art/util';
import { WORLDS, type Palette } from './art/worlds';

export type { ViewInsets } from './art/layout';

export interface FightViewOptions {
  /** Reduced motion: no screen shake, no camera swoops, gentle/short effects, no weather drift. */
  lessMotion: boolean;
  /** "Simpler graphics" forced on (fewer layers and particles, lower pixel density). */
  simple: boolean;
  names: [string, string];
}

export interface ShotShow {
  /** Who shot (0 = left archer). */
  player: number;
  /** From takeShot(run, shot, true): has .path (x, y pairs, 60 a second of flight). */
  record: ShotRecord;
  /** The land just before the shot. */
  landBefore: Land;
  /** The land after the shot (falling dirt and sliding sand already done). */
  landAfter: Land;
  archersBefore: [Archer, Archer];
}

export interface FightView {
  setRound(round: Round): void;
  setAim(player: number, angle: number, pull: number): void;
  aimTo(player: number, angle: number, pull: number, ms: number): Promise<void>;
  setTurn(player: number | null): void;
  playShot(show: ShotShow): Promise<void>;
  celebrate(player: number): void;
  resize(cssWidth: number, cssHeight: number, insets: ViewInsets): void;
  setOptions(o: Partial<FightViewOptions>): void;
  archerOnScreen(player: number): { x: number; y: number } | null;
  stats(): { fps: number; frameMs: number; quality: 'full' | 'simple'; pixelRatio: number; particles: number; slowSwitches: number };
  dispose(): void;
}

// ——— Tuning (picture only) ———
const DT = 1 / 60;
/** Field px per archer "unit": the figures are about 33 px tall (the hit box is 24). */
const K = 0.29;
/** A flying arrow's trail lasts this long (James: within half a second). */
const TRAIL_SECONDS = 0.45;
/** Falling dirt and archers fall at this many px/s². */
const FALL_G = 900;
const MAX_PARTICLES = 300;
const SIMPLE_PARTICLES = 120;

interface Step { x: number; y: number; fall: boolean }

interface ArcherView {
  fig: Figure;
  x: number; y: number; px: number; py: number;
  /** Extra height while dropping in at the start of a round (field px above the feet), and its speed. */
  lift: number; liftV: number; liftDelay: number;
  visible: boolean;
  popped: boolean;
  health: number; shield: number; shieldMax: number;
  shownHealth: number; shownShield: number;
  angle: number;
  blinkT: number;
  path: Step[] | null; seg: number; segT: number; segFrom: Step | null;
  pendingPop: boolean;
  aimAnim: { from: number; to: number; fromPull: number; toPull: number; t: number; dur: number; resolve: () => void } | null;
}

interface Strip { col: number; srcRow: number; n: number; drop: number; kind: number; y: number; vy: number; landed: boolean; px: number }

interface ShowState {
  rec: ShotRecord;
  player: number;
  look: ArrowLook;
  path: number[];
  total: number;
  t: number;
  pt: number;
  bounceT: number;
  bounced: boolean;
  impacted: boolean;
  afterT: number;
  after: Land;
  intermediate: Land | null;
  strips: Strip[];
  stripsDone: boolean;
  poofs: number;
  poofAt: number;
  resolve: () => void;
}

interface Weather { x: number; y: number; z: number; ph: number; c: string }
interface Cloud { x: number; y: number; sp: number; sc: number; i: number }

/** A view that does nothing (no 2D canvas, e.g. in tests): every promise resolves straight away. */
function nullView(): FightView {
  return {
    setRound() {}, setAim() {}, aimTo: () => Promise.resolve(), setTurn() {}, playShot: () => Promise.resolve(), celebrate() {},
    resize() {}, setOptions() {}, archerOnScreen: () => null,
    stats: () => ({ fps: 0, frameMs: 0, quality: 'simple', pixelRatio: 1, particles: 0, slowSwitches: 0 }), dispose() {},
  };
}

export function createFightView(canvas: HTMLCanvasElement, options: FightViewOptions): FightView {
  let g: CanvasRenderingContext2D | null = null;
  try {
    g = canvas.getContext('2d');
  } catch {
    g = null;
  }
  if (!g || typeof requestAnimationFrame !== 'function' || typeof Path2D === 'undefined') return nullView();
  try {
    return makeView(canvas, g, options);
  } catch {
    return nullView();
  }
}

function makeView(canvas: HTMLCanvasElement, g: CanvasRenderingContext2D, options: FightViewOptions): FightView {
  const opts: FightViewOptions = { ...options, names: [...options.names] as [string, string] };
  const fx = new Fx();
  let disposed = false;
  let raf = 0;

  // Size, quality and layers.
  let cssW = Math.max(1, canvas.clientWidth || canvas.width || 300);
  let cssH = Math.max(1, canvas.clientHeight || canvas.height || 150);
  let insets: ViewInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  let autoLevel = 0; // 0 full, 1 simple, 2 simple + lower density
  let slowSwitches = 0;
  const simpleNow = () => opts.simple || autoLevel > 0;
  const deviceRatio = () => (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const pixelRatio = () => {
    const d = deviceRatio();
    if (!simpleNow()) return Math.min(d, 1.5);
    return autoLevel >= 2 ? Math.min(d, 1) * 0.75 : Math.min(d, 1);
  };
  let L: Layout = computeLayout(cssW, cssH, insets, pixelRatio());

  let world: WorldId = 'forest';
  let pal: Palette = WORLDS.forest;
  let wind = 0;
  let land: LandArt | null = null;
  let hasRound = false;
  let layers: { sky: (g: CanvasRenderingContext2D) => void; far: HTMLCanvasElement | null; mid: HTMLCanvasElement; overlay: ((g: CanvasRenderingContext2D) => void) | null; back: HTMLCanvasElement | null; clouds: Sprite[]; tumble: Sprite | null; key: string } | null = null;
  let tops = new Int16Array(COLS).fill(ROWS);
  let windsockCol = COLS >> 1;
  let windsockY = 300;
  let skyStars: { x: number; y: number; s: number; p: number }[] = [];
  let weather: Weather[] = [];
  let clouds: Cloud[] = [];
  let birds: { x: number; y: number; ph: number; sp: number }[] = [];
  let tumble = { x: 100, rot: 0 };

  // Time, camera, effects.
  let t = 0;
  let acc = 0;
  let last = 0;
  const cam = { y: 0, py: 0, look: 0, plook: 0 };
  let shake = 0;
  let quietUntil = 0;
  let turn: number | null = null;
  let celebrating: number | null = null;
  let celebrateT = 0;
  let show: ShowState | null = null;

  const archers: [ArcherView, ArcherView] = [newArcher(0), newArcher(1)];

  // Speed measuring.
  let fpsFrames = 0, fpsAt = 0, fps = 0;
  let workSum = 0, workN = 0, frameMs = 0;
  let windowFrames = 0, windowSlow = 0;

  function newArcher(i: number): ArcherView {
    return {
      fig: { kind: i === 0 ? 'hero' : 'bot', dir: i === 0 ? 1 : -1, aim: 45, draw: 0, hasArrow: true, arrowLook: i === 0 ? 'arrow' : 'bot', hitT: 0, squash: 0, stringWob: 0, blinkFor: 0, dizzy: 0, koT: -1, cheer: 0 },
      x: i === 0 ? 150 : 810, y: 400, px: 0, py: 0, lift: 0, liftV: 0, liftDelay: 0, visible: false, popped: false,
      health: 100, shield: 0, shieldMax: 1, shownHealth: 100, shownShield: 0, angle: i === 0 ? 45 : 135, blinkT: 1 + i * 1.7,
      path: null, seg: 0, segT: 0, segFrom: null, pendingPop: false, aimAnim: null,
    };
  }

  // ——— Building the static layers ———

  function rebuildLayers() {
    const key = `${world}|${L.cw}|${L.ch}|${L.ratio}|${L.ox}|${L.oy}|${L.s}|${simpleNow()}`;
    if (layers && layers.key === key) return;
    const simple = simpleNow();
    const sky = makeSky(L, pal);
    const far = simple ? null : paintFar(L, pal, world);
    const mid = paintMid(L, pal, world);
    const overlay = simple ? null : makeOverlay(L, pal);
    const cw = 150 * L.s;
    const cl = [0, 1, 2, 3].map((i) => cloudSprite(L.ratio, pal.seed * 10 + i, pal.cloud[0], pal.cloud[1], cw * (0.85 + i * 0.18)));
    const tb = world === 'desert' ? tumbleSprite(L.ratio, 7 * L.s) : null;
    layers = { sky, far, mid, overlay, back: null, clouds: cl, tumble: tb, key };
    const r = rng(pal.seed * 3 + 1);
    skyStars = world === 'city' ? Array.from({ length: simple ? 30 : 60 }, () => ({ x: r() * L.cw, y: r() * (L.oy + 200 * L.s), s: 0.6 + r() * 1.4, p: r() * TAU })) : [];
  }

  function initAmbient() {
    const r = Math.random;
    const simple = simpleNow();
    const n = { leaves: simple ? 8 : 18, sand: simple ? 16 : 40, snow: simple ? 45 : 110, city: simple ? 6 : 14 }[pal.weather];
    const leafCols = ['#e8a33a', '#d9672b', '#9ccc4a', '#f2c84b'];
    weather = Array.from({ length: n }, (_, i) => ({ x: r() * cssW, y: r() * cssH, z: 0.4 + r() * 0.8, ph: r() * TAU, c: leafCols[i % 4] }));
    clouds = Array.from({ length: simple ? 4 : 6 }, (_, i) => ({ x: r() * (cssW + 300) - 150, y: lerp(Math.min(L.oy, L.insets.top), L.oy + 150 * L.s, r()), sp: 5 + r() * 9, sc: 0.55 + r() * 0.65, i: i % 4 }));
    clouds.sort((a, b) => a.sc - b.sc);
    birds = world === 'forest' ? [0, 1, 2].map((i) => ({ x: r() * cssW, y: L.oy + (70 + i * 14) * L.s, ph: i * 1.7, sp: 24 + i * 3 })) : [];
    tumble = { x: r() * 960, rot: 0 };
  }

  function computeTops(cells: Uint8Array) {
    for (let c = 0; c < COLS; c++) {
      let top = ROWS;
      for (let r = 0; r < ROWS; r++) {
        if (cells[r * COLS + c] !== AIR) {
          top = r;
          break;
        }
      }
      tops[c] = top;
    }
  }
  const surfaceY = (x: number) => tops[clamp(Math.floor(x / CELL), 0, COLS - 1)] * CELL;

  function relayout() {
    L = computeLayout(cssW, cssH, insets, pixelRatio());
    const w = Math.max(1, Math.round(cssW * L.ratio)), h = Math.max(1, Math.round(cssH * L.ratio));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    layers = null;
    rebuildLayers();
    if (land) land.relayout(L, simpleNow());
    fx.max = simpleNow() ? SIMPLE_PARTICLES : MAX_PARTICLES;
    quietUntil = t + 1.2;
  }

  // ——— The view's own loop ———

  function frame(now: number) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    if (!last) last = now;
    const real = Math.min(0.1, (now - last) / 1000);
    const interval = now - last;
    last = now;
    acc += real;
    let n = 0;
    const s0 = performance.now();
    while (acc >= DT && n < 5) {
      step(DT);
      acc -= DT;
      n++;
    }
    if (n === 5) acc = 0;
    const t0 = performance.now();
    if (profOn) prof.step = (prof.step ?? 0) * 0.95 + (t0 - s0) * 0.05;
    try {
      draw(acc / DT);
    } catch {
      // A drawing hiccup must never stop the game.
    }
    const work = performance.now() - t0;
    measure(now, interval, work);
  }

  function measure(now: number, interval: number, work: number) {
    fpsFrames++;
    workSum += work;
    workN++;
    if (now - fpsAt >= 1000) {
      fps = Math.round((fpsFrames * 1000) / (now - fpsAt || 1000));
      frameMs = workN ? Math.round((workSum / workN) * 10) / 10 : 0;
      fpsFrames = 0;
      workSum = 0;
      workN = 0;
      fpsAt = now;
    }
    if (t < quietUntil || (typeof document !== 'undefined' && document.hidden)) {
      windowFrames = 0;
      windowSlow = 0;
      return;
    }
    windowFrames++;
    if (interval > 40 || work > 28) windowSlow++;
    if (windowFrames >= 60) {
      // Most frames slow for about a second or two: simpler graphics.
      if (windowSlow > windowFrames * 0.6 && autoLevel < 2) {
        autoLevel++;
        slowSwitches++;
        relayout();
      }
      windowFrames = 0;
      windowSlow = 0;
    }
  }

  // ——— Fixed-step update ———

  function step(dt: number) {
    t += dt;
    cam.py = cam.y;
    cam.plook = cam.look;
    shake = Math.max(0, shake - dt * 2.6);
    fx.step(dt);
    stepAmbient(dt);
    for (let i = 0; i < 2; i++) stepArcher(archers[i], i, dt);
    if (celebrating !== null) {
      celebrateT += dt;
      const a = archers[celebrating];
      if (a.visible && celebrateT < 3.2 && Math.floor((celebrateT - dt) / 0.8) !== Math.floor(celebrateT / 0.8)) fx.confetti(a.x, a.y - 30, 16);
    }
    let camTarget = 0;
    let lookTarget = 0;
    if (show) {
      stepShow(show, dt);
      if (show && !show.impacted) {
        const [ax, ay] = pathAt(show, show.t);
        const topField = (L.insets.top - L.oy) / L.s;
        const margin = 46 / L.s;
        if (ay < topField + margin) camTarget = ay - margin - topField;
        // Never so far that the land leaves the screen: at most about half the visible height
        // (beyond that, the marker at the top edge shows where the arrow is).
        const visible = (L.ch - L.insets.top - L.insets.bottom) / L.s;
        camTarget = Math.max(camTarget, -visible * 0.5);
        lookTarget = ax - 480;
      }
    }
    if (opts.lessMotion) {
      camTarget = 0;
      lookTarget = 0;
    }
    cam.y += (Math.min(0, camTarget) - cam.y) * (1 - Math.exp(-dt * (camTarget < cam.y ? 7 : 3)));
    cam.look += (lookTarget - cam.look) * (1 - Math.exp(-dt * 2));
    if (land && windsockCol >= 0) {
      const wy = surfaceY(windsockCol * CELL + 1.5);
      windsockY = windsockY < wy ? Math.min(wy, windsockY + 240 * dt) : wy;
    }
  }

  function stepAmbient(dt: number) {
    const moving = !opts.lessMotion;
    const ws = wind / Math.max(1, WORLD_WIND_MAX[world]);
    if (moving) {
      for (const c of clouds) {
        c.x += (c.sp + ws * 20) * c.sc * dt * L.s;
        const span = (layers?.clouds[c.i]?.w ?? 200) * c.sc;
        if (c.x > cssW + 40) c.x = -span - 40;
        if (c.x < -span - 60) c.x = cssW + 30;
      }
      for (const b of birds) {
        b.x += b.sp * dt * L.s;
        b.ph += dt * 9;
        if (b.x > cssW + 40) b.x = -40;
      }
      for (const p of weather) {
        if (pal.weather === 'leaves') {
          p.x += (ws * 60 + 14 * Math.sin(p.ph + t)) * p.z * dt + 8 * dt;
          p.y += 30 * p.z * dt;
          p.ph += dt * 2;
        } else if (pal.weather === 'snow') {
          p.x += (ws * 45 + 9 * Math.sin(t * 1.3 + p.ph)) * p.z * dt;
          p.y += (22 + 40 * p.z) * dt;
        } else if (pal.weather === 'sand') {
          p.x += ((ws === 0 ? 20 : ws * 220) * p.z + Math.sign(ws || 1) * 25) * dt;
          p.y += Math.sin(t * 2 + p.ph) * 10 * dt;
        } else {
          p.x += (ws * 14 + Math.sin(t * 0.7 + p.ph) * 6) * dt;
          p.y += Math.cos(t * 0.9 + p.ph) * 5 * dt;
        }
        if (p.y > cssH + 12) {
          p.y = -12;
          p.x = Math.random() * cssW;
        }
        if (p.y < -14) p.y = cssH + 10;
        if (p.x > cssW + 30) p.x = -30;
        if (p.x < -30) p.x = cssW + 30;
      }
      if (world === 'desert') {
        const d = Math.sign(wind) || 1;
        const sp = 26 + Math.abs(ws) * 50;
        tumble.x += d * sp * dt;
        tumble.rot += (d * sp * dt) / 7;
        if (tumble.x > 990) tumble.x = -30;
        if (tumble.x < -30) tumble.x = 990;
      }
    }
  }

  function setPose(a: ArcherView, angle: number, pull: number) {
    a.angle = angle;
    if (angle < 90) a.fig.dir = 1;
    else if (angle > 90) a.fig.dir = -1;
    a.fig.aim = a.fig.dir > 0 ? angle : 180 - angle;
    a.fig.draw = clamp(pull, 0, 1);
  }

  function stepArcher(a: ArcherView, i: number, dt: number) {
    const f = a.fig;
    a.px = a.x;
    a.py = a.y;
    a.blinkT -= dt;
    if (a.blinkT < 0) {
      f.blinkFor = 0.13;
      a.blinkT = 2.2 + Math.random() * 3;
    }
    if (f.blinkFor > 0) f.blinkFor -= dt;
    f.hitT = Math.max(0, f.hitT - dt * 1.3);
    f.squash = Math.max(0, f.squash - dt * 3.5);
    f.stringWob = Math.max(0, f.stringWob - dt * 2.6);
    if (f.dizzy > 0 && f.koT < 0) f.dizzy = Math.max(0, f.dizzy - dt * 0.8);
    a.shownHealth += (a.health - a.shownHealth) * (1 - Math.exp(-dt * 5));
    a.shownShield += (a.shield - a.shownShield) * (1 - Math.exp(-dt * 5));
    // Dropping in at the start of a round.
    if (a.lift > 0) {
      if (a.liftDelay > 0) a.liftDelay -= dt;
      else {
        a.liftV += 1400 * dt;
        a.lift -= a.liftV * dt;
        if (a.lift <= 0) {
          a.lift = 0;
          f.squash = 1;
          fx.landingDust(a.x, a.y, pal.dust, 6);
        }
      }
    }
    if (a.aimAnim) {
      const an = a.aimAnim;
      an.t += dt;
      const k = an.dur > 0 ? clamp(an.t / an.dur, 0, 1) : 1;
      const e = ease(k);
      setPose(a, lerp(an.from, an.to, e), lerp(an.fromPull, an.toPull, e));
      if (k >= 1) {
        a.aimAnim = null;
        an.resolve();
      }
    }
    if (celebrating === i && a.visible) {
      f.cheer = 1;
      if (!a.aimAnim) setPose(a, f.dir > 0 ? 70 + Math.sin(t * 5) * 10 : 110 - Math.sin(t * 5) * 10, 0);
    }
    // Falling and sliding after a shot.
    if (a.path) {
      if (a.seg >= a.path.length) {
        a.path = null;
      } else {
        const from = a.segFrom ?? { x: a.x, y: a.y, fall: false };
        const to = a.path[a.seg];
        a.segT += dt;
        if (a.segT < 0) return;
        if (to.fall) {
          const d = to.y - from.y;
          const y = from.y + 0.5 * FALL_G * a.segT * a.segT;
          if (y >= to.y || d <= 0) {
            a.y = to.y;
            a.x = to.x;
            if (d > 3 * CELL) {
              f.squash = 1;
              fx.landingDust(a.x, a.y, pal.dust, 5);
            }
            a.segFrom = to;
            a.seg++;
            a.segT = 0;
          } else a.y = y;
        } else {
          const k = clamp(a.segT / (1 / 45), 0, 1);
          a.x = lerp(from.x, to.x, k);
          a.y = lerp(from.y, to.y, k);
          if (k >= 1) {
            a.segFrom = to;
            a.seg++;
            a.segT = 0;
            if (world === 'snow' && Math.random() < 0.5) fx.landingDust(a.x, a.y, ['#ffffff', '#d5e6f8'], 1);
          }
        }
      }
    }
    if (!a.path && a.pendingPop && a.visible) {
      if (f.koT < 0) f.koT = 0;
      f.koT += dt;
      if (f.koT > 0.9) {
        a.visible = false;
        a.pendingPop = false;
        f.koT = -1;
        f.dizzy = 0;
        fx.poof(a.x, a.y - 16);
        fx.say('POOF!', a.x, a.y - 56, 40);
        if (!opts.lessMotion) shake = Math.max(shake, 1);
        if (show) {
          show.poofs++;
          show.poofAt = t;
        }
      }
    }
  }

  // ——— Playing a shot ———

  function pathAt(s: ShowState, time: number): [number, number, number] {
    const n = s.path.length / 2;
    const ft = clamp(time * 60, 0, n - 1);
    const i = Math.min(n - 2, Math.floor(ft));
    if (i < 0) return [s.path[0], s.path[1], 0];
    const f = ft - i;
    const x0 = s.path[i * 2], y0 = s.path[i * 2 + 1], x1 = s.path[i * 2 + 2], y1 = s.path[i * 2 + 3];
    return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, Math.atan2(y1 - y0, x1 - x0)];
  }

  function stepShow(s: ShowState, dt: number) {
    s.pt = s.t;
    if (!s.impacted) {
      s.t += dt;
      if (!s.bounced && s.bounceT >= 0 && s.t >= s.bounceT) {
        s.bounced = true;
        const b = s.rec.bounce!;
        fx.sparkles(b[0], b[1], 14, '#c8f4ff', 0.8);
        fx.sparkles(b[0], b[1], 6, '#ffffff', 0.5);
        fx.say('PING!', b[0], b[1] - 22, 16, 'small');
      }
      if (s.t >= s.total) {
        s.t = s.total;
        impact(s);
      }
      return;
    }
    s.afterT += dt;
    // Falling dirt.
    if (!s.stripsDone && s.afterT > 0.12) {
      let all = true;
      for (const st of s.strips) {
        if (st.landed) continue;
        st.px = st.y;
        st.vy += FALL_G * dt;
        st.y += st.vy * dt;
        if (st.y >= st.drop * CELL) {
          st.y = st.drop * CELL;
          st.landed = true;
          if (st.drop > 3 && Math.random() < 0.35) fx.landingDust(st.col * CELL + 1.5, (st.srcRow + st.n) * CELL + st.y, pal.dust, 1);
        } else all = false;
      }
      if (all) {
        s.stripsDone = true;
        if (s.intermediate && land) {
          land.update(s.after.cells);
          computeTops(land.cells);
        }
      }
    }
    const moving = archers.some((a) => a.path || a.pendingPop);
    if (s.afterT > 1.25 && s.stripsDone && !moving && t - s.poofAt > 0.7) {
      // Settled.
      show = null;
      const sh = archers[s.player];
      sh.fig.hasArrow = true;
      sh.fig.arrowLook = s.player === 0 ? 'arrow' : 'bot';
      s.resolve();
    }
  }

  function hitKindWord(s: ShowState, before: Land): string {
    const h = s.rec.hit;
    if (h.kind === 'archer') return 'BONK!';
    const c = Math.floor(h.x / CELL), r = Math.floor(h.y / CELL);
    let kind = DIRT;
    for (const [dc, dr] of [[0, 0], [0, 1], [1, 0], [-1, 0], [0, -1]]) {
      const cc = c + dc, rr2 = r + dr;
      if (cc < 0 || cc >= COLS || rr2 < 0 || rr2 >= ROWS) continue;
      const v = before.cells[rr2 * COLS + cc];
      if (v !== AIR) {
        kind = v;
        break;
      }
    }
    if (kind === TREE) return 'THWACK!';
    if (kind === ICE) return 'CRACK!';
    if (kind === BUILDING) return 'CLANK!';
    return pal.hitWord;
  }

  let pendingBefore: { land: Land; archers: [Archer, Archer] } | null = null;

  function impact(s: ShowState) {
    s.impacted = true;
    s.afterT = 0;
    const rec = s.rec, h = rec.hit;
    const before = pendingBefore!;
    const arrow = arrowKind(rec.shot.arrow);
    const blastR = arrow.blastRadius;
    const landed = h.kind === 'land' || h.kind === 'archer' || h.kind === 'floor';
    if (landed) {
      const chunkCols = [pal.soil[0], pal.surf, pal.pebble[0]];
      fx.burst(h.x, h.y, Math.max(10, blastR), pal.dust, chunkCols, h.kind === 'archer');
      const size = clamp(14 + blastR * 0.45, 16, 40);
      fx.say(hitKindWord(s, before.land), h.x, h.y - 26 - blastR * 0.6, size);
      if (!opts.lessMotion) shake = Math.max(shake, clamp(blastR / 30, 0.4, 1.6));
    } else if (h.kind === 'gone') {
      fx.sparkles(clamp(h.x, 2, 958), h.y, 5, '#ffffff', 0.5);
    }
    // The land: blast first (what the blast removed), then the dirt that falls.
    if (land) {
      const blasted = copyLand(before.land);
      if (landed && blastR > 0) carve(blasted, h.x, h.y, blastR);
      const after = s.after.cells, bl = blasted.cells;
      const inter = new Uint8Array(after.length);
      const strips: Strip[] = [];
      for (let c = 0; c < COLS; c++) {
        const D: number[] = [], A: number[] = [];
        for (let r = 0; r < ROWS; r++) {
          const i = r * COLS + c;
          const a = after[i], b = bl[i];
          if (a !== AIR && b === AIR) A.push(r);
          else if (b !== AIR && a === AIR) D.push(r);
          inter[i] = a !== AIR && b === AIR ? AIR : a;
        }
        if (!A.length) continue;
        const pairs: [number, number][] = [];
        if (D.length === A.length) for (let k = 0; k < A.length; k++) pairs.push([D[k], A[k]]);
        else for (const r of A) pairs.push([Math.max(0, r - 4), r]);
        // Group into runs that fall together.
        let k = 0;
        while (k < pairs.length) {
          let e = k;
          const drop = pairs[k][1] - pairs[k][0];
          while (e + 1 < pairs.length && pairs[e + 1][0] === pairs[e][0] + 1 && pairs[e + 1][1] - pairs[e + 1][0] === drop) e++;
          strips.push({ col: c, srcRow: pairs[k][0], n: e - k + 1, drop: Math.max(0, drop), kind: after[pairs[k][1] * COLS + c], y: 0, vy: 0, landed: false, px: 0 });
          k = e + 1;
        }
      }
      if (strips.length) {
        s.strips = strips;
        s.intermediate = { cells: inter };
        land.update(inter);
      } else {
        s.stripsDone = true;
        land.update(after);
      }
      computeTops(land.cells);
    } else s.stripsDone = true;

    // The archers: damage, wobble, numbers, then falls and slides, then any pop.
    for (let i = 0; i < 2; i++) {
      const a = archers[i];
      const b = before.archers[i], af = rec.after[i];
      if (b.popped) continue;
      a.health = af.health;
      a.shield = af.shield;
      const dmg = rec.damage[i];
      if (dmg > 0) {
        a.fig.hitT = 1;
        a.fig.dizzy = 1.4;
        fx.say(`−${dmg}`, a.x, a.y - 48, 15, 'damage');
        if (b.shield > af.shield) fx.sparkles(a.x, a.y - 14, 12, '#9ff3ff', 0.7);
      }
      if (af.x !== b.x || af.y !== b.y) {
        a.path = fallPath(s.after, b, af);
        a.seg = 0;
        a.segT = -0.15;
        a.segFrom = { x: b.x, y: b.y, fall: false };
      }
      if (af.popped) a.pendingPop = true;
      a.popped = af.popped;
    }
  }

  /** The way an archer falls (and in the Snow slides) from before to after, cell by cell. */
  function fallPath(after: Land, b: Archer, af: Archer): Step[] {
    const pts: Step[] = [];
    const probe: Archer = { ...b };
    dropArcher(after, probe);
    if (probe.y !== b.y) pts.push({ x: probe.x, y: probe.y, fall: true });
    let guard = 0;
    while (probe.x !== af.x && guard++ < 80) {
      probe.x += Math.sign(af.x - probe.x) * CELL;
      pts.push({ x: probe.x, y: probe.y, fall: false });
      const y0 = probe.y;
      dropArcher(after, probe);
      if (probe.y !== y0) pts.push({ x: probe.x, y: probe.y, fall: true });
    }
    const lastP = pts[pts.length - 1];
    if (!lastP || lastP.x !== af.x || lastP.y !== af.y) pts.push({ x: af.x, y: af.y, fall: af.y > (lastP?.y ?? b.y) });
    return pts;
  }

  // ——— Drawing ———

  function draw(alpha: number) {
    if (!layers) rebuildLayers();
    const Ly = layers!;
    const R = L.ratio, s = L.s;
    const tt = t + alpha * DT;
    const camY = lerp(cam.py, cam.y, alpha);
    const sh = shake > 0 && !opts.lessMotion ? shake * 4 : 0;
    const shx = sh ? (Math.random() * 2 - 1) * sh : 0, shy = sh ? (Math.random() * 2 - 1) * sh : 0;
    const simple = simpleNow();

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    mark('');
    // The background (sky, far and middle layers) is one ready-made image; it shifts a little with the
    // camera (parallax against the land), and the sky colour fills in above it.
    const backDy = Math.round(-camY * s * 0.3 * R) / R;
    const farDy = backDy;
    if (!Ly.back) Ly.back = buildBack();
    if (backDy > 0) {
      g.fillStyle = pal.sky[0];
      g.fillRect(0, 0, canvas.width, Math.ceil(backDy * R) + 1);
    }
    if (world === 'desert' && !opts.lessMotion && !simple) shimmer(Ly.back, tt, backDy * R);
    else g.drawImage(Ly.back, 0, backDy * R);
    g.setTransform(R, 0, 0, R, 0, 0);
    mark('back');

    // Sky life: twinkling stars, clouds, birds.
    if (skyStars.length) {
      g.fillStyle = '#fffbe8';
      const top = L.oy + 90 * s;
      for (let i = 0; i < skyStars.length; i += 3) {
        const st = skyStars[i];
        if (st.y > top) continue;
        g.globalAlpha = Math.max(0, Math.sin(tt * 1.4 + st.p));
        g.fillRect(st.x - 0.3, st.y - 0.3 + farDy * 0.2, st.s + 0.6, st.s + 0.6);
      }
      g.globalAlpha = 1;
    }
    for (const c of clouds) {
      const sp = Ly.clouds[c.i];
      g.globalAlpha = pal.moon ? 0.7 : 0.95;
      g.drawImage(sp.c, c.x, c.y - camY * s * 0.08, sp.w * c.sc, sp.h * c.sc);
    }
    g.globalAlpha = 1;
    if (birds.length) {
      g.strokeStyle = 'rgba(40,50,70,.7)';
      g.lineWidth = Math.max(1, 1.3 * s);
      g.beginPath();
      for (const b of birds) {
        const f = Math.sin(b.ph) * 3.5 * s, w = 6 * s;
        const by = b.y - camY * s * 0.1;
        g.moveTo(b.x - w, by + f);
        g.quadraticCurveTo(b.x - w / 2, by - 2.5 * s, b.x, by);
        g.quadraticCurveTo(b.x + w / 2, by - 2.5 * s, b.x + w, by + f);
      }
      g.stroke();
    }
    mark('far+mid');
    // The field.
    const fx0 = L.ox + shx, fy0 = L.oy - camY * s + shy;
    if (land && hasRound) {
      // A soft shadow off the field's side cliffs, so the land clearly ends there.
      if (L.ox > 2) {
        for (const [x, dir] of [[fx0, -1], [fx0 + 960 * s, 1]] as const) {
          const w = 14 * s + 6;
          const lg = g.createLinearGradient(x, 0, x + dir * w, 0);
          lg.addColorStop(0, 'rgba(10,5,15,.35)');
          lg.addColorStop(1, 'rgba(10,5,15,0)');
          g.fillStyle = lg;
          const top = fy0 + Math.min(surfaceY(dir < 0 ? 1 : 958), 540) * s;
          g.fillRect(dir < 0 ? x - w : x, top, w, cssH - top + 40);
        }
      }
      g.drawImage(land.canvas, fx0, fy0, land.canvas.width / R, land.canvas.height / R);
    }

    mark('land');
    // Everything in field px from here.
    g.setTransform(R * s, 0, 0, R * s, R * fx0, R * fy0);
    if (land && hasRound) {
      if (world === 'desert' && Ly.tumble && !opts.lessMotion) drawTumble(Ly.tumble, tt);
      drawStrips(alpha);
      drawWindsock(tt);
    }
    mark('strips+sock');
    for (let i = 0; i < 2; i++) drawArcher(i, alpha, tt);
    if (show) drawFlight(show, alpha);
    mark('archers+flight');
    fx.draw(g, alpha, 13 / s);
    for (let i = 0; i < 2; i++) drawBars(i, alpha, tt);
    if (show && !show.impacted) offscreenMarker(show, alpha, camY);

    mark('fx+bars');
    // Weather and the overlay, in CSS px.
    g.setTransform(R, 0, 0, R, 0, 0);
    if (!opts.lessMotion) drawWeather(tt);
    mark('weather');
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Optional timing of each drawing part (for the art harness only). */
  const prof: Record<string, number> = {};
  let profAt = 0;
  let profOn = false;
  function mark(name: string) {
    if (!profOn) return;
    const now = performance.now();
    if (name) prof[name] = (prof[name] ?? 0) * 0.95 + (now - profAt) * 0.05;
    profAt = now;
  }

  /** Draws the ready-made background with the Desert's heat shimmer low down (a gentle sideways ripple). */
  function shimmer(img: HTMLCanvasElement, tt: number, dy: number) {
    const R = L.ratio;
    g.setTransform(1, 0, 0, 1, 0, dy);
    const y0 = Math.max(0, Math.floor((L.oy + 540 * L.s * 0.42) * R));
    const y1 = Math.min(img.height, Math.ceil((L.oy + 540 * L.s * 0.8) * R));
    if (y1 <= y0) {
      g.drawImage(img, 0, 0);
      return;
    }
    g.drawImage(img, 0, 0, img.width, y0, 0, 0, img.width, y0);
    g.drawImage(img, 0, y1, img.width, img.height - y1, 0, y1, img.width, img.height - y1);
    const bands = 10;
    const bh = Math.ceil((y1 - y0) / bands);
    for (let b = 0; b < bands; b++) {
      const sy = y0 + b * bh;
      const h = Math.min(bh, y1 - sy);
      if (h <= 0) break;
      const off = Math.sin(tt * 2.2 + b * 0.9) * 1.1 * R;
      g.drawImage(img, 0, sy, img.width, h, off, sy, img.width, h);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** The sky, sun, far and middle layers and the overlay, in CSS px, shifted for parallax. */
  function paintBack(farDx: number, farDy: number, midDx: number, midDy: number, target: CanvasRenderingContext2D = g) {
    const Ly = layers!;
    const R = L.ratio;
    Ly.sky(target);
    if (skyStars.length) {
      target.fillStyle = '#fff6e0';
      target.globalAlpha = 0.7;
      for (const st of skyStars) target.fillRect(st.x, st.y + farDy * 0.2, st.s, st.s);
      target.globalAlpha = 1;
    }
    if (pal.sun) drawSun(target, farDy * 0.2);
    if (Ly.far) target.drawImage(Ly.far, -PAD_X + farDx, -PAD_TOP + farDy, Ly.far.width / R, Ly.far.height / R);
    target.drawImage(Ly.mid, -PAD_X + midDx, -PAD_TOP + midDy, Ly.mid.width / R, Ly.mid.height / R);
    if (Ly.overlay) Ly.overlay(target);
  }

  function buildBack(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(cssW * L.ratio));
    c.height = Math.max(1, Math.round(cssH * L.ratio));
    const bg = c.getContext('2d') as CanvasRenderingContext2D;
    bg.setTransform(L.ratio, 0, 0, L.ratio, 0, 0);
    paintBack(0, 0, 0, 0, bg);
    return c;
  }

  function drawSun(gg: CanvasRenderingContext2D, dy: number) {
    const sun = pal.sun!;
    const s = L.s;
    const x = L.ox + sun.x * 960 * s, y = L.oy + sun.y * 540 * s + dy, r = sun.r * s;
    if (sun.rays && !simpleNow()) {
      gg.fillStyle = sun.rays;
      gg.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i * TAU) / 12 + 0.1;
        gg.moveTo(x, y);
        gg.lineTo(x + Math.cos(a - 0.07) * r * 4.4, y + Math.sin(a - 0.07) * r * 4.4);
        gg.lineTo(x + Math.cos(a + 0.07) * r * 4.4, y + Math.sin(a + 0.07) * r * 4.4);
        gg.closePath();
      }
      gg.fill();
    }
    gg.beginPath();
    gg.arc(x, y, r, 0, TAU);
    gg.fillStyle = sun.c;
    gg.fill();
    gg.beginPath();
    gg.arc(x - r * 0.15, y - r * 0.15, r * 0.7, 0, TAU);
    gg.fillStyle = 'rgba(255,255,255,.55)';
    gg.fill();
  }

  function drawTumble(sp: Sprite, tt: number) {
    const R7 = 7;
    const x = tumble.x;
    if (x < -20 || x > 980) return;
    const hop = Math.abs(Math.sin(tt * 3.1)) * 5;
    const y = surfaceY(clamp(x, 0, 959)) - R7 + 1 - hop;
    g.save();
    g.translate(x, y);
    g.rotate(tumble.rot);
    g.drawImage(sp.c, -sp.w / L.s / 2, -sp.h / L.s / 2, sp.w / L.s, sp.h / L.s);
    g.restore();
  }

  function drawStrips(alpha: number) {
    if (!show || !show.impacted || show.stripsDone || !land) return;
    const k = land.k, tex = land.rockTex;
    for (const st of show.strips) {
      const y = st.landed ? st.y : lerp(st.px, st.y, alpha);
      const dx = st.col * CELL, dy = st.srcRow * CELL + y, h = st.n * CELL;
      if (st.kind === TREE) {
        g.fillStyle = pal.treeA;
        g.fillRect(dx, dy, CELL + 0.2, h);
      } else if (st.kind === DIRT) {
        // Textured like the rock it will settle into.
        const destY = (st.srcRow + st.drop) * CELL;
        g.drawImage(tex, dx * k, destY * k, CELL * k, h * k, dx, dy, CELL + 0.2, h);
      } else {
        g.fillStyle = '#9fd0f0';
        g.fillRect(dx, dy, CELL, h);
      }
      g.fillStyle = 'rgba(20,10,10,.35)';
      g.fillRect(dx, dy + h - 0.6, CELL + 0.2, 0.6);
    }
  }

  function drawWindsock(tt: number) {
    const x = windsockCol * CELL + 1.5, y = windsockY;
    const s = Math.sign(wind) || 1;
    const m = Math.min(1, Math.abs(wind) / Math.max(1, WORLD_WIND_MAX[world]));
    g.save();
    g.lineCap = 'round';
    g.strokeStyle = OL;
    g.lineWidth = 2.6;
    g.beginPath();
    g.moveTo(x, y + 1);
    g.lineTo(x, y - 34);
    g.stroke();
    g.strokeStyle = '#d9d2c4';
    g.lineWidth = 1.4;
    g.stroke();
    g.beginPath();
    g.arc(x, y - 35, 1.8, 0, TAU);
    g.fillStyle = '#ffd23f';
    g.fill();
    g.lineWidth = 0.8;
    g.strokeStyle = OL;
    g.stroke();
    const droop = lerp(1.35, 0.08, m);
    const dx = s * Math.cos(droop), dy = Math.sin(droop);
    const px = -dy, py = dx;
    const bx = x + s * 1, by = y - 33;
    const wobA = opts.lessMotion ? 0 : 1;
    for (let k = 0; k < 4; k++) {
      const w0 = 6 - k * 0.8, w1 = 6 - (k + 1) * 0.8;
      const wv0 = Math.sin(tt * 9 - k) * 0.9 * (m + 0.25) * wobA, wv1 = Math.sin(tt * 9 - k - 1) * 0.9 * (m + 0.25) * wobA;
      const ax = bx + dx * 5.5 * k + px * wv0, ay = by + dy * 5.5 * k + py * wv0;
      const cx = bx + dx * 5.5 * (k + 1) + px * wv1, cy = by + dy * 5.5 * (k + 1) + py * wv1;
      g.beginPath();
      g.moveTo(ax + (px * w0) / 2, ay + (py * w0) / 2);
      g.lineTo(cx + (px * w1) / 2, cy + (py * w1) / 2);
      g.lineTo(cx - (px * w1) / 2, cy - (py * w1) / 2);
      g.lineTo(ax - (px * w0) / 2, ay - (py * w0) / 2);
      g.closePath();
      g.fillStyle = k % 2 ? '#ffffff' : '#ff6a2a';
      g.fill();
      g.lineWidth = 0.7;
      g.strokeStyle = OL;
      g.stroke();
    }
    g.restore();
  }

  function archerPos(a: ArcherView, alpha: number): [number, number] {
    let y = lerp(a.py, a.y, alpha) - a.lift;
    if (celebrating !== null && archers[celebrating] === a && !opts.lessMotion) y -= Math.abs(Math.sin(t * 6)) * 7;
    return [lerp(a.px, a.x, alpha), y];
  }

  function drawArcher(i: number, alpha: number, tt: number) {
    const a = archers[i];
    if (!a.visible || !hasRound) return;
    const [x, y] = archerPos(a, alpha);
    g.save();
    g.translate(x, y);
    // A shield bubble.
    if (a.shield > 0 && !simpleNow()) {
      const r = 22 + Math.sin(tt * 2) * 0.5;
      const cy = -16;
      const rg = g.createRadialGradient(-r * 0.3, cy - r * 0.35, r * 0.1, 0, cy, r);
      rg.addColorStop(0, 'rgba(255,255,255,.12)');
      rg.addColorStop(0.72, 'rgba(150,225,255,.06)');
      rg.addColorStop(1, 'rgba(150,225,255,.3)');
      g.beginPath();
      g.arc(0, cy, r, 0, TAU);
      g.fillStyle = rg;
      g.fill();
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(255,255,255,.6)';
      g.stroke();
    }
    drawFigure(g, a.fig, tt, K, simpleNow(), i * 1.7);
    g.restore();
  }

  function drawBars(i: number, alpha: number, tt: number) {
    const a = archers[i];
    if (!a.visible || !hasRound) return;
    const [x, y] = archerPos(a, alpha);
    const sc = Math.max(1, 0.85 / L.s);
    g.save();
    g.translate(x, y - 40);
    g.scale(sc, sc);
    const w = 26;
    rr(g, -w / 2 - 1, -3, w + 2, 6, 3);
    g.fillStyle = 'rgba(18,22,40,.7)';
    g.fill();
    const hp = clamp(a.shownHealth / 100, 0, 1);
    if (hp > 0.005) {
      rr(g, -w / 2, -2, Math.max(2, w * hp), 4, 2);
      const low = a.shownHealth < 35;
      g.fillStyle = low ? '#ff9a4a' : '#6fe36a';
      g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.fillRect(-w / 2 + 1, -1.6, Math.max(1, w * hp - 2), 1.2);
    }
    if (a.shieldMax > 1 && a.shownShield > 0.5) {
      rr(g, -w / 2, 3.6, w * clamp(a.shownShield / a.shieldMax, 0, 1), 2, 1);
      g.fillStyle = '#8fe8ff';
      g.fill();
    }
    const name = opts.names[i];
    if (name) badge(g, name, 0, -9, 5.2, i === 0 ? '#e9ffe4' : '#e6f4ff', '#22301e');
    if (turn === i && !show && celebrating === null) {
      const by = -22 + (opts.lessMotion ? 0 : Math.sin(tt * 6) * 2);
      g.beginPath();
      g.moveTo(-5, by - 6);
      g.lineTo(5, by - 6);
      g.lineTo(0, by);
      g.closePath();
      g.fillStyle = '#ffc83d';
      g.fill();
      g.lineWidth = 1.1;
      g.strokeStyle = OL;
      g.stroke();
    }
    g.restore();
  }

  function drawFlight(s: ShowState, alpha: number) {
    const now = s.impacted ? s.total + s.afterT : lerp(s.pt, s.t, alpha);
    const n = s.path.length / 2;
    const head = Math.min(now, s.total);
    // The trail: the last half second of the flight, fading (it's gone half a second after landing).
    const from = Math.max(0, now - TRAIL_SECONDS);
    if (from < head) {
      const st = ARROW_STYLES[s.look] ?? ARROW_STYLES.arrow;
      const i0 = Math.floor(from * 60), i1 = Math.min(n - 1, Math.ceil(head * 60));
      g.lineCap = 'round';
      let [lx, ly] = pathAt(s, from);
      for (let i = i0 + 1; i <= i1; i++) {
        const ti = Math.min(i / 60, head);
        const [x, y] = i === i1 ? pathAt(s, head) : [s.path[i * 2], s.path[i * 2 + 1]];
        const k = clamp(1 - (now - ti) / TRAIL_SECONDS, 0, 1);
        g.strokeStyle = `rgba(${st.trail},${(k * 0.8).toFixed(3)})`;
        g.lineWidth = 0.5 + k * (s.look === 'giant' ? 4 : 2.4);
        g.beginPath();
        g.moveTo(lx, ly);
        g.lineTo(x, y);
        g.stroke();
        lx = x;
        ly = y;
      }
    }
    if (s.impacted) return;
    const [x, y, ang] = pathAt(s, now);
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.scale(K, K);
    arrowShape(g, -arrowLength(s.look) + 4, s.look);
    g.restore();
  }

  function offscreenMarker(s: ShowState, alpha: number, camY: number) {
    const [x, y] = pathAt(s, lerp(s.pt, s.t, alpha));
    const top = (L.insets.top - L.oy) / L.s + camY;
    if (y > top + 4) return;
    const sz = Math.max(5, 9 / L.s);
    const my = top + sz * 1.6;
    g.save();
    g.translate(clamp(x, sz, 960 - sz), my);
    g.beginPath();
    g.moveTo(0, -sz);
    g.lineTo(sz * 0.9, sz * 0.7);
    g.lineTo(-sz * 0.9, sz * 0.7);
    g.closePath();
    g.fillStyle = '#ffffff';
    g.fill();
    g.lineWidth = sz * 0.25;
    g.strokeStyle = OL;
    g.stroke();
    g.restore();
  }

  function drawWeather(tt: number) {
    const P = weather;
    const s = L.s;
    if (pal.weather === 'leaves') {
      for (const p of P) {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.ph);
        g.scale(1, Math.sin(p.ph * 1.7));
        g.beginPath();
        g.ellipse(0, 0, (5 * p.z + 2) * s, (2.2 * p.z + 0.9) * s, 0, 0, TAU);
        g.fillStyle = p.c;
        g.fill();
        g.restore();
      }
    } else if (pal.weather === 'snow') {
      g.fillStyle = 'rgba(255,255,255,.92)';
      g.beginPath();
      for (const p of P) {
        const r = (0.8 + 1.7 * p.z) * s;
        g.moveTo(p.x + r, p.y);
        g.arc(p.x, p.y, r, 0, TAU);
      }
      g.fill();
    } else if (pal.weather === 'sand') {
      g.strokeStyle = 'rgba(255,236,196,.55)';
      g.lineWidth = Math.max(1, 1.2 * s);
      g.beginPath();
      const ws = wind / Math.max(1, WORLD_WIND_MAX[world]);
      for (const p of P) {
        const l = (8 + Math.abs(ws) * 18) * p.z * s * (Math.sign(ws) || 1);
        g.moveTo(p.x, p.y);
        g.lineTo(p.x - l, p.y);
      }
      g.stroke();
    } else {
      for (const p of P) {
        const a = 0.35 + 0.35 * Math.sin(tt * 2 + p.ph);
        g.fillStyle = `rgba(255,220,150,${a.toFixed(3)})`;
        g.beginPath();
        g.arc(p.x, p.y, (1 + p.z) * s, 0, TAU);
        g.fill();
      }
    }
  }

  // ——— The interface ———

  function finishShow() {
    if (!show) return;
    const s = show;
    show = null;
    s.resolve();
  }

  function finishAims() {
    for (const a of archers) {
      if (a.aimAnim) {
        const an = a.aimAnim;
        a.aimAnim = null;
        setPose(a, an.to, an.toPull);
        an.resolve();
      }
    }
  }

  const view: FightView & { debugProfile(): Record<string, number> } = {
    setRound(round) {
      if (disposed) return;
      finishShow();
      finishAims();
      fx.clear();
      celebrating = null;
      celebrateT = 0;
      const worldChanged = round.world !== world || !hasRound;
      world = round.world;
      pal = WORLDS[world];
      wind = round.wind;
      hasRound = true;
      if (worldChanged) layers = null;
      rebuildLayers();
      land = new LandArt(L, world, pal, round.land.cells, simpleNow());
      computeTops(round.land.cells);
      // The windsock stands on the highest ground between the archers.
      let best = COLS >> 1;
      const a0 = Math.floor(round.archers[0].x / CELL) + 8, a1 = Math.floor(round.archers[1].x / CELL) - 8;
      for (let c = Math.max(4, a0); c <= Math.min(COLS - 5, a1); c++) if (tops[c] < tops[best]) best = c;
      windsockCol = best;
      windsockY = surfaceY(best * CELL + 1.5);
      initAmbient();
      cam.y = cam.py = 0;
      for (let i = 0; i < 2; i++) {
        const a = archers[i], src = round.archers[i];
        a.x = a.px = src.x;
        a.y = a.py = src.y;
        a.visible = !src.popped;
        a.popped = src.popped;
        a.health = a.shownHealth = src.health;
        a.shield = a.shownShield = src.shield;
        a.shieldMax = Math.max(1, src.shield);
        a.path = null;
        a.pendingPop = false;
        const f = a.fig;
        f.hitT = 0; f.squash = 0; f.stringWob = 0; f.dizzy = 0; f.koT = -1; f.cheer = 0; f.hasArrow = true;
        f.arrowLook = i === 0 ? 'arrow' : 'bot';
        setPose(a, i === 0 ? 45 : 135, 0);
        if (opts.lessMotion) a.lift = 0;
        else {
          a.lift = 220;
          a.liftV = 0;
          a.liftDelay = 0.15 + i * 0.18;
        }
      }
      quietUntil = t + 1.5;
    },
    setAim(player, angle, pull) {
      const a = archers[player];
      if (!a) return;
      if (a.aimAnim) {
        const an = a.aimAnim;
        a.aimAnim = null;
        an.resolve();
      }
      setPose(a, angle, pull);
    },
    aimTo(player, angle, pull, ms) {
      const a = archers[player];
      if (!a || disposed) return Promise.resolve();
      if (a.aimAnim) {
        const an = a.aimAnim;
        a.aimAnim = null;
        an.resolve();
      }
      return new Promise<void>((resolve) => {
        a.aimAnim = { from: a.angle, to: angle, fromPull: a.fig.draw, toPull: pull, t: 0, dur: Math.max(0, ms) / 1000, resolve };
      });
    },
    setTurn(player) {
      turn = player;
    },
    playShot(sh) {
      if (disposed) return Promise.resolve();
      finishShow();
      finishAims();
      return new Promise<void>((resolve) => {
        const rec = sh.record;
        const path = rec.path && rec.path.length >= 4 ? rec.path : [rec.hit.x, rec.hit.y, rec.hit.x, rec.hit.y];
        const look = arrowLook(rec.shot.arrow, sh.player);
        const shooter = archers[sh.player];
        setPose(shooter, rec.shot.angle, 0);
        shooter.fig.hasArrow = false;
        shooter.fig.arrowLook = look;
        shooter.fig.stringWob = 1;
        let bounceT = -1;
        if (rec.bounce) {
          for (let i = 0; i < path.length; i += 2) {
            if (path[i] === rec.bounce[0] && path[i + 1] === rec.bounce[1]) {
              bounceT = i / 2 / 60;
              break;
            }
          }
        }
        pendingBefore = { land: copyLand(sh.landBefore), archers: [{ ...sh.archersBefore[0] }, { ...sh.archersBefore[1] }] };
        // Keep the picture's land in step with what the screen says it was.
        if (land) {
          land.update(sh.landBefore.cells);
          computeTops(land.cells);
        }
        show = {
          rec, player: sh.player, look, path, total: Math.max(1, path.length / 2 - 1) / 60, t: 0, pt: 0, bounceT, bounced: false,
          impacted: false, afterT: 0, after: copyLand(sh.landAfter), intermediate: null, strips: [], stripsDone: false, poofs: 0, poofAt: -10, resolve,
        };
      });
    },
    celebrate(player) {
      if (!archers[player] || !archers[player].visible) return;
      celebrating = player;
      celebrateT = 0;
      fx.confetti(archers[player].x, archers[player].y - 30, 26);
    },
    resize(w, h, ins) {
      if (disposed) return;
      cssW = Math.max(1, w);
      cssH = Math.max(1, h);
      insets = { ...ins };
      relayout();
      initAmbient();
    },
    setOptions(o) {
      const was = simpleNow();
      if (o.lessMotion !== undefined) opts.lessMotion = o.lessMotion;
      if (o.simple !== undefined) opts.simple = o.simple;
      if (o.names) opts.names = [...o.names] as [string, string];
      fx.gentle = opts.lessMotion;
      if (opts.lessMotion) {
        shake = 0;
        for (const a of archers) a.lift = 0;
      }
      if (simpleNow() !== was) {
        relayout();
        initAmbient();
      }
    },
    archerOnScreen(player) {
      const a = archers[player];
      if (!a || !hasRound || !a.visible) return null;
      return { x: L.ox + a.x * L.s, y: L.oy + (a.y - HANDS_HEIGHT - cam.y) * L.s };
    },
    stats() {
      return { fps, frameMs, quality: simpleNow() ? 'simple' : 'full', pixelRatio: L.ratio, particles: fx.parts.length, slowSwitches };
    },
    debugProfile() {
      profOn = true;
      const out: Record<string, number> = {};
      for (const k in prof) out[k] = Math.round(prof[k] * 100) / 100;
      return out;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      finishShow();
      finishAims();
      land = null;
      layers = null;
    },
  };

  fx.gentle = opts.lessMotion;
  fx.max = simpleNow() ? SIMPLE_PARTICLES : MAX_PARTICLES;
  relayout();
  initAmbient();
  raf = requestAnimationFrame(frame);
  return view;
}
