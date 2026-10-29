import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Course } from '../../../shared/marble/course';
import type { Look, TopPattern } from './look';
import { islandGeometry, propGeometry, PROP_ANIM } from './props';
import type { Prop, PropKind } from './scenery';
import { planScenery } from './scenery';
import type { Quality } from './quality';

/** Simple quality shows only the most important props. */
const SIMPLE_PRIORITY = 0.45;
/** Props are drawn a little bigger than their placement size, so they read at game zoom. */
const PROP_SIZE = 1.25;

/** The colour of the land on top of the islands, for each place's track pattern. */
const LAND: Record<TopPattern, number> = {
  sand: 0xead6a6,
  tarmac: 0xc8ae6c, // tussock gold
  sinter: 0xece1c6,
  snow: 0xf1f5fa,
  concrete: 0xc3c6c8,
  scoria: 0x9c5c45,
  grass: 0x8fbf5c,
  none: 0xd9c9a0,
};

/** Props that steam gently. */
const STEAMY: Partial<Record<PropKind, number>> = { 'hot-pool': 0.5, 'steam-vent': 1, 'mud-pot': 0.35 };

export interface SceneryView {
  setQuality(q: Quality): void;
  /** Moves the gulls, buoys, ferns and steam. `clock` is in seconds. */
  update(clock: number, dt: number): void;
  dispose(): void;
}

interface Group {
  mesh: THREE.InstancedMesh;
  props: Prop[];
  /** How many props (sorted most important first) Simple quality shows. */
  simpleCount: number;
  anim?: 'bob' | 'sway' | 'flap';
}

/** A soft round puff for the steam. */
function puffTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.4)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * The scenery around a course (diorama look only): little islands of land beside the track with props on them.
 * Every kind of prop is one instanced mesh, so the whole lot costs a couple of dozen draw calls.
 */
