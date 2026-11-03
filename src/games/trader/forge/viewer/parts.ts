/** Planet effects and technology for the viewer: auroras, geysers, meteors, islands, dust tails, satellites, stations… */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FINISH, LIGHTS, NOISE } from './glsl';
import { glowMaterial, hologramMaterial, type Shared } from './materials';

export interface Part {
  obj: THREE.Object3D;
  update?(t: number, cam: THREE.Camera): void;
  dispose(): void;
}

/** A tiny seeded random number source. */
export function rng(seed: number): () => number {
  let s = (Math.abs(Math.floor(seed * 7919)) % 2147483646) + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const disposeAll = (o: THREE.Object3D) =>
  o.traverse((x) => {
    const m = x as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((y) => y.dispose());
    else mat?.dispose();
  });

export const metal = (color = 0xd2d8e2) => new THREE.MeshStandardMaterial({ color, metalness: 0.65, roughness: 0.35 });
const lamp = (r: number, g: number, b: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: true });

/** Gives every mesh in a part the hologram look (for plans). */
export function asHologram(o: THREE.Object3D, time: { value: number }) {
  const holo = hologramMaterial(time, 8);
  o.traverse((x) => {
    const m = x as THREE.Mesh;
    if (!m.isMesh) return;
    (m.material as THREE.Material).dispose();
    m.material = holo;
  });
}

// ---------------------------------------------------------------------------------------------- effects

