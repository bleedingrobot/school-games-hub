/**
 * The ships, drawn in code. Six for traders (Flea, Gnat, Firefly, Bumblebee, Beetle, Termite) and three kinds of
 * pirate. Every ship is drawn facing right, about 100 units long, in layers: engine glow, nacelles, wings, hull,
 * details, cockpit, lights. Each part is lit from above (a bright top edge, a dark underside, a thin outline, a
 * gleam along the top) so the ships look solid, and engines throw a warm light onto the hull behind them.
 *
 * Painted ships (docs/TRADER-ART-PLAN.md, G.3): once a ship's painting has downloaded it is drawn instead, with the
 * engine flames, the laser's muzzle and the shield bubble placed from points measured on each painting (PAINTED).
 * Until then, the drawn ship shows.
 */
import { SHIPS } from '../../../../shared/trader/config';
import { imageNow, pirateArt, shipArt } from './paint';
import { TAU, clamp, mix, rgba } from './util';

export type ShipKind = { side: 'trader'; index: number } | { side: 'pirate'; index: number };

export interface ShipPose {
  /** 0 to 1: how hard the engines burn. */
  thrust: number;
  /** Seconds, for flicker and blinking lights. */
  t: number;
  /** 0 (fine) to 1 (smoking and sparking). */
  damage?: number;
  /** Face left instead of right. */
  flip?: boolean;
  /** Tilt in radians. */
  tilt?: number;
  /** A hit flash, 0 to 1. */
  flash?: number;
}

type Pt = [number, number];

function trace(g: CanvasRenderingContext2D, pts: Pt[]): void {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
}

function bounds(pts: Pt[]): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1 };
}

/** A solid-looking part: lit from above, outlined, with a gleam along its top edge. */
function part(g: CanvasRenderingContext2D, pts: Pt[], base: string, o: { line?: string; gleam?: number; flat?: boolean } = {}): void {
  const b = bounds(pts);
  const grad = g.createLinearGradient(0, b.y0, 0, b.y1);
  grad.addColorStop(0, mix(base, '#ffffff', o.flat ? 0.1 : 0.38));
  grad.addColorStop(0.45, base);
  grad.addColorStop(1, mix(base, '#02030c', o.flat ? 0.3 : 0.6));
  trace(g, pts);
  g.fillStyle = grad;
  g.fill();
  g.save();
  trace(g, pts);
  g.clip();
  // The gleam: a soft bright band just under the top edge.
  const gl = g.createLinearGradient(0, b.y0, 0, b.y0 + (b.y1 - b.y0) * 0.38);
  gl.addColorStop(0, `rgba(255,255,255,${o.gleam ?? 0.28})`);
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gl;
  g.fillRect(b.x0, b.y0, b.x1 - b.x0, (b.y1 - b.y0) * 0.4);
  g.restore();
  trace(g, pts);
  g.strokeStyle = o.line ?? mix(base, '#000000', 0.75);
  g.lineWidth = 1.1;
  g.lineJoin = 'round';
  g.stroke();
}

