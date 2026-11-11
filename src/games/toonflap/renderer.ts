/**
 * Toon Flap's canvas drawing, with DRAWN STAND-IN art (docs/TOON-FLAP-ART-PLAN.md). One look per level, the 12 flyers and the
 * 7 trails. Painted art (art/art.ts) is used instead when a picture is given and has loaded. This file only draws: Math.sin
 * is fine here because nothing in it touches the physics.
 *
 * Units: the course is in "units" (shared/toonflap/config.ts). The sky is SKY units tall; a thin ceiling and a ground strip
 * are drawn either side of it, so a bird touching 0 or SKY touches what the pupil sees.
 */
import { BIRD_HALF, BIRD_SIZE, SKY, START_X, START_Y, WALL_WIDTH } from '../../../shared/toonflap/config';
import { gapsAt, zoneOn, type RunState } from '../../../shared/toonflap/engine';
import type { Course, Wall, Zone } from '../../../shared/toonflap/levels';
import { flyerArt, trailArt, worldArt, type FlyerPose, type WorldLayer } from './art/art';

const TAU = Math.PI * 2;
export const TOP_PAD = 0.25;
export const GROUND = 0.5;
const VIEW_H = SKY + TOP_PAD + GROUND;
/** The bird sits this far across the screen. */
export const BIRD_AT = 0.28;
/** The flyer is drawn a little bigger than its hit box so small children can see it (the hit box is still BIRD_SIZE). */
export const BIRD_LOOK = 1.4;
/** At least this many units show ahead of the bird, even on a narrow phone. */
const MIN_AHEAD = 7.5;

type Ctx = CanvasRenderingContext2D;

export interface View {
  w: number;
  h: number;
  /** Pixels a unit. */
  s: number;
  camX: number;
  offY: number;
}

export interface TrailParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  k: number;
}

export interface SceneOpts {
  course: Course;
  state: RunState;
  w: number;
  h: number;
  /** Seconds, for animation. */
  time: number;
  reduced: boolean;
  /** Screen shake in pixels. */
  shake: number;
  flyer: string;
  shiny: boolean;
  trail: string | null;
  particles: TrailParticle[];
  pose: FlyerPose;
  /** Labels for each answer wall (bottom to top), or null for arrows (maths off). */
  labels: Array<number[]> | null;
  ghostPath: boolean;
}

export function makeView(state: RunState, w: number, h: number): View {
  const s = Math.min(h / VIEW_H, (w * (1 - BIRD_AT)) / MIN_AHEAD);
  return { w, h, s, camX: state.x - (BIRD_AT * w) / s, offY: (h - s * VIEW_H) / 2 };
}

const sx = (v: View, x: number) => (x - v.camX) * v.s;
const sy = (v: View, y: number) => v.offY + (SKY + TOP_PAD - y) * v.s;

/* ---------- small helpers ---------- */

const rnd = (i: number, k: number): number => {
  const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const q = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  c.beginPath();
  c.moveTo(x + q, y);
  c.arcTo(x + w, y, x + w, y + h, q);
  c.arcTo(x + w, y + h, x, y + h, q);
  c.arcTo(x, y + h, x, y, q);
  c.arcTo(x, y, x + w, y, q);
  c.closePath();
}
function circ(c: Ctx, x: number, y: number, r: number) {
  c.beginPath();
  c.arc(x, y, Math.max(0, r), 0, TAU);
}
function ell(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  c.beginPath();
  c.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, TAU);
}
function paint(c: Ctx, fill: string | null, stroke: string | null = null, lw = 1) {
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.lineWidth = lw;
    c.strokeStyle = stroke;
    c.lineJoin = 'round';
    c.stroke();
  }
}
function poly(c: Ctx, pts: number[]) {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
}
function star(c: Ctx, x: number, y: number, r: number, points = 4, inner = 0.4) {
  c.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * inner;
    const a = (i * Math.PI) / points - Math.PI / 2;
    if (i === 0) c.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    else c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  c.closePath();
}

/* ---------- painted pictures (art/art.ts), when there are any ---------- */

