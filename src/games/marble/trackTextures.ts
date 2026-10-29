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

/** The height one plank texture covers, in world units. */
export const PLANK_HEIGHT = 0.5;
/** How many tiles of wall one plank texture covers along its length (six boards). */
export const PLANK_TILES = 1;

/** Weathered pale driftwood boards, standing upright: soft gaps, a little colour change per board, fine grain. Repeats. */
export function plankTexture(anisotropy = 4): THREE.CanvasTexture {
  const W = 512;
  const H = 512;
  const BOARDS = 6;
  const [canvas, g] = canvasOf(W, H);
  if (g) {
    const rnd = random(33);
    const bw = W / BOARDS;
    const tones: Array<[number, number, number]> = [[205, 192, 170], [196, 181, 158], [212, 199, 178], [190, 176, 154], [201, 187, 163], [208, 195, 172]];
    for (let i = 0; i < BOARDS; i++) {
      const [r, gg, b] = tones[i];
      const x0 = i * bw;
      const base = g.createLinearGradient(0, 0, 0, H);
      base.addColorStop(0, `rgb(${r + 8},${gg + 7},${b + 6})`);
      base.addColorStop(1, `rgb(${r - 8},${gg - 8},${b - 8})`);
      g.fillStyle = base;
      g.fillRect(x0, 0, bw, H);
      // Fine grain, running up the board (a little wavy).
      for (let k = 0; k < 26; k++) {
        const x = x0 + 5 + rnd() * (bw - 10);
        g.strokeStyle = rnd() < 0.55 ? 'rgba(110,92,66,0.14)' : 'rgba(255,250,236,0.20)';
        g.lineWidth = 0.7 + rnd() * 1.6;
        g.beginPath();
        const wob = (rnd() - 0.5) * 5;
        g.moveTo(x, 0);
        g.bezierCurveTo(x + wob, H * 0.33, x - wob, H * 0.66, x + wob * 0.5, H);
        g.stroke();
      }
      // A soft knot on some boards.
      if (i % 2 === 1) {
        const cx = x0 + bw * (0.35 + rnd() * 0.3);
        const cy = H * (0.2 + rnd() * 0.6);
        const grad = g.createRadialGradient(cx, cy, 1, cx, cy, 14);
        grad.addColorStop(0, 'rgba(110,90,62,0.5)');
        grad.addColorStop(1, 'rgba(110,90,62,0)');
        g.fillStyle = grad;
        g.fillRect(cx - 16, cy - 16, 32, 32);
      }
    }
    // Soft gaps between boards: a darker blurred line, lighter on its edges.
    for (let i = 0; i <= BOARDS; i++) {
      const x = (i % BOARDS) * bw;
      for (const cx of i === BOARDS ? [W] : i === 0 ? [0, W] : [x]) {
        const grad = g.createLinearGradient(cx - 7, 0, cx + 7, 0);
        grad.addColorStop(0, 'rgba(120,100,74,0)');
        grad.addColorStop(0.5, 'rgba(120,100,74,0.55)');
        grad.addColorStop(1, 'rgba(120,100,74,0)');
        g.fillStyle = grad;
        g.fillRect(cx - 7, 0, 14, H);
      }
    }
    // Speckle.
    for (let i = 0; i < 500; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(120,100,74,0.18)' : 'rgba(255,255,245,0.25)';
      g.fillRect(rnd() * W, rnd() * H, 1.5, 1.5);
    }
  }
  return finish(canvas, true, anisotropy);
}

/** A weathered log: grain along its length (the V direction), a few rings and knots. Repeats. */
export function logTexture(anisotropy = 4): THREE.CanvasTexture {
  const S = 256;
  const [canvas, g] = canvasOf(S, S);
  if (g) {
    const rnd = random(77);
    const base = g.createLinearGradient(0, 0, S, 0);
    base.addColorStop(0, '#c9ba9e');
    base.addColorStop(0.5, '#d6c9ad');
    base.addColorStop(1, '#c9ba9e');
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);
    for (let k = 0; k < 40; k++) {
      const x = rnd() * S;
      g.strokeStyle = rnd() < 0.55 ? 'rgba(110,92,66,0.16)' : 'rgba(255,250,236,0.22)';
      g.lineWidth = 1 + rnd() * 2;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, S);
      g.stroke();
    }
    for (let i = 0; i < 2; i++) {
      const cx = rnd() * S;
      const cy = rnd() * S;
      const grad = g.createRadialGradient(cx, cy, 1, cx, cy, 16);
      grad.addColorStop(0, 'rgba(105,86,60,0.5)');
      grad.addColorStop(1, 'rgba(105,86,60,0)');
      g.fillStyle = grad;
      g.fillRect(cx - 18, cy - 18, 36, 36);
    }
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