export function aurora(shared: Shared, R: number, amount: number): Part {
  const geo = new THREE.CylinderGeometry(R * 0.44, R * 0.4, R * 0.28, 96, 1, true);
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vWorld; varying vec3 vNrm;
void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vWorld=w.xyz; vNrm=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */ `uniform float uAmt; uniform vec3 uCenter; varying vec2 vUv; varying vec3 vWorld; varying vec3 vNrm;
${LIGHTS}
${NOISE}
void main(){
  float u=vUv.x*6.2831853;
  float c=snoise(vec3(cos(u)*3.0,sin(u)*3.0,uTime*0.15))*0.5+0.5;
  float c2=snoise(vec3(cos(u)*9.0,sin(u)*9.0,uTime*0.4))*0.5+0.5;
  float curtain=c*c*(0.6+0.8*c2);
  float y=vUv.y;
  float fade=smoothstep(0.0,0.15,y)*pow(1.0-y,1.5);
  vec3 col=mix(vec3(0.1,1.0,0.45),vec3(1.0,0.25,0.7),smoothstep(0.35,1.0,y+c2*0.2));
  float night=1.0;
  for(int i=0;i<2;i++){ if(i>=uLightCount) break; night=min(night,1.0-0.65*smoothstep(-0.2,0.4,dot(normalize(vWorld-uCenter),normalize(uLightPos[i]-uCenter)))); }
  gl_FragColor=vec4(col*curtain*fade*uAmt*2.2*night,1.0);
  ${FINISH}
}`,
    uniforms: { ...shared, uAmt: { value: amount }, uCenter: { value: new THREE.Vector3() } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const g = new THREE.Group();
  const north = new THREE.Mesh(geo, mat);
  north.position.y = R * 0.95;
  const south = new THREE.Mesh(geo, mat);
  south.position.y = -R * 0.95;
  south.rotation.x = Math.PI;
  g.add(north, south);
  const wp = new THREE.Vector3();
  return {
    obj: g,
    update() {
      g.parent?.getWorldPosition(wp);
      mat.uniforms.uCenter.value.copy(wp);
    },
    dispose: () => { geo.dispose(); mat.dispose(); },
  };
}

/** Points whose positions are worked out on the GPU from a start, a direction and a phase (geysers, tails). */
function fountain(count: number, opts: { color: THREE.Color; size: number; frag?: string; vert: string; attrs: Record<string, [Float32Array, number]>; uniforms: Record<string, THREE.IUniform>; additive?: boolean }) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  for (const [k, [arr, n]] of Object.entries(opts.attrs)) geo.setAttribute(k, new THREE.BufferAttribute(arr, n));
  const mat = new THREE.ShaderMaterial({
    vertexShader: opts.vert,
    fragmentShader: opts.frag ?? /* glsl */ `uniform vec3 uColor; varying float vA;
void main(){ vec2 c=gl_PointCoord*2.0-1.0; float r=dot(c,c); if(r>1.0) discard; gl_FragColor=vec4(uColor*exp(-r*3.0)*vA,1.0); ${FINISH} }`,
    uniforms: { uColor: { value: opts.color }, uSize: { value: opts.size }, ...opts.uniforms },
    transparent: true,
    depthWrite: false,
    blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return { pts, geo, mat };
}

export function geysers(time: { value: number }, R: number, n: number, pixelRatio: number, amount: number): Part {
  const seed = new Float32Array(n * 4);
  const r = rng(R * 13);
  for (let i = 0; i < n; i++) seed.set([r(), r() * Math.PI * 2, 0.6 + r() * 0.6, Math.floor(r() * 4)], i * 4);
  const f = fountain(n, {
    color: new THREE.Color(0.75, 0.9, 1.2).multiplyScalar(amount),
    size: 3,
    attrs: { aSeed: [seed, 4] },
    uniforms: { uTime: time, uR: { value: R }, uScale: { value: pixelRatio } },
    vert: /* glsl */ `attribute vec4 aSeed; uniform float uTime; uniform float uR; uniform float uSize; uniform float uScale; varying float vA;
void main(){
  float t=fract(uTime*0.22*aSeed.z+aSeed.x);
  float jet=aSeed.w*1.5708+0.4;
  vec3 base=normalize(vec3(cos(jet)*0.25,-1.0,sin(jet)*0.25))*uR;
  vec3 dir=normalize(base)+vec3(cos(aSeed.y),0.0,sin(aSeed.y))*0.12*t;
  vec3 p=base+dir*t*uR*1.1-vec3(0.0,-1.0,0.0)*t*t*uR*0.3;
  vA=(1.0-t)*smoothstep(0.0,0.05,t);
  vec4 mv=modelViewMatrix*vec4(p,1.0);
  gl_PointSize=clamp(uSize*uScale*(30.0/-mv.z)*(0.6+t),1.0,24.0);
  gl_Position=projectionMatrix*mv;
}`,
  });
  return { obj: f.pts, dispose: () => { f.geo.dispose(); f.mat.dispose(); } };
}

export function meteors(time: { value: number }, R: number, n: number): Part {
  const start = new Float32Array(n * 2 * 3), end = new Float32Array(n * 2 * 3), info = new Float32Array(n * 2 * 2);
  const r = rng(R * 31 + 5);
  const v = new THREE.Vector3(), t = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.set(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    t.set(r() - 0.5, r() - 0.5, r() - 0.5).cross(v).normalize();
    const e = v.clone().multiplyScalar(R * 1.01);
    const s = v.clone().multiplyScalar(R * 1.25).addScaledVector(t, R * 0.7);
    const phase = r();
    for (let k = 0; k < 2; k++) {
      start.set([s.x, s.y, s.z], (i * 2 + k) * 3);
      end.set([e.x, e.y, e.z], (i * 2 + k) * 3);
      info.set([phase, k], (i * 2 + k) * 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(start.slice(), 3));
  geo.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 3));
  geo.setAttribute('aInfo', new THREE.BufferAttribute(info, 2));
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `attribute vec3 aStart; attribute vec3 aEnd; attribute vec2 aInfo; uniform float uTime; varying float vA;
void main(){
  float p=fract(uTime*0.35+aInfo.x)*2.5;
  float head=clamp(p,0.0,1.0); float tail=clamp(p-0.25,0.0,1.0);
  float k=aInfo.y>0.5?head:tail;
  vec3 pos=mix(aStart,aEnd,k);
  vA=aInfo.y>0.5?1.0:0.0; vA*=step(p,1.0);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.0);
}`,
    fragmentShader: /* glsl */ `varying float vA; void main(){ gl_FragColor=vec4(vec3(2.4,1.6,0.8)*vA,1.0); ${FINISH} }`,
    uniforms: { uTime: time },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  return { obj: lines, dispose: () => { geo.dispose(); mat.dispose(); } };
}

export function islands(R: number, count: number): Part {
  const r = rng(R * 7 + 3);
  const rock = new THREE.IcosahedronGeometry(1, 1);
  const pos = rock.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < 0) pos.setY(i, y * 2.2 - 0.2 * Math.abs(pos.getX(i)));
    else pos.setY(i, y * 0.35);
    const c = y > 0.1 ? [0.25, 0.6, 0.25] : [0.45, 0.35, 0.28];
    colors.set(c, i * 3);
  }
  rock.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  rock.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const mesh = new THREE.InstancedMesh(rock, mat, count);
  const homes: { dir: THREE.Vector3; h: number; s: number; ph: number }[] = [];
  for (let i = 0; i < count; i++) homes.push({ dir: new THREE.Vector3(r() - 0.5, (r() - 0.5) * 1.2, r() - 0.5).normalize(), h: 1.12 + r() * 0.18, s: R * (0.05 + r() * 0.05), ph: r() * 6 });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), sc = new THREE.Vector3();
  mesh.frustumCulled = false;
  return {
    obj: mesh,
    update(t) {
      for (let i = 0; i < count; i++) {
        const h = homes[i];
        q.setFromUnitVectors(up, h.dir);
        p.copy(h.dir).multiplyScalar(R * (h.h + 0.02 * Math.sin(t * 0.8 + h.ph)));
        sc.setScalar(h.s);
        m.compose(p, q, sc);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose: () => { rock.dispose(); mat.dispose(); mesh.dispose(); },
  };
}

export function dustTail(time: { value: number }, R: number, n: number, pixelRatio: number, amount: number): Part & { away: THREE.Vector3; back: THREE.Vector3 } {
  const seed = new Float32Array(n * 4);
  const r = rng(R * 3 + 11);
  for (let i = 0; i < n; i++) seed.set([r(), r() * Math.PI * 2, Math.sqrt(r()), r()], i * 4);
  const away = new THREE.Vector3(1, 0, 0), back = new THREE.Vector3(0, 0, 1);
  const f = fountain(n, {
    color: new THREE.Color(1.0, 0.85, 0.6).multiplyScalar(0.55 * amount),
    size: 3,
    attrs: { aSeed: [seed, 4] },
    uniforms: { uTime: time, uR: { value: R }, uAway: { value: away }, uBack: { value: back }, uScale: { value: pixelRatio } },
    vert: /* glsl */ `attribute vec4 aSeed; uniform float uTime; uniform float uR; uniform vec3 uAway; uniform vec3 uBack; uniform float uSize; uniform float uScale; varying float vA;
void main(){
  float t=fract(uTime*0.05+aSeed.x);
  vec3 side=normalize(cross(uAway,vec3(0.0,1.0,0.0)));
  vec3 up=cross(side,uAway);
  float spread=aSeed.z*uR*(0.5+t*2.2);
  vec3 p=uAway*(uR*0.9+t*uR*14.0)+(side*cos(aSeed.y)+up*sin(aSeed.y))*spread+uBack*t*t*uR*4.0;
  vA=(1.0-t)*(1.0-t)*smoothstep(0.0,0.08,t)*(0.5+aSeed.w*0.5);
  vec4 mv=modelViewMatrix*vec4(p,1.0);
  gl_PointSize=clamp(uSize*uScale*(40.0/-mv.z)*(1.0+t*2.0),1.0,30.0);
  gl_Position=projectionMatrix*mv;
}`,
  });
  return { obj: f.pts, away, back, dispose: () => { f.geo.dispose(); f.mat.dispose(); } };
}

/** Little lights going round (satellites, miners): attribute aOrbit = radius, tilt, phase, speed; aNode = turn. */
export function orbiters(time: { value: number }, orbits: number[][], color: THREE.Color, size: number, pixelRatio: number): Part {
  const n = orbits.length;
  const a = new Float32Array(n * 4), node = new Float32Array(n);
  orbits.forEach((o, i) => { a.set(o.slice(0, 4), i * 4); node[i] = o[4] ?? 0; });
  const f = fountain(n, {
    color,
    size,
    attrs: { aOrbit: [a, 4], aNode: [node, 1] },
    uniforms: { uTime: time, uScale: { value: pixelRatio } },
    vert: /* glsl */ `attribute vec4 aOrbit; attribute float aNode; uniform float uTime; uniform float uSize; uniform float uScale; varying float vA;
void main(){
  float an=aOrbit.z+uTime*aOrbit.w;
  vec3 p=vec3(cos(an),0.0,sin(an))*aOrbit.x;
  float ci=cos(aOrbit.y),si=sin(aOrbit.y);
  p=vec3(p.x,-p.z*si,p.z*ci);
  float cn=cos(aNode),sn=sin(aNode);
  p=vec3(p.x*cn+p.z*sn,p.y,-p.x*sn+p.z*cn);
  float blink=step(0.9,fract(uTime*0.6+aOrbit.z*3.0));
  vA=0.8+blink*1.5;
  vec4 mv=modelViewMatrix*vec4(p,1.0);
  gl_PointSize=clamp(uSize*uScale*(25.0/-mv.z),1.5,uSize*uScale*1.6)*(1.0+blink*0.5);
  gl_Position=projectionMatrix*mv;
}`,
  });
  return { obj: f.pts, dispose: () => { f.geo.dispose(); f.mat.dispose(); } };
}

// ---------------------------------------------------------------------------------------------- technology

export function station(R: number): Part {
  const g = new THREE.Group();
  const s = Math.max(0.22, R * 0.16);
  const body = new THREE.Group();
  const m = metal();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(s, s * 0.12, 10, 48), m);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.18, s * 0.18, s * 0.9, 16), m);
  hub.rotation.x = Math.PI / 2;
  const spokes = new THREE.Mesh(mergeGeometries([0, 1, 2, 3].map((i) => {
    const c = new THREE.CylinderGeometry(s * 0.035, s * 0.035, s * 2, 6);
    c.rotateZ((i * Math.PI) / 4 + Math.PI / 4);
    return c;
  }))!, m);
  const lights = new THREE.Mesh(new THREE.TorusGeometry(s * 1.01, s * 0.03, 6, 48), lamp(2.5, 2.2, 1.4));
  const panels = new THREE.Mesh(new THREE.BoxGeometry(s * 2.6, s * 0.02, s * 0.5), new THREE.MeshStandardMaterial({ color: 0x223a7a, metalness: 0.4, roughness: 0.3, emissive: 0x0a1430 }));
  panels.position.z = s * 0.5;
  body.add(ring, hub, spokes, lights, panels);
  g.add(body);
  return { obj: g, update: (t) => (body.rotation.z = t * 0.3), dispose: () => disposeAll(g) };
}

