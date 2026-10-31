/**
 * Wrapping a painted surface map round a ball, so a planet turns like a globe instead of a picture sliding inside a
 * circle (docs/TRADER-ART-PLAN.md, section 3).
 *
 * For each size of planet the game works out once which point of the map every pixel inside the circle shows (a lookup
 * table). Each frame then only shifts the longitude and copies pixels from the map through the table: features near
 * the edge squash and slow down, features in the middle move fastest, as on a real globe. No maths per pixel per frame,
 * so a 250 px planet on a slow Chromebook is a few hundredths of a millisecond per thousand pixels.
 */

/** Which map pixel each globe pixel shows, for one globe size and one map size. */
export interface GlobeTable {
  /** The globe is drawn into a size × size square. */
  size: number;
  mapW: number;
  mapH: number;
  /** How many pixels of the square are on the ball. */
  count: number;
  /** For each of them: where it is in the square (y × size + x), the start of its map row, and its map column when the planet hasn't turned. */
  at: Uint32Array;
  row: Uint32Array;
  col: Uint32Array;
}

/**
 * Builds the table. The ball is seen side-on (orthographic): the middle column of the square shows the map's middle
 * longitude, the left and right edges show a quarter turn either side, and the top row is the map's top (north).
 */
export function buildGlobeTable(size: number, mapW: number, mapH: number): GlobeTable {
  const at: number[] = [];
  const row: number[] = [];
  const col: number[] = [];
  const half = size / 2;
  // Half a pixel's grace round the rim so the circle clip never shows a gap.
  const edge = 1 + 0.5 / half;
  for (let py = 0; py < size; py++) {
    const y = (py + 0.5 - half) / half;
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5 - half) / half;
      const d2 = x * x + y * y;
      if (d2 > edge * edge) continue;
      const k = d2 > 1 ? 1 / Math.sqrt(d2) : 1;
      const cx = x * k;
      const cy = y * k;
      const z = Math.sqrt(Math.max(0, 1 - cx * cx - cy * cy));
      const lon = Math.atan2(cx, z); // -π/2 … π/2
      const lat = Math.asin(cy); // -π/2 (top) … π/2 (bottom)
      const u = 0.5 + lon / (2 * Math.PI);
      const v = 0.5 + lat / Math.PI;
      at.push(py * size + px);
      row.push(Math.min(mapH - 1, Math.floor(v * mapH)) * mapW);
      col.push(Math.min(mapW - 1, Math.floor(u * mapW)));
    }
  }
  return { size, mapW, mapH, count: at.length, at: Uint32Array.from(at), row: Uint32Array.from(row), col: Uint32Array.from(col) };
}

/**
 * Fills `out` (size × size pixels, as 32-bit RGBA) with the globe turned by `turn` (0 to 1 is once round). The surface
 * moves left to right, as the drawn planets always have. Pixels off the ball are left as they are (clear them once).
 */
export function spinGlobe(table: GlobeTable, map: Uint32Array, out: Uint32Array, turn: number): void {
  const { count, at, row, col, mapW } = table;
  const shift = Math.floor((((turn % 1) + 1) % 1) * mapW);
  for (let i = 0; i < count; i++) {
    let c = col[i] - shift;
    if (c < 0) c += mapW;
    out[at[i]] = map[row[i] + c];
  }
}
