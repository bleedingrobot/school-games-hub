/**
 * The worlds' backgrounds: sky, far and middle layers (pre-rendered once per world and screen size, then
 * drawn as images that shift a little with the camera), clouds, the tumbleweed, and the overlay that
 * darkens the corners and hazes the scenery beyond the field's sides.
 *
 * Coordinates: the layers are painted in CSS px of the canvas, with the mock-up's 1600 × 900 units
 * mapped onto the field (U = CSS px per mock-up unit).
 */
import type { WorldId } from '../../../../shared/archery/types';
import type { Layout } from './layout';
import { TAU, ctx2d, lerp, mk, rng, rr } from './util';
import type { Palette } from './worlds';

/** Extra room around the parallax layers, in CSS px, so shifting them never shows an edge. */
export const PAD_X = 50;
export const PAD_TOP = 40;
export const PAD_BOTTOM = 40;

interface Frame {
  g: CanvasRenderingContext2D;
  /** Mock-up unit → CSS px. */
  U: number;
  /** A mock-up y (0–900 down the field) → CSS px in this layer. */
  Y: (y: number) => number;
  /** The layer's width and height in CSS px. */
  W: number;
  H: number;
  /** Where the field's left and right edges are in this layer. */
  fx0: number;
  fx1: number;
}

function layer(L: Layout): { c: HTMLCanvasElement; f: Frame } {
  const W = L.cw + PAD_X * 2;
  const H = L.ch + PAD_TOP + PAD_BOTTOM;
  const c = mk(W * L.ratio, H * L.ratio);
  const g = ctx2d(c);
  g.scale(L.ratio, L.ratio);
  const U = (L.s * 960) / 1600;
  const Y = (y: number) => PAD_TOP + L.oy + y * U;
  return { c, f: { g, U, Y, W, H, fx0: PAD_X + L.ox, fx1: PAD_X + L.ox + 960 * L.s } };
}

// ——— Sky ———

/**
 * The sky, drawn live each frame from ready-made gradients (cheaper on memory than a full-screen
 * image). Returns a painter for a context already scaled to CSS px.
 */
export function makeSky(L: Layout, w: Palette): (g: CanvasRenderingContext2D) => void {
  const probe = ctx2d(mk(1, 1));
  const horizon = L.oy + 540 * L.s * 0.8;
  const gr = probe.createLinearGradient(0, 0, 0, Math.max(40, horizon));
  gr.addColorStop(0, w.sky[0]);
  gr.addColorStop(0.55, w.sky[1]);
  gr.addColorStop(1, w.sky[2]);
  let glow: CanvasGradient | null = null;
  let moon: HTMLCanvasElement | null = null;
  let mx = 0, my = 0, mr = 0;
  if (w.sun) {
    const s = w.sun;
    const x = L.ox + s.x * 960 * L.s, y = L.oy + s.y * 540 * L.s, r = s.r * L.s;
    glow = probe.createRadialGradient(x, y, r * 0.5, x, y, r * 6);
    glow.addColorStop(0, s.glow);
    glow.addColorStop(1, 'rgba(255,255,255,0)');
  }
  if (w.moon) {
    const m = w.moon;
    mx = L.ox + m.x * 960 * L.s;
    my = L.oy + m.y * 540 * L.s;
    mr = m.r * L.s;
    glow = probe.createRadialGradient(mx, my, mr, mx, my, mr * 5);
    glow.addColorStop(0, 'rgba(255,230,200,.35)');
    glow.addColorStop(1, 'rgba(255,230,200,0)');
    moon = mk(mr * 3 * L.ratio, mr * 3 * L.ratio);
    const tg = ctx2d(moon);
    tg.scale(L.ratio, L.ratio);
    tg.translate(mr * 1.5, mr * 1.5);
    tg.beginPath();
    tg.arc(0, 0, mr, 0, TAU);
    tg.fillStyle = '#fff1d2';
    tg.fill();
    tg.fillStyle = '#f0dcb4';
    for (const [cx, cy, cr] of [[-0.33, -0.22, 0.17], [0.22, 0.28, 0.22], [-0.11, 0.44, 0.11]]) {
      tg.beginPath();
      tg.arc(cx * mr, cy * mr, cr * mr, 0, TAU);
      tg.fill();
    }
    tg.globalCompositeOperation = 'destination-out';
    tg.beginPath();
    tg.arc(mr * 0.55, -mr * 0.3, mr * 0.92, 0, TAU);
    tg.fill();
  }
  return (g) => {
    g.fillStyle = gr;
    g.fillRect(0, 0, L.cw, L.ch);
    if (glow) {
      g.fillStyle = glow;
      g.fillRect(0, 0, L.cw, L.ch);
    }
    if (moon) g.drawImage(moon, mx - mr * 1.5, my - mr * 1.5, mr * 3, mr * 3);
  };
}

