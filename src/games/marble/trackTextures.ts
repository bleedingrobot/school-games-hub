/** Small textures drawn once on a canvas, for the "toy diorama" look. Nothing to download. */
import * as THREE from 'three';
import type { TopPattern, WallBase } from './look';

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

// ---------------------------------------------------------------------------------------------------------------------
// The other places: track tops, walls and rails. Same style as above: soft, clean, no harsh noise, nothing pure black.
// ---------------------------------------------------------------------------------------------------------------------

/** How many tiles one top texture covers along each side (every top texture is the same size). */
export const TOP_TILES = SAND_TILES;

type Ctx = CanvasRenderingContext2D;

/** Run `draw` at `x,y` and at every shifted copy that pokes over an edge, so the picture wraps without a seam. */
function wrapDraw(size: [number, number], x: number, y: number, r: number, draw: (x: number, y: number) => void) {
  const [W, H] = size;
  for (const dx of [-W, 0, W]) {
    if (x + dx + r < 0 || x + dx - r > W) continue;
    for (const dy of [-H, 0, H]) {
      if (y + dy + r < 0 || y + dy - r > H) continue;
      draw(x + dx, y + dy);
    }
  }
}

/** Soft round patches of colour, wrapping at the edges. `colours` are used in turn. */
function patches(g: Ctx, size: [number, number], rnd: () => number, count: number, minR: number, maxR: number, colours: string[]) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * size[0];
    const y = rnd() * size[1];
    const r = minR + rnd() * (maxR - minR);
    const colour = colours[i % colours.length];
    const clear = colour.replace(/[\d.]+\)$/, '0)');
    wrapDraw(size, x, y, r, (px, py) => {
      const grad = g.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0, colour);
      grad.addColorStop(1, clear);
      g.fillStyle = grad;
      g.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
}

/** Tiny dots, wrapping at the edges. */
function dots(g: Ctx, size: [number, number], rnd: () => number, count: number, minR: number, maxR: number, colours: string[]) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * size[0];
    const y = rnd() * size[1];
    const r = minR + rnd() * (maxR - minR);
    g.fillStyle = colours[Math.floor(rnd() * colours.length)];
    wrapDraw(size, x, y, r, (px, py) => {
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.fill();
    });
  }
}

function drawTarmac(g: Ctx, S: number) {
  const size: [number, number] = [S, S];
  const rnd = random(101);
  g.fillStyle = '#8c867f';
  g.fillRect(0, 0, S, S);
  patches(g, size, rnd, 16, 50, 110, ['rgba(120,114,106,0.22)', 'rgba(170,163,152,0.2)']);
  // A faint worn patch where tyres have polished it.
  patches(g, size, rnd, 2, 90, 130, ['rgba(176,168,156,0.26)']);
  // Fine aggregate: small chips of lighter and darker stone.
  dots(g, size, rnd, 2600, 0.8, 2, ['rgba(222,214,200,0.42)', 'rgba(84,78,72,0.36)', 'rgba(176,154,130,0.32)', 'rgba(120,112,104,0.30)']);
  // A few larger chips.
  dots(g, size, rnd, 90, 2, 3.4, ['rgba(214,206,192,0.36)', 'rgba(96,90,84,0.30)']);
}

