import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { PropKind, Island } from './scenery';

export type { PropKind, Island };

/** Which props move (the lead does the animation). */
export const PROP_ANIM: Partial<Record<PropKind, 'bob' | 'sway' | 'flap'>> = {
  gull: 'flap',
  'harbour-buoy': 'bob',
  fern: 'sway',
  'dune-grass': 'sway',
};

// ---- small helpers ----

/** A steady number from 0 to 1 for three coordinates (no Math.random, so shapes never change). */
function hash3(x: number, y: number, z: number, seed = 0): number {
  let h = Math.imul(Math.round(x * 1000) | 0, 374761393) ^ Math.imul(Math.round(y * 1000) | 0, 668265263) ^ Math.imul(Math.round(z * 1000) | 0, 2147483647) ^ Math.imul(seed + 1, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

interface Place { p?: [number, number, number]; r?: [number, number, number]; s?: [number, number, number] | number }

/** Turn a shape into a coloured, placed, flat-shaded piece. */
function piece(geo: THREE.BufferGeometry, colour: number, at: Place = {}, jitter = 0, seed = 0): THREE.BufferGeometry {
  let g = geo;
  if (g.index) g = g.toNonIndexed();
  const m = new THREE.Matrix4();
  const s = at.s === undefined ? [1, 1, 1] : typeof at.s === 'number' ? [at.s, at.s, at.s] : at.s;
  m.compose(
    new THREE.Vector3(...(at.p ?? [0, 0, 0])),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...(at.r ?? [0, 0, 0]))),
    new THREE.Vector3(s[0], s[1], s[2]),
  );
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  if (jitter > 0) {
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      pos.setXYZ(i, x + (hash3(x, y, z, seed) - 0.5) * jitter, y + (hash3(x, y, z, seed + 7) - 0.5) * jitter, z + (hash3(x, y, z, seed + 13) - 0.5) * jitter);
    }
  }
  g.applyMatrix4(m);
  const c = new THREE.Color(colour);
  const arr = new Float32Array(pos.count * 3);
  // A touch of shade by face height so the flat faces read as faceted, not as a blob.
  for (let i = 0; i < pos.count; i++) {
    const k = 0.94 + hash3(Math.floor(i / 3), 3, 5, seed) * 0.1;
    arr[i * 3] = c.r * k; arr[i * 3 + 1] = c.g * k; arr[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

const cyl = (rt: number, rb: number, h: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const ball = (r: number, detail = 1) => new THREE.IcosahedronGeometry(r, detail);
const cone = (r: number, h: number, seg = 8) => new THREE.ConeGeometry(r, h, seg);

/** Merge pieces and drop them so the lowest point sits on y = 0. */
function finish(parts: THREE.BufferGeometry[], ground = true): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  g.computeBoundingBox();
  if (ground && g.boundingBox) g.translate(0, -g.boundingBox.min.y, 0);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** A lumpy rock: a squashed icosahedron with jittered corners. */
function rock(r: number, colour: number, squash: [number, number, number], jitter: number, seed: number, at: Place = {}): THREE.BufferGeometry {
  const p = at.p ?? [0, 0, 0];
  return piece(ball(r, 1), colour, { ...at, p, s: squash }, jitter, seed);
}

// ---- the shapes ----

const BUILDERS: Record<PropKind, (v: number) => THREE.BufferGeometry> = {
  boulder: () => finish([
    rock(0.3, 0x9a8f80, [1, 0.88, 1], 0.05, 1, { p: [0, 0.27, 0] }),
    // A faint darker crack band round the middle.
    piece(cyl(0.292, 0.292, 0.035, 12), 0x6f665b, { p: [0, 0.27, 0] }, 0.02, 2),
  ]),

  driftwood: () => finish([
    piece(cyl(0.07, 0.085, 0.8, 7), 0xcfc8bb, { p: [0, 0.08, 0], r: [0, 0, Math.PI / 2] }, 0.02, 3),
    piece(cyl(0.035, 0.05, 0.3, 6), 0xbdb5a6, { p: [0.08, 0.2, 0.08], r: [0.5, 0, 0.5] }, 0.01, 4),
    piece(cyl(0.075, 0.075, 0.02, 7), 0x9d9484, { p: [-0.4, 0.08, 0], r: [0, 0, Math.PI / 2] }),
  ]),

  'dune-grass': () => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      const d = 0.03 + (i % 3) * 0.045;
      const h = 0.38 + hash3(i, 1, 1) * 0.22;
      const col = i % 2 ? 0xc9c46e : 0xa9b968;
      parts.push(piece(cone(0.045, h, 4), col, { p: [Math.cos(a) * d, h / 2, Math.sin(a) * d], r: [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3] }));
    }
    return finish(parts);
  },

  gull: () => finish([
    piece(ball(0.07, 1), 0xfbfbf8, { p: [0, 0, 0], s: [1.5, 0.85, 0.9] }),
    piece(ball(0.045, 1), 0xfbfbf8, { p: [0.095, 0.035, 0] }),
    piece(cone(0.018, 0.06, 4), 0xf3b82c, { p: [0.16, 0.03, 0], r: [0, 0, -Math.PI / 2] }),
    // Spread wings, tilted up a little.
    piece(box(0.1, 0.012, 0.19), 0xb7bec6, { p: [0, 0.02, 0.13], r: [0.12, 0, 0] }),
    piece(box(0.1, 0.012, 0.19), 0xb7bec6, { p: [0, 0.02, -0.13], r: [-0.12, 0, 0] }),
    piece(box(0.08, 0.012, 0.06), 0x7d8791, { p: [0, 0.04, 0.235], r: [0.12, 0, 0] }),
    piece(box(0.08, 0.012, 0.06), 0x7d8791, { p: [0, 0.04, -0.235], r: [-0.12, 0, 0] }),
    piece(box(0.1, 0.012, 0.05), 0xf0f0ee, { p: [-0.12, 0.01, 0] }),
  ]),

  tussock: () => {
    const parts = [piece(ball(0.26, 1), 0xd2a85a, { p: [0, 0.17, 0], s: [1, 0.78, 1] }, 0.05, 5)];
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9;
      parts.push(piece(cone(0.05, 0.3, 4), i % 2 ? 0xe2bb6a : 0xc29a4c, { p: [Math.cos(a) * 0.14, 0.3, Math.sin(a) * 0.14], r: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5] }));
    }
    return finish(parts);
  },

  'road-sign': () => finish([
    piece(cyl(0.03, 0.03, 0.8, 6), 0x8f969c, { p: [0, 0.4, 0] }),
    piece(box(0.42, 0.42, 0.04), 0xf6c935, { p: [0, 0.86, 0], r: [0, 0, Math.PI / 4] }),
    // A bend arrow: a stem and a head, made of boxes.
    piece(box(0.05, 0.16, 0.05), 0x3c4249, { p: [-0.03, 0.8, 0.025] }),
    piece(box(0.15, 0.05, 0.05), 0x3c4249, { p: [0.03, 0.88, 0.025] }),
    piece(box(0.05, 0.12, 0.05), 0x3c4249, { p: [0.09, 0.84, 0.025], r: [0, 0, 0] }),
    piece(box(0.12, 0.05, 0.05), 0x3c4249, { p: [0.09, 0.78, 0.025], r: [0, 0, 0.8] }),
    piece(cyl(0.07, 0.09, 0.05, 7), 0x7c828a, { p: [0, 0.025, 0] }),
  ]),

  'schist-rock': () => finish([
    rock(0.3, 0x8a9096, [1.2, 0.3, 0.9], 0.05, 6, { p: [0, 0.1, 0] }),
    rock(0.24, 0xa4a9ae, [1.1, 0.25, 0.85], 0.05, 7, { p: [0.02, 0.24, 0.02], r: [0, 0.5, 0] }),
    rock(0.17, 0x7a8086, [1, 0.3, 0.9], 0.04, 8, { p: [-0.05, 0.35, 0], r: [0, 1, 0] }),
  ]),

  'hot-pool': () => finish([
    piece(cyl(0.6, 0.64, 0.07, 18), 0xf0e2c2, { p: [0, 0.035, 0] }, 0.02, 9),
    piece(cyl(0.45, 0.45, 0.02, 18), 0x35c9c6, { p: [0, 0.075, 0] }),
    piece(cyl(0.26, 0.26, 0.012, 14), 0x86e8dd, { p: [0.03, 0.088, -0.02] }),
  ]),

  'silica-terrace': () => {
    const parts: THREE.BufferGeometry[] = [];
    const tiers: [number, number, number, number][] = [[0.6, 0.12, 0xf0dcb4, 0], [0.45, 0.12, 0xf3c993, 0.1], [0.3, 0.12, 0xf0dcb4, 0.2]];
    for (const [r, h, col, y] of tiers) {
      parts.push(piece(cyl(r * 0.92, r, h, 14), col, { p: [0, y + h / 2, 0] }, 0.02, 10));
    }
    parts.push(piece(cyl(0.2, 0.2, 0.014, 12), 0x69c8e3, { p: [0, 0.327, 0] }));
    parts.push(piece(cyl(0.12, 0.12, 0.014, 10), 0x69c8e3, { p: [0.28, 0.227, 0.1] }));
    parts.push(piece(cyl(0.1, 0.1, 0.014, 10), 0x69c8e3, { p: [-0.3, 0.127, -0.2] }));
    return finish(parts);
  },

  'mud-pot': () => finish([
    piece(cyl(0.4, 0.46, 0.1, 14), 0xa28d78, { p: [0, 0.05, 0] }, 0.03, 11),
    piece(cyl(0.3, 0.3, 0.02, 14), 0x7c6a58, { p: [0, 0.105, 0] }),
    piece(ball(0.07, 1), 0x998573, { p: [0.08, 0.11, 0.03], s: [1, 0.8, 1] }),
    piece(ball(0.05, 1), 0x998573, { p: [-0.1, 0.11, -0.06], s: [1, 0.8, 1] }),
    piece(ball(0.04, 1), 0x998573, { p: [0.0, 0.11, -0.13], s: [1, 0.8, 1] }),
  ]),

  'steam-vent': () => {
    const parts: THREE.BufferGeometry[] = [piece(cyl(0.15, 0.17, 0.02, 10), 0xe8923e, { p: [0, 0.2, 0] }), piece(cyl(0.2, 0.22, 0.05, 10), 0xe8923e, { p: [0, 0.025, 0] })];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      parts.push(piece(ball(0.11, 0), i % 2 ? 0xf0e2c2 : 0xe3d3b0, { p: [Math.cos(a) * 0.22, 0.08, Math.sin(a) * 0.22], s: [1, 0.8, 1] }, 0.04, 12 + i));
    }
    parts.push(piece(cyl(0.16, 0.16, 0.02, 10), 0xe4883a, { p: [0, 0.075, 0] }));
    return finish(parts);
  },

  'ice-block': () => finish([
    rock(0.3, 0xb6e3f2, [1, 1.1, 0.9], 0.07, 20, { p: [0, 0.3, 0] }),
    rock(0.2, 0xd6f1fa, [0.9, 1.2, 0.9], 0.06, 21, { p: [0.22, 0.2, 0.1], r: [0, 0.6, 0] }),
    rock(0.12, 0xe8f8fd, [1, 1.2, 1], 0.04, 22, { p: [-0.18, 0.12, 0.2] }),
  ]),

  fern: () => {
    const parts: THREE.BufferGeometry[] = [piece(cyl(0.06, 0.09, 0.75, 7), 0x7a5a3c, { p: [0, 0.375, 0] }, 0.015, 23)];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      // A frond leaves the top and droops outward.
      parts.push(piece(cone(0.1, 0.6, 4), i % 2 ? 0x5ea64a : 0x4a9440, { p: [Math.cos(a) * 0.24, 0.72, Math.sin(a) * 0.24], r: [Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15], s: [1, 1, 0.45] }));
    }
    parts.push(piece(ball(0.08, 1), 0x5ea64a, { p: [0, 0.8, 0] }));
    return finish(parts);
  },

  rimu: () => {
    const parts: THREE.BufferGeometry[] = [piece(cyl(0.06, 0.09, 0.5, 7), 0x6e4e34, { p: [0, 0.25, 0] })];
    const tiers: [number, number, number][] = [[0.36, 0.44, 0.42], [0.3, 0.4, 0.78], [0.23, 0.36, 1.12], [0.15, 0.34, 1.45]];
    tiers.forEach(([r, h, y], i) => parts.push(piece(cone(r, h, 8), i % 2 ? 0x4f8f52 : 0x3f8048, { p: [0, y, 0] }, 0.03, 30 + i)));
    return finish(parts);
  },

  'snowy-pine': () => {
    const parts: THREE.BufferGeometry[] = [piece(cyl(0.05, 0.07, 0.25, 6), 0x5e4531, { p: [0, 0.125, 0] })];
    const tiers: [number, number, number][] = [[0.34, 0.4, 0.4], [0.26, 0.36, 0.7], [0.18, 0.32, 0.98]];
    tiers.forEach(([r, h, y], i) => {
      parts.push(piece(cone(r, h, 8), 0x2f6b48, { p: [0, y, 0] }, 0.02, 40 + i));
      // A white cap over the upper part of each tier.
      parts.push(piece(cone(r * 0.62, h * 0.55, 8), 0xf6fbff, { p: [0, y + h * 0.25 + 0.02, 0] }));
    });
    return finish(parts);
  },

  'snow-rock': () => finish([
    rock(0.3, 0x80888f, [1.1, 0.8, 0.95], 0.07, 50, { p: [0, 0.22, 0] }),
    rock(0.26, 0xf4f9fc, [1.05, 0.4, 0.9], 0.04, 51, { p: [0, 0.4, 0] }),
  ]),

  container: (v) => {
    const cols = [0xc95a4a, 0x4f7fb0, 0x5a9a6a, 0xe0903c];
    const dark = [0xa44636, 0x3b648f, 0x44794f, 0xbb7428];
    const c = cols[((v % 4) + 4) % 4], d = dark[((v % 4) + 4) % 4];
    const parts: THREE.BufferGeometry[] = [piece(box(1.0, 0.43, 0.45), c, { p: [0, 0.225, 0] })];
    // Ribs on the long sides and a door end.
    for (let i = 0; i < 9; i++) {
      const x = -0.4 + i * 0.1;
      parts.push(piece(box(0.035, 0.38, 0.47), d, { p: [x, 0.225, 0] }));
    }
    parts.push(piece(box(1.04, 0.03, 0.49), d, { p: [0, 0.44, 0] }));
    parts.push(piece(box(0.03, 0.4, 0.4), d, { p: [0.505, 0.225, 0] }));
    return finish(parts);
  },

  crane: () => {
    const red = 0xd8473b, white = 0xf4f1ea, grey = 0x8a9299;
    const parts: THREE.BufferGeometry[] = [];
    // Four legs and a cross-beam deck.
    for (const [x, z] of [[-0.32, -0.25], [0.32, -0.25], [-0.32, 0.25], [0.32, 0.25]] as const) {
      parts.push(piece(box(0.07, 1.2, 0.07), white, { p: [x * 0.8, 0.6, z], r: [0, 0, -x * 0.12] }));
    }
    parts.push(piece(box(0.8, 0.07, 0.6), red, { p: [0, 0.6, 0] }));
    parts.push(piece(box(0.8, 0.07, 0.6), red, { p: [0, 1.2, 0] }));
    parts.push(piece(box(0.9, 0.05, 0.7), grey, { p: [0, 0.03, 0] }));
    // Cab and boom.
    parts.push(piece(box(0.4, 0.3, 0.36), red, { p: [-0.05, 1.37, 0] }));
    parts.push(piece(box(0.18, 0.12, 0.02), 0xbfe3ef, { p: [0.14, 1.4, 0.19] }));
    parts.push(piece(box(1.6, 0.07, 0.1), white, { p: [0.5, 1.7, 0], r: [0, 0, 0.3] }));
    parts.push(piece(box(0.9, 0.05, 0.05), red, { p: [-0.2, 1.62, 0], r: [0, 0, -0.5] }));
    parts.push(piece(cyl(0.01, 0.01, 0.4, 4), 0x30353b, { p: [1.25, 1.7, 0] }));
    parts.push(piece(box(0.12, 0.08, 0.12), 0x30353b, { p: [1.25, 1.46, 0] }));
    parts.push(piece(box(0.35, 0.2, 0.3), grey, { p: [-0.45, 1.36, 0] }));
    return finish(parts);
  },

  'cable-car': () => finish([
    piece(cyl(0.04, 0.06, 1.1, 6), 0x8f969c, { p: [-0.55, 0.55, 0] }),
    piece(cyl(0.04, 0.06, 1.1, 6), 0x8f969c, { p: [0.55, 0.55, 0] }),
    piece(box(1.2, 0.025, 0.025), 0x4a5058, { p: [0, 1.08, 0] }),
    piece(box(0.025, 0.2, 0.025), 0x4a5058, { p: [0, 0.97, 0] }),
    piece(box(0.4, 0.26, 0.28), 0xd8473b, { p: [0, 0.75, 0] }),
    piece(box(0.44, 0.04, 0.32), 0xa93a31, { p: [0, 0.89, 0] }),
    piece(box(0.44, 0.03, 0.32), 0xf4f1ea, { p: [0, 0.62, 0] }),
    piece(box(0.12, 0.12, 0.02), 0xbfe3ef, { p: [-0.1, 0.77, 0.145] }),
    piece(box(0.12, 0.12, 0.02), 0xbfe3ef, { p: [0.1, 0.77, 0.145] }),
    piece(box(0.12, 0.12, 0.02), 0xbfe3ef, { p: [-0.1, 0.77, -0.145] }),
    piece(box(0.12, 0.12, 0.02), 0xbfe3ef, { p: [0.1, 0.77, -0.145] }),
    piece(cyl(0.1, 0.12, 0.05, 8), 0x7c828a, { p: [-0.55, 0.025, 0] }),
    piece(cyl(0.1, 0.12, 0.05, 8), 0x7c828a, { p: [0.55, 0.025, 0] }),
  ], false),

  'harbour-buoy': () => finish([
    piece(cyl(0.2, 0.2, 0.12, 12), 0xf4f1ea, { p: [0, 0.06, 0] }),
    piece(new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xd8473b, { p: [0, 0.12, 0] }),
    piece(cyl(0.2, 0.2, 0.1, 12), 0xd8473b, { p: [0, 0.17, 0], s: [1.02, 1, 1.02] }),
    piece(cyl(0.05, 0.1, 0.22, 8), 0xf4f1ea, { p: [0, 0.34, 0] }),
    piece(ball(0.06, 1), 0xf3b82c, { p: [0, 0.49, 0] }),
    piece(new THREE.TorusGeometry(0.2, 0.025, 5, 12), 0x4a5058, { p: [0, 0.03, 0], r: [Math.PI / 2, 0, 0] }),
  ]),

  'volcanic-rock': () => finish([
    rock(0.3, 0x7a4a3c, [1, 1.3, 0.9], 0.14, 60, { p: [0, 0.3, 0] }),
    rock(0.2, 0x5c372e, [0.9, 1.5, 0.8], 0.12, 61, { p: [0.24, 0.25, 0.1], r: [0, 0.4, 0.2] }),
    rock(0.16, 0x93604d, [1, 1.1, 1], 0.1, 62, { p: [-0.2, 0.15, 0.15] }),
  ]),

  'emerald-lake': () => finish([
    piece(cyl(0.88, 0.92, 0.07, 22), 0xe6dcc4, { p: [0, 0.035, 0] }, 0.04, 63),
    piece(cyl(0.72, 0.72, 0.02, 22), 0x14b88a, { p: [0, 0.075, 0] }),
    piece(cyl(0.45, 0.45, 0.012, 18), 0x3fd9b2, { p: [0.05, 0.088, 0.03] }),
    piece(cyl(0.2, 0.2, 0.012, 14), 0x8af0d0, { p: [0.1, 0.098, 0.06] }),
  ]),

  'round-tree': () => finish([
    piece(cyl(0.07, 0.1, 0.5, 7), 0x7a5638, { p: [0, 0.25, 0] }),
    piece(ball(0.36, 1), 0x5ea85a, { p: [0, 0.75, 0] }, 0.04, 70),
    piece(ball(0.24, 1), 0x6fba66, { p: [0.22, 0.62, 0.1] }, 0.04, 71),
    piece(ball(0.22, 1), 0x58a054, { p: [-0.2, 0.64, -0.08] }, 0.04, 72),
  ]),

  'hay-bale': () => finish([
    piece(cyl(0.3, 0.3, 0.45, 14), 0xe2b955, { p: [0, 0.3, 0], r: [0, 0, Math.PI / 2] }),
    piece(cyl(0.305, 0.305, 0.03, 14), 0xc99a3c, { p: [-0.1, 0.3, 0], r: [0, 0, Math.PI / 2] }),
    piece(cyl(0.305, 0.305, 0.03, 14), 0xc99a3c, { p: [0.1, 0.3, 0], r: [0, 0, Math.PI / 2] }),
    piece(cyl(0.12, 0.12, 0.47, 10), 0xd0a346, { p: [0, 0.3, 0], r: [0, 0, Math.PI / 2] }),
  ]),

  sheep: () => {
    const wool = 0xf6f3ec, dark = 0x4a4f55;
    const parts: THREE.BufferGeometry[] = [
      piece(ball(0.2, 1), wool, { p: [0, 0.3, 0], s: [1.25, 0.95, 0.95] }, 0.03, 80),
      piece(ball(0.13, 1), wool, { p: [-0.12, 0.38, 0.03] }, 0.03, 81),
      piece(ball(0.12, 1), wool, { p: [0.1, 0.4, -0.04] }, 0.03, 82),
      piece(ball(0.09, 1), dark, { p: [0.3, 0.36, 0], s: [1.1, 1, 0.9] }),
      piece(ball(0.045, 1), wool, { p: [0.25, 0.46, 0] }),
      piece(box(0.04, 0.02, 0.1), dark, { p: [0.28, 0.43, 0] }),
    ];
    for (const [x, z] of [[-0.14, -0.08], [-0.14, 0.08], [0.14, -0.08], [0.14, 0.08]] as const) {
      parts.push(piece(cyl(0.025, 0.03, 0.17, 5), dark, { p: [x, 0.085, z] }));
    }
    return finish(parts);
  },

  flowers: (v) => {
    const cols = [0xf08fb0, 0xf6d54a, 0xffffff, 0xb59ae8];
    const c = cols[((v % 4) + 4) % 4];
    const parts: THREE.BufferGeometry[] = [piece(cyl(0.34, 0.36, 0.03, 10), 0x7fb265, { p: [0, 0.015, 0] })];
    const spots: [number, number][] = [[0, 0], [0.17, 0.08], [-0.15, 0.12], [0.06, -0.18], [-0.14, -0.14], [0.22, -0.12], [-0.02, 0.22]];
    spots.forEach(([x, z], i) => {
      const h = 0.14 + (i % 3) * 0.04;
      parts.push(piece(cyl(0.008, 0.008, h, 4), 0x4f9a4a, { p: [x, 0.03 + h / 2, z] }));
      parts.push(piece(ball(0.05, 0), i % 3 === 1 ? 0xfff2a8 : c, { p: [x, 0.03 + h, z], s: [1, 0.6, 1] }));
      parts.push(piece(ball(0.02, 0), 0xf3b82c, { p: [x, 0.03 + h + 0.025, z] }));
    });
    return finish(parts);
  },
};

