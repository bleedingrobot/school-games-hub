/**
 * How the marbles look: a glassy ball with a swirl inside and a highlight that stays put, and a short speed trail.
 * Drawing only. Positions are three.js space like renderer.ts: (gridX, height, gridY).
 */
import * as THREE from 'three';
import { BALL_RADIUS } from '../../../../shared/marble/config';
import type { QualitySettings } from '../quality';

export type MarbleKind = 'player' | 'rival' | 'ghost';

export interface MarbleObject {
  /** Move this one: `root.position.set(x, z + BALL_RADIUS, y)`. */
  root: THREE.Group;
  /** Roll this one: `ball.quaternion.premultiply(spin)`. The highlight is on `root`, so it does not roll. */
  ball: THREE.Mesh;
  dispose(): void;
}

const SWIRL: Record<'player' | 'rival', { base: string; mid: string; light: string; spark: string }> = {
  player: { base: '#1e3a8a', mid: '#2563eb', light: '#7dd3fc', spark: '#f8fafc' },
  rival: { base: '#9a3412', mid: '#f97316', light: '#fdba74', spark: '#fffbeb' },
};

/** A coloured swirl on a canvas. The bands use whole sine waves across the width, so the edges meet and there is no seam. */
function swirlTexture(kind: 'player' | 'rival'): THREE.CanvasTexture {
  const c = SWIRL[kind];
  const w = 256;
  const h = 128;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  if (g) {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, c.mid);
    grad.addColorStop(0.5, c.base);
    grad.addColorStop(1, c.mid);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    const band = (y0: number, thick: number, cycles: number, phase: number, colour: string, alpha: number) => {
      g.fillStyle = colour;
      g.globalAlpha = alpha;
      g.beginPath();
      for (let x = 0; x <= w; x += 4) g.lineTo(x, y0 + Math.sin((x / w) * Math.PI * 2 * cycles + phase) * 14);
      for (let x = w; x >= 0; x -= 4) g.lineTo(x, y0 + thick + Math.sin((x / w) * Math.PI * 2 * cycles + phase + 0.8) * 14);
      g.closePath();
      g.fill();
    };
    band(30, 16, 2, 0, c.light, 0.9);
    band(62, 10, 3, 1.5, c.spark, 0.85);
    band(86, 18, 2, 3, c.light, 0.7);
    band(14, 6, 4, 2, c.mid, 0.9);
    g.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function highlightTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.7)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(cv);
}

/** Towards the camera, up and a bit to the left: where the light shows on a glass ball. (The camera sits at +x +y +z.) */
const HIGHLIGHT_DIR = new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(0.7)
  .add(new THREE.Vector3(-1, 2, -1).normalize().multiplyScalar(0.6))
  .add(new THREE.Vector3(1, 0, -1).normalize().multiplyScalar(-0.4))
  .normalize();

export function makeMarble(kind: MarbleKind): MarbleObject {
  const root = new THREE.Group();
  const toDispose: Array<{ dispose(): void }> = [];
  let ball: THREE.Mesh;
  if (kind === 'ghost') {
    // A pale glow you can see the track through.
    const mat = new THREE.MeshBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending });
    ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 20, 14), mat);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: highlightTexture(), color: 0x7dd3fc, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(BALL_RADIUS * 3.4);
    root.add(halo);
    toDispose.push(halo.material.map as THREE.Texture, halo.material);
    toDispose.push(mat, ball.geometry);
  } else {
    const map = swirlTexture(kind);
    // Glassy: very smooth, a little clear coat. MeshPhysicalMaterial is a bit dearer than Standard but one small ball is cheap.
    const mat = new THREE.MeshPhysicalMaterial({ map, roughness: 0.08, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 });
    ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 32, 20), mat);
    ball.castShadow = true;
    const hi = new THREE.Sprite(new THREE.SpriteMaterial({ map: highlightTexture(), transparent: true, depthWrite: false }));
    hi.scale.setScalar(BALL_RADIUS * 0.8);
    hi.position.copy(HIGHLIGHT_DIR).multiplyScalar(BALL_RADIUS * 0.93);
    root.add(hi);
    toDispose.push(map, mat, ball.geometry, hi.material.map as THREE.Texture, hi.material);
  }
  root.add(ball);
  return {
    root,
    ball,
    dispose() {
      for (const d of toDispose) d.dispose();
      root.removeFromParent();
    },
  };
}

