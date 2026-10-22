/**
 * The home screen's picture (the pupil's drawing: an archer on a rock, drawing a big bow): the world's own sky, far
 * mountains and hills from the fight art, a rock in front, your archer drawing the bow and loosing an arrow at a target,
 * again and again. It fills the screen behind the buttons. With less motion it's a still picture (bow drawn).
 */
import { useEffect, useRef } from 'react';
import type { BowId, WorldId } from '../../../shared/archery/types';
import { arrowShape, drawFigure, type Figure } from './art/archers';
import { PAD_TOP, PAD_X, makeSky, paintFar, paintMid } from './art/backdrop';
import type { Layout } from './art/layout';
import { OL, TAU, clamp, ease, lerp } from './art/util';
import { WORLDS } from './art/worlds';

/** Seconds in one shot: draw, hold, fly, stuck in the target. */
const CYCLE = 4.2;
/** The archer and the target stand on the screen itself (not the backdrop's field), in a space kept clear above Play:
 * the archer's feet at HERO_AT of the width and height, the target at TARGET_X of the width. */
const HERO_AT = { x: 0.3, y: 0.6 };
const TARGET_X = 0.7;
/** Where they stand, in the foreground's own units (the archer's feet at 0, 0). */
const HERO = { x: 0, y: 0 };
const K = 0.95;

function homeLayout(cw: number, ch: number, ratio: number): Layout {
  const s = Math.max(cw / 960, ch / 540);
  return { cw, ch, ratio, s, ox: (cw - 960 * s) / 2, oy: ch - 540 * s, below: 40, insets: { top: 0, right: 0, bottom: 0, left: 0 } };
}

function drawRock(g: CanvasRenderingContext2D, top: string, side: string) {
  g.save();
  g.translate(-340, -452);
  g.beginPath();
  g.moveTo(170, 560);
  g.lineTo(200, 480);
  g.lineTo(250, 458);
  g.lineTo(300, 452);
  g.lineTo(380, 452);
  g.lineTo(430, 462);
  g.lineTo(470, 500);
  g.lineTo(500, 560);
  g.closePath();
  const gr = g.createLinearGradient(0, 450, 0, 560);
  gr.addColorStop(0, top);
  gr.addColorStop(1, side);
  g.fillStyle = gr;
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = OL;
  g.stroke();
  // Cracks and a lit top edge.
  g.strokeStyle = 'rgba(30,20,10,.35)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(260, 470);
  g.lineTo(285, 505);
  g.lineTo(275, 540);
  g.moveTo(400, 470);
  g.lineTo(420, 500);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.35)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(252, 460);
  g.lineTo(300, 455);
  g.lineTo(378, 455);
  g.stroke();
  g.restore();
}

function drawTarget(g: CanvasRenderingContext2D, TARGET: { x: number; y: number }, wobble: number) {
  g.save();
  g.translate(TARGET.x, TARGET.y);
  // The post.
  g.fillStyle = '#8a5a34';
  g.fillRect(-4, -10, 8, 80);
  g.strokeStyle = OL;
  g.lineWidth = 2;
  g.strokeRect(-4, -10, 8, 80);
  g.rotate(wobble * 0.06);
  for (const [r, c] of [[34, '#ffffff'], [27, '#2a2a35'], [21, '#2f80ed'], [14, '#e53935'], [7, '#ffd23f']] as const) {
    g.beginPath();
    g.arc(0, -40, r, 0, TAU);
    g.fillStyle = c;
    g.fill();
  }
  g.beginPath();
  g.arc(0, -40, 34, 0, TAU);
  g.lineWidth = 3;
  g.strokeStyle = OL;
  g.stroke();
  g.restore();
}

/**
 * Simpler graphics (the player's setting, or by itself when frames are slow for a second or so, as in a fight): a
 * lower pixel density, and at the second step a little lower still, with the loop at about 30 frames a second.
 */
