/**
 * Little bursts of dots: sand puffs, splashes, sparkles and confetti.
 * One THREE.Points holds every dot (a fixed pool, as many as the quality allows), so it costs one draw.
 * Positions are three.js space like renderer.ts: (gridX, height, gridY).
 */
import * as THREE from 'three';
import type { QualitySettings } from '../quality';

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aShape;
  attribute vec3 aColour;
  uniform float uViewH;
  varying float vAlpha;
  varying float vShape;
  varying vec3 vColour;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // World size to pixels: works for the orthographic camera (the game) and a perspective one.
    float persp = projectionMatrix[3][3] == 1.0 ? 1.0 : -mv.z;
    gl_PointSize = aSize * projectionMatrix[1][1] * uViewH * 0.5 / persp;
    vAlpha = aAlpha;
    vShape = aShape;
    vColour = aColour;
  }
`;
const FRAG = /* glsl */ `
  varying float vAlpha;
  varying float vShape;
  varying vec3 vColour;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float a;
    if (vShape < 0.5) a = smoothstep(0.5, 0.2, length(p));          // soft round dot
    else if (vShape < 1.5) {                                          // four-point star
      vec2 q = abs(p);
      a = smoothstep(0.1, 0.0, min(q.x, q.y) * 3.0 + max(q.x, q.y) - 0.5) + smoothstep(0.25, 0.0, length(p)) * 0.8;
    } else a = step(max(abs(p.x), abs(p.y)), 0.38);                   // square bit of confetti
    a *= vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColour, a);
  }
