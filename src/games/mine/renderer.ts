/**
 * Draws a Mine Runner run with three.js: flat-coloured low-poly walls, doors, keys, robots, pickups, pads, the reactor,
 * the exit, shots and sparks. Loaded only when someone starts a level (the run screen imports this file lazily), so the rest
 * of the site stays quick. Nothing here changes the rules: it only reads the run's state, and draws smoothly between steps.
 *
 * The rules' x is across, y is forward and z is up. The picture uses x across, y up and z towards the viewer, so a spot
 * (x, y, z) in the mine is drawn at (x, z, −y).
 */
import * as THREE from 'three';
import { REACTOR_RADIUS, ROBOTS, type RobotType } from '../../../shared/mine/config';
import { KEY_COLOURS } from '../../../shared/mine/level';
import { DOOR_COLOURS, PICKUP_COLOURS, paletteFor } from './palette';
import type { MineEvent, MineSession } from './session';
import { buildWalls } from './walls';

export interface ViewStats {
  calls: number;
  triangles: number;
  pixelRatio: number;
}

export interface MineView {
  /** Draws the run, `alpha` of the way from the step before to the latest step (0 to 1). `seconds` is the time since the last draw. */
  draw(alpha: number, seconds: number): void;
  resize(width: number, height: number): void;
  /** What the pupil just did or hit, to turn into sparks and flashes. */
  react(events: readonly MineEvent[]): void;
  /** The target the pupil could use right now (a door or pad), to make it glow. */
  highlight(kind: 'door' | 'pad' | null, id: number): void;
  stats(): ViewStats;
  /** Lowers or raises the picture's sharpness to keep the speed up on a slow device. Returns the pixel ratio now used. */
  setQuality(pixelRatio: number): number;
  dispose(): void;
}

export interface ViewOptions {
  lessMotion: boolean;
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function basic(colour: number, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: colour, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
}
function lit(colour: number, emissive = 0x000000, intensity = 0.4): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color: colour, emissive, emissiveIntensity: intensity, flatShading: true });
}

interface Spark {
  mesh: THREE.Mesh;
  vx: number; vy: number; vz: number;
  life: number;
  max: number;
}
interface Flash {
  mesh: THREE.Mesh;
  age: number;
  size: number;
}