// ——— Painting helpers (from the mock-up) ———

function peaks(f: Frame, r: () => number, o: { y0: number; amp: number; step: number; top: string; bot: string; snow: string | null; shade: number }) {
  const { g, U, Y, W, H } = f;
  const pts: [number, number, boolean][] = [];
  let x = -40;
  let up = true;
  while (x < W + 80) {
    const y = up ? o.y0 - o.amp * (0.55 + 0.45 * r()) : o.y0 - o.amp * (0.05 + 0.22 * r());
    pts.push([x, Y(y), up]);
    x += o.step * U * (0.6 + 0.7 * r());
    up = !up;
  }
  const path = new Path2D();
  path.moveTo(-40, H);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], n = pts[i + 1];
    if (!n) {
      path.lineTo(p[0], p[1]);
      break;
    }
    if (i === 0) path.lineTo(p[0], p[1]);
    // Straight, sharp ridges with a slight bend: rocky mountains.
    const mx = (p[0] + n[0]) / 2 + (r() - 0.5) * 8 * U, my = (p[1] + n[1]) / 2 + (r() - 0.3) * 14 * U;
    path.lineTo(mx, my);
    path.lineTo(n[0], n[1]);
  }
  path.lineTo(W + 80, H);
  path.closePath();
  const gr = g.createLinearGradient(0, Y(o.y0 - o.amp), 0, Y(o.y0 + 140));
  gr.addColorStop(0, o.top);
  gr.addColorStop(1, o.bot);
  g.fillStyle = gr;
  g.fill(path);
  g.save();
  g.clip(path);
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], n = pts[i + 1];
    if (!p[2]) continue;
    g.fillStyle = `rgba(25,35,70,${o.shade})`;
    g.beginPath();
    g.moveTo(p[0], p[1]);
    g.lineTo(n[0], n[1]);
    g.lineTo(n[0] + (n[0] - p[0]) * 0.3, H);
    g.lineTo(p[0] + (n[0] - p[0]) * 0.12, H);
    g.closePath();
    g.fill();
    if (o.snow && p[1] < Y(o.y0 - o.amp * 0.62)) {
      const Lp = pts[i - 1], fr = 0.34;
      const a = [lerp(p[0], Lp[0], fr), lerp(p[1], Lp[1], fr)], b = [lerp(p[0], n[0], fr), lerp(p[1], n[1], fr)];
      g.beginPath();
      g.moveTo(p[0], p[1] - 4 * U);
      g.lineTo(b[0], b[1]);
      for (let k = 1; k < 4; k++) g.lineTo(lerp(b[0], a[0], k / 4), lerp(b[1], a[1], k / 4) + (k % 2 ? 12 : -1) * U);
      g.lineTo(a[0], a[1]);
      g.closePath();
      g.fillStyle = o.snow;
      g.fill();
      g.fillStyle = 'rgba(120,150,200,.25)';
      g.beginPath();
      g.moveTo(p[0], p[1] - 4 * U);
      g.lineTo(b[0], b[1]);
      g.lineTo(lerp(b[0], a[0], 0.3), lerp(b[1], a[1], 0.3) + 10 * U);
      g.closePath();
      g.fill();
    }
  }
  g.restore();
}

