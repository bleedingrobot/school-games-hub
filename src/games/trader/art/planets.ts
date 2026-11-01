/**
 * Planets, drawn in code. Each planet in the game has the real name of a planet, dwarf planet or moon, and is drawn
 * to look like its namesake (a red desert for Mars, banded for Jupiter, rings for Saturn ...). Where it sits on our
 * map is made up, and the game says so.
 *
 * A planet's surface is drawn once to a wide texture; showing it just slides the texture round inside a circle (so it
 * turns), then lays light, shade and an atmosphere glow over it. City lights show on the dark side of busy worlds.
 *
 * Painted planets (docs/TRADER-ART-PLAN.md): once a planet's painted map has downloaded, it is wrapped round a ball
 * (./globe.ts) instead, under the same light, shade, glow, lights and rings. Simple graphics slides the painted map
 * the old way; reduced motion shows the ball still. Until the painting arrives, the drawn surface shows.
 */
import { buildGlobeTable, spinGlobe, type GlobeTable } from './globe';
import { loadPainting, paintingNow, planetMap, type Painting } from './paint';
import { TAU, clamp, hashText, makeCanvas, mix, rgba, rng } from './util';

export type SurfaceKind = 'gas' | 'ocean' | 'desert' | 'rocky' | 'ice' | 'lava' | 'haze';

export interface PlanetLook {
  name: string;
  kind: SurfaceKind;
  /** Base colours, light to dark. */
  colours: [string, string, string];
  /** The colour of the glow round the edge. */
  atmosphere: string;
  rings?: { colour: string; inner: number; outer: number; tilt: number };
  /** A polar cap, a storm spot, craters (0 to 1 how many). */
  cap?: boolean;
  storm?: boolean;
  craters?: number;
  clouds?: number;
  /** Relative size when shown beside others (1 is ordinary). */
  size: number;
  /** How fast it turns. */
  spin: number;
}

const L = (name: string, kind: SurfaceKind, colours: [string, string, string], atmosphere: string, extra: Partial<PlanetLook> = {}): PlanetLook => ({
  name,
  kind,
  colours,
  atmosphere,
  size: 1,
  spin: 0.012,
  ...extra,
});

