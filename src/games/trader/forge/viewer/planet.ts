/** One planet in the viewer: its surface, clouds, sky glow, rings, moons, effects and technology, or a hologram plan. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Built, PlanetPick, SunKind, SystemDesign } from '../../../../../shared/trader/system';
import { SUNS } from '../../../../../shared/trader/system';
import { cloudArt, moonArt, planetArt, ringArt } from '../art';
import type { Baker, PlanetMaps, PlanetMapSpec } from './bake';
import { KIND_ID } from './bakeShaders';
import type { LevelSettings } from './levels';
import { atmosphereMaterial, cloudMaterial, hologramMaterial, ringMaterial, ringStrip, surfaceMaterial, type Shared } from './materials';
import { moonDist, moonSize, orbitRadius, orbitSpeed, planetRadius, ringOuterOf, startAngle } from './orbits';
import * as P from './parts';

export interface Ctx {
  shared: Shared;
  s: LevelSettings;
  baker: Baker;
  sphere: THREE.BufferGeometry;
  sun: SunKind | undefined;
  /** The whole design, for the orbit layout. */
  design: SystemDesign;
  showPlans: boolean;
  /** Loads a painted picture as a texture, or null. */
  load(url: string | null): Promise<THREE.Texture | null>;
}

export interface PlanetObject {
  id: number;
  root: THREE.Group;
  radius: number;
  /** Ring world: a band round the sun, not a ball. */
  band: boolean;
  orbitR: number;
  pick: THREE.Object3D;
  /** Where it is now, in the world. */
  pos: THREE.Vector3;
  hasRing: boolean;
  ringOuter: number;
  update(sim: number, fx: number, cam: THREE.Camera): void;
  dispose(): void;
}

const SKIES = [0x6fb2ff, 0xffa860, 0xff7fc8, 0x7dffa0, 0xb48cff, 0x5ff0e6, 0xffd86a, 0xeaf2ff];
const ATMO: Record<string, number> = { rocky: 0.12, desert: 0.45, ice: 0.3, ocean: 1, lava: 0.55, jungle: 1, gas: 0.85, icegiant: 0.9, crystal: 0.35, toxic: 1.3, eyeball: 0.8, shattered: 0, cube: 0.7, donut: 0.7, ringworld: 0 };
const TILTS = [0.06, 0.2, 0.42, 0.65, 0.95];
const KIND_BASE: Record<string, number> = { gas: 0xc8a882, icegiant: 0x8cc8e0, ocean: 0x204a80, lava: 0x301810, ice: 0xd8e4f0, crystal: 0x8a6ac8, toxic: 0x707030 };

const shown = (x: Built | null | undefined, planned: boolean, plans: boolean) => !!x && (plans || (!planned && !!x.built));
const isPlan = (x: Built | null | undefined, planned: boolean) => planned || !x?.built;