const images = new Map<string, HTMLImageElement | null>();
function picture(url: string | undefined): HTMLImageElement | null {
  if (!url || typeof Image === 'undefined') return null;
  let img = images.get(url);
  if (img === undefined) {
    img = new Image();
    img.src = url;
    images.set(url, img);
  }
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

/* ---------- the worlds ---------- */

interface World {
  skyTop: string;
  skyBot: string;
  ink: string;
  ground: string;
  groundTop: string;
}

const WORLDS: World[] = [
  { skyTop: '#A9D8F0', skyBot: '#E6F3F7', ink: '#4f6d85', ground: '#9CCB6B', groundTop: '#7fb04f' },
  { skyTop: '#F7E3A1', skyBot: '#F2B97E', ink: '#5e2410', ground: '#E5B458', groundTop: '#c98f33' },
  { skyTop: '#2E9BD6', skyBot: '#8fdcec', ink: '#2a1445', ground: '#F2D16B', groundTop: '#d9b24a' },
  { skyTop: '#EFE2C2', skyBot: '#E4D3A8', ink: '#4a2a14', ground: '#f3ead0', groundTop: '#2b2b2b' },
  { skyTop: '#6FB8E8', skyBot: '#FBE48A', ink: '#1a1a1a', ground: '#6FBF4A', groundTop: '#8C8C8C' },
  { skyTop: '#2B2A5C', skyBot: '#4F8C8B', ink: '#0c0b1f', ground: '#1e1b3f', groundTop: '#7FB069' },
  { skyTop: '#8FC3E8', skyBot: '#E3F0F8', ink: '#4a5d72', ground: '#F4F6F8', groundTop: '#c9d4de' },
  { skyTop: '#F7C77A', skyBot: '#FBE7C0', ink: '#1e1818', ground: '#3B3434', groundTop: '#F26B1D' },
  { skyTop: '#141E4A', skyBot: '#432a78', ink: '#02030c', ground: '#0c1030', groundTop: '#3EE0FF' },
  { skyTop: '#1D2340', skyBot: '#3b3f78', ink: '#0a0d20', ground: '#4d4780', groundTop: '#C3B1E1' },
];

/** Everything a layer function needs. */
interface P {
  c: Ctx;
  v: View;
  n: number;
  time: number;
  reduced: boolean;
}

/** Repeats `fn` along a layer that scrolls at `factor` of the speed. */
function layer(p: P, factor: number, tileUnits: number, fn: (i: number, x0: number, tile: number) => void) {
  const tile = tileUnits * p.v.s;
  const off = p.reduced ? 0 : p.v.camX * p.v.s * factor;
  for (let i = Math.floor(off / tile) - 1; i * tile - off < p.v.w; i++) fn(i, i * tile - off, tile);
}

/** A rolling silhouette along the layer, filled down to the ground. */
function ridge(p: P, factor: number, color: string, base: number, amp: number, wave: number, kind: 'round' | 'jag' = 'round', snow?: string) {
  const { c, v } = p;
  const off = p.reduced ? 0 : v.camX * v.s * factor;
  const lam = wave * v.s;
  const yAt = (px: number) => {
    const a = (px + off) / lam;
    if (kind === 'round') return sy(v, base + amp * (Math.sin(a) + 0.5 * Math.sin(a * 2.3 + 1) + 0.5));
    const f = a - Math.floor(a);
    const tri = f < 0.5 ? f * 2 : 2 - f * 2;
    return sy(v, base + amp * (tri + 0.35 * Math.sin(a * 5.1)) * (0.6 + 0.4 * Math.sin(a * 0.37 + 2)));
  };
  c.beginPath();
  c.moveTo(0, v.h);
  for (let px = 0; px <= v.w + 8; px += 8) c.lineTo(px, yAt(px));
  c.lineTo(v.w + 8, v.h);
  c.closePath();
  c.fillStyle = color;
  c.fill();
  if (snow) {
    c.fillStyle = snow;
    for (let px = 0; px <= v.w; px += 8) {
      const y = yAt(px);
      if (y < sy(v, base + amp * 1.1)) c.fillRect(px, y, 9, Math.max(2, v.s * 0.28));
    }
  }
}

function clouds(p: P, factor: number, color: string, alpha = 0.8) {
  const { c, v } = p;
  layer(p, factor, 7, (i, x0, tile) => {
    const x = x0 + rnd(i, 1) * tile * 0.7;
    const y = sy(v, 7.6 + rnd(i, 2) * 1.6);
    const r = v.s * (0.45 + rnd(i, 3) * 0.3);
    c.globalAlpha = alpha;
    c.fillStyle = color;
    for (const [dx, dy, k] of [[0, 0, 1], [0.9, 0.15, 0.8], [-0.9, 0.2, 0.75], [0.35, -0.3, 0.8]]) {
      circ(c, x + dx * r, y + dy * r, r * k);
      c.fill();
    }
    c.globalAlpha = 1;
  });
}

function stars(p: P, factor: number, count: number, color = '#fff') {
  const { c, v } = p;
  layer(p, factor, 12, (i, x0, tile) => {
    for (let k = 0; k < count; k++) {
      const x = x0 + rnd(i, 10 + k) * tile;
      const y = sy(v, 0.8 + rnd(i, 40 + k) * 9);
      const tw = p.reduced ? 1 : 0.6 + 0.4 * Math.sin(p.time * 2 + k * 3 + i);
      c.globalAlpha = tw;
      c.fillStyle = color;
      c.fillRect(x, y, Math.max(1.5, v.s * 0.07), Math.max(1.5, v.s * 0.07));
    }
    c.globalAlpha = 1;
  });
}

function windows(c: Ctx, x: number, y: number, w: number, h: number, cols: number, rows: number, color: string, i: number, density = 0.7) {
  const cw = w / (cols * 2 + 1);
  const ch = h / (rows * 2 + 1);
  c.fillStyle = color;
  for (let a = 0; a < cols; a++) for (let b = 0; b < rows; b++) if (rnd(i + a * 3.1, b + 7) < density) c.fillRect(x + cw * (1 + a * 2), y + ch * (1 + b * 2), cw, ch);
}

/* back layers (far) and mid layers, one pair per level */

function back(p: P) {
  const { c, v, n } = p;
  const g = sy(v, 0);
  switch (n) {
    case 1:
      clouds(p, 0.04, '#ffffff', 0.85);
      ridge(p, 0.1, '#bddba0', 2.4, 0.7, 11);
      ridge(p, 0.16, '#aed38c', 1.5, 0.5, 7);
      break;
    case 2:
      c.fillStyle = '#fff1b8';
      circ(c, v.w * 0.78, sy(v, 8), v.s * 0.9);
      c.fill();
      layer(p, 0.1, 7, (i, x0, tile) => {
        const mh = (2.2 + rnd(i, 1) * 2.6) * v.s;
        const mw = tile * (0.38 + rnd(i, 2) * 0.2);
        const x = x0 + rnd(i, 3) * tile * 0.4;
        poly(c, [x, g, x + mw * 0.12, g - mh, x + mw * 0.88, g - mh, x + mw, g]);
        paint(c, '#9a7aa8');
      });
      break;
    case 3: {
      // pale flower-shaped clouds in the water, and goofy coral houses
      layer(p, 0.05, 6, (i, x0, tile) => {
        const x = x0 + rnd(i, 1) * tile;
        const y = sy(v, 7.4 + rnd(i, 2) * 1.8);
        const r = v.s * 0.4;
        c.globalAlpha = 0.55;
        for (let k = 0; k < 5; k++) {
          circ(c, x + Math.cos((k * TAU) / 5) * r * 1.3, y + Math.sin((k * TAU) / 5) * r * 1.3, r);
          paint(c, k % 2 ? '#ffd0e0' : '#A6E3D9');
        }
        c.globalAlpha = 1;
      });
      layer(p, 0.14, 4.2, (i, x0, tile) => {
        const h = (1.8 + rnd(i, 1) * 2.4) * v.s;
        const w = tile * 0.55;
        const x = x0 + rnd(i, 2) * tile * 0.35;
        rr(c, x, g - h, w, h, w * 0.45);
        paint(c, ['#e7709a', '#8E5CC7', '#6cc0c0', '#f0a050'][i & 3]);
        circ(c, x + w / 2, g - h * 0.6, w * 0.2);
        paint(c, '#d6f4ff', '#3d2a5a', 2);
      });
      break;
    }
    case 4: {
      // a kitchen wall: pale tiles and cupboards
      c.strokeStyle = 'rgba(160,130,90,0.22)';
      c.lineWidth = 1.5;
      const tile = v.s * 1.6;
      const off = p.reduced ? 0 : (v.camX * v.s * 0.1) % tile;
      for (let x = -off; x < v.w; x += tile) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, v.h);
        c.stroke();
      }
      for (let y = sy(v, 0) % tile; y < v.h; y += tile) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(v.w, y);
        c.stroke();
      }
      layer(p, 0.1, 6, (_i, x0, t) => {
        rr(c, x0 + t * 0.1, sy(v, 9.6), t * 0.8, v.s * 2.6, 6);
        paint(c, 'rgba(160,102,60,0.55)', 'rgba(90,50,20,0.5)', 2);
        rr(c, x0 + t * 0.2, sy(v, 9.3), t * 0.28, v.s * 2.0, 4);
        paint(c, 'rgba(180,125,80,0.6)');
        rr(c, x0 + t * 0.52, sy(v, 9.3), t * 0.28, v.s * 2.0, 4);
        paint(c, 'rgba(180,125,80,0.6)');
      });
      break;
    }
    case 5:
      clouds(p, 0.04, '#ffffff', 0.9);
      layer(p, 0.08, 13, (_i, x0) => {
        for (const dx of [0, 2.2]) {
          const x = x0 + dx * v.s;
          poly(c, [x, g, x + v.s * 0.35, g - v.s * 2.4, x + v.s * 1.15, g - v.s * 2.4, x + v.s * 1.5, g]);
          paint(c, '#c9c9d6');
          c.fillStyle = 'rgba(255,255,255,0.8)';
          circ(c, x + v.s * 0.8, g - v.s * 2.7, v.s * 0.4);
          c.fill();
        }
      });
      ridge(p, 0.12, '#8fce6c', 1.0, 0.35, 9);
      break;
    case 6: {
      c.fillStyle = 'rgba(255,240,200,0.18)';
      circ(c, v.w * 0.72, sy(v, 7.5), v.s * 1.9);
      c.fill();
      c.fillStyle = '#f7ecc7';
      circ(c, v.w * 0.72, sy(v, 7.5), v.s * 1.3);
      c.fill();
      c.fillStyle = 'rgba(200,190,150,0.5)';
      circ(c, v.w * 0.72 - v.s * 0.4, sy(v, 7.8), v.s * 0.28);
      c.fill();
      layer(p, 0.12, 11, (i, x0) => {
        const x = x0 + v.s;
        c.fillStyle = '#3a3470';
        c.fillRect(x, g - v.s * 3, v.s * 5, v.s * 3);
        poly(c, [x - v.s * 0.2, g - v.s * 3, x + v.s * 2.5, g - v.s * 4.6, x + v.s * 5.2, g - v.s * 3]);
        c.fill();
        c.fillRect(x + v.s * 0.4, g - v.s * 4.8, v.s * 0.9, v.s * 2);
        poly(c, [x + v.s * 0.3, g - v.s * 4.8, x + v.s * 0.85, g - v.s * 5.6, x + v.s * 1.5, g - v.s * 4.8]);
        c.fill();
        windows(c, x, g - v.s * 3, v.s * 5, v.s * 3, 4, 2, '#F2A541', i, 0.6);
      });
      break;
    }
    case 7:
      ridge(p, 0.08, '#8EA2B8', 2.2, 1.7, 8, 'jag', '#F4F6F8');
      ridge(p, 0.15, '#a8bacb', 1.2, 1.0, 5.5, 'jag', '#ffffff');
      break;
    case 8:
      layer(p, 0.08, 22, (_i, x0) => {
        const x = x0 + v.s * 4;
        poly(c, [x, g, x + v.s * 5, g - v.s * 5.2, x + v.s * 7, g - v.s * 5.2, x + v.s * 12, g]);
        paint(c, '#7a3028');
        poly(c, [x + v.s * 5, g - v.s * 5.2, x + v.s * 6, g - v.s * 4.6, x + v.s * 7, g - v.s * 5.2]);
        paint(c, '#F26B1D');
        c.globalAlpha = 0.5;
        for (let k = 0; k < 4; k++) {
          const t = p.reduced ? 0 : (p.time * 0.3 + k * 0.25) % 1;
          circ(c, x + v.s * 6 + Math.sin(k + p.time * 0.3) * v.s * 0.3, g - v.s * (5.6 + t * 2.6), v.s * (0.5 + t * 0.6));
          paint(c, '#d9ccc0');
        }
        c.globalAlpha = 1;
      });
      c.fillStyle = '#3F8F8C';
      c.fillRect(0, g - v.s * 0.5, v.w, v.s);
      break;
    case 9:
      stars(p, 0.03, 6, '#bde8ff');
      layer(p, 0.08, 3, (i, x0, tile) => {
        const h = (2.5 + rnd(i, 1) * 3.5) * v.s;
        const x = x0 + tile * 0.05;
        c.fillStyle = '#1e2a6e';
        rr(c, x, g - h, tile * 0.8, h, 6);
        c.fill();
        windows(c, x, g - h, tile * 0.8, h, 3, Math.max(2, Math.floor(h / v.s / 0.7)), '#FFD84A', i, 0.45);
      });
      break;
    default:
      stars(p, 0.04, 9, '#ffffff');
      layer(p, 0.07, 18, (i, x0) => {
        const x = x0 + v.s * 6;
        const y = sy(v, 6.8 - rnd(i, 1) * 1.6);
        c.fillStyle = i % 2 ? '#F28C38' : '#3FB8AF';
        circ(c, x, y, v.s * 1.5);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.22)';
        circ(c, x - v.s * 0.5, y - v.s * 0.5, v.s * 0.55);
        c.fill();
        c.strokeStyle = '#C3B1E1';
        c.lineWidth = v.s * 0.16;
        ell(c, x, y, v.s * 2.5, v.s * 0.55, -0.35);
        c.stroke();
      });
  }
}

