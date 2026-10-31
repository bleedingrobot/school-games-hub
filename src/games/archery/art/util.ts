/**
 * Small drawing helpers shared by the Archery Challenge fight art (all drawn in code, no images).
 * Everything here is only for the picture: nothing feeds back into the rules.
 */

export const TAU = Math.PI * 2;
export const D2R = Math.PI / 180;
/** The cartoon outline colour used everywhere. */
export const OL = '#2a1c14';
/** Chunky display font for cartoon words and numbers (falls back to what the device has). */
export const FONT_DISPLAY = "'Baloo 2', 'Arial Rounded MT Bold', 'Trebuchet MS', Verdana, sans-serif";

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) * (-2 * t + 2)) / 2);
export const outBack = (t: number) => {
  const c = 1.9;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};

/** A small seeded random number maker (for the picture only). Gives 0 ≤ n < 1. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A repeatable 0–1 number for a spot (so redrawing part of the land gives the same details). */
export function hash2(x: number, y: number, salt = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(salt | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** A fresh off-screen canvas, at least 1 × 1. */
export function mk(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  return c.getContext('2d') as CanvasRenderingContext2D;
}

export function rr(g: CanvasRenderingContext2D | Path2D, x: number, y: number, w: number, h: number, r: number) {
  if (g instanceof CanvasRenderingContext2D) g.beginPath();
  r = Math.min(r, w / 2, h / 2);
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function starPath(g: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
    const q = i % 2 ? r * 0.5 : r;
    g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
  }
  g.closePath();
}

export function drawStar(g: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, alpha = 1) {
  g.globalAlpha = alpha;
  starPath(g, x, y, r, rot);
  g.fillStyle = '#ffd93d';
  g.fill();
  g.lineWidth = Math.max(0.8, r * 0.22);
  g.strokeStyle = '#b85c00';
  g.lineJoin = 'round';
  g.stroke();
  g.globalAlpha = 1;
}

/** "#rrggbb" plus an alpha, as an rgba() string. */
export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Mixes two "#rrggbb" colours. */
export function mix(a: string, b: string, t: number): string {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(lerp((x >> s) & 255, (y >> s) & 255, t));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