/** Bumpy rock lumps that make up a shattered world, in the planet's own space (unit radius). */
function shards(seed: number, count: number): { geo: THREE.BufferGeometry; dir: THREE.Vector3 }[] {
  const r = P.rng(seed);
  const out: { geo: THREE.BufferGeometry; dir: THREE.Vector3 }[] = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - ((i + 0.5) / count) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = i * 2.39996;
    const dir = new THREE.Vector3(Math.cos(th) * rad, y, Math.sin(th) * rad).normalize();
    const size = 0.3 + r() * 0.12;
    const geo = new THREE.IcosahedronGeometry(size, 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const k = [r() * 9, r() * 9, r() * 9];
    const v = new THREE.Vector3();
    for (let j = 0; j < pos.count; j++) {
      v.fromBufferAttribute(pos, j);
      const n = Math.sin(v.x * 7 + k[0]) * Math.sin(v.y * 6 + k[1]) * Math.sin(v.z * 8 + k[2]);
      const flat = v.dot(dir) < -size * 0.3 ? 0.6 : 1; // a broken face towards the middle
      v.multiplyScalar((1 + 0.22 * n) * flat);
      v.addScaledVector(dir, 0.66);
      pos.setXYZ(j, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    out.push({ geo, dir });
  }
  return out;
}

export function buildPlanet(p: PlanetPick, slot: number, ctx: Ctx): PlanetObject {
  const { shared, s, baker } = ctx;
  const time = shared.uTime;
  const planned = !p.built;
  const plans = ctx.showPlans;
  const R = planetRadius(p.kind, p.size);
  const orbitR = orbitRadius(slot, ctx.design);
  const speed = orbitSpeed(orbitR, ctx.sun);
  const a0 = startAngle(p.id);
  const band = p.kind === 'ringworld';
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  const spin = new THREE.Group();
  root.add(tilt);
  tilt.add(spin);
  tilt.rotation.z = p.kind === 'eyeball' ? 0 : TILTS[p.ring?.tilt ?? (p.id % 3)];
  const parts: P.Part[] = [];
  const disposables: { dispose(): void }[] = [];
  const mats: THREE.ShaderMaterial[] = []; // materials that want uCenter / ring uniforms
  let maps: PlanetMaps | null = null;
  const loaded: THREE.Texture[] = [];

  const has = <K extends string>(list: { kind: K; built?: boolean }[], k: K) => {
    const x = list.find((e) => e.kind === k);
    return shown(x, planned, plans) ? (isPlan(x, planned) ? 0.5 : 1) : 0;
  };
  const effect = (k: Parameters<typeof has>[1] & string) => has(p.effects as { kind: string; built?: boolean }[], k);
  const tech = (k: string) => has(p.tech as { kind: string; built?: boolean }[], k);
  const techPlan = (k: string) => isPlan(p.tech.find((t) => t.kind === k), planned);

  const lightning = effect('lightning');
  const clouds = p.clouds === 'none' && lightning ? 'thin' : p.clouds;
  const life = shown(p.life, planned, plans) ? p.life : null;
  const spec: PlanetMapSpec = {
    kind: p.kind,
    surface: p.surface,
    tint: p.tint,
    plants: ctx.sun ? SUNS[ctx.sun].plants : 0x3f8f3a,
    life: life?.kind ?? 'none',
    lifeAmt: life ? (isPlan(life, planned) ? 0.5 : 1) : 0,
    volcano: effect('volcano'),
    terraformer: tech('terraformer'),
    clouds: band ? 'none' : clouds,
    seed: (KIND_ID[p.kind] ?? 0) * 7 + p.surface * 3 + 1,
  };
  const sky = new THREE.Color(SKIES[p.sky] ?? SKIES[0]);
  const atmo = ATMO[p.kind] ?? 0.5;
  const pos = new THREE.Vector3();
  let pick: THREE.Object3D;
  let surfaceMat: THREE.ShaderMaterial | null = null;
  let cloudMesh: THREE.Mesh | null = null;
  let cloudMat: THREE.ShaderMaterial | null = null;
  let ringMesh: THREE.Mesh | null = null;
  let ringMat: THREE.ShaderMaterial | null = null;
  let ringOuter = 0;
  const ringTex = ringStrip(p.ring?.kind ?? 'dusty', p.id + 1);
  disposables.push(ringTex);

  const usePaint = (url: string | null, apply: (t: THREE.Texture) => void) => {
    if (!url) return;
    void ctx.load(url).then((t) => {
      if (!t) return;
      loaded.push(t);
      apply(t);
    });
  };

  // ---- the ring world: a band round the sun
  if (band) {
    const W = 13;
    const segs = s.level === 'simple' ? 128 : 360;
    const land = new THREE.CylinderGeometry(orbitR, orbitR, W, segs, 1, true);
    disposables.push(land);
    let landMesh: THREE.Mesh;
    if (planned) {
      const holo = hologramMaterial(time, 0.4);
      disposables.push(holo);
      landMesh = new THREE.Mesh(land, holo);
    } else {
      maps = baker.planet(spec);
      surfaceMat = surfaceMaterial(shared, ringTex, { albedo: maps.albedo, extra: maps.extra, clouds: null, radius: 2, bump: 0.04, mapMode: 1, repeat: 14, sky, atmo: 0, emisDay: 0 });
      surfaceMat.side = THREE.BackSide;
      surfaceMat.uniforms.uNightSquares.value = 1;
      disposables.push(surfaceMat);
      landMesh = new THREE.Mesh(land, surfaceMat);
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(orbitR + 0.25, orbitR + 0.25, W + 0.4, segs, 1, true), new THREE.MeshStandardMaterial({ color: 0x5a6070, metalness: 0.7, roughness: 0.5, emissive: 0x05070c }));
      disposables.push(hull.geometry, hull.material as THREE.Material);
      root.add(hull);
      const wallGeo = new THREE.RingGeometry(orbitR - 0.7, orbitR + 0.25, segs, 1);
      wallGeo.rotateX(-Math.PI / 2);
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x9aa0ac, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide });
      disposables.push(wallGeo, wallMat);
      for (const y of [W / 2, -W / 2]) {
        const w = new THREE.Mesh(wallGeo, wallMat);
        w.position.y = y;
        root.add(w);
      }
    }
    root.add(landMesh);
    pick = landMesh;
    landMesh.userData.pick = p.id;
    root.rotation.x = 0.06;
    return {
      id: p.id, root, radius: W, band: true, orbitR, pick, pos, hasRing: false, ringOuter: 0,
      update(sim, fx) {
        root.rotation.y = -sim * speed * 0.15;
        pos.set(Math.cos(sim * speed * 0.15) * orbitR, W * 0.5, Math.sin(sim * speed * 0.15) * orbitR);
        if (surfaceMat && maps) surfaceMat.uniforms.uReady.value = maps.ready ? 1 : 0;
        void fx;
      },
      dispose() {
        disposables.forEach((d) => d.dispose());
        if (maps) baker.release(maps);
      },
    };
  }

  // ---- the shape
  let geo: THREE.BufferGeometry = ctx.sphere;
  let shapeScale = R;
  if (p.kind === 'cube') {
    geo = new RoundedBoxGeometry(1.6, 1.6, 1.6, 6, 0.28);
    disposables.push(geo);
  } else if (p.kind === 'donut') {
    geo = new THREE.TorusGeometry(0.72, 0.36, s.segments / 3, s.segments);
    geo.rotateX(Math.PI / 2);
    disposables.push(geo);
    shapeScale = R * 1.15;
  }

  const bodies: THREE.Mesh[] = [];
  const shardDirs: THREE.Vector3[] = [];
  if (planned) {
    const holo = hologramMaterial(time, 5);
    disposables.push(holo);
    const m = new THREE.Mesh(geo, holo);
    m.scale.setScalar(shapeScale);
    spin.add(m);
    bodies.push(m);
  } else {
    maps = baker.planet(spec);
    surfaceMat = surfaceMaterial(shared, ringTex, {
      albedo: maps.albedo, extra: maps.extra, clouds: maps.clouds, radius: R,
      bump: p.kind === 'gas' || p.kind === 'icegiant' ? 0 : R * (p.kind === 'crystal' ? 0.035 : 0.022),
      sky, atmo, emisDay: p.kind === 'lava' ? 0.55 : p.kind === 'crystal' ? 0.25 : p.kind === 'shattered' ? 0.4 : 0.03,
      base: new THREE.Color(KIND_BASE[p.kind] ?? 0x6a6660),
      emisGain: p.kind === 'lava' ? 1.5 : 2.2,
    });
    surfaceMat.uniforms.uGlowSeas.value = effect('glowseas');
    surfaceMat.uniforms.uPulse.value = life?.kind === 'crystalfolk' || p.kind === 'crystal' ? 1 : 0;
    surfaceMat.uniforms.uCloudShadow.value = s.cloudShadows && maps.clouds ? 1 : 0;
    disposables.push(surfaceMat);
    mats.push(surfaceMat);
    const sm = surfaceMat;
    usePaint(planetArt(p.kind, p.surface, s.level), (t) => {
      sm.uniforms.uAlbedo.value = t;
      sm.uniforms.uPainted.value = 1;
      sm.uniforms.uTintA.value = (p.tint / 8) * Math.PI * 2;
    });
    if (p.kind === 'shattered') {
      const n = s.level === 'simple' ? 6 : 9;
      for (const sh of shards(p.id + 3, n)) {
        disposables.push(sh.geo);
        const m = new THREE.Mesh(sh.geo, surfaceMat);
        m.scale.setScalar(R);
        spin.add(m);
        bodies.push(m);
        shardDirs.push(sh.dir);
      }
      const core = new THREE.Mesh(ctx.sphere, new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 0.9, 0.2) }));
      disposables.push(core.material as THREE.Material);
      core.scale.setScalar(R * 0.38);
      spin.add(core);
    } else {
      const m = new THREE.Mesh(geo, surfaceMat);
      m.scale.setScalar(shapeScale);
      spin.add(m);
      bodies.push(m);
    }
    // the sky's glow round the edge
    if (atmo > 0 && p.kind !== 'shattered' && p.kind !== 'cube') {
      const scale = 1.035 + 0.045 * atmo;
      const am = atmosphereMaterial(shared, sky, 0.9 + atmo * 0.5, scale);
      disposables.push(am);
      mats.push(am);
      const shell = new THREE.Mesh(geo, am);
      shell.scale.setScalar(shapeScale * scale);
      tilt.add(shell);
    }
    // clouds
    if (maps.clouds) {
      cloudMat = cloudMaterial(shared, ringTex, maps.clouds, p.kind === 'gas' || p.kind === 'icegiant' ? 0.7 : 1);
      cloudMat.uniforms.uLightning.value = lightning;
      disposables.push(cloudMat);
      mats.push(cloudMat);
      const cm = cloudMat;
      usePaint(cloudArt(p.clouds, s.level), (t) => (cm.uniforms.uClouds.value = t));
      cloudMesh = new THREE.Mesh(geo, cloudMat);
      cloudMesh.scale.setScalar(shapeScale * (p.kind === 'gas' ? 1.006 : 1.014));
      tilt.add(cloudMesh);
    }
  }

  // ---- rings
  if (p.ring && shown(p.ring, planned, plans)) {
    const inner = R * 1.35, outer = ringOuterOf(R, p.ring.kind);
    ringOuter = outer;
    const rg = new THREE.RingGeometry(inner, outer, s.level === 'simple' ? 64 : 160, 1);
    rg.rotateX(-Math.PI / 2);
    disposables.push(rg);
    if (isPlan(p.ring, planned)) {
      const holo = hologramMaterial(time, 2);
      disposables.push(holo);
      ringMesh = new THREE.Mesh(rg, holo);
    } else {
      ringMat = ringMaterial(shared, ringTex, inner, outer, R, s.ringShadows, p.ring.kind === 'crystal' ? 1 : p.ring.kind === 'icy' ? 0.3 : 0);
      ringMat.vertexShader = ringMat.vertexShader.replace('vLocal=position;', 'vLocal=vec3(position.x,position.z,0.0);');
      disposables.push(ringMat);
      ringMesh = new THREE.Mesh(rg, ringMat);
      const rm = ringMat;
      usePaint(ringArt(p.ring.kind), (t) => (rm.uniforms.uRingTex.value = t));
      if (s.ringShadows) {
        for (const m of mats) {
          if (!m.uniforms.uHasRing) continue;
          m.uniforms.uHasRing.value = 1;
          m.uniforms.uRingRange.value.set(inner, outer);
        }
      }
    }
    tilt.add(ringMesh);
  }

  // ---- moons
  const moons: { pivot: THREE.Group; mesh: THREE.Mesh; r: number; w: number; ph: number; mat?: THREE.ShaderMaterial; maps?: PlanetMaps }[] = [];
  const shownMoons = p.moons.filter((m) => shown(m, planned, plans));
  shownMoons.forEach((m, i) => {
    const mr = moonSize(R, m.look, m.yours);
    const dist = moonDist(R, i, ringOuter);
    const pivot = new THREE.Group();
    pivot.rotation.x = 0.12 * (i - 1);
    pivot.rotation.z = 0.08 * i;
    let mesh: THREE.Mesh;
    let mm: THREE.ShaderMaterial | undefined;
    let mmaps: PlanetMaps | undefined;
    if (isPlan(m, planned)) {
      const holo = hologramMaterial(time, 4);
      disposables.push(holo);
      mesh = new THREE.Mesh(ctx.sphere, holo);
    } else {
      mmaps = baker.planet({ kind: 'moon', surface: m.look, tint: 0, plants: 0, life: 'none', lifeAmt: 0, volcano: 0, terraformer: 0, clouds: 'none', seed: m.look * 5 + 2 });
      mm = surfaceMaterial(shared, ringTex, { albedo: mmaps.albedo, extra: mmaps.extra, clouds: null, radius: mr, bump: mr * 0.03, sky, atmo: 0, emisDay: 0.2 });
      disposables.push(mm);
      const mmat = mm;
      usePaint(moonArt(m.look), (t) => { mmat.uniforms.uAlbedo.value = t; mmat.uniforms.uPainted.value = 1; });
      mesh = new THREE.Mesh(ctx.sphere, mm);
    }
    mesh.scale.setScalar(mr);
    pivot.add(mesh);
    tilt.add(pivot);
    if (i === 0 && tech('moonbase')) {
      const bl = P.baseLights(time, 1, s.pixelRatio);
      mesh.add(bl.obj);
      parts.push(bl);
    }
    moons.push({ pivot, mesh, r: dist, w: 0.9 / Math.sqrt(i + 1), ph: m.id * 1.7, mat: mm, maps: mmaps });
  });

  // ---- effects
  const add = (part: P.Part, parent: THREE.Object3D, hologram = false) => {
    if (hologram) P.asHologram(part.obj, time);
    parent.add(part.obj);
    parts.push(part);
  };
  const aur = effect('aurora');
  if (aur) add(P.aurora(shared, R, aur), tilt);
  const gey = effect('geysers');
  if (gey) add(P.geysers(time, R, Math.round(500 * s.particles), s.pixelRatio, gey), tilt);
  const met = effect('meteors');
  if (met) add(P.meteors(time, R, Math.round(28 * Math.max(0.5, s.particles))), tilt);
  const isl = effect('islands');
  if (isl) add(P.islands(R, s.level === 'simple' ? 4 : 8), spin);
  const tailAmt = effect('tail');
  let tail: ReturnType<typeof P.dustTail> | null = null;
  if (tailAmt) {
    tail = P.dustTail(time, R, Math.round(1600 * s.particles), s.pixelRatio, tailAmt);
    root.add(tail.obj);
    parts.push(tail);
  }

  // ---- technology
  if (tech('satellites')) {
    const r = P.rng(p.id * 3 + 1);
    const orbits: number[][] = [];
    for (let i = 0; i < 18; i++) orbits.push([R * (1.25 + r() * 0.5), (r() - 0.5) * 2.4, r() * 6.28, 0.6 + r() * 0.8, r() * 6.28]);
    add(P.orbiters(time, orbits, new THREE.Color(1.8, 1.7, 1.4), 3, s.pixelRatio), tilt);
  }
  const orbitPart = (part: P.Part, dist: number, w: number, k: string, incl: number) => {
    const piv = new THREE.Group();
    piv.rotation.x = incl;
    part.obj.position.x = dist;
    piv.add(part.obj);
    add({ obj: piv, update: (t, c) => { piv.rotation.y = t * w; part.update?.(t, c); }, dispose: () => part.dispose() }, tilt, techPlan(k));
  };
  if (tech('station')) orbitPart(P.station(R), R * (ringOuter ? 2.9 : 1.55) + 0.4, 0.35, 'station', 0.35);
  if (tech('telescope')) orbitPart(P.telescope(R), R * (ringOuter ? 3.2 : 2.1) + 0.6, -0.22, 'telescope', -0.5);
  if (tech('elevator')) add(P.elevator(R), spin, techPlan('elevator'));
  if (tech('domes')) add(P.domes(R, p.id + 9), spin, techPlan('domes'));
  if (tech('terraformer')) add(P.terraformer(R, time), spin, techPlan('terraformer'));
  if (tech('orbitalring')) add(P.orbitalRing(R, time), tilt, techPlan('orbitalring'));
  if (tech('engine')) add(P.engine(R, time), tilt, techPlan('engine'));

  // ---- tapping
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });
  disposables.push(pickMat);
  pick = new THREE.Mesh(ctx.sphere, pickMat);
  pick.scale.setScalar(Math.max(R * 1.4, 1.6));
  pick.userData.pick = p.id;
  root.add(pick);

  const spinRate = p.kind === 'gas' || p.kind === 'icegiant' ? 0.32 : 0.16;
  const center = new THREE.Vector3();
  const ringN = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  return {
    id: p.id, root, radius: R, band: false, orbitR, pick, pos, hasRing: !!ringMesh, ringOuter,
    update(sim, fx, cam) {
      const a = a0 + sim * speed;
      root.position.set(Math.cos(a) * orbitR, 0, Math.sin(a) * orbitR);
      pos.copy(root.position);
      spin.rotation.y = p.kind === 'eyeball' ? -a : sim * spinRate + p.id;
      if (cloudMesh) {
        cloudMesh.rotation.y = spin.rotation.y + sim * spinRate * 0.35 + fx * 0.004;
        if (surfaceMat) surfaceMat.uniforms.uCloudShift.value = (spin.rotation.y - cloudMesh.rotation.y) / (Math.PI * 2);
      }
      for (let i = 0; i < shardDirs.length; i++) {
        const drift = 0.32 + 0.07 * Math.sin(fx * 0.25 + i * 1.7);
        bodies[i].position.copy(shardDirs[i]).multiplyScalar(R * drift);
        bodies[i].rotation.set(Math.sin(fx * 0.05 + i) * 0.04, 0, Math.cos(fx * 0.04 + i) * 0.04);
      }
      for (const m of moons) {
        m.pivot.rotation.y = sim * m.w + m.ph;
        m.mesh.position.set(m.r, 0, 0);
        m.mesh.rotation.y = -m.pivot.rotation.y; // one face to the planet
        if (m.mat && m.maps) m.mat.uniforms.uReady.value = m.maps.ready ? 1 : 0;
      }
      root.updateMatrixWorld();
      center.copy(pos);
      ringN.set(0, 1, 0).applyQuaternion(tilt.quaternion);
      for (const m of mats) {
        m.uniforms.uCenter?.value.copy(center);
        m.uniforms.uRingN?.value.copy(ringN);
      }
      if (ringMat) {
        ringMat.uniforms.uCenter.value.copy(center);
        ringMat.uniforms.uNormal.value.copy(ringN);
      }
      if (surfaceMat && maps) {
        const ready = maps.ready ? 1 : 0;
        surfaceMat.uniforms.uReady.value = ready;
        if (cloudMat) cloudMat.uniforms.uReady.value = ready;
      }
      if (tail) {
        tmp.copy(shared.uLightPos.value[0]);
        tail.away.copy(pos).sub(tmp).normalize();
        tail.back.set(Math.sin(a), 0, -Math.cos(a));
      }
      for (const part of parts) part.update?.(fx, cam);
    },
    dispose() {
      for (const part of parts) part.dispose();
      disposables.forEach((d) => d.dispose());
      loaded.forEach((t) => t.dispose());
      if (maps) baker.release(maps);
      for (const m of moons) if (m.maps) baker.release(m.maps);
    },
  };
}