/** A rounded body (an ellipse-ish blob) with the same lighting. */
function blobPart(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, base: string): void {
  const grad = g.createLinearGradient(0, cy - ry, 0, cy + ry);
  grad.addColorStop(0, mix(base, '#ffffff', 0.42));
  grad.addColorStop(0.4, base);
  grad.addColorStop(1, mix(base, '#02030c', 0.62));
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  g.fill();
  g.save();
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  g.clip();
  const gl = g.createRadialGradient(cx - rx * 0.25, cy - ry * 0.55, 0, cx - rx * 0.25, cy - ry * 0.55, rx * 0.8);
  gl.addColorStop(0, 'rgba(255,255,255,0.4)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gl;
  g.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  g.restore();
  g.strokeStyle = mix(base, '#000000', 0.75);
  g.lineWidth = 1.1;
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  g.stroke();
}

function lines(g: CanvasRenderingContext2D, segs: Pt[][], colour = 'rgba(0,0,0,0.38)', width = 0.7): void {
  g.strokeStyle = colour;
  g.lineWidth = width;
  g.lineCap = 'round';
  for (const s of segs) {
    g.beginPath();
    g.moveTo(s[0][0], s[0][1]);
    for (let i = 1; i < s.length; i++) g.lineTo(s[i][0], s[i][1]);
    g.stroke();
  }
}

function rivets(g: CanvasRenderingContext2D, pts: Pt[], colour = 'rgba(255,255,255,0.45)'): void {
  g.fillStyle = colour;
  for (const [x, y] of pts) {
    g.beginPath();
    g.arc(x, y, 0.8, 0, TAU);
    g.fill();
  }
}

/** The engine's flame: a long soft outer cone, a hot inner cone, a white core and a glowing nozzle. Drawn glowing. */
function flame(g: CanvasRenderingContext2D, x: number, y: number, len: number, wid: number, t: number, colour: string, seed: number): void {
  const flick = 0.86 + 0.14 * Math.sin(t * 38 + seed * 3) + 0.07 * Math.sin(t * 21 + seed);
  const l = len * flick;
  g.save();
  g.globalCompositeOperation = 'lighter';
  const glow = g.createRadialGradient(x, y, 0, x, y, wid * 3.2);
  glow.addColorStop(0, rgba(colour, 0.75));
  glow.addColorStop(1, rgba(colour, 0));
  g.fillStyle = glow;
  g.fillRect(x - wid * 3.2, y - wid * 3.2, wid * 6.4, wid * 6.4);
  const outer = g.createLinearGradient(x, y, x - l, y);
  outer.addColorStop(0, rgba(colour, 0.9));
  outer.addColorStop(0.5, rgba(colour, 0.4));
  outer.addColorStop(1, rgba(colour, 0));
  g.fillStyle = outer;
  g.beginPath();
  g.moveTo(x, y - wid);
  g.quadraticCurveTo(x - l * 0.55, y - wid * 0.8, x - l, y);
  g.quadraticCurveTo(x - l * 0.55, y + wid * 0.8, x, y + wid);
  g.closePath();
  g.fill();
  const inner = g.createLinearGradient(x, y, x - l * 0.6, y);
  inner.addColorStop(0, 'rgba(255,255,255,0.95)');
  inner.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = inner;
  g.beginPath();
  g.moveTo(x, y - wid * 0.42);
  g.lineTo(x - l * 0.6, y);
  g.lineTo(x, y + wid * 0.42);
  g.closePath();
  g.fill();
  g.restore();
}

/** An engine pod: a round-barrelled nacelle with a bright intake ring and a dark nozzle. */
function nacelle(g: CanvasRenderingContext2D, x: number, y: number, len: number, rad: number, base: string, glow: string, t: number): void {
  const grad = g.createLinearGradient(0, y - rad, 0, y + rad);
  grad.addColorStop(0, mix(base, '#ffffff', 0.5));
  grad.addColorStop(0.3, base);
  grad.addColorStop(1, mix(base, '#02030c', 0.7));
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(x + len * 0.2, y - rad);
  g.lineTo(x - len * 0.8, y - rad * 0.9);
  g.lineTo(x - len * 0.8, y + rad * 0.9);
  g.lineTo(x + len * 0.2, y + rad);
  g.quadraticCurveTo(x + len * 0.55, y, x + len * 0.2, y - rad);
  g.closePath();
  g.fill();
  g.strokeStyle = mix(base, '#000000', 0.75);
  g.lineWidth = 1;
  g.stroke();
  // Intake ring and nozzle.
  g.strokeStyle = rgba(glow, 0.9);
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(x + len * 0.12, y - rad * 0.95);
  g.lineTo(x + len * 0.12, y + rad * 0.95);
  g.stroke();
  g.fillStyle = '#0b0f1a';
  g.beginPath();
  g.ellipse(x - len * 0.8, y, rad * 0.32, rad * 0.9, 0, 0, TAU);
  g.fill();
  const pulse = 0.65 + 0.35 * Math.sin(t * 9 + x);
  g.fillStyle = rgba(glow, pulse);
  g.beginPath();
  g.ellipse(x - len * 0.8, y, rad * 0.2, rad * 0.62, 0, 0, TAU);
  g.fill();
}

function light(g: CanvasRenderingContext2D, x: number, y: number, colour: string, t: number, phase: number): void {
  const on = Math.sin(t * 5 + phase) > -0.2 ? 1 : 0.2;
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = rgba(colour, on);
  g.beginPath();
  g.arc(x, y, 1.5, 0, TAU);
  g.fill();
  if (on > 0.9) {
    const grad = g.createRadialGradient(x, y, 0, x, y, 7);
    grad.addColorStop(0, rgba(colour, 0.65));
    grad.addColorStop(1, rgba(colour, 0));
    g.fillStyle = grad;
    g.fillRect(x - 7, y - 7, 14, 14);
  }
  g.restore();
}

/** A glassy cockpit with a bright gleam, a dark rim and (optionally) a pilot's head inside. */
function canopy(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, tint = '#7fe0ff', pilot = false): void {
  g.fillStyle = '#0b1220';
  g.beginPath();
  g.ellipse(x, y, rx + 1.3, ry + 1.3, 0, 0, TAU);
  g.fill();
  const grad = g.createLinearGradient(x, y - ry, x, y + ry);
  grad.addColorStop(0, '#f2fdff');
  grad.addColorStop(0.35, tint);
  grad.addColorStop(1, mix(tint, '#06182e', 0.82));
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, TAU);
  g.fill();
  if (pilot) {
    // A small pilot: a round helmet over a pair of shoulders.
    g.save();
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, TAU);
    g.clip();
    g.fillStyle = 'rgba(30,41,59,0.8)';
    g.beginPath();
    g.ellipse(x - rx * 0.1, y + ry * 0.95, rx * 0.5, ry * 0.6, 0, Math.PI, TAU);
    g.fill();
    g.fillStyle = '#e2e8f0';
    g.beginPath();
    g.arc(x - rx * 0.1, y + ry * 0.05, ry * 0.36, 0, TAU);
    g.fill();
    g.fillStyle = '#0b1220';
    g.fillRect(x - rx * 0.1 - ry * 0.05, y - ry * 0.06, ry * 0.5, ry * 0.2);
    g.restore();
  }
  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineWidth = 1;
  g.beginPath();
  g.ellipse(x - rx * 0.1, y - ry * 0.22, rx * 0.62, ry * 0.5, 0, Math.PI * 1.08, Math.PI * 1.92);
  g.stroke();
}

/** Warm engine light thrown on the hull just ahead of a nozzle. */
function spill(g: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string, amount: number): void {
  g.save();
  g.globalCompositeOperation = 'lighter';
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, rgba(colour, 0.35 * amount));
  grad.addColorStop(1, rgba(colour, 0));
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
}

// ---------------------------------------------------------------------------------------------
// Trader ships
// ---------------------------------------------------------------------------------------------
function flea(g: CanvasRenderingContext2D, p: ShipPose): void {
  flame(g, -30, 0, 30 * p.thrust + 8, 5, p.t, '#7ad7ff', 0);
  // Little swept fins, top and bottom, behind the body.
  part(g, [[-12, -9], [-30, -23], [-34, -16], [-22, -5]], '#e97812');
  part(g, [[-12, 9], [-30, 23], [-34, 16], [-22, 5]], '#b95a0a');
  nacelle(g, -22, 0, 16, 5, '#64748b', '#7ad7ff', p.t);
  // An egg-shaped body, white with an orange belly band.
  blobPart(g, 0, 0, 30, 16, '#f1f5f9');
  g.save();
  g.beginPath();
  g.ellipse(0, 0, 30, 16, 0, 0, TAU);
  g.clip();
  g.fillStyle = '#f08a1a';
  g.fillRect(-34, 4.5, 68, 4);
  g.fillStyle = '#dc2626';
  g.fillRect(-26, -3, 11, 6);
  g.restore();
  lines(g, [[[-8, -15], [-8, 15]], [[-24, -9], [-24, 9]]]);
  rivets(g, [[-6, -12], [-6, 12], [-22, -7], [-22, 7]]);
  canopy(g, 12, -3, 12, 8.5, '#7fe0ff', true);
  g.strokeStyle = '#475569';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(-4, -15);
  g.lineTo(-6, -24);
  g.stroke();
  light(g, -6, -24, '#fca5a5', p.t, 0);
  light(g, 24, 8, '#86efac', p.t, 2);
  spill(g, -26, 0, 22, '#7ad7ff', p.thrust);
}

