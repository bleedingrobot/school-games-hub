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
import type { Palette } from './palette';

/** How thick a block looks where nothing is beside it, in tiles. */
const THICK = 1.2;
/** Walls stand this far above the floor beside them. */
const WALL_HEIGHT = 0.7;

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

/** Triangles with a colour each; flat shading comes from computing normals on unshared vertices. */
class Soup {
  positions: number[] = [];
  colors: number[] = [];
  private col = new THREE.Color();

  tri(a: number[], b: number[], c: number[], color: number) {
    this.col.setHex(color);
    for (const p of [a, b, c]) {
      this.positions.push(p[0], p[1], p[2]);
      this.colors.push(this.col.r, this.col.g, this.col.b);
    }
  }

  /** A quad a-b-c-d, counter-clockwise seen from the side it faces. */
  quad(a: number[], b: number[], c: number[], d: number[], color: number) {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  mesh(): THREE.Mesh {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.computeVertexNormals();
    return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  }
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
  dispose(): void;
}

export function createView(canvas: HTMLCanvasElement, course: Course, world: World, palette: Palette, reducedMotion: boolean, otherKinds: OtherKind[] = []): MarbleView {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setClearColor(palette.sky);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.55));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
  sun.position.set(-6, 10, 4);
  scene.add(sun);

  // ---- the blocks ----
  const soup = new Soup();
  const { width: W, height: H } = course;
  // The fixed layout. Timed things (trapdoors, gates, geysers) are drawn separately below and move with the clock.
  const WALL_TILE: Tile = { ch: '=', level: 0, surface: 'normal', slope: null, door: -1 };
  const VOID_TILE: Tile = { ch: '.', level: 0, surface: 'normal', slope: null, door: -1 };
  const tile = (x: number, y: number): Tile => {
    if (x < 0 || y < 0 || x >= W || y >= H) return VOID_TILE;
    const t = course.tiles[y * W + x];
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
      else if (t.ch === 'f') top = (x + y) % 2 === 0 ? palette.finishA : palette.finishB;
      else if (t.ch === 'j') top = palette.pad;
      else if (t.door >= 0) top = palette.door;
      else if (CONVEYOR_DIR[t.ch]) top = palette.belt;
      else if (t.ch === 'g') top = palette.geyser;
      const P = (cx: number, cy: number, h: number) => [x + cx, h, y + cy];
      soup.quad(P(0, 0, nw), P(0, 1, sw), P(1, 1, se), P(1, 0, ne), top);

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
        soup.quad(a, a2, b2, b, palette.side);
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
  scene.add(soup.mesh());

  // ---- things standing on the course ----
  const solid = (colour: number) => new THREE.MeshLambertMaterial({ color: colour });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = tile(x, y);
      const h = Math.max(...corners(t)) ;
      if (t.ch === 'b') {
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
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, WALL_HEIGHT + 0.1, 1), solid(palette.gate));
        mesh.position.set(x + 0.5, h + (WALL_HEIGHT + 0.1) / 2, y + 0.5);
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

  // ---- the marble and its shadow ----
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
  const marble = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 28, 18),
    new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(swirl), roughness: 0.18, metalness: 0.25 }),
  );
  scene.add(marble);
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
  const follow = new THREE.Vector3(course.start.x, 0, course.start.y);
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
  }

  let low = false;
  const setPixelRatio = () => renderer.setPixelRatio(low ? 1 : Math.min(1.5, window.devicePixelRatio || 1));
  setPixelRatio();

  const spin = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  // Other marbles: a ghost is pale and see-through; the second player's is orange.
  const others = otherKinds.map((kind) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 20, 14),
      kind === 'ghost'
        ? new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.45, depthWrite: false })
        : new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.2, metalness: 0.25 }),
    );
    mesh.visible = false;
    scene.add(mesh);
    return { kind, mesh };
  });
  const rivalAt = otherKinds.indexOf('rival');

  let first = true;

  return {
    resize,
    setLowQuality(l) {
      low = l;
      setPixelRatio();
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
        marble.quaternion.premultiply(spin);
      }
      const under = floorHeightAt(world, x, y);
      shadow.visible = under !== null && under <= z + 0.05;
      shadow.position.set(x, (under ?? z) + 0.02, y);
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
      camera.position.set(follow.x + D, follow.y + D, follow.z + D);
      camera.lookAt(follow);
      renderer.render(scene, camera);
    },
    dispose() {
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
      renderer.dispose();
    },
  };
}
