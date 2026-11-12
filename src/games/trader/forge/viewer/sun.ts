/** The sun at the middle, by kind: boiling surface, corona and glare, and each kind's special look. */
import * as THREE from 'three';
import type { SunKind } from '../../../../../shared/trader/system';
import { SUNS } from '../../../../../shared/trader/system';
import { FINISH, NOISE } from './glsl';
import { SUN_LOOK } from '../looks';
import { glowMaterial, hologramMaterial, twinkleMaterial } from './materials';
import { SUN_SCALE, SUN_SIZE } from './orbits';
import type { LevelSettings } from './levels';

export interface SunObject {
  group: THREE.Group;
  /** World positions and colours of the light-giving stars (one, or two for a binary). */
  lights: { pos: THREE.Vector3; col: THREE.Color }[];
  radius: number;
  /** What a tap hits. */
  pick: THREE.Object3D;
  /** The black hole, for the bending pass. */
  hole: { pos: THREE.Vector3; radius: number } | null;
  /** The pulsar's beam direction (world), when it has one. */
  beam: THREE.Vector3 | null;
  update(time: number, camera: THREE.Camera): void;
  dispose(): void;
}

const WORLD_VERT = /* glsl */ `
varying vec3 vObj; varying vec3 vWorld; varying vec3 vNrm; varying vec2 vUv;
void main(){ vObj=position; vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vWorld=w.xyz; vNrm=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }
`;

const SUN_FRAG = /* glsl */ `
uniform vec3 uCol1; uniform vec3 uCol2; uniform vec3 uCol3; uniform float uIntensity; uniform float uSpots; uniform float uTime; uniform int uOct;
uniform sampler2D uMap; uniform float uPainted;
varying vec3 vObj; varying vec3 vWorld; varying vec3 vNrm; varying vec2 vUv;
${NOISE}
void main(){
  vec3 d=normalize(vObj);
  float t=uTime*0.035;
  vec3 q=d*2.4;
  float w=fbm(q+vec3(t,-t,t*0.6),3);
  float n=fbm(q*2.1+w*1.6+vec3(0.0,t*2.0,0.0),uOct);
  float gran=snoise(d*30.0+vec3(uTime*0.15,0.0,-uTime*0.1))*0.5+0.5;
  float heat=0.5+0.4*n+0.18*gran;
  float s=smoothstep(0.32,0.5,fbm(d*1.6+11.0+vec3(t*0.3),3))*uSpots;
  heat*=1.0-s*0.8;
  vec3 col=mix(uCol2,uCol1,clamp(heat,0.0,1.0))+uCol3*pow(clamp(heat,0.0,1.0),5.0)*0.8;
  if(uPainted>0.5){
    vec2 uv=vUv+vec2(w*0.01,n*0.01);
    col=pow(texture2D(uMap,uv).rgb,vec3(2.2))*(0.8+0.4*heat);
  }
  vec3 N=normalize(vNrm); vec3 V=normalize(cameraPosition-vWorld);
  float mu=max(dot(N,V),0.0);
  col*=0.4+0.6*pow(max(mu,1e-4),0.45);
  col=mix(uCol2*0.9,col,smoothstep(0.0,0.35,mu));
  gl_FragColor=vec4(col*uIntensity,1.0);
  ${FINISH}
}
`;

const CORONA_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uIntensity; uniform float uTime; uniform float uDisc; uniform float uRays; uniform float uFlare; uniform float uStreak;
varying vec2 vUv;
${NOISE}
void main(){
  float r=length(vUv);
  if(r>1.0) discard;
  float a=atan(vUv.y,vUv.x+1e-6);
  vec2 c=vec2(cos(a),sin(a));
  float rays=snoise(vec3(c*3.0,uTime*0.05))*0.5+0.5;
  rays=rays*0.6+0.4*(snoise(vec3(c*9.0,uTime*0.09+r*1.5))*0.5+0.5);
  float x=max(r-uDisc,0.0)/(1.0-uDisc);
  float fall=pow(uDisc/max(r,uDisc),2.6);
  float burst=pow(max(sin(uTime*0.21+snoise(vec3(c*2.0,floor(uTime*0.07)))*3.0),1e-6),40.0)*uFlare;
  float streamer=pow(max(rays,1e-6),3.0)*uRays*exp(-x*2.5);
  float g=fall*(0.7+0.6*rays)+streamer*0.8+burst*exp(-x*6.0)*rays;
  g*=1.0-smoothstep(0.6,1.0,r);
  float s=uStreak*exp(-abs(vUv.y)*70.0)*pow(max(1.0-abs(vUv.x),1e-6),3.0);
  gl_FragColor=vec4(uColor*(g+s)*uIntensity,1.0);
  ${FINISH}
}
`;

const BILLBOARD_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv=uv*2.0-1.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
`;