function gnat(g: CanvasRenderingContext2D, p: ShipPose): void {
  flame(g, -42, -7, 34 * p.thrust + 10, 3.8, p.t, '#7dd3fc', 1);
  flame(g, -42, 7, 34 * p.thrust + 10, 3.8, p.t, '#7dd3fc', 2);
  // Swept delta wings, top (far) darker, bottom (near) brighter, each with a bright leading edge.
  part(g, [[10, -6], [-22, -40], [-38, -36], [-28, -6]], '#1d6fa5', { gleam: 0.35 });
  lines(g, [[[6, -8], [-22, -38]]], 'rgba(190,235,255,0.7)', 1.1);
  part(g, [[10, 6], [-22, 40], [-38, 36], [-28, 6]], '#2b8fcf', { gleam: 0.25 });
  lines(g, [[[6, 8], [-22, 38]]], 'rgba(220,245,255,0.8)', 1.1);
  light(g, -33, -37, '#f87171', p.t, 0);
  light(g, -33, 37, '#4ade80', p.t, 1);
  nacelle(g, -26, -7, 22, 5.2, '#475569', '#7dd3fc', p.t);
  nacelle(g, -26, 7, 22, 5.2, '#475569', '#7dd3fc', p.t);
  // A long needle fuselage.
  part(g, [[56, 0], [34, -4.5], [8, -9], [-26, -8.5], [-32, 0], [-26, 8.5], [8, 9], [34, 4.5]], '#e6edf5');
  part(g, [[56, 0], [40, -2.6], [40, 2.6]], '#1d8fd6', { flat: true });
  lines(g, [[[18, -8], [18, 8]], [[-10, -8.5], [-10, 8.5]], [[30, -4], [30, 4]]]);
  g.fillStyle = '#f97316';
  g.fillRect(-18, -1.5, 22, 3);
  g.strokeStyle = '#475569';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(56, 0);
  g.lineTo(66, 0);
  g.stroke();
  canopy(g, 16, -1, 13, 4.6, '#7fe0ff', true);
  part(g, [[-24, -8], [-34, -20], [-31, -8]], '#e6edf5', { flat: true });
  spill(g, -30, 0, 26, '#7dd3fc', p.thrust);
}

function firefly(g: CanvasRenderingContext2D, p: ShipPose): void {
  flame(g, -50, -13, 38 * p.thrust + 10, 5.6, p.t, '#fdba74', 3);
  flame(g, -50, 13, 38 * p.thrust + 10, 5.6, p.t, '#fdba74', 4);
  part(g, [[-8, -12], [-36, -34], [-46, -30], [-34, -10]], '#b8530f');
  part(g, [[-8, 12], [-36, 34], [-46, 30], [-34, 10]], '#e4721b');
  // Radiator fins on the wings.
  lines(g, [[[-16, -16], [-34, -30]], [[-20, -14], [-38, -28]], [[-16, 16], [-34, 30]], [[-20, 14], [-38, 28]]], 'rgba(255,230,180,0.5)', 1);
  nacelle(g, -34, -13, 26, 7, '#5b6577', '#fdba74', p.t);
  nacelle(g, -34, 13, 26, 7, '#5b6577', '#fdba74', p.t);
  // Main hull and a cargo hump on top.
  part(g, [[52, 0], [32, -13], [-4, -15], [-36, -11], [-40, 0], [-36, 11], [-4, 15], [32, 13]], '#f8e7bd');
  part(g, [[16, -13], [10, -22], [-22, -22], [-30, -13]], '#d9a23a', { flat: true });
  lines(g, [[[2, -21], [2, -13]], [[-12, -21], [-12, -13]], [[28, -12], [26, 12]], [[-22, -13], [-22, 13]]]);
  part(g, [[52, 0], [38, -5], [38, 5]], '#dc2626', { flat: true });
  // A row of lit windows.
  g.fillStyle = '#7fe0ff';
  for (let i = 0; i < 5; i++) g.fillRect(-18 + i * 7, 5.5, 4, 3);
  g.fillStyle = '#a16207';
  g.fillRect(-30, -2, 52, 3);
  canopy(g, 28, -4, 12, 6.6, '#7fe0ff', true);
  g.strokeStyle = '#78350f';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(-6, -22);
  g.lineTo(-6, -30);
  g.stroke();
  g.fillStyle = '#e2e8f0';
  g.beginPath();
  g.ellipse(-6, -31, 5, 1.8, 0, 0, TAU);
  g.fill();
  light(g, -26, -22, '#fde047', p.t, 0.5);
  light(g, 6, 14, '#f87171', p.t, 1.5);
  spill(g, -36, -13, 24, '#fdba74', p.thrust);
  spill(g, -36, 13, 24, '#fdba74', p.thrust);
}

