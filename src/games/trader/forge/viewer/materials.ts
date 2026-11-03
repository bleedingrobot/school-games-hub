/** The viewer's shader materials: planet surfaces, clouds, sky glow, rings, holograms, glows and the sky. */
import * as THREE from 'three';
import { BUMP, DIR_UV, FINISH, HUE, LIGHTS, NOISE } from './glsl';

/** Uniforms every lit material shares (the same objects, so setting them once updates all). */
export interface Shared {
  uLightPos: { value: THREE.Vector3[] };
  uLightCol: { value: THREE.Color[] };
  uLightCount: { value: number };
  uBeamDir: { value: THREE.Vector3 };
  uBeamOn: { value: number };
  uAmbient: { value: THREE.Color };
  uTime: { value: number };
}

export const makeShared = (): Shared => ({
  uLightPos: { value: [new THREE.Vector3(), new THREE.Vector3()] },
  uLightCol: { value: [new THREE.Color(1, 1, 1), new THREE.Color(0, 0, 0)] },
  uLightCount: { value: 1 },
  uBeamDir: { value: new THREE.Vector3(1, 0, 0) },
  uBeamOn: { value: 0 },
  uAmbient: { value: new THREE.Color(0.012, 0.014, 0.022) },
  uTime: { value: 0 },
});

const WORLD_VERT = /* glsl */ `
varying vec3 vObj; varying vec3 vWorld; varying vec3 vNrm; varying vec2 vUv;
void main(){
  vObj=position; vUv=uv;
  vec4 w=modelMatrix*vec4(position,1.0);
  vWorld=w.xyz;
  vNrm=normalize(mat3(modelMatrix)*normal);
  gl_Position=projectionMatrix*viewMatrix*w;
}
`;

const RING_SHADOW = /* glsl */ `
uniform float uHasRing; uniform vec3 uRingN; uniform vec2 uRingRange; uniform sampler2D uRingTex;
float ringShadow(vec3 p,vec3 L){
  if(uHasRing<0.5) return 1.0;
  float dn=dot(L,uRingN); if(abs(dn)<1e-4) return 1.0;
  float t=dot(uCenter-p,uRingN)/dn; if(t<=0.0) return 1.0;
  float r=length(p+L*t-uCenter);
  float x=(r-uRingRange.x)/(uRingRange.y-uRingRange.x);
  if(x<0.0||x>1.0) return 1.0;
  return 1.0-texture2D(uRingTex,vec2(x,0.5)).a*0.8;
}
`;

