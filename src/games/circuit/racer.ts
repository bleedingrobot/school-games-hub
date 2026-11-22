/**
 * The racer, drawn in code (docs/CIRCUIT-PLAN.md decision: "3D glowing racer", crisp at every size): a sleek hover-racer
 * with a shiny metal body (it reflects a soft studio light, `racerEnvironment`), a glass cockpit, swept wings with neon
 * edges, twin engines whose flames grow with speed, and a soft pool of light on the road under it. About 0.62 wide and
 * 1.05 long (a lane is 1.0). It faces −z (down the road); the renderer moves, banks and tilts the whole group.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface Racer {
  group: THREE.Group;
  /** Each frame: `speed` 0 to 1, `height` above the road (the under-glow fades as it rises), `time` in seconds. */
  update(speed: number, height: number, time: number, reduced: boolean): void;
}

/** A soft studio light for shiny materials (only the racer's materials use it). */
export function racerEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const texture = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  return texture;
}

/** The body seen from above: a pointed nose, a waist, wide hips and a flat tail (x across, y along: +y is the nose). */
function bodyShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0.55);
  s.bezierCurveTo(0.07, 0.45, 0.12, 0.25, 0.14, 0.05);
  s.bezierCurveTo(0.2, -0.12, 0.24, -0.3, 0.22, -0.45);
  s.lineTo(0.08, -0.5);
  s.lineTo(-0.08, -0.5);
  s.lineTo(-0.22, -0.45);
  s.bezierCurveTo(-0.24, -0.3, -0.2, -0.12, -0.14, 0.05);
  s.bezierCurveTo(-0.12, 0.25, -0.07, 0.45, 0, 0.55);
  return s;
}

/** A swept wing, right side (mirrored for the left). */
function wingShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0.12, 0.0);
  s.lineTo(0.34, -0.28);
  s.lineTo(0.36, -0.42);
  s.lineTo(0.18, -0.36);
  s.lineTo(0.12, -0.2);
  s.closePath();
  return s;
}

/** A round soft spot of light, for the glow under the racer. */
function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(c);
}