function bumblebee(g: CanvasRenderingContext2D, p: ShipPose): void {
  flame(g, -56, 0, 40 * p.thrust + 12, 6, p.t, '#fde047', 5);
  // Two see-through wings on top that shimmer.
  const flutter = Math.sin(p.t * 22) * 1.5;
  g.save();
  g.globalAlpha = 0.5;
  part(g, [[12, -14], [-6, -42 + flutter], [-36, -38 + flutter], [-26, -14]], '#e0f2fe', { line: '#7dd3fc', flat: true });
  part(g, [[2, -14], [-18, -34 + flutter], [-44, -28 + flutter], [-34, -14]], '#bae6fd', { line: '#7dd3fc', flat: true });
  g.restore();
  // Stinger-style engine at the tail.
  part(g, [[-40, -6], [-56, -4], [-60, 0], [-56, 4], [-40, 6]], '#1c1917');
  nacelle(g, -50, 0, 14, 4, '#3f3f46', '#fde047', p.t);
  // A fat striped body.
  blobPart(g, 0, 2, 46, 20, '#fcd34d');
  g.save();
  g.beginPath();
  g.ellipse(0, 2, 46, 20, 0, 0, TAU);
  g.clip();
  g.fillStyle = 'rgba(28,25,23,0.92)';
  for (const x of [-34, -18, -2]) {
    g.beginPath();
    g.moveTo(x, -20);
    g.lineTo(x + 9, -20);
    g.lineTo(x + 7, 24);
    g.lineTo(x - 2, 24);
    g.closePath();
    g.fill();
  }
  const sh = g.createLinearGradient(0, -18, 0, 22);
  sh.addColorStop(0, 'rgba(255,255,255,0.22)');
  sh.addColorStop(0.5, 'rgba(255,255,255,0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.4)');
  g.fillStyle = sh;
  g.fillRect(-50, -20, 100, 44);
  g.restore();
  // A big bug-eye cockpit with a honeycomb of panes, and antennae.
  canopy(g, 26, -2, 14, 11, '#a5f3fc', true);
  lines(g, [[[18, -9], [34, 5]], [[18, 4], [34, -9]], [[26, -13], [26, 9]]], 'rgba(20,60,90,0.5)', 0.8);
  g.strokeStyle = '#1c1917';
  g.lineWidth = 1.3;
  g.beginPath();
  g.moveTo(40, -12);
  g.quadraticCurveTo(52, -26, 58, -20);
  g.moveTo(42, -8);
  g.quadraticCurveTo(58, -16, 62, -8);
  g.stroke();
  g.fillStyle = '#fde047';
  g.beginPath();
  g.arc(58, -20, 1.8, 0, TAU);
  g.arc(62, -8, 1.8, 0, TAU);
  g.fill();
  light(g, -34, 18, '#f87171', p.t, 0);
  spill(g, -44, 0, 26, '#fde047', p.thrust);
}

function beetle(g: CanvasRenderingContext2D, p: ShipPose): void {
  flame(g, -56, -11, 32 * p.thrust + 10, 6, p.t, '#86efac', 7);
  flame(g, -56, 11, 32 * p.thrust + 10, 6, p.t, '#86efac', 8);
  // Landing legs along the belly.
  g.strokeStyle = '#064e3b';
  g.lineWidth = 2.4;
  g.lineCap = 'round';
  for (const x of [-30, -8, 14]) {
    g.beginPath();
    g.moveTo(x, 18);
    g.lineTo(x - 4, 28);
    g.lineTo(x + 3, 30);
    g.stroke();
  }
  nacelle(g, -44, -11, 20, 7, '#0f5132', '#86efac', p.t);
  nacelle(g, -44, 11, 20, 7, '#0f5132', '#86efac', p.t);
  // A domed, armoured carapace in two plates, with a bright arc along the top.
  blobPart(g, -4, 0, 52, 25, '#34d399');
  g.save();
  g.beginPath();
  g.ellipse(-4, 0, 52, 25, 0, 0, TAU);
  g.clip();
  g.strokeStyle = 'rgba(2,44,34,0.75)';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(-8, -26);
  g.quadraticCurveTo(-2, 0, -8, 26);
  g.moveTo(-56, 0);
  g.lineTo(48, 0);
  g.stroke();
  // Cargo containers set into the shell.
  for (const [x, y, c] of [[-32, -13, '#f59e0b'], [-20, -13, '#38bdf8'], [10, -13, '#f87171'], [22, -13, '#facc15'], [-32, 13, '#a78bfa'], [-20, 13, '#f59e0b'], [10, 13, '#38bdf8'], [22, 13, '#4ade80']] as [number, number, string][]) {
    part(g, [[x - 5, y - 4.5], [x + 5, y - 4.5], [x + 5, y + 4.5], [x - 5, y + 4.5]], c, { flat: true, gleam: 0.2 });
  }
  g.restore();
  rivets(g, [[-44, -8], [-44, 8], [-14, -20], [-14, 20], [30, -16], [30, 16]]);
  // A little head with a green window.
  part(g, [[50, 0], [40, -10], [28, -11], [28, 11], [40, 10]], '#6ee7b7');
  canopy(g, 40, 0, 7, 6, '#bef264', true);
  light(g, 16, -22, '#fde047', p.t, 0);
  light(g, 16, 22, '#fde047', p.t, 1);
  spill(g, -48, -11, 22, '#86efac', p.thrust);
  spill(g, -48, 11, 22, '#86efac', p.thrust);
}