function mid(p: P) {
  const { c, v, n } = p;
  const g = sy(v, 0);
  switch (n) {
    case 1:
      layer(p, 0.32, 6, (i, x0, tile) => {
        const x = x0 + tile * (0.2 + rnd(i, 1) * 0.4);
        if (i % 3 === 0) {
          c.fillStyle = '#F6E7C8';
          c.fillRect(x, g - v.s * 1.1, v.s * 1.6, v.s * 1.1);
          poly(c, [x - v.s * 0.2, g - v.s * 1.1, x + v.s * 0.8, g - v.s * 1.9, x + v.s * 1.8, g - v.s * 1.1]);
          paint(c, '#D9825B');
        } else {
          c.fillStyle = '#e8e0cf';
          c.fillRect(x, g - v.s * 1.7, v.s * 0.22, v.s * 1.7);
          for (const [dx, dy, r] of [[0, -1.9, 0.75], [-0.5, -1.5, 0.55], [0.5, -1.5, 0.55]]) {
            circ(c, x + v.s * 0.11 + dx * v.s, g + dy * v.s, r * v.s);
            paint(c, '#86B864');
          }
        }
      });
      break;
    case 2:
      layer(p, 0.3, 6, (i, x0, tile) => {
        const x = x0 + tile * 0.2;
        const mh = (1.2 + rnd(i, 4) * 1.4) * v.s;
        const mw = tile * 0.5;
        poly(c, [x, g, x + mw * 0.1, g - mh, x + mw * 0.9, g - mh, x + mw, g]);
        paint(c, '#d9783b');
        c.fillStyle = '#b8602c';
        c.fillRect(x + mw * 0.05, g - mh * 0.55, mw * 0.9, mh * 0.08);
      });
      break;
    case 3:
      layer(p, 0.34, 3, (i, x0, tile) => {
        const x = x0 + tile * 0.3;
        const h = (1.5 + rnd(i, 1) * 1.6) * v.s;
        c.strokeStyle = '#7fcf3a';
        c.lineWidth = v.s * 0.3;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(x, g);
        for (let k = 1; k <= 6; k++) c.lineTo(x + Math.sin(k * 1.3 + i + (p.reduced ? 0 : p.time)) * v.s * 0.25, g - (h * k) / 6);
        c.stroke();
      });
      layer(p, 0.4, 5, (i, x0, tile) => {
        const t = p.reduced ? 0.4 : (p.time * 0.18 + rnd(i, 1)) % 1;
        const x = x0 + rnd(i, 2) * tile;
        circ(c, x, sy(v, 0.5 + t * 9), v.s * (0.12 + rnd(i, 3) * 0.12));
        paint(c, 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0.8)', 1.5);
      });
      break;
    case 4:
      c.fillStyle = '#b07a48';
      c.fillRect(0, g - v.s * 1.1, v.w, v.s * 1.1);
      c.fillStyle = '#8a5a30';
      c.fillRect(0, g - v.s * 1.1, v.w, v.s * 0.12);
      layer(p, 0.3, 9, (i, x0, tile) => {
        if (i % 2) return;
        const x = x0 + tile * 0.3;
        c.beginPath();
        c.moveTo(x, g - v.s * 1.1);
        c.lineTo(x, g - v.s * 1.1 - v.s * 0.4);
        c.arc(x + v.s * 0.65, g - v.s * 1.5, v.s * 0.65, Math.PI, 0);
        c.lineTo(x + v.s * 1.3, g - v.s * 1.1);
        c.closePath();
        paint(c, '#2a1a10');
      });
      break;
    case 5:
      layer(p, 0.3, 5, (i, x0, tile) => {
        const x = x0 + tile * (0.1 + rnd(i, 1) * 0.3);
        if (i % 2) {
          c.fillStyle = '#6a4a2a';
          c.fillRect(x + v.s * 0.2, g - v.s * 0.9, v.s * 0.2, v.s * 0.9);
          circ(c, x + v.s * 0.3, g - v.s * 1.4, v.s * 0.7);
          paint(c, '#5eaa3c');
        } else {
          c.fillStyle = i % 4 === 0 ? '#E7A6C0' : '#B9A3D6';
          c.fillRect(x, g - v.s * 1.5, v.s * 2.2, v.s * 1.5);
          poly(c, [x - v.s * 0.1, g - v.s * 1.5, x + v.s * 1.1, g - v.s * 2.2, x + v.s * 2.3, g - v.s * 1.5]);
          paint(c, '#b2573c');
          c.fillStyle = '#fff';
          c.fillRect(x + v.s * 0.4, g - v.s * 1.1, v.s * 0.5, v.s * 0.5);
        }
      });
      break;
    case 6:
      c.fillStyle = 'rgba(127,176,105,0.18)';
      c.fillRect(0, g - v.s * 1.6, v.w, v.s * 1.6);
      layer(p, 0.3, 4.5, (_i, x0, tile) => {
        const x = x0 + tile * 0.4;
        c.strokeStyle = '#4b3369';
        c.lineWidth = v.s * 0.14;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(x, g);
        c.lineTo(x + v.s * 0.1, g - v.s * 1.6);
        c.moveTo(x + v.s * 0.08, g - v.s * 1.1);
        c.lineTo(x + v.s * 0.8, g - v.s * 1.7);
        c.moveTo(x + v.s * 0.1, g - v.s * 1.4);
        c.lineTo(x - v.s * 0.6, g - v.s * 1.9);
        c.stroke();
      });
      break;
    case 7:
      layer(p, 0.3, 4.5, (i, x0, tile) => {
        const x = x0 + tile * (0.1 + rnd(i, 1) * 0.3);
        if (i % 2) {
          for (let k = 0; k < 3; k++) {
            poly(c, [x - v.s * (0.7 - k * 0.15), g - v.s * (0.5 + k * 0.5), x + v.s * 0.3, g - v.s * (1.4 + k * 0.5), x + v.s * (1.3 + k * 0.15), g - v.s * (0.5 + k * 0.5)]);
            paint(c, '#2F6B3A');
          }
        } else {
          c.fillStyle = i % 4 === 0 ? '#C8423B' : '#E9C24B';
          c.fillRect(x, g - v.s * 1.1, v.s * 1.5, v.s * 1.1);
          poly(c, [x - v.s * 0.1, g - v.s * 1.1, x + v.s * 0.75, g - v.s * 1.8, x + v.s * 1.6, g - v.s * 1.1]);
          paint(c, '#F4F6F8');
        }
      });
      break;
    case 8:
      layer(p, 0.3, 6, (i, x0, tile) => {
        const x = x0 + tile * (0.2 + rnd(i, 1) * 0.4);
        ell(c, x, g - v.s * 0.1, v.s * 1.3, v.s * 0.3);
        paint(c, '#F26B1D');
        const glow = p.reduced ? 0.25 : 0.2 + 0.12 * Math.sin(p.time * 2 + i);
        c.globalAlpha = glow;
        ell(c, x, g - v.s * 0.1, v.s * 2, v.s * 0.7);
        paint(c, '#ffb347');
        c.globalAlpha = 1;
      });
      break;
    case 9:
      layer(p, 0.3, 2.6, (i, x0, tile) => {
        const h = (1.6 + rnd(i, 1) * 3) * v.s;
        const x = x0 + tile * 0.1;
        c.fillStyle = '#2b2f7a';
        rr(c, x, g - h, tile * 0.75, h, 5);
        c.fill();
        c.fillStyle = i % 2 ? '#FF3E9A' : '#3EE0FF';
        c.fillRect(x, g - h, tile * 0.75, Math.max(2, v.s * 0.08));
        windows(c, x, g - h, tile * 0.75, h, 2, Math.max(1, Math.floor(h / v.s / 0.8)), i % 2 ? '#FF3E9A' : '#FFD84A', i, 0.5);
      });
      break;
    default:
      layer(p, 0.26, 8, (i, x0, tile) => {
        const x = x0 + tile * 0.3;
        const top = g - v.s * (2.2 + rnd(i, 1) * 1.2);
        c.fillStyle = '#5b5598';
        c.fillRect(x + v.s * 0.8, top, v.s * 0.25, g - top);
        ell(c, x + v.s * 0.92, top, v.s * 1.1, v.s * 0.28);
        paint(c, '#F5ECD7', '#2b2f5e', 1.5);
        c.beginPath();
        c.arc(x + v.s * 0.92, top - v.s * 0.05, v.s * 0.5, Math.PI, 0);
        paint(c, 'rgba(63,184,175,0.7)');
      });
      layer(p, 0.4, 5, (i, x0, tile) => {
        const x = x0 + rnd(i, 1) * tile;
        const y = sy(v, 1 + rnd(i, 2) * 8) + (p.reduced ? 0 : Math.sin(p.time + i) * 4);
        ell(c, x, y, v.s * 0.28, v.s * 0.2, rnd(i, 5));
        paint(c, '#8a84b8');
      });
  }
}

/* ---------- walls ---------- */

