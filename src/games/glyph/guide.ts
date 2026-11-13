/** The guided first wall, made in the browser: gold 1/2, right tiles 2/4, 3/6, 4/8 and 5/10 on a 4-cell glyph, easy traps. */
import type { PublicWall } from '../../../shared/glyph/walls';

const RIGHT = [5, 6, 9, 10];
const TRAPS = [[1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [3, 8], [5, 6], [1, 6], [7, 8]];
const RIGHT_TILES = [[2, 4], [3, 6], [4, 8], [5, 10]];

export function guideWall(): PublicWall {
  const tiles = Array.from({ length: 16 }, () => ({ n: 0, d: 0 }));
  RIGHT.forEach((c, i) => (tiles[c] = { n: RIGHT_TILES[i][0], d: RIGHT_TILES[i][1] }));
  let t = 0;
  tiles.forEach((f, c) => {
    if (!f.d) tiles[c] = { n: TRAPS[t][0], d: TRAPS[t++][1] };
  });
  return {
    kind: 1,
    gold: { n: 1, d: 2 },
    tiles,
    glyphs: [[0, 6, 9, 10], RIGHT, [3, 5, 9, 10], [5, 6, 9, 15]],
  };
}