function termite(g: CanvasRenderingContext2D, p: ShipPose): void {
  flame(g, -74, -10, 40 * p.thrust + 12, 6.4, p.t, '#c4b5fd', 9);
  flame(g, -74, 0, 46 * p.thrust + 12, 6.4, p.t, '#c4b5fd', 10);
  flame(g, -74, 10, 40 * p.thrust + 12, 6.4, p.t, '#c4b5fd', 11);
  // A truss spine runs the length of the ship.
  part(g, [[-60, -3], [44, -3], [44, 3], [-60, 3]], '#475569', { flat: true });
  // Engine block.
  part(g, [[-62, -16], [-52, -16], [-52, 16], [-62, 16]], '#334155');
  nacelle(g, -62, -10, 12, 4.5, '#64748b', '#c4b5fd', p.t);
  nacelle(g, -62, 0, 12, 4.5, '#64748b', '#c4b5fd', p.t);
  nacelle(g, -62, 10, 12, 4.5, '#64748b', '#c4b5fd', p.t);
  // Five cargo containers, each its own colour, with hazard stripes and lights.
  const colours = ['#c4b5fd', '#f0abfc', '#93c5fd', '#fcd34d', '#86efac'];
  for (let i = 0; i < 5; i++) {
    const x = -50 + i * 17;
    part(g, [[x, -17], [x + 15, -17], [x + 15, 17], [x, 17]], colours[i], { flat: true });
    g.fillStyle = 'rgba(30,20,60,0.5)';
    g.fillRect(x + 1.5, -17, 3, 34);
    g.fillRect(x + 10.5, -17, 3, 34);
    g.save();
    g.beginPath();
    g.rect(x, -17, 15, 5);
    g.clip();
    g.fillStyle = 'rgba(17,24,39,0.55)';
    for (let k = -2; k < 6; k++) {
      g.beginPath();
      g.moveTo(x + k * 5, -17);
      g.lineTo(x + k * 5 + 3, -17);
      g.lineTo(x + k * 5 - 2, -12);
      g.lineTo(x + k * 5 - 5, -12);
      g.fill();
    }
    g.restore();
    light(g, x + 7.5, 12, i % 2 ? '#fde047' : '#4ade80', p.t, i);
  }
  // Side radiator wings.
  part(g, [[-20, -17], [-34, -36], [-50, -34], [-42, -17]], '#7c3aed');
  part(g, [[-20, 17], [-34, 36], [-50, 34], [-42, 17]], '#5b21b6');
  lines(g, [[[-26, -22], [-44, -32]], [[-26, 22], [-44, 32]]], 'rgba(233,213,255,0.55)', 1);
  // Command nose with a row of windows.
  part(g, [[34, -17], [52, -11], [66, 0], [52, 11], [34, 17]], '#ede9fe');
  g.fillStyle = '#7fe0ff';
  for (let i = 0; i < 3; i++) g.fillRect(40 + i * 6, -3, 4, 6);
  canopy(g, 56, -2, 6, 5, '#f0abfc', true);
  g.strokeStyle = '#4c1d95';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(40, -16);
  g.lineTo(38, -26);
  g.moveTo(38, -26);
  g.lineTo(46, -26);
  g.stroke();
  light(g, 46, -26, '#f87171', p.t, 0);
  spill(g, -64, -10, 22, '#c4b5fd', p.thrust);
  spill(g, -64, 10, 22, '#c4b5fd', p.thrust);
}

// ---------------------------------------------------------------------------------------------
// Pirates: dark, spiky and mean. Glowing angry eyes, fangs, horns, skulls. (Never any blood.)
// ---------------------------------------------------------------------------------------------

/** A pair of glowing, angry slit eyes with brows, looking right. */
function evilEyes(g: CanvasRenderingContext2D, x: number, y: number, size: number, colour: string, t: number): void {
  const pulse = 0.75 + 0.25 * Math.sin(t * 5);
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const dy of [-size * 0.55, size * 0.55]) {
    const glow = g.createRadialGradient(x, y + dy, 0, x, y + dy, size * 2.6);
    glow.addColorStop(0, rgba(colour, 0.7 * pulse));
    glow.addColorStop(1, rgba(colour, 0));
    g.fillStyle = glow;
    g.fillRect(x - size * 2.6, y + dy - size * 2.6, size * 5.2, size * 5.2);
  }
  g.restore();
  g.fillStyle = '#ffe3e3';
  for (const [dy, dir] of [[-size * 0.55, 1], [size * 0.55, -1]] as [number, number][]) {
    // A slanted slit: the outer corner droops towards the nose for an angry look.
    g.beginPath();
    g.moveTo(x - size, y + dy - dir * size * 0.55);
    g.lineTo(x + size, y + dy + dir * size * 0.25);
    g.lineTo(x + size * 0.6, y + dy + dir * size * 0.55);
    g.lineTo(x - size * 0.9, y + dy - dir * size * 0.1);
    g.closePath();
    g.fill();
  }
  g.strokeStyle = '#1c0507';
  g.lineWidth = Math.max(1, size * 0.35);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x - size * 1.2, y - size * 1.5);
  g.lineTo(x + size * 1.2, y - size * 0.6);
  g.moveTo(x - size * 1.2, y + size * 1.5);
  g.lineTo(x + size * 1.2, y + size * 0.6);
  g.stroke();
}

/** A row of sharp teeth pointing up (dir -1) or down (dir 1), from x0 to x1 along y. */
function fangs(g: CanvasRenderingContext2D, x0: number, x1: number, y: number, n: number, len: number, dir: 1 | -1, colour = '#f1f5f9'): void {
  const w = (x1 - x0) / n;
  g.fillStyle = colour;
  g.strokeStyle = '#1c0507';
  g.lineWidth = 0.6;
  for (let i = 0; i < n; i++) {
    const tall = i % 2 ? 0.7 : 1;
    g.beginPath();
    g.moveTo(x0 + i * w, y);
    g.lineTo(x0 + (i + 0.5) * w, y + dir * len * tall);
    g.lineTo(x0 + (i + 1) * w, y);
    g.closePath();
    g.fill();
    g.stroke();
  }
}

/** A menacing skull, facing right, with glowing eye sockets and a jagged grin. */
function skull(g: CanvasRenderingContext2D, x: number, y: number, size: number, colour: string, t: number): void {
  const grad = g.createLinearGradient(0, y - size, 0, y + size);
  grad.addColorStop(0, '#f8fafc');
  grad.addColorStop(0.6, '#cbd5e1');
  grad.addColorStop(1, '#64748b');
  g.fillStyle = grad;
  g.strokeStyle = '#0f0a14';
  g.lineWidth = 1.2;
  g.beginPath();
  g.ellipse(x, y - size * 0.1, size, size * 0.85, 0, 0, TAU);
  g.fill();
  g.stroke();
  // Jaw.
  g.beginPath();
  g.moveTo(x - size * 0.55, y + size * 0.55);
  g.lineTo(x + size * 0.6, y + size * 0.55);
  g.lineTo(x + size * 0.45, y + size * 1.05);
  g.lineTo(x - size * 0.4, y + size * 1.05);
  g.closePath();
  g.fill();
  g.stroke();
  fangs(g, x - size * 0.45, x + size * 0.5, y + size * 0.6, 6, size * 0.35, 1, '#f8fafc');
  // Eye sockets glow, nose is a dark notch.
  const pulse = 0.7 + 0.3 * Math.sin(t * 4);
  g.fillStyle = '#12060a';
  for (const dy of [-size * 0.35, size * 0.15]) {
    g.beginPath();
    g.ellipse(x + size * 0.1, y + dy, size * 0.3, size * 0.22, 0.4, 0, TAU);
    g.fill();
  }
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const dy of [-size * 0.35, size * 0.15]) {
    const eye = g.createRadialGradient(x + size * 0.1, y + dy, 0, x + size * 0.1, y + dy, size * 0.55);
    eye.addColorStop(0, rgba('#ffffff', pulse));
    eye.addColorStop(0.35, rgba(colour, pulse));
    eye.addColorStop(1, rgba(colour, 0));
    g.fillStyle = eye;
    g.beginPath();
    g.arc(x + size * 0.1, y + dy, size * 0.55, 0, TAU);
    g.fill();
  }
  g.restore();
}