`;

const SHAPE = { dot: 0, star: 1, square: 2 } as const;
const MAX_RINGS = 4;
const CONFETTI = [0xef4444, 0xfacc15, 0x22c55e, 0x3b82f6, 0xec4899, 0xf97316];

export interface Particles {
  object: THREE.Object3D;
  dust(x: number, y: number, z: number, colour?: number, power?: number): void;
  splash(x: number, y: number, z: number): void;
  sparkle(x: number, y: number, z: number): void;
  confetti(x: number, y: number, z: number): void;
  update(dt: number): void;
  setQuality(settings: QualitySettings): void;
  /** How many dots are alive right now (for tests and the try-out page). */
  alive(): number;
  dispose(): void;
}

export function createParticles(settings: QualitySettings, reducedMotion: boolean): Particles {
  // The pool is made for the biggest quality; `cap` is how many of it may be used now.
  const POOL = 400;
  let cap = Math.min(POOL, settings.particles);
  const pos = new Float32Array(POOL * 3);
  const col = new Float32Array(POOL * 3);
  const size = new Float32Array(POOL);
  const alpha = new Float32Array(POOL);
  const shape = new Float32Array(POOL);
  const vel = new Float32Array(POOL * 3);
  const life = new Float32Array(POOL);
  const maxLife = new Float32Array(POOL);
  const grav = new Float32Array(POOL);
  const drag = new Float32Array(POOL);
  const baseSize = new Float32Array(POOL);
  const grow = new Float32Array(POOL);
  const flutter = new Float32Array(POOL);
  let cursor = 0;
  let liveCount = 0;
  let clock = 0;

  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3);
  const colAttr = new THREE.BufferAttribute(col, 3);
  const sizeAttr = new THREE.BufferAttribute(size, 1);
  const alphaAttr = new THREE.BufferAttribute(alpha, 1);
  for (const a of [posAttr, colAttr, sizeAttr, alphaAttr]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('aColour', colAttr);
  geo.setAttribute('aSize', sizeAttr);
  geo.setAttribute('aAlpha', alphaAttr);
  geo.setAttribute('aShape', new THREE.BufferAttribute(shape, 1));
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
    uniforms: { uViewH: { value: 600 } },
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 5;
  // The point size needs the canvas height in pixels; ask the renderer each frame.
  const sizeVec = new THREE.Vector2();
  points.onBeforeRender = (r) => {
    r.getDrawingBufferSize(sizeVec);
    material.uniforms.uViewH.value = sizeVec.y;
  };

  // Expanding rings for splashes: a few flat rings that grow and fade.
  const ringGeo = new THREE.RingGeometry(0.8, 1, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const rings = Array.from({ length: MAX_RINGS }, () => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    m.visible = false;
    m.renderOrder = 4;
    return { mesh: m, age: 0, life: 0 };
  });
  let nextRing = 0;
  const group = new THREE.Group();
  group.add(points);
  for (const r of rings) group.add(r.mesh);

  /** Reduced motion: a third as many dots, and they move gently. */
  const amount = (n: number) => Math.max(1, Math.round(reducedMotion ? n * 0.35 : n));
  const speedK = reducedMotion ? 0.5 : 1;
  const tmp = new THREE.Color();

  function spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, s: number, lifeS: number, colour: number, shp: number, g: number, d: number, gr = 0, fl = 0) {
    if (cap <= 0) return;
    // Use the next slot; if it is still alive the oldest dot is replaced, so a busy moment never stops new bursts.
    const i = cursor;
    cursor = (cursor + 1) % cap;
    if (life[i] <= 0) liveCount++;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    vel[i * 3] = vx * speedK; vel[i * 3 + 1] = vy * speedK; vel[i * 3 + 2] = vz * speedK;
    tmp.setHex(colour);
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    baseSize[i] = s; size[i] = s; shape[i] = shp;
    life[i] = maxLife[i] = lifeS * (reducedMotion ? 1.2 : 1);
    grav[i] = g; drag[i] = d; grow[i] = gr;
    flutter[i] = fl;
    alpha[i] = 1;
  }
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);

  function ring(x: number, y: number, z: number) {
    const r = rings[nextRing];
    nextRing = (nextRing + 1) % MAX_RINGS;
    r.mesh.position.set(x, y + 0.03, z);
    r.age = 0;
    r.life = reducedMotion ? 0.7 : 0.55;
    r.mesh.visible = true;
  }

  return {
    object: group,
    dust(x, y, z, colour = 0xe8d4a2, power = 1) {
      const n = amount(Math.round(6 + 6 * Math.min(power, 2)));
      for (let k = 0; k < n; k++) {
        const a = rnd(0, Math.PI * 2);
        const v = rnd(0.2, 0.9) * power;
        spawn(x + Math.cos(a) * 0.15, y + 0.05, z + Math.sin(a) * 0.15, Math.cos(a) * v, rnd(0.2, 0.7), Math.sin(a) * v, rnd(0.1, 0.18), rnd(0.35, 0.65), colour, SHAPE.dot, -0.4, 2.2, 0.25);
      }
    },
    splash(x, y, z) {
      const n = amount(22);
      for (let k = 0; k < n; k++) {
        const a = rnd(0, Math.PI * 2);
        const v = rnd(0.4, 1.6);
        spawn(x, y, z, Math.cos(a) * v, rnd(2, 4.5), Math.sin(a) * v, rnd(0.06, 0.12), rnd(0.6, 1), k % 3 ? 0x7dd3fc : 0xf0f9ff, SHAPE.dot, 11, 0.4);
      }
      ring(x, y, z);
    },
    sparkle(x, y, z) {
      const n = amount(14);
      for (let k = 0; k < n; k++) {
        const a = rnd(0, Math.PI * 2);
        const v = rnd(0.2, 0.8);
        spawn(x + Math.cos(a) * 0.2, y + rnd(0, 0.3), z + Math.sin(a) * 0.2, Math.cos(a) * v, rnd(0.8, 1.8), Math.sin(a) * v, rnd(0.14, 0.26), rnd(0.7, 1.1), k % 2 ? 0x67e8f9 : 0xfde047, SHAPE.star, -0.5, 1.2);
      }
    },
    confetti(x, y, z) {
      const n = amount(60);
      for (let k = 0; k < n; k++) {
        const a = rnd(0, Math.PI * 2);
        const v = rnd(0.5, 2.2);
        // Flutter sways the bit sideways as it falls; not with reduced motion.
        spawn(x, y + 0.3, z, Math.cos(a) * v, rnd(3, 6), Math.sin(a) * v, rnd(0.1, 0.17), rnd(1.4, 2.2), CONFETTI[k % CONFETTI.length], SHAPE.square, 6, 0.8, 0, reducedMotion ? 0 : rnd(1, 3));
      }
    },
    update(dt) {
      clock += dt;
      const step = Math.min(dt, 0.05);
      for (let i = 0; i < POOL; i++) {
        if (life[i] <= 0) continue;
        life[i] -= step;
        if (life[i] <= 0) {
          alpha[i] = 0; size[i] = 0; liveCount--;
          continue;
        }
        const k = Math.max(0, 1 - drag[i] * step);
        vel[i * 3] *= k; vel[i * 3 + 1] = (vel[i * 3 + 1] - grav[i] * step) * k; vel[i * 3 + 2] *= k;
        if (flutter[i]) vel[i * 3] += Math.sin(clock * 9 + i) * flutter[i] * step;
        pos[i * 3] += vel[i * 3] * step; pos[i * 3 + 1] += vel[i * 3 + 1] * step; pos[i * 3 + 2] += vel[i * 3 + 2] * step;
        const t = life[i] / maxLife[i];
        alpha[i] = Math.min(1, t * 2.5);
        size[i] = baseSize[i] * (1 + grow[i] * (1 - t));
      }
      for (const r of rings) {
        if (!r.mesh.visible) continue;
        r.age += step;
        const t = r.age / r.life;
        if (t >= 1) {
          r.mesh.visible = false;
          continue;
        }
        r.mesh.scale.setScalar(0.15 + t * 0.9);
        (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - t);
      }
      posAttr.needsUpdate = colAttr.needsUpdate = sizeAttr.needsUpdate = alphaAttr.needsUpdate = true;
    },
    setQuality(s) {
      cap = Math.min(POOL, s.particles);
      // Dots in slots above the new limit are dropped now.
      for (let i = cap; i < POOL; i++) {
        if (life[i] > 0) liveCount--;
        life[i] = 0; alpha[i] = 0; size[i] = 0;
      }
      if (cursor >= cap) cursor = 0;
    },
    alive: () => liveCount,
    dispose() {
      geo.dispose();
      material.dispose();
      ringGeo.dispose();
      for (const r of rings) (r.mesh.material as THREE.Material).dispose();
      group.removeFromParent();
    },
  };
}
