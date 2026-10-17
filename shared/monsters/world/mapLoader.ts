/**
 * Loads a map made in the Tiled format (JSON) and checks it, so a mistake in a hand-edited map
 * is found by a test and not by a student walking into a wall.
 *
 * What a map file holds:
 *  - tile layers `ground` (what you see), `walls` (tiles drawn on top that block walking: trees,
 *    houses, fences, water) and `grass` (long grass: walking in it can start a wild battle);
 *  - one object layer `objects`. Every object is a 16 × 16 box on a tile with a `type`:
 *      sign, person, nurse, box, book, closed  - say `text`
 *      trainer  - `text` (challenge), `win` (after), `team` ("species:level,species:level"), `sight`
 *      warp     - `to` (map id), `toX`, `toY`, `facing`: walking onto it takes you there
 *      spot     - a named place (`start`, `wake`, or one the test page can teleport to)
 *      far      - a box of any size: grass inside it is the far half of the area
 *  - map properties: `name`, `area` (0 town, 1-6), `wild` (species ids, comma separated).
 *
 * Text is split into pages at new lines: one page per tap.
 */
import { speciesOf } from '../monsterBook';
import { DIRS, type Dir, type GameMap, type Thing, type ThingKind, type TrainerMonster, type Warp } from './types';

export const TILE_SIZE = 16;

interface TiledProperty {
  name: string;
  type?: string;
  value: string | number | boolean;
}
interface TiledObject {
  id: number;
  name?: string;
  type?: string;
  class?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  properties?: TiledProperty[];
}
interface TiledLayer {
  type: 'tilelayer' | 'objectgroup';
  name: string;
  data?: number[];
  objects?: TiledObject[];
}
export interface TiledTileset {
  firstgid: number;
  name: string;
  image: string;
  tilecount: number;
  columns: number;
  /** Tiles that animate: `id` shows each `animation` frame's `tileid` in turn. */
  tiles?: { id: number; animation: { tileid: number; duration: number }[] }[];
}
export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
  properties?: TiledProperty[];
}

export class MapError extends Error {
  problems: string[];
  constructor(id: string, problems: string[]) {
    super(`Map "${id}" has problems:\n - ${problems.join('\n - ')}`);
    this.problems = problems;
  }
}

const TALKING: ThingKind[] = ['sign', 'person', 'nurse', 'box', 'book', 'closed', 'trainer'];
const NEEDS_FREE_TILE: ThingKind[] = ['person', 'nurse', 'trainer'];

function props(o: { properties?: TiledProperty[] }): Record<string, string | number | boolean> {
  return Object.fromEntries((o.properties ?? []).map((p) => [p.name, p.value]));
}

const text = (v: unknown) => (typeof v === 'string' ? v : '');
const pagesOf = (v: unknown) => text(v).split('\n').map((s) => s.trim()).filter(Boolean);
const num = (v: unknown, fallback: number) => (typeof v === 'number' ? v : fallback);
const dirOf = (v: unknown, fallback: Dir): Dir => (DIRS.includes(v as Dir) ? (v as Dir) : fallback);

/** "multipup-1:5,digibud-1:4" → monsters. Anything that doesn't read cleanly is reported. */
export function parseTeam(value: string, problems: string[], who: string): TrainerMonster[] {
  const team: TrainerMonster[] = [];
  for (const part of value.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [species, level] = part.split(':');
    const n = Number(level);
    try {
      speciesOf(species);
    } catch {
      problems.push(`${who}: "${species}" is not in the monster book`);
      continue;
    }
    if (!Number.isInteger(n) || n < 1 || n > 50) problems.push(`${who}: "${part}" needs a level from 1 to 50`);
    else team.push({ species, level: n });
  }
  if (!team.length) problems.push(`${who}: a trainer needs a team ("species:level,...")`);
  if (team.length > 3) problems.push(`${who}: a trainer has at most 3 monsters`);
  return team;
}