/** One solid piece of a wall. `capTop`/`capBot` say the piece borders a gap at its top/bottom edge. */
function segment(p: P, wall: Wall, x: number, w: number, y0: number, y1: number, capTop: boolean, capBot: boolean, t: number) {
  const { c, v, n } = p;
  const ink = WORLDS[n - 1].ink;
  const lw = Math.max(2, v.s * 0.07);
  const H = y1 - y0;
  if (H <= 0) return;
  const kind: WorldLayer = capTop && capBot ? 'wall-middle' : capTop ? 'wall-bottom' : 'wall-top';
  const img = picture(worldArt(n, kind));
  if (img) {
    c.drawImage(img, x, y0, w, H);
    return;
  }
  const alt = wall.i % 2 === 1;
  c.save();
  c.beginPath();
  c.rect(x - w * 0.3, capTop ? y0 - v.s * 3 : y0 - 60, w * 1.6, (capTop ? v.s * 3 : 60) + H + (capBot ? v.s * 2 : 60));
  c.clip();

  switch (n) {
    case 1: {
      // picket-fence posts, sunflowers on top
      c.fillStyle = '#F6E7C8';
      c.fillRect(x, y0, w, H);
      c.fillStyle = '#e4cfa4';
      c.fillRect(x + w * 0.68, y0, w * 0.32, H);
      c.strokeStyle = '#d2b98a';
      c.lineWidth = 2;
      for (let y = y0 + v.s * 1.2; y < y1; y += v.s * 1.6) {
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + w, y);
        c.stroke();
      }
      c.strokeStyle = ink;
      c.lineWidth = lw;
      c.strokeRect(x, y0, w, H);
      if (capTop) {
        poly(c, [x, y0 + 1, x + w / 2, y0 - w * 0.5, x + w, y0 + 1]);
        paint(c, '#F6E7C8', ink, lw);
        const cy = y0 - w * 0.62;
        c.fillStyle = '#ffd23f';
        for (let k = 0; k < 10; k++) {
          ell(c, x + w / 2 + Math.cos((k * TAU) / 10) * w * 0.3, cy + Math.sin((k * TAU) / 10) * w * 0.3, w * 0.17, w * 0.09, (k * TAU) / 10);
          c.fill();
        }
        circ(c, x + w / 2, cy, w * 0.2);
        paint(c, '#7b4a1e', ink, 1.5);
        c.fillStyle = ink;
        circ(c, x + w * 0.44, cy - 1, 1.6);
        c.fill();
        circ(c, x + w * 0.56, cy - 1, 1.6);
        c.fill();
      }
      if (capBot) {
        poly(c, [x, y1 - 1, x + w / 2, y1 + w * 0.5, x + w, y1 - 1]);
        paint(c, '#F6E7C8', ink, lw);
      }
      break;
    }
    case 2: {
      const g = c.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, '#d9683a');
      g.addColorStop(1, '#a8431f');
      c.fillStyle = g;
      c.fillRect(x, y0, w, H);
      c.fillStyle = 'rgba(255,220,160,0.28)';
      for (let y = y0 + v.s * 0.4; y < y1; y += v.s * 0.9) c.fillRect(x, y, w, v.s * 0.22);
      c.strokeStyle = ink;
      c.lineWidth = lw;
      c.strokeRect(x, y0, w, H);
      if (capTop) {
        rr(c, x - w * 0.1, y0 - v.s * 0.25, w * 1.2, v.s * 0.4, v.s * 0.15);
        paint(c, '#e58a52', ink, lw);
        if (alt) {
          // a cactus on the top
          const cx = x + w / 2;
          const cy = y0 - v.s * 0.25;
          rr(c, cx - w * 0.11, cy - v.s * 1.0, w * 0.22, v.s * 1.0, w * 0.1);
          paint(c, '#4f9b3a', ink, 2);
          rr(c, cx - w * 0.36, cy - v.s * 0.75, w * 0.14, v.s * 0.4, w * 0.07);
          paint(c, '#4f9b3a', ink, 2);
          rr(c, cx + w * 0.22, cy - v.s * 0.62, w * 0.14, v.s * 0.4, w * 0.07);
          paint(c, '#4f9b3a', ink, 2);
        }
      }
      if (capBot) {
        rr(c, x - w * 0.1, y1 - v.s * 0.15, w * 1.2, v.s * 0.4, v.s * 0.15);
        paint(c, '#e58a52', ink, lw);
      }
      break;
    }
    case 3: {
      const col = ['#ff7fa8', '#b36be0', '#ff9a5a'][wall.i % 3];
      c.fillStyle = col;
      c.fillRect(x, y0, w, H);
      c.fillStyle = 'rgba(255,255,255,0.28)';
      for (let y = y0 + v.s * 0.5; y < y1; y += v.s * 1.1) {
        circ(c, x + w * (0.3 + 0.4 * rnd(wall.i, y)), y, v.s * 0.14);
        c.fill();
      }
      c.strokeStyle = ink;
      c.lineWidth = lw * 1.3;
      c.strokeRect(x, y0, w, H);
      for (const [on, ey, dir] of [[capTop, y0, -1], [capBot, y1, 1]] as const) {
        if (!on) continue;
        for (let k = 0; k < 3; k++) {
          circ(c, x + w * (0.2 + k * 0.3), ey + dir * 1, w * 0.2);
          paint(c, col, ink, lw * 1.3);
        }
      }
      break;
    }
    case 4: {
      if (alt) {
        // cheese stack
        c.fillStyle = '#F2C744';
        c.fillRect(x, y0, w, H);
        c.fillStyle = '#d9a82a';
        for (let y = y0 + v.s * 0.6; y < y1; y += v.s * 1.1) {
          ell(c, x + w * (0.25 + 0.5 * rnd(wall.i, y)), y, v.s * 0.2, v.s * 0.14);
          c.fill();
        }
        c.strokeStyle = ink;
        c.lineWidth = lw;
        c.strokeRect(x, y0, w, H);
        for (const [on, ey, dir] of [[capTop, y0, -1], [capBot, y1, 1]] as const) {
          if (!on) continue;
          poly(c, [x - w * 0.1, ey, x + w * 1.1, ey, x + w * 0.5, ey + dir * w * 0.45]);
          paint(c, '#f7d96a', ink, lw);
        }
      } else {
        // table leg
        const g = c.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, '#b87a48');
        g.addColorStop(1, '#8a5530');
        c.fillStyle = g;
        c.fillRect(x, y0, w, H);
        c.strokeStyle = '#6d4224';
        c.lineWidth = 2;
        for (let y = y0 + v.s * 0.8; y < y1; y += v.s * 1.6) {
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + w, y);
          c.stroke();
        }
        c.strokeStyle = ink;
        c.lineWidth = lw;
        c.strokeRect(x, y0, w, H);
        for (const [on, ey, dir] of [[capTop, y0, -1], [capBot, y1, 1]] as const) {
          if (!on) continue;
          rr(c, x - w * 0.12, ey + (dir < 0 ? -v.s * 0.45 : -v.s * 0.0), w * 1.24, v.s * 0.45, v.s * 0.2);
          paint(c, '#c88a55', ink, lw);
        }
      }
      break;
    }
    case 5: {
      if (alt) {
        // lamp post
        c.fillStyle = '#8C8C8C';
        c.fillRect(x, y0, w, H);
        c.fillStyle = '#a8a8a8';
        c.fillRect(x + w * 0.15, y0, w * 0.2, H);
        c.strokeStyle = ink;
        c.lineWidth = lw;
        c.strokeRect(x, y0, w, H);
        for (const [on, ey, dir] of [[capTop, y0, -1], [capBot, y1, 1]] as const) {
          if (!on) continue;
          rr(c, x - w * 0.2, ey + (dir < 0 ? -v.s * 0.6 : 0), w * 1.4, v.s * 0.6, v.s * 0.2);
          paint(c, '#5a5a5a', ink, lw);
          circ(c, x + w / 2, ey + dir * v.s * 0.1 + (dir < 0 ? -v.s * 0.1 : v.s * 0.4), v.s * 0.28);
          paint(c, '#ffe45e', ink, lw);
        }
      } else {
        // chimney
        c.fillStyle = '#c0583a';
        c.fillRect(x, y0, w, H);
        c.strokeStyle = 'rgba(80,20,10,0.35)';
        c.lineWidth = 2;
        for (let y = y0 + v.s * 0.4; y < y1; y += v.s * 0.4) {
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + w, y);
          c.stroke();
          const off = Math.round((y - y0) / (v.s * 0.4)) % 2 ? w * 0.25 : w * 0.6;
          c.beginPath();
          c.moveTo(x + off, y);
          c.lineTo(x + off, y + v.s * 0.4);
          c.stroke();
        }
        c.strokeStyle = ink;
        c.lineWidth = lw;
        c.strokeRect(x, y0, w, H);
        for (const [on, ey, dir] of [[capTop, y0, -1], [capBot, y1, 1]] as const) {
          if (!on) continue;
          rr(c, x - w * 0.12, ey + (dir < 0 ? -v.s * 0.4 : 0), w * 1.24, v.s * 0.4, v.s * 0.1);
          paint(c, '#9c3f27', ink, lw);
        }
      }
      break;
    }
    case 6: {
      if (alt) {
        // wobbly bookshelf
        c.fillStyle = '#6e4328';
        c.fillRect(x, y0, w, H);
        const cols = ['#c0392b', '#2e86c1', '#d4ac0d', '#27ae60', '#8e44ad'];
        for (let y = y0 + v.s * 0.2; y < y1 - v.s * 0.3; y += v.s * 1.0) {
          for (let k = 0; k < 5; k++) {
            c.fillStyle = cols[(k + Math.round(y / v.s)) % 5];
            c.fillRect(x + w * 0.06 + k * w * 0.17, y + (k % 2) * v.s * 0.08, w * 0.15, v.s * (0.7 - (k % 2) * 0.08));
          }
          c.fillStyle = '#3d2412';
          c.fillRect(x, y + v.s * 0.82, w, v.s * 0.1);
        }
        c.strokeStyle = ink;
        c.lineWidth = lw * 1.4;
        c.strokeRect(x, y0, w, H);
      } else {
        c.fillStyle = '#6a4a8a';
        c.fillRect(x, y0, w, H);
        c.strokeStyle = 'rgba(20,10,40,0.4)';
        c.lineWidth = 2;
        for (let y = y0 + v.s * 0.45; y < y1; y += v.s * 0.45) {
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + w, y);
          c.stroke();
        }
        c.strokeStyle = ink;
        c.lineWidth = lw * 1.4;
        c.strokeRect(x, y0, w, H);
      }
      for (const [on, ey, dir] of [[capTop, y0, -1], [capBot, y1, 1]] as const) {
        if (!on) continue;
        const lean = w * 0.18 * (wall.i % 2 ? 1 : -1);
        poly(c, [x - w * 0.1, ey, x + w * 1.1, ey, x + w * 0.9 + lean, ey + dir * v.s * 0.5, x + w * 0.1 + lean, ey + dir * v.s * 0.5]);
        paint(c, '#4b3369', ink, lw * 1.4);
      }
      break;
    }
    case 7: {
      // paper pines: zigzag tiers, a little snow
      const tier = v.s * 0.95;
      const right: number[] = [];
      const left: number[] = [];
      let ys = y0;
      while (ys < y1) {
        const ny = Math.min(y1, ys + tier);
        right.push(x + w, ys + tier * 0.45, x + w * 0.86, ny);
        left.unshift(x + w * 0.14, ny, x, ys + tier * 0.45);
        ys = ny;
      }
      poly(c, [x, y0, x + w, y0, ...right, ...left]);
      paint(c, '#2F6B3A', '#1f4a28', lw);
      c.fillStyle = '#3d8a4b';
      c.fillRect(x + w * 0.1, y0, w * 0.35, H);
      c.fillStyle = 'rgba(0,0,0,0.12)';
      c.fillRect(x + w * 0.75, y0, w * 0.25, H);
      c.fillStyle = '#F4F6F8';
      for (let yy = y0 + tier * 0.3; yy < y1; yy += tier) {
        poly(c, [x, yy, x + w * 0.5, yy - tier * 0.12, x + w, yy, x + w * 0.5, yy + tier * 0.22]);
        c.fill();
      }
      if (capTop) {
        poly(c, [x, y0 + 1, x + w / 2, y0 - w * 0.7, x + w, y0 + 1]);
        paint(c, '#2F6B3A', '#1f4a28', lw);
        poly(c, [x + w * 0.3, y0 - w * 0.3, x + w / 2, y0 - w * 0.7, x + w * 0.7, y0 - w * 0.3]);
        paint(c, '#F4F6F8');
      }
      if (capBot) {
        poly(c, [x, y1 - 1, x + w / 2, y1 + w * 0.7, x + w, y1 - 1]);
        paint(c, '#2F6B3A', '#1f4a28', lw);
      }
      break;
    }
    case 8: {
      c.fillStyle = '#3B3434';
      c.fillRect(x, y0, w, H);
      c.fillStyle = '#4d4444';
      c.fillRect(x + w * 0.1, y0, w * 0.25, H);
      c.strokeStyle = '#F26B1D';
      c.lineWidth = Math.max(2, v.s * 0.06);
      c.beginPath();
      let cx = x + w * 0.5;
      for (let y = y0; y < y1; y += v.s * 0.7) {
        c.lineTo(cx, y);
        cx = x + w * (0.25 + 0.5 * rnd(wall.i, y));
      }
      c.stroke();
      c.strokeStyle = ink;
      c.lineWidth = lw * 1.3;
      c.strokeRect(x, y0, w, H);
      for (const [on, ey, dir] of [[capTop, y0, -1], [capBot, y1, 1]] as const) {
        if (!on) continue;
        poly(c, [x - w * 0.05, ey, x + w * 0.2, ey + dir * v.s * 0.4, x + w * 0.45, ey + dir * v.s * 0.15, x + w * 0.7, ey + dir * v.s * 0.45, x + w * 1.05, ey]);
        paint(c, '#4d4444', ink, lw * 1.3);
        c.strokeStyle = '#ffb347';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(x + w * 0.1, ey + dir * 2);
        c.lineTo(x + w * 0.9, ey + dir * 2);
        c.stroke();
      }
      break;
    }
    case 9: {
      c.fillStyle = '#0c1030';
      c.fillRect(x, y0, w, H);
      windows(c, x, y0, w, H, 3, Math.max(2, Math.floor(H / v.s / 0.75)), wall.i % 2 ? '#FF3E9A' : '#FFD84A', wall.i, 0.5);
      c.strokeStyle = '#3EE0FF';
      c.lineWidth = Math.max(2, v.s * 0.08);
      c.strokeRect(x, y0, w, H);
      if (capTop) {
        c.beginPath();
        c.moveTo(x + w / 2, y0);
        c.lineTo(x + w / 2, y0 - v.s * 0.9);
        c.stroke();
        circ(c, x + w / 2, y0 - v.s * 0.95, v.s * 0.12);
        paint(c, p.reduced || Math.sin(p.time * 5) > 0 ? '#ff2d55' : '#7a1a2a');
      }
      break;
    }
    default: {
      if (!alt) {
        // rocket gantry
        c.fillStyle = '#3FB8AF';
        c.fillRect(x, y0, w, H);
        c.strokeStyle = '#F28C38';
        c.lineWidth = Math.max(3, v.s * 0.1);
        for (let y = y0; y < y1; y += v.s * 1.2) {
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + w, y + v.s * 1.2);
          c.moveTo(x + w, y);
          c.lineTo(x, y + v.s * 1.2);
          c.stroke();
        }
        c.strokeStyle = ink;
        c.lineWidth = lw * 1.3;
        c.strokeRect(x, y0, w, H);
      } else {
        // asteroid stack
        c.fillStyle = '#8a84b8';
        c.fillRect(x, y0, w, H);
        c.save();
        c.beginPath();
        c.rect(x, y0, w, H);
        c.clip();
        for (let y = y0; y < y1 + v.s; y += v.s * 0.9) {
          circ(c, x + w * (0.2 + 0.6 * rnd(wall.i, y)), y, w * 0.38);
          paint(c, ['#a29bd0', '#7d77a8', '#948ec4'][Math.round(y / v.s) % 3], ink, lw);
        }
        c.restore();
      }
      for (const [on, ey, dir] of [[capTop, y0, -1], [capBot, y1, 1]] as const) {
        if (!on) continue;
        circ(c, x + w / 2, ey + dir * v.s * 0.12, v.s * 0.2);
        paint(c, '#F28C38', ink, lw);
      }
    }
  }
  c.restore();

  // Lit-up gap edges in the dark city
  if (n === 9) {
    const glow = (ey: number) => {
      c.strokeStyle = 'rgba(62,224,255,0.28)';
      c.lineWidth = v.s * 0.3;
      c.beginPath();
      c.moveTo(x - 4, ey);
      c.lineTo(x + w + 4, ey);
      c.stroke();
      c.strokeStyle = '#9ff3ff';
      c.lineWidth = Math.max(3, v.s * 0.1);
      c.stroke();
    };
    if (capTop) glow(y0);
    if (capBot) glow(y1);
  }
  void t;
}