/** A dark, evil canopy: tinted glass with a red slit-pupil eye glaring out. */
function evilCanopy(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, colour: string, t: number): void {
  g.fillStyle = '#0b0507';
  g.beginPath();
  g.ellipse(x, y, rx + 1.4, ry + 1.4, 0, 0, TAU);
  g.fill();
  const grad = g.createLinearGradient(x, y - ry, x, y + ry);
  grad.addColorStop(0, mix(colour, '#ffffff', 0.15));
  grad.addColorStop(1, mix(colour, '#000000', 0.82));
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, TAU);
  g.fill();
  const pulse = 0.7 + 0.3 * Math.sin(t * 5);
  g.save();
  g.globalCompositeOperation = 'lighter';
  const glow = g.createRadialGradient(x + rx * 0.2, y, 0, x + rx * 0.2, y, rx);
  glow.addColorStop(0, rgba('#ff3b3b', 0.8 * pulse));
  glow.addColorStop(1, rgba('#ff3b3b', 0));
  g.fillStyle = glow;
  g.fillRect(x - rx, y - ry, rx * 2, ry * 2);
  g.restore();
  g.fillStyle = '#12060a';
  g.beginPath();
  g.ellipse(x + rx * 0.25, y, rx * 0.12, ry * 0.75, 0, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.4)';
  g.lineWidth = 0.8;
  g.beginPath();
  g.ellipse(x - rx * 0.1, y - ry * 0.25, rx * 0.6, ry * 0.5, 0, Math.PI * 1.1, Math.PI * 1.9);
  g.stroke();
}

function scrappy(g: CanvasRenderingContext2D, p: ShipPose): void {
  // A rusty exhaust pipe that spits a ragged, angry flame.
  flame(g, -48, 6, 28 * p.thrust + 10, 6, p.t, '#fb923c', 11);
  part(g, [[-30, 2], [-48, 2], [-50, 10], [-30, 11]], '#5b210d');
  // Wings made from other ships' scrap, bolted on crooked and ending in spikes.
  part(g, [[-8, 10], [-12, 34], [-26, 26], [-40, 32], [-34, 10]], '#6b7280');
  part(g, [[-6, -10], [-2, -26], [-14, -22], [-20, -34], [-28, -10]], '#7c2d12');
  rivets(g, [[-14, 20], [-26, 22], [-14, -16], [-22, -20]], 'rgba(255,255,255,0.55)');
  // A dented hull of mismatched plates.
  part(g, [[46, 2], [28, -12], [-30, -13], [-38, 2], [-30, 13], [28, 13]], '#5d5753');
  part(g, [[24, -12], [4, -13], [0, -1], [22, 0]], '#92400e', { flat: true });
  part(g, [[-6, -13], [-28, -13], [-33, 0], [-8, -2]], '#44403c', { flat: true });
  part(g, [[-4, 2], [18, 1], [22, 13], [-2, 13]], '#475569', { flat: true });
  lines(g, [[[-12, -5], [-4, 6]], [[8, -12], [10, 0]], [[-24, 4], [-18, 12]]], 'rgba(0,0,0,0.6)', 0.9);
  rivets(g, [[24, -6], [-4, -6], [12, 8], [-20, -8], [-20, 6]], 'rgba(255,255,255,0.5)');
  // A crooked jagged grin painted along the lower hull, and a ram of rusty spikes on the nose.
  fangs(g, -2, 26, 11, 6, 4.5, -1, '#e7e5e4');
  part(g, [[46, 2], [58, -2], [46, -3]], '#7c2d12', { flat: true });
  part(g, [[46, 3], [56, 8], [44, 9]], '#7c2d12', { flat: true });
  // A cannon bolted on top, glowing hot.
  part(g, [[8, -13], [36, -18], [36, -12], [8, -9]], '#1c1917', { flat: true });
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = rgba('#fb923c', 0.8);
  g.beginPath();
  g.arc(36, -15, 2.4, 0, TAU);
  g.fill();
  g.restore();
  evilCanopy(g, 28, 0, 9, 6.4, '#7f1d1d', p.t);
  // A mast with a ragged skull flag that flaps.
  g.strokeStyle = '#1c1917';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(-14, -13);
  g.lineTo(-14, -42);
  g.stroke();
  const flap = Math.sin(p.t * 8) * 2;
  g.fillStyle = '#0c0a0b';
  g.beginPath();
  g.moveTo(-14, -42);
  g.quadraticCurveTo(-4, -44 + flap, 6, -40);
  g.lineTo(2, -35);
  g.lineTo(6, -30);
  g.quadraticCurveTo(-4, -33 - flap, -14, -29);
  g.closePath();
  g.fill();
  skull(g, -4, -36, 4.4, '#ff4040', p.t);
  light(g, -36, 0, '#ef4444', p.t, 0);
  spill(g, -38, 6, 18, '#fb923c', p.thrust);
}

