/**
 * Draws the land from its cells onto one off-screen canvas, at the screen's resolution, and redraws
 * only the part that changed after a shot (docs/ARCHERY-PLAN.md, section 10).
 *
 * Layers, all cut out with smooth outlines (contour.ts): textured rock (rock.ts), the darker fresh
 * earth round craters, each world's top band on the land's ORIGINAL surface only (grass and flowers,
 * sand ripples, thick snow with icicles, paving and rubble), the Forest's pines, the City's buildings,
 * light from the upper left (faces that rise are lit, faces that fall away are shaded), the Snow's
 * see-through ice, and a thin dark cartoon outline.
 */
import { CELL, COLS, ROWS } from '../../../../shared/archery/config';
import { AIR, BUILDING, DIRT, ICE, TREE, type WorldId } from '../../../../shared/archery/types';
import { buildContour } from './contour';
import type { Layout } from './layout';
import { columnTops, fieldCanvas, findProps, paintProps, paintRock, type PropInfo } from './rock';
import { OL, TAU, hash2, rgba } from './util';
import type { Palette } from './worlds';

export interface Rect { x0: number; y0: number; x1: number; y1: number }

const CAP_DEPTH: Record<WorldId, [number, number]> = { forest: [3, 4], desert: [3, 5], snow: [4, 6], city: [2, 3] };
const CAP_SLOPE: Record<WorldId, number> = { forest: 2, desert: 2, snow: 3, city: 1 };

export class LandArt {
  canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  /** Device px per field px. */
  k = 1;
  below = 0;
  /** CSS px per field px (for line widths). */
  private s = 1;
  rockTex!: HTMLCanvasElement;
  private props: PropInfo;
  /** The top band at the start of the round (grass, sand, snow, paving). */
  private cap: Uint8Array;
  /** Cells a shot has changed this round: no fresh grass grows on them. */
  private disturbed: Uint8Array;
  /** Cells a shot has emptied this round (their neighbours show fresh earth). */
  private cleared: Uint8Array;
  private tops: Int16Array;
  cells: Uint8Array;

  constructor(L: Layout, readonly world: WorldId, readonly pal: Palette, cells: Uint8Array, private simple: boolean) {
    this.cells = cells.slice();
    this.disturbed = new Uint8Array(cells.length);
    this.cleared = new Uint8Array(cells.length);
    this.tops = columnTops(cells, (v) => v === DIRT);
    this.cap = this.makeCap();
    this.props = findProps(cells);
    const { c, g } = fieldCanvas(1, 0);
    this.canvas = c;
    this.g = g;
    this.relayout(L, simple);
  }

  /** New size or quality: new textures, then the whole land again. */
  relayout(L: Layout, simple: boolean) {
    this.simple = simple;
    this.k = L.s * L.ratio;
    this.s = L.s;
    this.below = L.below;
    // One texture for everything: rock, with the trees and buildings painted where they stand.
    this.rockTex = paintRock(this.k, this.below, this.pal, this.world, this.tops, simple);
    paintProps(this.rockTex, this.k, this.pal, this.props);
    this.canvas.width = Math.ceil(960 * this.k);
    this.canvas.height = Math.ceil((540 + this.below) * this.k);
    this.render(null);
  }

  private makeCap(): Uint8Array {
    const cap = new Uint8Array(COLS * ROWS);
    const [d0, d1] = CAP_DEPTH[this.world];
    const lim = CAP_SLOPE[this.world];
    const t = this.tops;
    for (let c = 0; c < COLS; c++) {
      if (t[c] >= ROWS) continue;
      const l = c > 0 ? t[c - 1] : t[c], r = c < COLS - 1 ? t[c + 1] : t[c];
      const slope = Math.max(Math.abs(l - t[c]), Math.abs(r - t[c]));
      if (slope > lim) continue;
      const depth = d0 + Math.floor(hash2(c, 3, this.pal.seed) * (d1 - d0 + 1));
      for (let k = 0; k < depth && t[c] + k < ROWS; k++) {
        const i = (t[c] + k) * COLS + c;
        if (this.cells[i] === DIRT) cap[i] = 1;
      }
    }
    return cap;
  }

