/** Small textures drawn once on a canvas, for the "toy diorama" look. Nothing to download. */
import * as THREE from 'three';

/** A tiny repeatable random number maker, so the textures look the same every time. */
function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasOf(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext('2d')];
}

function finish(canvas: HTMLCanvasElement, repeat: boolean, anisotropy: number): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = anisotropy;
  return texture;
}

/** How many tiles one sand texture covers along each side. */
export const SAND_TILES = 4;

/** Sand: soft ripples and a few speckles. Repeats without a seam, covering SAND_TILES × SAND_TILES tiles. */
export function sandTexture(anisotropy = 4): THREE.CanvasTexture {
  const S = 512;
  const [canvas, g] = canvasOf(S, S);
  if (g) {
    const rnd = random(7);
    g.fillStyle = '#efd493';
    g.fillRect(0, 0, S, S);
    // Big soft patches of lighter and darker sand.
    for (let i = 0; i < 14; i++) {
      const x = rnd() * S;
      const y = rnd() * S;
      const r = 50 + rnd() * 70;
      const light = i % 2 === 0;
      for (const dx of [-S, 0, S]) {
        for (const dy of [-S, 0, S]) {
          const grad = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
          grad.addColorStop(0, light ? 'rgba(255,244,205,0.30)' : 'rgba(200,155,80,0.18)');
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = grad;
          g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
        }
      }
    }
    // Ripples: wavy lines with a whole number of waves, so the edges meet.
    g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const y0 = (i + 0.5) * (S / 9) + (rnd() - 0.5) * 14;
      const waves = 2 + Math.floor(rnd() * 2);
      const amp = 5 + rnd() * 6;
      const phase = rnd() * Math.PI * 2;
      for (const [offset, style, width] of [[0, 'rgba(176,132,62,0.20)', 4], [5, 'rgba(255,246,214,0.38)', 3]] as const) {
        g.strokeStyle = style;
        g.lineWidth = width;
        g.beginPath();
        for (let x = 0; x <= S; x += 8) {
          const y = y0 + offset + Math.sin((x / S) * Math.PI * 2 * waves + phase) * amp;
          if (x === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }
    }
    // Speckles.
    for (let i = 0; i < 420; i++) {
      const x = rnd() * S;
      const y = rnd() * S;
      const r = 0.8 + rnd() * 1.8;
      g.fillStyle = rnd() < 0.5 ? 'rgba(140,100,50,0.30)' : 'rgba(255,255,240,0.45)';
      for (const dx of [-S, 0, S]) {
        if (x + dx < -4 || x + dx > S + 4) continue;
        g.beginPath();
        g.arc(x + dx, y, r, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  return finish(canvas, true, anisotropy);
}

/** The height one driftwood texture covers, in world units (two planks). */
export const WOOD_HEIGHT = 0.3;
/** How many tiles of rail one driftwood texture covers along its length. */
export const WOOD_TILES = 2;

/** Driftwood planks: warm grey-brown boards with soft gaps and grain. Two planks tall, WOOD_TILES tiles long. Repeats. */
export function driftwoodTexture(anisotropy = 4): THREE.CanvasTexture {
  const W = 512;
  const H = 128;
  const [canvas, g] = canvasOf(W, H);
  if (g) {
    const rnd = random(21);
    const boards = [
      { y: 0, base: '#bcab90', end: 150 },
      { y: H / 2, base: '#ad9c82', end: 380 },
    ];
    for (const b of boards) {
      g.fillStyle = b.base;
      g.fillRect(0, b.y, W, H / 2);
      // Grain: long thin lines, a little darker or lighter.
      for (let i = 0; i < 8; i++) {
        const y = b.y + 8 + rnd() * (H / 2 - 16);
        g.strokeStyle = rnd() < 0.6 ? 'rgba(90,70,45,0.16)' : 'rgba(255,248,230,0.22)';
        g.lineWidth = 1 + rnd() * 1.5;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(W, y + (rnd() - 0.5) * 3);
        g.stroke();
      }
      // Where one board ends and the next begins.
      g.fillStyle = 'rgba(80,62,42,0.55)';
      g.fillRect(b.end, b.y + 2, 3, H / 2 - 4);
    }
    // A knot.
    g.fillStyle = 'rgba(80,60,38,0.4)';
    g.beginPath();
    g.ellipse(300, 30, 8, 4, 0, 0, Math.PI * 2);
    g.fill();
    // The soft gaps between boards.
    g.fillStyle = '#7a6850';
    g.fillRect(0, 0, W, 3);
    g.fillRect(0, H / 2 - 1, W, 3);
  }
  return finish(canvas, true, anisotropy);
}

/** A sky that fades from `top` to `bottom`. */
export function skyTexture(top: number, bottom: number): THREE.CanvasTexture {
  const [canvas, g] = canvasOf(8, 256);
  if (g) {
    const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, hex(top));
    grad.addColorStop(1, hex(bottom));
    g.fillStyle = grad;
    g.fillRect(0, 0, 8, 256);
  }
  return finish(canvas, false, 1);
}
