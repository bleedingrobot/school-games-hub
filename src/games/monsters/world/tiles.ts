/**
 * Drawing the world's pixel art. Every tile is cut out of its sheet once and kept (like Gem
 * Keep's cached sprites), and each map's ground, walls and long grass are painted once onto one
 * small canvas (a frame for each step of water movement). Drawing a frame is then a single
 * copy of the part you can see, scaled up in whole numbers with no smoothing, so the pixels stay crisp.
 */
import type { TiledMap, TiledTileset } from '../../../../shared/monsters/world/mapLoader';
import type { Dir, GameMap } from '../../../../shared/monsters/world/types';
import townSheet from './assets/kenney/tiny-town/tilemap_packed.png';
import dungeonSheet from './assets/kenney/tiny-dungeon/tilemap_packed.png';
import extraSheet from './assets/extra-tiles.png';

export const TILE = 16;
/** The sheets, in the order of the tilesets in every map file (tiny-town, tiny-dungeon, extra-tiles). */
const SHEET_URLS = [townSheet, dungeonSheet, extraSheet];

export type Sheets = HTMLImageElement[];

export function loadSheets(): Promise<Sheets> {
  return Promise.all(
    SHEET_URLS.map(
      (url) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Could not load ${url}`));
          img.src = url;
        }),
    ),
  );
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** The Tiny Dungeon colours that make up a face: skin shades and the dark eyes. */
const SKIN = new Set(['#f7c282', '#e19a65', '#eaa56c', '#262b44']);
const hex = (d: Uint8ClampedArray, i: number) => `#${[d[i], d[i + 1], d[i + 2]].map((n) => n.toString(16).padStart(2, '0')).join('')}`;

export class TileCache {
  private tiles = new Map<number, HTMLCanvasElement>();
  private people = new Map<string, HTMLCanvasElement>();

  constructor(private sheets: Sheets, private tilesets: TiledTileset[]) {}

  /** One 16 × 16 tile by its map number (gid), or null for "nothing". */
  tile(gid: number): HTMLCanvasElement | null {
    if (!gid) return null;
    const hit = this.tiles.get(gid);
    if (hit) return hit;
    const setIndex = this.tilesets.findIndex((t, i) => gid >= t.firstgid && (i === this.tilesets.length - 1 || gid < this.tilesets[i + 1].firstgid));
    const set = this.tilesets[setIndex];
    const img = this.sheets[setIndex];
    if (!set || !img) return null;
    const local = gid - set.firstgid;
    const c = makeCanvas(TILE, TILE);
    c.getContext('2d')!.drawImage(img, (local % set.columns) * TILE, Math.floor(local / set.columns) * TILE, TILE, TILE, 0, 0, TILE, TILE);
    this.tiles.set(gid, c);
    return c;
  }

  /** The tile to show for a gid at animation frame `frame` (water ripples). */
  frameGid(gid: number, frame: number): number {
    for (const set of this.tilesets) {
      const anim = set.tiles?.find((t) => set.firstgid + t.id === gid)?.animation;
      if (anim?.length) return set.firstgid + anim[frame % anim.length].tileid;
    }
    return gid;
  }

  /**
   * A person from the Tiny Dungeon sheet, facing a way. The pack has one picture per person, so
   * left and right slide the face over a pixel (and mirror it), and facing up paints the face over
   * with their hair, as if you see the back of their head.
   */
  person(sprite: number, dir: Dir): HTMLCanvasElement | null {
    const key = `${sprite}:${dir}`;
    const hit = this.people.get(key);
    if (hit) return hit;
    const base = this.tile(this.tilesets[1].firstgid + sprite);
    if (!base) return null;
    const c = makeCanvas(TILE, TILE);
    const ctx = c.getContext('2d')!;
    if (dir === 'down') {
      ctx.drawImage(base, 0, 0);
    } else {
      const bctx = base.getContext('2d')!;
      const src = bctx.getImageData(0, 0, TILE, TILE);
      const out = ctx.createImageData(TILE, TILE);
      out.data.set(src.data);
      const px = (x: number, y: number) => (y * TILE + x) * 4;
      // The hair colour: what most of the head's top rows are made of (not the dark outline).
      const counts = new Map<string, number>();
      for (let y = 2; y <= 4; y++) for (let x = 3; x <= 12; x++) {
        const i = px(x, y);
        if (src.data[i + 3] && !SKIN.has(hex(src.data, i)) && hex(src.data, i) !== '#3f2631') counts.set(hex(src.data, i), (counts.get(hex(src.data, i)) ?? 0) + 1);
      }
      const hair = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const hairRgb = hair ? [1, 3, 5].map((s) => parseInt(hair.slice(s, s + 2), 16)) : null;
      const put = (x: number, y: number, rgb: number[] | Uint8ClampedArray, from = 0) => {
        const i = px(x, y);
        out.data[i] = rgb[from]; out.data[i + 1] = rgb[from + 1]; out.data[i + 2] = rgb[from + 2]; out.data[i + 3] = 255;
      };
      if (dir === 'up' && hairRgb) {
        for (let y = 5; y <= 9; y++) for (let x = 3; x <= 12; x++) if (SKIN.has(hex(src.data, px(x, y)))) put(x, y, hairRgb);
      } else if (hairRgb) {
        const shift = dir === 'left' ? -1 : 1;
        for (let y = 5; y <= 9; y++) {
          for (let x = 3; x <= 12; x++) {
            const sx = x - shift;
            const here = SKIN.has(hex(src.data, px(x, y)));
            const there = sx >= 3 && sx <= 12 && SKIN.has(hex(src.data, px(sx, y)));
            if (there) put(x, y, src.data, px(sx, y));
            else if (here) put(x, y, hairRgb);
          }
        }
      }
      ctx.putImageData(out, 0, 0);
    }
    this.people.set(key, c);
    return c;
  }
}

/** The map painted once: `frames` canvases (more than one when some tile animates). */
export function paintMap(map: GameMap, raw: TiledMap, cache: TileCache): HTMLCanvasElement[] {
  const animated = raw.tilesets.some((s) => s.tiles?.length) && [...map.ground, ...map.walls, ...map.grass].some((g) => cache.frameGid(g, 1) !== g);
  const frames: HTMLCanvasElement[] = [];
  for (let f = 0; f < (animated ? 2 : 1); f++) {
    const c = makeCanvas(map.width * TILE, map.height * TILE);
    const ctx = c.getContext('2d')!;
    for (const layer of [map.ground, map.grass, map.walls]) {
      layer.forEach((gid, i) => {
        const t = cache.tile(cache.frameGid(gid, f));
        if (t) ctx.drawImage(t, (i % map.width) * TILE, Math.floor(i / map.width) * TILE);
      });
    }
    frames.push(c);
  }
  return frames;
}