const SURFACE_FRAG = /* glsl */ `
uniform sampler2D uAlbedo; uniform sampler2D uExtra; uniform sampler2D uClouds;
uniform vec3 uCenter; uniform float uRadius; uniform float uBump; uniform float uMapMode; uniform vec2 uRepeat;
uniform float uPainted; uniform float uTintA; uniform float uCloudShadow; uniform float uCloudShift;
uniform vec3 uSky; uniform float uAtmo; uniform float uEmisDay; uniform float uEmisGain; uniform float uGlowSeas; uniform float uPulse;
uniform float uReady; uniform float uNightSquares; uniform vec3 uBase;
varying vec3 vObj; varying vec3 vWorld; varying vec3 vNrm; varying vec2 vUv;
${LIGHTS}
${NOISE}
${HUE}
${DIR_UV}
${BUMP}
${RING_SHADOW}
void main(){
  vec2 uv=uMapMode<0.5?dirToUv(normalize(vObj)):vec2(vUv.x*uRepeat.x,0.32+vUv.y*0.36);
  vec4 A=texture2D(uAlbedo,uv); vec4 E=texture2D(uExtra,uv);
  if(uPainted>0.5){ A.rgb=clamp(hueShift(A.rgb,uTintA),0.0,1.0); E.a=dot(A.rgb,vec3(0.3,0.5,0.2)); }
  vec3 alb=pow(A.rgb,vec3(2.2));
  alb=mix(uBase,alb,uReady);
  float shine=A.a*uReady; float h=E.a; vec3 emis=pow(E.rgb,vec3(2.2))*uEmisGain*uReady;
  vec3 Ng=normalize(vNrm);
  // the ring world's land is the inside of the band: it always faces the sun's axis (three.js flips the winding for
  // BackSide, so gl_FrontFacing can't be trusted to say which face this is)
  if(uMapMode>0.5) Ng=normalize(vec3(-vWorld.x,0.0,-vWorld.z));
  vec3 N=uBump>0.0?bumpNormal(vWorld,Ng,h,uBump):Ng;
  vec3 V=normalize(cameraPosition-vWorld);
  float cs=1.0;
  if(uCloudShadow>0.0){ cs=1.0-texture2D(uClouds,uv+vec2(uCloudShift,0.0)).a*0.45*uCloudShadow; }
  vec3 col=vec3(0.0); float day=-1.0; vec3 lsum=vec3(0.0);
  for(int i=0;i<2;i++){
    if(i>=uLightCount) break;
    vec3 L=normalize(uLightPos[i]-vWorld);
    vec3 lc=lightAt(i,vWorld);
    float ng=dot(Ng,L);
    float nl=max(dot(N,L),0.0)*smoothstep(-0.08,0.12,ng);
    float sh=ringShadow(vWorld,L)*cs;
    col+=alb*lc*nl*sh;
    vec3 H=normalize(L+V);
    vec3 Nw=Ng;
    if(shine>0.02&&i==0) Nw=normalize(Ng+0.04*vec3(snoise(vObj*40.0+uTime*0.3),snoise(vObj*40.0+7.0),snoise(vObj*40.0+3.0-uTime*0.3))*shine);
    float sp=pow(max(dot(Nw,H),1e-6),90.0)*0.9+pow(max(dot(Nw,H),1e-6),14.0)*0.04;
    col+=lc*sp*shine*sh*smoothstep(0.0,0.15,ng);
    day=max(day,ng); lsum+=lc;
  }
  float nightF=1.0-smoothstep(-0.12,0.18,day);
  if(uNightSquares>0.5){
    float a=atan(vWorld.z,vWorld.x);
    float sq=smoothstep(-0.75,-0.45,sin(a*6.0-uTime*0.05));
    col*=mix(0.12,1.0,sq); nightF=max(nightF,1.0-sq);
  }
  col+=emis*mix(nightF,1.0,uEmisDay)*(1.0+uPulse*0.6*sin(uTime*2.0+vObj.x*6.0));
  if(uGlowSeas>0.0){
    float g=0.5+0.5*sin(uTime*1.3+snoise(vObj*6.0+uTime*0.1)*4.0);
    col+=vec3(0.05,0.85,0.7)*shine*nightF*uGlowSeas*(0.35+0.65*g)*1.4;
  }
  float ndv=max(dot(Ng,V),0.0);
  float rim=pow(1.0-ndv,3.0);
  vec3 sunset=vec3(1.0,0.45,0.2);
  vec3 sky=mix(sunset,uSky,smoothstep(0.0,0.35,day));
  col+=sky*rim*uAtmo*smoothstep(-0.25,0.25,day)*(lsum*0.6+0.1);
  col=mix(col,col*(1.0-0.35*uAtmo)+uSky*0.08*uAtmo*lsum,(1.0-ndv)*smoothstep(-0.1,0.4,day)*0.6);
  col+=alb*uAmbient;
  gl_FragColor=vec4(col,1.0);
  ${FINISH}
}
`;

export interface SurfaceOpts {
  albedo: THREE.Texture;
  extra: THREE.Texture;
  clouds: THREE.Texture | null;
  radius: number;
  bump: number;
  mapMode?: 0 | 1;
  repeat?: number;
  sky: THREE.Color;
  atmo: number;
  emisDay: number;
  emisGain?: number;
  base?: THREE.Color;
}

