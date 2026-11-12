/**
 * The Star Forge's full-screen 3D solar system (docs/TRADER-SYSTEM-PLAN.md, section 5): three.js, loaded only when a
 * Forge screen opens. Everything is drawn in code (./bake.ts) unless a painting is there (../art.ts).
 */
import * as THREE from 'three';
import type { SystemDesign } from '../../../../../shared/trader/system';
import { pieceName } from '../../../../../shared/trader/system';
import { skyArt, sunArt } from '../art';
import { Baker } from './bake';
import { CameraRig, type Pose, type Shot } from './camera';
import { belt, comets, orbitLines, SKY_R, sky, systemTech, zone } from './extras';
import { judgeFrames, levelSettings, LEVELS, startLevel, type LevelSettings } from './levels';
import { makeShared } from './materials';
import { beltRadius, layout, orbitRadius, sunExtent, systemRadius } from './orbits';
import type { Part } from './parts';
import { buildPlanet, type PlanetObject } from './planet';
import { makePost, type Post } from './post';
import { buildSun, type SunObject } from './sun';
import type { CreateViewer, GraphicsLevel, SystemViewer, ViewerOptions } from './types';

export type { GraphicsLevel, SystemViewer, ViewerOptions } from './types';

/** Painted skies are photos of the Milky Way; dimmed so the planets stand out against them. */
const PAINTED_SKY_BRIGHT = 0.45;
const LIGHT_GAIN: Record<string, number> = { yellow: 1.0, red: 0.95, blue: 1.2, white: 1.05, pulsar: 0.9, binary: 1.05, blackhole: 1.0, baby: 0.95 };

interface Piece<T> { key: string; obj: T }

