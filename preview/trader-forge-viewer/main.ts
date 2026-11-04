/**
 * Star Forge viewer preview: example systems in the 3D viewer, with no sign-in.
 * npx vite --config vite.trader-forge-viewer-preview.config.ts --port 5211
 */
import { newPlanet, type PlanetPick, type SunKind, type SystemDesign } from '../../shared/trader/system';
import { createSystemViewer } from '../../src/games/trader/forge/viewer';
import type { GraphicsLevel, SystemViewer } from '../../src/games/trader/forge/viewer/types';

const B = { built: true };
const planet = (id: number, kind: PlanetPick['kind'], extra: Partial<PlanetPick> = {}): PlanetPick => ({ ...newPlanet(id, kind), ...B, name: [(id * 7) % 60, id % 40], ...extra });

const DESIGNS: { name: string; design: SystemDesign; plans?: boolean }[] = [
  {
    name: 'Lush yellow star',
    design: {
      v: 1, name: [23, 5], background: 0, beltAfter: 4, comets: { count: 1, ...B },
      sun: { kind: 'yellow', name: [23, 0], ...B },
      belt: { kind: 'rocky', ...B },
      tech: [{ kind: 'lanes', ...B }],
      planets: [
        planet(1, 'lava', { size: 0, effects: [{ kind: 'volcano', ...B }], clouds: 'none' }),
        planet(2, 'desert', { size: 1, surface: 0, clouds: 'none', sky: 1 }),
        planet(3, 'ocean', { size: 2, clouds: 'storms', life: { kind: 'cities', creature: 0, ...B }, moons: [{ id: 1, look: 0, ...B }], tech: [{ kind: 'satellites', ...B }, { kind: 'station', ...B }], effects: [{ kind: 'aurora', ...B }] }),
        planet(4, 'jungle', { size: 1, clouds: 'thin', life: { kind: 'animals', creature: 0, ...B }, sky: 5 }),
        planet(5, 'gas', { size: 3, surface: 0, clouds: 'spot', ring: { kind: 'icy', tilt: 2, ...B }, moons: [{ id: 1, look: 4, ...B }, { id: 2, look: 5, ...B }, { id: 3, look: 2, ...B }], effects: [{ kind: 'lightning', ...B }] }),
      ],
    },
  },
  {
    name: 'Black hole',
    design: {
      v: 1, name: [26, 21], background: 2, beltAfter: 2, comets: null, belt: null,
      sun: { kind: 'blackhole', name: [19, 9], ...B },
      tech: [{ kind: 'gate', ...B }, { kind: 'sails', ...B }],
      planets: [
        planet(1, 'crystal', { size: 1, ring: { kind: 'crystal', tilt: 1, ...B }, life: { kind: 'crystalfolk', creature: 0, ...B }, tech: [{ kind: 'domes', ...B }] }),
        planet(2, 'ringworld', { size: 1, life: { kind: 'cities', creature: 0, ...B } }),
        planet(3, 'eyeball', { size: 1, life: { kind: 'plants', creature: 0, ...B }, tech: [{ kind: 'domes', ...B }], clouds: 'thin' }),
        planet(4, 'donut', { size: 2, clouds: 'thin', life: { kind: 'plants', creature: 0, ...B }, tech: [{ kind: 'domes', ...B }] }),
        planet(5, 'icegiant', { size: 2, surface: 1, ring: { kind: 'rainbow', tilt: 3, ...B }, moons: [{ id: 1, look: 1, ...B }] }),
      ],
    },
  },
  {
    name: 'Icy blue giant',
    design: {
      v: 1, name: [10, 17], background: 4, beltAfter: 3, comets: { count: 2, ...B },
      sun: { kind: 'blue', name: [44, 2], ...B },
      belt: { kind: 'icy', ...B },
      tech: [{ kind: 'miners', ...B }, { kind: 'dyson', ...B }],
      planets: [
        planet(1, 'rocky', { size: 0, effects: [{ kind: 'tail', ...B }], clouds: 'none' }),
        planet(2, 'cube', { size: 1, clouds: 'thin', tech: [{ kind: 'elevator', ...B }] }),
        planet(3, 'shattered', { size: 2, clouds: 'none' }),
        planet(4, 'ice', { size: 2, surface: 0, clouds: 'none', effects: [{ kind: 'aurora', ...B }, { kind: 'geysers', ...B }], moons: [{ id: 1, look: 3, ...B, yours: true }], tech: [{ kind: 'moonbase', ...B }] }),
        planet(5, 'icegiant', { size: 3, surface: 0, clouds: 'storms', effects: [{ kind: 'aurora', ...B }], ring: { kind: 'double', tilt: 1, ...B } }),
        planet(6, 'ocean', { size: 1, surface: 3, clouds: 'thick', life: { kind: 'sea', creature: 0, ...B }, effects: [{ kind: 'glowseas', ...B }], tech: [{ kind: 'orbitalring', ...B }] }),
      ],
    },
  },
  // The 14 planet maps repainted on 4 Nov, no clouds so the ground shows.
  {
    name: 'Repainted A',
    design: {
      v: 1, name: [12, 30], background: 1, beltAfter: 7, comets: null, belt: null,
      sun: { kind: 'yellow', name: [8, 3], ...B },
      tech: [],
      planets: [
        planet(1, 'donut', { size: 2, surface: 1, clouds: 'none' }),
        planet(2, 'ringworld', { size: 1, surface: 3 }),
        planet(3, 'eyeball', { size: 2, surface: 0, clouds: 'none' }),
        planet(4, 'shattered', { size: 2, surface: 1, clouds: 'none' }),
        planet(5, 'ocean', { size: 2, surface: 3, clouds: 'none' }),
        planet(6, 'jungle', { size: 2, surface: 0, clouds: 'none' }),
        planet(7, 'ice', { size: 2, surface: 2, clouds: 'none' }),
      ],
    },
  },
  {
    name: 'Repainted B',
    design: {
      v: 1, name: [13, 31], background: 3, beltAfter: 7, comets: null, belt: null,
      sun: { kind: 'white', name: [9, 4], ...B },
      tech: [],
      planets: [
        planet(1, 'donut', { size: 2, surface: 3, clouds: 'none' }),
        planet(2, 'ringworld', { size: 1, surface: 1 }),
        planet(3, 'eyeball', { size: 2, surface: 1, clouds: 'none' }),
        planet(4, 'eyeball', { size: 2, surface: 2, clouds: 'none' }),
        planet(5, 'eyeball', { size: 2, surface: 3, clouds: 'none' }),
        planet(6, 'shattered', { size: 2, surface: 0, clouds: 'none' }),
        planet(7, 'shattered', { size: 2, surface: 3, clouds: 'none' }),
      ],
    },
  },
  {
    name: 'Plans (holograms)',
    plans: true,
    design: {
      v: 1, name: [5, 10], background: 5, beltAfter: 2, comets: null,
      sun: { kind: 'red', name: [4, 4], ...B },
      belt: { kind: 'golden' },
      tech: [{ kind: 'lanes' }],
      planets: [
        planet(1, 'toxic', { size: 1, clouds: 'thick', life: { kind: 'plants', creature: 0, ...B }, effects: [{ kind: 'islands', ...B }] }),
        planet(2, 'rocky', { size: 2, built: false, ring: { kind: 'dusty', tilt: 2 } }),
        planet(3, 'gas', { size: 2, surface: 2, clouds: 'spot', ring: { kind: 'double', tilt: 1 }, moons: [{ id: 1, look: 6 }], life: { kind: 'floaters', creature: 0, ...B } }),
        planet(4, 'jungle', { size: 1, built: false, tech: [{ kind: 'engine' }] }),
        planet(5, 'lava', { size: 1, tech: [{ kind: 'engine', ...B }, { kind: 'telescope' }], effects: [{ kind: 'meteors', ...B }] }),
      ],
    },
  },
];