function hills(f: Frame, o: { y0: number; a1: number; l1: number; p1: number; a2: number; l2: number; p2: number; top: string; bot: string; rim: string | null }) {
  const { g, U, Y, W, H } = f;
  const fy = (x: number) => Y(o.y0 + o.a1 * Math.sin(x / U / o.l1 + o.p1) + o.a2 * Math.sin(x / U / o.l2 + o.p2));
  const path = new Path2D();
  path.moveTo(-10, H);
  for (let x = -10; x <= W + 10; x += 6) path.lineTo(x, fy(x));
  path.lineTo(W + 10, H);
  path.closePath();
  const gr = g.createLinearGradient(0, Y(o.y0 - o.a1 - o.a2), 0, Y(o.y0 + 220));
  gr.addColorStop(0, o.top);
  gr.addColorStop(1, o.bot);
  g.fillStyle = gr;
  g.fill(path);
  if (o.rim) {
    g.save();
    g.clip(path);
    g.beginPath();
    for (let x = -10; x <= W + 10; x += 6) g.lineTo(x, fy(x) + 3 * U);
    g.strokeStyle = o.rim;
    g.lineWidth = 7 * U;
    g.globalAlpha = 0.55;
    g.stroke();
    g.restore();
  }
  return fy;
}

function pine(g: CanvasRenderingContext2D, x: number, y: number, s: number, c1: string, c2: string, snow: string | null) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = '#5b3b24';
  g.fillRect(-4, -16, 8, 18);
  for (const [by, hw, ht] of [[-12, 34, 42], [-38, 28, 38], [-62, 20, 34]]) {
    g.beginPath();
    g.moveTo(-hw, by);
    g.quadraticCurveTo(0, by + 7, hw, by);
    g.lineTo(0, by - ht);
    g.closePath();
    g.fillStyle = c1;
    g.fill();
    g.beginPath();
    g.moveTo(-hw, by);
    g.quadraticCurveTo(-hw * 0.5, by + 5, 0, by + 6);
    g.lineTo(0, by - ht);
    g.closePath();
    g.fillStyle = c2;
    g.fill();
    if (snow) {
      g.beginPath();
      g.moveTo(-hw * 0.5, by - ht * 0.5);
      g.lineTo(0, by - ht);
      g.lineTo(hw * 0.5, by - ht * 0.5);
      g.quadraticCurveTo(hw * 0.25, by - ht * 0.38, 0, by - ht * 0.48);
      g.quadraticCurveTo(-hw * 0.25, by - ht * 0.38, -hw * 0.5, by - ht * 0.5);
      g.fillStyle = snow;
      g.fill();
    }
  }
  g.restore();
}

function roundTree(g: CanvasRenderingContext2D, x: number, y: number, s: number, c1: string, c2: string) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = '#6b4428';
  g.fillRect(-4, -32, 8, 34);
  const blobs = [[0, -54, 26], [-19, -40, 18], [19, -41, 19], [2, -74, 18]];
  g.fillStyle = c1;
  for (const [bx, by, r] of blobs) {
    g.beginPath();
    g.arc(bx, by, r, 0, TAU);
    g.fill();
  }
  g.fillStyle = c2;
  for (const [bx, by, r] of blobs) {
    g.beginPath();
    g.arc(bx - r * 0.25, by - r * 0.28, r * 0.6, 0, TAU);
    g.fill();
  }
  g.restore();
}

function cactus(g: CanvasRenderingContext2D, x: number, y: number, s: number, c1: string, c2: string) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = c1;
  g.lineWidth = 17;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, -64);
  g.stroke();
  g.lineWidth = 11;
  g.beginPath();
  g.moveTo(0, -28);
  g.lineTo(-17, -28);
  g.lineTo(-17, -48);
  g.stroke();
  g.beginPath();
  g.moveTo(0, -38);
  g.lineTo(16, -38);
  g.lineTo(16, -56);
  g.stroke();
  g.strokeStyle = c2;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(-3, -4);
  g.lineTo(-3, -62);
  g.moveTo(-19, -31);
  g.lineTo(-19, -47);
  g.moveTo(14, -41);
  g.lineTo(14, -55);
  g.stroke();
  g.restore();
}

interface SkylineOpts { base: number; wMin: number; wMax: number; hMin: number; hMax: number; c: string; c2?: string; win: string; lit: number; wx: number; wy: number; ww: number; wh: number; detail?: boolean }