function drawSinter(g: Ctx, S: number) {
  const size: [number, number] = [S, S];
  const rnd = random(202);
  g.fillStyle = '#e8d6a8';
  g.fillRect(0, 0, S, S);
  patches(g, size, rnd, 16, 50, 110, ['rgba(250,238,200,0.34)', 'rgba(214,176,110,0.2)']);
  // Orange mineral staining, like the rings round a hot pool: soft ovals with a ring or two inside.
  for (let i = 0; i < 7; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const rx = 36 + rnd() * 50;
    const ry = rx * (0.5 + rnd() * 0.4);
    const rot = rnd() * Math.PI;
    wrapDraw([S, S], x, y, rx, (px, py) => {
      g.save();
      g.translate(px, py);
      g.rotate(rot);
      g.scale(1, ry / rx);
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      grad.addColorStop(0, 'rgba(232,148,70,0.34)');
      grad.addColorStop(0.7, 'rgba(226,160,84,0.18)');
      grad.addColorStop(1, 'rgba(226,160,84,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, rx, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(255,246,214,0.45)';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(0, 0, rx * 0.62, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    });
  }
  // Soft cracks: short wandering lines, a darker core with a pale edge.
  g.lineJoin = 'round';
  for (let i = 0; i < 16; i++) {
    let x = rnd() * S;
    let y = rnd() * S;
    let a = rnd() * Math.PI * 2;
    const pts: Array<[number, number]> = [[x, y]];
    for (let k = 0; k < 6; k++) {
      a += (rnd() - 0.5) * 1.2;
      x += Math.cos(a) * (14 + rnd() * 16);
      y += Math.sin(a) * (14 + rnd() * 16);
      pts.push([x, y]);
    }
    for (const dx of [-S, 0, S]) {
      for (const dy of [-S, 0, S]) {
        for (const [w, style] of [[4, 'rgba(255,248,222,0.30)'], [1.6, 'rgba(150,108,56,0.40)']] as const) {
          g.strokeStyle = style;
          g.lineWidth = w;
          g.beginPath();
          pts.forEach(([px, py], j) => (j ? g.lineTo(px + dx, py + dy) : g.moveTo(px + dx, py + dy)));
          g.stroke();
        }
      }
    }
  }
  dots(g, size, rnd, 500, 0.7, 1.6, ['rgba(255,250,230,0.5)', 'rgba(176,128,70,0.28)']);
}

function drawSnow(g: Ctx, S: number) {
  const size: [number, number] = [S, S];
  const rnd = random(303);
  g.fillStyle = '#f1f6fb';
  g.fillRect(0, 0, S, S);
  // Blue shadows in the dips, bright drifts on top.
  patches(g, size, rnd, 18, 50, 120, ['rgba(150,184,226,0.26)', 'rgba(255,255,255,0.5)', 'rgba(176,204,236,0.2)']);
  // Sparkle: soft dots, and a few little crosses.
  dots(g, size, rnd, 260, 0.8, 1.7, ['rgba(255,255,255,0.9)', 'rgba(170,198,232,0.35)']);
  g.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const r = 2.5 + rnd() * 2;
    wrapDraw(size, x, y, r, (px, py) => {
      g.strokeStyle = 'rgba(255,255,255,0.95)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(px - r, py);
      g.lineTo(px + r, py);
      g.moveTo(px, py - r);
      g.lineTo(px, py + r);
      g.stroke();
    });
  }
}

function drawConcrete(g: Ctx, S: number) {
  const size: [number, number] = [S, S];
  const rnd = random(404);
  const tile = S / TOP_TILES;
  g.fillStyle = '#c4c4be';
  g.fillRect(0, 0, S, S);
  // Each slab a hair different in tone.
  for (let i = 0; i < TOP_TILES; i++) {
    for (let j = 0; j < TOP_TILES; j++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,250,0.10)' : 'rgba(110,110,104,0.08)';
      g.fillRect(i * tile, j * tile, tile, tile);
    }
  }
  patches(g, size, rnd, 14, 40, 100, ['rgba(120,118,110,0.14)', 'rgba(236,236,230,0.22)']);
  // A few damp stains and a rust-coloured streak or two.
  patches(g, size, rnd, 5, 16, 40, ['rgba(96,94,86,0.18)']);
  patches(g, size, rnd, 2, 14, 26, ['rgba(176,128,92,0.16)']);
  dots(g, size, rnd, 700, 0.7, 1.5, ['rgba(120,118,110,0.24)', 'rgba(244,244,238,0.4)']);
  // Soft seams at every tile: a dark blurred line with a light edge.
  for (let i = 0; i < TOP_TILES; i++) {
    const c = i * tile;
    for (const horizontal of [false, true]) {
      for (const [off, w, style] of [[0, 3.2, 'rgba(98,96,90,0.42)'], [3, 2, 'rgba(250,250,244,0.38)']] as const) {
        g.strokeStyle = style;
        g.lineWidth = w;
        g.beginPath();
        for (const wrapped of [0, S]) {
          const p = c + off + wrapped;
          if (horizontal) {
            g.moveTo(0, p);
            g.lineTo(S, p);
          } else {
            g.moveTo(p, 0);
            g.lineTo(p, S);
          }
        }
        g.stroke();
      }
    }
  }
}