export function telescope(R: number): Part {
  const g = new THREE.Group();
  const s = Math.max(0.35, R * 0.25);
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) { const x = (i / 12) * s; pts.push(new THREE.Vector2(x, (x * x) / s * 0.5)); }
  const dish = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), new THREE.MeshStandardMaterial({ color: 0xf2f4f8, metalness: 0.8, roughness: 0.15, side: THREE.DoubleSide }));
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.03, s * 0.03, s * 0.8, 6), metal());
  arm.position.y = s * 0.4;
  const eye = new THREE.Mesh(new THREE.SphereGeometry(s * 0.07, 10, 8), lamp(0.6, 1.4, 2.5));
  eye.position.y = s * 0.8;
  const back = new THREE.Mesh(new THREE.BoxGeometry(s * 0.4, s * 0.2, s * 0.4), metal(0x9aa3b0));
  back.position.y = -s * 0.1;
  g.add(dish, arm, eye, back);
  return { obj: g, dispose: () => disposeAll(g) };
}

/** A thread from the equator up to a counterweight station, with climbers going up and down. */
export function elevator(R: number): Part {
  const g = new THREE.Group();
  const len = R * 2.4;
  const thread = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.008, R * 0.008, len, 6), lamp(0.6, 1.6, 2.2));
  thread.rotation.z = Math.PI / 2;
  thread.position.x = R + len / 2;
  const top = new THREE.Mesh(new THREE.BoxGeometry(R * 0.12, R * 0.12, R * 0.12), metal());
  top.position.x = R + len;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.04, R * 0.07, R * 0.05, 12), metal());
  base.rotation.z = -Math.PI / 2;
  base.position.x = R;
  g.add(thread, top, base);
  const climbers: THREE.Mesh[] = [];
  const cm = lamp(2.4, 2.0, 1.2);
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(R * 0.02, 6, 4), cm);
    g.add(c);
    climbers.push(c);
  }
  return {
    obj: g,
    update(t) { climbers.forEach((c, i) => { const f = (Math.sin(t * 0.2 + i * 2.1) + 1) / 2; c.position.x = R + f * len; }); },
    dispose: () => disposeAll(g),
  };
}