export const LOOKS: Record<string, PlanetLook> = {
  Mercury: L('Mercury', 'rocky', ['#b8b0a6', '#8c857c', '#5c5750'], '#9a948c', { craters: 0.9, size: 0.7 }),
  Venus: L('Venus', 'haze', ['#f4dc9c', '#d6a85a', '#a8742e'], '#ffd88a', { clouds: 0.9, size: 0.95 }),
  Earth: L('Earth', 'ocean', ['#4aa3df', '#1f6fb5', '#0f3f7a'], '#7ec8ff', { clouds: 0.8, cap: true, size: 1 }),
  Mars: L('Mars', 'desert', ['#d9743f', '#b34b25', '#7a2e16'], '#ff9d6e', { cap: true, craters: 0.35, size: 0.8 }),
  Ceres: L('Ceres', 'rocky', ['#9a948e', '#6f6a66', '#464340'], '#8a847e', { craters: 1, size: 0.6 }),
  Jupiter: L('Jupiter', 'gas', ['#f0dcc0', '#d49a62', '#a05a34'], '#f2c89a', { storm: true, size: 1.9, spin: 0.03 }),
  Saturn: L('Saturn', 'gas', ['#f2e2b0', '#d9bf7a', '#b08f4a'], '#f4e0a0', { rings: { colour: '#e8d6a2', inner: 1.35, outer: 2.2, tilt: 0.32 }, size: 1.6, spin: 0.028 }),
  Uranus: L('Uranus', 'gas', ['#c6f0f2', '#8fd3d9', '#5aa7b4'], '#b6f2f6', { rings: { colour: '#b7dfe3', inner: 1.3, outer: 1.6, tilt: 0.12 }, size: 1.3, spin: 0.02 }),
  Neptune: L('Neptune', 'gas', ['#5f8cf0', '#2f5bd0', '#17338f'], '#6aa0ff', { storm: true, size: 1.3, spin: 0.025 }),
  Pluto: L('Pluto', 'ice', ['#e6d3bd', '#bfa58c', '#8b7260'], '#d9c6b0', { craters: 0.3, cap: true, size: 0.55 }),
  Eris: L('Eris', 'ice', ['#e9edf2', '#c3ccd6', '#8793a2'], '#dfe7f0', { craters: 0.2, size: 0.6 }),
  Haumea: L('Haumea', 'ice', ['#f2f4f7', '#cfd6e0', '#9aa6b8'], '#e6edf7', { storm: true, size: 0.6, spin: 0.05 }),
  Makemake: L('Makemake', 'ice', ['#e4b9a0', '#c0876a', '#8a5640'], '#e8b79a', { craters: 0.2, size: 0.6 }),
  Vesta: L('Vesta', 'rocky', ['#aaa39b', '#7f7871', '#524d48'], '#948d85', { craters: 1, size: 0.55 }),
  Europa: L('Europa', 'ice', ['#f1ebe0', '#d4c6b0', '#9b8267'], '#f0e6d2', { craters: 0.1, size: 0.65 }),
  Io: L('Io', 'lava', ['#f5e46a', '#d99a2a', '#8c4a14'], '#ffd66e', { size: 0.7, spin: 0.02 }),
  Ganymede: L('Ganymede', 'rocky', ['#b2a89a', '#837a6c', '#544c42'], '#a39a8c', { craters: 0.7, size: 0.8 }),
  Callisto: L('Callisto', 'rocky', ['#8e8478', '#615a50', '#3a352f'], '#7a7168', { craters: 1, size: 0.75 }),
  Titan: L('Titan', 'haze', ['#f0b560', '#c9812a', '#8a4e14'], '#ffc36a', { clouds: 1, size: 0.85 }),
  Enceladus: L('Enceladus', 'ice', ['#ffffff', '#e1eaf2', '#b2c5d6'], '#e9f6ff', { craters: 0.15, size: 0.55 }),
  Triton: L('Triton', 'ice', ['#f2cfd2', '#d3a4ab', '#9b6a73'], '#f2c2ca', { craters: 0.2, cap: true, size: 0.65 }),
  Charon: L('Charon', 'ice', ['#bfbfc4', '#8e8e96', '#5e5e68'], '#aaaab4', { craters: 0.5, size: 0.55 }),
  Titania: L('Titania', 'rocky', ['#aaa5a8', '#7a7578', '#4e4a4e'], '#9b969a', { craters: 0.8, size: 0.6 }),
  'Your moon': L('Your moon', 'rocky', ['#d4d0c8', '#a09a90', '#6b665e'], '#e8e4da', { craters: 1, size: 0.9 }),
  Phobos: L('Phobos', 'rocky', ['#8c8279', '#615950', '#3a342e'], '#7c746b', { craters: 1, size: 0.45 }),
};

export function lookOf(name: string): PlanetLook {
  return LOOKS[name] ?? L(name, 'rocky', ['#b0b0b0', '#808080', '#505050'], '#a0a0a0', { craters: 0.5 });
}

const TEX_H = 256;
const TEX_W = 512;
const textures = new Map<string, HTMLCanvasElement>();
const cloudTextures = new Map<string, HTMLCanvasElement>();

function blob(g: CanvasRenderingContext2D, r: () => number, x: number, y: number, size: number, colour: string, wrap = true): void {
  // A lumpy patch: a few overlapping circles (drawn again at both edges so the texture wraps).
  for (let w = wrap ? -1 : 0; w <= (wrap ? 1 : 0); w++) {
    g.fillStyle = colour;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.arc(x + w * TEX_W + (r() - 0.5) * size, y + (r() - 0.5) * size * 0.6, size * (0.25 + r() * 0.3), 0, TAU);
      g.fill();
    }
  }
}

