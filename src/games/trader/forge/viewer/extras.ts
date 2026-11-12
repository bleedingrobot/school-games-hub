/** The whole-system pieces: sky, stars, asteroid belt, comets, trade lanes and other big technology, the Goldilocks zone. */
import * as THREE from 'three';
import type { BeltKind, SystemDesign } from '../../../../../shared/trader/system';
import { FINISH, LIGHTS, NOISE } from './glsl';
import type { LevelSettings } from './levels';
import { asPlan, skyMaterial, twinkleMaterial, type Shared } from './materials';
import { beltRadius, beltWidth, orbitRadius, sunExtent, systemRadius, zoneBand } from './orbits';
import { metal, orbiters, rng, type Part } from './parts';
import type { PlanetObject } from './planet';

export const SKY_R = 9000;

let dot: THREE.Texture | null = null;
/** A soft round dot for little lights drawn as points. */
function dotTexture(): THREE.Texture {
  if (dot) return dot;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  dot = new THREE.CanvasTexture(c);
  return dot;
}

export function sky(map: THREE.Texture, s: LevelSettings, time: { value: number }, background: number): Part {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(SKY_R, 64, 32);
  const mat = skyMaterial(map, 1.0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  g.add(mesh);
  // bright stars as points, so they stay sharp
  const n = s.stars;
  const r = rng(background * 17 + 3);
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, th = r() * Math.PI * 2, rad = Math.sqrt(1 - u * u);
    pos.set([Math.cos(th) * rad * SKY_R * 0.9, u * SKY_R * 0.9, Math.sin(th) * rad * SKY_R * 0.9], i * 3);
    const bright = Math.pow(r(), 6);
    c.setHSL(r() < 0.5 ? 0.6 : 0.08, 0.2 + r() * 0.5, 0.75).multiplyScalar(0.35 + bright * 2.4);
    col.set([c.r, c.g, c.b], i * 3);
    size[i] = 1.2 + bright * 4.5;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  sg.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const sm = twinkleMaterial(time, s.pixelRatio);
  const stars = new THREE.Points(sg, sm);
  stars.frustumCulled = false;
  stars.renderOrder = -9;
  g.add(stars);
  return {
    obj: g,
    update: (_t, cam) => g.position.copy((cam as THREE.PerspectiveCamera).position),
    dispose: () => { geo.dispose(); mat.dispose(); sg.dispose(); sm.dispose(); },
  };
}

const BELT_COL: Record<BeltKind, [THREE.Color, THREE.Color]> = {
  rocky: [new THREE.Color(0.42, 0.36, 0.3), new THREE.Color(0.25, 0.22, 0.2)],
  icy: [new THREE.Color(0.85, 0.92, 1.0), new THREE.Color(0.5, 0.62, 0.75)],
  golden: [new THREE.Color(1.0, 0.75, 0.3), new THREE.Color(0.55, 0.4, 0.2)],
};

/** Thousands of tumbling rocks in one draw: each rock's orbit and spin worked out on the GPU. */
export function belt(shared: Shared, d: SystemDesign, s: LevelSettings, planned: boolean): Part & { radius: number } {
  const kind = d.belt!.kind;
  const R = beltRadius(d);
  const W = beltWidth(d);
  const n = s.asteroids;
  const geo = new THREE.IcosahedronGeometry(1, s.level === 'incredible' ? 1 : 0);
  const p = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(0.75 + 0.5 * Math.abs(Math.sin(v.x * 5.1 + v.y * 3.7) * Math.cos(v.z * 4.3)));
    p.setXYZ(i, v.x, v.y * 0.75, v.z);
  }
  geo.computeVertexNormals();
  const inst = new THREE.InstancedBufferGeometry();
  inst.index = geo.index;
  inst.setAttribute('position', geo.attributes.position);
  inst.setAttribute('normal', geo.attributes.normal);
  const orbit = new Float32Array(n * 4), spinA = new Float32Array(n * 4);
  const r = rng(R * 3 + 7);
  for (let i = 0; i < n; i++) {
    const g = (r() + r() + r()) / 3 - 0.5;
    const rad = R + g * W * 2;
    const big = Math.pow(r(), 9);
    orbit.set([rad, r() * Math.PI * 2, (r() - 0.5) * 2.2 * (1 - Math.abs(g)), 0.022 + big * 0.28 + r() * 0.035], i * 4);
    spinA.set([r() - 0.5, r() - 0.5, r() - 0.5, 0.3 + r() * 1.5], i * 4);
  }
  inst.setAttribute('aOrbit', new THREE.InstancedBufferAttribute(orbit, 4));
  inst.setAttribute('aSpin', new THREE.InstancedBufferAttribute(spinA, 4));
  inst.instanceCount = n;
  const [c1, c2] = BELT_COL[kind];
  const mat = new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `attribute vec4 aOrbit; attribute vec4 aSpin; uniform float uTime; uniform float uW;
varying vec3 vN; varying vec3 vW; varying float vShade;
mat3 rotA(vec3 ax,float a){ ax=normalize(ax); float c=cos(a),s=sin(a),t=1.0-c;
  return mat3(t*ax.x*ax.x+c,t*ax.x*ax.y+s*ax.z,t*ax.x*ax.z-s*ax.y, t*ax.x*ax.y-s*ax.z,t*ax.y*ax.y+c,t*ax.y*ax.z+s*ax.x, t*ax.x*ax.z+s*ax.y,t*ax.y*ax.z-s*ax.x,t*ax.z*ax.z+c); }
void main(){
  mat3 m=rotA(aSpin.xyz+0.01,uTime*aSpin.w);
  float an=aOrbit.y+uTime*uW*pow(aOrbit.x/60.0,-1.5);
  vec3 c=vec3(cos(an)*aOrbit.x,aOrbit.z,sin(an)*aOrbit.x);
  vec3 p=m*position*aOrbit.w+c;
  vN=normalize(m*normal); vW=p; vShade=fract(aSpin.w*7.3);
  gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);
}`,
        fragmentShader: /* glsl */ `uniform vec3 uC1; uniform vec3 uC2; uniform float uGlint; varying vec3 vN; varying vec3 vW; varying float vShade;
${LIGHTS}
void main(){
  vec3 alb=mix(uC2,uC1,vShade);
  vec3 col=alb*uAmbient*3.0;
  vec3 V=normalize(cameraPosition-vW);
  for(int i=0;i<2;i++){ if(i>=uLightCount) break; vec3 L=normalize(uLightPos[i]-vW);
    col+=alb*lightAt(i,vW)*max(dot(vN,L),0.0);
    col+=lightAt(i,vW)*pow(max(dot(normalize(L+V),vN),1e-6),40.0)*uGlint; }
  gl_FragColor=vec4(col,1.0);
  ${FINISH}
}`,
        uniforms: { ...shared, uC1: { value: c1 }, uC2: { value: c2 }, uW: { value: 0.12 }, uGlint: { value: kind === 'golden' ? 1.6 : kind === 'icy' ? 0.8 : 0.1 } },
      });
  if (planned) inst.instanceCount = Math.min(n, 1500);
  const mesh = new THREE.Mesh(inst, mat);
  mesh.frustumCulled = false;
  const g = new THREE.Group();
  g.add(mesh);
  // a faint dusty glow along the belt
  const dustGeo = new THREE.RingGeometry(R - W * 1.6, R + W * 1.6, 256, 1);
  dustGeo.rotateX(-Math.PI / 2);
  const dustMat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `uniform vec3 uC; uniform float uR; uniform float uW; varying vec3 vP;
${NOISE}
void main(){ float r=length(vP.xz); float x=(r-uR)/uW; float f=exp(-x*x*3.0); float a=atan(vP.z,vP.x+1e-6);
  float n=snoise(vec3(cos(a)*8.0,sin(a)*8.0,r*0.15))*0.5+0.5;
  gl_FragColor=vec4(uC*f*(0.4+0.6*n)*0.05,1.0); ${FINISH} }`,
    uniforms: { uC: { value: c1.clone() }, uR: { value: R }, uW: { value: W } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const dust = new THREE.Mesh(dustGeo, dustMat);
  g.add(dust);
  // a planned belt keeps its own rock colours, faded with the scan (12 Nov 2026)
  if (planned) asPlan(g, shared.uTime);
  return { obj: g, radius: R, dispose: () => { geo.dispose(); inst.dispose(); mat.dispose(); dustGeo.dispose(); dustMat.dispose(); } };
}