function skyline(f: Frame, r: () => number, o: SkylineOpts) {
  const { g, U, Y, W, H } = f;
  let x = -20;
  while (x < W + 20) {
    const bw = (o.wMin + r() * (o.wMax - o.wMin)) * U, bh = o.hMin + r() * (o.hMax - o.hMin);
    const top = Y(o.base - bh);
    g.fillStyle = o.c;
    g.fillRect(x, top, bw, H - top);
    if (o.c2) {
      g.fillStyle = o.c2;
      g.fillRect(x, top, Math.max(3, bw * 0.16), H - top);
    }
    if (r() < 0.35) {
      g.fillStyle = o.c;
      g.fillRect(x + bw * 0.25, top - 16 * U, bw * 0.35, 16 * U);
    }
    if (r() < 0.3) {
      g.strokeStyle = o.c;
      g.lineWidth = 3 * U;
      g.beginPath();
      g.moveTo(x + bw * 0.72, top);
      g.lineTo(x + bw * 0.72, top - 36 * U);
      g.stroke();
    }
    if (o.detail && r() < 0.22) {
      const tx = x + bw * 0.45;
      g.strokeStyle = o.c;
      g.lineWidth = 3 * U;
      g.beginPath();
      g.moveTo(tx + 3 * U, top);
      g.lineTo(tx + 3 * U, top - 18 * U);
      g.moveTo(tx + 23 * U, top);
      g.lineTo(tx + 23 * U, top - 18 * U);
      g.stroke();
      g.fillStyle = o.c;
      rr(g, tx, top - 42 * U, 26 * U, 26 * U, 5 * U);
      g.fill();
      g.beginPath();
      g.moveTo(tx - 2 * U, top - 42 * U);
      g.lineTo(tx + 13 * U, top - 54 * U);
      g.lineTo(tx + 28 * U, top - 42 * U);
      g.fill();
    }
    const cols = Math.floor((bw - 12 * U) / (o.wx * U));
    for (let wy = top + 14 * U; wy < Y(o.base) - 10 * U; wy += o.wy * U) {
      for (let i = 0; i < cols; i++) {
        if (r() < o.lit) {
          g.fillStyle = o.win;
          g.globalAlpha = 0.45 + r() * 0.55;
          g.fillRect(x + 8 * U + i * o.wx * U, wy, o.ww * U, o.wh * U);
          g.globalAlpha = 1;
        }
      }
    }
    x += bw + (r() < 0.3 ? r() * 24 * U : 0);
  }
}

function mesa(f: Frame, x: number, wd: number, ht: number, base: number, c1: string, c2: string) {
  const { g, U, Y, H } = f;
  const top = Y(base - ht), b = Y(base);
  const p = new Path2D();
  p.moveTo(x, H);
  p.lineTo(x + 10 * U, top + 30 * U);
  p.lineTo(x + 22 * U, top + 4 * U);
  p.quadraticCurveTo(x + 26 * U, top, x + 34 * U, top);
  p.lineTo(x + wd - 36 * U, top);
  p.quadraticCurveTo(x + wd - 26 * U, top, x + wd - 20 * U, top + 8 * U);
  p.lineTo(x + wd - 8 * U, top + 36 * U);
  p.lineTo(x + wd, H);
  p.closePath();
  const gr = g.createLinearGradient(0, top, 0, b + 60 * U);
  gr.addColorStop(0, c1);
  gr.addColorStop(1, c2);
  g.fillStyle = gr;
  g.fill(p);
  g.save();
  g.clip(p);
  g.fillStyle = 'rgba(120,50,20,.13)';
  const hpx = b - top;
  for (let k = 0.22; k < 1; k += 0.2) g.fillRect(x, top + hpx * k, wd, hpx * 0.07);
  g.fillStyle = 'rgba(255,240,220,.25)';
  g.fillRect(x, top, wd, 4 * U);
  g.fillStyle = 'rgba(90,30,10,.16)';
  g.beginPath();
  g.moveTo(x + wd * 0.68, top);
  g.lineTo(x + wd, top);
  g.lineTo(x + wd, H);
  g.lineTo(x + wd * 0.6, H);
  g.closePath();
  g.fill();
  g.restore();
}

