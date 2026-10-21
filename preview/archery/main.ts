/**
 * A very plain test page for Archery Challenge's Stage 1 engine (no art, no server, no sign-in).
 * Two players share one screen. Every shot re-plays the whole fight with `playFight`, the way the
 * server will, and the new shot's flight is shown with a trail that fades within half a second.
 * There's no aiming line or ghost shot (James, 21 Oct 2026).
 */
import { arrowKind } from '../../shared/archery/arrows';
import { ARCHER_H, ARCHER_W, CELL, COLS, FIELD_H, FIELD_W, ROWS, STEPS_PER_SECOND, PATH_EVERY } from '../../shared/archery/config';
import { newRound, playFight } from '../../shared/archery/fight';
import { AIR, type ArrowId, type FightResult, type FightSetup, type Round, type Shot } from '../../shared/archery/types';

const STEEL_EACH = 6;
const setup: FightSetup = { players: [{ quiver: { steel: STEEL_EACH }, shield: 0 }, { quiver: { steel: STEEL_EACH }, shield: 0 }] };
const NAMES = ['Left archer', 'Right archer'];
const COLOURS = ['#2457c5', '#c53a24'];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('field');
const ctx = canvas.getContext('2d')!;
const angleIn = $<HTMLInputElement>('angle');
const powerIn = $<HTMLInputElement>('power');
const arrowIn = $<HTMLSelectElement>('arrow');
const fireBtn = $<HTMLButtonElement>('fire');

let seed = 0;
let shots: Shot[] = [];
let result: FightResult | null = null;
let shown: Round;
// Each player's numbers stay where they left them between turns.
const aims = [{ angle: 55, power: 60 }, { angle: 125, power: 60 }];
let flying = false;

const landCanvas = document.createElement('canvas');
landCanvas.width = COLS;
landCanvas.height = ROWS;
const landCtx = landCanvas.getContext('2d')!;

function newFight() {
  seed = (Math.random() * 4294967296) >>> 0;
  shots = [];
  result = null;
  shown = newRound(seed, 0, setup);
  $('log').textContent = 'New land. Left archer starts.';
  refresh();
}

function current(): Round {
  return result ? result.current : shown;
}

function turn(): number | null {
  if (!result) return 0;
  return result.nextPlayer;
}

function drawLand(round: Round) {
  const img = landCtx.createImageData(COLS, ROWS);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = (r * COLS + c) * 4;
      if (round.land.cells[r * COLS + c] === AIR) continue;
      const top = r === 0 || round.land.cells[(r - 1) * COLS + c] === AIR;
      const shade = ((c * 7 + r * 13) % 5) * 4;
      img.data[i] = top ? 70 : 120 - shade;
      img.data[i + 1] = top ? 140 : 84 - shade;
      img.data[i + 2] = top ? 60 : 52 - shade;
      img.data[i + 3] = 255;
    }
  }
  landCtx.putImageData(img, 0, 0);
}

