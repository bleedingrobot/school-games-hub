/**
 * Draws the stand-in pictures on the GPU into render targets, a few each frame, and keeps them by what they show so a
 * changed planet doesn't redraw the others (and switching back is instant).
 */
import * as THREE from 'three';
import { BAKE_VERT, CLOUD_ID, KIND_ID, LIFE_ID, PLANET_BAKE_FRAG, SKY_BAKE_FRAG } from './bakeShaders';

export interface PlanetMapSpec {
  kind: string;
  surface: number;
  tint: number;
  /** sRGB colour of plants under this sun. */
  plants: number;
  life: string;
  /** 1 built, 0.5 planned (drawn fainter), 0 none. */
  lifeAmt: number;
  volcano: number;
  terraformer: number;
  clouds: string;
  seed: number;
}

export interface PlanetMaps {
  /** rgb colour, a shine. */
  albedo: THREE.Texture;
  /** rgb glow, a height. */
  extra: THREE.Texture;
  clouds: THREE.Texture | null;
  ready: boolean;
}

interface Entry {
  key: string;
  rts: THREE.WebGLRenderTarget[];
  maps: PlanetMaps;
  refs: number;
  job: (() => void) | null;
}

const KEEP_UNUSED = 10;

export class Baker {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private planetMat: THREE.ShaderMaterial;
  private skyMat: THREE.ShaderMaterial;
  private entries = new Map<string, Entry>();
  private queue: Entry[] = [];
  private unused: string[] = [];
  size: number;
  octaves: number;
  anisotropy: number;

  constructor(renderer: THREE.WebGLRenderer, size: number, octaves: number, anisotropy: number) {
    this.renderer = renderer;
    this.size = size;
    this.octaves = octaves;
    this.anisotropy = anisotropy;
    this.planetMat = new THREE.ShaderMaterial({
      vertexShader: BAKE_VERT,
      fragmentShader: PLANET_BAKE_FRAG,
      uniforms: {
        uKind: { value: 0 }, uSeed: { value: new THREE.Vector3() }, uVar: { value: 0 }, uTint: { value: 0 }, uPlants: { value: new THREE.Color() },
        uLife: { value: 0 }, uLifeAmt: { value: 1 }, uVolcano: { value: 0 }, uTerra: { value: 0 }, uOut: { value: 0 }, uCloud: { value: 0 },
        uOct: { value: octaves }, uSpot: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: BAKE_VERT,
      fragmentShader: SKY_BAKE_FRAG,
      uniforms: { uBg: { value: 0 }, uSeed: { value: new THREE.Vector3() }, uOct: { value: octaves } },
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.planetMat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  private target(w: number, h: number): THREE.WebGLRenderTarget {
    const rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      anisotropy: this.anisotropy,
    });
    rt.texture.colorSpace = THREE.NoColorSpace;
    return rt;
  }

  private draw(mat: THREE.ShaderMaterial, rt: THREE.WebGLRenderTarget) {
    this.quad.material = mat;
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(rt);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(prev);
  }

  /** The maps for a planet (or moon): drawn now if `now`, else soon. Call `release` with the same spec when done. */
  planet(spec: PlanetMapSpec, now = false): PlanetMaps {
    const key = `p|${JSON.stringify(spec)}|${this.size}`;
    let e = this.entries.get(key);
    if (!e) {
      const w = spec.kind === 'moon' ? Math.max(256, this.size / 2) : this.size;
      const rts = [this.target(w, w / 2), this.target(w, w / 2)];
      const hasClouds = spec.clouds !== 'none' && spec.kind !== 'moon';
      if (hasClouds) rts.push(this.target(w / 2, w / 4));
      const maps: PlanetMaps = { albedo: rts[0].texture, extra: rts[1].texture, clouds: hasClouds ? rts[2].texture : null, ready: false };
      const entry: Entry = { key, rts, maps, refs: 0, job: null };
      entry.job = () => {
        const u = this.planetMat.uniforms;
        u.uKind.value = KIND_ID[spec.kind] ?? 0;
        const s = spec.seed;
        u.uSeed.value.set(((s * 12.9898) % 19) + 3, ((s * 78.233) % 23) + 5, ((s * 37.719) % 17) + 7);
        u.uVar.value = spec.surface;
        u.uTint.value = (spec.tint / 8) * Math.PI * 2;
        u.uPlants.value.setHex(spec.plants, THREE.NoColorSpace);
        u.uLife.value = LIFE_ID[spec.life] ?? 0;
        u.uLifeAmt.value = spec.lifeAmt;
        u.uVolcano.value = spec.volcano;
        u.uTerra.value = spec.terraformer;
        u.uCloud.value = CLOUD_ID[spec.clouds] ?? 0;
        u.uSpot.value = spec.clouds === 'spot' ? 1 : spec.clouds === 'storms' ? 0.6 : 0;
        u.uOct.value = this.octaves;
        for (let i = 0; i < rts.length; i++) {
          u.uOut.value = i;
          this.draw(this.planetMat, rts[i]);
        }
        maps.ready = true;
        entry.job = null;
      };
      this.entries.set(key, entry);
      this.queue.push(entry);
      e = entry;
    }
    e.refs++;
    this.unused = this.unused.filter((k) => k !== key);
    if (now && e.job) {
      e.job();
      this.queue = this.queue.filter((x) => x !== e);
    }
    return e.maps;
  }

  release(maps: PlanetMaps) {
    for (const e of this.entries.values()) {
      if (e.maps !== maps) continue;
      e.refs = Math.max(0, e.refs - 1);
      if (e.refs === 0) {
        this.unused.push(e.key);
        while (this.unused.length > KEEP_UNUSED) this.drop(this.unused.shift()!);
      }
      return;
    }
  }

  private drop(key: string) {
    const e = this.entries.get(key);
    if (!e || e.refs > 0) return;
    for (const rt of e.rts) rt.dispose();
    this.entries.delete(key);
    this.queue = this.queue.filter((x) => x !== e);
  }

  /** A sky panorama (drawn at once: there is only one). The caller owns it. */
  sky(background: number, width: number): THREE.WebGLRenderTarget {
    const rt = this.target(width, width / 2);
    this.skyMat.uniforms.uBg.value = background;
    this.skyMat.uniforms.uSeed.value.set(background * 3.7 + 1, background * 1.3 + 2, background * 5.1 + 3);
    this.draw(this.skyMat, rt);
    return rt;
  }

  /** Something is still waiting to be drawn. */
  get busy(): boolean {
    return this.queue.length > 0;
  }

  /** Draws waiting pictures: all of them, or until `ms` have passed (at least one). */
  run(ms = Infinity) {
    const start = performance.now();
    while (this.queue.length) {
      const e = this.queue.shift()!;
      e.job?.();
      if (performance.now() - start > ms) break;
    }
  }

  dispose() {
    for (const e of this.entries.values()) for (const rt of e.rts) rt.dispose();
    this.entries.clear();
    this.queue = [];
    this.planetMat.dispose();
    this.skyMat.dispose();
    this.quad.geometry.dispose();
  }
}
