/**
 * A simple Goblin Storm player for the tests and the balance sim: it runs away from the monsters close by and always
 * takes the first card (evolutions come first). Not clever, so a run it survives is one a pupil can survive.
 */
import { applyPick, makeOffer, newRun, stepRun, waiting, type RunSetup, type RunState } from './engine';
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

export interface BotRun { state: RunState; steering: number[]; picks: number[]; choices: number[] }

/** Plays a whole run. `choiceFor(slot)` says how many cards each level-up earns (default: 3, a right answer). */
export function botRun(setup: RunSetup, choiceFor: (slot: number) => number = () => 3, maxSteps = Infinity): BotRun {
  const s = newRun(setup);
  const steering: number[] = [];
  const picks: number[] = [];
  const choices: number[] = [];
  while (s.outcome === 'running' && steering.length < maxSteps) {
    if (waiting(s)) {
      const c = choiceFor(s.levelUps);
      choices.push(c);
      makeOffer(s, c);
      picks.push(0);
      applyPick(s, 0);
      continue;
    }
    const d = botDirection(s);
    steering.push(d);
    stepRun(s, d);
  }
  return { state: s, steering, picks, choices };
}