interface Look { c1: [number, number, number]; c2: [number, number, number]; c3: [number, number, number]; intensity: number; spots: number; corona: number; rays: number; flare: number; glow: [number, number, number] }
const LOOKS: Record<string, Look> = {
  yellow: { c1: [1.0, 0.82, 0.48], c2: [1.0, 0.42, 0.08], c3: [1, 1, 0.9], intensity: 3.2, spots: 0.25, corona: 6, rays: 0.6, flare: 0.6, glow: [1.0, 0.7, 0.35] },
  red: { c1: [1.0, 0.42, 0.15], c2: [0.55, 0.06, 0.02], c3: [1, 0.7, 0.4], intensity: 2.4, spots: 1, corona: 4.5, rays: 0.25, flare: 1, glow: [1.0, 0.3, 0.1] },
  blue: { c1: [0.72, 0.84, 1.0], c2: [0.3, 0.45, 1.0], c3: [1, 1, 1], intensity: 4.2, spots: 0, corona: 7.5, rays: 1.4, flare: 0.4, glow: [0.45, 0.6, 1.0] },
  white: { c1: [0.95, 0.97, 1.0], c2: [0.65, 0.78, 1.0], c3: [1, 1, 1], intensity: 7, spots: 0, corona: 9, rays: 0.4, flare: 0.2, glow: [0.75, 0.85, 1.0] },
  pulsar: { c1: [0.8, 0.9, 1.0], c2: [0.4, 0.6, 1.0], c3: [1, 1, 1], intensity: 8, spots: 0, corona: 8, rays: 0.2, flare: 0, glow: [0.5, 0.7, 1.0] },
  binaryA: { c1: [1.0, 0.8, 0.45], c2: [1.0, 0.38, 0.06], c3: [1, 1, 0.9], intensity: 3.2, spots: 0.3, corona: 5.5, rays: 0.6, flare: 0.6, glow: [1.0, 0.65, 0.3] },
  binaryB: { c1: [0.85, 0.9, 1.0], c2: [0.55, 0.65, 1.0], c3: [1, 1, 1], intensity: 4, spots: 0, corona: 5.5, rays: 0.6, flare: 0.3, glow: [0.6, 0.75, 1.0] },
  baby: { c1: [1.0, 0.76, 0.45], c2: [0.95, 0.35, 0.08], c3: [1, 0.95, 0.8], intensity: 3.0, spots: 0.15, corona: 6, rays: 0.9, flare: 0.8, glow: [1.0, 0.55, 0.3] },
};

const v3 = (a: [number, number, number]) => new THREE.Vector3(...a);