function drawWall(p: P, wall: Wall, t: number) {
  const { v } = p;
  const x = sx(v, wall.x);
  const w = WALL_WIDTH * v.s;
  const gaps = [...gapsAt(wall, t)].sort((a, b) => a.y - b.y);
  // solid from the ground up to the first gap, between gaps, then up to the sky
  const pieces: Array<{ lo: number; hi: number; capTop: boolean; capBot: boolean }> = [];
  let lo = 0;
  gaps.forEach((g) => {
    pieces.push({ lo, hi: g.y - g.h / 2, capTop: true, capBot: lo > 0 });
    lo = g.y + g.h / 2;
  });
  pieces.push({ lo, hi: SKY + TOP_PAD, capTop: false, capBot: true });
  pieces[0].capBot = false;
  for (const pc of pieces) {
    // the piece that starts at the ground has no bottom cap; the last has no top cap; middles have both
    const first = pc === pieces[0];
    const last = pc === pieces[pieces.length - 1];
    segment(p, wall, x, w, sy(v, pc.hi), sy(v, first ? -GROUND : pc.lo), !last, !first, t);
  }
}

/* ---------- zones, perches, nest ---------- */

function drawZone(p: P, z: Zone, t: number, k: number) {
  const { c, v } = p;
  const x0 = sx(v, z.x0);
  const x1 = sx(v, z.x1);
  if (x1 < -50 || x0 > v.w + 50) return;
  const on = zoneOn(z, t);
  const wob = p.reduced ? 0 : 1;
  if (z.kind === 'ghost') {
    const cx = (x0 + x1) / 2;
    const cy = sy(v, SKY / 2 + Math.sin(p.time * 1.7 + k) * 0.35 * wob);
    const s = v.s;
    c.fillStyle = 'rgba(255,255,255,0.07)';
    c.fillRect(x0, sy(v, SKY), x1 - x0, v.s * SKY);
    // wobbly sheet-ghost
    c.beginPath();
    c.moveTo(cx - s * 0.8, cy + s * 1.0);
    c.lineTo(cx - s * 0.8, cy - s * 0.3);
    c.bezierCurveTo(cx - s * 0.8, cy - s * 1.3, cx + s * 0.8, cy - s * 1.3, cx + s * 0.8, cy - s * 0.3);
    c.lineTo(cx + s * 0.8, cy + s * 1.0);
    for (let i = 0; i < 4; i++) c.quadraticCurveTo(cx + s * (0.6 - i * 0.4), cy + s * (1.3 + (i % 2 ? -0.15 : 0.15) * (wob ? Math.sin(p.time * 4 + i) + 1 : 1)), cx + s * (0.4 - i * 0.4), cy + s * 1.0);
    c.closePath();
    paint(c, 'rgba(255,255,255,0.92)', '#2b2a5c', Math.max(2, s * 0.06));
    c.fillStyle = '#2b2a5c';
    ell(c, cx - s * 0.28, cy - s * 0.3, s * 0.11, s * 0.17);
    c.fill();
    ell(c, cx + s * 0.28, cy - s * 0.3, s * 0.11, s * 0.17);
    c.fill();
    ell(c, cx, cy + s * 0.15, s * 0.14, s * 0.2);
    c.fill();
    // arrow: which way it pushes
    const up = z.push > 0;
    c.strokeStyle = '#ffd84a';
    c.fillStyle = '#ffd84a';
    c.lineWidth = Math.max(3, s * 0.12);
    c.lineCap = 'round';
    const ay = up ? cy - s * 2.0 : cy + s * 2.0;
    c.beginPath();
    c.moveTo(cx, up ? ay + s * 1.0 : ay - s * 1.0);
    c.lineTo(cx, ay);
    c.stroke();
    poly(c, [cx - s * 0.35, up ? ay + s * 0.1 : ay - s * 0.1, cx + s * 0.35, up ? ay + s * 0.1 : ay - s * 0.1, cx, up ? ay - s * 0.45 : ay + s * 0.45]);
    c.fill();
  } else if (z.kind === 'gust') {
    const dir = z.push > 0 ? -1 : 1;
    if (!on) return;
    c.strokeStyle = 'rgba(255,255,255,0.95)';
    c.lineCap = 'round';
    c.lineWidth = Math.max(2, v.s * 0.07);
    const count = Math.max(6, Math.floor((x1 - x0) / (v.s * 0.8)) * 3);
    for (let i = 0; i < count; i++) {
      const f = ((rnd(i, k) + (wob ? p.time * 0.9 : 0)) % 1);
      const px = x0 + ((i * 0.37 + rnd(i, 3)) % 1) * (x1 - x0);
      const py = sy(v, SKY) + f * v.s * SKY;
      c.beginPath();
      c.moveTo(px, py);
      c.lineTo(px + v.s * 0.7, py + dir * v.s * 0.35);
      c.stroke();
    }
    // big arrow
    const cx = (x0 + x1) / 2;
    const cy = sy(v, SKY / 2);
    c.fillStyle = 'rgba(255,255,255,0.75)';
    const up = z.push > 0;
    poly(c, [cx - v.s * 0.5, cy + (up ? v.s * 0.3 : -v.s * 0.3), cx + v.s * 0.5, cy + (up ? v.s * 0.3 : -v.s * 0.3), cx, cy + (up ? -v.s * 0.5 : v.s * 0.5)]);
    c.fill();
  } else if (z.kind === 'steam') {
    const phase = (t + (z.timed?.offset ?? 0)) % (z.timed?.period ?? 1);
    const warn = !on && phase >= (z.timed?.period ?? 0) - 36;
    const cx = (x0 + x1) / 2;
    // a vent on the ground
    ell(c, cx, sy(v, 0), v.s * 0.7, v.s * 0.22);
    paint(c, '#3B3434', '#1e1818', 2);
    if (on || warn) {
      const n = on ? 7 : 2;
      for (let i = 0; i < n; i++) {
        const f = on ? ((i / n + (wob ? p.time * 1.6 : 0)) % 1) : (i * 0.15 + 0.1);
        c.globalAlpha = (on ? 0.9 : 0.5) * (1 - f * 0.6);
        circ(c, cx + Math.sin(i * 2 + f * 5) * v.s * 0.35, sy(v, 0.3 + f * (on ? 8 : 1.2)), v.s * (0.35 + f * 0.5));
        paint(c, '#F1E9DF');
      }
      c.globalAlpha = 1;
    }
  } else {
    // low gravity: a floaty bubble
    const cx = (x0 + x1) / 2;
    const rx = (x1 - x0) / 2;
    const cy = sy(v, SKY / 2);
    ell(c, cx, cy, rx, v.s * SKY * 0.46);
    paint(c, 'rgba(180,220,255,0.18)', 'rgba(220,240,255,0.8)', Math.max(2, v.s * 0.06));
    c.strokeStyle = 'rgba(255,255,255,0.7)';
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(cx, cy, rx * 0.82, v.s * SKY * 0.38, 0, Math.PI * 1.1, Math.PI * 1.4);
    c.stroke();
    c.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) {
      star(c, cx + (rnd(i, k) - 0.5) * rx * 1.3, cy + (rnd(i, k + 5) - 0.5) * v.s * 6 + (wob ? Math.sin(p.time * 1.5 + i) * 5 : 0), v.s * 0.14);
      c.fill();
    }
  }
}

function drawPerch(p: P, x: number, y: number, passed: boolean) {
  const { c, v } = p;
  const px = sx(v, x);
  const top = sy(v, y - BIRD_HALF - 0.04);
  const post = v.s * 0.22;
  c.fillStyle = '#8a5a30';
  c.fillRect(px - post / 2, top, post, sy(v, 0) - top);
  c.strokeStyle = '#3d2412';
  c.lineWidth = 2;
  c.strokeRect(px - post / 2, top, post, sy(v, 0) - top);
  rr(c, px - v.s * 0.65, top - v.s * 0.04, v.s * 1.3, v.s * 0.2, v.s * 0.08);
  paint(c, '#c88a55', '#3d2412', 2);
  // a small flag: a tick when you have been
  c.strokeStyle = '#3d2412';
  c.beginPath();
  c.moveTo(px + v.s * 0.55, top);
  c.lineTo(px + v.s * 0.55, top - v.s * 1.0);
  c.stroke();
  poly(c, [px + v.s * 0.55, top - v.s * 1.0, px + v.s * 1.15, top - v.s * 0.8, px + v.s * 0.55, top - v.s * 0.6]);
  paint(c, passed ? '#32c36c' : '#ffd23f', '#3d2412', 2);
}

function drawNest(p: P, x: number) {
  const { c, v } = p;
  const px = sx(v, x);
  const g = sy(v, 0);
  c.fillStyle = '#6a4a2a';
  c.fillRect(px - v.s * 0.15, g - v.s * 5.5, v.s * 0.3, v.s * 5.5);
  // a chequered flag
  const fx = px + v.s * 0.15;
  const fy = g - v.s * 5.5;
  for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) {
    c.fillStyle = (a + b) % 2 ? '#222' : '#fff';
    c.fillRect(fx + a * v.s * 0.32, fy + b * v.s * 0.32, v.s * 0.32, v.s * 0.32);
  }
  c.beginPath();
  c.ellipse(px, g - v.s * 0.2, v.s * 1.3, v.s * 0.55, 0, 0, Math.PI);
  paint(c, '#b88a4a', '#5a3a14', 2.5);
  for (const dx of [-0.5, 0, 0.5]) {
    ell(c, px + dx * v.s, g - v.s * 0.55, v.s * 0.2, v.s * 0.27);
    paint(c, '#f4f0e0', '#5a3a14', 2);
  }
}

/* ---------- the scene ---------- */