export const createSystemViewer: CreateViewer = async (container, first, options: ViewerOptions = {}) => {
  const opts = { showPlans: false, labels: false, reducedMotion: false, interactive: true, ...options };
  const dpr = window.devicePixelRatio || 1;
  const auto = (opts.level ?? 'auto') === 'auto';
  let level: GraphicsLevel = auto ? startLevel(navigator, dpr) : (opts.level as GraphicsLevel);
  let s: LevelSettings = levelSettings(level, dpr);

  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: false });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 1);
  renderer.info.autoReset = false;
  const canvas = renderer.domElement;
  Object.assign(canvas.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none', outline: 'none' });
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);
  const labelLayer = document.createElement('div');
  Object.assign(labelLayer.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden' });
  container.appendChild(labelLayer);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, SKY_R * 1.3);
  const rig = new CameraRig(camera, canvas, opts.interactive);
  const shared = makeShared();
  const pointLights = [new THREE.PointLight(0xffffff, 2.5, 0, 0), new THREE.PointLight(0xffffff, 0, 0, 0)];
  scene.add(...pointLights, new THREE.AmbientLight(0x404858, 0.25));

  let design = first;
  let showPlans = opts.showPlans;
  let labelsOn = opts.labels;
  let speed = opts.reducedMotion ? 0 : 1;
  let width = 1, height = 1;
  let baker!: Baker;
  let post!: Post;
  let sphere!: THREE.SphereGeometry;
  let sunP: Piece<SunObject> | null = null;
  let skyP: Piece<Part> | null = null;
  let skyRT: THREE.WebGLRenderTarget | null = null;
  const planets = new Map<number, Piece<PlanetObject>>();
  const extras = new Map<string, Piece<Part>>();
  const textures = new Map<string, Promise<THREE.Texture | null>>();
  const loader = new THREE.TextureLoader();

  const load = (url: string | null): Promise<THREE.Texture | null> => {
    if (!url) return Promise.resolve(null);
    let p = textures.get(url);
    if (!p) {
      p = loader.loadAsync(url).then((t) => {
        t.colorSpace = THREE.NoColorSpace;
        t.wrapS = THREE.RepeatWrapping;
        t.anisotropy = s.anisotropy;
        return t;
      }).catch(() => null);
      textures.set(url, p);
    }
    // each user gets its own copy so disposing one doesn't break another
    return p.then((t) => (t ? t.clone() : null));
  };

  function setupLevel() {
    s = levelSettings(level, dpr);
    renderer.setPixelRatio(s.pixelRatio);
    baker = new Baker(renderer, s.texSize, s.octaves, s.anisotropy);
    sphere = new THREE.SphereGeometry(1, s.segments, s.segments / 2);
    post = makePost(renderer, scene, camera, s, width, height);
  }

  function clearScene() {
    if (sunP) { scene.remove(sunP.obj.group); sunP.obj.dispose(); sunP = null; }
    if (skyP) { scene.remove(skyP.obj.obj); skyP.obj.dispose(); skyP = null; }
    skyRT?.dispose();
    skyRT = null;
    for (const p of planets.values()) { scene.remove(p.obj.root); p.obj.dispose(); }
    planets.clear();
    for (const e of extras.values()) { scene.remove(e.obj.obj); e.obj.dispose(); }
    extras.clear();
    for (const el of labels.values()) el.remove();
    labels.clear();
  }

  const shownPlanets = () => [...planets.values()].map((p) => p.obj);

  /** Rebuilds only the pieces whose part of the design changed. */
  function apply(d: SystemDesign) {
    design = d;
    const sunKind = d.sun && (d.sun.built || showPlans) ? d.sun.kind : undefined;
    // sky
    const skyKey = `${d.background}`;
    if (skyP?.key !== skyKey) {
      if (skyP) { scene.remove(skyP.obj.obj); skyP.obj.dispose(); }
      skyRT?.dispose();
      skyRT = baker.sky(d.background, s.skySize);
      const part = sky(skyRT.texture, s, shared.uTime, d.background);
      skyP = { key: skyKey, obj: part };
      scene.add(part.obj);
      void load(skyArt(d.background, s.level)).then((t) => {
        if (!t || skyP?.obj !== part) return;
        const mesh = part.obj.children[0] as THREE.Mesh;
        const u = (mesh.material as THREE.ShaderMaterial).uniforms;
        u.uMap.value = t;
        u.uBright.value = PAINTED_SKY_BRIGHT;
      });
    }
    // sun
    const sunShown = d.sun && (d.sun.built || showPlans) ? d.sun : null;
    const sunKey = JSON.stringify([sunShown?.kind, sunShown?.built]);
    if (sunP?.key !== sunKey) {
      if (sunP) { scene.remove(sunP.obj.group); sunP.obj.dispose(); }
      const obj = buildSun(sunShown?.kind ?? null, !!sunShown?.built, s, shared.uTime, sphere, null);
      sunP = { key: sunKey, obj };
      scene.add(obj.group);
      if (sunShown) {
        void load(sunArt(sunShown.kind)).then((t) => {
          if (!t || sunP?.obj !== obj) return;
          obj.group.traverse((o) => {
            const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
            if (m?.uniforms?.uPainted) { m.uniforms.uMap.value = t; m.uniforms.uPainted.value = 1; }
          });
        });
      }
    }
    // planets
    const keep = new Set<number>();
    d.planets.forEach((p, slot) => {
      if (!p.built && !showPlans) return;
      keep.add(p.id);
      const key = JSON.stringify([p, slot, sunKind, d.sun?.kind, orbitRadius(slot, d)]);
      const old = planets.get(p.id);
      if (old?.key === key) return;
      if (old) { scene.remove(old.obj.root); old.obj.dispose(); }
      const obj = buildPlanet(p, slot, { shared, s, baker, sphere, sun: sunKind, design: d, showPlans, load });
      planets.set(p.id, { key, obj });
      scene.add(obj.root);
    });
    for (const [id, p] of planets) if (!keep.has(id)) { scene.remove(p.obj.root); p.obj.dispose(); planets.delete(id); }
    // the rest
    const extra = (name: string, key: string, make: () => Part | null) => {
      const old = extras.get(name);
      if (old?.key === key) return;
      if (old) { scene.remove(old.obj.obj); old.obj.dispose(); extras.delete(name); }
      const part = make();
      if (part) { extras.set(name, { key, obj: part }); scene.add(part.obj); }
    };
    const lay = layout(d).radii.map((r) => r.toFixed(2)).join(',');
    const beltShown = d.belt && (d.belt.built || showPlans) ? d.belt : null;
    extra('belt', JSON.stringify([beltShown, d.beltAfter, d.sun?.kind, lay]), () => (beltShown ? belt(shared, d, s, !beltShown.built) : null));
    const cometsShown = d.comets && (d.comets.built || showPlans) ? d.comets : null;
    extra('comets', JSON.stringify([cometsShown, d.planets.length, d.belt, d.sun?.kind, lay]), () => (cometsShown ? comets(shared, d, s, !cometsShown.built) : null));
    extra('tech', JSON.stringify([d.tech, d.belt, d.beltAfter, d.sun?.kind, d.planets.length, showPlans, lay]), () => (d.tech.length ? systemTech(shared, d, s, showPlans, shownPlanets) : null));
    extra('zone', JSON.stringify([showPlans, d.sun?.kind, lay]), () => (showPlans && d.sun ? zone(d) : null));
    extra('orbits', JSON.stringify([d.planets.map((p) => [p.kind, p.built]), d.sun?.kind, lay]), () => orbitLines(d, showPlans));
    syncLabels();
    rig.controls.maxDistance = systemRadius(d) * 4;
  }

  // ---------------------------------------------------------------- labels
  const labels = new Map<string, HTMLDivElement>();
  function syncLabels() {
    const want = new Map<string, { text: string; plan: boolean }>();
    if (labelsOn) {
      if (design.sun && sunP) want.set('sun', { text: pieceName(design.sun), plan: !design.sun.built });
      for (const p of design.planets) if (planets.has(p.id)) want.set(`p${p.id}`, { text: pieceName(p), plan: !p.built });
    }
    for (const [k, el] of labels) if (!want.has(k)) { el.remove(); labels.delete(k); }
    for (const [k, w] of want) {
      let el = labels.get(k);
      if (!el) {
        el = document.createElement('div');
        Object.assign(el.style, {
          position: 'absolute', left: '0', top: '0', whiteSpace: 'nowrap', font: '600 13px system-ui, sans-serif', letterSpacing: '0.02em',
          padding: '2px 8px', borderRadius: '999px', background: 'rgba(6,10,24,0.55)', border: '1px solid rgba(160,190,255,0.25)',
          textShadow: '0 1px 3px #000', willChange: 'transform', display: 'none',
        });
        labelLayer.appendChild(el);
        labels.set(k, el);
      }
      el.textContent = w.plan ? `${w.text} (plan)` : w.text;
      el.style.color = w.plan ? '#9fd2ff' : '#eef3ff';
    }
  }
  const proj = new THREE.Vector3();
  const placed: { x: number; y: number; w: number; z: number; el: HTMLElement }[] = [];
  function placeLabels() {
    placed.length = 0;
    for (const [k, el] of labels) {
      let y = 0;
      if (k === 'sun') { proj.set(0, 0, 0); y = sunP ? sunP.obj.radius * 1.6 + 1 : 2; }
      else {
        const p = planets.get(Number(k.slice(1)))?.obj;
        if (!p) continue;
        proj.copy(p.pos);
        y = p.band ? 3 : p.radius * 1.35 + 0.4;
      }
      proj.y += y;
      proj.project(camera);
      const vis = proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1;
      if (!vis) { el.style.display = 'none'; continue; }
      placed.push({ x: ((proj.x + 1) / 2) * width, y: ((1 - proj.y) / 2) * height, w: el.offsetWidth || el.textContent!.length * 8 + 16, z: proj.z, el });
    }
    // nearest first; a name that would sit on top of a nearer one waits until they move apart
    placed.sort((a, b) => a.z - b.z);
    for (let i = 0; i < placed.length; i++) {
      const a = placed[i];
      // a name only shows once it has its words (never an empty dark pill)
      const hit = !a.el.textContent?.trim() || placed.slice(0, i).some((b) => b.el.style.display !== 'none' && Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < 22);
      a.el.style.display = hit ? 'none' : 'block';
      if (!hit) a.el.style.transform = `translate(${a.x}px, ${a.y}px) translate(-50%, -100%)`;
    }
  }

  // ---------------------------------------------------------------- camera targets
  /**
   * The wide shot that fits the circle of radius r round the sun on screen, looking down at `elev`: how far back the
   * camera stands, and how far towards the camera it aims (the near side of the circle looks bigger, so aiming a little
   * towards it centres the system and lets the camera come closer).
   */
  const fitCam = new THREE.PerspectiveCamera();
  const fitPt = new THREE.Vector3();
  const fitWide = (r: number, elev: number): { dist: number; shift: number } => {
    fitCam.fov = camera.fov;
    fitCam.aspect = camera.aspect;
    fitCam.near = 0.5;
    fitCam.far = 1e6;
    fitCam.updateProjectionMatrix();
    let yMin = 0, yMax = 0;
    const fits = (dist: number, shift: number) => {
      fitCam.position.set(shift + dist * Math.cos(elev), dist * Math.sin(elev), 0);
      fitCam.lookAt(shift, 0, 0);
      fitCam.updateMatrixWorld();
      yMin = 1; yMax = -1;
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        fitPt.set(Math.cos(a) * r, 0, Math.sin(a) * r).project(fitCam);
        if (fitPt.z > 1 || Math.abs(fitPt.x) > 0.95 || Math.abs(fitPt.y) > 0.9) return false;
        yMin = Math.min(yMin, fitPt.y); yMax = Math.max(yMax, fitPt.y);
      }
      return true;
    };
    let shift = 0, dist = r * 3;
    for (let round = 0; round < 4; round++) {
      let lo = r * 0.3, hi = r * 8;
      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid, shift)) hi = mid;
        else lo = mid;
      }
      dist = hi;
      fits(dist, shift);
      // nudge the aim towards whichever edge has more room
      shift -= ((yMin + yMax) / 2) * r * 0.5;
    }
    return { dist, shift };
  };
  const WIDE_ELEV = 0.52;
  const wide = (out: Pose, az?: number) => {
    const r = systemRadius(design);
    const a = az ?? Math.atan2(camera.position.z, camera.position.x);
    const { dist, shift } = fitWide(r, WIDE_ELEV);
    out.target.set(Math.cos(a) * shift, 0, Math.sin(a) * shift);
    out.pos.set(Math.cos(a) * (shift + dist * Math.cos(WIDE_ELEV)), dist * Math.sin(WIDE_ELEV), Math.sin(a) * (shift + dist * Math.cos(WIDE_ELEV)));
  };
  const viewOf = (p: PlanetObject, out: Pose, angle = 0.65, distK = 1, up = 0.28) => {
    out.target.copy(p.pos);
    if (p.band) {
      // from inside the ring, a little way round and above, so the band sweeps across the picture with its land facing in
      const R = p.orbitR, a = Math.atan2(p.pos.z, p.pos.x) + 1.9;
      out.pos.set(Math.cos(a) * R * 0.8, p.pos.y + R * 0.22, Math.sin(a) * R * 0.8);
      return;
    }
    const dist = (p.hasRing ? p.ringOuter * 2.1 : p.radius * 4.2) * distK + 1;
    const toSun = p.pos.clone().negate().setY(0).normalize();
    toSun.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    toSun.y = up;
    out.pos.copy(p.pos).addScaledVector(toSun.normalize(), dist);
  };

  function focus(target: number | 'sun' | null) {
    const dur = opts.reducedMotion ? 0 : 2.4;
    if (target === null) return rig.flyTo((o) => wide(o, Math.atan2(camera.position.z, camera.position.x)), null, dur, 2);
    if (target === 'sun') {
      const r = sunExtent(design.sun?.kind);
      return rig.flyTo((o) => { o.target.set(0, 0, 0); o.pos.set(r * 2.6, r * 0.9, r * 2.6); }, null, dur, (sunP?.obj.radius ?? 2) * 1.3);
    }
    const p = planets.get(target)?.obj;
    if (!p) return;
    rig.flyTo((o) => viewOf(p, o), () => p.pos, dur, p.band ? 2 : p.radius * 1.4);
  }

  function tourShots(): Shot[] {
    const shots: Shot[] = [];
    const r = systemRadius(design);
    const az = Math.atan2(camera.position.z, camera.position.x);
    const fd = fitWide(r, WIDE_ELEV).dist;
    shots.push({ dur: 13, at: (u, o) => { o.target.set(0, 0, 0); const a = az + u * 0.7; const e = WIDE_ELEV + 0.15 - u * 0.3, dd = fd * (1.05 - u * 0.2); o.pos.set(Math.cos(a) * dd * Math.cos(e), dd * Math.sin(e), Math.sin(a) * dd * Math.cos(e)); } });
    const ps = shownPlanets().filter((p) => !p.band).slice(0, 6);
    for (const p of ps) {
      shots.push({
        dur: 9,
        at: (u, o) => {
          if (p.hasRing) {
            // swing down through the rings
            viewOf(p, o, -0.9 + u * 1.8, 1.25 - u * 0.55, 0.45 - u * 0.75);
          } else viewOf(p, o, -0.9 + u * 1.8, 1.35 - u * 0.5, 0.35 - u * 0.2);
        },
      });
    }
    const ring = shownPlanets().find((p) => p.band);
    if (ring) shots.push({ dur: 9, at: (u, o) => { const a = -1 + u * 1.2; o.pos.set(Math.cos(a) * ring.orbitR * 0.8, 5, Math.sin(a) * ring.orbitR * 0.8); o.target.set(Math.cos(a + 0.5) * ring.orbitR, 0, Math.sin(a + 0.5) * ring.orbitR); } });
    if (extras.has('belt')) {
      const br = beltRadius(design);
      shots.push({ dur: 10, at: (u, o) => { const a = az + 1 + u * 0.5; o.pos.set(Math.cos(a) * (br - 3), 2.5, Math.sin(a) * (br - 3)); const b = a + 0.25; o.target.set(Math.cos(b) * br, 0, Math.sin(b) * br); } });
    }
    const se = sunExtent(design.sun?.kind);
    shots.push({ dur: 10, at: (u, o) => { o.target.set(0, 0, 0); const a = az + 2 + u * 0.6; const d = se * (5 - u * 2.2); o.pos.set(Math.cos(a) * d, se * (1.6 - u * 0.9), Math.sin(a) * d); } });
    return shots;
  }

  // ---------------------------------------------------------------- picking and keys
  const ray = new THREE.Raycaster();
  let down: { x: number; y: number; t: number } | null = null;
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; canvas.focus({ preventScroll: true }); };
  const onUp = (e: PointerEvent) => {
    if (!down || !opts.interactive) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 500;
    down = null;
    if (moved > 6 || !quick) return;
    const rect = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
    const targets: THREE.Object3D[] = shownPlanets().map((p) => p.pick);
    if (sunP) targets.push(sunP.obj.pick);
    const hit = ray.intersectObjects(targets, false)[0];
    const id = hit?.object.userData.pick;
    if (typeof id === 'number') { focus(id); opts.onPick?.(id); }
    else if (id === 'sun') { focus('sun'); opts.onPick?.(null); }
    else opts.onPick?.(null);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  const onKey = (e: KeyboardEvent) => {
    if (!opts.interactive || !container.isConnected) return;
    const t = e.target as HTMLElement | null;
    if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
    const act = document.activeElement;
    if (act && act !== document.body && !container.contains(act) && !(document.fullscreenElement?.contains(container))) return;
    const k = e.key;
    if (k === 'ArrowLeft') rig.nudge(-0.12, 0, 1);
    else if (k === 'ArrowRight') rig.nudge(0.12, 0, 1);
    else if (k === 'ArrowUp') rig.nudge(0, -0.08, 1);
    else if (k === 'ArrowDown') rig.nudge(0, 0.08, 1);
    else if (k === '+' || k === '=') rig.nudge(0, 0, 0.85);
    else if (k === '-' || k === '_') rig.nudge(0, 0, 1.18);
    else if (k === 'Escape') { focus(null); return; }
    else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);

  // ---------------------------------------------------------------- sizes
  function resize() {
    const r = container.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width));
    height = Math.max(1, Math.round(r.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    post.setSize(width, height, s.pixelRatio);
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(container);

  // ---------------------------------------------------------------- each frame
  const tmpV = new THREE.Vector3();
  const lens = new THREE.Vector2();
  let sim = 0, fx = 0;
  function step(dt: number) {
    sim += dt * speed;
    if (!opts.reducedMotion || speed > 0) fx += dt;
    shared.uTime.value = fx;
    const sun = sunP?.obj;
    sun?.update(fx, camera);
    const gain = LIGHT_GAIN[design.sun?.kind ?? 'yellow'] ?? 1;
    const lights = sun?.lights ?? [{ pos: new THREE.Vector3(), col: new THREE.Color(0.6, 0.65, 0.75) }];
    shared.uLightCount.value = lights.length;
    lights.forEach((l, i) => {
      shared.uLightPos.value[i].copy(l.pos);
      shared.uLightCol.value[i].copy(l.col).multiplyScalar(gain);
      pointLights[i].position.copy(l.pos);
      pointLights[i].color.copy(l.col);
      pointLights[i].intensity = 2.6 * gain;
    });
    if (lights.length < 2) pointLights[1].intensity = 0;
    shared.uBeamOn.value = sun?.beam ? 1 : 0;
    if (sun?.beam) shared.uBeamDir.value.copy(sun.beam);
    for (const p of planets.values()) p.obj.update(sim, fx, camera);
    for (const e of extras.values()) e.obj.update?.(fx, camera);
    rig.update(dt);
    skyP?.obj.update?.(fx, camera);
    // a near plane as far out as it can be, for depth precision from close-ups to the wide shot
    let near = 1e9;
    for (const p of planets.values()) near = Math.min(near, camera.position.distanceTo(p.obj.pos) - (p.obj.band ? p.obj.orbitR + 4 : Math.max(p.obj.ringOuter, p.obj.radius * 1.6) + 2));
    if (sun) near = Math.min(near, camera.position.length() - sunExtent(design.sun?.kind) * 3);
    camera.near = THREE.MathUtils.clamp(near * 0.35, 0.02, 25);
    camera.updateProjectionMatrix();
    if (sun?.hole) {
      tmpV.set(0, 0, 0).project(camera);
      const dist = camera.position.length();
      const rad = Math.atan(sun.hole.radius / dist) / THREE.MathUtils.degToRad(camera.fov / 2) / 2;
      const inFront = tmpV.z < 1 && Math.abs(tmpV.x) < 1.6 && Math.abs(tmpV.y) < 1.6;
      post.setLens(inFront ? lens.set((tmpV.x + 1) / 2, (tmpV.y + 1) / 2) : null, rad, width / height);
    } else post.setLens(null, 0, 1);
    post.tick(fx);
  }

  let raf = 0;
  let last = performance.now();
  let lastDraw = 0;
  let frames = 0;
  let calibrating = auto;
  let gaps: number[] = [];
  let disposed = false;
  let frameMs = 0;
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const cap = calibrating ? 0 : s.fpsCap;
    if (cap && now - lastDraw < 1000 / cap - 3) return;
    const gap = now - lastDraw;
    lastDraw = now;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const busy = baker.busy;
    if (busy) baker.run(level === 'simple' ? 8 : 4);
    step(dt);
    renderer.info.reset();
    post.render();
    if (labelsOn) placeLabels();
    frames++;
    frameMs = frameMs * 0.95 + gap * 0.05;
    if (auto && !busy && frames > 15 && gap < 400) {
      gaps.push(gap);
      if (calibrating && gaps.length >= 60) {
        calibrating = false;
        const next = judgeFrames(level, gaps);
        gaps = [];
        if (next !== level) changeLevel(next);
      } else if (!calibrating && gaps.length >= 150) {
        const next = level === 'simple' ? level : judgeFrames(level, gaps.map((g) => g / 1.3));
        gaps = [];
        if (next !== level) changeLevel(next);
      }
    }
  }
  function start() {
    if (disposed || raf) return;
    last = performance.now();
    lastDraw = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  const onVis = () => {
    if (document.hidden) stop();
    else { gaps = []; frames = 0; start(); }
  };
  document.addEventListener('visibilitychange', onVis);

  function changeLevel(next: GraphicsLevel) {
    if (next === level && post) return;
    level = next;
    clearScene();
    post.dispose();
    baker.dispose();
    sphere.dispose();
    setupLevel();
    resize();
    apply(design);
    baker.run();
    frames = 0;
    gaps = [];
    opts.onLevel?.(level);
  }

  // ---------------------------------------------------------------- go
  setupLevel();
  resize();
  apply(first);
  baker.run();
  wide({ pos: camera.position, target: rig.controls.target }, 0.9);
  camera.lookAt(0, 0, 0);
  rig.controls.update();
  rig.onTakeOver = () => {};
  step(0);
  post.render();
  start();
  opts.onLevel?.(level);

  /** Debug: counts pixels that are not finite numbers in a float render, so a broken shader can be found. */
  function probe(): { bad: number; max: number; over: number } {
    const w = 256, h = 192;
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType });
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    const buf = new Float32Array(w * h * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
    rt.dispose();
    let bad = 0, max = 0, over = 0;
    for (let i = 0; i < buf.length; i += 4) {
      const v = Math.max(buf[i], buf[i + 1], buf[i + 2]);
      if (!Number.isFinite(buf[i] + buf[i + 1] + buf[i + 2])) bad++;
      else { max = Math.max(max, v); if (v > 60000) over++; }
    }
    return { bad, max, over };
  }

  /** Debug: how long one whole frame takes to draw, waiting for the GPU to finish (ms, median of 9). */
  function timeFrame(): number {
    const gl = renderer.getContext();
    const px = new Uint8Array(4);
    const t: number[] = [];
    for (let i = 0; i < 9; i++) {
      const t0 = performance.now();
      step(0);
      post.render();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      t.push(performance.now() - t0);
    }
    return t.sort((a, b) => a - b)[4];
  }

  const viewer: SystemViewer & { debug: () => object } = {
    setDesign(d) { apply(d); },
    async ready() {
      // Paintings start loading as pieces are made, and each is put on its piece just after it arrives.
      for (let n = 0; n < 3; n++) await Promise.allSettled([...textures.values()]);
      await new Promise((r) => setTimeout(r, 50));
    },
    focus,
    tour(on) {
      if (on && !opts.reducedMotion) rig.startTour(tourShots());
      else rig.stopTour();
    },
    setSpeed(n) { speed = Math.max(0, n); },
    setLabels(on) { labelsOn = on; syncLabels(); if (on) placeLabels(); },
    setLevel(l) {
      if (!LEVELS.includes(l)) return;
      calibrating = false;
      if (l !== level) changeLevel(l);
    },
    get level() { return level; },
    snapshot(w, h) {
      const max = renderer.capabilities.maxTextureSize;
      const sw = Math.max(16, Math.min(max, Math.round(w))), sh = Math.max(16, Math.min(max, Math.round(h)));
      baker.run();
      renderer.setPixelRatio(1);
      renderer.setSize(sw, sh, false);
      camera.aspect = sw / sh;
      camera.updateProjectionMatrix();
      post.setSize(sw, sh, 1);
      step(0);
      post.render();
      const done = new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No picture'))), 'image/webp', 0.92));
      renderer.setPixelRatio(s.pixelRatio);
      resize();
      step(0);
      post.render();
      return done;
    },
    dispose() {
      disposed = true;
      stop();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('keydown', onKey);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      clearScene();
      post.dispose();
      baker.dispose();
      sphere.dispose();
      rig.dispose();
      for (const p of textures.values()) void p.then((t) => t?.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      labelLayer.remove();
    },
    /** For the preview page: frame time and draw calls. */
    debug: () => ({ level, fps: frameMs ? 1000 / frameMs : 0, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, busy: baker.busy, scene, renderer, camera, rig, planets, step, probe, timeFrame }),
  };
  return viewer;
};