export function buildSun(kind: SunKind | null, built: boolean, s: LevelSettings, time: { value: number }, sphere: THREE.BufferGeometry, paint: THREE.Texture | null): SunObject {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const quad = new THREE.PlaneGeometry(2, 2);
  disposables.push(quad);
  const billboards: THREE.Object3D[] = [];
  const updaters: ((t: number, cam: THREE.Camera) => void)[] = [];
  const lightCol = new THREE.Color(kind ? SUNS[kind].light : 0xffffff);
  const lights: SunObject['lights'] = [{ pos: new THREE.Vector3(), col: lightCol.clone() }];
  let hole: SunObject['hole'] = null;
  let beam: THREE.Vector3 | null = null;
  const radius = kind ? SUN_SIZE[kind].radius : 3;

  const star = (lookName: string, r: number): THREE.Group => {
    const look = LOOKS[lookName];
    const g = new THREE.Group();
    const mat = new THREE.ShaderMaterial({
      vertexShader: WORLD_VERT,
      fragmentShader: SUN_FRAG,
      uniforms: {
        uCol1: { value: v3(look.c1) }, uCol2: { value: v3(look.c2) }, uCol3: { value: v3(look.c3) }, uIntensity: { value: look.intensity },
        uSpots: { value: look.spots }, uTime: time, uOct: { value: s.level === 'simple' ? 3 : 5 }, uMap: { value: paint }, uPainted: { value: paint ? 1 : 0 },
      },
    });
    disposables.push(mat);
    const ball = new THREE.Mesh(sphere, mat);
    ball.scale.setScalar(r);
    g.add(ball);
    const glowCol = new THREE.Color(...look.glow);
    const corona = new THREE.Mesh(quad, new THREE.ShaderMaterial({
      vertexShader: BILLBOARD_VERT,
      fragmentShader: CORONA_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: glowCol }, uIntensity: { value: 1.15 }, uTime: time, uDisc: { value: 1 / (look.corona * 0.48) }, uRays: { value: look.rays }, uFlare: { value: look.flare }, uStreak: { value: s.level === 'incredible' ? 0.5 : 0.25 } },
    }));
    disposables.push(corona.material as THREE.Material);
    corona.scale.setScalar(r * look.corona * 0.48);
    g.add(corona);
    billboards.push(corona);
    const halo = new THREE.Mesh(quad, glowMaterial(glowCol.clone().multiplyScalar(0.6), 0.32, 3.5));
    disposables.push(halo.material as THREE.Material);
    halo.scale.setScalar(r * look.corona * 0.85);
    g.add(halo);
    billboards.push(halo);
    // Close up, the glare would hide the boiling surface: dim the glow and the surface as the camera comes near.
    const wp = new THREE.Vector3();
    const cu = corona.material as THREE.ShaderMaterial, hu = halo.material as THREE.ShaderMaterial;
    updaters.push((_t, cam) => {
      g.getWorldPosition(wp);
      const near = THREE.MathUtils.smoothstep(cam.position.distanceTo(wp) / (r * SUN_SCALE), 3, 16);
      mat.uniforms.uIntensity.value = look.intensity * (0.2 + 0.8 * near);
      cu.uniforms.uIntensity.value = 1.15 * (0.22 + 0.78 * near);
      hu.uniforms.uIntensity.value = 0.32 * (0.06 + 0.94 * near);
    });
    return g;
  };

  if (!kind) {
    // no sun chosen: a faint marker so the middle isn't empty
    const m = new THREE.Mesh(quad, glowMaterial(new THREE.Color(0.4, 0.6, 1), 0.4, 3));
    disposables.push(m.material as THREE.Material);
    m.scale.setScalar(6);
    group.add(m);
    billboards.push(m);
    lights[0].col.setRGB(0.6, 0.65, 0.75);
  } else if (!built) {
    const holo = new THREE.Mesh(sphere, hologramMaterial(time, 3, new THREE.Color(SUN_LOOK[kind].colour)));
    disposables.push(holo.material as THREE.Material);
    holo.scale.setScalar(radius);
    group.add(holo);
    // a soft glow in the sun's own colour, so a planned sun still reads as a star
    const halo = new THREE.Mesh(quad, glowMaterial(new THREE.Color(SUN_LOOK[kind].colour), 0.35, 3));
    disposables.push(halo.material as THREE.Material);
    halo.scale.setScalar(radius * 3);
    group.add(halo);
    billboards.push(halo);
    lights[0].col.multiplyScalar(0.6);
  } else if (kind === 'binary') {
    const a = star('binaryA', radius);
    const b = star('binaryB', radius * 0.7);
    group.add(a, b);
    lights[0].col.copy(new THREE.Color(0xffd9a8)).multiplyScalar(0.75);
    lights.push({ pos: new THREE.Vector3(), col: new THREE.Color(0xd8e4ff).multiplyScalar(0.55) });
    updaters.push((t) => {
      const ang = t * 0.35;
      const sep = radius * 1.9;
      a.position.set(Math.cos(ang) * sep * 0.42, 0, Math.sin(ang) * sep * 0.42);
      b.position.set(-Math.cos(ang) * sep * 0.6, 0, -Math.sin(ang) * sep * 0.6);
      lights[0].pos.copy(a.position);
      lights[1].pos.copy(b.position);
    });
  } else if (kind === 'blackhole') {
    const horizon = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0x000000 }));
    disposables.push(horizon.material as THREE.Material);
    horizon.scale.setScalar(radius);
    group.add(horizon);
    const inner = radius * 1.35, outer = radius * 6;
    const discGeo = new THREE.RingGeometry(inner, outer, s.level === 'simple' ? 96 : 256, 1);
    disposables.push(discGeo);
    const discMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