function crater(g: CanvasRenderingContext2D, x: number, y: number, rad: number, dark: string, light: string): void {
  for (let w = -1; w <= 1; w++) {
    const cx = x + w * TEX_W;
    g.fillStyle = dark;
    g.beginPath();
    g.arc(cx, y, rad, 0, TAU);
    g.fill();
    g.strokeStyle = light;
    g.lineWidth = Math.max(1, rad * 0.22);
    g.beginPath();
    g.arc(cx - rad * 0.12, y - rad * 0.12, rad, Math.PI * 0.85, Math.PI * 1.75);
    g.stroke();
  }
}

function makeTexture(look: PlanetLook): HTMLCanvasElement {
  const c = makeCanvas(TEX_W, TEX_H);
  const g = c.getContext('2d');
  if (!g) return c;
  const r = rng(hashText(look.name));
  const [light, mid, dark] = look.colours;
  const grad = g.createLinearGradient(0, 0, 0, TEX_H);
  grad.addColorStop(0, mid);
  grad.addColorStop(0.5, light);
  grad.addColorStop(1, mid);
  g.fillStyle = grad;
  g.fillRect(0, 0, TEX_W, TEX_H);

  if (look.kind === 'gas') {
    const bands = 16 + Math.floor(r() * 8);
    for (let i = 0; i < bands; i++) {
      const y = (i / bands) * TEX_H + (r() - 0.5) * 8;
      const h = TEX_H / bands * (0.5 + r() * 0.9);
      g.fillStyle = rgba(r() < 0.5 ? dark : light, 0.25 + r() * 0.3);
      g.beginPath();
      g.moveTo(0, y);
      const wave = 2 + r() * 4;
      const phase = r() * TAU;
      for (let x = 0; x <= TEX_W; x += 8) g.lineTo(x, y + Math.sin((x / TEX_W) * TAU * 2 + phase) * wave);
      for (let x = TEX_W; x >= 0; x -= 8) g.lineTo(x, y + h + Math.sin((x / TEX_W) * TAU * 2 + phase + 1) * wave);
      g.closePath();
      g.fill();
    }
    if (look.storm) {
      g.fillStyle = rgba(mix(dark, '#8a2a14', 0.5), 0.85);
      g.beginPath();
      g.ellipse(TEX_W * 0.62, TEX_H * 0.62, 34, 20, 0, 0, TAU);
      g.fill();
      g.strokeStyle = rgba(light, 0.7);
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(TEX_W * 0.62, TEX_H * 0.62, 40, 25, 0, 0, TAU);
      g.stroke();
    }
  } else if (look.kind === 'ocean') {
    // Seas, with continents.
    g.fillStyle = grad;
    g.fillRect(0, 0, TEX_W, TEX_H);
    for (let i = 0; i < 12; i++) blob(g, r, r() * TEX_W, TEX_H * (0.2 + r() * 0.6), 26 + r() * 42, r() < 0.6 ? '#3f8f3f' : '#9a7a3c');
    for (let i = 0; i < 12; i++) blob(g, r, r() * TEX_W, TEX_H * (0.2 + r() * 0.6), 14 + r() * 22, '#6ab04c');
  } else if (look.kind === 'lava') {
    g.fillStyle = grad;
    g.fillRect(0, 0, TEX_W, TEX_H);
    for (let i = 0; i < 40; i++) blob(g, r, r() * TEX_W, r() * TEX_H, 14 + r() * 26, rgba(i % 3 ? dark : '#ffe36a', 0.55), true);
    for (let i = 0; i < 12; i++) {
      const x = r() * TEX_W;
      const y = r() * TEX_H;
      g.fillStyle = '#3a1608';
      g.beginPath();
      g.arc(x, y, 4 + r() * 5, 0, TAU);
      g.fill();
    }
  } else {
    // Desert, rock, ice and haze all start as mottled ground.
    for (let i = 0; i < 70; i++) blob(g, r, r() * TEX_W, r() * TEX_H, 14 + r() * 40, rgba(r() < 0.55 ? dark : light, look.kind === 'haze' ? 0.18 : 0.3));
    if (look.kind === 'ice') {
      g.strokeStyle = rgba(dark, 0.45);
      g.lineWidth = 1.4;
      for (let i = 0; i < 26; i++) {
        let x = r() * TEX_W;
        let y = r() * TEX_H;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          x += (r() - 0.5) * 70;
          y += (r() - 0.5) * 40;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    }
  }

  const craterCount = Math.round((look.craters ?? 0) * 46);
  for (let i = 0; i < craterCount; i++) crater(g, r() * TEX_W, TEX_H * (0.12 + r() * 0.76), 3 + r() * r() * 22, rgba(dark, 0.55), rgba(light, 0.55));
  return c;
}

function makeClouds(look: PlanetLook): HTMLCanvasElement {
  const c = makeCanvas(TEX_W, TEX_H);
  const g = c.getContext('2d');
  if (!g) return c;
  const r = rng(hashText(look.name) + 7);
  const amount = look.clouds ?? 0;
  const colour = look.kind === 'haze' ? rgba(look.colours[0], 0.4) : 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 44 * amount; i++) {
    const y = TEX_H * (0.08 + r() * 0.84);
    blob(g, r, r() * TEX_W, y, 10 + r() * 26, colour);
  }
  return c;
}