function raider(g: CanvasRenderingContext2D, p: ShipPose): void {
  flame(g, -52, -8, 38 * p.thrust + 10, 4.8, p.t, '#f87171', 12);
  flame(g, -52, 8, 38 * p.thrust + 10, 4.8, p.t, '#f87171', 13);
  // Forward-swept blade wings ending in claws, edged in red.
  part(g, [[24, -9], [-2, -44], [-12, -38], [-8, -46], [-26, -38], [-14, -8]], '#241f1e', { line: '#dc2626' });
  part(g, [[24, 9], [-2, 44], [-12, 38], [-8, 46], [-26, 38], [-14, 8]], '#312b29', { line: '#dc2626' });
  lines(g, [[[20, -10], [-2, -41]], [[20, 10], [-2, 41]]], 'rgba(248,113,113,0.9)', 1.4);
  nacelle(g, -36, -8, 24, 5.8, '#1f1b1a', '#f87171', p.t);
  nacelle(g, -36, 8, 24, 5.8, '#1f1b1a', '#f87171', p.t);
  // A back-ridge of spikes along the spine.
  part(g, [[16, -10], [10, -20], [4, -11], [-4, -22], [-10, -12], [-18, -20], [-22, -11]], '#171312', { line: '#dc2626', flat: true });
  // A low, sharp black hull.
  part(g, [[64, 0], [32, -9], [-14, -12], [-46, -6], [-46, 6], [-14, 12], [32, 9]], '#38312e', { line: '#dc2626' });
  lines(g, [[[-32, -9], [26, -5]], [[-32, 9], [26, 5]], [[-4, -12], [-4, 12]]], 'rgba(248,113,113,0.75)', 1);
  // A snarling shark mouth: sharp teeth along the top jaw and the bottom jaw.
  part(g, [[64, -1], [44, -7], [44, 0]], '#7f1d1d', { flat: true });
  part(g, [[64, 1], [44, 8], [44, 0]], '#7f1d1d', { flat: true });
  fangs(g, 44, 62, -0.5, 5, 4.5, 1);
  fangs(g, 44, 62, 0.5, 5, 4.5, -1);
  part(g, [[38, -9], [60, -13], [60, -8], [38, -6]], '#1c1917', { flat: true });
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = rgba('#f87171', 0.7 + 0.3 * Math.sin(p.t * 6));
  g.beginPath();
  g.arc(60, -10.5, 2.2, 0, TAU);
  g.fill();
  g.restore();
  evilEyes(g, 18, 0, 3.4, '#ff2a2a', p.t);
  light(g, -44, 0, '#ef4444', p.t, 0);
  spill(g, -40, 0, 26, '#f87171', p.thrust);
}

function captain(g: CanvasRenderingContext2D, p: ShipPose): void {
  flame(g, -66, -12, 44 * p.thrust + 12, 6.4, p.t, '#e879f9', 14);
  flame(g, -68, 0, 52 * p.thrust + 12, 7.4, p.t, '#e879f9', 15);
  flame(g, -66, 12, 44 * p.thrust + 12, 6.4, p.t, '#e879f9', 16);
  // Tattered bat-wings with long claw tips.
  part(g, [[12, -11], [-8, -54], [-20, -44], [-30, -56], [-40, -42], [-56, -48], [-52, -30], [-66, -20], [-40, -9]], '#25093f', { line: '#c026d3' });
  part(g, [[12, 11], [-8, 54], [-20, 44], [-30, 56], [-40, 42], [-56, 48], [-52, 30], [-66, 20], [-40, 9]], '#32064f', { line: '#c026d3' });
  lines(g, [[[4, -12], [-12, -48]], [[-12, -10], [-32, -50]], [[-28, -9], [-52, -42]], [[4, 12], [-12, 48]], [[-12, 10], [-32, 50]], [[-28, 9], [-52, 42]]], 'rgba(232,121,249,0.6)', 1.1);
  nacelle(g, -46, -12, 26, 7.2, '#1a1226', '#e879f9', p.t);
  nacelle(g, -46, 0, 28, 7.8, '#1a1226', '#e879f9', p.t);
  nacelle(g, -46, 12, 26, 7.2, '#1a1226', '#e879f9', p.t);
  // Two curving horns on top.
  g.fillStyle = '#18181b';
  g.strokeStyle = '#c026d3';
  g.lineWidth = 1.2;
  for (const x of [22, -6]) {
    g.beginPath();
    g.moveTo(x, -14);
    g.quadraticCurveTo(x + 4, -34, x + 20, -40);
    g.quadraticCurveTo(x + 8, -28, x + 12, -14);
    g.closePath();
    g.fill();
    g.stroke();
  }
  // A heavy armoured hull with ridged plates.
  part(g, [[68, 0], [46, -11], [-4, -17], [-50, -13], [-54, 0], [-50, 13], [-4, 17], [46, 11]], '#222226', { line: '#c026d3' });
  lines(g, [[[-42, -10], [38, -6]], [[-42, 10], [38, 6]], [[-18, -17], [-18, 17]], [[14, -13], [14, 13]]], 'rgba(232,121,249,0.55)', 1);
  rivets(g, [[-32, -12], [-32, 12], [0, -15], [0, 15], [32, -9], [32, 9]], 'rgba(240,171,252,0.6)');
  // A huge glowing skull on the prow.
  skull(g, 38, 0, 15, '#ff3df0', p.t);
  // Side cannons with hot muzzles.
  part(g, [[22, -14], [58, -19], [58, -13], [22, -10]], '#16161a', { flat: true });
  part(g, [[22, 14], [58, 19], [58, 13], [22, 10]], '#16161a', { flat: true });
  light(g, 58, -16, '#f0abfc', p.t, 0);
  light(g, 58, 16, '#f0abfc', p.t, 1);
  spill(g, -48, 0, 32, '#e879f9', p.thrust);
}

const DRAWERS = {
  trader: [flea, gnat, firefly, bumblebee, beetle, termite],
  pirate: [scrappy, raider, captain],
};

/**
 * Where things are on each painting, measured on the paintings themselves: x across from the back (0) to the front (1)
 * and y down from the middle, both as a share of the painting's width. `length` is how long the ship is drawn, in the
 * same units as the drawn ships (bigger ships are longer). Engines are the glowing nozzles the flames come out of.
 */