export function drawScene(c: Ctx, o: SceneOpts): View {
  const { course, state: st } = o;
  const n = course.def.n;
  const world = WORLDS[n - 1];
  const view = makeView(st, o.w, o.h);
  const p: P = { c, v: view, n, time: o.time, reduced: o.reduced };
  const v = view;
  c.save();
  if (o.shake > 0) c.translate((Math.random() - 0.5) * o.shake, (Math.random() - 0.5) * o.shake);

  // sky
  const sky = c.createLinearGradient(0, 0, 0, v.h);
  sky.addColorStop(0, world.skyTop);
  sky.addColorStop(1, world.skyBot);
  c.fillStyle = sky;
  c.fillRect(-20, -20, v.w + 40, v.h + 40);
  const backImg = picture(worldArt(n, 'back'));
  const midImg = picture(worldArt(n, 'mid'));
  if (backImg) tile(c, backImg, v, o.reduced ? 0 : view.camX * v.s * 0.15);
  else back(p);
  if (midImg) tile(c, midImg, v, o.reduced ? 0 : view.camX * v.s * 0.4);
  else mid(p);
  // calm the back layers so the walls stand out
  c.fillStyle = n === 9 || n === 10 || n === 6 ? 'rgba(10,10,40,0.12)' : 'rgba(255,255,255,0.14)';
  c.fillRect(-20, -20, v.w + 40, v.h + 40);

  // ground
  const gy = sy(v, 0);
  c.fillStyle = world.ground;
  c.fillRect(-20, gy, v.w + 40, v.h);
  if (n === 4) {
    const t = v.s * 0.9;
    const off = (view.camX * v.s) % (t * 2);
    for (let x = -off - t * 2; x < v.w; x += t) {
      c.fillStyle = Math.round((x + off) / t) % 2 ? '#2b2b2b' : '#f3ead0';
      c.fillRect(x, gy, t, v.h);
    }
  }
  c.fillStyle = world.groundTop;
  c.fillRect(-20, gy, v.w + 40, Math.max(4, v.s * 0.14));

  // zones sit behind the walls
  course.zones.forEach((z, i) => drawZone(p, z, st.t, i));

  course.perches.forEach((pe, i) => {
    if (sx(v, pe.x) > -80 && sx(v, pe.x) < v.w + 80) drawPerch(p, pe.x, pe.y, st.perches > i);
  });
  if (sx(v, course.nestX) < v.w + 100) drawNest(p, course.nestX);

  // guide path for the first go
  if (o.ghostPath && st.mode !== 'done') {
    const pts = course.walls.slice(0, 3).filter((w) => w.x + WALL_WIDTH / 2 > st.x).map((w) => [w.x + WALL_WIDTH / 2, w.gaps[0].y] as const);
    if (pts.length) {
      c.save();
      c.setLineDash([v.s * 0.18, v.s * 0.3]);
      c.lineCap = 'round';
      c.lineWidth = Math.max(3, v.s * 0.1);
      c.strokeStyle = 'rgba(255,255,255,0.95)';
      c.beginPath();
      c.moveTo(sx(v, Math.max(st.x, START_X)), sy(v, st.x <= START_X + 0.01 ? START_Y : st.y));
      let px = sx(v, st.x);
      let py = sy(v, st.y);
      for (const [wx, wy] of pts) {
        const nx = sx(v, wx);
        const ny = sy(v, wy);
        c.bezierCurveTo(px + (nx - px) * 0.5, py, px + (nx - px) * 0.5, ny, nx, ny);
        px = nx;
        py = ny;
      }
      c.stroke();
      c.restore();
    }
  }

  // walls
  for (const wall of course.walls) {
    const x = sx(v, wall.x);
    if (x > v.w + 40 || x + WALL_WIDTH * v.s < -40) continue;
    drawWall(p, wall, st.t);
    if (wall.answer !== undefined) drawGapMarks(p, wall, o.labels ? o.labels[wall.answer] : null, st.t);
  }

  // ceiling
  c.fillStyle = world.skyTop;
  c.fillRect(-20, -20, v.w + 40, sy(v, SKY) + 20);
  c.fillStyle = world.ink;
  c.globalAlpha = 0.5;
  c.fillRect(-20, sy(v, SKY) - 2, v.w + 40, 3);
  c.globalAlpha = 1;

  // trail, then the flyer
  if (o.trail) drawTrail(c, o.trail, o.particles, (x) => sx(v, x), (y) => sy(v, y), v.s, o.time);
  const bx = sx(v, st.x);
  const by = sy(v, st.y);
  const size = BIRD_SIZE * v.s * BIRD_LOOK;
  c.save();
  c.translate(bx, by);
  c.rotate(Math.max(-0.5, Math.min(0.6, -st.vy * 0.06)) * (st.mode === 'hover' ? 0 : 1));
  drawFlyer(c, o.flyer, 0, 0, size, o.pose, o.shiny, o.reduced ? 0 : o.time);
  c.restore();
  c.restore();
  return view;
}

function tile(c: Ctx, img: HTMLImageElement, v: View, off: number) {
  const w = img.naturalWidth * (v.h / img.naturalHeight);
  for (let x = -(off % w) - w; x < v.w; x += w) c.drawImage(img, x, 0, w + 1, v.h);
}

/** The numbers (or arrows) in an answer wall's gaps. */
function drawGapMarks(p: P, wall: Wall, labels: number[] | null, t: number) {
  const { c, v } = p;
  const gaps = gapsAt(wall, t);
  const x = sx(v, wall.x);
  const w = WALL_WIDTH * v.s;
  gaps.forEach((g, i) => {
    const cy = sy(v, g.y);
    if (labels) {
      const text = String(labels[i] ?? '');
      const fs = Math.max(15, Math.min(v.s * 0.62, 44));
      c.font = `900 ${fs}px system-ui, "Segoe UI", sans-serif`;
      const bw = Math.max(w * 0.98, c.measureText(text).width + fs * 0.7);
      rr(c, x + w / 2 - bw / 2, cy - fs * 0.7, bw, fs * 1.4, fs * 0.5);
      paint(c, '#fffbe6', '#1a1a2a', Math.max(2, fs * 0.09));
      c.fillStyle = '#1a1a2a';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(text, x + w / 2, cy + fs * 0.04);
    } else {
      const a = Math.min(w * 0.4, v.s * 0.45);
      poly(c, [x + w / 2 - a, cy - a * 0.5, x + w / 2, cy - a * 0.5, x + w / 2, cy - a, x + w / 2 + a, cy, x + w / 2, cy + a, x + w / 2, cy + a * 0.5, x + w / 2 - a, cy + a * 0.5]);
      paint(c, '#fffbe6', '#1a1a2a', 2.5);
    }
  });
}

/* ---------- flyers ---------- */

function eyeDot(c: Ctx, x: number, y: number, r: number, look = 0.25) {
  circ(c, x, y, r);
  paint(c, '#fff', '#222', 0.045);
  circ(c, x + r * look, y, r * 0.5);
  c.fillStyle = '#111';
  c.fill();
}

function wingAngle(pose: FlyerPose, time: number) {
  if (pose === 'up') return -0.9 + Math.sin(time * 18) * 0.25;
  if (pose === 'dizzy') return 0.5;
  if (pose === 'perched') return 0.35;
  return Math.sin(time * 9) * 0.45;
}

function fantail(c: Ctx, rainbow: boolean, pose: FlyerPose, time: number) {
  const cols = rainbow ? ['#ef476f', '#f78c2a', '#ffd166', '#06d6a0', '#118ab2'] : ['#3b3a4a', '#55546a', '#3b3a4a', '#55546a', '#3b3a4a'];
  const spread = pose === 'up' ? 0.34 : 0.26;
  for (let k = 0; k < 5; k++) {
    const a = Math.PI + (k - 2) * spread;
    ell(c, -0.3 + Math.cos(a) * 0.4, 0.1 + Math.sin(a) * 0.4, 0.42, 0.13, a);
    paint(c, cols[k], '#222', 0.045);
    if (!rainbow) {
      ell(c, -0.3 + Math.cos(a) * 0.72, 0.1 + Math.sin(a) * 0.72, 0.1, 0.09, a);
      c.fillStyle = '#fff';
      c.fill();
    }
  }
  ell(c, 0.05, 0.1, 0.52, 0.38);
  paint(c, rainbow ? '#ffd166' : '#6b5a4a', '#222', 0.06);
  ell(c, 0.18, 0.24, 0.34, 0.17);
  paint(c, '#f6e7c8');
  circ(c, 0.5, -0.14, 0.27);
  paint(c, rainbow ? '#06d6a0' : '#4a4036', '#222', 0.06);
  c.beginPath();
  c.arc(0.46, -0.3, 0.2, Math.PI * 1.05, Math.PI * 1.65);
  c.lineWidth = 0.07;
  c.strokeStyle = '#fff';
  c.stroke();
  poly(c, [0.72, -0.2, 0.98, -0.1, 0.72, -0.04]);
  paint(c, '#ff9f1c', '#222', 0.04);
  eyeDot(c, 0.56, -0.17, 0.09);
  c.save();
  c.translate(-0.05, 0.02);
  c.rotate(wingAngle(pose, time));
  ell(c, -0.15, 0, 0.38, 0.17);
  paint(c, rainbow ? '#ef476f' : '#8a7868', '#222', 0.05);
  c.restore();
}

function puppyPlane(c: Ctx, pose: FlyerPose, time: number) {
  poly(c, [-0.95, -0.15, 0.95, 0.15, -0.55, 0.5]);
  paint(c, '#ffffff', '#445', 0.05);
  poly(c, [-0.95, -0.15, 0.95, 0.15, -0.3, 0.12]);
  paint(c, '#dfe8f5', '#445', 0.04);
  ell(c, -0.2, -0.05, 0.3, 0.25);
  paint(c, '#d9a066', '#222', 0.05);
  const flop = Math.sin(time * 9) * 0.1 + (pose === 'up' ? -0.3 : 0);
  ell(c, 0.02, -0.6, 0.13, 0.26, 0.3 + flop);
  paint(c, '#8a5a2e', '#222', 0.045);
  circ(c, 0.15, -0.38, 0.3);
  paint(c, '#d9a066', '#222', 0.05);
  ell(c, 0.4, -0.3, 0.2, 0.15);
  paint(c, '#f1d3a8', '#222', 0.04);
  circ(c, 0.55, -0.35, 0.06);
  c.fillStyle = '#111';
  c.fill();
  eyeDot(c, 0.24, -0.5, 0.075);
  ell(c, 0.4, -0.16, 0.07, 0.06);
  c.fillStyle = '#ff6f91';
  c.fill();
}

function rocketCarrot(c: Ctx, pose: FlyerPose, time: number) {
  for (let k = -1; k <= 1; k++) {
    ell(c, -0.85, 0.1 + k * 0.17, 0.2, 0.08, k * 0.45 + Math.sin(time * 10 + k) * 0.1);
    paint(c, '#3fae49', '#222', 0.04);
  }
  poly(c, [-0.7, -0.2, 0.95, 0.15, -0.7, 0.45]);
  paint(c, '#f28c28', '#222', 0.06);
  c.strokeStyle = '#c45f12';
  c.lineWidth = 0.05;
  for (const x of [-0.3, 0.1, 0.5]) {
    c.beginPath();
    c.moveTo(x, 0.12 + (x + 0.7) * 0.02);
    c.lineTo(x + 0.1, 0.28);
    c.stroke();
  }
  // the rabbit
  for (const dx of [-0.08, 0.1]) {
    ell(c, -0.05 + dx, -0.78, 0.07, 0.22, dx * 1.5);
    paint(c, '#f1ece6', '#222', 0.04);
  }
  circ(c, 0, -0.42, 0.26);
  paint(c, '#f1ece6', '#222', 0.05);
  eyeDot(c, 0.1, -0.46, 0.07);
  circ(c, 0.22, -0.38, 0.045);
  c.fillStyle = '#ff6f91';
  c.fill();
  ell(c, -0.12, -0.05, 0.22, 0.14);
  paint(c, '#f1ece6', '#222', 0.045);
  void pose;
}