function textureOf(look: PlanetLook): HTMLCanvasElement {
  let tex = textures.get(look.name);
  if (!tex) {
    tex = makeTexture(look);
    textures.set(look.name, tex);
  }
  return tex;
}

function cloudsOf(look: PlanetLook): HTMLCanvasElement | null {
  if (!look.clouds) return null;
  let tex = cloudTextures.get(look.name);
  if (!tex) {
    tex = makeClouds(look);
    cloudTextures.set(look.name, tex);
  }
  return tex;
}

export interface PlanetDrawOptions {
  /** Seconds, for the turning. */
  t: number;
  /** Draw it still (reduced motion, or a tiny marker). */
  still?: boolean;
  /** Skip the atmosphere glow and the clouds (simple graphics, tiny markers). */
  plain?: boolean;
  /** City lights on the dark side: 0 to 1. */
  lights?: number;
  /** The direction the light comes from, in radians (default: from the upper left). */
  light?: number;
}

function ringArc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, look: PlanetLook, front: boolean): void {
  const ring = look.rings;
  if (!ring) return;
  g.save();
  g.translate(cx, cy);
  g.scale(1, ring.tilt);
  // Several thin bands of different strength make it look like a real ring system.
  const bands = [
    [ring.inner, ring.inner + (ring.outer - ring.inner) * 0.28, 0.55],
    [ring.inner + (ring.outer - ring.inner) * 0.32, ring.inner + (ring.outer - ring.inner) * 0.62, 0.8],
    [ring.inner + (ring.outer - ring.inner) * 0.68, ring.outer, 0.4],
  ] as const;
  for (const [a, b, alpha] of bands) {
    g.strokeStyle = rgba(ring.colour, alpha);
    g.lineWidth = Math.max(1, (b - a) * r);
    g.beginPath();
    g.arc(0, 0, ((a + b) / 2) * r, front ? 0 : Math.PI, front ? Math.PI : TAU);
    g.stroke();
  }
  g.restore();
}

function shadeCaps(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const fade = g.createLinearGradient(0, cy - r, 0, cy - r * 0.55);
  fade.addColorStop(0, 'rgba(255,255,255,0)');
  fade.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = fade;
  g.fillRect(cx - r, cy - r, r * 2, r * 0.45);
}

// ---------------------------------------------------------------------------
// Painted planets on a turning ball
// ---------------------------------------------------------------------------

/** Paintings on (the preview can turn them off to compare). */
let painted = true;
export function usePaintedPlanets(on: boolean): void {
  painted = on;
}

/** The biggest ball worked out pixel by pixel; anything bigger is drawn at this size and scaled up. */
const MAX_GLOBE = 512;
/** At most this many frames a second for each ball (the screen may draw faster: it reuses the last one). */
const GLOBE_FPS = 30;
/** Balls up to this many pixels across use the small 256 × 128 map. */
const SMALL_MAP_UP_TO = 128;

