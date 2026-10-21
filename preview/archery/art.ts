/**
 * A harness for the fight screen's canvas art (no React): a real fight from the engine, played
 * through createFightView. Pick a world, fire scripted shots (a direct-hit search or a near miss),
 * or let it auto-play. Hooks for browser checks live on window.__art.
 */
import { copyLand } from '../../shared/archery/land';
import { flyArrow } from '../../shared/archery/shot';
import { startFight, takeShot, type FightRun } from '../../shared/archery/fight';
import type { ArrowId, Shot, WorldId } from '../../shared/archery/types';
import { createFightView, type FightView } from '../../src/games/archery/renderer';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('fight');
const params = new URLSearchParams(location.search);
let world = (params.get('world') as WorldId) || 'forest';
let seed = Number(params.get('seed') || 7);
let run: FightRun;
let busy = false;
let autoOn = false;
let flight = { start: 0, ms: 0 };
const less = params.has('less');

const view: FightView = createFightView(canvas, { lessMotion: less, simple: params.has('simple'), names: ['You', 'Bolt'] });

function insets() {
  return { top: $('top').offsetHeight, bottom: $('bottom').offsetHeight, left: 0, right: 0 };
}
function size() {
  view.resize(window.innerWidth, window.innerHeight, insets());
}

function newFight() {
  run = startFight(seed, { world, players: [{ quiver: { steel: 5 }, shield: 0 }, { quiver: { steel: 5 }, shield: 0 }] });
  view.setRound(run.round);
  view.setTurn(run.round.turn);
  ($('world') as HTMLSelectElement).value = world;
}

/** The shot (at a few angles) whose landing is nearest the other archer, or offset by `miss` px. */
function plan(miss: number): Shot {
  const r = run.round, me = r.turn, them = r.archers[1 - me];
  const steel = ($('steel') as HTMLInputElement).checked && (run.used[me].steel ?? 0) < 5;
  const arrow: ArrowId = steel ? 'steel' : 'plain';
  let best: Shot = { angle: me === 0 ? 55 : 125, power: 60, arrow };
  let bestErr = Infinity;
  const target = them.x + miss;
  for (const a of [40, 50, 55, 60, 65, 70, 75]) {
    const angle = me === 0 ? a : 180 - a;
    for (let power = 30; power <= 100; power += 1) {
      const f = flyArrow(r.land, r.archers, me, { angle, power, arrow }, r.wind);
      let err = Math.abs(f.hit.x - target) + Math.abs(f.hit.y - them.y) * 0.5;
      if (miss === 0 && f.hit.kind === 'archer' && f.hit.archer === 1 - me) err = -1;
      if (f.hit.kind === 'gone' || f.hit.kind === 'timeout') err += 1000;
      if (err < bestErr) {
        bestErr = err;
        best = { angle, power, arrow };
      }
    }
    if (bestErr < 0) break;
  }
  return best;
}

async function fire(miss = 0) {
  if (busy || run.winner !== null) return;
  busy = true;
  try {
    const me = run.round.turn;
    const shot = plan(miss);
    await view.aimTo(me, shot.angle, 0.9, 700);
    const landBefore = copyLand(run.round.land);
    const archersBefore: [typeof run.round.archers[0], typeof run.round.archers[1]] = [{ ...run.round.archers[0] }, { ...run.round.archers[1] }];
    const taken = takeShot(run, shot, true);
    if (!taken.record) {
      $('msg').textContent = taken.problem ?? '';
      return;
    }
    const landAfter = taken.ended ? copyLand(taken.ended.land) : copyLand(run.round.land);
    view.setTurn(null);
    flight = { start: performance.now(), ms: ((taken.record.path?.length ?? 2) / 2 / 60) * 1000 };
    await view.playShot({ player: me, record: taken.record, landBefore, landAfter, archersBefore });
    const rec = taken.record;
    $('msg').textContent = `${me === 0 ? 'You' : 'Bolt'}: ${shot.arrow} ${shot.angle}° power ${shot.power} → ${rec.hit.kind}, damage ${rec.damage.join('/')}`;
    if (taken.ended) {
      const w = taken.ended.winner;
      if (w === 0 || w === 1) view.celebrate(w);
      await new Promise((r) => setTimeout(r, 2200));
      if (run.winner !== null) {
        seed++;
        newFight();
      } else {
        view.setRound(run.round);
      }
    }
    view.setTurn(run.round.turn);
    view.setAim(run.round.turn, run.round.turn === 0 ? 45 : 135, 0);
  } finally {
    busy = false;
  }
}

async function autoLoop() {
  while (autoOn) {
    await fire(Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 40));
    await new Promise((r) => setTimeout(r, 500));
  }
}

$('fire').onclick = () => void fire(0);
$('miss').onclick = () => void fire(run.round.turn === 0 ? -30 : 30);
$('newLand').onclick = () => {
  seed++;
  newFight();
};
($('world') as HTMLSelectElement).onchange = (e) => {
  world = (e.target as HTMLSelectElement).value as WorldId;
  newFight();
};
const toggle = (id: string, f: (on: boolean) => void) => {
  $(id).onclick = () => {
    const on = $(id).getAttribute('aria-pressed') !== 'true';
    $(id).setAttribute('aria-pressed', String(on));
    f(on);
  };
};
toggle('auto', (on) => {
  autoOn = on;
  if (on) void autoLoop();
});
toggle('simple', (on) => view.setOptions({ simple: on }));
toggle('less', (on) => view.setOptions({ lessMotion: on }));
if (less) $('less').setAttribute('aria-pressed', 'true');
window.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F' || e.key === ' ') void fire(0);
  if (e.key === 'm' || e.key === 'M') void fire(run.round.turn === 0 ? -30 : 30);
});
window.addEventListener('resize', size);
setInterval(() => {
  const s = view.stats();
  $('stats').textContent = `${s.fps} fps · draw ${s.frameMs} ms · ${s.quality} ×${s.pixelRatio} · ${s.particles} bits · slow ${s.slowSwitches}`;
}, 500);

size();
newFight();

declare global {
  interface Window { __art: unknown }
}
window.__art = {
  view,
  fire,
  setWorld(w: WorldId, s?: number) {
    world = w;
    if (s !== undefined) seed = s;
    newFight();
  },
  get run() {
    return run;
  },
  get busy() {
    return busy;
  },
  get flight() {
    return flight;
  },
};