function bathtub(c: Ctx, pose: FlyerPose, time: number) {
  const bob = Math.sin(time * 6) * 0.03;
  // fish in goggles
  ell(c, 0.05, -0.32 + bob, 0.3, 0.2);
  paint(c, '#ff8c42', '#222', 0.05);
  poly(c, [-0.2, -0.32 + bob, -0.45, -0.5 + bob, -0.45, -0.14 + bob]);
  paint(c, '#ff8c42', '#222', 0.045);
  circ(c, 0.15, -0.36 + bob, 0.1);
  paint(c, '#bfefff', '#2b6a8a', 0.05);
  circ(c, 0.15, -0.36 + bob, 0.04);
  c.fillStyle = '#111';
  c.fill();
  // bubbles
  for (let i = 0; i < 3; i++) {
    circ(c, -0.5 + i * 0.5, -0.72 + Math.sin(time * 4 + i) * 0.04, 0.1 - i * 0.015);
    paint(c, 'rgba(220,245,255,0.8)', '#5aa7c9', 0.03);
  }
  // the tub
  c.beginPath();
  c.moveTo(-0.85, -0.05);
  c.lineTo(0.85, -0.05);
  c.lineTo(0.7, 0.45);
  c.quadraticCurveTo(0.65, 0.6, 0.5, 0.6);
  c.lineTo(-0.5, 0.6);
  c.quadraticCurveTo(-0.65, 0.6, -0.7, 0.45);
  c.closePath();
  paint(c, '#f4f7fb', '#334', 0.06);
  rr(c, -0.92, -0.12, 1.84, 0.16, 0.08);
  paint(c, '#ffffff', '#334', 0.05);
  for (const x of [-0.55, 0.55]) {
    circ(c, x, 0.68, 0.1);
    paint(c, '#ffd23f', '#334', 0.04);
  }
  void pose;
}

function mouseTrap(c: Ctx, pose: FlyerPose, time: number) {
  rr(c, -0.85, 0.12, 1.7, 0.5, 0.08);
  paint(c, '#d9a35c', '#4a2c10', 0.06);
  c.strokeStyle = '#a8742f';
  c.lineWidth = 0.04;
  for (const x of [-0.45, 0, 0.45]) {
    c.beginPath();
    c.moveTo(x, 0.16);
    c.lineTo(x, 0.58);
    c.stroke();
  }
  c.strokeStyle = '#9aa4ad';
  c.lineWidth = 0.07;
  c.beginPath();
  c.moveTo(-0.65, 0.4);
  c.lineTo(-0.65, 0.05);
  c.lineTo(0.5, 0.05);
  c.lineTo(0.5, 0.4);
  c.stroke();
  // tail
  c.strokeStyle = '#ff9fb0';
  c.lineWidth = 0.06;
  c.beginPath();
  c.moveTo(-0.45, -0.05);
  c.quadraticCurveTo(-0.85, -0.2 + Math.sin(time * 8) * 0.1, -0.9, -0.55);
  c.stroke();
  ell(c, -0.1, -0.18, 0.45, 0.3);
  paint(c, '#9aa2ad', '#222', 0.06);
  circ(c, 0.35, -0.3, 0.26);
  paint(c, '#9aa2ad', '#222', 0.06);
  for (const dx of [-0.05, 0.2]) {
    circ(c, 0.15 + dx, -0.58, 0.14);
    paint(c, '#ffb3c1', '#222', 0.045);
  }
  circ(c, 0.58, -0.28, 0.06);
  c.fillStyle = '#ff6f91';
  c.fill();
  eyeDot(c, 0.42, -0.36, 0.075);
  void pose;
}

function donutCruiser(c: Ctx, pose: FlyerPose, time: number) {
  c.beginPath();
  c.arc(0, 0.22, 0.74, 0, TAU);
  c.moveTo(0.24, 0.22);
  c.arc(0, 0.22, 0.24, 0, TAU, true);
  c.fillStyle = '#ff8fb8';
  c.fill('evenodd');
  c.lineWidth = 0.06;
  c.strokeStyle = '#7a3350';
  c.stroke();
  circ(c, 0, 0.22, 0.24);
  c.lineWidth = 0.045;
  c.stroke();
  const cols = ['#fff', '#ffe45e', '#5ec8ff', '#7be37b', '#b88bff'];
  for (let i = 0; i < 12; i++) {
    const a = i * 2.4;
    const r = 0.4 + (i % 3) * 0.12;
    c.save();
    c.translate(Math.cos(a) * r, 0.22 + Math.sin(a) * r);
    c.rotate(i);
    c.fillStyle = cols[i % 5];
    c.fillRect(-0.07, -0.025, 0.14, 0.05);
    c.restore();
  }
  // a cheerful man in a blue cap
  ell(c, 0, -0.38, 0.2, 0.24);
  paint(c, '#2f80ed', '#222', 0.045);
  circ(c, 0.02, -0.7, 0.2);
  paint(c, '#f1c9a0', '#222', 0.05);
  c.beginPath();
  c.arc(0.02, -0.74, 0.21, Math.PI, 0);
  paint(c, '#1f6fd0', '#222', 0.05);
  rr(c, 0.1, -0.78, 0.26, 0.07, 0.03);
  paint(c, '#1f6fd0', '#222', 0.04);
  eyeDot(c, 0.08, -0.66, 0.05);
  c.beginPath();
  c.arc(0.05, -0.62, 0.08, 0.2, Math.PI - 0.2);
  c.lineWidth = 0.035;
  c.strokeStyle = '#222';
  c.stroke();
  void pose;
  void time;
}

function miniVan(c: Ctx, pose: FlyerPose, time: number) {
  const flap = Math.sin(time * 14) * 0.25 + (pose === 'up' ? -0.4 : 0);
  for (const dx of [-0.25, 0.1]) {
    c.save();
    c.translate(dx, -0.2);
    c.rotate(-0.5 + flap);
    ell(c, 0, -0.28, 0.14, 0.34);
    paint(c, '#fff4d6', '#222', 0.045);
    c.restore();
  }
  rr(c, -0.9, -0.2, 1.8, 0.72, 0.18);
  paint(c, '#f28c38', '#222', 0.06);
  rr(c, -0.65, -0.22, 1.15, 0.28, 0.12);
  paint(c, '#fff4d6', '#222', 0.04);
  rr(c, -0.55, -0.15, 0.45, 0.2, 0.05);
  paint(c, '#bfe6ff', '#222', 0.035);
  rr(c, 0.0, -0.15, 0.42, 0.2, 0.05);
  paint(c, '#bfe6ff', '#222', 0.035);
  circ(c, 0.82, 0.18, 0.07);
  paint(c, '#ffe45e', '#222', 0.03);
  for (const x of [-0.5, 0.5]) {
    circ(c, x, 0.55, 0.21);
    paint(c, '#2a2a33', '#111', 0.03);
    circ(c, x, 0.55, 0.09);
    c.fillStyle = '#fff4d6';
    c.fill();
  }
}

function toiletRocket(c: Ctx, pose: FlyerPose, time: number) {
  const f = 0.8 + Math.sin(time * 22) * 0.2;
  poly(c, [-0.75, 0.2, -0.75 - 0.45 * f, 0.35, -0.75, 0.5]);
  paint(c, '#ff9f1c', '#222', 0.04);
  poly(c, [-0.75, 0.28, -0.75 - 0.25 * f, 0.35, -0.75, 0.42]);
  paint(c, '#ffe45e');
  rr(c, -0.78, -0.45, 0.42, 0.7, 0.07);
  paint(c, '#f4f7fb', '#334', 0.06);
  ell(c, 0.1, 0.12, 0.62, 0.3);
  paint(c, '#ffffff', '#334', 0.06);
  c.beginPath();
  c.moveTo(-0.15, 0.3);
  c.lineTo(0.0, 0.62);
  c.lineTo(0.35, 0.62);
  c.lineTo(0.4, 0.38);
  paint(c, '#e6ecf3', '#334', 0.05);
  // a little round boy
  circ(c, 0.1, -0.12, 0.3);
  paint(c, '#d8452f', '#222', 0.05);
  circ(c, 0.1, -0.5, 0.24);
  paint(c, '#f1c9a0', '#222', 0.05);
  c.beginPath();
  c.arc(0.1, -0.56, 0.25, Math.PI, 0);
  paint(c, '#2f9e5a', '#222', 0.05);
  circ(c, 0.1, -0.84, 0.07);
  paint(c, '#ffe45e', '#222', 0.04);
  eyeDot(c, 0.18, -0.5, 0.055);
  c.beginPath();
  c.arc(0.14, -0.43, 0.07, 0.2, Math.PI - 0.2);
  c.lineWidth = 0.035;
  c.strokeStyle = '#222';
  c.stroke();
  void pose;
}

function lavaLizard(c: Ctx, pose: FlyerPose, time: number) {
  const g = 0.18 + Math.sin(time * 5) * 0.06;
  circ(c, 0, 0.3, 0.8);
  c.fillStyle = `rgba(255,170,60,${g})`;
  c.fill();
  poly(c, [-0.85, 0.5, -0.7, 0.1, -0.2, 0.0, 0.4, 0.05, 0.85, 0.2, 0.8, 0.55, 0.2, 0.7, -0.5, 0.65]);
  paint(c, '#5a4a45', '#222', 0.06);
  c.strokeStyle = '#ffb347';
  c.lineWidth = 0.06;
  c.beginPath();
  c.moveTo(-0.4, 0.15);
  c.lineTo(-0.15, 0.4);
  c.lineTo(0.1, 0.3);
  c.lineTo(0.3, 0.55);
  c.moveTo(0.55, 0.15);
  c.lineTo(0.5, 0.35);
  c.stroke();
  c.strokeStyle = '#e8532b';
  c.lineWidth = 0.15;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-0.3, -0.12);
  c.quadraticCurveTo(-0.7, -0.05, -0.9, -0.5 + Math.sin(time * 7) * 0.1);
  c.stroke();
  ell(c, 0.05, -0.2, 0.5, 0.2);
  paint(c, '#e8532b', '#222', 0.055);
  ell(c, 0.5, -0.3, 0.25, 0.17, -0.1);
  paint(c, '#e8532b', '#222', 0.055);
  for (let i = 0; i < 4; i++) {
    poly(c, [-0.3 + i * 0.22, -0.34 - i * 0.01, -0.2 + i * 0.22, -0.52, -0.1 + i * 0.22, -0.36]);
    paint(c, '#ffd166', '#222', 0.03);
  }
  eyeDot(c, 0.55, -0.35, 0.07);
  void pose;
}