export function domes(R: number, seed: number): Part {
  const r = rng(seed);
  const geos: THREE.BufferGeometry[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 7; i++) {
    const dir = new THREE.Vector3(r() - 0.5, (r() - 0.5) * 1.2, r() - 0.5).normalize();
    const hs = R * (0.04 + r() * 0.04);
    const h = new THREE.SphereGeometry(hs, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    h.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir));
    h.translate(dir.x * R * 0.995, dir.y * R * 0.995, dir.z * R * 0.995);
    geos.push(h);
  }
  const geo = mergeGeometries(geos)!;
  geos.forEach((x) => x.dispose());
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xbfe8ff, metalness: 0.1, roughness: 0.05, emissive: new THREE.Color(0.9, 0.7, 0.35), emissiveIntensity: 0.8, transparent: true, opacity: 0.85 }));
  return { obj: mesh, dispose: () => disposeAll(mesh) };
}

export function terraformer(R: number, time: { value: number }): Part {
  const g = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.015, R * 0.04, R * 0.14, 8), metal(0xb8c4b0));
  tower.position.y = R * 1.05;
  const beamMat = glowMaterial(new THREE.Color(0.3, 1.0, 0.45), 1.0, 1.4, time);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.012, R * 0.03, R * 0.5, 8, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.0, 0.6), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  beam.position.y = R * 1.35;
  beamMat.dispose();
  g.add(tower, beam);
  g.rotation.z = 0.7;
  g.rotation.x = 0.4;
  const bm = beam.material as THREE.MeshBasicMaterial;
  return { obj: g, update: (t) => (bm.opacity = 0.35 + 0.3 * Math.sin(t * 2.5)), dispose: () => disposeAll(g) };
}

