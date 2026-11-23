/**
 * The big-event schedule for one round, made from the round's seed, so the server always knows exactly when each event
 * happens (docs/SHOWDOWN-PLAN.md section 3). Phase changes come from the boss's health, the final 30 seconds from the
 * clock and the enrage button from the teacher, so they aren't in here.
 */
import { SHOWDOWN } from './config';

export type PlannedKind = 'wind_up' | 'weak_spot' | 'golden';
export interface Planned {
  /** Milliseconds from the start of the round. */
  at: number;
  kind: PlannedKind;
}

/** A small, good repeatable random number generator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole number from a seed and some text, for per-pupil randomness that doesn't depend on order. */
export function hashSeed(seed: number, text: string): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

const between = (r: () => number, [lo, hi]: readonly [number, number]) => Math.round(lo + r() * (hi - lo));

/** The round's events in time order: about one every 60 to 90 seconds, exactly one golden question, none near the end. */
export function makeSchedule(seed: number, lengthMin: number): Planned[] {
  const r = rng(hashSeed(seed, 'schedule'));
  const { firstMs, gapMs, quietEndMs, goldenAt } = SHOWDOWN.schedule;
  const lastAt = lengthMin * 60000 - quietEndMs - SHOWDOWN.golden.ms;
  const times: number[] = [];
  for (let at = between(r, firstMs); at <= lastAt; at += between(r, gapMs)) times.push(at);
  if (times.length === 0) return [];

  // The golden question takes the slot nearest a random point 40-70% of the way through.
  const goldenTarget = lengthMin * 60000 * (goldenAt[0] + r() * (goldenAt[1] - goldenAt[0]));
  let golden = 0;
  times.forEach((at, i) => { if (Math.abs(at - goldenTarget) < Math.abs(times[golden] - goldenTarget)) golden = i; });

  // The rest are wind-ups and weak spots, never three of a kind in a row, starting with a wind-up.
  const plan: Planned[] = [];
  let last: PlannedKind | null = null;
  let run = 0;
  for (let i = 0; i < times.length; i++) {
    let kind: PlannedKind;
    if (i === golden) kind = 'golden';
    else if (plan.every((p) => p.kind === 'golden')) kind = 'wind_up';
    else {
      kind = r() < 0.55 ? 'wind_up' : 'weak_spot';
      if (kind === last && run >= 2) kind = kind === 'wind_up' ? 'weak_spot' : 'wind_up';
    }
    if (kind !== 'golden') {
      run = kind === last ? run + 1 : 1;
      last = kind;
    }
    plan.push({ at: times[i], kind });
  }
  return plan;
}