function jetBot(c: Ctx, pose: FlyerPose, time: number) {
  const f = 0.75 + Math.sin(time * 24) * 0.25;
  poly(c, [-0.62, 0.2, -0.62 - 0.2, 0.45 + 0.35 * f, -0.4, 0.2]);
  paint(c, '#ff9f1c', '#222', 0.04);
  rr(c, -0.7, -0.4, 0.3, 0.6, 0.1);
  paint(c, '#e0592a', '#222', 0.05);
  rr(c, -0.4, -0.25, 0.85, 0.7, 0.14);
  paint(c, '#9fb4c7', '#222', 0.06);
  rr(c, -0.25, -0.75, 0.6, 0.45, 0.14);
  paint(c, '#b7c8d8', '#222', 0.06);
  rr(c, -0.12, -0.65, 0.5, 0.22, 0.08);
  paint(c, '#3ee0ff', '#222', 0.04);
  circ(c, 0.08, -0.54, 0.04);
  c.fillStyle = '#fff';
  c.fill();
  circ(c, 0.26, -0.54, 0.04);
  c.fill();
  c.strokeStyle = '#222';
  c.lineWidth = 0.04;
  c.beginPath();
  c.moveTo(0.05, -0.75);
  c.lineTo(0.05, -0.92);
  c.stroke();
  circ(c, 0.05, -0.94, 0.06);
  paint(c, '#ff3e9a', '#222', 0.03);
  circ(c, 0.1, 0.1, 0.1);
  paint(c, '#ffd84a', '#222', 0.04);
  rr(c, 0.4, -0.05, 0.4, 0.14, 0.07);
  paint(c, '#9fb4c7', '#222', 0.045);
  void pose;
}

function saucerKid(c: Ctx, pose: FlyerPose, time: number) {
  circ(c, 0, -0.1, 0.5);
  paint(c, 'rgba(190,240,255,0.55)', '#4a7a99', 0.05);
  circ(c, 0.02, -0.15, 0.3);
  paint(c, '#8be28b', '#222', 0.05);
  for (const dx of [-0.12, 0.14]) {
    ell(c, dx, -0.2, 0.08, 0.12, dx > 0 ? -0.4 : 0.4);
    c.fillStyle = '#111';
    c.fill();
  }
  c.strokeStyle = '#6ac96a';
  c.lineWidth = 0.04;
  for (const dx of [-0.13, 0.13]) {
    c.beginPath();
    c.moveTo(dx, -0.4);
    c.lineTo(dx * 1.6, -0.7);
    c.stroke();
    circ(c, dx * 1.6, -0.72, 0.06);
    c.fillStyle = '#ffe45e';
    c.fill();
  }
  c.beginPath();
  c.arc(0.02, -0.08, 0.08, 0.2, Math.PI - 0.2);
  c.lineWidth = 0.035;
  c.strokeStyle = '#222';
  c.stroke();
  ell(c, 0, 0.3, 0.92, 0.28);
  paint(c, '#c9d3e0', '#222', 0.06);
  ell(c, 0, 0.4, 0.7, 0.12);
  paint(c, '#9aa7b8');
  for (let i = 0; i < 5; i++) {
    circ(c, -0.6 + i * 0.3, 0.32, 0.055);
    c.fillStyle = (Math.floor(time * 4) + i) % 2 ? '#ffe45e' : '#ff6f91';
    c.fill();
  }
  void pose;
}

/**
 * Draws one flyer centred on (x, y), fitting a square `size` wide (the hit box). Facing right. Tilt the context before calling.
 * Pose and time make it flap; `shiny` adds a gold edge and sparkles. A painted picture (art/art.ts) replaces the stand-in.
 */
export function drawFlyer(c: Ctx, flyerId: string, x: number, y: number, size: number, pose: FlyerPose, shiny: boolean, time: number): void {
  c.save();
  c.translate(x, y);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  const u = size / 2;
  if (shiny) {
    c.beginPath();
    c.arc(0, 0, u * 1.15, 0, TAU);
    c.fillStyle = 'rgba(255,214,64,0.28)';
    c.fill();
    c.lineWidth = Math.max(2, u * 0.12);
    c.strokeStyle = '#ffd23f';
    c.stroke();
  }
  const img = picture(flyerArt(flyerId, pose));
  if (img) {
    c.drawImage(img, -u, -u, size, size);
  } else {
    c.scale(u, u);
    switch (flyerId) {
      case 'puppy-plane': puppyPlane(c, pose, time); break;
      case 'rocket-carrot': rocketCarrot(c, pose, time); break;
      case 'bathtub-boat': bathtub(c, pose, time); break;
      case 'mousetrap-glider': mouseTrap(c, pose, time); break;
      case 'donut-cruiser': donutCruiser(c, pose, time); break;
      case 'mini-van': miniVan(c, pose, time); break;
      case 'toilet-rocket': toiletRocket(c, pose, time); break;
      case 'lava-lizard': lavaLizard(c, pose, time); break;
      case 'jet-bot': jetBot(c, pose, time); break;
      case 'saucer-kid': saucerKid(c, pose, time); break;
      case 'rainbow': fantail(c, true, pose, time); break;
      default: fantail(c, false, pose, time);
    }
    c.scale(1 / u, 1 / u);
  }
  if (pose === 'dizzy') {
    c.fillStyle = '#ffd23f';
    for (let i = 0; i < 3; i++) {
      const a = time * 6 + (i * TAU) / 3;
      star(c, Math.cos(a) * u * 0.7, -u * 1.0 + Math.sin(a) * u * 0.18, u * 0.2, 5, 0.5);
      c.fill();
    }
  }
  if (shiny) {
    c.fillStyle = '#fff6b0';
    for (let i = 0; i < 3; i++) {
      const k = (time * 1.2 + i / 3) % 1;
      const a = i * 2.1 + 0.5;
      star(c, Math.cos(a) * u * 1.1, Math.sin(a) * u * 1.1, u * 0.3 * Math.sin(k * Math.PI), 4, 0.3);
      c.fill();
    }
  }
  c.restore();
}

/* ---------- trails ---------- */

/** Adds and ages the particles behind the flyer. `moving` is false while the bird hovers. */
export function stepTrail(list: TrailParticle[], birdX: number, birdY: number, dt: number, moving: boolean): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const q = list[i];
    q.age += dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    if (q.age >= q.life) list.splice(i, 1);
  }
  if (moving && list.length < 40) {
    const last = list[list.length - 1];
    if (!last || last.age > 0.07 || Math.abs(last.x - birdX) > 0.35) {
      list.push({ x: birdX - 0.35, y: birdY + (Math.random() - 0.5) * 0.3, vx: -0.4, vy: (Math.random() - 0.5) * 0.8, age: 0, life: 0.9 + Math.random() * 0.4, k: Math.random() });
    }
  }
}

function drawParticle(c: Ctx, id: string, x: number, y: number, r: number, k: number, time: number) {
  c.save();
  c.translate(x, y);
  c.lineJoin = 'round';
  c.rotate(k * 6 + time * (k > 0.5 ? 1 : -1));
  switch (id) {
    case 'flowers':
      for (let i = 0; i < 5; i++) {
        ell(c, Math.cos((i * TAU) / 5) * r * 0.5, Math.sin((i * TAU) / 5) * r * 0.5, r * 0.4, r * 0.25, (i * TAU) / 5);
        c.fillStyle = k > 0.5 ? '#ff7fc8' : '#ffffff';
        c.fill();
      }
      circ(c, 0, 0, r * 0.25);
      paint(c, '#ffd23f');
      break;
    case 'cookies':
      circ(c, 0, 0, r * 0.9);
      paint(c, '#c98a4b', '#7a4a1c', 1.5);
      c.fillStyle = '#4a2a14';
      for (const [a, b] of [[-0.3, -0.2], [0.3, 0.1], [-0.1, 0.4], [0.2, -0.4]]) c.fillRect(a * r, b * r, r * 0.22, r * 0.22);
      break;
    case 'donut-crumbs':
      poly(c, [-r * 0.5, -r * 0.2, r * 0.1, -r * 0.5, r * 0.5, r * 0.1, -r * 0.1, r * 0.4]);
      paint(c, k > 0.5 ? '#ff8fb8' : '#e9c28f');
      c.fillStyle = ['#5ec8ff', '#ffe45e', '#7be37b'][Math.floor(k * 3)];
      c.fillRect(r * 0.2, -r * 0.7, r * 0.5, r * 0.18);
      break;
    case 'pineapples':
      ell(c, 0, r * 0.15, r * 0.5, r * 0.65);
      paint(c, '#ffd23f', '#a8741a', 1.5);
      c.strokeStyle = '#d99a1a';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(-r * 0.4, -r * 0.2);
      c.lineTo(r * 0.4, r * 0.6);
      c.moveTo(r * 0.4, -r * 0.2);
      c.lineTo(-r * 0.4, r * 0.6);
      c.stroke();
      poly(c, [-r * 0.3, -r * 0.4, 0, -r * 1.0, r * 0.3, -r * 0.4]);
      paint(c, '#3fae49');
      break;
    case 'cheese':
      poly(c, [-r * 0.7, r * 0.4, r * 0.7, r * 0.4, r * 0.7, -r * 0.1, -r * 0.7, -r * 0.5]);
      paint(c, '#F2C744', '#a8801a', 1.5);
      c.fillStyle = '#d9a82a';
      circ(c, -r * 0.2, 0, r * 0.14);
      c.fill();
      circ(c, r * 0.3, r * 0.15, r * 0.1);
      c.fill();
      break;
    case 'mouse-tail':
      c.strokeStyle = '#ff9fb0';
      c.lineWidth = Math.max(2, r * 0.3);
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(-r, 0);
      c.quadraticCurveTo(-r * 0.4, -r * 0.8, 0, 0);
      c.quadraticCurveTo(r * 0.4, r * 0.8, r, 0);
      c.stroke();
      break;
    default:
      star(c, 0, 0, r * 0.9, 5, 0.45);
      paint(c, `hsl(${Math.floor((k * 360 + time * 120) % 360)} 95% 60%)`, '#fff', 1);
  }
  c.restore();
}

/** The trail behind the flyer: small pictures that drift back and fade. A painted picture (art/art.ts) is used when there is one. */
export function drawTrail(c: Ctx, id: string, parts: readonly TrailParticle[], toX: (x: number) => number, toY: (y: number) => number, s: number, time: number): void {
  const img = picture(trailArt(id));
  for (const q of parts) {
    const f = q.age / q.life;
    c.globalAlpha = Math.max(0, 1 - f);
    const r = s * 0.2 * (1 - f * 0.4);
    if (img) c.drawImage(img, toX(q.x) - r, toY(q.y) - r, r * 2, r * 2);
    else drawParticle(c, id, toX(q.x), toY(q.y), r, q.k, time);
  }
  c.globalAlpha = 1;
}

/** A few trail pieces in a row, for the Hangar. */
export function drawTrailSwatch(c: Ctx, id: string, w: number, h: number, time: number): void {
  const img = picture(trailArt(id));
  for (let i = 0; i < 4; i++) {
    const r = h * (0.2 - i * 0.025);
    const x = w * (0.85 - i * 0.22);
    const y = h / 2 + Math.sin(i * 1.7 + time) * h * 0.12;
    c.globalAlpha = 1 - i * 0.2;
    if (img) c.drawImage(img, x - r, y - r, r * 2, r * 2);
    else drawParticle(c, id, x, y, r, (i * 0.37) % 1, time);
  }
  c.globalAlpha = 1;
}
