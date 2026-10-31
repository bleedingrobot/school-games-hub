import { drawShip } from '../../src/games/trader/art/ships';
const c = document.getElementById('c') as HTMLCanvasElement;
const g = c.getContext('2d')!;
const q = new URLSearchParams(location.search);
const scale = Number(q.get('scale') ?? 2.3);
let t = 0;
function frame() {
  g.fillStyle = '#0b1226';
  g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 6; i++) drawShip(g, { side: 'trader', index: i }, 230 + (i % 3) * 470, 130 + Math.floor(i / 3) * 190, scale, { thrust: 0.6, t });
  for (let i = 0; i < 3; i++) drawShip(g, { side: 'pirate', index: i }, 230 + i * 470, 560, scale, { thrust: 0.6, t });
  t += 0.016;
  requestAnimationFrame(frame);
}
frame();