/** Builds the racer. `colour` is its neon (the edges, engines and under-glow); `own` keeps things to dispose. */
export function createRacer(colour: string, own: <T extends { dispose(): void }>(thing: T) => T): Racer {
  const group = new THREE.Group();
  const neon = new THREE.Color(colour);

  // Body: a bevelled slab of dark candy-blue metal, lying flat, nose forward.
  const paint = own(new THREE.MeshStandardMaterial({ color: '#2563eb', metalness: 0.35, roughness: 0.28, envMapIntensity: 0.5, emissive: '#1d4ed8', emissiveIntensity: 0.35 }));
  const trim = own(new THREE.MeshStandardMaterial({ color: '#0b1022', metalness: 0.6, roughness: 0.4 }));
  const bodyGeo = own(new THREE.ExtrudeGeometry(bodyShape(), { depth: 0.08, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 3, curveSegments: 16 }));
  bodyGeo.rotateX(-Math.PI / 2); // shape y (nose) → −z, extrusion → +y
  const body = new THREE.Mesh(bodyGeo, [paint, trim]);
  body.position.y = 0.02;
  group.add(body);

  // A raised spine down the middle, lighter, so the shape reads from behind.
  const spineGeo = own(new THREE.CapsuleGeometry(0.06, 0.55, 4, 10));
  spineGeo.rotateX(Math.PI / 2);
  const spine = new THREE.Mesh(spineGeo, paint);
  spine.scale.set(1.3, 0.7, 1);
  spine.position.set(0, 0.13, 0.05);
  group.add(spine);

  // A neon outline tracing the body's edge, so the racer pops against any world.
  const outline = bodyShape().getSpacedPoints(80).map((p) => new THREE.Vector3(p.x * 1.04, 0.075, -p.y * 1.04));
  const outlineMat = own(new THREE.MeshBasicMaterial({ color: neon.clone().multiplyScalar(1.5) }));
  group.add(new THREE.Mesh(own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline, true), 160, 0.015, 6, true)), outlineMat));

  // Glass cockpit: a dark tinted bubble with a bright rim of reflection.
  const glass = own(new THREE.MeshStandardMaterial({ color: '#0e1f3d', metalness: 0.1, roughness: 0.05, envMapIntensity: 2.2, emissive: neon, emissiveIntensity: 0.12 }));
  const cockpit = new THREE.Mesh(own(new THREE.SphereGeometry(0.1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2)), glass);
  cockpit.scale.set(0.95, 0.75, 2.0);
  cockpit.position.set(0, 0.16, -0.08);
  group.add(cockpit);

  // Swept wings with neon leading edges.
  const neonMat = own(new THREE.MeshBasicMaterial({ color: neon.clone().multiplyScalar(1.6) }));
  const wingGeo = own(new THREE.ExtrudeGeometry(wingShape(), { depth: 0.025, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 }));
  wingGeo.rotateX(-Math.PI / 2);
  for (const side of [1, -1]) {
    const wing = new THREE.Mesh(wingGeo, paint);
    wing.scale.x = side;
    wing.position.y = 0.06;
    group.add(wing);
    // The neon edge along the wing's front.
    const edge = new THREE.Mesh(own(new THREE.BoxGeometry(0.3, 0.018, 0.018)), neonMat);
    edge.position.set(side * 0.235, 0.1, 0.14);
    edge.rotation.y = side * -0.92;
    group.add(edge);
    // A neon stripe down each side of the body.
    const stripe = new THREE.Mesh(own(new THREE.BoxGeometry(0.014, 0.014, 0.62)), neonMat);
    stripe.position.set(side * 0.155, 0.135, 0.02);
    stripe.rotation.y = side * -0.08;
    group.add(stripe);
  }

  // Twin engines: dark pods with glowing nozzles and flames that grow with speed.
  const nozzleMat = own(new THREE.MeshBasicMaterial({ color: neon.clone().multiplyScalar(2.2) }));
  const flameMat = own(new THREE.MeshBasicMaterial({ color: neon.clone().lerp(new THREE.Color('#ffffff'), 0.35).multiplyScalar(1.4), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  const podGeo = own(new THREE.CylinderGeometry(0.06, 0.07, 0.22, 14));
  podGeo.rotateX(Math.PI / 2);
  const nozzleGeo = own(new THREE.CircleGeometry(0.05, 16));
  const flameGeo = own(new THREE.ConeGeometry(0.05, 1, 12, 1, true));
  flameGeo.rotateX(Math.PI / 2);
  flameGeo.translate(0, 0, 0.5);
  const flames: THREE.Mesh[] = [];
  for (const side of [1, -1]) {
    const pod = new THREE.Mesh(podGeo, trim);
    pod.position.set(side * 0.12, 0.1, 0.42);
    group.add(pod);
    const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzle.position.set(side * 0.12, 0.1, 0.532);
    group.add(nozzle);
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(side * 0.12, 0.1, 0.53);
    group.add(flame);
    flames.push(flame);
  }

  // A soft pool of light on the road under the racer (it hovers).
  const glowMat = own(new THREE.MeshBasicMaterial({ map: own(glowTexture()), color: neon, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  const under = new THREE.Mesh(own(new THREE.PlaneGeometry(0.9, 1.3)), glowMat);
  under.rotation.x = -Math.PI / 2;
  group.add(under);

  return {
    group,
    update(speed, height, time, reduced) {
      // Hover: a gentle bob above the road, the glow staying on the road and fading as the racer rises.
      const bob = reduced ? 0 : Math.sin(time * 6) * 0.012;
      body.position.y = 0.02 + bob;
      under.position.y = -height - 0.1;
      glowMat.opacity = Math.max(0, 0.5 - height * 0.25);
      // Flames: longer and brighter with speed, flickering.
      const flicker = reduced ? 1 : 0.85 + Math.random() * 0.3;
      for (const f of flames) f.scale.set(1, 1, (0.08 + speed * 0.42) * flicker);
      flameMat.opacity = 0.45 + speed * 0.45;
      nozzleMat.color.copy(neon).multiplyScalar(1.4 + speed * 1.2);
    },
  };
}
