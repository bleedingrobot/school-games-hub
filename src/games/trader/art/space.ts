/**
 * The sky: a nebula tinted for the planet you are at, and three layers of stars that drift at different speeds.
 * Each is drawn once to an off-screen canvas and shown as a picture (the stars wrap round).
 */
import { TAU, clamp, makeCanvas, rgba, rng } from './util';

export interface Sky {
  /** The nebula, as wide and tall as the screen. */
  nebula: HTMLCanvasElement;
  /** Star layers, far to near. Each is a tile that wraps. */
  layers: { tile: HTMLCanvasElement; speed: number }[];
}

export interface NebulaPalette {
  deep: string;
  glowA: string;
  glowB: string;
}

export const NEBULAE: NebulaPalette[] = [
  { deep: '#070b1d', glowA: '#4c1d95', glowB: '#0e7490' },
  { deep: '#08101c', glowA: '#9d174d', glowB: '#1d4ed8' },
  { deep: '#06130f', glowA: '#047857', glowB: '#1e40af' },
  { deep: '#120a1c', glowA: '#a21caf', glowB: '#b45309' },
  { deep: '#0a0f1f', glowA: '#0369a1', glowB: '#6d28d9' },
  { deep: '#14090c', glowA: '#b91c1c', glowB: '#6d28d9' },
];

export function makeNebula(w: number, h: number, palette: NebulaPalette, seed: number, simple: boolean): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  if (!g) return c;
  const r = rng(seed);
  g.fillStyle = palette.deep;
  g.fillRect(0, 0, w, h);
  const blobs = simple ? 5 : 14;
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < blobs; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = (0.25 + r() * 0.45) * Math.max(w, h);
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, rgba(i % 2 ? palette.glowA : palette.glowB, 0.1 + r() * 0.1));
    grad.addColorStop(0.5, rgba(i % 2 ? palette.glowA : palette.glowB, 0.04));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  }
  // Wispy dust lanes.
  if (!simple) {
    g.globalAlpha = 0.035;
    for (let i = 0; i < 40; i++) {
      const x = r() * w;
      const y = r() * h;
      const grad = g.createRadialGradient(x, y, 0, x, y, 40 + r() * 120);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(x, y, 60 + r() * 140, 8 + r() * 24, r() * TAU, 0, TAU);
      g.fill();
    }
  }
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  return c;
}

function starTile(w: number, h: number, count: number, size: number, seed: number): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  if (!g) return c;
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const x = r() * w;
    const y = r() * h;
    const bright = 0.4 + r() * 0.6;
    const warm = r();
    const colour = warm < 0.15 ? '#ffd9a8' : warm < 0.3 ? '#b5d5ff' : '#ffffff';
    const s = size * (0.6 + r() * 0.9);
    g.fillStyle = rgba(colour, bright);
    g.beginPath();
    g.arc(x, y, s, 0, TAU);
    g.fill();
    if (s > size * 1.2 && size > 1) {
      // A bigger star gets a soft glow and a little cross.
      const grad = g.createRadialGradient(x, y, 0, x, y, s * 5);
      grad.addColorStop(0, rgba(colour, 0.35));
      grad.addColorStop(1, rgba(colour, 0));
      g.fillStyle = grad;
      g.fillRect(x - s * 5, y - s * 5, s * 10, s * 10);
      g.strokeStyle = rgba(colour, 0.5);
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(x - s * 3, y);
      g.lineTo(x + s * 3, y);
      g.moveTo(x, y - s * 3);
      g.lineTo(x, y + s * 3);
      g.stroke();
    }
  }
  return c;
}

export function makeSky(w: number, h: number, palette: NebulaPalette, seed: number, simple: boolean): Sky {
  const area = (w * h) / 100_000;
  const layers = [
    { tile: starTile(w, h, Math.round(area * (simple ? 28 : 55)), 0.7, seed + 1), speed: 0.15 },
    { tile: starTile(w, h, Math.round(area * (simple ? 12 : 26)), 1.1, seed + 2), speed: 0.4 },
  ];
  if (!simple) layers.push({ tile: starTile(w, h, Math.round(area * 9), 1.7, seed + 3), speed: 0.9 });
  return { nebula: makeNebula(w, h, palette, seed, simple), layers };
}

/** Paint the sky. `scroll` shifts the star layers sideways (the ship flying); `t` makes the stars twinkle. */
export function drawSky(g: CanvasRenderingContext2D, sky: Sky, w: number, h: number, scroll: number, t: number, twinkle: boolean): void {
  g.drawImage(sky.nebula, 0, 0, w, h);
  for (const [i, layer] of sky.layers.entries()) {
    const x = ((scroll * layer.speed) % w + w) % w;
    const tw = twinkle ? clamp(0.82 + 0.18 * Math.sin(t * (1.1 + i * 0.7) + i), 0.5, 1) : 1;
    g.globalAlpha = tw;
    g.drawImage(layer.tile, x - w, 0, w, h);
    g.drawImage(layer.tile, x, 0, w, h);
  }
  g.globalAlpha = 1;
}
