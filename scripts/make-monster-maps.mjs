#!/usr/bin/env node
/**
 * Makes the Maths Monsters maps (shared/monsters/maps/*.json) in the Tiled format.
 * The maps are written here as a few easy steps (fill, path, tree, house, sign...) and come out
 * as normal Tiled JSON, so you can also open the JSON in the Tiled editor and change it there.
 * Run: node scripts/make-monster-maps.mjs
 *
 * Tile numbers: Tiny Town tile n has gid n + 1; Tiny Dungeon tile n has gid n + 133;
 * the extra tiles (water A, water B, long grass) are gids 265, 266, 267.
 */
import { writeFileSync } from 'node:fs';

const TT = (n) => n + 1;
const TD = (n) => n + 133;
const WATER = 265;
const LONG_GRASS = 267;

const TILESETS = [
  { firstgid: 1, name: 'tiny-town', image: '../../../src/games/monsters/world/assets/kenney/tiny-town/tilemap_packed.png', imagewidth: 192, imageheight: 176, tilewidth: 16, tileheight: 16, columns: 12, tilecount: 132, margin: 0, spacing: 0 },
  { firstgid: 133, name: 'tiny-dungeon', image: '../../../src/games/monsters/world/assets/kenney/tiny-dungeon/tilemap_packed.png', imagewidth: 192, imageheight: 176, tilewidth: 16, tileheight: 16, columns: 12, tilecount: 132, margin: 0, spacing: 0 },
  {
    firstgid: 265, name: 'extra-tiles', image: '../../../src/games/monsters/world/assets/extra-tiles.png', imagewidth: 48, imageheight: 16, tilewidth: 16, tileheight: 16, columns: 3, tilecount: 3, margin: 0, spacing: 0,
    tiles: [{ id: 0, animation: [{ tileid: 0, duration: 700 }, { tileid: 1, duration: 700 }] }],
  },
];

class MapMaker {
  constructor(id, name, width, height, area = 0, wild = []) {
    Object.assign(this, { id, name, width, height, area, wild });
    this.ground = new Array(width * height).fill(0);
    this.walls = new Array(width * height).fill(0);
    this.grass = new Array(width * height).fill(0);
    this.dirt = new Set();
    this.objects = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) this.ground[y * width + x] = TT(this.#grassTile(x, y));
  }
  #grassTile(x, y) {
    const h = (x * 73 + y * 151 + x * y * 7) % 23;
    return h < 3 ? 1 : h === 3 ? 2 : 0;
  }
  at(x, y) { return y * this.width + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }
  /** A rectangle of dirt path (draw them 2 wide so the edges join up). */
  path(x, y, w, h) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.dirt.add(this.at(i, j)); }
  /** A wall-layer tile: it blocks walking. */
  wall(x, y, gid) { this.walls[this.at(x, y)] = gid; if (gid) this.grass[this.at(x, y)] = 0; }
  wallRect(x, y, w, h, gid) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.wall(i, j, gid); }
  tree(x, y) { this.wall(x, y, TT(28)); }
  /** A tall tree: two tiles, the crown above the trunk. */
  bigTree(x, y) { this.wall(x, y - 1, TT(4)); this.wall(x, y, TT(16)); }
  bush(x, y) { this.wall(x, y, TT(5)); }
  water(x, y, w, h) { this.wallRect(x, y, w, h, WATER); }
  longGrass(x, y, w, h) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.inside(i, j)) this.grass[this.at(i, j)] = LONG_GRASS; }
  /** A line of trees round the edge. */
  border(gaps = []) {
    for (let x = 0; x < this.width; x++) for (const y of [0, this.height - 1]) if (!gaps.some(([gx, gy]) => gx === x && gy === y)) this.tree(x, y);
    for (let y = 0; y < this.height; y++) for (const x of [0, this.width - 1]) if (!gaps.some(([gx, gy]) => gx === x && gy === y)) this.tree(x, y);
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
  object(type, name, x, y, props = {}, extra = {}) {
    this.objects.push({ type, name, x, y, props, extra });
  }
  sign(name, x, y, text, gid = TT(83)) { this.wall(x, y, gid); this.object('sign', name, x, y, { text }); }
  spot(name, x, y, facing = 'down') { this.object('spot', name, x, y, { facing }); }
  warp(name, x, y, to, toX, toY, facing) { this.object('warp', name, x, y, { to, toX, toY, facing }); }
  person(name, sprite, x, y, facing, text) { this.object('person', name, x, y, { sprite, facing, text }); }

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
    writeFileSync(new URL(`../shared/monsters/maps/${this.id}.json`, import.meta.url), JSON.stringify(this.toTiled()) + '\n');
    console.log(`wrote ${this.id}.json (${this.width} x ${this.height})`);
  }
}

