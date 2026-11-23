/**
 * Sky Climb, Class Showdown's third arena (docs/SHOWDOWN-PLAN.md section 4.3). Same round, modes, roles and big events
 * as Boss Bounty (the engine), with the boss's health standing in for the climb to the summit: every right answer is a
 * step up. Each pupil (or team) has their own climber on the projector, side by side; the class reaches the summit
 * together.
 *
 * What's different: every 3rd right answer in a row is a jump (extra height). The wind-up is a storm (a shield check);
 * when it passes, anyone who hasn't answered lately is blown back down a little, so the climb loses that height. The
 * weak spot is an updraft (double height), from the engine.
 */
import { SHOWDOWN } from './config';
import type { Player, Round, ShowdownEvent } from './types';

export const SKYCLIMB = {
  /** The summit is this much higher than the boss has health (jumps add height), tuned with the simulator to about
   *  the same 80% of rounds won as Boss Bounty. */
  summit: { class: 1.33, teams2: 1.31, teams4: 1.32, solo: 1.31 } as Record<Round['mode'], number>,
  /** Every this many right answers in a row is a jump. */
  jumpEvery: 3,
  /** A jump adds this many times the step's height on top. */
  jumpTimes: 1,
  /** A pupil who hasn't answered for this long when a storm passes is blown back down. */
  idleMs: 15000,
  /** How far: this many Striker steps (never below the ground). */
  blownSteps: 3,
} as const;

/** At the start: the summit is set. */
export function setSummit(r: Round) {
  r.boss.max = Math.round(r.boss.max * SKYCLIMB.summit[r.mode]);
  r.boss.hp = r.boss.max;
}

/** A right answer's extra height when it lands a jump (every 3rd in a row), with its event. */
export function jump(r: Round, p: Player, step: number, events: ShowdownEvent[]): number {
  if (step <= 0 || p.streak % SKYCLIMB.jumpEvery !== 0) return 0;
  const extra = step * SKYCLIMB.jumpTimes;
  events.push({ type: 'jump', t: r.t, pupil: p.id, extra });
  return extra;
}

/** A storm has passed: everyone who hasn't answered lately slips back down, and the climb loses that height. */
export function blowBack(r: Round, events: ShowdownEvent[]) {
  const drop = SHOWDOWN.damage.striker * SKYCLIMB.blownSteps;
  const pupils: string[] = [];
  let total = 0;
  for (const id of r.order) {
    const p = r.players[id];
    if (r.t - p.lastActive <= SKYCLIMB.idleMs || p.damage <= 0) continue;
    const amount = Math.min(p.damage, drop);
    p.damage -= amount;
    if (p.team) r.teamDamage[p.team] = Math.max(0, (r.teamDamage[p.team] ?? 0) - amount);
    total += amount;
    pupils.push(id);
  }
  if (!pupils.length) return;
  r.boss.hp = Math.min(r.boss.max, r.boss.hp + total);
  events.push({ type: 'blown_back', t: r.t, pupils, amount: drop, hp: r.boss.hp });
}
