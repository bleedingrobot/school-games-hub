/**
 * All 25 planets turning at once, painted or drawn, for James to look at (docs/TRADER-ART-PLAN.md, stage G.2) and for
 * the speed check. Hooks for browser checks are on window.__globes.
 */
import { PLANET_NAMES } from '../../shared/trader/config';
import { buildGlobeTable, spinGlobe } from '../../src/games/trader/art/globe';
import { loadPainting, MOON, planetMap } from '../../src/games/trader/art/paint';
import { drawPlanet, lookOf, usePaintedPlanets } from '../../src/games/trader/art/planets';

const NAMES = [...PLANET_NAMES, MOON];
const canvas = document.getElementById('c') as HTMLCanvasElement;
const g = canvas.getContext('2d') as CanvasRenderingContext2D;
const stats = document.getElementById('stats') as HTMLSpanElement;
const params = new URLSearchParams(location.search);

const state = { painted: !params.has('drawn'), simple: params.has('simple'), still: params.has('still'), fast: !params.has('slow'), size: params.get('size') ?? 'grid', focus: 0 };
const SIZES = ['grid', 'scene', 'chart'] as const;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduce) state.still = true;

function toggle(id: string, key: 'painted' | 'simple' | 'still' | 'fast') {
  const b = document.getElementById(id) as HTMLButtonElement;
  b.setAttribute('aria-pressed', String(state[key]));
  b.onclick = () => {
    state[key] = !state[key];
    b.setAttribute('aria-pressed', String(state[key]));
    usePaintedPlanets(state.painted);
  };
}
toggle('painted', 'painted');
toggle('simple', 'simple');
toggle('still', 'still');
toggle('fast', 'fast');
const sizeButton = document.getElementById('size') as HTMLButtonElement;
const sizeLabel = () => (sizeButton.textContent = `Size: ${state.size === 'scene' ? `scene (${NAMES[state.focus]})` : state.size}`);
sizeButton.onclick = () => {
  state.size = SIZES[(SIZES.indexOf(state.size as (typeof SIZES)[number]) + 1) % SIZES.length];
  sizeLabel();
};
sizeLabel();
canvas.onclick = () => {
  if (state.size === 'scene') state.focus = (state.focus + 1) % NAMES.length;
  sizeLabel();
};
usePaintedPlanets(state.painted);

let loaded = 0;
const ready = Promise.all(
  NAMES.flatMap((n) => [planetMap(n), planetMap(n, true)]).map((u) =>
    loadPainting(u as string).then((p) => {
      loaded++;
      return p;
    }),
  ),
);

/** Time the ball itself: a scene-sized planet (250 px on a 1.5× screen) spun `n` times from the full map. */
async function bench(n = 300, across = 375): Promise<{ across: number; pixels: number; msPerSpin: number; msPerTable: number }> {
  const map = await loadPainting(planetMap('Jupiter') as string);
  if (!map) throw new Error('no painting');
  const t0 = performance.now();
  const table = buildGlobeTable(across, map.w, map.h);
  const t1 = performance.now();
  const out = new Uint32Array(across * across);
  for (let i = 0; i < n; i++) spinGlobe(table, map.pixels, out, i / n);
  const t2 = performance.now();
  return { across, pixels: table.count, msPerSpin: (t2 - t1) / n, msPerTable: t1 - t0 };
}
(document.getElementById('bench') as HTMLButtonElement).onclick = async () => {
  stats.textContent = 'Timing…';
  const r = await bench();
  stats.textContent = `Ball ${r.across} px (${r.pixels.toLocaleString()} px): ${r.msPerSpin.toFixed(2)} ms a turn, table ${r.msPerTable.toFixed(0)} ms once`;
};

let frameMs = 0;
let last = performance.now();
let clock = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  clock += dt * (state.fast ? 10 : 1);
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const t0 = performance.now();
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#05070d';
  g.fillRect(0, 0, w, h);
  const top = 72;
  const opts = { t: clock, still: state.still, plain: state.simple, lights: 0 };
  if (state.size === 'scene') {
    drawPlanet(g, lookOf(NAMES[state.focus]), w / 2, top + (h - top) / 2, Math.min(125, (h - top) * 0.32, w * 0.3), opts);
  } else {
    const cols = Math.max(3, Math.floor(w / (state.size === 'chart' ? 90 : 150)));
    const rows = Math.ceil(NAMES.length / cols);
    const cw = w / cols;
    const ch = Math.max(90, (h - top) / rows);
    g.font = '12px system-ui, sans-serif';
    g.textAlign = 'center';
    NAMES.forEach((name, i) => {
      const cx = cw * (i % cols) + cw / 2;
      const cy = top + ch * Math.floor(i / cols) + ch / 2 - 8;
      const r = state.size === 'chart' ? Math.min(30, cw * 0.3) : Math.min(cw, ch) * 0.32;
      drawPlanet(g, lookOf(name), cx, cy, r, opts);
      g.fillStyle = '#9aa8c4';
      g.fillText(name, cx, cy + r + 18);
    });
  }
  frameMs = frameMs * 0.95 + (performance.now() - t0) * 0.05;
  if (loaded < NAMES.length * 2) stats.textContent = `Loading paintings ${loaded} of ${NAMES.length * 2}`;
  else if (!stats.textContent?.startsWith('Ball')) stats.textContent = `Drawing ${frameMs.toFixed(1)} ms a frame`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

(window as unknown as { __globes: unknown }).__globes = { ready, bench, state, frameMs: () => frameMs };