// ───────────────────────── Harbour Town (the start) ─────────────────────────
{
  const m = new MapMaker('harbour-town', 'Harbour Town', 24, 18);
  m.border([[11, 0], [12, 0]]);
  m.path(11, 0, 2, 14);   // the road north to Kauri Bush
  m.path(3, 12, 18, 2);   // the road across town
  m.path(4, 9, 3, 3);     // the square outside the Healing Centre
  m.path(15, 9, 3, 3);    // the square outside the teacher's house
  m.house(5, 5, { roof: 'red', wall: 'grey', door: true });          // the Healing Centre: door at (6,8)
  m.house(16, 5, { roof: 'blue', wall: 'brown' });                    // a house (just for show)
  m.house(1, 6, { roof: 'blue', wall: 'grey' });                      // a house (just for show)
  m.house(20, 8, { roof: 'red', wall: 'brown' });                     // a house (just for show)
  for (const [x, y] of [[3, 2], [8, 3], [15, 2], [19, 3], [21, 2], [2, 15], [9, 16], [20, 16], [13, 16]]) m.tree(x, y);
  for (const [x, y] of [[9, 2], [14, 3], [6, 3]]) m.bush(x, y);
  m.bigTree(2, 11); m.bigTree(22, 6); m.bigTree(8, 8);
  m.fence(14, 15, 5); m.fence(2, 4, 4);
  m.water(17, 15, 4, 2);
  // Things to do.
  m.sign('welcome', 9, 14, 'Welcome to Harbour Town! The wild monsters live up the road, in Kauri Bush.');
  m.sign('healing-sign', 8, 9, 'Healing Centre. Tired monsters rest here.');
  m.sign('north-sign', 14, 1, 'North: Kauri Bush. Watch out for long grass!');
  m.sign('pond-sign', 16, 14, 'Please do not feed the Minnowus.');
  m.person('Teacher', 84, 13, 15, 'left', 'Hello! I am your teacher. Welcome to Maths Monsters!\nEvery monster stands for one kind of maths. Fire is times tables, Water is adding and taking away.\nIn a battle your monster attacks by answering a maths question. Right answers hit hard, quick ones hit harder, and a wrong one still does a little.\nNobody ever loses anything for a wrong answer. If your team gets tired, you just wake up at the Healing Centre.\nWalk in the long grass up north to find wild monsters. Throw a ball to catch them!\nGood luck!');
  m.person('Fisher', 111, 19, 14, 'left', 'The Minnowus here are so quick. I swear one swam off with my sandwich.');
  m.wall(3, 14, TD(89)); m.object('box', 'Monster box', 3, 14, { text: 'This is your Monster box. It keeps the monsters that do not fit in your team of six.\nYour box holds {box} monsters. Opening the box is coming soon!' });
  m.wall(2, 14, TD(63)); m.object('book', 'Monster book', 2, 14, { text: 'This is the Monster book. It will list every monster you find, and its type.\nThe book is coming soon!' });
  m.warp('to-bush-left', 11, 0, 'kauri-bush', 11, 18, 'up');
  m.warp('to-bush-right', 12, 0, 'kauri-bush', 12, 18, 'up');
  m.warp('to-healing-centre', 6, 8, 'healing-centre', 5, 5, 'up');
  m.spot('start', 11, 15, 'up');
  m.save();
}

