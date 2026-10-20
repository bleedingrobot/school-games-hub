/**
 * A long, busy workload used to prove the rules give bit-for-bit the same answers everywhere
 * (docs/MINE-PLAN.md, section 4). `determinismReport` plays odd, random-looking runs on every
 * level in steady and free flight and writes down the whole state every 100 steps. The test pins
 * the text in Node; Stage 3 adds a script that runs it in real WebKit and Chromium and compares.
 */
import { makeWorld, newRun, stateKey, stepRun } from './engine';
import { GRANT, HOLD, PENALTY, packInput } from './inputs';
import { RECIPES, makeLevel } from './level';

/** A small repeatable stream of numbers (integers only, so it is exact everywhere). */
function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 48271) % 2147483647;
    return s;
  };
}

export function determinismReport(): string {
  const lines: string[] = [];
  for (const recipe of RECIPES) {
    const level = makeLevel(recipe);
    for (const steady of [true, false]) {
      for (const seed of [7, 99]) {
        const next = lcg(seed);
        const w = makeWorld(level, { steady });
        const s = newRun(w);
        let tx = 0, ty = 0, tz = 0, yaw = 0, pitch = 0, roll = 0;
        for (let i = 0; i < 1500 && s.outcome === 'running'; i++) {
          if (i % 15 === 0) {
            tx = (next() % 3) - 1;
            ty = (next() % 3) - 1;
            tz = (next() % 3) - 1;
            yaw = (next() % 13) - 6;
            pitch = (next() % 13) - 6;
            roll = (next() % 3) - 1;
          }
          const r = next() % 300;
          // Every so often a held pause, a wrong answer or a made-up grant, so those are covered too.
          const code = r === 0 ? HOLD : r === 1 ? PENALTY : r === 2 ? GRANT + (next() % (level.doors.length + level.pads.length)) : packInput({ tx, ty, tz, yaw, pitch, roll, fire: r % 5 === 0, missile: r % 29 === 0 });
          stepRun(w, s, code);
          if (i % 100 === 0) lines.push(`${recipe.id}/${steady ? 'steady' : 'free'}/${seed}/${i}: ${stateKey(s)}`);
        }
        lines.push(`${recipe.id}/${steady ? 'steady' : 'free'}/${seed}/end: ${stateKey(s)}`);
      }
    }
  }
  return lines.join('\n');
}

/** A short fingerprint of the report (FNV-1a), for the test and for quick comparison. */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
