/**
 * Draws a Circuit Racer road with three.js and bloom (docs/CIRCUIT-PLAN.md, sections 3 and 6): glowing circuit-board tiles
 * from the road grid, chips for blocks, half-pipe data cables for tunnels, a giant port at the finish, a dark computer
 * cosmos behind, and the glowing 3D racer with a spark trail. Loaded only when a race opens (RaceScreen imports it lazily).
 * It never changes the race: it reads two physics states and draws `alpha` of the way between them.
 *
 * The physics' x is across (lanes 0 to 7), y up and z along the road. The picture uses x − 3.5 across, y up and −z
 * forward, so the road runs away from the camera.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BLOCK_HEIGHTS, FLOOR_THICKNESS, LANES, TOP_SPEED, TUNNEL_ROOF } from '../../../shared/circuit/config';
import type { RaceEvent, RaceState } from '../../../shared/circuit/physics';
import { cellAt, type Road } from '../../../shared/circuit/road';
import { chipTexture, tileTextures, type TileKind } from './textures';

export interface RaceView {
  /** Draws the race `alpha` of the way from `prev` to `cur`; `seconds` since the last draw. */
  draw(prev: RaceState, cur: RaceState, alpha: number, seconds: number): void;
  /** Sparks and flashes for what just happened, where it happened. */
  events(events: readonly RaceEvent[], at: RaceState): void;
  /** A fresh go: the trail and sparks are cleared and the camera jumps back. */
  restart(): void;
  resize(width: number, height: number): void;
  /** Drop to the lighter look (no bloom, fewer pixels) on a slow device. False if already there. */
  lower(): boolean;
  dispose(): void;
}

const HALF = LANES / 2;
const X = (x: number) => x - HALF;
const CELL_KIND: Record<string, TileKind> = { '-': 'trace', '>': 'overclock', r: 'resistor', x: 'short', g: 'gel', '+': 'recharge', t: 'tunnel', '?': 'trace' };
const CHIP_COLOURS = { '1': '#22d3ee', '2': '#e879f9', '3': '#facc15' } as const;