function haze(f: Frame, w: Palette, from: number, to: number, alpha: number) {
  const { g, Y, W, H } = f;
  g.save();
  g.globalCompositeOperation = 'source-atop';
  const hz = g.createLinearGradient(0, Y(from), 0, Y(to));
  hz.addColorStop(0, 'rgba(255,255,255,0)');
  hz.addColorStop(1, w.haze);
  g.globalAlpha = alpha;
  g.fillStyle = hz;
  g.fillRect(0, 0, W, H);
  g.restore();
}

// ——— The far and middle layers ———

export function paintFar(L: Layout, w: Palette, world: WorldId): HTMLCanvasElement {
  const { c, f } = layer(L);
  const r = rng(w.seed);
  if (world === 'forest' || world === 'snow') {
    peaks(f, r, { y0: 470, amp: 300, step: 150, top: w.farBack[0], bot: w.farBack[1], snow: w.snowcap, shade: 0.08 });
    peaks(f, r, { y0: 545, amp: 220, step: 120, top: w.farFront[0], bot: w.farFront[1], snow: world === 'snow' ? '#ffffff' : null, shade: 0.12 });
  } else if (world === 'desert') {
    hills(f, { y0: 560, a1: 16, l1: 170, p1: 1, a2: 8, l2: 60, p2: 2, top: w.farBack[0], bot: w.farBack[1], rim: null });
    let x = 20 * f.U;
    while (x < f.W) {
      const wd = (150 + r() * 170) * f.U, ht = 160 + r() * 150;
      mesa(f, x, wd, ht, 600, w.farFront[1], w.farFront[0]);
      x += wd + (120 + r() * 220) * f.U;
    }
  } else {
    skyline(f, r, { base: 600, wMin: 50, wMax: 110, hMin: 200, hMax: 420, c: w.farBack[0], win: '#ffd9a0', lit: 0.18, wx: 12, wy: 16, ww: 5, wh: 7 });
    skyline(f, r, { base: 640, wMin: 60, wMax: 120, hMin: 140, hMax: 320, c: w.farFront[0], win: '#ffd9a0', lit: 0.25, wx: 12, wy: 16, ww: 5, wh: 7 });
  }
  haze(f, w, 360, 700, 0.6);
  return c;
}

export function paintMid(L: Layout, w: Palette, world: WorldId): HTMLCanvasElement {
  const { c, f } = layer(L);
  const r = rng(w.seed + 7);
  if (world === 'city') {
    skyline(f, r, { base: 690, wMin: 70, wMax: 150, hMin: 90, hMax: 260, c: w.hill[0], c2: w.hill[1], win: '#ffd98a', lit: 0.42, detail: true, wx: 18, wy: 22, ww: 8, wh: 10 });
  } else {
    const fy = hills(f, {
      y0: world === 'desert' ? 620 : 610, a1: 28, l1: 210, p1: r() * 6, a2: 14, l2: 90, p2: r() * 6,
      top: w.hill[1], bot: w.hill[0], rim: world === 'snow' ? '#ffffff' : 'rgba(255,255,255,.5)',
    });
    let x = -20;
    while (x < f.W + 20) {
      x += (world === 'desert' ? 120 + r() * 160 : 34 + r() * 70) * f.U;
      const y = fy(x) + 6 * f.U, sc = (0.75 + r() * 0.5) * f.U;
      if (world === 'forest') {
        if (r() < 0.55) pine(f.g, x, y, sc, w.treeA, w.treeB, null);
        else roundTree(f.g, x, y, sc, w.treeA, w.treeB);
      } else if (world === 'snow') pine(f.g, x, y, sc, w.treeA, w.treeB, '#ffffff');
      else cactus(f.g, x, y, sc, w.treeA, w.treeB);
    }
  }
  haze(f, w, 460, 820, 0.3);
  return c;
}

