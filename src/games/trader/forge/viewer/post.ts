/** The finish: black-hole light bending, bloom, film-style colour (ACES), vignette and grain. None on Simple. */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { LevelSettings } from './levels';

const LENS = {
  uniforms: { tDiffuse: { value: null }, uCenter: { value: new THREE.Vector2(0.5, 0.5) }, uHorizon: { value: 0.05 }, uAspect: { value: 1 }, uOn: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `uniform sampler2D tDiffuse; uniform vec2 uCenter; uniform float uHorizon; uniform float uAspect; uniform float uOn; varying vec2 vUv;
// A pixel that is not a number (a shader dividing by zero somewhere) would spread over the whole screen in the bloom.
vec4 clean(vec4 c){ if(any(isnan(c))||any(isinf(c))) return vec4(0.0,0.0,0.0,1.0); return vec4(clamp(c.rgb,0.0,60000.0),1.0); }
void main(){
  if(uOn<0.5){ gl_FragColor=clean(texture2D(tDiffuse,vUv)); return; }
  vec2 d=vUv-uCenter; d.x*=uAspect;
  float r=length(d);
  float rE=uHorizon*2.1;
  float fade=1.0-smoothstep(rE*5.0,rE*11.0,r);
  float defl=rE*rE/max(r,1e-4)*fade;
  vec2 src=uCenter+(d/max(r,1e-4))*(r-defl)/vec2(uAspect,1.0);
  vec4 c=clean(texture2D(tDiffuse,src));
  float shadow=smoothstep(uHorizon*0.92,uHorizon*1.04,r);
  float ring=exp(-((r-rE)*(r-rE))/(uHorizon*uHorizon*0.0036))*0.8;
  gl_FragColor=vec4(c.rgb*shadow+vec3(1.0,0.75,0.45)*ring*shadow*0.0,1.0);
}`,
};

const FINISH = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.035 }, uVignette: { value: 0.35 } },
  vertexShader: LENS.vertexShader,
  fragmentShader: /* glsl */ `uniform sampler2D tDiffuse; uniform float uTime; uniform float uGrain; uniform float uVignette; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233))+uTime*7.13)*43758.5453); }
void main(){
  vec4 c=texture2D(tDiffuse,vUv);
  vec2 q=vUv-0.5;
  float v=1.0-uVignette*smoothstep(0.25,0.85,length(q*vec2(1.1,1.0))*1.25);
  c.rgb*=v;
  c.rgb+=(h(vUv*1000.0)-0.5)*uGrain;
  gl_FragColor=c;
}`,
};

/** Bloom drawn at half size again on Normal (UnrealBloomPass already halves), lighter. */
class HalfBloom extends UnrealBloomPass {
  setSize(w: number, h: number) {
    super.setSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
  }
}

export interface Post {
  render(): void;
  setSize(w: number, h: number, pixelRatio: number): void;
  /** Where the black hole is on screen (0..1), and its radius as a share of the screen height; null when not shown. */
  setLens(center: THREE.Vector2 | null, radius: number, aspect: number): void;
  tick(t: number): void;
  dispose(): void;
}

export function makePost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, s: LevelSettings, w: number, h: number): Post {
  if (s.post === 'none') {
    return { render: () => renderer.render(scene, camera), setSize() {}, setLens() {}, tick() {}, dispose() {} };
  }
  const rt = new THREE.WebGLRenderTarget(w * s.pixelRatio, h * s.pixelRatio, { type: THREE.HalfFloatType, samples: s.msaa });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(s.pixelRatio);
  composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  const lens = new ShaderPass(LENS);
  composer.addPass(lens);
  const full = s.post === 'full';
  const bloom = full ? new UnrealBloomPass(new THREE.Vector2(w, h), 0.7, 0.5, 0.95) : new HalfBloom(new THREE.Vector2(w, h), 0.55, 0.4, 0.95);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  let finish: ShaderPass | null = null;
  if (full) {
    finish = new ShaderPass(FINISH);
    composer.addPass(finish);
  }
  return {
    render: () => composer.render(),
    setSize(width, height, pr) {
      composer.setPixelRatio(pr);
      composer.setSize(width, height);
    },
    setLens(center, radius, aspect) {
      lens.uniforms.uOn.value = center ? 1 : 0;
      if (center) {
        lens.uniforms.uCenter.value.copy(center);
        lens.uniforms.uHorizon.value = radius;
        lens.uniforms.uAspect.value = aspect;
      }
    },
    tick(t) {
      if (finish) finish.uniforms.uTime.value = t % 100;
    },
    dispose() {
      composer.passes.forEach((p) => (p as { dispose?: () => void }).dispose?.());
      composer.dispose();
      rt.dispose();
    },
  };
}