function draw(round: Round, trail: number[] = [], head = -1) {
  const sky = ctx.createLinearGradient(0, 0, 0, FIELD_H);
  sky.addColorStop(0, '#7fb2e5');
  sky.addColorStop(1, '#d6e8f5');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  drawLand(round);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(landCanvas, 0, 0, COLS * CELL, ROWS * CELL);
  round.archers.forEach((a, i) => {
    ctx.globalAlpha = a.popped ? 0.25 : 1;
    ctx.fillStyle = COLOURS[i];
    ctx.fillRect(a.x - ARCHER_W / 2, a.y - ARCHER_H, ARCHER_W, ARCHER_H);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#111';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(a.popped ? 'POP!' : String(a.health), a.x, a.y - ARCHER_H - 6);
  });
  if (head >= 0) {
    // The trail: only the last half second of points, fading out.
    const keep = (STEPS_PER_SECOND / PATH_EVERY) / 2;
    const from = Math.max(0, head - keep);
    for (let k = from; k < head; k++) {
      ctx.strokeStyle = `rgba(30,30,30,${(k - from + 1) / keep})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(trail[k * 2], trail[k * 2 + 1]);
      ctx.lineTo(trail[k * 2 + 2], trail[k * 2 + 3]);
      ctx.stroke();
    }
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(trail[head * 2], trail[head * 2 + 1], 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function refresh() {
  const round = current();
  const t = turn();
  draw(round);
  const done = result && result.status === 'done';
  $('turn').textContent = done
    ? result!.winner === 'draw' ? 'Fight over: a draw' : `${NAMES[result!.winner as number]} wins the fight!`
    : `${NAMES[t ?? 0]}'s turn`;
  const w = round.wind;
  $('wind').textContent = `Wind ${w === 0 ? '0' : w > 0 ? `→ ${w}` : `← ${-w}`}`;
  const wins = result ? result.roundWins : [0, 0];
  $('round').textContent = `Round ${round.index + 1} (wins ${wins[0]}–${wins[1]})`;
  $('health').textContent = `Health ${round.archers[0].health} / ${round.archers[1].health}`;
  const p = t ?? 0;
  angleIn.value = String(aims[p].angle);
  powerIn.value = String(aims[p].power);
  $('angleOut').textContent = `${aims[p].angle}°`;
  $('powerOut').textContent = String(aims[p].power);
  const used = result ? result.used[p].steel ?? 0 : 0;
  const choice = arrowIn.value || 'plain';
  arrowIn.innerHTML = '';
  for (const id of ['plain', 'steel'] as ArrowId[]) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = id === 'plain' ? `${arrowKind(id).name} (always)` : `${arrowKind(id).name} (${STEEL_EACH - used} left)`;
    if (id === 'steel' && used >= STEEL_EACH) o.disabled = true;
    arrowIn.append(o);
  }
  arrowIn.value = choice === 'steel' && used >= STEEL_EACH ? 'plain' : choice;
  fireBtn.disabled = flying || !!done;
}

function fire() {
  if (flying || (result && result.status === 'done')) return;
  const p = turn() ?? 0;
  const before = current();
  const shot: Shot = { angle: aims[p].angle, power: aims[p].power, arrow: arrowIn.value as ArrowId };
  const next = playFight(seed, setup, [...shots, shot], { keepPaths: true });
  if (next.status === 'invalid') {
    $('log').textContent = `Can't shoot that: ${next.invalid}.`;
    return;
  }
  shots.push(shot);
  const rec = next.shots[next.shots.length - 1];
  const path = rec.path ?? [];
  const points = path.length / 2;
  flying = true;
  fireBtn.disabled = true;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start = performance.now();
  const step = (now: number) => {
    const head = reduce ? points - 1 : Math.min(points - 1, Math.floor(((now - start) / 1000) * (STEPS_PER_SECOND / PATH_EVERY)));
    draw(before, path, head);
    if (head < points - 1) requestAnimationFrame(step);
    else {
      flying = false;
      result = next;
      const what = rec.hit.kind === 'archer' ? `hit the ${rec.hit.archer === p ? 'shooter' : 'other archer'}!` : rec.hit.kind === 'land' || rec.hit.kind === 'floor' ? 'hit the land.' : 'flew off the field.';
      const roundOver = next.rounds.length && next.rounds[next.rounds.length - 1].index === rec.round && next.current.index !== rec.round;
      $('log').textContent = `${NAMES[p]}: ${shot.angle}°, power ${shot.power}, ${arrowKind(shot.arrow).name}, ${what} Damage ${rec.damage[0]} / ${rec.damage[1]}.${roundOver ? ' Round over: new land!' : ''}`;
      refresh();
    }
  };
  requestAnimationFrame(step);
}

function nudge(which: 'angle' | 'power', by: number) {
  if (flying) return;
  const p = turn() ?? 0;
  const max = which === 'angle' ? 180 : 100;
  aims[p][which] = Math.max(0, Math.min(max, aims[p][which] + by));
  refresh();
}

angleIn.addEventListener('input', () => { aims[turn() ?? 0].angle = Number(angleIn.value); refresh(); });
powerIn.addEventListener('input', () => { aims[turn() ?? 0].power = Number(powerIn.value); refresh(); });
document.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((b) => {
  const [which, by] = b.dataset.step!.split(':');
  b.addEventListener('click', () => nudge(which as 'angle' | 'power', Number(by)));
});
fireBtn.addEventListener('click', fire);
$('newLand').addEventListener('click', newFight);
document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLSelectElement) return;
  // Left/right: angle moves the bow towards that side.
  if (e.key === 'ArrowLeft') nudge('angle', 1);
  else if (e.key === 'ArrowRight') nudge('angle', -1);
  else if (e.key === 'ArrowUp') nudge('power', 1);
  else if (e.key === 'ArrowDown') nudge('power', -1);
  else if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) fire();
  else return;
  e.preventDefault();
});

newFight();
