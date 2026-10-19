/**
 * The map maker's toolbox: a `MapMaker` that you give a few easy steps (fill, path, tree, house,
 * sign, chest, gate, tower...) and that writes a normal Tiled JSON file into shared/monsters/maps/.
 * Used by scripts/make-monster-maps.mjs; the maps themselves are in the other files in this folder.
 *
 * Tile numbers: Tiny Town tile n has gid n + 1; Tiny Dungeon tile n has gid n + 133;
 * the extra tiles (water, long grass, sand, snow, lava... see scripts/make-monster-extra-tiles.py)
 * are gids 265 and up: X(n) below.
 */
import { writeFileSync } from 'node:fs';

export const TT = (n) => n + 1;
export const TD = (n) => n + 133;
export const X = (n) => 265 + n;
export const WATER = X(0);
export const LONG_GRASS = X(2);
export const LAVA = X(7);

/** What each kind of area looks like: the ground, how paths look, and the long grass. */
export const BIOMES = {
  green: { ground: null, path: null, grass: LONG_GRASS },
  beach: { ground: X(3), path: X(24), grass: X(4) },
  snow: { ground: X(5), path: X(25), grass: X(6) },
  ash: { ground: X(9), path: X(26), grass: X(10) },
  cave: { ground: X(11), path: X(27), grass: X(12) },
  city: { ground: null, path: X(28), grass: LONG_GRASS },
};

const TILESETS = [
  { firstgid: 1, name: 'tiny-town', image: '../../../src/games/monsters/world/assets/kenney/tiny-town/tilemap_packed.png', imagewidth: 192, imageheight: 176, tilewidth: 16, tileheight: 16, columns: 12, tilecount: 132, margin: 0, spacing: 0 },
  { firstgid: 133, name: 'tiny-dungeon', image: '../../../src/games/monsters/world/assets/kenney/tiny-dungeon/tilemap_packed.png', imagewidth: 192, imageheight: 176, tilewidth: 16, tileheight: 16, columns: 12, tilecount: 132, margin: 0, spacing: 0 },
  {
    firstgid: 265, name: 'extra-tiles', image: '../../../src/games/monsters/world/assets/extra-tiles.png', imagewidth: 480, imageheight: 16, tilewidth: 16, tileheight: 16, columns: 30, tilecount: 30, margin: 0, spacing: 0,
    tiles: [
      { id: 0, animation: [{ tileid: 0, duration: 700 }, { tileid: 1, duration: 700 }] },
      { id: 7, animation: [{ tileid: 7, duration: 700 }, { tileid: 8, duration: 700 }] },
    ],
  },
];

/** The Tiny Dungeon people. */
export const PEOPLE = { wizard: 84, villager: 85, monk: 86, viking: 87, man: 88, knight: 96, guard: 97, hero: 98, woman: 99, elder: 100, hooded: 111, ranger: 112 };
/** Chests: closed and opened. */
export const CHEST = { closed: TD(90), open: TD(91) };