const SUN_KINDS: SunKind[] = ['yellow', 'red', 'blue', 'white', 'pulsar', 'binary', 'blackhole', 'baby'];
const stage = document.getElementById('stage')!;
const bar = document.getElementById('bar')!;
const stats = document.getElementById('stats')!;

// ?d=Black&f=2&still&shot: open a design (name start) and a close-up (planet number, sun or wide) with the buttons hidden,
// for taking pictures with a headless browser.
const q = new URLSearchParams(location.search);
let pick = Math.max(0, DESIGNS.findIndex((x) => x.name.startsWith(q.get('d') ?? '\u0000')));
let level: GraphicsLevel | 'auto' = (new URLSearchParams(location.search).get('level') as GraphicsLevel) || 'auto';
let sunOverride: SunKind | null = null;
let viewer: (SystemViewer & { debug?: () => { level: string; fps: number; calls: number; triangles: number } }) | null = null;
const still = new URLSearchParams(location.search).has('still');
let touring = false, labels = true, speed = 1, plansOn: boolean | null = null;

const current = (): SystemDesign => {
  const d = structuredClone(DESIGNS[pick].design);
  if (sunOverride && d.sun) d.sun.kind = sunOverride;
  return d;
};

async function make() {
  viewer?.dispose();
  viewer = null;
  const plans = plansOn ?? !!DESIGNS[pick].plans;
  viewer = await createSystemViewer(stage, current(), {
    level, showPlans: plans, labels, reducedMotion: still, onPick: (id) => (stats.dataset.pick = String(id)), onLevel: (l) => { stats.dataset.level = l; render(); },
  });
  viewer.setSpeed(speed);
  if (touring) viewer.tour(true);
  (window as unknown as { viewer: SystemViewer }).viewer = viewer;
  render();
}

function btn(label: string, on: boolean, click: () => void) {
  const b = document.createElement('button');
  b.textContent = label;
  if (on) b.className = 'on';
  b.onclick = click;
  bar.appendChild(b);
}
const sep = () => bar.appendChild(Object.assign(document.createElement('span'), { className: 'sep' }));