/** The shape of a prop: base at y = 0, centred on x = z = 0, sized in tiles. */
export function propGeometry(kind: PropKind, variant = 0): THREE.BufferGeometry {
  return BUILDERS[kind](variant);
}

/** A chunky rounded slab of land: a flat top at island.top, bevelled edges and a rocky underside that tapers down. */
export function islandGeometry(island: Island, topColour: number, sideColour: number): THREE.BufferGeometry {
  const { x, y, w, h, top } = island;
  const cx = x + w / 2, cz = y + h / 2;
  const bevel = 0.18;
  const depth = 0.8;
  const topC = new THREE.Color(topColour), sideC = new THREE.Color(sideColour);
  const pos: number[] = [];
  const col: number[] = [];
  const tri = (a: number[], b: number[], c: number[], colour: THREE.Color, shade: number) => {
    // Make sure the face points away from the middle of the slab.
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = (a[0] + b[0] + c[0]) / 3 - cx, my = (a[1] + b[1] + c[1]) / 3 - (top - depth / 2), mz = (a[2] + b[2] + c[2]) / 3 - cz;
    const flip = nx * mx + ny * my + nz * mz < 0;
    const pts = flip ? [a, c, b] : [a, b, c];
    for (const p of pts) { pos.push(p[0], p[1], p[2]); col.push(colour.r * shade, colour.g * shade, colour.b * shade); }
  };
  // Rings of points round the slab outline, from the top edge down to the tip of the underside.
  const seg = (n: number) => Math.max(2, Math.round(n * 2));
  const nx = seg(w), nz = seg(h);
  const outline: [number, number, number, number][] = []; // x, z, outward x, outward z
  for (let i = 0; i < nx; i++) outline.push([x + (w * i) / nx, y, 0, -1]);
  for (let i = 0; i < nz; i++) outline.push([x + w, y + (h * i) / nz, 1, 0]);
  for (let i = 0; i < nx; i++) outline.push([x + w - (w * i) / nx, y + h, 0, 1]);
  for (let i = 0; i < nz; i++) outline.push([x, y + h - (h * i) / nz, -1, 0]);
  const n = outline.length;
  const toward = (px: number, pz: number, k: number): [number, number] => [px + (cx - px) * k, pz + (cz - pz) * k];
  const rings: { pts: number[][]; colour: THREE.Color; shade: number }[] = [];
  // Ring 0: inner top edge (set in from the rim). Ring 1: the rim at the top. Ring 2: just under the bevel. Ring 3: the underside tip.
  const make = (inset: number, drop: number, jit: number, seed: number) =>
    outline.map(([px, pz], i) => {
      const [qx, qz] = toward(px, pz, inset);
      const j = (hash3(px, pz, seed, i) - 0.5) * jit;
      const dy = (hash3(pz, px, seed + 3, i) - 0.5) * jit * 0.8;
      return [qx + j, top - drop + dy, qz + j * 0.7];
    });
  const r0 = make(bevel * 0.6, 0, 0, 1);
  const r1 = outline.map(([px, pz]) => [px, top - bevel, pz]);
  const r2 = make(0.04, depth * 0.45, 0.14, 2);
  const r3 = make(0.18, depth * 0.85, 0.2, 3);
  const r4 = make(0.34, depth, 0.14, 4);
  rings.push({ pts: r0, colour: topC, shade: 1 }, { pts: r1, colour: topC, shade: 0.9 }, { pts: r2, colour: sideC, shade: 1 }, { pts: r3, colour: sideC, shade: 0.82 }, { pts: r4, colour: sideC, shade: 0.7 });
  for (let k = 0; k < rings.length - 1; k++) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = rings[k].pts[i], b = rings[k].pts[j], c = rings[k + 1].pts[j], d = rings[k + 1].pts[i];
      const colour = rings[k + 1].colour, shade = rings[k + 1].shade * (0.94 + hash3(i, k, 9) * 0.1);
      tri(a, b, c, colour, shade);
      tri(a, c, d, colour, shade);
    }
  }
  // The flat top inside ring 0, and the bottom cap.
  const topMid = [cx, top, cz];
  for (let i = 0; i < n; i++) tri(topMid, r0[i], r0[(i + 1) % n], topC, 1.02);
  const botMid = [cx, top - depth - 0.05, cz];
  for (let i = 0; i < n; i++) tri(botMid, r4[i], r4[(i + 1) % n], sideC, 0.62);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