export function surfaceMaterial(shared: Shared, ringTex: THREE.Texture, o: SurfaceOpts): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: WORLD_VERT,
    fragmentShader: SURFACE_FRAG,
    side: o.mapMode === 1 ? THREE.DoubleSide : THREE.FrontSide,
    uniforms: {
      ...shared,
      uAlbedo: { value: o.albedo }, uExtra: { value: o.extra }, uClouds: { value: o.clouds ?? o.albedo },
      uCenter: { value: new THREE.Vector3() }, uRadius: { value: o.radius }, uBump: { value: o.bump },
      uMapMode: { value: o.mapMode ?? 0 }, uRepeat: { value: new THREE.Vector2(o.repeat ?? 1, 1) },
      uPainted: { value: 0 }, uTintA: { value: 0 }, uCloudShadow: { value: 0 }, uCloudShift: { value: 0 },
      uSky: { value: o.sky }, uAtmo: { value: o.atmo }, uEmisDay: { value: o.emisDay }, uEmisGain: { value: o.emisGain ?? 2.2 },
      uGlowSeas: { value: 0 }, uPulse: { value: 0 }, uReady: { value: 0 }, uNightSquares: { value: 0 },
      uBase: { value: o.base ?? new THREE.Color(0.2, 0.2, 0.22) },
      uHasRing: { value: 0 }, uRingN: { value: new THREE.Vector3(0, 1, 0) }, uRingRange: { value: new THREE.Vector2(1, 2) }, uRingTex: { value: ringTex },
    },
  });
}

const CLOUD_FRAG = /* glsl */ `
uniform sampler2D uClouds; uniform vec3 uCenter; uniform float uOpacity; uniform float uLightning; uniform float uReady;
varying vec3 vObj; varying vec3 vWorld; varying vec3 vNrm; varying vec2 vUv;
${LIGHTS}
${DIR_UV}
${RING_SHADOW}
float h11(float n){ return fract(sin(n)*43758.5453); }
void main(){
  vec2 uv=dirToUv(normalize(vObj));
  vec4 c=texture2D(uClouds,uv);
  float a=c.a*uOpacity*uReady;
  vec3 N=normalize(vNrm); vec3 V=normalize(cameraPosition-vWorld);
  vec3 col=vec3(0.0); float day=-1.0;
  vec3 alb=pow(c.rgb,vec3(2.2));
  for(int i=0;i<2;i++){
    if(i>=uLightCount) break;
    vec3 L=normalize(uLightPos[i]-vWorld);
    float nl=dot(N,L);
    float lit=smoothstep(-0.15,0.6,nl)*0.85+max(nl,0.0)*0.25;
    col+=alb*0.82*lightAt(i,vWorld)*lit*ringShadow(vWorld,L);
    day=max(day,nl);
  }
  float rim=pow(1.0-max(dot(N,V),0.0),2.0);
  a*=1.0-rim*0.5;
  if(uLightning>0.0){
    vec2 cell=floor(uv*vec2(36.0,18.0));
    float slot=floor(uTime*7.0);
    float seed=cell.x*13.1+cell.y*71.7;
    float flash=step(0.993,h11(seed+slot*3.7))*(0.5+0.5*h11(seed+slot));
    vec2 f=fract(uv*vec2(36.0,18.0))-0.5;
    float blob=smoothstep(0.5,0.0,length(f));
    float night=1.0-smoothstep(-0.2,0.2,day);
    col+=vec3(0.7,0.8,1.0)*flash*blob*c.a*uLightning*(0.4+night*2.6)*3.0;
    a=max(a,flash*blob*0.6*uLightning*c.a);
  }
  col+=alb*uAmbient;
  gl_FragColor=vec4(col,a);
  ${FINISH}
}
`;

export function cloudMaterial(shared: Shared, ringTex: THREE.Texture, clouds: THREE.Texture, opacity: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: WORLD_VERT,
    fragmentShader: CLOUD_FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: {
      ...shared,
      uClouds: { value: clouds }, uCenter: { value: new THREE.Vector3() }, uOpacity: { value: opacity }, uLightning: { value: 0 }, uReady: { value: 0 },
      uHasRing: { value: 0 }, uRingN: { value: new THREE.Vector3(0, 1, 0) }, uRingRange: { value: new THREE.Vector2(1, 2) }, uRingTex: { value: ringTex },
    },
  });
}

