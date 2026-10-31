/**
 * Smooth outlines from the land's 3 px cells (marching squares), so the land never shows 3 px
 * stair-steps. Each cell is sampled at its middle. The cells are softened a little (a 3 × 3 blur)
 * before the outline is found, but every solid cell's middle always stays inside and every empty
 * cell's middle outside, so the picture never hides a cell the rules still have (or shows one
 * they don't): only the edge between two cells moves, to follow the slope.
 */
import { CELL, COLS, ROWS } from '../../../../shared/archery/config';

export interface Contour {
  /** The inside, as non-overlapping pieces (fill it, clip with it). */
  fill: Path2D;
  /** The same pieces plus one huge rectangle: filled 'evenodd', it's everything outside. */
  outside: Path2D;
  /** The outline, as short segments (stroke it with round caps). */
  edges: Path2D;
}

const GW = COLS + 2;
const GH = ROWS + 2;

/**
 * `inside[i]` for each cell (1 = inside). `below` > 0 treats the rows under the field as inside, and
 * adds that many field px of solid ground under the field.
 */
export function buildContour(inside: Uint8Array, below = 0): Contour {
  const solidBelow = below > 0;
  const b = new Uint8Array(GW * GH);
  for (let r = 0; r < ROWS; r++) {
    const row = (r + 1) * GW + 1;
    for (let c = 0; c < COLS; c++) b[row + c] = inside[r * COLS + c];
  }
  if (solidBelow) for (let c = 1; c <= COLS; c++) b[(GH - 1) * GW + c] = 1;
  // Soften, then keep each sample on its own side of the line.
  const v = new Float32Array(GW * GH);
  const at = (c: number, r: number) => {
    if (c < 0) c = 0;
    else if (c >= GW) c = GW - 1;
    if (r < 0) r = 0;
    else if (r >= GH) r = GH - 1;
    // Off the sides is always empty; under the bottom repeats the bottom row.
    if (c === 0 || c === GW - 1) return 0;
    return b[r * GW + c];
  };
  for (let r = 0; r < GH; r++) {
    for (let c = 0; c < GW; c++) {
      const i = r * GW + c;
      const s =
        at(c - 1, r - 1) + 2 * at(c, r - 1) + at(c + 1, r - 1) +
        2 * at(c - 1, r) + 4 * at(c, r) + 2 * at(c + 1, r) +
        at(c - 1, r + 1) + 2 * at(c, r + 1) + at(c + 1, r + 1);
      const f = s / 16;
      v[i] = b[i] ? (f < 0.56 ? 0.56 : f) : f > 0.44 ? 0.44 : f;
    }
  }

  const fill = new Path2D();
  const edges = new Path2D();
  const px: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  const py: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  const iso: boolean[] = [false, false, false, false, false, false, false, false];

  const poly = (n: number) => {
    fill.moveTo(px[0], py[0]);
    for (let k = 1; k < n; k++) fill.lineTo(px[k], py[k]);
    fill.closePath();
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      if (iso[k] && iso[k2]) {
        edges.moveTo(px[k], py[k]);
        edges.lineTo(px[k2], py[k2]);
      }
    }
  };

  for (let j = 0; j < GH - 1; j++) {
    // Grid row j is cell row j - 1; its middle is at ((j - 1) + 0.5) cells.
    const y0 = (j - 0.5) * CELL, y1 = y0 + CELL;
    let runStart = -1;
    for (let i = 0; i < GW - 1; i++) {
      const x0 = (i - 0.5) * CELL, x1 = x0 + CELL;
      const a = v[j * GW + i], bb = v[j * GW + i + 1], c = v[(j + 1) * GW + i + 1], d = v[(j + 1) * GW + i];
      const ia = a >= 0.5, ib = bb >= 0.5, ic = c >= 0.5, id = d >= 0.5;
      const all = ia && ib && ic && id;
      if (all) {
        if (runStart < 0) runStart = x0;
        continue;
      }
      if (runStart >= 0) {
        fill.rect(runStart, y0, x0 - runStart, CELL);
        runStart = -1;
      }
      if (!ia && !ib && !ic && !id) continue;
      const cx = [x0, x1, x1, x0], cy = [y0, y0, y1, y1], cv = [a, bb, c, d], ci = [ia, ib, ic, id];
      const interp = (k: number, k2: number, out: number) => {
        const t = (0.5 - cv[k]) / (cv[k2] - cv[k]);
        px[out] = cx[k] + (cx[k2] - cx[k]) * t;
        py[out] = cy[k] + (cy[k2] - cy[k]) * t;
        iso[out] = true;
      };
      const corner = (k: number, out: number) => {
        px[out] = cx[k];
        py[out] = cy[k];
        iso[out] = false;
      };
      const saddle = ia === ic && ib === id && ia !== ib;
      if (saddle && (a + bb + c + d) / 4 < 0.5) {
        // Two separate corners.
        for (const k of ia ? [0, 2] : [1, 3]) {
          corner(k, 0);
          interp(k, (k + 1) % 4, 1);
          interp((k + 3) % 4, k, 2);
          poly(3);
        }
        continue;
      }
      let n = 0;
      for (let k = 0; k < 4; k++) {
        const k2 = (k + 1) % 4;
        if (ci[k]) corner(k, n++);
        if (ci[k] !== ci[k2]) interp(k, k2, n++);
      }
      poly(n);
    }
    if (runStart >= 0) fill.rect(runStart, y0, (GW - 1.5) * CELL - runStart, CELL);
  }
  if (solidBelow) fill.rect(0, (ROWS + 0.5) * CELL, COLS * CELL, below);
  const outside = new Path2D();
  outside.rect(-5000, -5000, 12000, 12000);
  outside.addPath(fill);
  return { fill, outside, edges };
}