export class MapMaker {
  constructor(id, name, width, height, area = 0, wild = [], biome = 'green') {
    Object.assign(this, { id, name, width, height, area, wild, biome: BIOMES[biome] });
    this.ground = new Array(width * height).fill(0);
    this.walls = new Array(width * height).fill(0);
    this.grass = new Array(width * height).fill(0);
    this.dirt = new Set();
    this.objects = [];
    /** Tiles that are in use (paths, objects, buildings): scattered trees keep clear of them. */
    this.used = new Set();
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) this.ground[y * width + x] = this.biome.ground ?? TT(this.#grassTile(x, y));
  }
  #grassTile(x, y) {
    const h = (x * 73 + y * 151 + x * y * 7) % 23;
    return h < 3 ? 1 : h === 3 ? 2 : 0;
  }
  at(x, y) { return y * this.width + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }
  use(x, y, w = 1, h = 1) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.used.add(this.at(i, j)); }
  /** A rectangle of path (draw them 2 wide so the edges join up). On green maps it is dirt with grass edges. */
  path(x, y, w, h) {
    this.pathCells ??= new Set();
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        this.pathCells.add(this.at(i, j));
        if (this.biome.path) this.ground[this.at(i, j)] = this.biome.path;
        else this.dirt.add(this.at(i, j));
      }
    }
    this.use(x, y, w, h);
  }
  /** A wall-layer tile: it blocks walking. */
  wall(x, y, gid) { this.walls[this.at(x, y)] = gid; if (gid) this.grass[this.at(x, y)] = 0; this.used.add(this.at(x, y)); }
  wallRect(x, y, w, h, gid) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.wall(i, j, gid); }
  /** Anything you cannot walk through standing on a path would shut the path while it still looks open. Say so when a map does that. */
  #onPath(kind, x, y) {
    if (!this.pathCells?.has(this.at(x, y))) return;
    const text = `${this.id ?? 'map'}: a ${kind} at ${x},${y} stands on a path`;
    (this.warnings ??= []).push(text);
    console.warn(text);
  }
  tree(x, y) { this.#onPath('tree', x, y); this.wall(x, y, TT(28)); }
  /** A tall tree: two tiles, the crown above the trunk. */
  bigTree(x, y) { this.#onPath('tall tree', x, y); this.#onPath('tall tree', x, y - 1); this.wall(x, y - 1, TT(4)); this.wall(x, y, TT(16)); }
  autumnTree(x, y) { this.#onPath('tree', x, y); this.#onPath('tree', x, y - 1); this.wall(x, y - 1, TT(3)); this.wall(x, y, TT(15)); }
  autumnSmall(x, y) { this.#onPath('tree', x, y); this.wall(x, y, TT(27)); }
  snowTree(x, y) { this.#onPath('tall tree', x, y); this.#onPath('tall tree', x, y - 1); this.wall(x, y - 1, X(14)); this.wall(x, y, X(15)); }
  snowPine(x, y) { this.#onPath('tree', x, y); this.wall(x, y, X(16)); }
  snowBush(x, y) { this.#onPath('bush', x, y); this.wall(x, y, X(17)); }
  palm(x, y) { this.#onPath('palm', x, y); this.#onPath('palm', x, y - 1); this.wall(x, y - 1, X(22)); this.wall(x, y, X(23)); }
  boulder(x, y, dark = false) { this.#onPath('boulder', x, y); this.wall(x, y, X(dark ? 19 : 18)); }
  stalagmite(x, y) { this.#onPath('stalagmite', x, y); this.wall(x, y, X(20)); }
  crystal(x, y) { this.#onPath('crystal', x, y); this.wall(x, y, X(21)); }
  bush(x, y) { this.#onPath('bush', x, y); this.wall(x, y, TT(5)); }
  water(x, y, w, h) { this.wallRect(x, y, w, h, WATER); }
  lava(x, y, w, h) { this.wallRect(x, y, w, h, LAVA); }
  /** Rock wall (caves): a block, or a rectangle of them. */
  rock(x, y, w = 1, h = 1) { this.wallRect(x, y, w, h, X(13)); }
  ice(x, y, w, h) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.ground[this.at(i, j)] = X(29); }
  longGrass(x, y, w, h) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.inside(i, j)) { this.grass[this.at(i, j)] = this.biome.grass; this.used.add(this.at(i, j)); } }
  /** A line of trees round the edge (or `gid` tiles: rock, say). */
  border(gaps = [], place = (x, y) => this.tree(x, y)) {
    const gap = (x, y) => gaps.some(([gx, gy]) => gx === x && gy === y);
    for (let x = 0; x < this.width; x++) for (const y of [0, this.height - 1]) if (!gap(x, y)) place(x, y);
    for (let y = 0; y < this.height; y++) for (const x of [0, this.width - 1]) if (!gap(x, y)) place(x, y);
  }
  /** A fence running left to right. */
  fence(x, y, len) { for (let i = 0; i < len; i++) this.wall(x + i, y, TT(i === 0 ? 80 : i === len - 1 ? 82 : 81)); }
  /** A little house, 3 tiles wide and 4 tall. A door gets a warp. */
  house(x, y, { roof = 'red', wall = 'brown', door } = {}) {
    const roofs = { blue: [[48, 49, 50], [60, 61, 62]], red: [[52, 53, 54], [64, 65, 66]] };
    const walls = { brown: [[72, 73, 75], [84, 85, 84]], grey: [[76, 77, 79], [88, 89, 88]] };
    const rows = [...roofs[roof], ...walls[wall]];
    rows.forEach((row, j) => row.forEach((n, i) => this.wall(x + i, y + j, TT(n))));
    if (!door) this.wall(x + 1, y + 3, TT(wall === 'brown' ? 84 : 88));
  }
  /**
   * A Topic Tower seen from outside: 5 wide and 5 tall, a blue roof over grey walls with windows,
   * the door in the middle of the bottom row at (x + 2, y + 4). Pass the door's warp yourself.
   */
  towerBuilding(x, y) {
    const rows = [[48, 49, 49, 49, 50], [60, 61, 61, 61, 62], [76, 77, 77, 77, 79], [88, 77, 77, 77, 88], [88, 88, 89, 88, 88]];
    rows.forEach((row, j) => row.forEach((n, i) => this.wall(x + i, y + j, TT(n))));
  }
  /** A healing hut: a small house with the nurse standing beside it, so a tired team never has far to go. Returns where to stand to talk to her. */
  hut(x, y, nurseX, nurseY, nurse, text, facing = 'right') {
    this.house(x, y, { roof: 'red', wall: 'brown' });
    this.use(x - 1, y - 1, 5, 6);
    this.object('nurse', nurse, nurseX, nurseY, { sprite: PEOPLE.woman, facing, text });
    this.use(nurseX, nurseY);
  }
  object(type, name, x, y, props = {}, extra = {}) {
    this.objects.push({ type, name, x, y, props, extra });
    this.use(x, y);
  }
  sign(name, x, y, text, gid = TT(83)) { this.wall(x, y, gid); this.object('sign', name, x, y, { text }); }
  spot(name, x, y, facing = 'down') { this.objects.push({ type: 'spot', name, x, y, props: { facing }, extra: {} }); }
  warp(name, x, y, to, toX, toY, facing) { this.object('warp', name, x, y, { to, toX, toY, facing }); }
  person(name, sprite, x, y, facing, text) { this.object('person', name, x, y, { sprite, facing, text }); }
  /** A trainer who spots you. `team` is "family:level,family:level" (the form comes from the level). */
  trainer(name, sprite, x, y, facing, { sight = 4, text, win, team, badge, loot }) {
    this.object('trainer', name, x, y, { sprite, facing, sight, text, win, team, ...(badge ? { badge } : {}), ...(loot ? { loot } : {}) });
  }
  /** A chest on the ground: opens once and gives the `loot` bundle from shared/monsters/world/rewards.ts. */
  chest(name, x, y, loot, text) {
    this.object('chest', name, x, y, { text, loot, gid: CHEST.closed, open: CHEST.open });
  }
  /** A way on that stays shut until you hold `badge`. The map doesn't draw it; the screen does, while it is closed. */
  gate(name, x, y, badge, text, gid = TT(81)) {
    this.object('gate', name, x, y, { badge, text, gid });
  }
  /**
   * Scatters things (trees, boulders...) over bare ground, keeping clear of paths, long grass,
   * and anything already placed (plus one tile around it). The same seed always gives the same scatter.
   */
  scatter(count, place, { seed = 1, x0 = 1, x1 = this.width - 2, y0 = 1, y1 = this.height - 2, gap = 1 } = {}) {
    let a = Math.imul(seed + 1, 2654435761) >>> 0;
    const next = () => { // mulberry32: a small, well-mixed random generator
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let tries = 0, placed = 0; placed < count && tries < 4000; tries++) {
      const x = x0 + Math.floor(next() * (x1 - x0 + 1));
      const y = y0 + Math.floor(next() * (y1 - y0 + 1));
      let clear = true;
      for (let j = y - gap; j <= y + gap && clear; j++) for (let i = x - gap; i <= x + gap; i++) if (this.inside(i, j) && (this.used.has(this.at(i, j)) || this.grass[this.at(i, j)])) { clear = false; break; }
      if (!clear) continue;
      place(x, y);
      placed++;
    }
  }

  #autotileDirt() {
    const isDirt = (x, y) => !this.inside(x, y) || this.dirt.has(this.at(x, y));
    for (const k of this.dirt) {
      const x = k % this.width;
      const y = Math.floor(k / this.width);
      const n = isDirt(x, y - 1), s = isDirt(x, y + 1), w = isDirt(x - 1, y), e = isDirt(x + 1, y);
      let t = 25;
      if (!n && !w) t = 12; else if (!n && !e) t = 14; else if (!s && !w) t = 36; else if (!s && !e) t = 38;
      else if (!n) t = 13; else if (!s) t = 37; else if (!w) t = 24; else if (!e) t = 26;
      this.ground[k] = TT(t);
    }
  }
  floor(gid) { this.ground.fill(gid); }

  toTiled() {
    this.#autotileDirt();
    let id = 0;
    const prop = (name, value) => ({ name, type: typeof value === 'number' ? 'int' : 'string', value });
    const props = (o) => Object.entries(o).map(([n, v]) => prop(n, v));
    const objects = this.objects.map((o) => ({
      id: ++id, name: o.name, type: o.type, x: o.x * 16, y: o.y * 16, width: o.extra.w ? o.extra.w * 16 : 16, height: o.extra.h ? o.extra.h * 16 : 16,
      rotation: 0, visible: true, properties: props(o.props),
    }));
    const layer = (name, data) => ({ id: ++id, name, type: 'tilelayer', x: 0, y: 0, width: this.width, height: this.height, opacity: 1, visible: true, data });
    return {
      type: 'map', version: '1.10', tiledversion: '1.10.2', orientation: 'orthogonal', renderorder: 'right-down', infinite: false,
      width: this.width, height: this.height, tilewidth: 16, tileheight: 16, nextlayerid: id + 2, nextobjectid: id + 2,
      properties: props({ name: this.name, area: this.area, wild: this.wild.join(',') }),
      tilesets: TILESETS,
      layers: [
        layer('ground', this.ground),
        layer('walls', this.walls),
        layer('grass', this.grass),
        { id: ++id, name: 'objects', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects },
      ],
    };
  }
  save() {
    writeFileSync(new URL(`../../shared/monsters/maps/${this.id}.json`, import.meta.url), JSON.stringify(this.toTiled()) + '\n');
    console.log(`wrote ${this.id}.json (${this.width} x ${this.height})`);
  }
}

/**
 * The inside of a Topic Tower: two small rooms. The hall (a guide to talk to, a ladder up) and the
 * top room (the Tower trainer, who gives the badge). `area` makes the questions in the Tower
 * trainer's battle the area's far-half bands. Walks out onto `outside` (the map, the tile in front of the door).
 */
export function towerRooms({ n, area, label, outside, outsideX, outsideY, guide, sprite, badge, trainerName, trainerSprite, text, win, team, hint }) {
  const hall = new MapMaker(`tower-${n}-hall`, `${label} Tower`, 11, 9, area);
  hall.floor(TD(49));
  for (let x = 0; x < 11; x++) { hall.wall(x, 0, TD(40)); hall.wall(x, 1, TD(x === 2 || x === 8 ? 28 : 40)); hall.wall(x, 8, TD(40)); }
  for (let y = 2; y < 8; y++) { hall.wall(0, y, TD(40)); hall.wall(10, y, TD(40)); }
  hall.wall(5, 1, TD(29)); // the red banner
  hall.wall(1, 2, TD(63)); hall.wall(9, 2, TD(63)); // book shelves
  hall.wall(1, 6, TD(66)); hall.wall(9, 6, TD(66)); // sacks
  hall.wall(5, 8, TT(89)); // the door
  hall.person(guide, sprite, 3, 4, 'right', hint);
  hall.sign('tower-sign', 7, 4, `${label} Tower. Climb the ladder to meet the Tower trainer and win the ${badge[0].toUpperCase()}${badge.slice(1)} badge!`, TT(83));
  hall.wall(5, 2, TD(68)); hall.warp('up', 5, 2, `tower-${n}-top`, 5, 6, 'up');
  hall.warp('out', 5, 8, outside, outsideX, outsideY, 'down');
  hall.spot('inside', 5, 6, 'up');
  hall.save();

  const top = new MapMaker(`tower-${n}-top`, `${label} Tower, top floor`, 11, 9, area);
  top.floor(TD(49));
  for (let x = 0; x < 11; x++) { top.wall(x, 0, TD(40)); top.wall(x, 1, TD(x === 2 || x === 8 ? 28 : 40)); top.wall(x, 8, TD(40)); }
  for (let y = 2; y < 8; y++) { top.wall(0, y, TD(40)); top.wall(10, y, TD(40)); }
  top.wall(5, 1, TD(29));
  top.wall(2, 2, TD(64)); top.wall(8, 2, TD(64)); // pillars
  top.trainer(trainerName, trainerSprite, 5, 3, 'down', { sight: 3, text, win, team, badge, loot: 'tower' });
  top.wall(5, 7, TD(68)); top.warp('down', 5, 7, `tower-${n}-hall`, 5, 3, 'down');
  top.spot('trainer-approach', 5, 4, 'up');
  top.save();
}