varying vec3 vLocal; varying vec3 vWorld; varying vec3 vTan;
void main(){ vLocal=position; vec4 w=modelMatrix*vec4(position,1.0); vWorld=w.xyz;
  vec2 t=normalize(vec2(-position.y,position.x)); vTan=normalize(mat3(modelMatrix)*vec3(t,0.0));
  gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */ `
uniform float uTime; uniform vec2 uRange;
varying vec3 vLocal; varying vec3 vWorld; varying vec3 vTan;
${NOISE}
void main(){
  float r=length(vLocal.xy); float a=atan(vLocal.y,vLocal.x+1e-6);
  float x=(r-uRange.x)/(uRange.y-uRange.x);
  float sp=1.6/pow(r/uRange.x,1.5);
  float ang=a+uTime*sp;
  vec3 q=vec3(cos(ang)*r*0.6,sin(ang)*r*0.6,r*0.9);
  float n=fbm(q,4)*0.5+0.5;
  float streaks=snoise(vec3(cos(ang)*2.0,sin(ang)*2.0,r*3.0))*0.5+0.5;
  // spiral arms winding in, so it reads as swirling even from far away
  float arms=0.55+0.45*sin(a*3.0+log(max(r/uRange.x,1e-3))*7.0-uTime*sp*2.0);
  float temp=pow(1.0-clamp(x,0.0,1.0),1.6);
  vec3 col=mix(vec3(0.7,0.12,0.02),vec3(1.0,0.5,0.12),smoothstep(0.0,0.5,temp));
  col=mix(col,vec3(1.0,0.92,0.8),smoothstep(0.55,1.0,temp));
  vec3 V=normalize(cameraPosition-vWorld);
  float dop=1.0+0.8*dot(vTan,V);
  float bright=(0.35+0.9*n*streaks+0.4*n)*(0.4+0.8*arms)*temp*2.3*dop*dop;
  float edge=smoothstep(0.0,0.04,x)*(1.0-smoothstep(0.6,1.0,x));
  gl_FragColor=vec4(col*bright*edge,1.0);
  ${FINISH}
}`,
      uniforms: { uTime: time, uRange: { value: new THREE.Vector2(inner, outer) } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    disposables.push(discMat);
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = -Math.PI / 2 + 0.22;
    disc.rotation.z = 0.15;
    group.add(disc);
    const ringMat = new THREE.ShaderMaterial({
      vertexShader: BILLBOARD_VERT,
      fragmentShader: /* glsl */ `
uniform float uR0; varying vec2 vUv;
void main(){ float r=length(vUv); float g=exp(-(r-uR0)*(r-uR0)*2500.0)*2.5+exp(-(r-uR0)*(r-uR0)*123.0)*0.35; if(r<uR0*0.98) g*=0.0; gl_FragColor=vec4(vec3(1.0,0.75,0.45)*g,1.0); ${FINISH} }`,
      uniforms: { uR0: { value: 0.5 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    disposables.push(ringMat);
    const photon = new THREE.Mesh(quad, ringMat);
    photon.scale.setScalar(radius * 2.1);
    photon.renderOrder = 2;
    group.add(photon);
    billboards.push(photon);
    // The far side of the disc, bent by the hole's gravity into a glowing arch over and under it: this is what makes a
    // black hole look like one from any angle.
    const lensedMat = new THREE.ShaderMaterial({
      vertexShader: BILLBOARD_VERT,
      fragmentShader: /* glsl */ `
uniform float uTime; uniform float uIn; uniform float uOut; varying vec2 vUv;
${NOISE}
void main(){
  float r=length(vUv); if(r>1.0) discard;
  float x=(r-uIn)/(uOut-uIn); if(x<0.0||x>1.0) discard;
  float a=atan(vUv.y,vUv.x+1e-6);
  float prof=smoothstep(0.0,0.08,x)*(1.0-x)*(1.0-x);
  float ang=a-uTime*0.3;
  float n=snoise(vec3(cos(ang)*3.0,sin(ang)*3.0,x*5.0+uTime*0.08))*0.5+0.5;
  float arc=0.25+0.75*pow(abs(sin(a)),1.4);
  vec3 col=mix(vec3(1.0,0.42,0.08),vec3(1.0,0.9,0.75),(1.0-x)*(1.0-x)*(1.0-x));
  gl_FragColor=vec4(col*prof*(0.45+0.9*n)*arc*1.4,1.0);
  ${FINISH}
}`,
      uniforms: { uTime: time, uIn: { value: 1.12 / 3.6 }, uOut: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    disposables.push(lensedMat);
    const lensed = new THREE.Mesh(quad, lensedMat);
    lensed.scale.setScalar(radius * 3.6);
    lensed.renderOrder = 1;
    group.add(lensed);
    billboards.push(lensed);
    const glow = new THREE.Mesh(quad, glowMaterial(new THREE.Color(1.0, 0.5, 0.2), 0.1, 3.0));
    disposables.push(glow.material as THREE.Material);
    glow.scale.setScalar(outer * 2.2);
    group.add(glow);
    billboards.push(glow);
    hole = { pos: new THREE.Vector3(), radius };
  } else {
    group.add(star(kind === 'red' || kind === 'blue' || kind === 'white' || kind === 'pulsar' || kind === 'baby' ? kind : 'yellow', radius));
    if (kind === 'pulsar') {
      const pivot = new THREE.Group();
      pivot.rotation.z = 0.6;
      const spinner = new THREE.Group();
      pivot.add(spinner);
      const coneGeo = new THREE.ConeGeometry(4, 90, 32, 1, true);
      coneGeo.translate(0, -45, 0);
      disposables.push(coneGeo);
      const beamMat = new THREE.ShaderMaterial({
        vertexShader: WORLD_VERT,
        fragmentShader: /* glsl */ `
varying vec3 vObj; varying vec3 vWorld; varying vec3 vNrm; varying vec2 vUv;
void main(){ vec3 V=normalize(cameraPosition-vWorld); float f=pow(abs(dot(normalize(vNrm),V)),3.0);
  float along=clamp(-vObj.y/90.0,0.0,1.0); float g=f*pow(1.0-along,1.6)*(0.4+0.6*smoothstep(0.0,0.05,along));
  gl_FragColor=vec4(vec3(0.55,0.75,1.0)*g*2.2,1.0); ${FINISH} }`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      disposables.push(beamMat);
      const up = new THREE.Mesh(coneGeo, beamMat);
      up.rotation.x = Math.PI; // apex at the star, opening upwards
      const down = new THREE.Mesh(coneGeo, beamMat);
      spinner.add(up, down);
      group.add(pivot);
      beam = new THREE.Vector3();
      const tmp = new THREE.Vector3();
      updaters.push((t) => {
        pivot.rotation.y = t * 1.1;
        tmp.set(0, 1, 0).applyQuaternion(pivot.getWorldQuaternion(new THREE.Quaternion()));
        beam!.copy(tmp);
      });
      // a little magnetic glow ring
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 3, 0.06, 8, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 0.6, 1.6), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      disposables.push(ring.geometry, ring.material as THREE.Material);
      ring.rotation.x = Math.PI / 2;
      pivot.add(ring);
    }
    if (kind === 'white') {
      const shellMat = new THREE.ShaderMaterial({
        vertexShader: WORLD_VERT,
        fragmentShader: /* glsl */ `
uniform float uTime; varying vec3 vObj; varying vec3 vWorld; varying vec3 vNrm; varying vec2 vUv;
${NOISE}
void main(){
  vec3 V=normalize(cameraPosition-vWorld); vec3 N=normalize(vNrm);
  float fres=1.0-abs(dot(N,V));
  vec3 d=normalize(vObj);
  float fil=fbm(d*3.0+vec3(uTime*0.004),5)*0.5+0.5;
  float knots=pow(max(snoise(d*9.0)*0.5+0.5,1e-6),4.0);
  float shell=pow(fres,2.5)*(0.5+fil)+knots*0.15*fres;
  vec3 col=mix(vec3(0.15,0.75,0.85),vec3(1.0,0.25,0.35),smoothstep(0.55,0.95,fres+fil*0.2));
  gl_FragColor=vec4(col*shell*0.55,1.0);
  ${FINISH}
}`,
        uniforms: { uTime: time },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      disposables.push(shellMat);
      const shell = new THREE.Mesh(sphere, shellMat);
      shell.scale.set(12, 10, 11);
      shell.rotation.set(0.4, 0.2, 0.3);
      group.add(shell);
    }
    if (kind === 'baby') {
      const cloudMat = (tint: THREE.Color, seed: number, dark: boolean) =>
        new THREE.ShaderMaterial({
          vertexShader: BILLBOARD_VERT,
          fragmentShader: /* glsl */ `
uniform vec3 uTint; uniform float uSeed; uniform float uTime; uniform float uDark; varying vec2 vUv;
${NOISE}
void main(){
  float r=length(vUv); if(r>1.0) discard;
  vec3 p=vec3(vUv*2.2,uSeed)+vec3(0.0,0.0,uTime*0.01);
  float w=fbm(p,4);
  float n=fbm(p*1.6+w*1.3,5)*0.5+0.5;
  float fall=pow(1.0-r,1.6);
  float a=smoothstep(0.35,0.85,n)*fall;
  if(uDark>0.5) gl_FragColor=vec4(vec3(0.02,0.01,0.01),a*0.55);
  else gl_FragColor=vec4(uTint*a*0.7,1.0);
  ${FINISH}
}`,
          uniforms: { uTint: { value: tint }, uSeed: { value: seed }, uTime: time, uDark: { value: dark ? 1 : 0 } },
          transparent: true,
          depthWrite: false,
          blending: dark ? THREE.NormalBlending : THREE.AdditiveBlending,
        });
      const layers = s.level === 'incredible' ? 5 : s.level === 'normal' ? 3 : 2;
      const tints = [new THREE.Color(1.0, 0.45, 0.25), new THREE.Color(0.9, 0.3, 0.55), new THREE.Color(1.0, 0.7, 0.4), new THREE.Color(0.6, 0.35, 0.8), new THREE.Color(1.0, 0.5, 0.3)];
      for (let i = 0; i < layers; i++) {
        const m = new THREE.Mesh(quad, cloudMat(tints[i], i * 3.7 + 1, false));
        disposables.push(m.material as THREE.Material);
        m.scale.setScalar(40 + i * 22);
        m.position.set(Math.sin(i * 2.1) * 6, Math.cos(i * 1.3) * 3, Math.cos(i * 2.1) * 6);
        group.add(m);
        billboards.push(m);
      }
      if (s.level !== 'simple') {
        const dark = new THREE.Mesh(quad, cloudMat(new THREE.Color(0, 0, 0), 9.1, true));
        disposables.push(dark.material as THREE.Material);
        dark.scale.setScalar(55);
        dark.position.set(4, 1, 3);
        group.add(dark);
        billboards.push(dark);
      }
      // sparkling young rocks and dust
      const n = Math.round(500 * s.particles);
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const r = 8 + Math.pow(Math.random(), 0.7) * 50, a = Math.random() * Math.PI * 2;
        pos.set([Math.cos(a) * r, (Math.random() - 0.5) * 8 * (r / 50), Math.sin(a) * r], i * 3);
        const c = new THREE.Color().setHSL(0.06 + Math.random() * 0.08, 0.8, 0.6 + Math.random() * 0.3).multiplyScalar(1.4);
        col.set([c.r, c.g, c.b], i * 3);
        size[i] = 1.5 + Math.random() * 2.5;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
      const mat = twinkleMaterial(time, s.pixelRatio);
      disposables.push(geo, mat);
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      group.add(pts);
      updaters.push((t) => (pts.rotation.y = t * 0.02));
    }
  }

  const pick = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ visible: false }));
  disposables.push(pick.material as THREE.Material);
  pick.scale.setScalar(Math.max(radius * 1.3, 3));
  pick.userData.pick = 'sun';
  group.add(pick);

  // Everything above is made at SUN_SIZE; the whole sun is drawn SUN_SCALE times bigger so it stays the biggest thing
  // next to the planets. Light positions are worked out in the sun's own space, so they are scaled to match.
  group.scale.setScalar(SUN_SCALE);
  if (hole) hole.radius *= SUN_SCALE;
  return {
    group,
    lights,
    radius: radius * SUN_SCALE,
    pick,
    hole,
    beam,
    update(t, cam) {
      for (const u of updaters) u(t, cam);
      for (const l of lights) l.pos.multiplyScalar(SUN_SCALE);
      for (const b of billboards) b.quaternion.copy(cam.quaternion);
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
