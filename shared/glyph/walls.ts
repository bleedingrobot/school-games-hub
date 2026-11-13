/**
 * Making a wall (docs/GLYPH-PLAN.md, "How a wall works"): from a seed, a gold stone, a glyph, the right tiles on the
 * glyph's cells, trap tiles from named mistakes everywhere else, and three trap glyphs, each the right glyph with one
 * right cell swapped for a trap cell (the shape that mistake would light). Same seed, same wall, in the browser and on
 * the server.
 */
import { seededRandom } from '../maths/serverQuestions';
import { CELLS, GLYPH_CHOICES, REVIEW_EVERY, TEMPLES, WALLS_PER_TEMPLE, templeById, type TempleSpec, type TrapKind } from './config';
import { equal, fits, gcd, sameFrac, simplest, trapTile, type Frac } from './fractions';
import { glyphsOfSize, sameCells } from './glyphs';

export interface Wall {
  /** Which temple's kind this wall is (an earlier one on a review wall). */
  kind: number;
  gold: Frac;
  tiles: Frac[];
  /** The four glyphs in the order shown. */
  glyphs: number[][];
  /** Which of `glyphs` is right. */
  answer: number;
  /** The right cells (the right glyph). */
  right: number[];
  /** The mistake each trap tile was made from (null on right cells). */
  traps: (TrapKind | null)[];
}

const intIn = (r: () => number, from: number, to: number) => from + Math.floor(r() * (to - from + 1));
const pick = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)];
function shuffle<T>(r: () => number, list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function goldFor(spec: TempleSpec, r: () => number): Frac {
  for (;;) {
    const d = pick(r, spec.bottoms);
    const n = intIn(r, 1, d - 1);
    if (gcd(n, d) !== 1) continue;
    if (!spec.unsimplified) return { n, d };
    const k = intIn(r, 2, 4);
    return { n: n * k, d: d * k };
  }
}

/** Right tiles for the gold stone: `count` of them, different from the gold stone, at most one repeat. */
function rightTiles(spec: TempleSpec, gold: Frac, count: number, r: () => number): Frac[] | null {
  const base = simplest(gold);
  const pool: Frac[] = [];
  for (let k = 1; k <= (spec.unsimplified ? 6 : spec.times[1]); k++) {
    const f = { n: base.n * k, d: base.d * k };
    if (k < spec.times[0] && !(spec.unsimplified && k === 1)) continue;
    if (fits(f) && !sameFrac(f, gold)) pool.push(f);
  }
  if (pool.length < count - 1) return null;
  const tiles = shuffle(r, [...pool]).slice(0, count);
  // A temple-4 wall always includes the simplest form (the thing temple 4 teaches).
  if (spec.unsimplified && !tiles.some((t) => sameFrac(t, base))) tiles[0] = base;
  while (tiles.length < count) tiles.push(pick(r, tiles));
  return tiles;
}

/** One wall of a temple kind, from a random number source. Tries again until every rule holds. */
export function makeWall(kind: number, r: () => number): Wall {
  const spec = templeById(kind);
  if (!spec) throw new Error(`no temple ${kind}`);
  for (let attempt = 0; attempt < 200; attempt++) {
    const gold = goldFor(spec, r);
    const size = intIn(r, spec.size[0], spec.size[1]);
    const shapes = glyphsOfSize(size);
    if (!shapes.length) continue;
    const right = [...pick(r, shapes)];
    const rights = rightTiles(spec, gold, size, r);
    if (!rights) continue;
    const tiles: (Frac | null)[] = Array(CELLS).fill(null);
    const traps: (TrapKind | null)[] = Array(CELLS).fill(null);
    shuffle(r, rights).forEach((f, i) => (tiles[right[i]] = f));
    let ok = true;
    const kinds = shuffle(r, [...spec.traps]);
    let k = 0;
    for (let cell = 0; cell < CELLS && ok; cell++) {
      if (tiles[cell]) continue;
      let made: Frac | null = null;
      for (let t = 0; t < spec.traps.length * 3 && !made; t++) {
        const kindNow = kinds[(k + t) % kinds.length];
        const f = trapTile(gold, kindNow, r, spec.times);
        // No two trap tiles the same, so each mistake shows once.
        if (f && !tiles.some((x) => x && sameFrac(x, f))) {
          made = f;
          traps[cell] = kindNow;
        }
      }
      k++;
      if (!made) ok = false;
      else tiles[cell] = made;
    }
    if (!ok) continue;
    const full = tiles as Frac[];
    if (full.some((t, cell) => equal(t, gold) !== right.includes(cell))) continue;
    // Trap glyphs: swap one right cell (biggest numbers first, the one a child most often misses) for a trap cell.
    const rightByBig = [...right].sort((a, b) => full[b].d - full[a].d);
    const trapCells = shuffle(
      r,
      full.map((_, c) => c).filter((c) => !right.includes(c)),
    );
    const decoys: number[][] = [];
    for (const out of rightByBig) {
      for (const inn of trapCells) {
        const g = [...right.filter((c) => c !== out), inn].sort((a, b) => a - b);
        if (decoys.length < GLYPH_CHOICES - 1 && !decoys.some((d) => sameCells(d, g))) {
          decoys.push(g);
          break;
        }
      }
    }
    if (decoys.length < GLYPH_CHOICES - 1) continue;
    const glyphs = shuffle(r, [right.sort((a, b) => a - b), ...decoys]);
    const answer = glyphs.findIndex((g) => sameCells(g, right));
    return { kind, gold, tiles: full, glyphs, answer, right, traps };
  }
  throw new Error(`could not make a wall for temple ${kind}`);
}

/** The kind of each wall in a temple go: walls 3, 6 and 9 review an earlier temple from temple 2 on. */
export function wallKinds(temple: number, r: () => number): number[] {
  return Array.from({ length: WALLS_PER_TEMPLE }, (_, i) =>
    temple > 1 && (i + 1) % REVIEW_EVERY === 0 ? intIn(r, 1, temple - 1) : temple,
  );
}

/** A whole temple go from its seed. The server keeps only the seed; the walls come back the same every time. */
export function makeTemple(seed: string, temple: number): Wall[] {
  if (!TEMPLES.some((t) => t.id === temple)) throw new Error(`no temple ${temple}`);
  const r = seededRandom(`glyph:${temple}:${seed}`);
  return wallKinds(temple, r).map((kind) => makeWall(kind, r));
}

/** What the browser is sent: no answer, no right cells, no trap names. */
export interface PublicWall {
  kind: number;
  gold: Frac;
  tiles: Frac[];
  glyphs: number[][];
}
export const publicWall = ({ kind, gold, tiles, glyphs }: Wall): PublicWall => ({ kind, gold, tiles, glyphs });
