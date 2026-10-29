/**
 * Draws a Marble Rush run with three.js: low-poly blocks in flat colours, an isometric camera that follows the marble.
 * Loaded only when someone opens the game (RunScreen imports this file lazily), so the rest of the site stays quick.
 * Nothing here affects the physics: it only reads the run's state.
 */
import * as THREE from 'three';
import { BALL_RADIUS, LEVEL } from '../../../shared/marble/config';
import type { Course, Tile } from '../../../shared/marble/course';
import { TIMED } from '../../../shared/marble/config';
import { floorHeightAt, gateOpen, geyserPhase, trapdoorSolid, windBlowing, type RunState, type World } from '../../../shared/marble/engine';
import { createFx, makeMarble, makeTrail, runEvents, type Fx, type MarbleObject, type Trail } from './fx';
import { lookFor } from './look';
import type { Palette } from './palette';
import { settingsFor, type Quality, type QualitySettings } from './quality';
import type { GateSign, GemSprite } from './signs';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PLANK_HEIGHT, PLANK_TILES, skyTexture, TOP_TILES, topTexture, wallTexture, wallTopTexture } from './trackTextures';
import type { TopPattern } from './look';

/** How thick a block looks where nothing is beside it, in tiles. */
const THICK = 1.2;
/** Walls stand this far above the floor beside them. */
const WALL_HEIGHT = 0.7;
/** The diorama look: rails are lower, and bevelled this much at the top. */
const RAIL_HEIGHT = 0.5; // the wall's whole height: a plank base, a log on top
const BASE_HEIGHT = 0.26;
const CHUNKY_HEIGHT = 0.33; // rock and snow-bank walls have no top rail, so the base is taller
const RAIL_BEVEL = 0.04;
const LOG_RADIUS = 0.16;
/** Steel pipe rails: a thin round rail on short posts, this high above the wall's base. */
const PIPE_RADIUS = 0.07;
const PIPE_LIFT = 0.2;
/** Colours for the slope chevrons and the drop-off strip on plain tops of the non-sand courses. */
const TOP_INK: Record<TopPattern, { ink: number; edge: number }> = {
  sand: { ink: 0, edge: 0 },
  none: { ink: 0, edge: 0 },
  tarmac: { ink: 0x565d66, edge: 0xc9ced4 },
  sinter: { ink: 0xb98a4a, edge: 0xfff1d4 },
  snow: { ink: 0x7f9fc2, edge: 0xffffff },
  concrete: { ink: 0x66717b, edge: 0xe6eaee },
  scoria: { ink: 0x4a2418, edge: 0xd9a285 },
  grass: { ink: 0x4f8130, edge: 0xcfe79a },
};
/** A repeatable number from 0 to 1 for a tile (no Math.random, so the rocks look the same every time). */
function tileHash(x: number, y: number): number {
  let h = Math.imul(x + 1013, 0x27d4eb2d) ^ Math.imul(y + 7919, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
/** How wide the light strip along a drop-off is, in tiles. */
const EDGE_STRIP = 0.1;

type Corners = [number, number, number, number]; // nw, ne, se, sw

/** Which way a conveyor belt carries you (grid x, y). */
const CONVEYOR_DIR: Record<string, readonly [number, number]> = { e: [1, 0], w: [-1, 0], n: [0, -1], o: [0, 1] };

function corners(t: Tile): Corners {
  const hi = t.level * LEVEL;
  const lo = (t.level - 1) * LEVEL;
  switch (t.slope) {
    case 'E': return [hi, lo, lo, hi];
    case 'W': return [lo, hi, hi, lo];
    case 'S': return [hi, hi, lo, lo];
    case 'N': return [lo, lo, hi, hi];
    default: return [hi, hi, hi, hi];
  }
}

/** Gives a texture position for a point (only for the textured parts of the diorama look). */
type UvOf = (p: number[]) => [number, number];

/** A colour part-way between two colours (hex numbers). */
function mix(a: number, b: number, t: number): number {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
}

/** Triangles with a colour each; flat shading comes from computing normals on unshared vertices. */
class Soup {
  positions: number[] = [];
  colors: number[] = [];
  uvs: number[] = [];
  private col = new THREE.Color();

  /** `shades` (one per point, 0–1) darken the colour at each corner; `uvOf` adds texture positions. */
  tri(a: number[], b: number[], c: number[], color: number, shades?: number[], uvOf?: UvOf) {
    this.col.setHex(color);
    [a, b, c].forEach((p, i) => {
      const k = shades ? shades[i] : 1;
      this.positions.push(p[0], p[1], p[2]);
      this.colors.push(this.col.r * k, this.col.g * k, this.col.b * k);
      if (uvOf) this.uvs.push(...uvOf(p));
    });
  }

  /** A quad a-b-c-d, counter-clockwise seen from the side it faces. */
  quad(a: number[], b: number[], c: number[], d: number[], color: number, shades?: number[], uvOf?: UvOf) {
    this.tri(a, b, c, color, shades && [shades[0], shades[1], shades[2]], uvOf);
    this.tri(a, c, d, color, shades && [shades[0], shades[2], shades[3]], uvOf);
  }

  /** A quad lying on the ground (or a slope), whichever way round the points come: it always faces up. */
  upQuad(a: number[], b: number[], c: number[], d: number[], color: number) {
    const facesUp = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]) > 0;
    if (facesUp) this.quad(a, b, c, d, color);
    else this.quad(a, d, c, b, color);
  }

  mesh(material?: THREE.Material): THREE.Mesh {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    if (this.uvs.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.computeVertexNormals();
    return new THREE.Mesh(g, material ?? new THREE.MeshLambertMaterial({ vertexColors: true }));
  }
}

/** A sign's picture: big, high-contrast text on a rounded plate, drawn once. */
function signTexture(text: string, arrow: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  if (g) {
    g.fillStyle = arrow ? '#fde047' : '#ffffff';
    g.strokeStyle = '#1e293b';
    g.lineWidth = 8;
    g.beginPath();
    g.roundRect(6, 6, 244, 116, 22);
    g.fill();
    g.stroke();
    g.fillStyle = '#0f172a';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const size = text.length <= 3 ? 84 : text.length <= 5 ? 66 : 46;
    g.font = `800 ${size}px system-ui, sans-serif`;
    g.fillText(text, 128, 68, 230);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Another marble on the course: a see-through ghost, or the second player's. */
export interface OtherMarble {
  prev: RunState;
  now: RunState;
}
export type OtherKind = 'ghost' | 'rival';

export interface MarbleView {
  /** Draws the run. `alpha` (0–1) is how far between the last two steps we are. */
  draw(prev: RunState, now: RunState, alpha: number, dt: number, others?: OtherMarble[]): void;
  resize(width: number, height: number): void;
  /** Pixel ratio 1 and no antialiasing cost; for slow devices. */
  setLowQuality(low: boolean): void;
  /** Simple, Normal or Best: pixel ratio and (on the diorama look) shadows. */
  setQuality(q: Quality): void;
  dispose(): void;
}

export function createView(canvas: HTMLCanvasElement, course: Course, world: World, palette: Palette, reducedMotion: boolean, otherKinds: OtherKind[] = [], signs: GateSign[] = [], gems: GemSprite[] = [], stopSigns = false, startQuality: Quality = 'normal'): MarbleView {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setClearColor(palette.sky);
  const scene = new THREE.Scene();
  const look = lookFor(course.def.id);
  const dio = look.diorama; // the new "toy diorama" look; every other course draws as before
  let quality: Quality = startQuality;
  const follow = new THREE.Vector3(course.start.x, 0, course.start.y);
  const hemi = new THREE.HemisphereLight(dio ? 0xfff6e8 : 0xffffff, dio ? 0x9c8868 : 0x8a7a66, dio ? 1.25 : 1.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(dio ? look.sunColour : 0xfff4e0, dio ? 1.6 : 1.1);
  sun.position.set(-6, 10, 4);
  scene.add(sun);
  // The sun's shadow follows the marble, so a small, sharp shadow map is enough.
  const SUN_OFFSET = new THREE.Vector3(-8, 13, 5).multiplyScalar(1.4);
  const SHADOW_REACH = 13;
  if (dio) {
    sun.position.copy(SUN_OFFSET);
    sun.target.position.set(0, 0, 0);
    scene.add(sun.target);
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const cam = sun.shadow.camera;
    cam.left = -SHADOW_REACH;
    cam.right = SHADOW_REACH;
    cam.top = SHADOW_REACH;
    cam.bottom = -SHADOW_REACH;
    cam.near = 1;
    cam.far = 80;
    cam.updateProjectionMatrix();
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    scene.background = skyTexture(look.skyTop, look.skyBottom);
  }
  // A painted backdrop (if the course has one), shown "cover" style and nudged a little as the camera moves. The gradient sky stays until it loads, or if it fails.
  let backdrop: THREE.Texture | null = null;
  let viewAspect = 16 / 9;
  const BACKDROP_ZOOM = 1.08; // a little spare picture all round, for the parallax
  const PARALLAX = 0.035; // at most this much of the picture
  /** Fits the picture to the view without stretching it, then shifts it by (px, py), each from -1 to 1. */
  function fitBackdrop(px = 0, py = 0) {
    const image = backdrop?.image as { width: number; height: number } | undefined;
    if (!backdrop || !image) return;
    const imageAspect = image.width / image.height;
    let rx = 1;
    let ry = 1;
    if (viewAspect > imageAspect) ry = imageAspect / viewAspect;
    else rx = viewAspect / imageAspect;
    rx /= BACKDROP_ZOOM;
    ry /= BACKDROP_ZOOM;
    backdrop.repeat.set(rx, ry);
    backdrop.offset.set((1 - rx) / 2 + px * Math.min(PARALLAX, (1 - rx) / 2), (1 - ry) / 2 + py * Math.min(PARALLAX, (1 - ry) / 2));
  }
  if (dio && look.backdrop) {
    new THREE.TextureLoader().load(
      quality === 'simple' ? look.backdrop.small : look.backdrop.full,
      (loaded) => {
        // Soften it a little (paler, less colour) so the track stands out in front.
        let tex: THREE.Texture = loaded;
        const img = loaded.image as HTMLImageElement;
        const cv = document.createElement('canvas');
        cv.width = img.width;
        cv.height = img.height;
        const c2 = cv.getContext('2d');
        if (c2) {
          c2.filter = 'saturate(0.85)';
          c2.drawImage(img, 0, 0);
          c2.filter = 'none';
          c2.fillStyle = 'rgba(255,250,240,0.14)';
          c2.fillRect(0, 0, cv.width, cv.height);
          tex = new THREE.CanvasTexture(cv);
          loaded.dispose();
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        backdrop = tex;
        fitBackdrop();
        if (scene.background instanceof THREE.Texture) scene.background.dispose();
        scene.background = tex;
      },
      undefined,
      () => {}, // no picture: the gradient stays
    );
  }
  const anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  // ---- the marble (its shadow and the rest of its set-up come below) ----
  // The diorama look has the glassy marble; every other course keeps the striped ball.
  const marbleObj: MarbleObject | null = dio ? makeMarble('player') : null;
  let marble: THREE.Object3D;
  let roller: THREE.Object3D; // the part that rolls (the highlight of the glassy marble stays put)
  if (marbleObj) {
    marble = marbleObj.root;
    roller = marbleObj.ball;
  } else {
    const swirl = document.createElement('canvas');
    swirl.width = swirl.height = 128;
    const g = swirl.getContext('2d');
    if (g) {
      g.fillStyle = '#2563eb';
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#f8fafc';
      for (let i = 0; i < 4; i++) g.fillRect(0, i * 32 + 8, 128, 12);
      g.fillStyle = '#facc15';
      g.fillRect(60, 0, 10, 128);
    }
    marble = roller = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 28, 18),
      new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(swirl), roughness: 0.18, metalness: 0.25 }),
    );
  }
  scene.add(marble);
  let fx: Fx | null = null; // effects and trail (diorama look only), made below
  let trail: Trail | null = null;

  // ---- the blocks ----
  const soup = new Soup();
  const bank = dio ? (look.ground ?? mix(palette.side, 0xf2e2b8, 0.5)) : palette.side; // the soft ground-coloured sides under the track (diorama look)
  const topSoup = new Soup(); // patterned tops (diorama look): textured
  const woodSoup = new Soup(); // wall bases (diorama look): textured
  const wallStyle = look.wall;
  const { width: W, height: H } = course;
  // The fixed layout. Timed things (trapdoors, gates, geysers) are drawn separately below and move with the clock.
  const WALL_TILE: Tile = { ch: '=', level: 0, surface: 'normal', slope: null, door: -1 };
  const VOID_TILE: Tile = { ch: '.', level: 0, surface: 'normal', slope: null, door: -1 };
  const hideGateDoors = new Set<number>(stopSigns ? course.gates.flatMap((g) => g.tunnels.map((t) => t.door)) : []);
  const tile = (x: number, y: number): Tile => {
    if (x < 0 || y < 0 || x >= W || y >= H) return VOID_TILE;
    const t = course.tiles[y * W + x];
    // With maths on, the doors at the ends of the answer tunnels are drawn as plain floor, shut or open, so the wall gives nothing away.
    if (t.door >= 0 && hideGateDoors.has(t.door)) return { ...t, ch: '#', door: -1 };
    if (t.door >= 0) return world.open.has(t.door) ? { ...t, ch: '#' } : WALL_TILE;
    return t.ch === 'q' ? { ...t, ch: '#' } : t;
  };
  const isFloor = (t: Tile) => t.ch !== '.' && t.ch !== '=';
  const drawsTop = (t: Tile) => t.ch !== '.' && t.ch !== '=' && t.ch !== 't';
  /** Heights of the neighbour's edge facing us, matched to our two corners; null if no floor there. */
  const across = (x: number, y: number, side: 'N' | 'E' | 'S' | 'W'): [number, number] | null => {
    const n = tile(x + (side === 'E' ? 1 : side === 'W' ? -1 : 0), y + (side === 'S' ? 1 : side === 'N' ? -1 : 0));
    if (!isFloor(n)) return null;
    const c = corners(n);
    // Our N edge (nw, ne) meets the neighbour's S edge (sw, se), and so on.
    return side === 'N' ? [c[3], c[2]] : side === 'S' ? [c[0], c[1]] : side === 'E' ? [c[0], c[3]] : [c[1], c[2]];
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = tile(x, y);
      if (!drawsTop(t)) continue; // gaps, walls (below) and trapdoors (moving, below)
      const [nw, ne, se, sw] = corners(t);
      let top = (x + y) % 2 === 0 ? palette.floorA : palette.floorB;
      if (t.ch === 'i') top = palette.ice;
      else if (t.ch === 'm') top = palette.mud;
      else if (t.ch === 's') top = palette.start;
      else if (t.ch === 'c') top = palette.checkpoint;
      else if (t.ch === 'k' || t.ch === 'h') top = palette.stop;
      else if (t.ch === 'f') top = (x + y) % 2 === 0 ? palette.finishA : palette.finishB;
      else if (t.ch === 'j') top = palette.pad;
      else if (t.door >= 0) top = palette.door;
      else if (CONVEYOR_DIR[t.ch]) top = palette.belt;
      else if (t.ch === 'g') top = palette.geyser;
      const P = (cx: number, cy: number, h: number) => [x + cx, h, y + cy];
      const cornerH = [nw, ne, se, sw];
      /** The top surface's height at a spot in the tile (u across, v down); slopes are flat planes, so this is exact. */
      const surface = (u: number, v: number) => nw * (1 - u) * (1 - v) + ne * u * (1 - v) + se * u * v + sw * (1 - u) * v;
      const plain = top === palette.floorA || top === palette.floorB;
      if (!dio) {
        soup.quad(P(0, 0, nw), P(0, 1, sw), P(1, 1, se), P(1, 0, ne), top);
      } else {
        // Ambient darkening: a top corner that touches a wall or a higher block is darker.
        const dark = (cx: number, cy: number) => {
          const mine = cornerH[cx === 0 ? (cy === 0 ? 0 : 3) : cy === 0 ? 1 : 2];
          const dx = cx === 1 ? 1 : -1;
          const dy = cy === 1 ? 1 : -1;
          const blocks = (nx: number, ny: number, weight: number) => {
            const n = tile(nx, ny);
            if (n.ch === '=') return weight;
            if (!isFloor(n)) return 0;
            const u = x + cx - nx;
            const v = y + cy - ny;
            return corners(n)[u === 0 ? (v === 0 ? 0 : 3) : v === 0 ? 1 : 2] > mine + 0.05 ? weight : 0;
          };
          return Math.max(0.5, 1 - blocks(x + dx, y, 0.22) - blocks(x, y + dy, 0.22) - blocks(x + dx, y + dy, 0.12));
        };
        const shades = [dark(0, 0), dark(0, 1), dark(1, 1), dark(1, 0)];
        if (plain && look.topPattern !== 'none') {
          // One shared texture by world position, so it runs on across tiles. A very faint two-tone keeps the speed readable.
          const tint = (x + y) % 2 === 0 ? 0xffffff : look.topPattern === 'sand' || look.topPattern === 'sinter' ? 0xf1ebe0 : look.topPattern === 'tarmac' ? 0xf5f5f5 : 0xeceff2;
          topSoup.quad(P(0, 0, nw), P(0, 1, sw), P(1, 1, se), P(1, 0, ne), tint, shades, (p) => [p[0] / TOP_TILES, p[2] / TOP_TILES]);
        } else {
          soup.quad(P(0, 0, nw), P(0, 1, sw), P(1, 1, se), P(1, 0, ne), top, shades);
        }
        // Faint chevrons pointing downhill on a slope.
        if (t.slope) {
          const d = t.slope === 'E' ? [1, 0] : t.slope === 'W' ? [-1, 0] : t.slope === 'S' ? [0, 1] : [0, -1];
          const side = [-d[1], d[0]];
          const ink = plain && look.topPattern !== 'sand' && look.topPattern !== 'none' ? TOP_INK[look.topPattern].ink : mix(top, 0x8a5a1e, 0.3);
          for (const along of [-0.22, 0.2]) {
            // The tip points downhill; the arms sweep back and out.
            const tip = [0.5 + d[0] * (along + 0.12), 0.5 + d[1] * (along + 0.12)];
            for (const sign of [-1, 1]) {
              const end = [tip[0] - d[0] * 0.2 + side[0] * 0.26 * sign, tip[1] - d[1] * 0.2 + side[1] * 0.26 * sign];
              const pts = [tip, end, [end[0] - d[0] * 0.09, end[1] - d[1] * 0.09], [tip[0] - d[0] * 0.09, tip[1] - d[1] * 0.09]];
              const [a, b, c, e] = pts.map(([u, v]) => [x + u, surface(u, v) + 0.012, y + v]);
              soup.upQuad(a, b, c, e, ink);
            }
          }
        }
      }

      // Ice sparkles and mud blobs, so the surface is clear without relying on colour.
      if (t.ch === 'i') {
        const h = nw + 0.012;
        for (const [dx, dy] of [[0.3, 0.3], [0.7, 0.65], [0.35, 0.75]]) {
          const s = 0.09;
          soup.quad([x + dx, h, y + dy - s], [x + dx - s, h, y + dy], [x + dx, h, y + dy + s], [x + dx + s, h, y + dy], 0xffffff);
        }
      } else if (t.ch === 'm') {
        const h = nw + 0.012;
        for (const [dx, dy] of [[0.25, 0.3], [0.65, 0.25], [0.5, 0.7], [0.8, 0.75]]) {
          const s = 0.1;
          soup.quad([x + dx - s, h, y + dy - s], [x + dx - s, h, y + dy + s], [x + dx + s, h, y + dy + s], [x + dx + s, h, y + dy - s], 0x3e2a16);
        }
      }

      const belt = CONVEYOR_DIR[t.ch];
      if (belt) {
        // Chevrons pointing the way the belt carries you (so it reads without colour).
        const h = nw + 0.012;
        for (const k of [0.25, 0.6]) {
          const cx = x + 0.5 + belt[0] * (k - 0.5);
          const cy = y + 0.5 + belt[1] * (k - 0.5);
          const fx = belt[0] * 0.16;
          const fy = belt[1] * 0.16;
          const px = -belt[1] * 0.22;
          const py = belt[0] * 0.22;
          soup.tri([cx + fx, h, cy + fy], [cx + px, h, cy + py], [cx - px, h, cy - py], 0xffffff);
        }
      }

      // Sides: down to the floor beside it, or a fixed thickness where there is none.
      const edges: Array<['N' | 'E' | 'S' | 'W', [number, number], number[][]]> = [
        ['N', [nw, ne], [[0, 0], [1, 0]]],
        ['E', [ne, se], [[1, 0], [1, 1]]],
        ['S', [se, sw], [[1, 1], [0, 1]]],
        ['W', [sw, nw], [[0, 1], [0, 0]]],
      ];
      for (const [side, mine, pts] of edges) {
        const nb = across(x, y, side);
        const nbTile = tile(x + (side === 'E' ? 1 : side === 'W' ? -1 : 0), y + (side === 'S' ? 1 : side === 'N' ? -1 : 0));
        if (nbTile.ch === '=') continue;
        // Matched corner by corner: for E and S the order along the edge flips between us and the neighbour.
        const theirs: [number, number] | null = nb ? (side === 'N' || side === 'S' ? (side === 'N' ? [nb[0], nb[1]] : [nb[1], nb[0]]) : side === 'E' ? [nb[0], nb[1]] : [nb[1], nb[0]]) : null;
        const bottoms = mine.map((m, i) => {
          const them = theirs ? theirs[i] : null;
          return them === null ? m - THICK : Math.min(m, them);
        });
        if (bottoms[0] >= mine[0] - 1e-9 && bottoms[1] >= mine[1] - 1e-9) continue;
        const a = [x + pts[0][0], mine[0], y + pts[0][1]];
        const b = [x + pts[1][0], mine[1], y + pts[1][1]];
        const b2 = [b[0], bottoms[1], b[2]];
        const a2 = [a[0], bottoms[0], a[2]];
        if (!dio) {
          soup.quad(a, a2, b2, b, palette.side);
        } else {
          // The lower part of a side is darker.
          soup.quad(a, a2, b2, b, bank, [0.95, 0.7, 0.7, 0.95]);
          // A thin light strip along the top edge of a drop, so the edge is easy to see.
          const inward = side === 'N' ? [0, 1] : side === 'S' ? [0, -1] : side === 'E' ? [-1, 0] : [1, 0];
          const lift = (px: number, py: number) => [x + px, surface(px, py) + 0.012, y + py];
          const outer = pts.map(([px, py]) => lift(px, py));
          const inner = pts.map(([px, py]) => lift(px + inward[0] * EDGE_STRIP, py + inward[1] * EDGE_STRIP));
          soup.upQuad(outer[0], outer[1], inner[1], inner[0], plain && look.topPattern !== 'sand' && look.topPattern !== 'none' ? TOP_INK[look.topPattern].edge : mix(top, 0xffffff, 0.78));
        }
      }
    }
  }

  // Walls and shut doors: blocks that stand above the floor beside them.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = tile(x, y);
      if (t.ch !== '=') continue;
      let base = -Infinity;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const n = tile(x + dx, y + dy);
        if (isFloor(n)) base = Math.max(base, Math.max(...corners(n)));
      }
      if (base === -Infinity) continue; // buried inside other walls
      const isDoor = course.tiles[y * W + x].door >= 0;
      if (dio) {
        addRail(x, y, base, isDoor);
        continue;
      }
      const top = base + WALL_HEIGHT;
      const colour = course.tiles[y * W + x].door >= 0 ? palette.door : palette.rail;
      soup.quad([x, top, y], [x, top, y + 1], [x + 1, top, y + 1], [x + 1, top, y], colour);
      const sides: Array<[number, number, number[], number[]]> = [
        [0, -1, [x, y], [x + 1, y]],
        [1, 0, [x + 1, y], [x + 1, y + 1]],
        [0, 1, [x + 1, y + 1], [x, y + 1]],
        [-1, 0, [x, y + 1], [x, y]],
      ];
      for (const [dx, dy, p, q] of sides) {
        const n = tile(x + dx, y + dy);
        if (n.ch === '=') continue;
        const bottom = isFloor(n) ? Math.min(...corners(n)) : base - THICK;
        soup.quad([p[0], top, p[1]], [p[0], bottom, p[1]], [q[0], bottom, q[1]], [q[0], top, q[1]], colour === palette.door ? palette.door : palette.side);
      }
    }
  }
  const trackMeshes: THREE.Mesh[] = []; // the track catches shadows but doesn't cast them, so flat tops stay clean
  /** The floor height a wall tile stands on (the highest floor beside it), or null if it's buried in other walls. */
  function wallBase(x: number, y: number): number | null {
    if (tile(x, y).ch !== '=') return null;
    let b = -Infinity;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const n = tile(x + dx, y + dy);
      if (isFloor(n)) b = Math.max(b, Math.max(...corners(n)));
    }
    return b === -Infinity ? null : b;
  }
  function doorAt(x: number, y: number): boolean {
    return course.tiles[y * W + x].door >= 0;
  }
  /** How tall the wall body (below any rail) is on a tile. Doors are always the low plank height; rock varies a little from tile to tile. */
  function bodyHeight(x: number, y: number): number {
    if (doorAt(x, y)) return BASE_HEIGHT;
    if (wallStyle.base === 'rock') return CHUNKY_HEIGHT + 0.09 * tileHash(x, y);
    if (wallStyle.base === 'snowbank') return CHUNKY_HEIGHT + 0.02;
    return BASE_HEIGHT;
  }
  /** The top edge's shape, from the flat top outwards: [how far in from the side, how far down]. The last step ends on the side wall itself. */
  function profileOf(x: number, y: number): Array<[number, number]> {
    if (doorAt(x, y)) return [[RAIL_BEVEL, 0], [0, RAIL_BEVEL]];
    if (wallStyle.base === 'snowbank') return [[0.17, 0], [0.1, 0.035], [0.045, 0.1], [0, 0.19]];
    if (wallStyle.base === 'rock') return [[0.07, 0], [0, 0.07]];
    return [[RAIL_BEVEL, 0], [0, RAIL_BEVEL]];
  }
  /** A wall tile: same footprint on every course, a bevelled top, a textured body (or a door in its own colour). */
  function addRail(x: number, y: number, base: number, isDoor: boolean) {
    const top = base + bodyHeight(x, y);
    const out = isDoor ? soup : woodSoup;
    const colour = isDoor ? palette.door : wallStyle.tint ?? 0xffffff;
    const wood: UvOf | undefined = isDoor ? undefined : (p) => [(p[0] + p[2]) / PLANK_TILES, p[1] / PLANK_HEIGHT];
    const woodTop: UvOf | undefined = isDoor ? undefined : (p) => [p[0] / PLANK_TILES, p[2] / PLANK_HEIGHT];
    const sides: Array<[number, number, number[], number[]]> = [
      [0, -1, [x, y], [x + 1, y]],
      [1, 0, [x + 1, y], [x + 1, y + 1]],
      [0, 1, [x + 1, y + 1], [x, y + 1]],
      [-1, 0, [x, y + 1], [x, y]],
    ];
    const exposed = sides.map(([dx, dy]) => tile(x + dx, y + dy).ch !== '=');
    // Below the wall on its open sides: down past the lowest floor beside it, so no gap shows under it.
    let lowest = base;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const n = tile(x + dx, y + dy);
      if (isFloor(n)) lowest = Math.min(lowest, Math.min(...corners(n)));
    }
    // The top is pulled in on every open side, with sloping (or rounded) strips down to the side.
    const profile = profileOf(x, y);
    const ring = (k: number, pt: number[]) => {
      const [inset, drop] = profile[k];
      return [pt[0] === x ? x + (exposed[3] ? inset : 0) : x + 1 - (exposed[1] ? inset : 0), top - drop, pt[1] === y ? y + (exposed[0] ? inset : 0) : y + 1 - (exposed[2] ? inset : 0)];
    };
    const corner = (cx: number, cy: number) => ring(0, [x + cx, y + cy]);
    out.quad(corner(0, 0), corner(0, 1), corner(1, 1), corner(1, 0), colour, [1, 1, 1, 1], woodTop);
    const sideDrop = profile[profile.length - 1][1];
    sides.forEach(([dx, dy, p, q], i) => {
      const n = tile(x + dx, y + dy);
      if (!exposed[i]) {
        // A wall beside a lower wall (they step down a slope): fill the step, so there's no see-through notch.
        const below = wallBase(x + dx, y + dy);
        const theirTop = below === null ? -Infinity : below + bodyHeight(x + dx, y + dy);
        if (theirTop < top - 1e-9) {
          const to = below === null ? lowest - THICK : theirTop;
          out.quad([p[0], top, p[1]], [p[0], to, p[1]], [q[0], to, q[1]], [q[0], top, q[1]], colour, [1, 0.86, 0.86, 1], wood);
        }
        return;
      }
      const bottom = isFloor(n) ? Math.min(...corners(n)) : lowest - THICK;
      const sideTop = top - sideDrop;
      for (let k = 0; k < profile.length - 1; k++) {
        out.quad(ring(k, p), ring(k + 1, p), ring(k + 1, q), ring(k, q), isDoor ? mix(palette.door, 0xffffff, 0.15) : colour, [1, 1, 1, 1], wood);
      }
      // The body down to the floor; where the wall stands over a drop, ground-coloured earth below that (like the track's own sides), so the wall isn't a tall slab.
      const planks = isFloor(n) ? bottom : Math.max(bottom, base);
      out.quad([p[0], sideTop, p[1]], [p[0], planks, p[1]], [q[0], planks, q[1]], [q[0], sideTop, q[1]], colour, wallStyle.base === 'snowbank' ? [1, 0.93, 0.93, 1] : [0.95, 0.82, 0.82, 0.95], wood);
      if (planks > bottom + 1e-9) soup.quad([p[0], planks, p[1]], [p[0], bottom, p[1]], [q[0], bottom, q[1]], [q[0], planks, q[1]], bank, [0.95, 0.72, 0.72, 0.95]);
    });
  }

  // Rails along every wall run (logs or steel pipe), and posts at corners, ends and now and then along a run. All merged into a few meshes.
  const woodLogs: THREE.BufferGeometry[] = []; // logs, joints and round posts (the log texture)
  const doorLogs: THREE.BufferGeometry[] = [];
  const pipeParts: THREE.BufferGeometry[] = []; // pipe rails, joints and their little supports (the steel texture)
  const poleParts: THREE.BufferGeometry[] = []; // white snow poles
  const poleTips: THREE.BufferGeometry[] = []; // their orange-red tops
  const ironParts: THREE.BufferGeometry[] = []; // dark iron bollards
  const snowParts: THREE.BufferGeometry[] = []; // snow caps and strips
  if (dio) {
    const isWall = (x: number, y: number) => wallBase(x, y) !== null;
    const railStyle = (x: number, y: number) => (doorAt(x, y) ? 'log' : wallStyle.top);
    const railRadius = (x: number, y: number) => (railStyle(x, y) === 'pipe' ? PIPE_RADIUS : LOG_RADIUS);
    const centre = (x: number, y: number) => {
      const lift = railStyle(x, y) === 'pipe' ? PIPE_LIFT : LOG_RADIUS * 0.8;
      return new THREE.Vector3(x + 0.5, (wallBase(x, y) ?? 0) + bodyHeight(x, y) + lift, y + 0.5);
    };
    const up = new THREE.Vector3(0, 1, 0);
    /** Squashes geometry flat (in height) about a point, for snow lying on top of things. */
    const flatten = (geo: THREE.BufferGeometry, about: THREE.Vector3, k: number) => {
      geo.translate(-about.x, -about.y, -about.z);
      geo.scale(1, k, 1);
      geo.translate(about.x, about.y, about.z);
      return geo;
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isWall(x, y)) continue;
        const a = centre(x, y);
        const door = doorAt(x, y);
        const style = railStyle(x, y);
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          if (!isWall(x + dx, y + dy)) continue;
          const nextDoor = doorAt(x + dx, y + dy);
          const useStyle = door || nextDoor ? 'log' : style;
          if (useStyle === 'none') continue;
          const rad = useStyle === 'pipe' ? PIPE_RADIUS : LOG_RADIUS;
          const b = centre(x + dx, y + dy);
          if (Math.abs(b.y - a.y) > 0.01) continue; // a step: the rails stop, with a post each side
          const dir = new THREE.Vector3().subVectors(b, a);
          const len = dir.length();
          const geo = new THREE.CylinderGeometry(rad, rad, len, useStyle === 'pipe' ? 10 : 12, 1);
          const mid = a.clone().add(b).multiplyScalar(0.5);
          geo.applyMatrix4(new THREE.Matrix4().compose(mid, new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize()), new THREE.Vector3(1, 1, 1)));
          (useStyle === 'pipe' ? pipeParts : door || nextDoor ? doorLogs : woodLogs).push(geo);
          if (wallStyle.snowy && useStyle === 'log') {
            // A white strip of snow along the top of the log.
            const strip = new THREE.CylinderGeometry(rad * 0.95, rad * 0.95, len, 10, 1);
            strip.applyMatrix4(new THREE.Matrix4().compose(mid.clone().add(new THREE.Vector3(0, rad * 0.6, 0)), new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize()), new THREE.Vector3(1, 1, 1)));
            snowParts.push(flatten(strip, mid.clone().add(new THREE.Vector3(0, rad * 0.6, 0)), 0.6));
          }
        }
        const east = isWall(x + 1, y);
        const west = isWall(x - 1, y);
        const north = isWall(x, y - 1);
        const south = isWall(x, y + 1);
        const alongX = east && west && !north && !south;
        const alongY = north && south && !east && !west;
        const stepNear = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isWall(x + dx, y + dy) && Math.abs(centre(x + dx, y + dy).y - a.y) > 0.01);
        const post = stepNear || !(alongX || alongY) || (alongX && x % 3 === 0) || (alongY && y % 3 === 0);
        const baseTop = (wallBase(x, y) ?? 0) + bodyHeight(x, y);
        if (style !== 'none') {
          // A round joint where rails meet, so tilted rails join smoothly.
          const rad = railRadius(x, y);
          const joint = new THREE.SphereGeometry(rad, 12, 8);
          joint.translate(a.x, a.y, a.z);
          (style === 'pipe' ? pipeParts : door ? doorLogs : woodLogs).push(joint);
          if (style === 'pipe') {
            // A thin support under the pipe (every tile, so the rail looks held up).
            const h = a.y - baseTop;
            const leg = new THREE.CylinderGeometry(0.04, 0.045, h, 8);
            leg.translate(a.x, baseTop + h / 2, a.z);
            pipeParts.push(leg);
          }
        }
        if ((door && post) || (!door && post && wallStyle.post === 'round')) {
          // The door's own round post, or a driftwood post (door posts stay in the door colour on every course).
          const h = 0.36;
          const postBase = door ? a.y - LOG_RADIUS * 0.8 : baseTop;
          const body = new THREE.CylinderGeometry(0.18, 0.21, h, 14);
          body.translate(a.x, postBase + h / 2, a.z);
          const cap = new THREE.SphereGeometry(0.18, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
          cap.translate(a.x, postBase + h, a.z);
          (door ? doorLogs : woodLogs).push(body);
          if (wallStyle.snowy && !door) snowParts.push(flatten(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(a.x, postBase + h - 0.01, a.z), new THREE.Vector3(a.x, postBase + h - 0.01, a.z), 0.9));
          else (door ? doorLogs : woodLogs).push(cap);
        } else if (post && wallStyle.post === 'snowpole') {
          const h = 0.9 - (baseTop - (wallBase(x, y) ?? 0));
          const pole = new THREE.CylinderGeometry(0.035, 0.04, h, 8);
          pole.translate(a.x, baseTop + h / 2, a.z);
          poleParts.push(pole);
          const tip = new THREE.CylinderGeometry(0.043, 0.043, 0.17, 8);
          tip.translate(a.x, baseTop + h - 0.085, a.z);
          const cap = new THREE.SphereGeometry(0.043, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
          cap.translate(a.x, baseTop + h, a.z);
          poleTips.push(tip, cap);
        } else if (post && wallStyle.post === 'bollard') {
          const h = 0.34;
          const body = new THREE.CylinderGeometry(0.1, 0.13, h, 12);
          body.translate(a.x, baseTop + h / 2, a.z);
          const cap = new THREE.SphereGeometry(0.15, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
          cap.scale(1, 0.7, 1);
          cap.translate(a.x, baseTop + h, a.z);
          const band = new THREE.CylinderGeometry(0.135, 0.135, 0.04, 12);
          band.translate(a.x, baseTop + 0.08, a.z);
          ironParts.push(body, cap, band);
        }
      }
    }
  }

  // Some wall faces come out the wrong way round, so on the diorama look every block is drawn from both sides: no see-through gaps, whatever way a face points.
  const soupMesh = soup.mesh(dio ? new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }) : undefined);
  scene.add(soupMesh);
  if (dio) {
    const topMesh = look.topPattern !== 'none' ? topSoup.mesh(new THREE.MeshLambertMaterial({ map: topTexture(look.topPattern, anisotropy), vertexColors: true })) : null;
    // A little glow on some wall materials lifts their shaded faces (rock, concrete, snow) without changing the shape's shading.
    const WALL_GLOW: Partial<Record<string, number>> = { rock: 0x6a4e3c, concrete: 0x3a3a3a, snowbank: 0xa3b8d0 };
    const woodMesh = woodSoup.mesh(new THREE.MeshLambertMaterial({ map: wallTexture(wallStyle.base, anisotropy), vertexColors: true, side: THREE.DoubleSide, emissive: WALL_GLOW[wallStyle.base] ?? 0x000000 }));
    scene.add(woodMesh);
    if (topMesh) scene.add(topMesh);
    const addMerged = (parts: THREE.BufferGeometry[], material: THREE.Material) => {
      if (parts.length) scene.add(new THREE.Mesh(mergeGeometries(parts), material));
    };
    addMerged(woodLogs, new THREE.MeshLambertMaterial({ map: wallTopTexture('log', anisotropy), color: wallStyle.tint ? mix(0xffffff, wallStyle.tint, 0.6) : 0xffffff }));
    addMerged(doorLogs, new THREE.MeshLambertMaterial({ color: palette.door }));
    addMerged(pipeParts, new THREE.MeshLambertMaterial({ map: wallTopTexture('pipe', anisotropy) }));
    addMerged(poleParts, new THREE.MeshLambertMaterial({ color: 0xf6f8fa }));
    addMerged(poleTips, new THREE.MeshLambertMaterial({ color: 0xe8541f }));
    addMerged(ironParts, new THREE.MeshLambertMaterial({ color: 0x30353b }));
    addMerged(snowParts, new THREE.MeshLambertMaterial({ color: 0xf7fbff }));
    trackMeshes.push(soupMesh);
    if (topMesh) trackMeshes.push(topMesh);
  }

  // ---- things standing on the course ----
  const solid = (colour: number) => new THREE.MeshLambertMaterial({ color: colour });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = tile(x, y);
      const h = Math.max(...corners(t)) ;
      if (t.ch === 'b' && dio) {
        // A chunky red-and-white buoy on the same footprint.
        const parts: Array<[number, number, number, number, number]> = [
          // top radius, bottom radius, height, centre height, colour
          [0.38, 0.4, 0.26, 0.13, palette.bumper],
          [0.385, 0.385, 0.14, 0.33, 0xffffff],
          [0.3, 0.385, 0.14, 0.47, palette.bumper],
        ];
        for (const [rt, rb, ht, cy, colour] of parts) {
          const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, ht, 24), solid(colour));
          m.position.set(x + 0.5, h + cy, y + 0.5);
          scene.add(m);
        }
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 10), solid(0xffffff));
        knob.position.set(x + 0.5, h + 0.6, y + 0.5);
        scene.add(knob);
      } else if (t.ch === 'b') {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.5, 20), solid(palette.bumper));
        post.position.set(x + 0.5, h + 0.25, y + 0.5);
        scene.add(post);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 0.12, 20), solid(0xffffff));
        cap.position.set(x + 0.5, h + 0.56, y + 0.5);
        scene.add(cap);
      } else if (t.ch === 'j') {
        for (const dz of [-0.18, 0.12]) {
          const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.2, 4), solid(0xffffff));
          arrow.position.set(x + 0.5, h + 0.12, y + 0.5 + dz);
          arrow.rotation.y = Math.PI / 4;
          scene.add(arrow);
        }
      } else if ((t.ch === 'c' || t.ch === 'f') && tile(x - 1, y).ch !== t.ch && tile(x, y - 1).ch !== t.ch) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 8), solid(0x374151));
        pole.position.set(x + 0.12, h + 0.55, y + 0.12);
        scene.add(pole);
        const flag = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.03), solid(t.ch === 'c' ? 0xef4444 : 0x111827));
        flag.position.set(x + 0.4, h + 0.95, y + 0.12);
        scene.add(flag);
      }
    }
  }

  // ---- timed hazards ----
  const gateHeight = (dio ? RAIL_HEIGHT : WALL_HEIGHT) + 0.1;
  const trapdoors: { mesh: THREE.Mesh; tx: number }[] = [];
  const gates: { mesh: THREE.Mesh; tx: number }[] = [];
  const geysers: { plume: THREE.Mesh; tx: number; ty: number }[] = [];
  const plumeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65, depthWrite: false });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = course.tiles[y * W + x];
      const h = t.level * LEVEL;
      if (t.ch === 't') {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.22, 0.96), solid(palette.trapdoor));
        mesh.position.set(x + 0.5, h - 0.11, y + 0.5);
        scene.add(mesh);
        trapdoors.push({ mesh, tx: x });
      } else if (t.ch === 'q') {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, gateHeight, 1), solid(palette.gate));
        mesh.position.set(x + 0.5, h + gateHeight / 2, y + 0.5);
        scene.add(mesh);
        gates.push({ mesh, tx: x });
      } else if (t.ch === 'g') {
        const plume = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 1, 14), plumeMat);
        plume.position.set(x + 0.5, h, y + 0.5);
        scene.add(plume);
        geysers.push({ plume, tx: x, ty: y });
      }
    }
  }
  // Wind streaks, shown while a gust blows (and a moment before, as a warning).
  const wind = course.def.wind;
  const streaks: THREE.Mesh[] = [];
  if (wind) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false });
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.05), mat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.atan2(-wind.dy, wind.dx);
      m.visible = false;
      scene.add(m);
      streaks.push(m);
    }
  }

  // ---- the marble's blob shadow (Simple level, and every course without the diorama look) ----
  const shadowTex = document.createElement('canvas');
  shadowTex.width = shadowTex.height = 64;
  const sg = shadowTex.getContext('2d');
  if (sg) {
    const grad = sg.createRadialGradient(32, 32, 4, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,0.45)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sg.fillStyle = grad;
    sg.fillRect(0, 0, 64, 64);
  }
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(BALL_RADIUS * 3.2, BALL_RADIUS * 3.2),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowTex), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  // ---- the camera ----
  const camera = new THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 200);
  let halfH = 4.5;
  const D = 22;

  function resize(width: number, height: number) {
    const aspect = width / Math.max(1, height);
    halfH = Math.max(4.4, 5.6 / aspect);
    camera.left = -halfH * aspect;
    camera.right = halfH * aspect;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.zoom = otherKinds.includes('rival') ? 0.72 : 1; // two players: see more of the course
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    viewAspect = aspect;
    fitBackdrop();
  }

  const dpr = window.devicePixelRatio || 1;
  let shadowsOn = false;
  /** Applies a quality level. Other courses only ever change the pixel ratio, as before. */
  function setQuality(q: Quality) {
    quality = q;
    const st = settingsFor(q, dpr);
    renderer.setPixelRatio(dio ? st.pixelRatio : q === 'simple' ? 1 : Math.min(1.5, dpr));
    if (dio) {
      const resized = sun.shadow.mapSize.x !== st.shadowMapSize && st.shadows;
      if (resized) {
        sun.shadow.mapSize.set(st.shadowMapSize, st.shadowMapSize);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
      if (st.shadows !== shadowsOn || resized) {
        shadowsOn = st.shadows;
        renderer.shadowMap.enabled = shadowsOn;
        sun.castShadow = shadowsOn;
        scene.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: THREE.Material) => (m.needsUpdate = true));
        });
      }
    }
  }
  setQuality(quality);

  const spin = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  // Other marbles: a ghost is pale and see-through; the second player's is orange.
  const others = otherKinds.map((kind) => {
    let mesh: THREE.Object3D;
    let made: MarbleObject | null = null;
    if (dio) {
      made = makeMarble(kind);
      mesh = made.root;
    } else {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(BALL_RADIUS, 20, 14),
        kind === 'ghost'
          ? new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.45, depthWrite: false })
          : new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.2, metalness: 0.25 }),
      );
    }
    mesh.visible = false;
    scene.add(mesh);
    return { kind, mesh, made };
  });
  const rivalAt = otherKinds.indexOf('rival');

  // ---- the signs over the tunnels of an answer gate: an answer each (maths), or an arrow over the open tunnel ----
  const signSprites = signs.map((sign) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTexture(sign.text, sign.arrow), transparent: true, depthTest: false }));
    const floor = course.tiles[sign.ty * W + sign.tx].level * LEVEL;
    sprite.position.set(sign.x, floor + 1.5, sign.y);
    sprite.scale.set(1.9, 0.95, 1);
    sprite.renderOrder = 10;
    scene.add(sprite);
    return sprite;
  });

  // ---- question stops (maths on): a sign over each, saying what a right answer takes off ----
  const stopSprites: THREE.Sprite[] = [];
  if (stopSigns) {
    for (let stop = 0; stop < course.pitCount; stop++) {
      const kind = course.pitKind[stop];
      if (kind === 'c') continue;
      // The middle tile of the stop's strip.
      const cells: number[] = [];
      course.pitAt.forEach((p, i) => p === stop && cells.push(i));
      const mid = cells[Math.floor(cells.length / 2)];
      const tx = mid % W;
      const ty = Math.floor(mid / W);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTexture(kind === 'k' ? '−1s' : '−½s', false), transparent: true, depthTest: false }));
      sprite.position.set(tx + 0.5, course.tiles[mid].level * LEVEL + 1.2, ty + 0.5);
      sprite.scale.set(1.3, 0.65, 1);
      sprite.renderOrder = 10;
      scene.add(sprite);
      stopSprites.push(sprite);
    }
  }

  // ---- number gems: a spinning gem with its answer over it. A right gem vanishes when the marble takes it; a wrong one stays. ----
  const gemGeometry = new THREE.OctahedronGeometry(0.2);
  const gemMaterial = new THREE.MeshStandardMaterial({ color: 0x22d3ee, roughness: 0.25, metalness: 0.2, emissive: 0x0e7490, emissiveIntensity: 0.4 });
  const gemObjects = gems.map((gem) => {
    const floor = course.tiles[gem.ty * W + gem.tx].level * LEVEL;
    const mesh = new THREE.Mesh(gemGeometry, gemMaterial);
    mesh.position.set(gem.x, floor + 0.45, gem.y);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTexture(gem.text, false), transparent: true, depthTest: false }));
    label.position.set(gem.x, floor + 1.15, gem.y);
    label.scale.set(1.2, 0.6, 1);
    label.renderOrder = 10;
    scene.add(mesh, label);
    return { id: gem.id, mesh, label };
  });

  // With the diorama look, the sun lights the marble and the track casts and catches shadows.
  if (dio) {
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o === shadow) return;
      const type = (o.material as THREE.Material).type;
      const lit = type === 'MeshLambertMaterial' || type === 'MeshStandardMaterial' || type === 'MeshPhysicalMaterial';
      o.castShadow = lit;
      // The blocks are open sheets, not closed solids, so shadows are drawn from both sides of every face.
      (o.material as THREE.Material).shadowSide = THREE.DoubleSide;
      o.receiveShadow = lit;
    });
    for (const m of trackMeshes) m.castShadow = false;
  }

  // Effects and the speed trail (diorama look only). They follow the quality level.
  const fxSettings = (): QualitySettings => settingsFor(quality, dpr);
  if (dio) {
    const gemPos = (id: number) => gemObjects.find((o) => o.id === id)?.mesh.position;
    fx = createFx(scene, fxSettings(), reducedMotion, gemPos);
    trail = makeTrail(fxSettings(), reducedMotion);
    scene.add(trail.object);
  }
  // The last state we looked for events in (a copy: the run's own objects change in place), and where the marble last had floor.
  let seen: RunState | null = null;
  let lastFloor = 0;
  const doorsOpen = new Set(world.open);

  let first = true;

  return {
    resize,
    setQuality(q) {
      setQuality(q);
      fx?.setQuality(fxSettings());
      trail?.setQuality(fxSettings());
      resize(canvas.clientWidth, canvas.clientHeight);
    },
    setLowQuality(l) {
      setQuality(l ? 'simple' : startQuality);
      fx?.setQuality(fxSettings());
      trail?.setQuality(fxSettings());
      resize(canvas.clientWidth, canvas.clientHeight);
    },
    draw(prev, now, alpha, dt, drawOthers = []) {
      const x = prev.x + (now.x - prev.x) * alpha;
      const y = prev.y + (now.y - prev.y) * alpha;
      const z = prev.z + (now.z - prev.z) * alpha;
      marble.position.set(x, z + BALL_RADIUS, y);
      const speed = Math.sqrt(now.vx * now.vx + now.vy * now.vy);
      if (speed > 0.01 && dt > 0) {
        axis.set(now.vy, 0, -now.vx).normalize();
        spin.setFromAxisAngle(axis, (speed * dt) / BALL_RADIUS);
        roller.quaternion.premultiply(spin);
      }
      const under = floorHeightAt(world, x, y);
      shadow.visible = under !== null && under <= z + 0.05 && !shadowsOn;
      shadow.position.set(x, (under ?? z) + 0.02, y);
      if (under !== null && under <= z + 0.05) lastFloor = under;
      if (fx && trail) {
        trail.push(x, z + BALL_RADIUS, y, speed);
        // Events only when the run has moved on. A fall's splash goes at the last floor height, not down at the kill depth.
        if (seen && now.steps >= seen.steps) {
          if (now.steps !== seen.steps || now.held !== seen.held || now.falls !== seen.falls || now.outcome !== seen.outcome) {
            fx.onEvents(runEvents(seen, now).map((e) => (e.kind === 'fall' ? { ...e, z: lastFloor } : e)));
          }
        }
        if (!seen || now.steps !== seen.steps || now.held !== seen.held || now.falls !== seen.falls || now.outcome !== seen.outcome) seen = { ...now, gemsTaken: [...now.gemsTaken] };
        // A door that has just opened gives a little puff.
        for (const d of world.open) {
          if (doorsOpen.has(d) || hideGateDoors.has(d)) continue;
          doorsOpen.add(d);
          course.tiles.forEach((t, i) => {
            if (t.door === d) fx?.doorOpen((i % W) + 0.5, t.level * LEVEL + 0.35, Math.floor(i / W) + 0.5);
          });
        }
        fx.update(dt);
      }
      let seenRival: { x: number; y: number; z: number } | null = null;
      others.forEach((o, i) => {
        const p = drawOthers[i];
        o.mesh.visible = !!p;
        if (!p) return;
        const ox = p.prev.x + (p.now.x - p.prev.x) * alpha;
        const oy = p.prev.y + (p.now.y - p.prev.y) * alpha;
        const oz = p.prev.z + (p.now.z - p.prev.z) * alpha;
        o.mesh.position.set(ox, oz + BALL_RADIUS, oy);
        if (i === rivalAt) seenRival = { x: ox, y: oy, z: oz };
      });
      // The camera glides after the marble (more gently with reduced motion). With two players it looks at the middle of them.
      const rival = seenRival as { x: number; y: number; z: number } | null;
      const target = rival
        ? new THREE.Vector3((x + rival.x) / 2, Math.max((z + rival.z) / 2, 0), (y + rival.y) / 2)
        : new THREE.Vector3(x, Math.max(z, 0), y);
      if (first) {
        follow.copy(target);
        first = false;
      } else {
        const k = 1 - Math.pow(reducedMotion ? 0.02 : 0.0008, Math.min(dt, 0.1));
        follow.lerp(target, k);
      }
      const clock = world.t;
      for (const g of gemObjects) {
        const taken = now.gemsTaken.includes(g.id);
        g.mesh.visible = !taken;
        g.label.visible = !taken;
        if (!reducedMotion) g.mesh.rotation.y = clock * 0.04;
      }
      for (const d of trapdoors) {
        const solidNow = trapdoorSolid(clock, d.tx);
        const warning = solidNow && !trapdoorSolid(clock + TIMED.trapdoor.warn, d.tx);
        d.mesh.visible = solidNow && !(warning && Math.floor(clock / 6) % 2 === 0);
      }
      for (const d of gates) d.mesh.visible = !gateOpen(clock, d.tx);
      for (const d of geysers) {
        const phase = geyserPhase(clock, d.tx, d.ty);
        d.plume.visible = phase > 0;
        const tall = phase === 2 ? 1.6 : 0.5;
        d.plume.scale.y = tall;
        d.plume.position.y = course.tiles[d.ty * W + d.tx].level * LEVEL + tall / 2;
      }
      if (wind) {
        const blowing = windBlowing(world, clock, true);
        streaks.forEach((m, i) => {
          m.visible = blowing;
          if (!blowing) return;
          const along = ((clock * 0.12 + i * 1.37) % 9) - 4.5;
          const across = ((i * 2.31) % 7) - 3.5;
          m.position.set(follow.x + wind.dx * along - wind.dy * across, follow.y + 0.5 + (i % 3) * 0.4, follow.z + wind.dy * along + wind.dx * across);
        });
      }
      if (dio) {
        // The sun's shadow window moves with the camera, in whole shadow-map pixels so the edges don't shimmer.
        const texel = (SHADOW_REACH * 2) / Math.max(1, sun.shadow.mapSize.x);
        const toSun = SUN_OFFSET.clone().normalize();
        const right = new THREE.Vector3(0, 1, 0).cross(toSun).normalize();
        const upL = toSun.clone().cross(right);
        const a = follow.dot(right);
        const b = follow.dot(upL);
        const snapped = follow.clone().addScaledVector(right, Math.round(a / texel) * texel - a).addScaledVector(upL, Math.round(b / texel) * texel - b);
        sun.target.position.copy(snapped);
        sun.position.copy(snapped).add(SUN_OFFSET);
      }
      if (backdrop) {
        // Slide the picture the other way, a touch, as the camera moves (not with reduced motion).
        const span = Math.max(1, W + H);
        fitBackdrop(reducedMotion ? 0 : (-(follow.x - follow.z) / span) * 2, reducedMotion ? 0 : (-(follow.x + follow.z) / span) * 1);
      }
      camera.position.set(follow.x + D, follow.y + D, follow.z + D);
      camera.lookAt(follow);
      renderer.render(scene, camera);
    },
    dispose() {
      gemGeometry.dispose();
      gemMaterial.dispose();
      for (const g of gemObjects) {
        g.label.material.map?.dispose();
        g.label.material.dispose();
      }
      for (const sprite of [...signSprites, ...stopSprites]) {
        sprite.material.map?.dispose();
        sprite.material.dispose();
      }
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material as THREE.Material | THREE.Material[];
          (Array.isArray(m) ? m : [m]).forEach((mm) => {
            (mm as THREE.MeshBasicMaterial).map?.dispose();
            mm.dispose();
          });
        }
      });
      fx?.dispose();
      trail?.dispose();
      marbleObj?.dispose();
      for (const o of others) o.made?.dispose();
      if (scene.background instanceof THREE.Texture) scene.background.dispose();
      sun.shadow.map?.dispose();
      renderer.dispose();
    },
  };
}