// ───────────────────────── Healing Centre (inside) ─────────────────────────
{
  const m = new MapMaker('healing-centre', 'Healing Centre', 10, 7);
  m.floor(TD(49));
  for (let x = 0; x < 10; x++) { m.wall(x, 0, TD(40)); m.wall(x, 1, TD(x === 2 || x === 7 ? 28 : 40)); }
  m.wall(4, 1, TD(29)); // the red banner over the nurse
  for (const x of [2, 3, 5, 6]) m.wall(x, 2, TD(72)); // the counter, with a gap for the nurse
  m.object('nurse', 'Nurse Joy', 4, 2, { sprite: 99, facing: 'down', text: 'Welcome to the Healing Centre! Let me look after your monsters.' });
  for (let x = 0; x < 10; x++) if (x !== 5) m.wall(x, 6, TD(40));
  m.wall(5, 6, TT(89));
  m.bush(1, 4); m.bush(8, 4);
  m.sign('poster', 1, 2, 'A poster: "A rested monster is a happy monster. Talk to the nurse any time!"', TT(93));
  m.warp('out', 5, 6, 'harbour-town', 6, 9, 'down');
  m.spot('wake', 4, 3, 'up');
  m.save();
}

// ───────────────────────── Area 1: Kauri Bush ─────────────────────────
{
  const species = ['digibud-1', 'plusplash-1', 'multipup-1', 'minnowus-1', 'divvy-1', 'pebblepoint-1', 'fractopus-1'];
  const m = new MapMaker('kauri-bush', 'Area 1: Kauri Bush', 25, 20, 1, species);
  // The far half (the north) has higher-level monsters and harder questions.
  m.object('far', 'far half', 0, 0, {}, { w: 25, h: 10 });
  // The closed path to area 2 is the gap in the trees at (21, 0), behind the rope fence at (21, 1).
  m.border([[11, 19], [12, 19], [21, 0]]);
  m.path(11, 13, 2, 7);   // from town, north
  m.path(11, 11, 9, 2);   // east
  m.path(18, 3, 2, 9);    // north again, towards Shell Beach (area 2)
  m.path(18, 2, 4, 2);    // the way to the closed gate
  m.path(4, 15, 8, 2);    // a side trail west
  m.longGrass(2, 11, 6, 3); m.longGrass(2, 17, 7, 2); m.longGrass(13, 15, 8, 3); m.longGrass(14, 13, 4, 2);
  m.longGrass(2, 3, 10, 4); m.longGrass(3, 7, 9, 3); m.longGrass(13, 4, 4, 5); m.longGrass(20, 6, 3, 7);
  for (const [x, y] of [[8, 13], [3, 14], [14, 18], [22, 15], [20, 17]]) m.tree(x, y);
  for (const [x, y] of [[9, 4], [13, 10], [16, 12], [22, 4], [5, 10]]) m.bigTree(x, y);
  for (const [x, y] of [[16, 8], [21, 11], [10, 2], [13, 2], [23, 8], [7, 17]]) m.bush(x, y);
  m.water(21, 14, 3, 2);
  m.wall(21, 1, TT(81)); // the rope fence across the gap to area 2
  m.object('closed', 'area-2-gate', 21, 1, { text: 'A rope fence blocks the path north. A sign says: "Shell Beach is not open yet. Come back soon!"' });
  m.sign('bush-sign', 13, 18, 'Kauri Bush. Wild monsters hide in the long grass. Walk in it and see who jumps out!');
  m.sign('trail-sign', 16, 10, 'North: Shell Beach (path closed). South: Harbour Town.');
  m.sign('west-sign', 4, 14, 'West trail: lots of long grass. Be ready!');
  m.person('Mere', 100, 14, 17, 'left', 'Tip: if a monster is nearly out of health, it is much easier to catch.\nA right answer helps too!');
  m.person('Tama', 88, 9, 12, 'right', 'Why was six afraid of seven?\nBecause seven eight nine!');
  m.person('Hermit', 111, 16, 5, 'down', 'Each monster uses the maths of its type. Water monsters ask adding and taking away, Fire monsters ask times tables.\nBring a monster of every type, and you can practise everything!');
  m.object('trainer', 'Ranger Kiri', 16, 9, { sprite: 96, facing: 'right', sight: 4, text: 'Hey! You there! I saw you walk past. Show me your monsters!', win: 'Great battle! You are getting good at this. Keep going!', team: 'digibud-1:4,plusplash-1:4' });
  m.warp('to-town-left', 11, 19, 'harbour-town', 11, 1, 'down');
  m.warp('to-town-right', 12, 19, 'harbour-town', 12, 1, 'down');
  m.spot('entrance', 11, 18, 'up');
  m.spot('trainer-approach', 18, 10, 'up');
  m.spot('grass-edge', 12, 15, 'right');
  m.spot('area-2-gate', 21, 2, 'up');
  m.save();
}