function render() {
  bar.textContent = '';
  DESIGNS.forEach((d, i) => btn(d.name, i === pick, () => { pick = i; sunOverride = null; plansOn = null; void make(); }));
  sep();
  const sel = document.createElement('select');
  sel.innerHTML = `<option value="">Sun: as designed</option>${SUN_KINDS.map((k) => `<option value="${k}" ${k === sunOverride ? 'selected' : ''}>${k}</option>`).join('')}`;
  sel.onchange = () => { sunOverride = (sel.value || null) as SunKind | null; viewer?.setDesign(current()); };
  bar.appendChild(sel);
  sep();
  (['auto', 'incredible', 'normal', 'simple'] as const).forEach((l) => btn(l === 'auto' ? `Auto${viewer ? ` (${viewer.level})` : ''}` : l[0].toUpperCase() + l.slice(1), level === l, () => {
    level = l;
    if (l === 'auto' || !viewer) void make();
    else { viewer.setLevel(l); render(); }
  }));
  sep();
  btn('🎬 Tour', touring, () => { touring = !touring; viewer?.tour(touring); render(); });
  [0, 1, 4, 16].forEach((n) => btn(n ? `${n}×` : 'Pause', speed === n, () => { speed = n; viewer?.setSpeed(n); render(); }));
  btn('🏷️ Names', labels, () => { labels = !labels; viewer?.setLabels(labels); render(); });
  btn('👻 Plans', plansOn ?? !!DESIGNS[pick].plans, () => { plansOn = !(plansOn ?? !!DESIGNS[pick].plans); void make(); });
  btn('Whole system', false, () => viewer?.focus(null));
  btn('Sun', false, () => viewer?.focus('sun'));
  DESIGNS[pick].design.planets.forEach((p, i) => btn(`${i + 1}`, false, () => viewer?.focus(p.id)));
  sep();
  btn('⛶ Full screen', false, () => void stage.requestFullscreen?.());
  btn('📷 Photo', false, async () => {
    if (!viewer) return;
    const blob = await viewer.snapshot(1920, 1080);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${DESIGNS[pick].name}.webp`;
    a.click();
  });
}

setInterval(() => {
  const d = viewer?.debug?.();
  if (d) stats.textContent = `${d.level} · ${d.fps.toFixed(0)} fps · ${d.calls} draws · ${(d.triangles / 1000).toFixed(0)}k tris`;
}, 500);

render();
void make().then(() => {
  const f = q.get('f');
  if (f) viewer?.focus(f === 'sun' ? 'sun' : f === 'wide' ? null : Number(f));
  if (q.has('shot')) { bar.style.display = 'none'; stats.style.display = 'none'; }
  document.body.dataset.ready = '1';
});

// For checking the looks from the browser console: view('Icy', 4, 'normal') shows a design, a planet and a level.
(window as unknown as { view: unknown }).view = async (d: string | null, target: number | 'sun' | null, lv?: GraphicsLevel) => {
  if (d) {
    const i = DESIGNS.findIndex((x) => x.name.startsWith(d));
    if (i >= 0) { pick = i; sunOverride = null; plansOn = null; await make(); }
  }
  if (lv) viewer?.setLevel(lv);
  viewer?.setSpeed(0);
  viewer?.focus(target);
  const g = viewer?.debug?.() as { timeFrame?: () => number } | undefined;
  return g?.timeFrame?.().toFixed(1);
};

// show(): lays the viewer's own photo over the page, so a hidden browser pane still gives an up-to-date picture.
// sizes(): each planet's width on screen in pixels, for checking the whole-system view.
(window as unknown as { show: unknown }).show = async (w = 800, h = 450) => {
  if (!viewer) return 'no viewer';
  const blob = await viewer.snapshot(w, h);
  let im = document.getElementById('dbgimg') as HTMLImageElement | null;
  if (!im) {
    im = document.createElement('img');
    im.id = 'dbgimg';
    Object.assign(im.style, { position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh', zIndex: '99999', pointerEvents: 'none' });
    document.body.appendChild(im);
  }
  im.src = URL.createObjectURL(blob);
  await new Promise((r) => (im!.onload = r));
  return 'ok';
};
(window as unknown as { hideShot: unknown }).hideShot = () => document.getElementById('dbgimg')?.remove();
(window as unknown as { sizes: unknown }).sizes = () => {
  type V = { clone(): V; project(c: unknown): V; addScaledVector(v: V, s: number): V; setFromMatrixColumn(m: unknown, i: number): V; x: number; y: number };
  const d = viewer?.debug?.() as unknown as { camera: { position: V & { constructor: new () => V }; matrixWorld: unknown }; planets: Map<number, { obj: { pos: V; radius: number; band: boolean } }> } | undefined;
  if (!d) return '';
  const right = new d.camera.position.constructor().setFromMatrixColumn(d.camera.matrixWorld, 0);
  const W = innerWidth, H = innerHeight;
  return [...d.planets].map(([id, { obj: p }]) => {
    if (p.band) return `${id}:band`;
    const a = p.pos.clone().project(d.camera), b = p.pos.clone().addScaledVector(right, p.radius).project(d.camera);
    return `${id}:${Math.round(Math.hypot(((b.x - a.x) * W) / 2, ((b.y - a.y) * H) / 2) * 2)}`;
  }).join(' ');
};
