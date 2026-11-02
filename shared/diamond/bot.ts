/**
 * Bot pupils for the simulator: they aim (well or badly), press Drop a little early or late, and answer Hold on!
 * questions right as often as their maths accuracy says. They play through the same engine the server replays.
 */
import { LAST_LEVEL, REEL_SPEED, ROCKS, SHOOT_SPEED, STARTER, SWING_RANGE, SWING_SPEED, gemOf, type BoostId, type Weight } from './config';
import { answer, levelKinds, levelResult, startLevel, step, type LevelResult, type LevelState } from './engine';
import { firstHit, type Thing } from './field';
import type { Random } from './random';

export interface Skill {
  /** Ticks a press can land early or late. */
  wobble: number;
  /** Picks among this many of its best-looking aims (1 = always the best). */
  choice: number;
  /** Chance of a right answer to a Hold on! question. */
  maths: number;
}

/** What a grab looks worth to a bot, per tick it costs (waiting, out and back). */
function worth(s: LevelState, t: Thing | null, length: number, wait: number, maths: number): number {
  let value = 0;
  let weight: Weight = 'empty';
  if (t?.kind === 'rock') weight = ROCKS[t.rock!].weight;
  else if (t?.kind === 'sack') { value = 8; weight = 'light'; }
  else if (t) {
    const gem = t.kind === 'crab' ? t.crab!.gem : t.gem;
    if (gem) {
      const g = gemOf(gem);
      weight = g.weight;
      value = t.value ?? g.value;
      if (gem === 'heartDiamond') value = 10_000;
      // A wrong answer loses it (for now), so a gem that slips is worth a bit less.
      else value *= 1 - g.slip * (1 - maths);
      // A kind not caught yet this level is worth more (the third star).
      if (!(s.caught[gem] ?? 0)) value *= 1.5;
    } else weight = 'light';
  }
  const ticks = wait + length / SHOOT_SPEED + length / REEL_SPEED[weight] + 1;
  return value / ticks;
}

/** Where the claw will point in each of the next `ahead` ticks, if nobody presses. */
function swingAhead(s: LevelState, ahead: number): number[] {
  let swing = s.swing;
  let dir = s.swingDir;
  const range = s.starterSwing ? STARTER.swingRange : SWING_RANGE;
  const speed = s.starterSwing ? STARTER.swingSpeed : SWING_SPEED;
  const out: number[] = [];
  for (let k = 0; k < ahead; k++) {
    out.push((swing - (swing % 10)) / 10);
    swing += dir * speed;
    if (swing > range) { swing = 2 * range - swing; dir = -1; }
    else if (swing < -range) { swing = -2 * range - swing; dir = 1; }
  }
  return out;
}

/** In how many ticks the bot means to press Drop (with its wobble added). */
export function planDrop(s: LevelState, skill: Skill, rng: Random): number {
  const period = Math.ceil((4 * SWING_RANGE) / SWING_SPEED);
  const angles = swingAhead(s, period);
  const buried = s.things.filter((t) => s.buried.has(t.id));
  const options: { k: number; score: number }[] = [];
  for (let k = 0; k < period; k++) {
    const hit = firstHit(buried, angles[k], s.tick + k + 20);
    let score = worth(s, hit?.thing ?? null, hit?.length ?? 700, k, skill.maths);
    // A rock in front of something good is worth clearing (a share of what's behind it).
    if (hit?.thing.kind === 'rock') {
      const behind = firstHit(buried.filter((t) => t !== hit.thing), angles[k], s.tick + k + 20);
      if (behind && behind.thing.kind !== 'rock') {
        const later = worth(s, behind.thing, behind.length, 0, skill.maths) * (behind.length / SHOOT_SPEED + 30);
        score = (0.4 * later) / (k + hit.length / SHOOT_SPEED + hit.length / REEL_SPEED[ROCKS[hit.thing.rock!].weight] + 1);
      }
    }
    options.push({ k, score });
  }
  options.sort((a, b) => b.score - a.score);
  const pick = options[rng.int(Math.min(skill.choice, options.length))];
  const k = pick.k + Math.round(rng.between(-skill.wobble, skill.wobble));
  return Math.max(0, k);
}

/** Play a whole level as a bot. Returns the result, the presses and the marks (so a replay can be checked). */
export function botLevel(level: number, seed: number, boosts: readonly BoostId[], skill: Skill, rng: Random, starter = false): { result: LevelResult; drops: number[]; marks: boolean[]; finish: number | null } {
  const s = startLevel(level, seed, boosts, starter);
  const drops: number[] = [];
  const marks: boolean[] = [];
  let finish: number | null = null;
  let pressAt = -1;
  const kinds = levelKinds(level);
  while (s.phase !== 'done') {
    if (s.phase === 'question') {
      const right = rng.fraction() < skill.maths;
      marks[s.waitingSlot!] = right;
      answer(s, right);
      continue;
    }
    let press: 'drop' | 'finish' | null = null;
    if (s.phase === 'swing') {
      // Done once passed with every kind caught (the bot isn't greedy for coins after that).
      if (s.passTick !== null && level !== LAST_LEVEL && kinds.every((k) => (s.caught[k] ?? 0) > 0)) {
        press = 'finish';
        finish = s.tick;
      } else {
        if (pressAt < s.tick) pressAt = s.tick + planDrop(s, skill, rng);
        if (pressAt === s.tick) { press = 'drop'; drops.push(s.tick); }
      }
    }
    step(s, press);
  }
  return { result: levelResult(s), drops, marks, finish };
}