interface Globe {
  table: GlobeTable;
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  image: ImageData;
  out: Uint32Array;
  map: Painting;
  shift: number;
  t: number;
}
const tables = new Map<string, GlobeTable>();
const globes = new Map<string, Globe>();

function tableFor(size: number, w: number, h: number): GlobeTable {
  const key = `${size}:${w}x${h}`;
  let t = tables.get(key);
  if (!t) {
    t = buildGlobeTable(size, w, h);
    tables.set(key, t);
    if (tables.size > 12) tables.delete(tables.keys().next().value as string);
  }
  return t;
}

/** Is this planet's painted map ready to draw at this size? False when it has none, it is still coming, or paintings are off. */
export function planetPainted(name: string, across: number): boolean {
  return Boolean(paintedMap(name, across));
}

/** Downloads these planets' small maps (for the star chart, which draws its icons once). Resolves when they have all arrived or failed. */
export async function loadSmallPlanetMaps(names: readonly string[]): Promise<void> {
  if (!painted) return;
  await Promise.all(names.map((n) => planetMap(n, true)).filter((u): u is string => Boolean(u)).map(loadPainting));
}

/** How many device pixels one drawing unit is (the canvas may be scaled for a sharp screen). */
function pixelScale(g: CanvasRenderingContext2D): number {
  if (typeof g.getTransform !== 'function') return 1;
  const m = g.getTransform();
  return Math.hypot(m.a, m.b) || 1;
}

/** The planet's painted map, if it has one and it has downloaded (small for small balls). */
function paintedMap(name: string, across: number): Painting | undefined {
  if (!painted) return undefined;
  const small = across <= SMALL_MAP_UP_TO;
  return paintingNow(planetMap(name, small)) ?? (small ? undefined : paintingNow(planetMap(name, true)));
}

/** The ball for this planet at this size, turned to time t (redrawn at most GLOBE_FPS times a second). */
function globeCanvas(name: string, map: Painting, size: number, turn: number, t: number, still: boolean): HTMLCanvasElement | null {
  const key = `${name}:${size}`;
  let globe = globes.get(key);
  if (!globe || globe.map !== map) {
    const canvas = makeCanvas(size, size);
    const g = canvas.getContext('2d');
    if (!g) return null;
    const image = g.createImageData(size, size);
    globe = { table: tableFor(size, map.w, map.h), canvas, g, image, out: new Uint32Array(image.data.buffer), map, shift: -1, t: -Infinity };
    globes.set(key, globe);
    if (globes.size > 8) globes.delete(globes.keys().next().value as string);
  }
  const shift = Math.floor((((turn % 1) + 1) % 1) * map.w);
  const due = still ? globe.shift < 0 : t - globe.t >= 1 / GLOBE_FPS || t < globe.t;
  if (due && shift !== globe.shift) {
    spinGlobe(globe.table, map.pixels, globe.out, turn);
    globe.g.putImageData(globe.image, 0, 0);
    globe.shift = shift;
    globe.t = t;
  }
  return globe.canvas;
}