function drawScoria(g: Ctx, S: number) {
  const size: [number, number] = [S, S];
  const rnd = random(505);
  g.fillStyle = '#7e5242';
  g.fillRect(0, 0, S, S);
  patches(g, size, rnd, 16, 50, 110, ['rgba(176,98,70,0.24)', 'rgba(72,52,48,0.24)']);
  // Gravel: lumpy pebbles in dark volcanic and rusty tones, each with a lighter top edge.
  const tones = ['#4f3d3a', '#5b433c', '#a05a44', '#b86a4c', '#6f4a3c', '#8c5440', '#3f3231'];
  for (let i = 0; i < 520; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const rx = 2.2 + rnd() * 4.2;
    const ry = rx * (0.65 + rnd() * 0.35);
    const rot = rnd() * Math.PI;
    const tone = tones[Math.floor(rnd() * tones.length)];
    wrapDraw(size, x, y, rx + 2, (px, py) => {
      g.fillStyle = 'rgba(46,32,30,0.30)';
      g.beginPath();
      g.ellipse(px + 0.8, py + 1.2, rx, ry, rot, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = tone;
      g.beginPath();
      g.ellipse(px, py, rx, ry, rot, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,214,190,0.22)';
      g.beginPath();
      g.ellipse(px - rx * 0.25, py - ry * 0.3, rx * 0.5, ry * 0.4, rot, 0, Math.PI * 2);
      g.fill();
    });
  }
}

function drawGrass(g: Ctx, S: number) {
  const size: [number, number] = [S, S];
  const rnd = random(606);
  g.fillStyle = '#8cc267';
  g.fillRect(0, 0, S, S);
  patches(g, size, rnd, 20, 50, 110, ['rgba(184,222,126,0.34)', 'rgba(86,148,74,0.24)']);
  // Short blades, leaning a little, lighter and darker greens. Not too many, so it reads as a calm path.
  g.lineCap = 'round';
  for (let i = 0; i < 620; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const len = 5 + rnd() * 7;
    const lean = (rnd() - 0.5) * 5;
    const style = rnd() < 0.5 ? 'rgba(206,240,150,0.5)' : rnd() < 0.5 ? 'rgba(70,128,64,0.34)' : 'rgba(120,184,92,0.4)';
    wrapDraw(size, x, y, len + 3, (px, py) => {
      g.strokeStyle = style;
      g.lineWidth = 1.1 + rnd() * 0.7;
      g.beginPath();
      g.moveTo(px, py);
      g.quadraticCurveTo(px + lean * 0.3, py - len * 0.5, px + lean, py - len);
      g.stroke();
    });
  }
  // Tiny flowers.
  dots(g, size, rnd, 16, 1.7, 2.6, ['rgba(255,255,248,0.92)', 'rgba(255,224,96,0.92)', 'rgba(250,176,200,0.9)']);
}

const TOP_DRAWERS: Record<Exclude<TopPattern, 'none' | 'sand'>, (g: Ctx, S: number) => void> = {
  tarmac: drawTarmac,
  sinter: drawSinter,
  snow: drawSnow,
  concrete: drawConcrete,
  scoria: drawScoria,
  grass: drawGrass,
};

/** The top surface for a place. Each covers TOP_TILES × TOP_TILES tiles and repeats without a seam. Sand is the Boulder Beach one. */
export function topTexture(pattern: Exclude<TopPattern, 'none'>, anisotropy = 4): THREE.CanvasTexture {
  if (pattern === 'sand') return sandTexture(anisotropy);
  const S = 512;
  const [canvas, g] = canvasOf(S, S);
  if (g) TOP_DRAWERS[pattern](g, S);
  return finish(canvas, true, anisotropy);
}

// Walls are drawn upright like the planks: one texture is PLANK_TILES tiles long and PLANK_HEIGHT tall, top of the picture = top of the wall.

function drawBoardwalk(g: Ctx, W: number, H: number) {
  const rnd = random(701);
  const ROWS = 5;
  const bh = H / ROWS;
  const tones: Array<[number, number, number]> = [[150, 112, 76], [140, 104, 70], [156, 119, 82], [136, 100, 67], [146, 109, 74]];
  for (let i = 0; i < ROWS; i++) {
    const [r, gg, b] = tones[i];
    const y0 = i * bh;
    const base = g.createLinearGradient(0, y0, 0, y0 + bh);
    base.addColorStop(0, `rgb(${r + 10},${gg + 9},${b + 7})`);
    base.addColorStop(1, `rgb(${r - 9},${gg - 8},${b - 6})`);
    g.fillStyle = base;
    g.fillRect(0, y0, W, bh);
    // Grain along the board (it is horizontal, and straight so the ends meet).
    for (let k = 0; k < 9; k++) {
      const y = y0 + 6 + rnd() * (bh - 12);
      g.strokeStyle = rnd() < 0.55 ? 'rgba(80,56,36,0.20)' : 'rgba(236,208,170,0.22)';
      g.lineWidth = 0.7 + rnd() * 1.4;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(W * 0.3, y + (rnd() - 0.5) * 3, W * 0.65, y + (rnd() - 0.5) * 3, W, y);
      g.stroke();
    }
    if (i % 2 === 0) {
      const cx = W * (0.2 + rnd() * 0.6);
      const cy = y0 + bh * 0.5;
      const grad = g.createRadialGradient(cx, cy, 1, cx, cy, 13);
      grad.addColorStop(0, 'rgba(76,52,34,0.5)');
      grad.addColorStop(1, 'rgba(76,52,34,0)');
      g.fillStyle = grad;
      g.fillRect(cx - 14, cy - 14, 28, 28);
    }
  }
  // Soft gaps between the boards.
  for (let i = 0; i <= ROWS; i++) {
    const y = i * bh;
    const grad = g.createLinearGradient(0, y - 6, 0, y + 6);
    grad.addColorStop(0, 'rgba(70,48,32,0)');
    grad.addColorStop(0.5, 'rgba(70,48,32,0.6)');
    grad.addColorStop(1, 'rgba(70,48,32,0)');
    g.fillStyle = grad;
    g.fillRect(0, y - 6, W, 12);
  }
  for (let i = 0; i < 400; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(70,48,32,0.18)' : 'rgba(255,240,216,0.2)';
    g.fillRect(rnd() * W, rnd() * H, 1.5, 1.5);
  }
}

function drawConcreteWall(g: Ctx, W: number, H: number) {
  const rnd = random(702);
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#d2d2cc');
  base.addColorStop(0.12, '#c0c0ba');
  base.addColorStop(1, '#a4a49e');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  const size: [number, number] = [W, H];
  patches(g, size, rnd, 12, 40, 100, ['rgba(120,118,110,0.14)', 'rgba(240,240,234,0.18)']);
  patches(g, size, rnd, 4, 14, 34, ['rgba(92,90,82,0.18)']);
  dots(g, size, rnd, 500, 0.7, 1.4, ['rgba(110,108,100,0.22)', 'rgba(244,244,238,0.36)']);
  // The top edge catches the light.
  const top = g.createLinearGradient(0, 0, 0, 40);
  top.addColorStop(0, 'rgba(255,255,250,0.75)');
  top.addColorStop(0.45, 'rgba(255,255,250,0.28)');
  top.addColorStop(1, 'rgba(255,255,250,0)');
  g.fillStyle = top;
  g.fillRect(0, 0, W, 40);
  // A soft joint between kerb stones where the picture wraps.
  for (const x of [0, W]) {
    const grad = g.createLinearGradient(x - 6, 0, x + 6, 0);
    grad.addColorStop(0, 'rgba(90,88,82,0)');
    grad.addColorStop(0.5, 'rgba(90,88,82,0.4)');
    grad.addColorStop(1, 'rgba(90,88,82,0)');
    g.fillStyle = grad;
    g.fillRect(x - 6, 0, 12, H);
  }
}

function drawRock(g: Ctx, W: number, H: number) {
  const rnd = random(703);
  g.fillStyle = '#2e2826';
  g.fillRect(0, 0, W, H);
  const ROWS = 3;
  const rh = H / ROWS;
  const tones = ['#5a504b', '#4d4440', '#645850', '#554a44', '#6a5d55', '#483f3b'];
  for (let r = 0; r < ROWS; r++) {
    // Block widths that add up to exactly W, so the row wraps cleanly.
    const count = 3 + (r % 2);
    const widths = Array.from({ length: count }, () => 0.7 + rnd() * 0.6);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = ((r % 2) * W) / (count * 2);
    for (let k = 0; k < count; k++) {
      const w = (widths[k] / total) * W;
      const y = r * rh;
      const tone = tones[Math.floor(rnd() * tones.length)];
      for (const dx of [-W, 0, W]) {
        const bx = x + dx + 4;
        const by = y + 4;
        const bw = w - 8;
        const bh = rh - 8;
        if (bx > W || bx + bw < 0) continue;
        const rad = 18;
        g.beginPath();
        g.roundRect(bx, by, bw, bh, rad);
        const grad = g.createLinearGradient(bx, by, bx + bw * 0.4, by + bh);
        grad.addColorStop(0, '#7a6b61');
        grad.addColorStop(0.35, tone);
        grad.addColorStop(1, '#3b3330');
        g.fillStyle = grad;
        g.fill();
        // Soft facets: a few pale and dark polygons clipped to the block.
        g.save();
        g.clip();
        for (let f = 0; f < 4; f++) {
          const fx = bx + rnd() * bw;
          const fy = by + rnd() * bh;
          g.fillStyle = f % 2 ? 'rgba(255,236,216,0.10)' : 'rgba(30,22,20,0.16)';
          g.beginPath();
          g.moveTo(fx, fy);
          g.lineTo(fx + 30 + rnd() * 40, fy + (rnd() - 0.5) * 30);
          g.lineTo(fx + (rnd() - 0.5) * 50, fy + 24 + rnd() * 30);
          g.closePath();
          g.fill();
        }
        // Little pits, like volcanic bubbles.
        for (let p = 0; p < 10; p++) {
          g.fillStyle = 'rgba(30,22,20,0.26)';
          g.beginPath();
          g.arc(bx + rnd() * bw, by + rnd() * bh, 1.2 + rnd() * 2, 0, Math.PI * 2);
          g.fill();
        }
        g.restore();
        // A light rim along the top edge.
        g.strokeStyle = 'rgba(255,232,210,0.22)';
        g.lineWidth = 2;
        g.beginPath();
        g.roundRect(bx + 1, by + 1, bw - 2, bh - 2, rad);
        g.stroke();
      }
      x += w;
    }
  }
}

function drawSnowbank(g: Ctx, W: number, H: number) {
  const rnd = random(704);
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#ffffff');
  base.addColorStop(0.35, '#f1f7fc');
  base.addColorStop(0.75, '#d3e2f2');
  base.addColorStop(1, '#b4cbe6');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  const size: [number, number] = [W, H];
  patches(g, size, rnd, 16, 40, 100, ['rgba(160,192,230,0.22)', 'rgba(255,255,255,0.5)']);
  dots(g, size, rnd, 220, 0.8, 1.6, ['rgba(255,255,255,0.9)', 'rgba(150,184,224,0.32)']);
}

function drawHazard(g: Ctx, W: number, H: number) {
  const rnd = random(705);
  const PERIOD = 128;
  g.fillStyle = '#f0c030';
  g.fillRect(0, 0, W, H);
  // Diagonal near-black stripes. The period divides the width, and we draw beyond both sides so the ends meet.
  g.fillStyle = '#35322e';
  for (let x = -H - PERIOD; x <= W + PERIOD; x += PERIOD) {
    g.beginPath();
    g.moveTo(x, H);
    g.lineTo(x + PERIOD / 2, H);
    g.lineTo(x + PERIOD / 2 + H, 0);
    g.lineTo(x + H, 0);
    g.closePath();
    g.fill();
  }
  const size: [number, number] = [W, H];
  // Wear: pale scuffs on the dark stripes, dusty patches, a little grime along the bottom.
  patches(g, size, rnd, 10, 30, 70, ['rgba(255,244,200,0.16)', 'rgba(110,84,30,0.14)']);
  g.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    g.strokeStyle = rnd() < 0.6 ? 'rgba(240,200,80,0.34)' : 'rgba(70,64,56,0.3)';
    g.lineWidth = 1 + rnd() * 1.5;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 5 + rnd() * 10, y + (rnd() - 0.5) * 6);
    g.stroke();
  }
  const shade = g.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(255,250,220,0.22)');
  shade.addColorStop(0.2, 'rgba(255,250,220,0)');
  shade.addColorStop(0.8, 'rgba(60,44,20,0)');
  shade.addColorStop(1, 'rgba(60,44,20,0.26)');
  g.fillStyle = shade;
  g.fillRect(0, 0, W, H);
}