export function orbitalRing(R: number, time: { value: number }): Part {
  const g = new THREE.Group();
  const band = new THREE.Mesh(new THREE.TorusGeometry(R * 1.28, R * 0.025, 8, 160), metal(0xc8cfd8));
  band.rotation.x = Math.PI / 2;
  const lightsMat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `uniform float uTime; varying vec2 vUv; void main(){ float d=step(0.6,fract(vUv.x*120.0-uTime*0.5)); gl_FragColor=vec4(vec3(1.6,1.9,2.4)*d,1.0); ${FINISH} }`,
    uniforms: { uTime: time },
  });
  const lights = new THREE.Mesh(new THREE.TorusGeometry(R * 1.28, R * 0.028, 4, 320), lightsMat);
  lights.rotation.x = Math.PI / 2;
  lights.scale.set(1, 1, 0.3);
  // spokes down to the ground
  const spokes = new THREE.Mesh(mergeGeometries([0, 1, 2, 3].map((i) => {
    const c = new THREE.CylinderGeometry(R * 0.006, R * 0.006, R * 0.28, 4);
    c.rotateZ(Math.PI / 2);
    c.translate(R * 1.14, 0, 0);
    c.rotateY((i * Math.PI) / 2);
    return c;
  }))!, metal());
  g.add(band, lights, spokes);
  return { obj: g, update: (t) => (g.rotation.y = t * 0.05), dispose: () => disposeAll(g) };
}

