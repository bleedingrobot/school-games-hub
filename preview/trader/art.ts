/** A harness for Star Trader's pictures alone (no React). Hooks for browser checks are on window.__art. */
import { createSpaceView } from '../../src/games/trader/renderer';
import { PLANET_NAMES } from '../../shared/trader/config';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const bar = document.getElementById('bar') as HTMLDivElement;
const view = createSpaceView(canvas, { lessMotion: params.has('less'), simple: params.has('simple') });
let planet = params.get('planet') ?? 'Saturn';
let ship = Number(params.get('ship') ?? 3);
let pirate = Number(params.get('pirate') ?? 1);
let nebula = Number(params.get('nebula') ?? 0);

function planetScene() {
  view.setScene({ kind: 'planet', planet, ship, nebula, lights: 0.8 });
}
function fightScene() {
  view.setScene({ kind: 'fight', planet, ship, pirate, nebula, lights: 0 });
}
const api = {
  planetScene, fightScene, view,
  set(p: { planet?: string; ship?: number; pirate?: number; nebula?: number }) {
    planet = p.planet ?? planet; ship = p.ship ?? ship; pirate = p.pirate ?? pirate; nebula = p.nebula ?? nebula;
  },
};
(window as unknown as { __art: typeof api }).__art = api;

function add(label: string, fn: () => void) {
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = fn;
  bar.append(b);
}
add('Planet scene', planetScene);
add('Fight scene', fightScene);
add('Warp', () => void view.warp());
add('You shoot', () => void view.shoot('you', {}));
add('Pirate shoots', () => void view.shoot('pirate', {}));
add('Shields', () => view.raiseShields(true));
add('Pirate boom', () => void view.explode('pirate'));
add('You boom', () => void view.explode('you'));
add('Flee', () => void view.flee());
add('Robbed', () => void view.robbed());
add('Reset', () => view.resetFight());
add('Next planet', () => { planet = PLANET_NAMES[(PLANET_NAMES.indexOf(planet as never) + 1) % PLANET_NAMES.length]; planetScene(); });
add('Next ship', () => { ship = (ship + 1) % 6; planetScene(); });
planetScene();
