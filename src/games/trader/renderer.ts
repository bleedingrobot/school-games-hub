/**
 * Star Trader's picture (docs/TRADER-PLAN.md, section 17): one full-screen 2D canvas with our own art drawn in code.
 * It shows the sky, the planet you are at, your ship, the warp jump and the pirate fight. It only shows what the
 * game tells it; nothing here changes the rules.
 *
 * - Its own requestAnimationFrame loop. Effects step by the real time between frames (capped).
 * - The sky (nebula and star layers) is drawn once to off-screen canvases.
 * - Automatic simpler graphics when frames are slow for a while (counted in stats().slowSwitches).
 * - Reduced motion: still planet, no twinkle, no bobbing, no shake, short effects.
 */
import { NEBULAE, drawSky, makeSky, type Sky } from './art/space';
import { Fx } from './art/fx';
import { drawPlanet, lookOf } from './art/planets';
import { MUZZLE, drawShip, type ShipKind } from './art/ships';
import { TAU, clamp, ease, lerp, rng } from './art/util';

export interface Scene {
  kind: 'planet' | 'fight';
  /** The planet's real name (its look comes from it). */
  planet: string;
  /** Your ship, 0 (Flea) to 5 (Termite). */
  ship: number;
  /** The pirate's kind, 0 to 2, for a fight. */
  pirate?: number;
  /** Which sky colours, 0 to 5. */
  nebula: number;
  /** City lights on the night side, 0 to 1. */
  lights: number;
  /** Your ship's hull, 0 to 1 (smoke when low). */
  hull?: number;
}

export interface SpaceViewOptions {
  lessMotion: boolean;
  simple: boolean;
}

export interface SpaceView {
  setScene(scene: Scene): void;
  /** The jump: stars stream past, a flash, then it is over. */
  warp(ms?: number): Promise<void>;
  /** A shot from you or the pirates. `shield` shows the hit soaked by a shield. */
  shoot(from: 'you' | 'pirate', o: { weak?: boolean; shield?: boolean }): Promise<void>;
  raiseShields(on: boolean): void;
  setHull(who: 'you' | 'pirate', ratio: number): void;
  explode(who: 'you' | 'pirate'): Promise<void>;
  flee(): Promise<void>;
  robbed(): Promise<void>;
  /** Show both ships again after a fight. */
  resetFight(): void;
  setOptions(o: Partial<SpaceViewOptions>): void;
  stats(): { simple: boolean; slowSwitches: number; frames: number; particles: number };
  destroy(): void;
}

interface Craft {
  x: number;
  y: number;
  visible: boolean;
  thrust: number;
  flash: number;
  damage: number;
  /** Extra shift for effects (recoil, flee). */
  dx: number;
  dy: number;
  tilt: number;
}

const craft = (): Craft => ({ x: 0, y: 0, visible: true, thrust: 0.25, flash: 0, damage: 0, dx: 0, dy: 0, tilt: 0 });
const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

export function createSpaceView(canvas: HTMLCanvasElement, options: SpaceViewOptions): SpaceView {
  const g = canvas.getContext('2d');
  if (!g) return nullView();
  return makeView(canvas, g, options);
}

function nullView(): SpaceView {
  const none = () => Promise.resolve();
  return {
    setScene: () => undefined, warp: none, shoot: none, raiseShields: () => undefined, setHull: () => undefined, explode: none,
    flee: none, robbed: none, resetFight: () => undefined, setOptions: () => undefined,
    stats: () => ({ simple: true, slowSwitches: 0, frames: 0, particles: 0 }), destroy: () => undefined,
  };
}