const ATMO_FRAG = /* glsl */ `
uniform vec3 uSky; uniform float uStrength; uniform float uEdge; uniform vec3 uCenter;
varying vec3 vObj; varying vec3 vWorld; varying vec3 vNrm; varying vec2 vUv;
${LIGHTS}
void main(){
  vec3 N=normalize(vNrm); vec3 V=normalize(cameraPosition-vWorld);
  float f=clamp(dot(-N,V)/uEdge,0.0,1.0);
  float glow=pow(f,2.2)*(1.0-smoothstep(0.92,1.0,f)*0.0);
  vec3 col=vec3(0.0);
  for(int i=0;i<2;i++){
    if(i>=uLightCount) break;
    vec3 L=normalize(uLightPos[i]-uCenter);
    float nl=dot(normalize(vWorld-uCenter),L);
    float dayF=smoothstep(-0.35,0.45,nl);
    vec3 sky=mix(vec3(1.0,0.4,0.15),uSky,smoothstep(-0.05,0.4,nl));
    float back=pow(max(dot(-V,L),1e-6),6.0)*1.5;
    col+=sky*lightAt(i,vWorld)*(dayF+back*smoothstep(-0.6,0.1,nl));
  }
  gl_FragColor=vec4(col*glow*uStrength,1.0);
  ${FINISH}
}
`;

/** The glow round a planet's edge: a slightly bigger copy of its shape, drawn from the inside. */
export function atmosphereMaterial(shared: Shared, sky: THREE.Color, strength: number, scale: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: WORLD_VERT,
    fragmentShader: ATMO_FRAG,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { ...shared, uSky: { value: sky }, uStrength: { value: strength }, uEdge: { value: Math.sqrt(1 - 1 / (scale * scale)) }, uCenter: { value: new THREE.Vector3() } },
  });
}

const RING_VERT = /* glsl */ `
varying vec3 vLocal; varying vec3 vWorld;
void main(){ vLocal=position; vec4 w=modelMatrix*vec4(position,1.0); vWorld=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }
`;
const RING_FRAG = /* glsl */ `
uniform sampler2D uRingTex; uniform vec2 uRange; uniform vec3 uCenter; uniform float uPlanetR; uniform vec3 uNormal; uniform float uShadow; uniform float uSparkle;
varying vec3 vLocal; varying vec3 vWorld;
${LIGHTS}
float h31(vec3 p){ p=fract(p*0.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }
void main(){
  float r=length(vLocal.xy);
  float x=(r-uRange.x)/(uRange.y-uRange.x);
  if(x<0.0||x>1.0) discard;
  vec4 t=texture2D(uRingTex,vec2(x,0.5));
  if(t.a<0.01) discard;
  vec3 alb=pow(t.rgb,vec3(2.2));
  vec3 V=normalize(cameraPosition-vWorld);
  vec3 col=vec3(0.0);
  for(int i=0;i<2;i++){
    if(i>=uLightCount) break;
    vec3 L=normalize(uLightPos[i]-vWorld);
    float lit=0.25+0.75*abs(dot(uNormal,L));
    float sameSide=step(0.0,dot(uNormal,L)*dot(uNormal,V));
    float through=(1.0-sameSide)*(1.0-t.a)*1.2+pow(max(dot(-V,L),1e-6),10.0)*0.8;
    float sh=1.0;
    if(uShadow>0.5){
      vec3 oc=vWorld-uCenter; float b=dot(oc,L);
      if(b<0.0){ float dd=sqrt(max(dot(oc,oc)-b*b,0.0)); sh=smoothstep(uPlanetR*0.96,uPlanetR*1.04,dd); }
    }
    col+=alb*lightAt(i,vWorld)*(lit*mix(0.55,1.0,sameSide)+through)*sh;
  }
  if(uSparkle>0.0){
    vec3 cell=floor(vLocal*vec3(60.0,60.0,1.0));
    float s=step(0.985,h31(cell+floor(uTime*2.0)));
    col+=vec3(0.8,0.9,1.0)*s*uSparkle*2.0;
  }
  col+=alb*uAmbient;
  gl_FragColor=vec4(col,t.a);
  ${FINISH}
}
`;