/** Reads a Tiled map. Throws a `MapError` that lists everything wrong with it. */
export function parseMap(id: string, raw: TiledMap): GameMap {
  const problems: string[] = [];
  const { width, height } = raw;
  const size = width * height;
  if (!(width > 0 && height > 0)) problems.push('width and height must be more than 0');
  if (raw.tilewidth !== TILE_SIZE || raw.tileheight !== TILE_SIZE) problems.push(`tiles must be ${TILE_SIZE} × ${TILE_SIZE}`);
  const last = Math.max(0, ...raw.tilesets.map((t) => t.firstgid + t.tilecount - 1));

  const layer = (name: string): number[] => {
    const l = raw.layers.find((x) => x.type === 'tilelayer' && x.name === name);
    if (!l || !l.data) {
      problems.push(`there is no tile layer called "${name}"`);
      return new Array(size).fill(0);
    }
    if (l.data.length !== size) problems.push(`layer "${name}" has ${l.data.length} tiles, a ${width} × ${height} map needs ${size}`);
    if (l.data.some((g) => !Number.isInteger(g) || g < 0 || g > last)) problems.push(`layer "${name}" uses a tile number that is not in a tileset`);
    return l.data.slice();
  };
  const ground = layer('ground');
  const walls = layer('walls');
  const grass = layer('grass');
  const objectLayer = raw.layers.find((x) => x.type === 'objectgroup' && x.name === 'objects');
  if (!objectLayer) problems.push('there is no object layer called "objects"');

  const mp = props(raw);
  const name = text(mp.name) || id;
  const area = num(mp.area, 0);
  if (!Number.isInteger(area) || area < 0 || area > 6) problems.push('"area" must be 0 (a town) or 1 to 6');
  const wild = text(mp.wild).split(',').map((s) => s.trim()).filter(Boolean);
  for (const w of wild) {
    try {
      speciesOf(w);
    } catch {
      problems.push(`wild monster "${w}" is not in the monster book`);
    }
  }

  const inside = (x: number, y: number) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < width && y < height;
  const things: Thing[] = [];
  const warps: Warp[] = [];
  const spots: GameMap['spots'] = [];
  const far = new Array<boolean>(size).fill(false);

  for (const o of objectLayer?.objects ?? []) {
    const type = (o.type || o.class || '') as string;
    const p = props(o);
    const x = Math.floor(o.x / TILE_SIZE);
    const y = Math.floor(o.y / TILE_SIZE);
    const label = `${type} "${o.name || o.id}" at ${x},${y}`;
    if (type === 'far') {
      const w = Math.max(1, Math.round((o.width ?? TILE_SIZE) / TILE_SIZE));
      const h = Math.max(1, Math.round((o.height ?? TILE_SIZE) / TILE_SIZE));
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (inside(xx, yy)) far[yy * width + xx] = true;
      continue;
    }
    if (!inside(x, y)) {
      problems.push(`${label} is outside the map`);
      continue;
    }
    if (type === 'warp') {
      warps.push({ id: `${id}:${o.name || o.id}`, x, y, to: text(p.to), toX: num(p.toX, -1), toY: num(p.toY, -1), facing: dirOf(p.facing, 'down') });
    } else if (type === 'spot') {
      if (!o.name) problems.push(`${label} needs a name`);
      spots.push({ name: o.name ?? '', x, y, facing: dirOf(p.facing, 'down') });
    } else if (TALKING.includes(type as ThingKind)) {
      const kind = type as ThingKind;
      const pages = pagesOf(p.text);
      if (!pages.length) problems.push(`${label} has no text`);
      const thing: Thing = { kind, id: `${id}:${o.name || o.id}`, name: o.name ?? '', x, y, facing: dirOf(p.facing, 'down'), pages };
      if (kind === 'person' || kind === 'trainer' || kind === 'nurse') {
        if (typeof p.sprite !== 'number') problems.push(`${label} needs a "sprite" number`);
        else thing.sprite = p.sprite;
        if (!o.name) problems.push(`${label} needs a name`);
      }
      if (kind === 'trainer') {
        thing.sight = num(p.sight, 4);
        thing.winPages = pagesOf(p.win);
        if (!thing.winPages.length) problems.push(`${label} needs "win" text (what they say after you win)`);
        thing.team = parseTeam(text(p.team), problems, label);
      }
      things.push(thing);
    } else {
      problems.push(`${label}: "${type}" is not a kind of object (sign, person, nurse, box, book, closed, trainer, warp, spot, far)`);
    }
  }

  const walled = (x: number, y: number) => walls[y * width + x] !== 0;
  for (const t of things) {
    if (NEEDS_FREE_TILE.includes(t.kind) && walled(t.x, t.y)) problems.push(`${t.kind} "${t.name}" at ${t.x},${t.y} is standing on a wall tile`);
  }
  const taken = new Map<string, string>();
  for (const o of [...things.map((t) => ({ x: t.x, y: t.y, n: t.id })), ...warps.map((w) => ({ x: w.x, y: w.y, n: w.id }))]) {
    const k = `${o.x},${o.y}`;
    if (taken.has(k)) problems.push(`${o.n} and ${taken.get(k)} are on the same tile (${k})`);
    taken.set(k, o.n);
  }
  const ids = new Set<string>();
  for (const t of things) {
    if (ids.has(t.id)) problems.push(`two objects are both called "${t.name}"`);
    ids.add(t.id);
  }

  if (problems.length) throw new MapError(id, problems);

  const blocked = walls.map((g) => g !== 0);
  for (const t of things) blocked[t.y * width + t.x] = true;
  return {
    id, name, width, height, area, ground, walls, grass, blocked,
    isGrass: grass.map((g) => g !== 0), far, things, warps, spots, wild,
  };
}