export function HomeScene({ world = 'forest', bow = 'starter', lessMotion, simple = false }: { world?: WorldId; bow?: BowId; lessMotion: boolean; simple?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let g: CanvasRenderingContext2D | null = null;
    try {
      g = canvas.getContext('2d');
    } catch {
      g = null;
    }
    if (!g || typeof requestAnimationFrame !== 'function') return;
    const ctx = g;
    const pal = WORLDS[world];
    let L: Layout | null = null;
    let back: HTMLCanvasElement | null = null;
    let raf = 0;
    let gone = false;
    const start = performance.now();
    // 0 full, 1 simple, 2 simple at a lower density and about 30 frames a second.
    let level = simple ? 1 : 0;
    let slowSwitches = 0;
    let last = 0, windowAt = 0, windowFrames = 0, windowSlow = 0, fpsFrames = 0, fpsAt = start, fps = 0;
    if (new URLSearchParams(window.location.search).has('debug')) {
      (window as unknown as { __archeryHomeStats?: () => unknown }).__archeryHomeStats = () => ({ fps, level, slowSwitches, ratio: L?.ratio ?? 0 });
    }
    const fig: Figure = { kind: 'hero', dir: 1, aim: 14, draw: 0, hasArrow: true, arrowLook: 'arrow', hitT: 0, squash: 0, stringWob: 0, blinkFor: 0, dizzy: 0, koT: -1, cheer: 0, bow };

    function build() {
      const r = canvas!.getBoundingClientRect();
      const d = window.devicePixelRatio || 1;
      const ratio = level === 0 ? Math.min(1.5, d) : level === 1 ? Math.min(1, d) : Math.min(1, d) * 0.75;
      const cw = Math.max(1, r.width), ch = Math.max(1, r.height);
      canvas!.width = Math.round(cw * ratio);
      canvas!.height = Math.round(ch * ratio);
      L = homeLayout(cw, ch, ratio);
      back = document.createElement('canvas');
      back.width = canvas!.width;
      back.height = canvas!.height;
      const bg = back.getContext('2d');
      if (!bg) return;
      bg.setTransform(ratio, 0, 0, ratio, 0, 0);
      makeSky(L, pal)(bg);
      const far = paintFar(L, pal, world);
      const mid = paintMid(L, pal, world);
      bg.drawImage(far, -PAD_X, -PAD_TOP, far.width / ratio, far.height / ratio);
      bg.drawImage(mid, -PAD_X, -PAD_TOP, mid.width / ratio, mid.height / ratio);
    }

    /** Counts slow frames (after the first second): most of 60 slow steps the graphics down, as the fight does. */
    function measure(now: number) {
      const interval = last ? now - last : 16;
      last = now;
      fpsFrames++;
      if (now - fpsAt >= 1000) {
        fps = Math.round((fpsFrames * 1000) / (now - fpsAt));
        fpsFrames = 0;
        fpsAt = now;
      }
      if (now - start < 1000 || document.hidden) return;
      if (!windowFrames) windowAt = now;
      windowFrames++;
      if (interval > (level === 2 ? 70 : 40)) windowSlow++;
      if (windowFrames >= 60 || (windowFrames >= 8 && now - windowAt >= 2000)) {
        if (windowSlow > windowFrames * 0.6 && level < 2) {
          level++;
          slowSwitches++;
          build();
        }
        windowFrames = 0;
        windowSlow = 0;
      }
    }

    function frame(now: number) {
      if (gone || !L || !back) return;
      if (!lessMotion) {
        // At the lowest step, every other frame is skipped (about 30 a second).
        if (level === 2 && last && now - last < 28) {
          raf = requestAnimationFrame(frame);
          return;
        }
        measure(now);
      }
      const t = lessMotion ? 1.6 : (now - start) / 1000;
      const c = t % CYCLE;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(back, 0, 0);
      // The foreground, in units that grow with the screen (the archer about a quarter of its height).
      const u = clamp(Math.min(L.cw / 960, L.ch / 540) * 1.15, 0.45, 1.8);
      ctx.setTransform(L.ratio * u, 0, 0, L.ratio * u, L.ratio * L.cw * HERO_AT.x, L.ratio * L.ch * HERO_AT.y);
      const TARGET = { x: (L.cw * (TARGET_X - HERO_AT.x)) / u, y: 18 };
      drawRock(ctx, pal.surf, pal.soil[1] ?? '#4a3832');
      // The shot: draw (0–1.4 s), hold, loose at 1.9 s, fly to the target by 2.45 s, stay in it until the cycle ends.
      const flying = c >= 1.9 && c < 2.45;
      const stuck = c >= 2.45;
      fig.draw = c < 1.4 ? ease(c / 1.4) : c < 1.9 ? 1 : 0;
      fig.hasArrow = !flying && !stuck;
      fig.stringWob = c >= 1.9 && c < 2.4 ? 1 - (c - 1.9) / 0.5 : 0;
      fig.cheer = stuck && c > 2.7 ? 1 : 0;
      const hit = stuck ? Math.max(0, 1 - (c - 2.45) * 4) : 0;
      drawTarget(ctx, TARGET, Math.sin((c - 2.45) * 30) * hit);
      ctx.save();
      ctx.translate(HERO.x, HERO.y);
      drawFigure(ctx, fig, t, K, false, 0);
      ctx.restore();
      if (flying || stuck) {
        // From the hands to the bull's eye, in a gentle arc.
        const k = flying ? (c - 1.9) / 0.55 : 1;
        const hx = HERO.x + 40, hy = HERO.y - 55;
        const tx = TARGET.x - 6, ty = TARGET.y - 40;
        const x = lerp(hx, tx, k);
        const y = lerp(hy, ty, k) - Math.sin(k * Math.PI) * 60;
        const dx = tx - hx, dy = ty - hy - Math.cos(k * Math.PI) * 60 * Math.PI;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.atan2(dy, dx));
        ctx.scale(0.5, 0.5);
        arrowShape(ctx, -62, 'arrow');
        ctx.restore();
        if (flying) {
          ctx.strokeStyle = 'rgba(255,255,255,.6)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const k0 = clamp(k - 0.25, 0, 1);
          ctx.moveTo(lerp(hx, tx, k0), lerp(hy, ty, k0) - Math.sin(k0 * Math.PI) * 60);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
      if (!lessMotion) raf = requestAnimationFrame(frame);
    }

    build();
    raf = requestAnimationFrame(frame);
    const onResize = () => {
      build();
      if (lessMotion) raf = requestAnimationFrame(frame);
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize);
    observer?.observe(canvas);
    return () => {
      gone = true;
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [world, bow, lessMotion, simple]);
  return <canvas ref={ref} className="ar-home__scene" aria-hidden="true" />;
}