function makeView(canvas: HTMLCanvasElement, g: CanvasRenderingContext2D, initial: SpaceViewOptions): SpaceView {
  let opts = { ...initial };
  let simple = initial.simple;
  let scene: Scene = { kind: 'planet', planet: 'Earth', ship: 0, nebula: 0, lights: 0.5 };
  let cw = 0;
  let ch = 0;
  let ratio = 1;
  let sky: Sky | null = null;
  let skyKey = '';
  let scroll = 0;
  let clock = 0;
  let last = performance.now();
  let raf = 0;
  let frames = 0;
  let slow = 0;
  let slowSwitches = 0;
  let avg = 16;
  let shields = false;
  let shieldGlow = 0;
  let youHull = 1;
  let pirateHull = 1;
  const fx = new Fx();
  const you = craft();
  const pirate = craft();
  let pod: { x: number; y: number; t: number } | null = null;
  let warping: { start: number; ms: number; done: () => void } | null = null;
  let streaks: { a: number; speed: number; len: number; hue: number }[] = [];
  const timers = new Set<number>();

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };
  const dur = (ms: number) => (opts.lessMotion ? ms * 0.4 : ms);

  function applyOptions() {
    fx.gentle = opts.lessMotion;
    fx.cap = simple ? 120 : 320;
  }
  applyOptions();

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const r = simple ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    if (w === cw && h === ch && r === ratio) return;
    cw = w;
    ch = h;
    ratio = r;
    canvas.width = Math.round(w * r);
    canvas.height = Math.round(h * r);
    skyKey = '';
  }

  function ensureSky() {
    const key = `${cw}x${ch}:${scene.nebula}:${simple}`;
    if (key === skyKey && sky) return;
    skyKey = key;
    sky = makeSky(cw, ch, NEBULAE[scene.nebula % NEBULAE.length], 11 + scene.nebula * 97, simple);
  }

  function layout() {
    const s = clamp(Math.min(cw / 9, ch / 4.4) / 100, 0.55, 1.5);
    return { s };
  }

  function placeCraft(now: number) {
    const { s } = layout();
    if (scene.kind === 'fight') {
      // The fight panel sits along the bottom, so the ships fly in the top part of the picture.
      you.x = cw * 0.27 + you.dx;
      you.y = ch * 0.3 + you.dy + (opts.lessMotion ? 0 : Math.sin(now * 1.3) * 5 * s);
      pirate.x = cw * 0.72 + pirate.dx;
      pirate.y = ch * 0.25 + pirate.dy + (opts.lessMotion ? 0 : Math.sin(now * 1.1 + 2) * 6 * s);
    } else {
      you.x = cw * 0.56 + you.dx;
      you.y = ch * 0.2 + you.dy + (opts.lessMotion ? 0 : Math.sin(now * 0.9) * 6 * s);
    }
  }

  function draw(dt: number) {
    ensureSky();
    if (!sky) return;
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    scroll += dt * (scene.kind === 'fight' ? 5 : 11) * (opts.lessMotion ? 0 : 1);
    const warpP = warping ? clamp((performance.now() - warping.start) / warping.ms, 0, 1) : 0;
    // The sky streams faster as the jump builds.
    drawSky(g, sky, cw, ch, scroll + warpP * warpP * 600, clock, !opts.lessMotion);

    const look = lookOf(scene.planet);
    const base = Math.min(cw * 0.22, ch * 0.36);
    const { s } = layout();
    placeCraft(clock);

    g.save();
    if (fx.shake > 0 && !opts.lessMotion) g.translate((Math.random() - 0.5) * fx.shake * 18, (Math.random() - 0.5) * fx.shake * 18);

    if (scene.kind === 'planet') {
      const r = base * clamp(0.55 + 0.3 * look.size, 0.62, 1.12);
      drawPlanet(g, look, cw * 0.74, ch * 0.58, r, { t: clock, still: opts.lessMotion, plain: simple, lights: scene.lights });
    } else {
      // The planet sits small and far away behind the fight.
      const r = base * 0.5 * clamp(0.6 + 0.3 * look.size, 0.7, 1.1);
      drawPlanet(g, look, cw * 0.84, ch * 0.9, r, { t: clock, still: opts.lessMotion, plain: simple, lights: 0 });
    }

    const burn = warping ? 0.4 + warpP * 1.4 : 0.35;
    if (you.visible) {
      const kind: ShipKind = { side: 'trader', index: scene.ship };
      const tilt = you.tilt + (warping ? Math.sin(clock * 60) * 0.015 * warpP : 0);
      drawShip(g, kind, you.x + (warping ? Math.sin(clock * 70) * 2 * warpP : 0), you.y, s, { thrust: clamp(you.thrust + burn - 0.35, 0, 1.6), t: clock, damage: scene.kind === 'fight' ? 1 - youHull : 0, flash: you.flash, tilt });
      if (shields && scene.kind === 'fight') {
        const rx = 76 * s;
        const ry = 48 * s;
        const glow = g.createRadialGradient(you.x, you.y, ry * 0.6, you.x, you.y, rx);
        glow.addColorStop(0, 'rgba(125,211,252,0)');
        glow.addColorStop(0.8, `rgba(125,211,252,${0.12 + shieldGlow * 0.3})`);
        glow.addColorStop(1, `rgba(186,230,253,${0.5 + shieldGlow * 0.4})`);
        g.fillStyle = glow;
        g.beginPath();
        g.ellipse(you.x, you.y, rx, ry, 0, 0, TAU);
        g.fill();
        g.strokeStyle = `rgba(224,242,254,${0.55 + shieldGlow * 0.4})`;
        g.lineWidth = 1.6;
        g.stroke();
      }
    }
    if (scene.kind === 'fight' && pirate.visible) {
      const ps = s * (scene.pirate === 2 ? 1.12 : scene.pirate === 1 ? 1.02 : 0.95);
      drawShip(g, { side: 'pirate', index: scene.pirate ?? 0 }, pirate.x, pirate.y, ps, { thrust: pirate.thrust, t: clock, damage: 1 - pirateHull, flash: pirate.flash, flip: true });
    }
    if (pod) {
      const pr = clamp(pod.t, 0, 1);
      g.save();
      g.translate(pod.x + pr * cw * 0.5, pod.y - pr * ch * 0.15);
      g.globalAlpha = 1 - pr * pr;
      g.fillStyle = '#e2e8f0';
      g.beginPath();
      g.ellipse(0, 0, 9, 5, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#38bdf8';
      g.beginPath();
      g.arc(3, -1, 2.4, 0, TAU);
      g.fill();
      g.restore();
    }
    fx.draw(g);
    g.restore();

    if (warping) {
      // Stars streak out from the middle, then a flash.
      const cx = cw * 0.5;
      const cy = ch * 0.45;
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.lineCap = 'round';
      const reach = Math.hypot(cw, ch);
      const p = ease(clamp(warpP / 0.85, 0, 1));
      for (const st of streaks) {
        const d0 = p * st.speed * reach * 0.7;
        const d1 = d0 + st.len * p * reach * 0.5;
        g.strokeStyle = `hsla(${st.hue},90%,${70 + p * 20}%,${0.15 + p * 0.7})`;
        g.lineWidth = 0.8 + p * 1.6;
        g.beginPath();
        g.moveTo(cx + Math.cos(st.a) * d0, cy + Math.sin(st.a) * d0);
        g.lineTo(cx + Math.cos(st.a) * d1, cy + Math.sin(st.a) * d1);
        g.stroke();
      }
      g.restore();
      if (warpP > 0.8) {
        g.fillStyle = `rgba(255,255,255,${clamp((warpP - 0.8) / 0.2, 0, 1)})`;
        g.fillRect(0, 0, cw, ch);
      }
    }
    if (fx.flash > 0 && !opts.lessMotion) {
      g.fillStyle = `rgba(255,244,214,${fx.flash * 0.35})`;
      g.fillRect(0, 0, cw, ch);
    }
    // A little vignette keeps the middle bright and the edges calm, so the panels read well.
    if (!simple) {
      const vg = g.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.35, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,10,0.45)');
      g.fillStyle = vg;
      g.fillRect(0, 0, cw, ch);
    }
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    resize();
    const dt = clamp((now - last) / 1000, 0, 0.05);
    const raw = now - last;
    last = now;
    clock += dt;
    frames += 1;
    // Slow for a while? Switch to simpler graphics (once).
    avg = lerp(avg, raw, 0.05);
    if (!simple && frames > 90 && avg > 28) {
      slow += 1;
      if (slow > 90) {
        simple = true;
        slowSwitches += 1;
        applyOptions();
        skyKey = '';
        resize();
      }
    } else slow = 0;
    fx.update(dt);
    you.flash = Math.max(0, you.flash - dt * 4);
    pirate.flash = Math.max(0, pirate.flash - dt * 4);
    shieldGlow = Math.max(0, shieldGlow - dt * 2.5);
    if (pod) pod.t += dt * 0.8;
    // Smoke from a hurt ship.
    if (scene.kind === 'fight' && !opts.lessMotion) {
      if (youHull < 0.5 && you.visible && Math.random() < (0.5 - youHull) * 0.9) fx.smoke(you.x - 20, you.y);
      if (pirateHull < 0.5 && pirate.visible && Math.random() < (0.5 - pirateHull) * 0.9) fx.smoke(pirate.x + 20, pirate.y);
    }
    if (cw > 0 && ch > 0) draw(dt);
  }
  raf = requestAnimationFrame(frame);

  const aim = () => {
    const { s } = layout();
    const ps = s * (scene.pirate === 2 ? 1.12 : scene.pirate === 1 ? 1.02 : 0.95);
    return { s, ps };
  };

  return {
    setScene(next) {
      const kindChanged = next.kind !== scene.kind;
      scene = next;
      youHull = next.hull ?? 1;
      if (kindChanged || next.kind === 'fight') {
        fx.clear();
        pod = null;
        you.visible = true;
        pirate.visible = true;
        you.dx = you.dy = pirate.dx = pirate.dy = 0;
        shields = false;
        pirateHull = 1;
      }
    },
    warp(ms = 1500) {
      return new Promise<void>((resolve) => {
        const total = dur(ms);
        const rand = rng(Math.floor(performance.now()));
        streaks = Array.from({ length: simple ? 90 : 220 }, () => ({ a: rand() * TAU, speed: 0.15 + rand() * 0.85, len: 0.05 + rand() * 0.3, hue: 190 + rand() * 80 }));
        warping = { start: performance.now(), ms: total, done: resolve };
        later(() => {
          warping = null;
          fx.flash = 0.6;
          resolve();
        }, total);
      });
    },
    async shoot(from, o) {
      const { s, ps } = aim();
      const fromYou = from === 'you';
      const sx = fromYou ? you.x + MUZZLE[0] * s : pirate.x - MUZZLE[0] * ps;
      const sy = fromYou ? you.y : pirate.y;
      const tx = fromYou ? pirate.x - 30 * ps : you.x + 30 * s;
      const ty = fromYou ? pirate.y : you.y;
      const flightMs = dur(380);
      fx.bolt(sx, sy, tx, ty, fromYou ? (o.weak ? '#fde68a' : '#4ade80') : '#fb7185', o.weak ? 2 : 4, flightMs / 1000);
      fx.spark(sx, sy, 6, fromYou ? '#bbf7d0' : '#fecdd3', 90);
      (fromYou ? you : pirate).dx += fromYou ? -6 : 6;
      later(() => ((fromYou ? you : pirate).dx = 0), 120);
      await wait(flightMs * 0.85);
      if (!fromYou && (o.shield || shields)) {
        shieldGlow = 1;
        fx.ripple(you.x, you.y, 76 * s, 48 * s, '#7dd3fc');
        fx.spark(tx, ty, 8, '#7dd3fc', 120);
      } else {
        (fromYou ? pirate : you).flash = 1;
        fx.spark(tx, ty, o.weak ? 8 : 18, '#fde047', 190);
        fx.shake = Math.max(fx.shake, o.weak ? 0.1 : 0.2);
      }
      await wait(dur(220));
    },
    raiseShields(on) {
      shields = on;
      if (on) {
        shieldGlow = 1;
        const { s } = aim();
        fx.ripple(you.x, you.y, 76 * s, 48 * s, '#bae6fd', 0.9);
      }
    },
    setHull(who, ratio) {
      if (who === 'you') youHull = clamp(ratio, 0, 1);
      else pirateHull = clamp(ratio, 0, 1);
    },
    async explode(who) {
      const { s } = aim();
      const c = who === 'you' ? you : pirate;
      fx.boom(c.x, c.y, 46 * s);
      await wait(dur(200));
      fx.boom(c.x + 24 * s, c.y - 10 * s, 30 * s);
      c.visible = false;
      if (who === 'you') pod = { x: you.x, y: you.y, t: 0 };
      await wait(dur(700));
    },
    async flee() {
      you.thrust = 1.2;
      for (let i = 0; i < 20; i++) {
        you.dx += 12 + i * 6;
        you.tilt = -0.05;
        await wait(dur(32));
      }
      fx.flash = 0.7;
      you.visible = false;
      you.tilt = 0;
      await wait(dur(400));
    },
    async robbed() {
      const { s } = aim();
      for (let i = 0; i < 8; i++) {
        fx.crate(you.x + 10 * s, you.y, 220 + Math.random() * 160, -80 + Math.random() * 90);
        await wait(dur(70));
      }
      later(() => {
        pirate.thrust = 1;
        pirate.dx = 0;
      }, 0);
      await wait(dur(700));
      pirate.visible = false;
      await wait(dur(300));
    },
    resetFight() {
      you.visible = true;
      pirate.visible = true;
      you.dx = you.dy = pirate.dx = pirate.dy = 0;
      you.thrust = 0.25;
      pirate.thrust = 0.25;
      you.tilt = 0;
      pod = null;
      shields = false;
      fx.clear();
    },
    setOptions(o) {
      opts = { ...opts, ...o };
      if (o.simple !== undefined) simple = o.simple;
      applyOptions();
      skyKey = '';
      resize();
    },
    stats: () => ({ simple, slowSwitches, frames, particles: fx.count }),
    destroy() {
      cancelAnimationFrame(raf);
      for (const id of timers) window.clearTimeout(id);
      timers.clear();
    },
  };
}