// ---- the trail ----

export interface Trail {
  object: THREE.Object3D;
  /** Call every frame with the marble's centre (three.js space) and its speed in tiles per second. */
  push(x: number, y: number, z: number, speed: number): void;
  setVisible(visible: boolean): void;
  setQuality(settings: QualitySettings): void;
  dispose(): void;
}

const TRAIL_POINTS = 14;
/** The trail starts to show above this speed (the top speed is 4.5). */
export const TRAIL_MIN_SPEED = 2.2;
const MIN_GAP = 0.07;
/** A jump bigger than this between two pushes is a respawn: the old trail is dropped. */
const TELEPORT = 1.5;
const VIEW = new THREE.Vector3(1, 1, 1);

export function makeTrail(settings: QualitySettings, reducedMotion = false, colour = 0xbfdbfe): Trail {
  const n = TRAIL_POINTS;
  const pts: Array<{ p: THREE.Vector3; speed: number }> = [];
  const positions = new Float32Array(n * 2 * 3);
  const colours = new Float32Array(n * 2 * 4);
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  const colAttr = new THREE.BufferAttribute(colours, 4);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  colAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('color', colAttr);
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  mesh.visible = false;
  let wanted = true;
  let allowed = settings.trail;
  const c = new THREE.Color(colour);
  const dir = new THREE.Vector3();
  const side = new THREE.Vector3();
  const last = new THREE.Vector3();

  function rebuild() {
    // Newest point first; each one is a pair of vertices either side of the path, narrower and fainter further back.
    let any = false;
    for (let i = 0; i < n; i++) {
      const k = Math.min(i, pts.length - 1);
      const cur = pts[pts.length - 1 - k];
      if (!cur) {
        for (let j = 0; j < 2; j++) colours[(i * 2 + j) * 4 + 3] = 0;
        continue;
      }
      const prev = pts[pts.length - 2 - k] ?? cur;
      const next = pts[pts.length - k] ?? cur;
      dir.subVectors(next.p, prev.p);
      if (dir.lengthSq() < 1e-8) dir.set(1, 0, 0);
      side.crossVectors(dir, VIEW).normalize();
      const f = 1 - i / (n - 1);
      const half = BALL_RADIUS * 0.55 * f;
      const speedK = Math.min(1, Math.max(0, (cur.speed - TRAIL_MIN_SPEED) / 1.5));
      const a = (i < pts.length ? f * f * speedK * (reducedMotion ? 0.3 : 0.5) : 0);
      if (a > 0.01) any = true;
      for (let j = 0; j < 2; j++) {
        const o = (i * 2 + j) * 3;
        const sgn = j ? 1 : -1;
        positions[o] = cur.p.x + side.x * half * sgn;
        positions[o + 1] = cur.p.y + side.y * half * sgn;
        positions[o + 2] = cur.p.z + side.z * half * sgn;
        const q = (i * 2 + j) * 4;
        colours[q] = c.r; colours[q + 1] = c.g; colours[q + 2] = c.b; colours[q + 3] = a;
      }
    }
    posAttr.needsUpdate = colAttr.needsUpdate = true;
    mesh.visible = any && wanted && allowed;
  }

  return {
    object: mesh,
    push(x, y, z, speed) {
      const p = new THREE.Vector3(x, y, z);
      if (pts.length) {
        last.copy(pts[pts.length - 1].p);
        const d = last.distanceTo(p);
        if (d > TELEPORT) pts.length = 0;
        else if (d < MIN_GAP) {
          pts[pts.length - 1].speed = speed;
          p.copy(last);
        }
      }
      if (!pts.length || p.distanceTo(pts[pts.length - 1].p) >= MIN_GAP) {
        pts.push({ p, speed });
        if (pts.length > n) pts.shift();
      }
      if (allowed && wanted) rebuild();
    },
    setVisible(v) {
      wanted = v;
      if (!v) mesh.visible = false;
    },
    setQuality(s) {
      allowed = s.trail;
      if (!allowed) mesh.visible = false;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      mesh.removeFromParent();
    },
  };
}