/** Draw a planet with its centre at (cx, cy) and the given radius in pixels. */
export function drawPlanet(g: CanvasRenderingContext2D, look: PlanetLook, cx: number, cy: number, r: number, o: PlanetDrawOptions): void {
  if (!o.plain && !o.still) ringArc(g, cx, cy, r, look, false);

  if (!o.plain) {
    const glow = g.createRadialGradient(cx, cy, r * 0.92, cx, cy, r * 1.32);
    glow.addColorStop(0, rgba(look.atmosphere, 0.42));
    glow.addColorStop(1, rgba(look.atmosphere, 0));
    g.fillStyle = glow;
    g.beginPath();
    g.arc(cx, cy, r * 1.32, 0, TAU);
    g.fill();
  }

  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, TAU);
  g.clip();
  const across = Math.min(MAX_GLOBE, Math.max(8, Math.round(r * 2 * pixelScale(g))));
  const map = paintedMap(look.name, across);
  const ball = map && !o.plain ? globeCanvas(look.name, map, across, o.still ? 0.3 : o.t * look.spin, o.t, Boolean(o.still)) : null;
  const scale = (r * 2) / TEX_H;
  const w = TEX_W * scale;
  if (ball) {
    g.drawImage(ball, cx - r, cy - r, r * 2, r * 2);
  } else {
    // The old sliding strip: the painted map with simple graphics, else the drawn surface.
    const tex = map ? map.img : textureOf(look);
    const shift = o.still ? w * 0.3 : (o.t * look.spin * w) % w;
    for (let k = -1; k <= 1; k++) g.drawImage(tex, cx - r + shift + k * w - w / 2 + r, cy - r, w, r * 2);
  }
  // A painting has its own clouds and ice caps.
  const clouds = o.plain || map ? null : cloudsOf(look);
  if (clouds) {
    const cs = o.still ? w * 0.1 : (o.t * look.spin * 1.5 * w) % w;
    g.globalAlpha = look.kind === 'haze' ? 0.9 : 0.75;
    for (let k = -1; k <= 1; k++) g.drawImage(clouds, cx - r + cs + k * w - w / 2 + r, cy - r, w, r * 2);
    g.globalAlpha = 1;
  }
  // Light and shade: bright on the sun's side, a soft edge into night, a darker rim all round.
  const a = o.light ?? Math.PI * 1.25;
  const lx = cx + Math.cos(a) * r * 0.55;
  const ly = cy + Math.sin(a) * r * 0.55;
  const shade = g.createRadialGradient(lx, ly, r * 0.15, lx, ly, r * 1.55);
  shade.addColorStop(0, 'rgba(255,255,255,0.14)');
  shade.addColorStop(0.45, 'rgba(0,0,0,0)');
  shade.addColorStop(0.8, 'rgba(0,0,12,0.55)');
  shade.addColorStop(1, 'rgba(0,0,18,0.88)');
  g.fillStyle = shade;
  g.fillRect(cx - r, cy - r, r * 2, r * 2);
  if (look.cap && !map) {
    // Polar caps, drawn on the globe itself so they curve with it.
    g.fillStyle = 'rgba(255,255,255,0.88)';
    g.beginPath();
    g.ellipse(cx, cy - r * 0.99, r * 0.5, r * 0.2, 0, 0, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(cx, cy + r * 0.99, r * 0.38, r * 0.14, 0, 0, TAU);
    g.fill();
    // Soften them into the surface.
    shadeCaps(g, cx, cy, r);
  }
  if (o.lights && !o.plain) {
    // City lights, only on the night side.
    const rand = rng(hashText(look.name) + 99);
    const n = Math.round(90 * o.lights);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const ang = a + Math.PI + (rand() - 0.5) * 1.7;
      const dist = r * (0.3 + rand() * 0.62);
      const px = cx + Math.cos(ang) * dist;
      const py = cy + Math.sin(ang) * dist;
      const glow = g.createRadialGradient(px, py, 0, px, py, Math.max(2, r * 0.03));
      glow.addColorStop(0, `rgba(255,232,160,${0.45 + rand() * 0.5})`);
      glow.addColorStop(1, 'rgba(255,200,100,0)');
      g.fillStyle = glow;
      g.fillRect(px - r * 0.03, py - r * 0.03, r * 0.06, r * 0.06);
    }
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();

  if (!o.plain) {
    const rim = g.createRadialGradient(cx, cy, r * 0.86, cx, cy, r);
    rim.addColorStop(0, rgba(look.atmosphere, 0));
    rim.addColorStop(1, rgba(look.atmosphere, clamp(0.45, 0, 1)));
    g.fillStyle = rim;
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.fill();
  }
  if (!o.plain && !o.still) ringArc(g, cx, cy, r, look, true);
  else if (look.rings) ringArc(g, cx, cy, r, look, true);
}