  /** Shows new cells. Redraws only around what changed, and remembers what the shot disturbed. Returns the redrawn area. */
  update(next: Uint8Array): Rect | null {
    let c0 = COLS, c1 = -1, r0 = ROWS, r1 = -1;
    const cur = this.cells;
    for (let i = 0; i < next.length; i++) {
      if (cur[i] === next[i]) continue;
      this.disturbed[i] = 1;
      if (next[i] === AIR) this.cleared[i] = 1;
      const c = i % COLS, r = (i / COLS) | 0;
      if (c < c0) c0 = c;
      if (c > c1) c1 = c;
      if (r < r0) r0 = r;
      if (r > r1) r1 = r;
    }
    this.cells = next.slice();
    if (c1 < 0) return null;
    const m = 34;
    const rect: Rect = {
      x0: Math.max(0, c0 * CELL - m), y0: Math.max(-20, r0 * CELL - m),
      x1: Math.min(960, (c1 + 1) * CELL + m), y1: Math.min(540 + this.below, (r1 + 1) * CELL + m),
    };
    this.render(rect);
    return rect;
  }

  /** Draws the land (all of it, or only inside `rect`, in field px). */
  render(rect: Rect | null) {
    const g = this.g, k = this.k, cells = this.cells, pal = this.pal, world = this.world;
    const H = 540 + this.below;
    const R = rect ?? { x0: 0, y0: -20, x1: 960, y1: H };
    const n = COLS * ROWS;
    const union = new Uint8Array(n), tree = new Uint8Array(n), bld = new Uint8Array(n), ice = new Uint8Array(n);
    const cap = new Uint8Array(n), scar = new Uint8Array(n);
    let anyTree = false, anyBld = false, anyIce = false, anyScar = false;
    for (let i = 0; i < n; i++) {
      const v = cells[i];
      if (v === AIR) continue;
      if (v === ICE) {
        ice[i] = 1;
        anyIce = true;
        continue;
      }
      union[i] = 1;
      if (v === TREE) {
        tree[i] = 1;
        anyTree = true;
      } else if (v === BUILDING) {
        bld[i] = 1;
        anyBld = true;
      } else {
        if (this.cap[i] && !this.disturbed[i]) cap[i] = 1;
        if (this.disturbed[i] || this.nearCleared(i)) {
          scar[i] = 1;
          anyScar = true;
        }
      }
    }
    const U = buildContour(union, this.below + 10);
    const lw = Math.min(2.4, Math.max(1.1, 1.5 / this.s));

    g.save();
    g.setTransform(k, 0, 0, k, 0, 0);
    g.beginPath();
    g.rect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0);
    g.clip();
    g.clearRect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0);
    g.lineCap = 'round';
    g.lineJoin = 'round';

    // Rock, fresh earth and the world's top band.
    g.save();
    g.clip(U.fill);
    this.blit(this.rockTex, R);
    if (anyScar) {
      const S = buildContour(scar);
      g.fillStyle = rgba(pal.scar, 0.32);
      g.fill(S.fill);
    }
    const C = buildContour(cap);
    g.save();
    g.translate(0, world === 'snow' ? 3.2 : 2.2);
    g.fillStyle = rgba(pal.surfShade, world === 'snow' ? 0.55 : 0.5);
    g.fill(C.fill);
    g.restore();
    g.fillStyle = pal.surf;
    g.fill(C.fill);
    g.save();
    g.clip(C.fill);
    this.capDetails(R);
    g.translate(0, 1.4);
    g.fillStyle = pal.surf2;
    g.globalAlpha = world === 'snow' ? 0.9 : 0.8;
    g.fill(C.outside, 'evenodd');
    g.globalAlpha = 1;
    g.restore();
    if (world === 'snow') this.icicles(R, cap);
    g.restore();

    // Trees and buildings, cut from their textures.
    let T = null, B = null;
    if (anyTree) {
      T = buildContour(tree);
      g.fillStyle = '#245a37';
      g.fill(T.fill);
      g.save();
      g.clip(T.fill);
      this.blit(this.rockTex, R);
      g.restore();
    }
    if (anyBld) {
      B = buildContour(bld);
      g.fillStyle = '#3b2c44';
      g.fill(B.fill);
      g.save();
      g.clip(B.fill);
      this.blit(this.rockTex, R);
      g.restore();
    }

    // Light from the upper left.
    g.save();
    g.clip(U.fill);
    const passes: [number, number, string][] = this.simple
      ? [[-1.2, -0.8, 'rgba(255,248,235,.34)'], [1.6, 1, 'rgba(20,8,24,.3)'], [9, 5, 'rgba(20,8,24,.18)']]
      : [
          [-1.2, -0.8, 'rgba(255,248,235,.4)'], [-5, -3, 'rgba(255,245,225,.14)'],
          [1.6, 1, 'rgba(20,8,24,.34)'], [5, 3, 'rgba(20,8,24,.2)'], [14, 8, 'rgba(20,8,24,.15)'], [32, 18, 'rgba(20,8,24,.12)'],
        ];
    for (const [dx, dy, col] of passes) {
      g.save();
      g.translate(dx, dy);
      g.fillStyle = col;
      g.fill(U.outside, 'evenodd');
      g.restore();
    }
    g.restore();

    // The Snow's ice: see-through blue blocks with bright edges and glints.
    if (anyIce) {
      const I = buildContour(ice);
      g.fillStyle = 'rgba(190,232,255,.62)';
      g.fill(I.fill);
      g.save();
      g.clip(I.fill);
      const ig = g.createLinearGradient(0, R.y0, 0, R.y1);
      ig.addColorStop(0, 'rgba(255,255,255,.25)');
      ig.addColorStop(1, 'rgba(60,140,210,.25)');
      g.fillStyle = ig;
      g.fillRect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0);
      for (const [dx, dy, col] of [[-1.3, -1.3, 'rgba(255,255,255,.85)'], [1.4, 1.4, 'rgba(40,100,170,.35)']] as const) {
        g.save();
        g.translate(dx, dy);
        g.fillStyle = col;
        g.fill(I.outside, 'evenodd');
        g.restore();
      }
      g.strokeStyle = 'rgba(255,255,255,.55)';
      g.lineWidth = 1;
      g.beginPath();
      for (let x = Math.floor(R.x0 / 14) * 14 - 40; x < R.x1 + 40; x += 14) {
        g.moveTo(x, R.y1);
        g.lineTo(x + (R.y1 - R.y0) * 0.6, R.y0);
      }
      g.globalAlpha = 0.35;
      g.stroke();
      g.globalAlpha = 1;
      g.restore();
      g.strokeStyle = '#3f78b0';
      g.lineWidth = lw * 0.8;
      g.stroke(I.edges);
    }

    // Cartoon outlines.
    g.strokeStyle = OL;
    g.lineWidth = lw;
    g.stroke(U.edges);
    if (T) {
      g.strokeStyle = '#123320';
      g.lineWidth = lw * 0.7;
      g.stroke(T.edges);
    }
    if (B) {
      g.strokeStyle = '#24162a';
      g.lineWidth = lw * 0.7;
      g.stroke(B.edges);
    }
    this.topDetails(R, cap);
    g.restore();
  }

  private nearCleared(i: number): boolean {
    const c = i % COLS, r = (i / COLS) | 0;
    for (let dr = -2; dr <= 2; dr++) {
      const rr = r + dr;
      if (rr < 0 || rr >= ROWS) continue;
      for (let dc = -2; dc <= 2; dc++) {
        const cc = c + dc;
        if (cc < 0 || cc >= COLS) continue;
        if (this.cleared[rr * COLS + cc]) return true;
      }
    }
    return false;
  }

  private blit(src: HTMLCanvasElement, R: Rect) {
    const k = this.k;
    const sx = Math.max(0, Math.floor(R.x0 * k)), sy = Math.max(0, Math.floor(R.y0 * k));
    const sw = Math.min(src.width - sx, Math.ceil((R.x1 - R.x0) * k) + 2), sh = Math.min(src.height - sy, Math.ceil((R.y1 - R.y0) * k) + 2);
    if (sw <= 0 || sh <= 0) return;
    this.g.drawImage(src, sx, sy, sw, sh, sx / k, sy / k, sw / k, sh / k);
  }

  /** Texture inside the top band (the band is the clip). */
  private capDetails(R: Rect) {
    const g = this.g;
    if (this.world === 'desert') {
      // Wind ripples.
      g.strokeStyle = 'rgba(190,130,60,.35)';
      g.lineWidth = 0.7;
      g.beginPath();
      for (let y = Math.floor(R.y0 / 3.4) * 3.4; y < R.y1; y += 3.4) {
        for (let x = R.x0; x <= R.x1; x += 4) {
          const yy = y + Math.sin(x / 7 + y) * 0.9;
          if (x === R.x0) g.moveTo(x, yy);
          else g.lineTo(x, yy);
        }
      }
      g.stroke();
    } else if (this.world === 'city') {
      // Paving slabs.
      g.strokeStyle = 'rgba(50,40,70,.45)';
      g.lineWidth = 0.7;
      g.beginPath();
      for (let x = Math.floor(R.x0 / 12) * 12; x < R.x1; x += 12) {
        g.moveTo(x, R.y0);
        g.lineTo(x, R.y1);
      }
      g.stroke();
    } else if (this.world === 'forest') {
      // Turf texture: little darker tufts.
      g.strokeStyle = 'rgba(30,90,30,.4)';
      g.lineWidth = 0.6;
      g.beginPath();
      for (let c = Math.max(0, Math.floor(R.x0 / CELL)); c < Math.min(COLS, Math.ceil(R.x1 / CELL)); c++) {
        const t = this.tops[c];
        if (t >= ROWS) continue;
        for (let q = 0; q < 2; q++) {
          const x = c * CELL + hash2(c, q, 11) * 3, y = t * CELL + 3 + hash2(c, q, 12) * 5;
          g.moveTo(x, y);
          g.lineTo(x + 0.6, y - 1.6);
        }
      }
      g.stroke();
    } else {
      // Snow: soft blue shading low in the band.
      for (let c = Math.max(0, Math.floor(R.x0 / CELL)); c < Math.min(COLS, Math.ceil(R.x1 / CELL)); c++) {
        const t = this.tops[c];
        if (t >= ROWS) continue;
        g.fillStyle = 'rgba(150,190,235,.35)';
        g.fillRect(c * CELL, t * CELL + 7, CELL, 14);
      }
    }
  }

  /** Icicles hanging under the snow where it meets bare rock (drawn inside the rock's clip). */
  private icicles(R: Rect, cap: Uint8Array) {
    const g = this.g;
    g.beginPath();
    for (let c = Math.max(0, Math.floor(R.x0 / CELL) - 1); c < Math.min(COLS, Math.ceil(R.x1 / CELL) + 1); c++) {
      if (hash2(c, 5) > 0.42) continue;
      let last = -1;
      for (let r = 0; r < ROWS; r++) {
        const i = r * COLS + c;
        if (cap[i]) last = r;
        else if (last >= 0) break;
      }
      if (last < 0) continue;
      const x = c * CELL + 1.5, y = (last + 1) * CELL + 0.5;
      const len = 2.5 + hash2(c, 6) * 4;
      g.moveTo(x - 1.3, y);
      g.lineTo(x, y + len);
      g.lineTo(x + 1.3, y);
    }
    g.fillStyle = 'rgba(225,242,255,.95)';
    g.fill();
    g.strokeStyle = 'rgba(70,120,180,.6)';
    g.lineWidth = 0.5;
    g.stroke();
  }

  /** Grass blades and flowers, desert tufts, snow sparkles, city rubble: on the band's top edge only. */
  private topDetails(R: Rect, cap: Uint8Array) {
    const g = this.g, cells = this.cells, pal = this.pal, w = this.world;
    const cFrom = Math.max(0, Math.floor(R.x0 / CELL) - 2), cTo = Math.min(COLS, Math.ceil(R.x1 / CELL) + 2);
    const tops: number[] = [];
    for (let c = cFrom; c < cTo; c++) {
      let top = -1;
      for (let r = 0; r < ROWS; r++) {
        const v = cells[r * COLS + c];
        if (v === AIR) continue;
        if (v === DIRT && cap[r * COLS + c]) top = r;
        break;
      }
      tops.push(top);
    }
    if (w === 'forest') {
      for (const [col, hmax, salt] of [[pal.surfShade, 3.2, 1], [pal.surf, 4.5, 2], [pal.surf2, 2.6, 3]] as const) {
        g.beginPath();
        for (let c = cFrom; c < cTo; c++) {
          const top = tops[c - cFrom];
          if (top < 0) continue;
          const y = top * CELL + 1.4;
          for (let q = 0; q < 2; q++) {
            const x = c * CELL + 0.6 + q * 1.5 + hash2(c, q, salt) * 0.8;
            const ht = 1.2 + hash2(c, q + 4, salt) * hmax, lean = (hash2(c, q + 8, salt) - 0.5) * 2.6;
            g.moveTo(x - 0.9, y);
            g.lineTo(x + lean, y - ht);
            g.lineTo(x + 0.9, y);
          }
        }
        g.fillStyle = col;
        g.fill();
      }
      for (let c = cFrom; c < cTo; c++) {
        const top = tops[c - cFrom];
        if (top < 0 || hash2(c, 77) > 0.045) continue;
        const x = c * CELL + 1.5, y = top * CELL - 2.2;
        g.fillStyle = hash2(c, 78) < 0.5 ? '#ffffff' : hash2(c, 79) < 0.5 ? '#ffd23f' : '#ff8fb8';
        for (let q = 0; q < 5; q++) {
          g.beginPath();
          g.arc(x + Math.cos(q * 1.26) * 1.3, y + Math.sin(q * 1.26) * 1.3, 1, 0, TAU);
          g.fill();
        }
        g.fillStyle = '#ff9f43';
        g.beginPath();
        g.arc(x, y, 0.8, 0, TAU);
        g.fill();
      }
    } else if (w === 'desert') {
      g.beginPath();
      for (let c = cFrom; c < cTo; c++) {
        const top = tops[c - cFrom];
        if (top < 0 || hash2(c, 41) > 0.05) continue;
        const x = c * CELL + 1.5, y = top * CELL + 1.2;
        for (let q = -2; q <= 2; q++) {
          g.moveTo(x, y);
          g.lineTo(x + q * 1.6, y - 2.5 - hash2(c, q + 50) * 2.5);
        }
      }
      g.strokeStyle = '#9a6a2c';
      g.lineWidth = 0.8;
      g.stroke();
    } else if (w === 'snow') {
      g.fillStyle = 'rgba(255,255,255,.95)';
      for (let c = cFrom; c < cTo; c++) {
        const top = tops[c - cFrom];
        if (top < 0 || hash2(c, 61) > 0.12) continue;
        const x = c * CELL + hash2(c, 62) * 3, y = top * CELL + 2 + hash2(c, 63) * 6;
        g.fillRect(x - 0.9, y - 0.25, 1.8, 0.5);
        g.fillRect(x - 0.25, y - 0.9, 0.5, 1.8);
      }
    } else {
      for (let c = cFrom; c < cTo; c++) {
        const top = tops[c - cFrom];
        if (top < 0 || hash2(c, 71) > 0.07) continue;
        const x = c * CELL + 1.5, y = top * CELL;
        const rx = 1 + hash2(c, 72) * 1.4;
        g.fillStyle = '#7d7290';
        g.beginPath();
        g.ellipse(x, y, rx, rx * 0.65, 0, Math.PI, TAU);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,.4)';
        g.fillRect(x - rx * 0.5, y - rx * 0.5, rx * 0.6, 0.4);
      }
    }
  }
}