/** Comets on long loops, each with a dust tail and a blue gas tail pointing away from the sun. */
export function comets(shared: Shared, d: SystemDesign, s: LevelSettings, planned: boolean): Part {
  const g = new THREE.Group();
  const count = d.comets!.count;
  const sys = systemRadius(d);
  const list: { head: THREE.Mesh; tails: THREE.Points; a: number; e: number; w: number; ph: number; incl: number; node: number; away: THREE.Vector3 }[] = [];
  const disposables: { dispose(): void }[] = [];
  const headGeo = new THREE.SphereGeometry(0.35, 12, 8);
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2.6, 2.8) });
  disposables.push(headGeo, headMat);
  const per = Math.round(1400 * s.particles);
  for (let i = 0; i < count; i++) {
    const seed = new Float32Array(per * 4);
    const r = rng(i * 13 + 2);
    for (let k = 0; k < per; k++) seed.set([r(), r() * Math.PI * 2, Math.sqrt(r()), k % 3 === 0 ? 1 : 0], k * 4);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(per * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const away = new THREE.Vector3(1, 0, 0);
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `attribute vec4 aSeed; uniform float uTime; uniform vec3 uAway; uniform float uLen; uniform float uScale; varying float vA; varying float vIon;
void main(){
  float t=fract(uTime*0.12+aSeed.x);
  vec3 side=normalize(cross(uAway,vec3(0.0,1.0,0.0)));
  vec3 up=cross(side,uAway);
  float ion=aSeed.w;
  float spread=aSeed.z*(ion>0.5?0.15+t*0.5:0.3+t*2.4);
  vec3 bend=ion>0.5?vec3(0.0):side*t*t*uLen*0.25;
  vec3 p=uAway*t*uLen*(ion>0.5?1.3:1.0)+(side*cos(aSeed.y)+up*sin(aSeed.y))*spread+bend;
  vA=pow(1.0-t,1.5)*smoothstep(0.0,0.03,t); vIon=ion;
  vec4 mv=modelViewMatrix*vec4(p,1.0);
  gl_PointSize=clamp(3.0*uScale*(40.0/-mv.z)*(1.0+t),1.0,28.0);
  gl_Position=projectionMatrix*mv;
}`,
      fragmentShader: /* glsl */ `varying float vA; varying float vIon;
void main(){ vec2 c=gl_PointCoord*2.0-1.0; float r=dot(c,c); if(r>1.0) discard;
  vec3 col=vIon>0.5?vec3(0.35,0.65,1.6):vec3(1.3,1.15,0.9); gl_FragColor=vec4(col*exp(-r*3.0)*vA*0.6,1.0); ${FINISH} }`,
      uniforms: { uTime: shared.uTime, uAway: { value: away }, uLen: { value: 18 }, uScale: { value: s.pixelRatio } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    disposables.push(geo, mat);
    const tails = new THREE.Points(geo, mat);
    tails.frustumCulled = false;
    const head = new THREE.Mesh(headGeo, headMat);
    head.add(tails);
    g.add(head);
    list.push({ head, tails, a: sys * (0.55 + i * 0.12), e: 0.75 - i * 0.08, w: 0.05 / (1 + i * 0.4), ph: i * 2.1, incl: 0.25 + i * 0.3, node: i * 1.9, away });
  }
  if (planned) asPlan(g, shared.uTime); // planned comets keep their white heads and tails, faded with the scan
  const sun = new THREE.Vector3();
  return {
    obj: g,
    update(t) {
      sun.copy(shared.uLightPos.value[0]);
      for (const c of list) {
        // a crude Kepler loop: faster near the sun
        const M = c.ph + t * c.w;
        let E = M;
        for (let k = 0; k < 5; k++) E = M + c.e * Math.sin(E);
        const x = c.a * (Math.cos(E) - c.e), z = c.a * Math.sqrt(1 - c.e * c.e) * Math.sin(E);
        const y = z * Math.sin(c.incl);
        const zz = z * Math.cos(c.incl);
        const cn = Math.cos(c.node), sn = Math.sin(c.node);
        c.head.position.set(x * cn + zz * sn, y, -x * sn + zz * cn);
        c.away.copy(c.head.position).sub(sun);
        const dist = c.away.length();
        c.away.normalize();
        (c.tails.material as THREE.ShaderMaterial).uniforms.uLen.value = THREE.MathUtils.clamp(900 / dist, 4, 40);
      }
    },
    dispose: () => disposables.forEach((x) => x.dispose()),
  };
}

/** The soft green "just right" band on the orbit plane (Forge view only). */
export function zone(d: SystemDesign): Part | null {
  const z = zoneBand(d);
  if (!z) return null;
  const geo = new THREE.RingGeometry(z[0], z[1], 256, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `uniform vec2 uR; varying vec3 vP; void main(){ float r=length(vP.xz); float x=(r-uR.x)/(uR.y-uR.x);
  float f=smoothstep(0.0,0.25,x)*smoothstep(1.0,0.75,x); float edge=exp(-(x-0.02)*(x-0.02)*1600.0)+exp(-(x-0.98)*(x-0.98)*1600.0);
  gl_FragColor=vec4(vec3(0.2,0.9,0.45)*(f*0.05+edge*0.12),1.0); ${FINISH} }`,
    uniforms: { uR: { value: new THREE.Vector2(z[0], z[1]) } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  return { obj: mesh, dispose: () => { geo.dispose(); mat.dispose(); } };
}

/** Faint circles where each planet goes round. */
export function orbitLines(d: SystemDesign, plans: boolean): Part {
  const g = new THREE.Group();
  const mats: THREE.Material[] = [];
  const geos: THREE.BufferGeometry[] = [];
  d.planets.forEach((p, slot) => {
    if (p.kind === 'ringworld' || (!p.built && !plans)) return;
    const r = orbitRadius(slot, d);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 256; i++) { const a = (i / 256) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: p.built ? new THREE.Color(0.35, 0.45, 0.7) : new THREE.Color(0.25, 0.6, 1.0), transparent: true, opacity: plans ? 0.28 : 0.12, depthWrite: false, blending: THREE.AdditiveBlending });
    geos.push(geo); mats.push(mat);
    g.add(new THREE.Line(geo, mat));
  });
  return { obj: g, dispose: () => { geos.forEach((x) => x.dispose()); mats.forEach((x) => x.dispose()); } };
}

/** System technology: trade lanes, solar sails, miners, the star gate and the Dyson ring. */
export function systemTech(shared: Shared, d: SystemDesign, s: LevelSettings, plans: boolean, planets: () => PlanetObject[]): Part {
  const g = new THREE.Group();
  const parts: Part[] = [];
  const time = shared.uTime;
  const show = (k: string) => d.tech.find((t) => t.kind === k && (t.built || plans));
  const planned = (k: string) => !d.tech.find((t) => t.kind === k)?.built;
  const holo = (o: THREE.Object3D, k: string) => {
    if (!planned(k)) return;
    asPlan(o, time); // its own shape and colours, faded with the scan (12 Nov 2026)
  };
  const sunR = sunExtent(d.sun?.kind);

  if (show('lanes')) {
    const SEG = 48;
    const maxLanes = 8;
    const pos = new Float32Array(maxLanes * SEG * 2 * 3);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.4, 1.2, 1.6), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    lines.frustumCulled = false;
    const SHIPS = 3;
    const shipPos = new Float32Array(maxLanes * SHIPS * 3);
    const shipGeo = new THREE.BufferGeometry();
    shipGeo.setAttribute('position', new THREE.BufferAttribute(shipPos, 3));
    const shipMat = new THREE.PointsMaterial({ map: dotTexture(), color: new THREE.Color(2.2, 2.0, 1.4), size: 4 * s.pixelRatio, sizeAttenuation: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const ships = new THREE.Points(shipGeo, shipMat);
    ships.frustumCulled = false;
    g.add(lines, ships);
    holo(lines, 'lanes');
    holo(ships, 'lanes');
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), q = new THREE.Vector3();
    const bez = (t: number, out: THREE.Vector3) => out.copy(a).multiplyScalar((1 - t) * (1 - t)).addScaledVector(c, 2 * t * (1 - t)).addScaledVector(b, t * t);
    parts.push({
      obj: new THREE.Object3D(),
      update(t) {
        const ps = planets().filter((p) => !p.band);
        let li = 0;
        for (; li < Math.min(maxLanes, ps.length - 1); li++) {
          a.copy(ps[li].pos); b.copy(ps[li + 1].pos);
          c.copy(a).add(b).multiplyScalar(0.5);
          c.y += a.distanceTo(b) * 0.18;
          for (let k = 0; k < SEG; k++) {
            bez(k / SEG, q); pos.set([q.x, q.y, q.z], (li * SEG * 2 + k * 2) * 3);
            bez((k + 1) / SEG, q); pos.set([q.x, q.y, q.z], (li * SEG * 2 + k * 2 + 1) * 3);
          }
          for (let k = 0; k < SHIPS; k++) {
            const f = (t * 0.06 + k / SHIPS + li * 0.13) % 1;
            bez(k % 2 ? f : 1 - f, q);
            shipPos.set([q.x, q.y, q.z], (li * SHIPS + k) * 3);
          }
        }
        lineGeo.setDrawRange(0, li * SEG * 2);
        shipGeo.setDrawRange(0, li * SHIPS);
        lineGeo.attributes.position.needsUpdate = true;
        shipGeo.attributes.position.needsUpdate = true;
      },
      dispose: () => { lineGeo.dispose(); lineMat.dispose(); shipGeo.dispose(); shipMat.dispose(); },
    });
  }

  if (show('sails')) {
    const sail = new THREE.Group();
    const geo = new THREE.PlaneGeometry(1.6, 1.6);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffe2a0, metalness: 0.95, roughness: 0.12, side: THREE.DoubleSide, emissive: 0x2a1a05 });
    const mesh = new THREE.InstancedMesh(geo, mat, 6);
    mesh.frustumCulled = false;
    sail.add(mesh);
    if (planned('sails')) holo(sail, 'sails');
    g.add(sail);
    const r0 = orbitRadius(1, d) + 4;
    const m = new THREE.Matrix4(), qq = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), e = new THREE.Euler();
    parts.push({
      obj: new THREE.Object3D(),
      update(t) {
        for (let i = 0; i < 6; i++) {
          const an = i * 1.05 + t * 0.03 * (1 + i * 0.1);
          const rr = r0 + i * 9;
          p.set(Math.cos(an) * rr, Math.sin(i * 2.3) * 3, Math.sin(an) * rr);
          e.set(0.6, -an, 0.785);
          qq.setFromEuler(e);
          m.compose(p, qq, sc);
          mesh.setMatrixAt(i, m);
        }
        mesh.instanceMatrix.needsUpdate = true;
      },
      dispose: () => { geo.dispose(); mat.dispose(); mesh.dispose(); },
    });
  }

  if (show('miners') && d.belt) {
    const R = beltRadius(d);
    const r = rng(5);
    const orbits: number[][] = [];
    for (let i = 0; i < 40; i++) orbits.push([R + (r() - 0.5) * beltWidth(d) * 2, (r() - 0.5) * 0.08, r() * 6.28, 0.02 + r() * 0.03, 0]);
    const part = orbiters(time, orbits, new THREE.Color(2.4, 1.4, 0.5), 3.5, s.pixelRatio);
    holo(part.obj, 'miners');
    g.add(part.obj);
    parts.push(part);
  }

  if (show('gate')) {
    const gate = new THREE.Group();
    const R = 7;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.7, 16, 96), metal(0xaab2c0));
    const lights = new THREE.Mesh(new THREE.TorusGeometry(R + 0.05, 0.25, 8, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.4, 2.6) }));
    lights.scale.set(1, 1, 3.2);
    const chev: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) { const b = new THREE.BoxGeometry(0.7, 1.6, 1.6); b.translate(0, R + 0.3, 0); b.rotateZ((i / 9) * Math.PI * 2); chev.push(b); }
    const chevrons = new THREE.Mesh(chev.reduce((acc, x) => { acc.push(x); return acc; }, [] as THREE.BufferGeometry[])[0], metal(0x7a8290));
    chev.slice(1).forEach((x) => { const m = new THREE.Mesh(x, chevrons.material); gate.add(m); });
    const portalMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv=uv*2.0-1.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `uniform float uTime; varying vec2 vUv;
${NOISE}
void main(){ float r=length(vUv); if(r>1.0) discard; float a=atan(vUv.y,vUv.x+1e-6);
  float sw=a+3.0/(r+0.25)-uTime*1.2;
  float n=snoise(vec3(cos(sw)*2.0*r,sin(sw)*2.0*r,uTime*0.2+r*2.0))*0.5+0.5;
  float n2=snoise(vec3(cos(sw*2.0)*3.0,sin(sw*2.0)*3.0,uTime*0.3))*0.5+0.5;
  vec3 col=mix(vec3(0.1,0.3,1.2),vec3(0.6,1.4,2.4),n)+vec3(1.4,0.6,2.0)*pow(max(n2,1e-6),4.0);
  float f=smoothstep(1.0,0.75,r)*0.9+0.6*exp(-r*4.0);
  gl_FragColor=vec4(col*f*(0.6+n*0.8),1.0); ${FINISH} }`,
      uniforms: { uTime: time },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const portal = new THREE.Mesh(new THREE.CircleGeometry(R - 0.4, 96), portalMat);
    gate.add(ring, lights, chevrons, portal);
    if (planned('gate')) holo(gate, 'gate');
    const far = systemRadius(d) + 14;
    gate.position.set(Math.cos(2.2) * far, 6, Math.sin(2.2) * far);
    gate.lookAt(0, 0, 0);
    g.add(gate);
    parts.push({ obj: new THREE.Object3D(), update: (t) => (ring.rotation.z = t * 0.05), dispose: () => gate.traverse((x) => { const m = x as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material)?.dispose?.(); }) });
  }

  if (show('dyson')) {
    const ring = new THREE.Group();
    const R = sunR * 1.9 + 3;
    const n = s.level === 'simple' ? 48 : 120;
    const geo = new THREE.BoxGeometry(1, 1, 0.08);
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a2a55, metalness: 0.7, roughness: 0.25, emissive: new THREE.Color(0.25, 0.35, 0.9), emissiveIntensity: 0.25 });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    const circ = (2 * Math.PI * R) / n;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      p.set(Math.cos(a) * R, 0, Math.sin(a) * R);
      q.setFromEuler(new THREE.Euler(0, -a + Math.PI / 2, 0));
      sc.set(circ * 0.92, 2.6, 1);
      m.compose(p, q, sc);
      mesh.setMatrixAt(i, m);
    }
    mesh.frustumCulled = false;
    const frame = new THREE.Mesh(new THREE.TorusGeometry(R, 0.08, 6, 256), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.2, 0.6) }));
    frame.rotation.x = Math.PI / 2;
    const frame2 = frame.clone();
    frame.position.y = 1.4;
    frame2.position.y = -1.4;
    ring.add(mesh, frame, frame2);
    ring.rotation.x = 0.12;
    if (planned('dyson')) holo(ring, 'dyson');
    g.add(ring);
    parts.push({ obj: new THREE.Object3D(), update: (t) => (ring.rotation.y = t * 0.03), dispose: () => { geo.dispose(); mat.dispose(); mesh.dispose(); frame.geometry.dispose(); (frame.material as THREE.Material).dispose(); } });
  }

  return {
    obj: g,
    update: (t, cam) => parts.forEach((p) => p.update?.(t, cam)),
    dispose: () => parts.forEach((p) => p.dispose()),
  };
}