interface PaintedShip {
  length: number;
  engines: readonly (readonly [x: number, y: number])[];
  gun: readonly [x: number, y: number];
  flame: string;
}
export const PAINTED: Record<ShipKind['side'], readonly PaintedShip[]> = {
  trader: [
    { length: 90, engines: [[0.1, -0.04], [0.23, 0.23]], gun: [0.97, 0.13], flame: '#7ad7ff' }, // Flea
    { length: 100, engines: [[0.15, -0.06], [0.16, 0.03]], gun: [0.99, 0.1], flame: '#7dd3fc' }, // Gnat
    { length: 106, engines: [[0.15, 0.01]], gun: [0.99, 0.13], flame: '#7dd3fc' }, // Firefly
    { length: 110, engines: [[0.08, 0], [0.11, 0.1]], gun: [0.63, -0.18], flame: '#7dd3fc' }, // Bumblebee
    { length: 116, engines: [[0.15, 0]], gun: [0.99, 0.13], flame: '#7dd3fc' }, // Beetle
    { length: 130, engines: [[0.05, -0.03], [0.08, -0.02], [0.11, -0.01]], gun: [0.45, -0.18], flame: '#7dd3fc' }, // Termite
  ],
  pirate: [
    { length: 104, engines: [[0.19, 0]], gun: [0.99, 0.05], flame: '#f87171' }, // Scrappy pirate
    { length: 108, engines: [[0.28, 0.08], [0.5, 0.09]], gun: [0.99, 0.15], flame: '#f87171' }, // Pirate raider
    { length: 124, engines: [[0.21, -0.02], [0.24, -0.02], [0.27, -0.02]], gun: [0.99, 0.17], flame: '#f87171' }, // Pirate captain
  ],
};

/** The ship's painting, if it has one and it has downloaded. */
function paintingOf(kind: ShipKind): HTMLImageElement | undefined {
  return imageNow(kind.side === 'trader' ? shipArt(SHIPS[kind.index]?.name ?? '') : pirateArt(kind.index));
}

/** A measured point on a painting, in ship units (0, 0 the middle, facing right). */
const onPainting = (p: PaintedShip, [x, y]: readonly [number, number]): Pt => [(x - 0.5) * p.length, y * p.length];

/** Where the laser comes out, in ship units, for the picture being shown. */
export function muzzleOf(kind: ShipKind): Pt {
  const p = PAINTED[kind.side][kind.index];
  return p && paintingOf(kind) ? onPainting(p, p.gun) : MUZZLE;
}

/** The shield bubble's half-width and half-height, in ship units, for the picture being shown. */
export function shieldOf(kind: ShipKind): { rx: number; ry: number } {
  const p = PAINTED[kind.side][kind.index];
  const img = p && paintingOf(kind);
  if (!p || !img) return { rx: 76, ry: 48 };
  return { rx: p.length * 0.62, ry: Math.max(40, ((p.length * img.naturalHeight) / img.naturalWidth) * 0.62) };
}

function paintedShip(g: CanvasRenderingContext2D, p: PaintedShip, img: HTMLImageElement, pose: ShipPose, seed: number): void {
  const h = (p.length * img.naturalHeight) / img.naturalWidth;
  p.engines.forEach((e, i) => {
    const [ex, ey] = onPainting(p, e);
    flame(g, ex, ey, p.length * 0.3 * pose.thrust + 10, p.length * 0.03, pose.t, p.flame, seed + i);
  });
  g.drawImage(img, -p.length / 2, -h / 2, p.length, h);
}

/** Draw a ship with its middle at (x, y). `scale` 1 makes a ship about 100 pixels long. */
export function drawShip(g: CanvasRenderingContext2D, kind: ShipKind, x: number, y: number, scale: number, pose: ShipPose): void {
  const painted = PAINTED[kind.side][kind.index];
  const img = painted && paintingOf(kind);
  const draw = img ? (gg: CanvasRenderingContext2D, pp: ShipPose) => paintedShip(gg, painted, img, pp, kind.index * 3) : DRAWERS[kind.side][kind.index];
  if (!draw) return;
  g.save();
  g.translate(x, y);
  g.rotate(pose.tilt ?? 0);
  g.scale(pose.flip ? -scale : scale, scale);
  // A soft glow under the ship so it lifts off the sky.
  const halo = g.createRadialGradient(0, 0, 8, 0, 0, 80);
  halo.addColorStop(0, 'rgba(120,180,255,0.10)');
  halo.addColorStop(1, 'rgba(120,180,255,0)');
  g.fillStyle = halo;
  g.fillRect(-80, -80, 160, 160);
  if (kind.side === 'pirate') {
    // A dark red-purple menace glow behind a pirate.
    const pulse = 0.8 + 0.2 * Math.sin(pose.t * 3);
    g.save();
    g.globalCompositeOperation = 'lighter';
    const aura = g.createRadialGradient(0, 0, 10, 0, 0, 96);
    aura.addColorStop(0, `rgba(190,30,60,${0.2 * pulse})`);
    aura.addColorStop(1, 'rgba(120,20,160,0)');
    g.fillStyle = aura;
    g.fillRect(-100, -100, 200, 200);
    g.restore();
  }
  draw(g, pose);
  if (pose.flash && pose.flash > 0) {
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = `rgba(255,255,255,${clamp(pose.flash, 0, 1) * 0.55})`;
    g.beginPath();
    g.ellipse(0, 0, 58, 26, 0, 0, TAU);
    g.fill();
    g.globalCompositeOperation = 'source-over';
  }
  if (pose.damage && pose.damage > 0.25) {
    // Glowing cracks and scorch marks on a hurt ship (the effects add smoke).
    g.strokeStyle = `rgba(255,140,40,${clamp(pose.damage, 0, 1) * 0.8})`;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-6, -10);
    g.lineTo(0, -2);
    g.lineTo(-8, 4);
    g.moveTo(14, 8);
    g.lineTo(8, 2);
    g.stroke();
    g.fillStyle = `rgba(0,0,0,${clamp(pose.damage, 0, 1) * 0.35})`;
    g.beginPath();
    g.ellipse(-4, 0, 9, 5, 0.4, 0, TAU);
    g.fill();
  }
  g.restore();
}

/** Where the muzzle is (for lasers), in ship units. */
export const MUZZLE: Pt = [56, 0];
export const SHIP_LENGTH = 100;