export function createScenery(scene: THREE.Scene, course: Course, look: Look, sideColour: number, quality: Quality, reducedMotion: boolean): SceneryView {
  const plan = planScenery(course);
  const root = new THREE.Group();
  root.name = 'scenery';
  scene.add(root);
  const disposables: { dispose(): void }[] = [];

  // The islands: one merged mesh.
  let islandMesh: THREE.Mesh | null = null;
  if (plan.islands.length) {
    const top = LAND[look.topPattern];
    const parts = plan.islands.map((i) => islandGeometry(i, top, sideColour));
    const merged = mergeGeometries(parts);
    parts.forEach((p) => p.dispose());
    if (merged) {
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
      islandMesh = new THREE.Mesh(merged, mat);
      islandMesh.castShadow = false; // islands only catch shadows, so they never darken the track
      islandMesh.receiveShadow = true;
      root.add(islandMesh);
      disposables.push(merged, mat);
    }
  }

  // The props: one instanced mesh per kind and colour variant, most important first.
  const byKey = new Map<string, Prop[]>();
  for (const p of plan.props) {
    const key = `${p.kind}:${p.kind === 'container' || p.kind === 'flowers' ? p.variant : 0}`;
    const list = byKey.get(key) ?? [];
    list.push(p);
    byKey.set(key, list);
  }
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  disposables.push(material);
  const groups: Group[] = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const tilt = new THREE.Quaternion();
  const side = new THREE.Vector3(1, 0, 0);

  function place(g: Group, k: number, p: Prop, t: number) {
    let y = p.z;
    tilt.identity();
    if (g.anim && !reducedMotion) {
      const phase = (p.x * 1.7 + p.y * 2.3) % (Math.PI * 2);
      if (g.anim === 'bob') y += Math.sin(t * 1.6 + phase) * 0.04;
      else if (g.anim === 'sway') tilt.setFromAxisAngle(side, Math.sin(t * 1.3 + phase) * 0.06);
      else if (g.anim === 'flap') {
        // Gulls glide in slow circles round their spot.
        const a = t * 0.35 + phase;
        pos.set(p.x + Math.cos(a) * 1.2, y + Math.sin(t * 2 + phase) * 0.12, p.y + Math.sin(a) * 1.2);
        q.setFromAxisAngle(up, -a);
        m4.compose(pos, q, scl.setScalar(p.scale * PROP_SIZE));
        g.mesh.setMatrixAt(k, m4);
        return;
      }
    }
    pos.set(p.x, y, p.y);
    q.setFromAxisAngle(up, p.rot).multiply(tilt);
    m4.compose(pos, q, scl.setScalar(p.scale * PROP_SIZE));
    g.mesh.setMatrixAt(k, m4);
  }

  for (const [key, props] of byKey) {
    const [kind, variant] = key.split(':') as [PropKind, string];
    props.sort((a, b) => a.priority - b.priority);
    const geo = propGeometry(kind, Number(variant));
    disposables.push(geo);
    const mesh = new THREE.InstancedMesh(geo, material, props.length);
    mesh.name = `prop-${kind}`;
    // Flat things (pools, lakes, flowers) only catch shadows; everything else casts one too.
    const flat = kind === 'hot-pool' || kind === 'emerald-lake' || kind === 'mud-pot' || kind === 'flowers' || kind === 'steam-vent';
    mesh.castShadow = !flat;
    mesh.receiveShadow = true;
    const g: Group = { mesh, props, simpleCount: props.filter((p) => p.priority < SIMPLE_PRIORITY).length, anim: PROP_ANIM[kind] };
    props.forEach((p, k) => place(g, k, p, 0));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    // Gulls move around their spot, so don't let the box cut them off.
    if (g.anim === 'flap') mesh.frustumCulled = false;
    root.add(mesh);
    groups.push(g);
  }

  // Steam over the hot pools, vents and mud pots: a few soft puffs each, rising and fading.
  const steamSources = plan.props.filter((p) => STEAMY[p.kind]);
  const puffs: { sprite: THREE.Sprite; src: Prop; offset: number; strength: number }[] = [];
  let puffTex: THREE.Texture | null = null;
  if (steamSources.length) {
    puffTex = puffTexture();
    disposables.push(puffTex);
    const perSource = reducedMotion ? 1 : 3;
    for (const src of steamSources.slice(0, 30)) {
      for (let k = 0; k < perSource; k++) {
        const mat = new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0 });
        disposables.push(mat);
        const sprite = new THREE.Sprite(mat);
        root.add(sprite);
        puffs.push({ sprite, src, offset: k / perSource, strength: STEAMY[src.kind] ?? 0.5 });
      }
    }
  }

  let steamOn = true;
  function setQuality(ql: Quality) {
    const simple = ql === 'simple';
    for (const g of groups) g.mesh.count = simple ? g.simpleCount : g.props.length;
    steamOn = !simple;
    for (const p of puffs) p.sprite.visible = steamOn;
  }
  setQuality(quality);

  return {
    setQuality,
    update(clock) {
      for (const g of groups) {
        if (!g.anim || reducedMotion) continue;
        for (let k = 0; k < g.mesh.count; k++) place(g, k, g.props[k], clock);
        g.mesh.instanceMatrix.needsUpdate = true;
      }
      if (!steamOn) return;
      const speed = reducedMotion ? 0.08 : 0.22;
      for (const p of puffs) {
        const life = (clock * speed + p.offset + ((p.src.x * 0.37 + p.src.y * 0.61) % 1)) % 1;
        const s = (0.45 + life * 0.9) * p.src.scale;
        p.sprite.position.set(p.src.x + Math.sin(life * 3 + p.src.x) * 0.15, p.src.z + 0.15 + life * 1.3, p.src.y);
        p.sprite.scale.set(s, s, 1);
        (p.sprite.material as THREE.SpriteMaterial).opacity = Math.sin(life * Math.PI) * 0.55 * p.strength;
      }
    },
    dispose() {
      scene.remove(root);
      for (const g of groups) g.mesh.dispose();
      for (const d of disposables) d.dispose();
    },
  };
}