export function createView(canvas: HTMLCanvasElement, session: MineSession, options: ViewOptions): MineView {
  const level = session.world.level;
  const palette = paletteFor(level.recipe.id);
  const less = options.lessMotion;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(palette.fog, 1);

  const scene = new THREE.Scene();
  // Distance does the lighting: near rock is bright and far rock fades into the dark, like a miner's lamp.
  scene.fog = new THREE.Fog(palette.fog, 2.5, 34);
  const camera = new THREE.PerspectiveCamera(78, 1, 0.08, 70);
  scene.add(camera);
  // Robots, keys and the like are lit from the ship's side so their shapes read.
  scene.add(new THREE.AmbientLight(0xb4bcd6, 1.4));
  const lamp = new THREE.DirectionalLight(0xfff4e0, 2.4);
  lamp.position.set(0.4, 0.8, 0.6);
  camera.add(lamp);
  camera.add(lamp.target);
  lamp.target.position.set(0, 0, -3);

  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(thing: T): T => {
    owned.push(thing);
    return thing;
  };

  // ——— Walls: one mesh per chunk, so out-of-view chunks are skipped ———
  const wallMaterial = own(new THREE.MeshBasicMaterial({ vertexColors: true }));
  for (const chunk of buildWalls(level, palette)) {
    const g = own(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(chunk.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(chunk.normals, 3));
    g.setAttribute('color', new THREE.BufferAttribute(chunk.colors, 3));
    g.computeBoundingSphere();
    scene.add(new THREE.Mesh(g, wallMaterial));
  }

  // ——— Doors ———
  const doorMeshes: THREE.Group[] = [];
  const doorGlow: THREE.MeshLambertMaterial[] = [];
  for (const door of level.doors) {
    const group = new THREE.Group();
    // Work out which way the slab lies from the blocks that fill the tunnel.
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const idx of door.blocks) {
      const x = idx % level.nx;
      const y = Math.floor(idx / level.nx) % level.ny;
      const z = Math.floor(idx / (level.nx * level.ny));
      x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1);
      z0 = Math.min(z0, z); z1 = Math.max(z1, z + 1);
    }
    const colour = DOOR_COLOURS[door.kind];
    const mat = own(lit(colour, colour, 0.5));
    doorGlow.push(mat);
    const slab = new THREE.Mesh(own(new THREE.BoxGeometry(x1 - x0 - 0.04, z1 - z0 - 0.04, y1 - y0 - 0.04)), mat);
    group.add(slab);
    // A frame and a lock in the middle, so it reads as a door from either side.
    const trim = own(lit(0x1f2937));
    const dx = x1 - x0, dy = z1 - z0, dz = y1 - y0;
    const lock = new THREE.Mesh(own(new THREE.BoxGeometry(dx > 1 ? 0.7 : 0.18, dy > 1 ? 0.7 : 0.18, dz > 1 ? 0.7 : 0.18)), trim);
    group.add(lock);
    group.position.set((x0 + x1) / 2, (z0 + z1) / 2, -(y0 + y1) / 2);
    scene.add(group);
    doorMeshes.push(group);
  }

  // ——— Keys, pickups, pads ———
  const keyGroups = level.keys.map((key) => {
    const g = new THREE.Group();
    const m = own(basic(DOOR_COLOURS[key.colour]));
    const ring = new THREE.Mesh(own(new THREE.TorusGeometry(0.28, 0.09, 6, 12)), m);
    ring.position.y = 0.4;
    const shaft = new THREE.Mesh(own(new THREE.BoxGeometry(0.12, 0.7, 0.12)), m);
    const tooth = new THREE.Mesh(own(new THREE.BoxGeometry(0.3, 0.12, 0.12)), m);
    tooth.position.set(0.15, -0.25, 0);
    const tooth2 = tooth.clone();
    tooth2.position.set(0.12, -0.05, 0);
    g.add(ring, shaft, tooth, tooth2);
    g.scale.setScalar(1.15);
    const p = v3(key.x, key.y, key.z);
    g.position.copy(p);
    scene.add(g);
    return g;
  });
  const pickupGeos = {
    shield: own(new THREE.IcosahedronGeometry(0.34, 0)),
    energy: own(new THREE.OctahedronGeometry(0.4, 0)),
    missiles: own(new THREE.ConeGeometry(0.28, 0.75, 5)),
  };
  const pickupMeshes = level.pickups.map((p) => {
    const m = new THREE.Mesh(pickupGeos[p.kind], own(basic(PICKUP_COLOURS[p.kind])));
    m.position.copy(v3(p.x, p.y, p.z));
    scene.add(m);
    return m;
  });
  const padGlow = own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false }));
  const padMeshes = level.pads.map((p) => {
    const g = new THREE.Group();
    const colour = PICKUP_COLOURS[p.kind];
    const ring = new THREE.Mesh(own(new THREE.TorusGeometry(1.1, 0.12, 6, 20)), own(basic(colour)));
    ring.rotation.x = Math.PI / 2;
    const disc = new THREE.Mesh(own(new THREE.CylinderGeometry(1, 1, 0.06, 20)), own(basic(colour, 0.35)));
    const beam = new THREE.Mesh(own(new THREE.CylinderGeometry(0.1, 0.1, 2.2, 6)), padGlow);
    beam.position.y = 1.1;
    g.add(ring, disc, beam);
    g.position.copy(v3(p.x, p.y, p.z));
    scene.add(g);
    return { g, ring, disc };
  });

  // ——— Reactor and exit ———
  const reactor = new THREE.Group();
  const coreMat = own(lit(0xff7a2b, 0xff5a1a, 1));
  const core = new THREE.Mesh(own(new THREE.IcosahedronGeometry(REACTOR_RADIUS, 1)), coreMat);
  const cageMat = own(new THREE.MeshBasicMaterial({ color: 0xffd9a0, wireframe: true }));
  const cage = new THREE.Mesh(own(new THREE.IcosahedronGeometry(REACTOR_RADIUS * 1.35, 0)), cageMat);
  reactor.add(core, cage);
  reactor.position.copy(v3(level.reactor.x, level.reactor.y, level.reactor.z));
  scene.add(reactor);

  const exit = new THREE.Group();
  const exitMat = own(new THREE.MeshBasicMaterial({ color: 0x35d07f, transparent: true, opacity: 0.25, depthWrite: false }));
  const exitRing = new THREE.Mesh(own(new THREE.TorusGeometry(2, 0.14, 6, 28)), exitMat);
  exitRing.rotation.x = Math.PI / 2;
  const exitBeam = new THREE.Mesh(own(new THREE.CylinderGeometry(0.35, 0.35, 5, 8)), exitMat);
  exit.add(exitRing, exitBeam);
  exit.position.copy(v3(level.exit.x, level.exit.y, level.exit.z));
  scene.add(exit);

  // ——— Robots: three simple shapes ———
  const robotColour: Record<RobotType, number> = { drone: 0x7f8fb0, hunter: 0xb8763c, turret: 0x77649a };
  const eyeOff = own(basic(0x7a5a2a));
  const eyeOn = own(basic(0xff3b30));
  const robots = session.state.robots.map((r) => {
    const g = new THREE.Group();
    const body = own(lit(robotColour[r.type]));
    const radius = ROBOTS[r.type].radius;
    if (r.type === 'drone') {
      g.add(new THREE.Mesh(own(new THREE.OctahedronGeometry(radius, 0)), body));
      const fin = new THREE.Mesh(own(new THREE.BoxGeometry(radius * 2.4, 0.06, radius * 0.5)), body);
      g.add(fin);
    } else if (r.type === 'hunter') {
      const cone = new THREE.Mesh(own(new THREE.ConeGeometry(radius, radius * 2.1, 6)), body);
      cone.rotation.x = Math.PI / 2;
      g.add(cone);
      const wing = new THREE.Mesh(own(new THREE.BoxGeometry(radius * 2.5, 0.07, radius * 0.7)), body);
      wing.position.z = -radius * 0.5;
      g.add(wing);
    } else {
      g.add(new THREE.Mesh(own(new THREE.BoxGeometry(radius * 1.6, radius * 0.9, radius * 1.6)), body));
      g.add(new THREE.Mesh(own(new THREE.SphereGeometry(radius * 0.7, 8, 6)), body));
      const barrel = new THREE.Mesh(own(new THREE.CylinderGeometry(0.1, 0.12, radius * 1.4, 6)), own(lit(0x3b3552)));
      barrel.rotation.x = Math.PI / 2;
      barrel.position.z = radius * 0.8;
      g.add(barrel);
    }
    const eye = new THREE.Mesh(own(new THREE.SphereGeometry(Math.max(0.14, radius * 0.25), 8, 6)), eyeOff);
    eye.position.z = radius * (r.type === 'hunter' ? 1.05 : 0.8);
    g.add(eye);
    g.position.copy(v3(r.x, r.y, r.z));
    scene.add(g);
    return { g, eye };
  });

  // ——— Shots ———
  const laserGeo = own(new THREE.BoxGeometry(0.07, 0.07, 1));
  const laserMat = own(basic(0x6ff3ff));
  const missileGeo = own(new THREE.ConeGeometry(0.16, 0.7, 6));
  const missileMat = own(basic(0xffa63d));
  const boltGeo = own(new THREE.SphereGeometry(0.2, 6, 5));
  const boltMat = own(basic(0xff5a4a));
  const pools: { lasers: THREE.Mesh[]; missiles: THREE.Mesh[]; bolts: THREE.Mesh[] } = { lasers: [], missiles: [], bolts: [] };
  function take(list: THREE.Mesh[], used: number, make: () => THREE.Mesh): THREE.Mesh {
    if (!list[used]) {
      const m = make();
      scene.add(m);
      list.push(m);
    }
    list[used].visible = true;
    return list[used];
  }

  // ——— Sparks and flashes (picture only: free to use anything) ———
  const sparkGeo = own(new THREE.BoxGeometry(0.1, 0.1, 0.1));
  const sparkMats = [own(basic(0xffd36b)), own(basic(0xff7a3b)), own(basic(0xffffff))];
  const sparks: Spark[] = [];
  const flashGeo = own(new THREE.SphereGeometry(1, 10, 8));
  const flashMat = own(new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, opacity: 0.8, depthWrite: false }));
  const flashes: Flash[] = [];

  function burst(x: number, y: number, z: number, count: number, speed: number, size: number): void {
    const p = v3(x, y, z);
    const n = less ? Math.ceil(count / 3) : count;
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(sparkGeo, sparkMats[i % 3]);
      mesh.position.copy(p);
      scene.add(mesh);
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * 2 - 1;
      const c = Math.sqrt(1 - b * b);
      const s = speed * (0.4 + Math.random() * 0.8);
      sparks.push({ mesh, vx: Math.cos(a) * c * s, vy: b * s, vz: Math.sin(a) * c * s, life: 0.55 + Math.random() * 0.3, max: 0.85 });
    }
    const f = new THREE.Mesh(flashGeo, flashMat);
    f.position.copy(p);
    scene.add(f);
    flashes.push({ mesh: f, age: 0, size });
  }

  const tmp = new THREE.Vector3();
  const lookAtPoint = new THREE.Vector3();
  let clock = 0;
  let highlighted: { kind: 'door' | 'pad'; id: number } | null = null;
  let lastWidth = 1;
  let lastHeight = 1;

  function dropSpark(i: number): void {
    scene.remove(sparks[i].mesh);
    sparks.splice(i, 1);
  }

  return {
    draw(alpha, seconds) {
      const s = session.state;
      const p = session.prev;
      clock += seconds;
      const t = clock;
      // The ship's eye, smoothed between the two latest steps.
      camera.position.copy(v3(lerp(p.px, s.px, alpha), lerp(p.py, s.py, alpha), lerp(p.pz, s.pz, alpha)));
      const f = v3(lerp(p.fx, s.fx, alpha), lerp(p.fy, s.fy, alpha), lerp(p.fz, s.fz, alpha)).normalize();
      const u = v3(lerp(p.ux, s.ux, alpha), lerp(p.uy, s.uy, alpha), lerp(p.uz, s.uz, alpha)).normalize();
      camera.up.copy(u);
      lookAtPoint.copy(camera.position).add(f);
      camera.lookAt(lookAtPoint);

      // Doors: gone when open; the one you can use glows.
      session.world.level.doors.forEach((d, i) => {
        doorMeshes[i].visible = s.doorsOpen[i] === 0;
        const near = highlighted && highlighted.kind === 'door' && highlighted.id === d.id;
        doorGlow[i].emissiveIntensity = near ? 0.9 + (less ? 0 : 0.4 * Math.sin(t * 6)) : 0.5;
      });
      // Keys and pickups.
      level.keys.forEach((k, i) => {
        const c = KEY_COLOURS.indexOf(k.colour);
        keyGroups[i].visible = s.keys[c] === 0;
        if (!less) keyGroups[i].rotation.y = t * 1.6;
        keyGroups[i].position.y = k.z + (less ? 0 : 0.12 * Math.sin(t * 2 + i));
      });
      level.pickups.forEach((pk, i) => {
        pickupMeshes[i].visible = s.pickupsTaken[i] === 0;
        if (!less) {
          pickupMeshes[i].rotation.y = t * 1.8 + i;
          pickupMeshes[i].position.y = pk.z + 0.1 * Math.sin(t * 2.4 + i);
        }
      });
      level.pads.forEach((pad, n) => {
        const used = s.padsUsed[n] === 1;
        const near = highlighted && highlighted.kind === 'pad' && highlighted.id === pad.id;
        padMeshes[n].ring.visible = !used;
        padMeshes[n].disc.visible = !used;
        padMeshes[n].g.children[2].visible = !used;
        padMeshes[n].g.scale.setScalar(near && !less ? 1 + 0.06 * Math.sin(t * 7) : 1);
      });

      // Reactor and exit (the exit only shows once the reactor is down).
      exit.visible = s.reactorDown === 1;
      if (s.reactorDown) {
        coreMat.color.setHex(0x3a3a3a);
        coreMat.emissive.setHex(0x000000);
        cageMat.color.setHex(0x555555);
        exitMat.opacity = 0.55 + (less ? 0 : 0.2 * Math.sin(t * 5));
      } else {
        const hurt = 1 - s.reactorHp / 160;
        coreMat.emissiveIntensity = 0.8 + hurt * 0.8 + (less ? 0 : 0.25 * Math.sin(t * 3));
        exitMat.opacity = 0.18;
      }
      if (!less) {
        reactor.rotation.y = t * 0.5;
        core.rotation.x = t * 0.7;
        exit.rotation.y = t * 0.4;
      }

      // Robots: smooth between steps, face the ship once they have seen it.
      s.robots.forEach((r, i) => {
        const g = robots[i].g;
        g.visible = r.alive === 1;
        if (!r.alive) return;
        g.position.set(lerp(p.robots[i * 3], r.x, alpha), lerp(p.robots[i * 3 + 2], r.z, alpha), -lerp(p.robots[i * 3 + 1], r.y, alpha));
        if (r.alert) {
          tmp.copy(camera.position);
          g.lookAt(tmp);
        } else if (!less) {
          g.rotation.y += seconds * 0.6;
        }
        robots[i].eye.material = r.alert ? eyeOn : eyeOff;
      });

      // Shots are drawn where they were at this moment: a straight line back from the latest step.
      let lasers = 0, missiles = 0, bolts = 0;
      for (const shot of s.shots) {
        const back = 1 - alpha;
        const x = shot.x - shot.vx * back;
        const y = shot.y - shot.vy * back;
        const z = shot.z - shot.vz * back;
        let mesh: THREE.Mesh;
        if (shot.k === 0) mesh = take(pools.lasers, lasers++, () => new THREE.Mesh(laserGeo, laserMat));
        else if (shot.k === 1) mesh = take(pools.missiles, missiles++, () => new THREE.Mesh(missileGeo, missileMat));
        else mesh = take(pools.bolts, bolts++, () => new THREE.Mesh(boltGeo, boltMat));
        mesh.position.copy(v3(x, y, z));
        if (shot.k !== 2) {
          tmp.copy(v3(shot.vx, shot.vy, shot.vz)).add(mesh.position);
          mesh.lookAt(tmp);
          if (shot.k === 1) mesh.rotateX(Math.PI / 2);
        }
      }
      for (let i = lasers; i < pools.lasers.length; i++) pools.lasers[i].visible = false;
      for (let i = missiles; i < pools.missiles.length; i++) pools.missiles[i].visible = false;
      for (let i = bolts; i < pools.bolts.length; i++) pools.bolts[i].visible = false;

      // Sparks and flashes.
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.life -= seconds;
        if (sp.life <= 0) {
          dropSpark(i);
          continue;
        }
        sp.mesh.position.x += sp.vx * seconds;
        sp.mesh.position.y += sp.vy * seconds;
        sp.mesh.position.z += sp.vz * seconds;
        sp.mesh.scale.setScalar(Math.max(0.1, sp.life / sp.max));
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        const fl = flashes[i];
        fl.age += seconds;
        const k = fl.age / 0.28;
        if (k >= 1) {
          scene.remove(fl.mesh);
          flashes.splice(i, 1);
          continue;
        }
        fl.mesh.scale.setScalar(fl.size * (less ? 0.8 : 0.3 + k));
      }
      flashMat.opacity = 0.7;

      renderer.render(scene, camera);
    },

    resize(width, height) {
      lastWidth = Math.max(1, Math.floor(width));
      lastHeight = Math.max(1, Math.floor(height));
      renderer.setSize(lastWidth, lastHeight, false);
      camera.aspect = lastWidth / lastHeight;
      // A tall phone gets a wider angle so the view isn't a thin slice.
      camera.fov = camera.aspect < 1 ? 90 : 78;
      camera.updateProjectionMatrix();
    },

    react(events) {
      for (const e of events) {
        if (e.kind === 'robot-down') burst(e.x, e.y, e.z, 18, 4.5, 1.6);
        else if (e.kind === 'boom') burst(e.x, e.y, e.z, 22, 5.5, 2.6);
        else if (e.kind === 'reactor-hit') burst(level.reactor.x, level.reactor.y, level.reactor.z, 4, 3, 0.8);
        else if (e.kind === 'reactor-down') burst(level.reactor.x, level.reactor.y, level.reactor.z, 40, 8, 4);
      }
    },

    highlight(kind, id) {
      highlighted = kind ? { kind, id } : null;
    },

    stats() {
      return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio };
    },

    setQuality(ratio) {
      pixelRatio = Math.min(Math.max(ratio, 0.5), Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(lastWidth, lastHeight, false);
      return pixelRatio;
    },

    dispose() {
      for (const sp of sparks) scene.remove(sp.mesh);
      for (const thing of owned) thing.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
