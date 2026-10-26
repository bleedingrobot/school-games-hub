/**
 * The textures the land is cut from, painted once per round in field px: layered, cracked, blocky
 * rock (Scorched Earth's big cliffs, James 21 Oct 2026), and the Forest's pine trees and the City's
 * buildings at the spots where the round put them.
 */
import { CELL, COLS, ROWS } from '../../../../shared/archery/config';
import { BUILDING, TREE, type WorldId } from '../../../../shared/archery/types';
import { TAU, ctx2d, mk, rgba, rng } from './util';
import type { Palette } from './worlds';

/** A canvas covering the field plus `below` field px under it, at `k` device px per field px. */
export function fieldCanvas(k: number, below: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = mk(960 * k, (540 + below) * k);
  const g = ctx2d(c);
  g.setTransform(k, 0, 0, k, 0, 0);
  return { c, g };
}

/** Each column's first solid row (ROWS if none), from the land at the start of the round. */
export function columnTops(cells: Uint8Array, kindTest: (v: number) => boolean): Int16Array {
  const tops = new Int16Array(COLS).fill(ROWS);
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (kindTest(cells[r * COLS + c])) {
        tops[c] = r;
        break;
      }
    }
  }
  return tops;
}

export function paintRock(k: number, below: number, w: Palette, world: WorldId, tops: Int16Array, simple: boolean): HTMLCanvasElement {
  const { c, g } = fieldCanvas(k, below);
  const H = 540 + below;
  let minTop = 540;
  for (let i = 0; i < tops.length; i++) minTop = Math.min(minTop, tops[i] * CELL);
  const topAt = (x: number) => tops[Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL)))] * CELL;

  // The base: lighter near the top, deep and dark further down, darker still under the field.
  const gr = g.createLinearGradient(0, minTop, 0, 600);
  gr.addColorStop(0, w.soil[0]);
  gr.addColorStop(1, w.soil[1]);
  g.fillStyle = gr;
  g.fillRect(0, 0, 960, H);
  const deep = g.createLinearGradient(0, 520, 0, 560 + below * 0.5);
  deep.addColorStop(0, 'rgba(10,5,10,0)');
  deep.addColorStop(1, 'rgba(10,5,10,.45)');
  g.fillStyle = deep;
  g.fillRect(0, 520, 960, H - 520);

  const r = rng(w.seed * 97 + 13);
  // Big soft blotches of lighter and darker stone, so the rock isn't one flat colour.
  for (let i = 0; i < (simple ? 14 : 30); i++) {
    const x = r() * 960, y = minTop + r() * (600 - minTop), rad = 40 + r() * 90;
    const light = r() < 0.5;
    const bg = g.createRadialGradient(x, y, 0, x, y, rad);
    bg.addColorStop(0, light ? 'rgba(255,235,210,.14)' : 'rgba(30,10,20,.16)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bg;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // Rock facets in tilted layers: irregular slabs, each a little lighter or darker, lit from the upper left.
  for (let y = minTop - 30; y < H;) {
    const rowH = 12 + r() * 16;
    let x = -r() * 50;
    while (x < 960 + 30) {
      const pw = 26 + r() * 52;
      const tilt = 0.05;
      const j = () => (r() - 0.5) * 7;
      const ax = x + j(), ay = y + x * tilt + j();
      const bx = x + pw + j(), by = y + (x + pw) * tilt + j();
      const cx = x + pw + j(), cy = by + rowH + j();
      const dx = x + j(), dy = ay + rowH + j();
      const p = new Path2D();
      p.moveTo(ax, ay);
      p.lineTo(ax + (bx - ax) * 0.4 + j(), ay + (by - ay) * 0.4 + j() - 1.5);
      p.lineTo(bx, by);
      p.lineTo(cx + j() * 0.5, (by + cy) / 2 + j());
      p.lineTo(cx, cy);
      p.lineTo((cx + dx) / 2 + j(), (cy + dy) / 2 + j() + 1.5);
      p.lineTo(dx, dy);
      p.closePath();
      const t = r();
      g.fillStyle = t < 0.5 ? `rgba(255,240,220,${0.02 + t * 0.14})` : `rgba(30,12,20,${0.02 + (t - 0.5) * 0.2})`;
      g.fill(p);
      // Bevel: light top-left edge, dark bottom-right edge.
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(255,245,230,.13)';
      g.beginPath();
      g.moveTo(dx, dy);
      g.lineTo(ax, ay);
      g.lineTo(bx, by);
      g.stroke();
      g.strokeStyle = 'rgba(25,10,10,.24)';
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(cx, cy);
      g.lineTo(dx, dy);
      g.stroke();
      x += pw;
    }
    y += rowH;
  }

  // Layered strata: gently tilted bands of light and dark stone.
  const rs = rng(w.seed * 5);
  for (let y = minTop - 20, kk = 0; y < H + 30; kk++) {
    const th = 9 + rs() * 17;
    g.beginPath();
    for (let x = 0; x <= 960; x += 8) {
      const yy = y + x * 0.05 + 3 * Math.sin(x / 54 + kk);
      if (x) g.lineTo(x, yy);
      else g.moveTo(x, yy);
    }
    for (let x = 960; x >= 0; x -= 8) g.lineTo(x, y + th + x * 0.05 + 3 * Math.sin(x / 54 + kk + 0.5));
    g.closePath();
    g.fillStyle = kk % 3 === 0 ? 'rgba(255,240,220,.12)' : kk % 3 === 1 ? 'rgba(40,20,20,.13)' : 'rgba(120,60,30,.08)';
    g.fill();
    g.beginPath();
    for (let x = 0; x <= 960; x += 8) {
      const yy = y + th + x * 0.05 + 3 * Math.sin(x / 54 + kk + 0.5);
      if (x) g.lineTo(x, yy);
      else g.moveTo(x, yy);
    }
    g.strokeStyle = rgba(w.strata, 0.35);
    g.lineWidth = 1.3;
    g.stroke();
    y += th;
  }

  // Cracks, each with a branch, a light lip and a dark gap.
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const crackCount = simple ? 24 : 40;
  for (let i = 0; i < crackCount; i++) {
    let x = rs() * 960;
    let y = topAt(x) + 14 + rs() * 260;
    const cp: [number, number][] = [[x, y]];
    let an = Math.PI / 2 + (rs() - 0.5) * 1.6;
    const n = 4 + rs() * 5;
    for (let q = 0; q < n; q++) {
      an += (rs() - 0.5) * 1.1;
      const len = 5 + rs() * 10;
      x += Math.cos(an) * len;
      y += Math.sin(an) * len;
      cp.push([x, y]);
    }
    const br = cp[Math.min(2, cp.length - 1)];
    const bp: [number, number][] = [[br[0], br[1]]];
    let bx = br[0], by = br[1], ba = an + (rs() < 0.5 ? -0.9 : 0.9);
    for (let q = 0; q < 3; q++) {
      ba += (rs() - 0.5) * 0.8;
      bx += Math.cos(ba) * 6;
      by += Math.sin(ba) * 6;
      bp.push([bx, by]);
    }
    for (const [col, lw, o] of [['rgba(255,240,220,.22)', 0.8, 0.9], ['rgba(30,15,15,.45)', 1.1, 0]] as const) {
      for (const line of [cp, bp]) {
        g.beginPath();
        line.forEach(([px, py], q) => (q ? g.lineTo(px + o, py + o) : g.moveTo(px + o, py + o)));
        g.strokeStyle = col;
        g.lineWidth = lw;
        g.stroke();
      }
    }
  }

  // Pebbles and boulders.
  const pr = rng(w.seed * 31 + 7);
  for (let i = 0; i < (simple ? 90 : 170); i++) {
    const x = pr() * 960;
    const top = topAt(x);
    const y = top + 12 + pr() * (H - top);
    const rx = 1.5 + pr() * 3.8, ry = rx * (0.55 + pr() * 0.3), rot = pr() * 3;
    g.fillStyle = rgba(w.pebble[0], 0.55);
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot, 0, TAU);
    g.fill();
    g.fillStyle = rgba(w.pebble[1], 0.55);
    g.beginPath();
    g.ellipse(x - rx * 0.25, y - ry * 0.3, rx * 0.45, ry * 0.4, rot, 0, TAU);
    g.fill();
  }
  // Fine grit.
  if (!simple) {
    for (let i = 0; i < 2200; i++) {
      const x = pr() * 960, y = minTop + pr() * (H - minTop);
      g.fillStyle = pr() < 0.5 ? 'rgba(255,245,230,.10)' : 'rgba(20,10,10,.13)';
      g.fillRect(x, y, 0.8 + pr(), 0.8 + pr());
    }
  }
  if (world === 'snow') {
    // Pale ice veins in the rock.
    g.strokeStyle = 'rgba(235,247,255,.5)';
    g.lineWidth = 1.1;
    for (let i = 0; i < 30; i++) {
      let x = pr() * 960, y = topAt(x) + 25 + pr() * 200;
      g.beginPath();
      g.moveTo(x, y);
      for (let q = 0; q < 4; q++) {
        x += 4 + pr() * 8;
        y += (pr() - 0.3) * 8;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  if (world === 'city') {
    // Old foundations: faint brick courses in the ground.
    g.strokeStyle = 'rgba(40,15,20,.16)';
    g.lineWidth = 1;
    for (let y = minTop + 20, row = 0; y < 560; y += 7, row++) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(960, y);
      for (let x = (row % 2) * 8; x < 960; x += 16) {
        g.moveTo(x, y);
        g.lineTo(x, y + 7);
      }
      g.stroke();
    }
  }
  return c;
}

// ——— Trees and buildings ———

export interface PropInfo {
  trees: { cx: number; apex: number; base: number; half: number }[];
  buildings: { c0: number; c1: number; roof: number; base: number; style: number }[];
}

/** Finds the round's trees (each pine's tip) and buildings (runs of columns with one roof height). */
export function findProps(cells: Uint8Array): PropInfo {
  const info: PropInfo = { trees: [], buildings: [] };
  const treeTop = new Int16Array(COLS).fill(ROWS);
  const treeBot = new Int16Array(COLS).fill(-1);
  const bTop = new Int16Array(COLS).fill(ROWS);
  const bBot = new Int16Array(COLS).fill(-1);
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const v = cells[r * COLS + c];
      if (v === TREE) {
        if (treeTop[c] === ROWS) treeTop[c] = r;
        treeBot[c] = r;
      } else if (v === BUILDING) {
        if (bTop[c] === ROWS) bTop[c] = r;
        bBot[c] = r;
      }
    }
  }
  for (let c = 0; c < COLS; c++) {
    const t = treeTop[c];
    if (t === ROWS) continue;
    const l = c > 0 ? treeTop[c - 1] : ROWS, rr2 = c < COLS - 1 ? treeTop[c + 1] : ROWS;
    if (t < l && t <= rr2) {
      // A tip: spread out while the tree keeps sloping down.
      let a = c, b = c;
      while (a > 0 && treeTop[a - 1] < ROWS && treeTop[a - 1] > treeTop[a]) a--;
      while (b < COLS - 1 && treeTop[b + 1] < ROWS && treeTop[b + 1] > treeTop[b]) b++;
      let base = 0;
      for (let q = a; q <= b; q++) base = Math.max(base, treeBot[q]);
      info.trees.push({ cx: c, apex: t, base: base + 1, half: Math.max(c - a, b - c) });
    }
  }
  for (let c = 0; c < COLS;) {
    if (bTop[c] === ROWS) {
      c++;
      continue;
    }
    let e = c;
    while (e + 1 < COLS && bTop[e + 1] === bTop[c]) e++;
    let base = 0;
    for (let q = c; q <= e; q++) base = Math.max(base, bBot[q]);
    info.buildings.push({ c0: c, c1: e, roof: bTop[c], base: base + 1, style: (c * 7 + bTop[c] * 3) % 4 });
    c = e + 1;
  }
  return info;
}