export function ringMaterial(shared: Shared, tex: THREE.Texture, inner: number, outer: number, planetR: number, shadow: boolean, sparkle: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: RING_VERT,
    fragmentShader: RING_FRAG,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    uniforms: {
      ...shared,
      uRingTex: { value: tex }, uRange: { value: new THREE.Vector2(inner, outer) }, uCenter: { value: new THREE.Vector3() },
      uPlanetR: { value: planetR }, uNormal: { value: new THREE.Vector3(0, 1, 0) }, uShadow: { value: shadow ? 1 : 0 }, uSparkle: { value: sparkle },
    },
  });
}

const HOLO_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uGrid; uniform float uOpacity; uniform float uTime;
varying vec3 vObj; varying vec3 vWorld; varying vec3 vNrm; varying vec2 vUv;
void main(){
  vec3 N=normalize(vNrm); vec3 V=normalize(cameraPosition-vWorld);
  float fres=pow(1.0-abs(dot(N,V)),2.0);
  vec3 g=abs(fract(vObj*uGrid)-0.5);
  vec3 w=fwidth(vObj*uGrid);
  vec3 line=1.0-smoothstep(vec3(0.0),w*1.5,g-0.5+w*1.2);
  float grid=max(max(line.x,line.y),line.z);
  float scan=pow(0.5+0.5*sin(vWorld.y*6.0-uTime*3.0),12.0);
  float flick=0.9+0.1*sin(uTime*23.0+vWorld.x);
  float a=(0.05+fres*0.55+grid*0.35+scan*0.25)*flick*uOpacity;
  gl_FragColor=vec4(uColor*(1.2+scan),a);
  ${FINISH}
}
`;

/** A plan not built yet: see-through blue, scan lines and a wire glow. */
export function hologramMaterial(time: { value: number }, grid = 6): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: WORLD_VERT,
    fragmentShader: HOLO_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(0.25, 0.65, 1.4) }, uGrid: { value: grid }, uOpacity: { value: 1 }, uTime: time },
  });
}

const BILLBOARD_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv=uv*2.0-1.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
`;

/** A soft round glow on a camera-facing square (add the mesh to a group and call faceCamera each frame). */
export function glowMaterial(color: THREE.Color, intensity: number, power = 2.0, time?: { value: number }, streak = 0): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: BILLBOARD_VERT,
    fragmentShader: /* glsl */ `
uniform vec3 uColor; uniform float uIntensity; uniform float uPower; uniform float uTime; uniform float uStreak;
varying vec2 vUv;
void main(){
  float r=length(vUv);
  if(r>1.0) discard;
  float g=pow(max(1.0-r,1e-6),uPower)+0.15*exp(-r*12.0);
  float s=uStreak*exp(-abs(vUv.y)*90.0)*pow(max(1.0-abs(vUv.x),1e-6),2.0);
  gl_FragColor=vec4(uColor*(g+s)*uIntensity,1.0);
  ${FINISH}
}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: color }, uIntensity: { value: intensity }, uPower: { value: power }, uTime: time ?? { value: 0 }, uStreak: { value: streak } },
  });
}

const SKY_FRAG = /* glsl */ `
uniform sampler2D uMap; uniform float uBright;
varying vec3 vObj; varying vec3 vWorld; varying vec3 vNrm; varying vec2 vUv;
${DIR_UV}
void main(){
  vec3 c=texture2D(uMap,dirToUv(normalize(vObj))).rgb;
  gl_FragColor=vec4(pow(c,vec3(2.2))*uBright,1.0);
  ${FINISH}
}
`;

export function skyMaterial(map: THREE.Texture, bright: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: WORLD_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uMap: { value: map }, uBright: { value: bright } },
  });
}

/** Points that twinkle (stars, sparkles): attribute `size` (px) and `color`; `uScale` is the pixel ratio. */
export function twinkleMaterial(time: { value: number }, scale: number, additive = true): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
attribute float size; attribute vec3 color; uniform float uTime; uniform float uScale;
varying vec3 vCol; varying float vTw;
void main(){
  vCol=color;
  float ph=fract(sin(dot(position,vec3(12.9,78.2,37.7)))*43758.5)*6.28;
  vTw=0.75+0.25*sin(uTime*(1.5+ph*0.4)+ph);
  vec4 mv=modelViewMatrix*vec4(position,1.0);
  gl_PointSize=size*uScale;
  gl_Position=projectionMatrix*mv;
}`,
    fragmentShader: /* glsl */ `
varying vec3 vCol; varying float vTw;
void main(){
  vec2 c=gl_PointCoord*2.0-1.0; float r=dot(c,c);
  if(r>1.0) discard;
  float g=exp(-r*5.0)+0.25*max(0.0,1.0-abs(c.x)*12.0)*exp(-abs(c.y)*3.0)*step(1.8,vCol.r+vCol.g)+0.25*max(0.0,1.0-abs(c.y)*12.0)*exp(-abs(c.x)*3.0)*step(1.8,vCol.r+vCol.g);
  gl_FragColor=vec4(vCol*g*vTw,1.0);
  ${FINISH}
}`,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uTime: time, uScale: { value: scale } },
  });
}