const WALL_DRAWERS: Record<Exclude<WallBase, 'planks'>, (g: Ctx, W: number, H: number) => void> = {
  boardwalk: drawBoardwalk,
  concrete: drawConcreteWall,
  rock: drawRock,
  snowbank: drawSnowbank,
  hazard: drawHazard,
};

/** The side of a wall. Mapped like plankTexture: PLANK_TILES across, PLANK_HEIGHT up. Repeats sideways without a seam. */
export function wallTexture(base: WallBase, anisotropy = 4): THREE.CanvasTexture {
  if (base === 'planks') return plankTexture(anisotropy);
  const S = 512;
  const [canvas, g] = canvasOf(S, S);
  if (g) WALL_DRAWERS[base](g, S, S);
  return finish(canvas, true, anisotropy);
}

/** The rail on top of a wall. 'log' is the driftwood log; 'pipe' is brushed galvanised steel (grain along V, round across U). */
export function wallTopTexture(top: 'log' | 'pipe', anisotropy = 4): THREE.CanvasTexture {
  if (top === 'log') return logTexture(anisotropy);
  const S = 256;
  const [canvas, g] = canvasOf(S, S);
  if (g) {
    const rnd = random(801);
    // Across the pipe: a bright highlight, a mid tone and a soft shadow; the same colour at both edges so it wraps.
    const base = g.createLinearGradient(0, 0, S, 0);
    base.addColorStop(0, '#a9b3bc');
    base.addColorStop(0.28, '#eef3f6');
    base.addColorStop(0.5, '#bcc6ce');
    base.addColorStop(0.82, '#7f8a95');
    base.addColorStop(1, '#a9b3bc');
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);
    // Brushed streaks along the length.
    for (let k = 0; k < 90; k++) {
      const x = rnd() * S;
      g.strokeStyle = rnd() < 0.5 ? 'rgba(90,100,110,0.14)' : 'rgba(255,255,255,0.22)';
      g.lineWidth = 0.6 + rnd() * 1.2;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, S);
      g.stroke();
    }
    // Soft zinc spangle patches.
    patches(g, [S, S], rnd, 6, 14, 30, ['rgba(255,255,255,0.14)', 'rgba(110,122,134,0.12)']);
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