const BUILDING_STYLES = [
  { wall: '#a5543f', wall2: '#7a3a2e', brick: true },
  { wall: '#8d86a8', wall2: '#5f5880', brick: false },
  { wall: '#c49a6c', wall2: '#946b46', brick: true },
  { wall: '#6a8a96', wall2: '#46606c', brick: false },
];

export function paintProps(c: HTMLCanvasElement, k: number, w: Palette, info: PropInfo) {
  const g = ctx2d(c);
  g.setTransform(k, 0, 0, k, 0, 0);
  g.lineJoin = 'round';
  for (const t of info.trees) {
    const x = t.cx * CELL + CELL / 2;
    const top = t.apex * CELL - 1;
    const base = t.base * CELL;
    const h = base - top;
    const half = (t.half + 1) * CELL + 1;
    // Trunk.
    g.fillStyle = '#5b3b24';
    g.fillRect(x - 1.6, base - h * 0.22, 3.2, h * 0.22);
    g.fillStyle = 'rgba(0,0,0,.25)';
    g.fillRect(x + 0.4, base - h * 0.22, 1.2, h * 0.22);
    // Tiers of boughs, each lit on the left and shaded on the right.
    const tiers = h > 50 ? 4 : 3;
    for (let i = 0; i < tiers; i++) {
      const hh = h * 0.84;
      const yBot = top + hh * (1 - i / tiers) + 1;
      const ytip = i === tiers - 1 ? top : Math.max(top, top + hh * (1 - (i + 1.45) / tiers));
      const hw = (half * (yBot - top)) / h + 1;
      g.beginPath();
      g.moveTo(x - hw, yBot);
      g.quadraticCurveTo(x, yBot + 3, x + hw, yBot);
      g.lineTo(x, ytip);
      g.closePath();
      g.fillStyle = w.treeA;
      g.fill();
      g.beginPath();
      g.moveTo(x - hw, yBot);
      g.quadraticCurveTo(x - hw * 0.5, yBot + 2, x, yBot + 2.5);
      g.lineTo(x, ytip);
      g.closePath();
      g.fillStyle = w.treeB;
      g.fill();
      // A dark lip under each tier.
      g.beginPath();
      g.moveTo(x - hw, yBot);
      g.quadraticCurveTo(x, yBot + 3, x + hw, yBot);
      g.strokeStyle = 'rgba(15,40,25,.55)';
      g.lineWidth = 0.9;
      g.stroke();
    }
    // A few needle highlights.
    g.strokeStyle = 'rgba(190,240,170,.35)';
    g.lineWidth = 0.7;
    g.beginPath();
    for (let i = 1; i < 5; i++) {
      const yy = top + h * 0.15 * i;
      g.moveTo(x - 1, yy);
      g.lineTo(x - 3 - i * 0.8, yy + 3);
    }
    g.stroke();
  }
  for (const b of info.buildings) {
    const st = BUILDING_STYLES[b.style];
    const x0 = b.c0 * CELL, x1 = (b.c1 + 1) * CELL, y0 = b.roof * CELL, y1 = b.base * CELL;
    const wg = g.createLinearGradient(x0, 0, x1, 0);
    wg.addColorStop(0, st.wall);
    wg.addColorStop(1, st.wall2);
    g.fillStyle = wg;
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (st.brick) {
      g.strokeStyle = 'rgba(40,15,15,.22)';
      g.lineWidth = 0.5;
      g.beginPath();
      for (let y = y0 + 4, row = 0; y < y1; y += 2.2, row++) {
        g.moveTo(x0, y);
        g.lineTo(x1, y);
        for (let x = x0 + (row % 2) * 2.2; x < x1; x += 4.4) {
          g.moveTo(x, y);
          g.lineTo(x, y + 2.2);
        }
      }
      g.stroke();
    } else {
      // Concrete panels.
      g.strokeStyle = 'rgba(20,15,40,.18)';
      g.lineWidth = 0.6;
      g.beginPath();
      for (let y = y0 + 12; y < y1; y += 12) {
        g.moveTo(x0, y);
        g.lineTo(x1, y);
      }
      g.stroke();
    }
    // Windows: a grid, some lit warm for the dusk.
    const ww = 3.2, wh = 4.2, sx = 6.6, sy = 8;
    const cols = Math.max(1, Math.floor((x1 - x0 - 3) / sx));
    const left = x0 + (x1 - x0 - (cols - 1) * sx - ww) / 2;
    for (let y = y0 + 6, row = 0; y + wh < y1 - 1; y += sy, row++) {
      for (let i = 0; i < cols; i++) {
        const wx = left + i * sx;
        const lit = ((i * 13 + row * 7 + b.c0 * 3) % 10) < 4;
        if (lit) {
          g.fillStyle = 'rgba(255,214,120,.35)';
          g.fillRect(wx - 1, y - 1, ww + 2, wh + 2);
          g.fillStyle = '#ffd98a';
        } else g.fillStyle = '#2a2440';
        g.fillRect(wx, y, ww, wh);
        g.fillStyle = 'rgba(255,255,255,.25)';
        g.fillRect(wx, y, ww, 0.8);
      }
    }
    // Roof edge: a light parapet with a dark line under it.
    g.fillStyle = 'rgba(255,240,230,.55)';
    g.fillRect(x0, y0, x1 - x0, 1.6);
    g.fillStyle = 'rgba(30,15,30,.45)';
    g.fillRect(x0, y0 + 1.6, x1 - x0, 1);
  }
}