/** Round 1D textures for rings: across is inside edge to outside edge, rgb colour and a cover. Drawn on the CPU. */
export function ringStrip(kind: string, seed: number): THREE.DataTexture {
  const W = 512;
  const data = new Uint8Array(W * 4);
  let s = (seed * 9301 + 49297) % 233280;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const noise: number[] = [];
  for (let i = 0; i < 64; i++) noise.push(rnd());
  const fine: number[] = [];
  for (let i = 0; i < 256; i++) fine.push(rnd());
  const at = (arr: number[], x: number) => {
    const f = x * (arr.length - 1);
    const i = Math.floor(f);
    const t = f - i;
    return arr[i] * (1 - t) + arr[Math.min(arr.length - 1, i + 1)] * t;
  };
  for (let i = 0; i < W; i++) {
    const x = i / (W - 1);
    const n = at(noise, x) * 0.6 + at(fine, x) * 0.4;
    let a = 0.25 + 0.75 * n;
    let r = 0.8, g = 0.75, b = 0.7;
    const edge = Math.min(1, x / 0.05, (1 - x) / 0.05);
    if (kind === 'dusty') { r = 0.62 + 0.15 * n; g = 0.5 + 0.12 * n; b = 0.38 + 0.08 * n; a *= 0.7; }
    else if (kind === 'icy') { r = 0.88 + 0.1 * n; g = 0.9 + 0.08 * n; b = 0.95; if (x > 0.58 && x < 0.64) a *= 0.08; a = Math.min(1, a * 1.15); }
    else if (kind === 'crystal') { r = 0.6 + 0.3 * n; g = 0.75 + 0.2 * at(fine, 1 - x); b = 1; a *= 0.8; }
    else if (kind === 'rainbow') {
      const hue = x * 0.85;
      const c = new THREE.Color().setHSL(hue, 0.85, 0.62);
      r = c.r; g = c.g; b = c.b; a = 0.55 + 0.4 * n;
    } else if (kind === 'double') { r = 0.85 + 0.1 * n; g = 0.8 + 0.08 * n; b = 0.72; if (x > 0.42 && x < 0.58) a = 0; }
    a *= Math.max(0, edge);
    data[i * 4] = Math.round(Math.min(1, r) * 255);
    data[i * 4 + 1] = Math.round(Math.min(1, g) * 255);
    data[i * 4 + 2] = Math.round(Math.min(1, b) * 255);
    data[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
  }
  const tex = new THREE.DataTexture(data, W, 1, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