/** The corners' soft darkening, plus a haze over the scenery beyond the field's sides (the land ends there). Drawn live. */
export function makeOverlay(L: Layout, w: Palette): (g: CanvasRenderingContext2D) => void {
  const probe = ctx2d(mk(1, 1));
  const cx = L.cw / 2, cy = L.ch * 0.45;
  const rg = probe.createRadialGradient(cx, cy, Math.min(L.cw, L.ch) * 0.45, cx, cy, Math.hypot(L.cw, L.ch) * 0.62);
  rg.addColorStop(0, 'rgba(0,0,0,0)');
  rg.addColorStop(1, w.moon ? 'rgba(15,0,35,.34)' : 'rgba(40,25,10,.2)');
  const x0 = L.ox, x1 = L.ox + 960 * L.s;
  const sides: [CanvasGradient, number, number][] = [];
  for (const [from, to] of [[x0, 0], [x1, L.cw]]) {
    if (Math.abs(to - from) < 1) continue;
    const lg = probe.createLinearGradient(from, 0, to, 0);
    lg.addColorStop(0, w.moon ? 'rgba(20,10,40,.28)' : 'rgba(30,40,60,.16)');
    lg.addColorStop(1, w.moon ? 'rgba(20,10,40,.4)' : 'rgba(30,40,60,.3)');
    sides.push([lg, Math.min(from, to), Math.abs(to - from)]);
  }
  return (g) => {
    for (const [lg, x, wd] of sides) {
      g.fillStyle = lg;
      g.fillRect(x, 0, wd, L.ch);
    }
    g.fillStyle = rg;
    g.fillRect(0, 0, L.cw, L.ch);
  };
}

// ——— Sprites ———

export interface Sprite { c: HTMLCanvasElement; w: number; h: number }

/** A fluffy cloud, `w` CSS px wide. */
export function cloudSprite(ratio: number, seed: number, c1: string, c2: string, w: number): Sprite {
  const r = rng(seed), h = w * 0.56;
  const c = mk(w * ratio, h * ratio), g = ctx2d(c);
  g.scale(ratio, ratio);
  const n = 5 + Math.floor(r() * 3);
  const puffs: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const pr = h * (0.2 + 0.17 * r()) * (1 - Math.abs(t - 0.5) * 0.9);
    puffs.push([w * 0.14 + w * 0.72 * t, h * 0.6 - pr * 0.55 - r() * h * 0.07, pr]);
  }
  const base = h * 0.74;
  g.fillStyle = c2;
  for (const p of puffs) {
    g.beginPath();
    g.arc(p[0], p[1], p[2], 0, TAU);
    g.fill();
  }
  rr(g, w * 0.1, base - h * 0.22, w * 0.8, h * 0.22, h * 0.11);
  g.fill();
  g.save();
  g.beginPath();
  g.rect(0, 0, w, base - h * 0.08);
  g.clip();
  g.fillStyle = c1;
  for (const p of puffs) {
    g.beginPath();
    g.arc(p[0], p[1] - 2, p[2] * 0.96, 0, TAU);
    g.fill();
  }
  g.fillRect(w * 0.13, base - h * 0.25, w * 0.74, h * 0.1);
  g.restore();
  g.fillStyle = 'rgba(255,255,255,.55)';
  for (const p of puffs) {
    g.beginPath();
    g.arc(p[0] - p[2] * 0.28, p[1] - p[2] * 0.35, p[2] * 0.42, 0, TAU);
    g.fill();
  }
  return { c, w, h };
}

/** A tumbleweed of radius R CSS px. */
export function tumbleSprite(ratio: number, R: number): Sprite {
  const size = R * 2.4;
  const c = mk(size * ratio, size * ratio), g = ctx2d(c);
  g.scale(ratio, ratio);
  g.translate(size / 2, size / 2);
  const r = rng(5);
  g.strokeStyle = '#8a5b2a';
  g.lineWidth = Math.max(1, R * 0.09);
  for (let i = 0; i < 16; i++) {
    g.beginPath();
    g.arc((r() - 0.5) * R * 0.8, (r() - 0.5) * R * 0.8, R * (0.35 + r() * 0.5), r() * TAU, r() * TAU + 2);
    g.stroke();
  }
  g.strokeStyle = '#c9965a';
  g.lineWidth = Math.max(0.8, R * 0.06);
  for (let i = 0; i < 8; i++) {
    g.beginPath();
    g.arc((r() - 0.5) * R * 0.6, (r() - 0.5) * R * 0.6, R * (0.3 + r() * 0.5), r() * TAU, r() * TAU + 2);
    g.stroke();
  }
  return { c, w: size, h: size };
}