export function engine(R: number, time: { value: number }): Part {
  const g = new THREE.Group();
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.16, R * 0.3, R * 0.28, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x8a919c, metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide }));
  nozzle.position.y = -R * 1.05;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(R * 0.22, R * 0.04, 8, 32), metal(0x6c7480));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = -R * 0.93;
  const flameGeo = new THREE.ConeGeometry(R * 0.26, R * 3.2, 32, 8, true);
  flameGeo.translate(0, -R * 1.6, 0);
  flameGeo.rotateX(Math.PI);
  const flameMat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `varying vec3 vP; varying vec3 vN; varying vec3 vW;
void main(){ vP=position; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */ `uniform float uTime; uniform float uLen; varying vec3 vP; varying vec3 vN; varying vec3 vW;
${NOISE}
void main(){
  float along=clamp(-vP.y/uLen,0.0,1.0);
  vec3 V=normalize(cameraPosition-vW);
  float core=pow(abs(dot(normalize(vN),V)),1.5);
  float n=snoise(vec3(vP.x*3.0,vP.y*1.2+uTime*6.0,vP.z*3.0))*0.5+0.5;
  float g=core*pow(1.0-along,1.3)*(0.6+0.6*n);
  vec3 col=mix(vec3(1.6,1.9,2.6),vec3(0.2,0.5,2.2),smoothstep(0.0,0.5,along));
  gl_FragColor=vec4(col*g*1.6,1.0);
  ${FINISH}
}`,
    uniforms: { uTime: time, uLen: { value: R * 3.2 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.position.y = -R * 1.15;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), glowMaterial(new THREE.Color(0.4, 0.6, 1.4), 1.2, 2.5));
  glow.scale.setScalar(R * 0.7);
  glow.position.y = -R * 1.2;
  g.add(nozzle, collar, flame, glow);
  return { obj: g, update: (_t, cam) => glow.quaternion.copy(cam.quaternion).premultiply(g.getWorldQuaternion(new THREE.Quaternion()).invert()), dispose: () => disposeAll(g) };
}

/** Warm lights in a cluster on a moon (the moon base). */
export function baseLights(time: { value: number }, r: number, pixelRatio: number): Part {
  const n = 14;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
  const rr = rng(r * 99);
  const c = new THREE.Vector3(1, 0.3, 0.2).normalize();
  for (let i = 0; i < n; i++) {
    const d = c.clone().add(new THREE.Vector3(rr() - 0.5, rr() - 0.5, rr() - 0.5).multiplyScalar(0.5)).normalize().multiplyScalar(r * 1.01);
    pos.set([d.x, d.y, d.z], i * 3);
    col.set([2.4, 1.7, 0.9], i * 3);
    size[i] = 1.5 + rr() * 1.5;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `attribute float size; attribute vec3 color; uniform float uScale; varying vec3 vC;
void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*uScale; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `varying vec3 vC; void main(){ vec2 c=gl_PointCoord*2.0-1.0; float r=dot(c,c); if(r>1.0) discard; gl_FragColor=vec4(vC*exp(-r*3.0),1.0); ${FINISH} }`,
    uniforms: { uScale: { value: pixelRatio }, uTime: time },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  return { obj: pts, dispose: () => { geo.dispose(); mat.dispose(); } };
}
