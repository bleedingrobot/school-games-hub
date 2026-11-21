/**
 * A simple Goblin Storm player for the tests and the balance sim: it runs away from the monsters close by and always
 * takes the first card (evolutions come first). Not clever, so a run it survives is one a pupil can survive.
 */
import { CHOICES, STORM, WEAPONS, questionSlot } from './config';
import { applyPick, makeOffer, newRun, stepRun, waiting, type RunSetup, type RunState, type Upgrade } from './engine';
import { DIR_X, DIR_Y, DIRECTIONS, STILL } from './trig';

export function botDirection(s: RunState): number {
  let ax = 0;
  let ay = 0;
  for (const e of s.enemies) {
    if (!e.alive) continue;
    const dx = s.hero.x - e.x;
    const dy = s.hero.y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 36 || d2 < 1e-6) continue;
    ax += dx / d2;
    ay += dy / d2;
  }
  if (ax === 0 && ay === 0) return Math.floor(s.t / 120) % 2 === 0 ? STILL : (Math.floor(s.t / 240) * 5) % DIRECTIONS;
  let best = 0;
  let bestDot = -Infinity;
  for (let d = 0; d < DIRECTIONS; d++) {
    const dot = DIR_X[d] * ax + DIR_Y[d] * ay;
    if (dot > bestDot) { bestDot = dot; best = d; }
  }
  return best;
}

/**
 * Steering more like a pupil's, for the balance sim: keep away from monsters close by (the nearest count most), and
 * when none are close, walk to the nearest gem. Never stands still.
 */
export function sensibleDirection(s: RunState): number {
  const h = s.hero;
  let ax = 0;
  let ay = 0;
  let close = false;
  for (const e of s.enemies) {
    if (!e.alive) continue;
    const dx = h.x - e.x;
    const dy = h.y - e.y;
    const reach = e.radius + 3;
    const d2 = dx * dx + dy * dy;
    if (d2 > reach * reach * 4 || d2 < 1e-6) continue;
    if (d2 < reach * reach) close = true;
    const w = (e.kind >= 3 ? 3 : 1) / (d2 * Math.sqrt(d2));
    ax += dx * w;
    ay += dy * w;
  }
  // Sky Citadel: step out of a lightning ring before it strikes (a pupil can see it glowing).
  const ring = STORM.lightning.radius + 1;
  for (const k of s.storm.strikes) {
    const dx = h.x - k.x;
    const dy = h.y - k.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > ring * ring) continue;
    close = true;
    const d = Math.sqrt(d2) || 0.01;
    const w = 40 / d;
    // Standing right in the middle: any way out will do.
    ax += (d2 < 1e-4 ? 1 : dx / d) * w;
    ay += (d2 < 1e-4 ? 0 : dy / d) * w;
  }
  if (!close) {
    let best = 100;
    let gx = 0;
    let gy = 0;
    for (const g of s.gems) {
      if (!g.alive) continue;
      const dx = g.x - h.x;
      const dy = g.y - h.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) { best = d2; gx = dx; gy = dy; }
    }
    if (best < 100) {
      const d = Math.sqrt(best) || 1;
      const len = Math.sqrt(ax * ax + ay * ay);
      ax += (gx / d) * (len + 0.05);
      ay += (gy / d) * (len + 0.05);
    }
  }
  if (ax === 0 && ay === 0) return (Math.floor(s.t / 180) * 5) % DIRECTIONS;
  let dir = 0;
  let bestDot = -Infinity;
  for (let d = 0; d < DIRECTIONS; d++) {
    const dot = DIR_X[d] * ax + DIR_Y[d] * ay;
    if (dot > bestDot) { bestDot = dot; dir = d; }
  }
  return dir;
}

/** Card choices more like a pupil's: evolve, level up a weapon you have, its partner passive, a new weapon, then anything. */
export function sensiblePick(s: RunState, offer: Upgrade[]): number {
  const partners = new Set(s.weapons.map((w) => WEAPONS[w.id].evolvesWith));
  const score = (u: Upgrade): number => {
    if (u.kind === 'evolve') return 100;
    if (u.kind === 'weapon') return u.level > 1 ? 60 - u.level : 40;
    if (u.kind === 'passive') return partners.has(u.id) ? 50 : u.id === 'armour' || u.id === 'heart' ? 30 : 20;
    return u.kind === 'heal' ? (s.hero.hp < s.hero.maxHp / 2 ? 45 : 5) : 1;
  };
  let best = 0;
  for (let i = 1; i < offer.length; i++) if (score(offer[i]) > score(offer[best])) best = i;
  return best;
}

export interface BotRun { state: RunState; steering: number[]; picks: number[]; choices: number[] }

/** How the bot steers and picks (default: runs from monsters, takes the first card). */
export interface BotStyle { steer?: (s: RunState) => number; pick?: (s: RunState, offer: Upgrade[]) => number }

/** Plays a whole run. `choiceFor(slot)` says how many cards each level-up question earns (default: 3, a right answer). */
export function botRun(setup: RunSetup, choiceFor: (slot: number) => number = () => 3, maxSteps = Infinity, style: BotStyle = {}): BotRun {
  const s = newRun(setup);
  const steering: number[] = [];
  const picks: number[] = [];
  const choices: number[] = [];
  while (s.outcome === 'running' && steering.length < maxSteps) {
    if (waiting(s)) {
      const slot = questionSlot(s.levelUps);
      const c = slot === null ? CHOICES.right : choiceFor(slot);
      if (slot !== null) choices.push(c);
      const offer = makeOffer(s, c);
      const p = style.pick ? style.pick(s, offer) : 0;
      picks.push(p);
      applyPick(s, p);
      continue;
    }
    const d = (style.steer ?? botDirection)(s);
    steering.push(d);
    stepRun(s, d);
  }
  return { state: s, steering, picks, choices };
}