export function createView(canvas: HTMLCanvasElement, road: Road, opts: { reduced: boolean; low?: boolean }): RaceView {
  const disposables: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(thing: T): T => (disposables.push(thing), thing);
  let low = opts.low ?? false;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const fogColour = new THREE.Color('#050616');
  scene.fog = new THREE.Fog(fogColour, 18, 60);
  scene.background = own(skyTexture());
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 200);

  scene.add(new THREE.AmbientLight('#8aa0ff', 0.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.4);
  sun.position.set(-3, 8, 4);
  scene.add(sun);

  // ——— The road: one instanced box per cell kind, top textured, sides dark ———
  const textures = tileTextures();
  Object.values(textures).forEach((t) => own(t));
  textures.overclock.wrapS = textures.overclock.wrapT = THREE.RepeatWrapping;
  const sideMat = own(new THREE.MeshLambertMaterial({ color: '#0a1020', emissive: '#0b2a3a', emissiveIntensity: 0.6 }));
  const tileMats = {} as Record<TileKind, THREE.MeshLambertMaterial>;
  for (const kind of Object.keys(textures) as TileKind[]) {
    const glow = kind === 'short' ? 1.2 : kind === 'recharge' || kind === 'overclock' ? 0.9 : kind === 'gel' ? 0.35 : 0.55;
    tileMats[kind] = own(new THREE.MeshLambertMaterial({ map: textures[kind], emissive: '#ffffff', emissiveMap: textures[kind], emissiveIntensity: glow }));
  }
  const slab = own(new THREE.BoxGeometry(1, FLOOR_THICKNESS, 1));
  const cells: Record<TileKind, [number, number][]> = { trace: [], overclock: [], resistor: [], short: [], gel: [], recharge: [], tunnel: [] };
  const blocks: Record<'1' | '2' | '3', [number, number][]> = { '1': [], '2': [], '3': [] };
  const edges: [number, number][] = [];
  const rings: [number, number][] = [];
  const cables: [number, number][] = [];
  for (let row = 0; row < road.length; row++) {
    for (let lane = 0; lane < LANES; lane++) {
      const c = cellAt(road, lane, row);
      if (c === '.') continue;
      if (c === '1' || c === '2' || c === '3') blocks[c].push([lane, row]);
      else cells[CELL_KIND[c]].push([lane, row]);
      if (c === 't') cables.push([lane, row]);
      if (c === '+' && cellAt(road, lane, row - 1) !== '+') rings.push([lane, row]);
      if (cellAt(road, lane - 1, row) === '.') edges.push([lane, row]);
      if (cellAt(road, lane + 1, row) === '.') edges.push([lane + 1, row]);
    }
  }
  const m = new THREE.Matrix4();
  const instanced = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], at: [number, number][], place: (lane: number, row: number) => THREE.Matrix4) => {
    if (!at.length) return null;
    const mesh = new THREE.InstancedMesh(geo, mat, at.length);
    at.forEach(([lane, row], i) => mesh.setMatrixAt(i, place(lane, row)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  };
  for (const kind of Object.keys(cells) as TileKind[]) {
    // Box faces: +x, −x, top, bottom, +z, −z.
    const mats = [sideMat, sideMat, tileMats[kind], sideMat, sideMat, sideMat];
    instanced(slab, mats, cells[kind], (lane, row) => m.makeTranslation(X(lane + 0.5), -FLOOR_THICKNESS / 2, -(row + 0.5)));
  }

  // Neon rims along the road's outside edges.
  const rimMat = own(new THREE.MeshBasicMaterial({ color: new THREE.Color('#22e3ff').multiplyScalar(1.6) }));
  instanced(own(new THREE.BoxGeometry(0.05, 0.07, 1)), rimMat, edges, (x, row) => m.makeTranslation(X(x), 0.01, -(row + 0.5)));

  // Chips, capacitors and heat-sinks: dark bodies with a glowing top.
  for (const h of ['1', '2', '3'] as const) {
    const height = BLOCK_HEIGHTS[h] + FLOOR_THICKNESS;
    const top = own(chipTexture(CHIP_COLOURS[h]));
    const topMat = own(new THREE.MeshLambertMaterial({ map: top, emissive: '#ffffff', emissiveMap: top, emissiveIntensity: 0.9 }));
    const bodyMat = own(new THREE.MeshLambertMaterial({ color: '#141827', emissive: CHIP_COLOURS[h], emissiveIntensity: 0.12 }));
    const geo = own(new THREE.BoxGeometry(0.96, height, 0.96));
    instanced(geo, [bodyMat, bodyMat, topMat, bodyMat, bodyMat, bodyMat], blocks[h], (lane, row) => m.makeTranslation(X(lane + 0.5), BLOCK_HEIGHTS[h] - height / 2, -(row + 0.5)));
  }

  // Data cables (tunnels): a see-through half-pipe arch over the lane, as high as the roof.
  const cableGeo = own(new THREE.CylinderGeometry(0.5, 0.5, 1, 14, 1, true, -Math.PI / 2, Math.PI));
  cableGeo.rotateX(Math.PI / 2);
  const cableMat = own(new THREE.MeshBasicMaterial({ color: '#5eead4', transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  const s = new THREE.Matrix4();
  instanced(cableGeo, cableMat, cables, (lane, row) => m.makeTranslation(X(lane + 0.5), 0, -(row + 0.5)).multiply(s.makeScale(1, TUNNEL_ROOF * 2 + 0.1, 1)));

  // Recharge rings: an upright blue ring at the start of each port.
  const ringMat = own(new THREE.MeshBasicMaterial({ color: new THREE.Color('#38bdf8').multiplyScalar(1.8) }));
  instanced(own(new THREE.TorusGeometry(0.42, 0.05, 8, 24)), ringMat, rings, (lane, row) => m.makeTranslation(X(lane + 0.5), 0.5, -(row + 0.1)));

  // The finish: a giant glowing port to dive into.
  const port = new THREE.Group();
  const portGlow = own(new THREE.MeshBasicMaterial({ color: new THREE.Color('#4ade80').multiplyScalar(2) }));
  const portBody = own(new THREE.MeshLambertMaterial({ color: '#0c1324', emissive: '#103a2a', emissiveIntensity: 0.6 }));
  const frame = own(new THREE.BoxGeometry(1, 1, 1));
  for (const [w, h, x, y] of [[LANES + 1.4, 0.3, 0, 3.4], [0.3, 3.6, -(LANES / 2 + 0.55), 1.6], [0.3, 3.6, LANES / 2 + 0.55, 1.6]] as const) {
    const bar = new THREE.Mesh(frame, portGlow);
    bar.scale.set(w, h, 0.3);
    bar.position.set(x, y, 0);
    port.add(bar);
  }
  const socket = new THREE.Mesh(frame, portBody);
  socket.scale.set(LANES + 1, 3.3, 0.2);
  socket.position.set(0, 1.6, -2.5);
  port.add(socket);
  for (let i = 0; i < 6; i++) {
    const pin = new THREE.Mesh(frame, portGlow);
    pin.scale.set(0.35, 1.4, 0.1);
    pin.position.set(-2.6 + i * 1.04, 1.6, -2.35);
    port.add(pin);
  }
  port.position.set(0, 0, -road.length);
  scene.add(port);

  // ——— The computer cosmos: stars and a glowing grid far below ———
  const starGeo = own(new THREE.BufferGeometry());
  const starPos = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 60 + Math.random() * 40;
    starPos.set([Math.cos(a) * r, -10 + Math.random() * 60, Math.sin(a) * r], i * 3);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, own(new THREE.PointsMaterial({ color: '#a5b4fc', size: 0.35, fog: false })));
  scene.add(stars);
  const grid = new THREE.GridHelper(160, 64, '#7c3aed', '#312e81');
  own(grid.geometry);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.55;
  grid.position.y = -7;
  scene.add(grid);

  // ——— The racer: a low-poly glowing dart ———
  const racer = new THREE.Group();
  const hullMat = own(new THREE.MeshLambertMaterial({ color: '#1e293b', emissive: '#0ea5e9', emissiveIntensity: 0.35, flatShading: true }));
  const glowMat = own(new THREE.MeshBasicMaterial({ color: new THREE.Color('#67e8f9').multiplyScalar(2.2) }));
  const canopyMat = own(new THREE.MeshBasicMaterial({ color: new THREE.Color('#f0abfc').multiplyScalar(1.1) }));
  const hull = new THREE.Mesh(own(new THREE.ConeGeometry(0.3, 0.95, 4)), hullMat);
  hull.rotation.set(-Math.PI / 2, Math.PI / 4, 0, 'YXZ');
  hull.scale.set(1, 1, 0.42);
  racer.add(hull);
  const canopy = new THREE.Mesh(own(new THREE.SphereGeometry(0.11, 10, 6)), canopyMat);
  canopy.scale.set(1, 0.7, 1.8);
  canopy.position.set(0, 0.1, 0.02);
  racer.add(canopy);
  const finGeo = own(new THREE.BoxGeometry(0.34, 0.03, 0.22));
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(finGeo, glowMat);
    fin.position.set(side * 0.3, -0.02, 0.24);
    fin.rotation.z = side * -0.25;
    racer.add(fin);
  }
  const engine = new THREE.Mesh(own(new THREE.SphereGeometry(0.1, 10, 8)), glowMat);
  engine.position.set(0, 0, 0.47);
  racer.add(engine);
  scene.add(racer);
  const RIDE = 0.12;

  // The spark trail: a ribbon through the last positions, fading out.
  const TRAIL = opts.reduced ? 8 : 26;
  const trailPos = new Float32Array(TRAIL * 2 * 3);
  const trailCol = new Float32Array(TRAIL * 2 * 3);
  const trailGeo = own(new THREE.BufferGeometry());
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
  const idx: number[] = [];
  for (let i = 0; i < TRAIL - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  trailGeo.setIndex(idx);
  const trail = new THREE.Mesh(trailGeo, own(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  trail.frustumCulled = false;
  scene.add(trail);
  const history: THREE.Vector3[] = [];

  // Sparks: one pool of glowing points.
  const SPARKS = opts.reduced ? 60 : 260;
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkCol = new Float32Array(SPARKS * 3);
  const sparkVel = new Float32Array(SPARKS * 3);
  const sparkLife = new Float32Array(SPARKS);
  const sparkGeo = own(new THREE.BufferGeometry());
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
  const sparks = new THREE.Points(sparkGeo, own(new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  sparks.frustumCulled = false;
  scene.add(sparks);
  let nextSpark = 0;
  const burst = (at: THREE.Vector3, n: number, colour: string, speed: number, up = 1) => {
    const c = new THREE.Color(colour);
    for (let k = 0; k < n; k++) {
      const i = nextSpark;
      nextSpark = (nextSpark + 1) % SPARKS;
      sparkPos.set([at.x, at.y, at.z], i * 3);
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      sparkVel.set([Math.cos(a) * v, (0.3 + Math.random()) * v * up, Math.sin(a) * v], i * 3);
      sparkCol.set([c.r * 2, c.g * 2, c.b * 2], i * 3);
      sparkLife[i] = 0.5 + Math.random() * 0.5;
    }
  };

  // ——— Bloom: everything bright glows. Dropped on a slow device ———
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.5, 0.6);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  bloom.enabled = !low;

  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  let cameraSet = false;
  let time = 0;
  let shake = 0;
  let width = 1;
  let height = 1;
  let lastAt = new THREE.Vector3();
  let gone = false;

  return {
    draw(prev, cur, alpha, seconds) {
      time += seconds;
      const x = prev.x + (cur.x - prev.x) * alpha;
      const y = prev.y + (cur.y - prev.y) * alpha;
      const z = prev.z + (cur.z - prev.z) * alpha;
      const at = new THREE.Vector3(X(x), y + RIDE, -z);
      lastAt = at;
      const dead = cur.outcome !== 'racing' && cur.outcome !== 'finished';
      gone = dead && cur.outcome !== 'outOfBattery' && cur.outcome !== 'outOfSignal';
      racer.visible = !gone;
      racer.position.copy(at);
      const sideways = cur.x - prev.x;
      racer.rotation.z += ((-sideways * 9) - racer.rotation.z) * 0.25;
      racer.rotation.x += ((cur.vy * 0.05) - racer.rotation.x) * 0.25;
      glowMat.color.setScalar(1).set('#67e8f9').multiplyScalar(1.1 + (cur.vz / TOP_SPEED) * 0.9);

      // Trail: newest first, thinning and fading.
      if (!gone) {
        history.unshift(at.clone().add(new THREE.Vector3(0, 0, 0.5)));
        if (history.length > TRAIL) history.length = TRAIL;
      }
      const speedShare = cur.vz / TOP_SPEED;
      for (let i = 0; i < TRAIL; i++) {
        const p = history[Math.min(i, history.length - 1)] ?? at;
        const w = 0.13 * (1 - i / TRAIL);
        trailPos.set([p.x - w, p.y, p.z, p.x + w, p.y, p.z], i * 6);
        const f = (1 - i / TRAIL) * (0.3 + speedShare) * (gone ? 0 : 1);
        trailCol.set([0.2 * f, 0.9 * f, 1.2 * f, 0.2 * f, 0.9 * f, 1.2 * f], i * 6);
      }
      trailGeo.attributes.position.needsUpdate = true;
      trailGeo.attributes.color.needsUpdate = true;

      // Sparks fly and fade.
      for (let i = 0; i < SPARKS; i++) {
        if (sparkLife[i] <= 0) continue;
        sparkLife[i] -= seconds;
        sparkVel[i * 3 + 1] -= 9 * seconds;
        sparkPos[i * 3] += sparkVel[i * 3] * seconds;
        sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * seconds;
        sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * seconds;
        if (sparkLife[i] <= 0) sparkCol.fill(0, i * 3, i * 3 + 3);
        else sparkCol.set([sparkCol[i * 3] * 0.97, sparkCol[i * 3 + 1] * 0.97, sparkCol[i * 3 + 2] * 0.97], i * 3);
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sparkGeo.attributes.color.needsUpdate = true;

      // The road moves: overclock arrows run forward, shorts crackle, rings and the port pulse.
      if (!opts.reduced) {
        textures.overclock.offset.y = (time * 1.6) % 1;
        tileMats.short.emissiveIntensity = 0.8 + Math.random() * 0.9;
      }
      const pulse = opts.reduced ? 1 : 1.4 + Math.sin(time * 5) * 0.5;
      ringMat.color.set('#38bdf8').multiplyScalar(pulse);
      portGlow.color.set('#4ade80').multiplyScalar(1.4 + (opts.reduced ? 0.5 : Math.sin(time * 3) * 0.5 + 0.5));

      // Chase camera: behind and above, looking down the road; wider on a tall screen so all 7 lanes show.
      const tall = width / height < 1;
      const back = tall ? 6.2 : 4.4;
      const lift = tall ? 3.0 : 2.1;
      const wantPos = new THREE.Vector3(at.x * 0.65, Math.max(0, y) * 0.6 + lift, at.z + back);
      const wantLook = new THREE.Vector3(at.x * 0.8, Math.max(-1, y) * 0.5 + 0.3, at.z - 6);
      if (!cameraSet) {
        camPos.copy(wantPos);
        camLook.copy(wantLook);
        cameraSet = true;
      }
      const follow = dead ? 0.02 : 0.18;
      camPos.lerp(wantPos, follow);
      camLook.lerp(wantLook, follow + 0.05);
      camera.position.copy(camPos);
      if (shake > 0 && !opts.reduced) {
        camera.position.x += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake;
        shake = Math.max(0, shake - seconds * 1.5);
      }
      camera.lookAt(camLook);
      stars.position.set(camPos.x, 0, camPos.z);
      grid.position.z = Math.round(camPos.z / 2.5) * 2.5;
      composer.render(seconds);
    },
    events(list, state) {
      const at = new THREE.Vector3(X(state.x), state.y + RIDE, -state.z);
      for (const e of list) {
        if (e === 'crash') { burst(at, 120, '#ffb347', 7); burst(at, 60, '#ffffff', 5); shake = 0.6; }
        else if (e === 'fall') burst(lastAt, 30, '#a78bfa', 2);
        else if (e === 'bonk') { burst(at.clone().add(new THREE.Vector3(0, 0, -0.3)), 18, '#fde047', 3); shake = Math.max(shake, 0.15); }
        else if (e === 'nudge' || e === 'scrape') burst(at, 6, '#67e8f9', 2.5);
        else if (e === 'bounce') burst(at, 10, '#ffffff', 2, 0.5);
        else if (e === 'recharge') burst(at, 50, '#38bdf8', 4);
        else if (e === 'finish') burst(at, 90, '#4ade80', 6);
        else if (e === 'land') burst(at, 4, '#67e8f9', 1.5, 0.4);
        else if (e === 'autopilot') burst(at, 14, '#f0abfc', 2);
      }
    },
    restart() {
      history.length = 0;
      sparkLife.fill(0);
      sparkCol.fill(0);
      cameraSet = false;
      shake = 0;
    },
    resize(w, h) {
      width = Math.max(1, w);
      height = Math.max(1, h);
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      bloom.resolution.set(width / 2, height / 2);
      camera.aspect = width / height;
      camera.fov = width / height < 1 ? 78 : 62;
      camera.updateProjectionMatrix();
    },
    lower() {
      if (low) return false;
      low = true;
      bloom.enabled = false;
      renderer.setPixelRatio(1);
      this.resize(width, height);
      return true;
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      composer.dispose();
      renderer.dispose();
    },
  };
}

/** A dark navy sky fading to violet at the horizon. */
function skyTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 256;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#02030a');
    grad.addColorStop(0.55, '#0a0b2a');
    grad.addColorStop(0.78, '#2a1150');
    grad.addColorStop(1, '#050616');
    g.fillStyle = grad;
    g.fillRect(0, 0, 8, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
