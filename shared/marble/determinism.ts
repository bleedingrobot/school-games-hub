/**
 * A long, busy workload used to prove the physics gives bit-for-bit the same answers everywhere
 * (docs/MARBLE-PLAN.md, section 4). `determinismReport` plays odd, random-looking runs on every
 * course in both clock modes and writes down the whole state every 50 steps. The test pins the
 * text in Node; `scripts/marble-determinism.mjs` runs it in real WebKit and Chromium and compares.
 */
import { COURSES } from './courses';
import { makeWorld, newRun, stateKey, stepRun } from './engine';
import { BONUS, HOLD, REFUND } from './inputs';

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
  for (const course of COURSES) {
    for (const mode of ['up', 'down'] as const) {
      for (const seed of [7, 99]) {
        const next = lcg(seed);
        const w = makeWorld(course, { mode, openDoors: course.gates.map((g, i) => g.tunnels[(i + seed) % g.tunnels.length].door), rightGems: course.gemList.map((_, i) => i).filter((i) => (i + seed) % 2 === 0) });
        const s = newRun(w);
        let input = 0;
        let hold = 0;
        for (let i = 0; i < 3000 && s.outcome === 'running'; i++) {
          if (i % 20 === 0) input = next() % 9;
          const r = next() % 400;
          // Every so often: a held pause, a refund or a bonus, so those are covered too.
          const code = r === 0 ? REFUND : r === 2 ? BONUS : hold > 0 ? HOLD : input;
          if (r === 1) hold = 5;
          else if (hold > 0) hold--;
          stepRun(w, s, code);
          if (i % 50 === 0) lines.push(`${course.def.id}/${mode}/${seed}/${i}: ${stateKey(s)}`);
        }
        lines.push(`${course.def.id}/${mode}/${seed}/end: ${stateKey(s)}`);
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
