/**
 * What a teacher sees of a child's placing (docs/PIGEON-PLAN.md, section 7): from the last few challenges' first place taps,
 * how far off the child puts numbers on average, and whether big numbers sit too far along the line (a squashed line, where
 * 80 is put near 50). Worked out in the browser from the rounds and taps the teacher function returns.
 */
import { BIG_SHARE, SQUASH_PERCENT, TEACHER_TAPS } from './config';
import { replay, type Tap } from './play';
import type { Round } from './round';

export interface PlacingSummary {
  /** Place goes counted (the latest `TEACHER_TAPS`). */
  taps: number;
  /** Average distance from the number, as a percent of the line (0 to 100). Null with no place goes. */
  averageOff: number | null;
  /** Average signed error of the big numbers (over 70% of the line), as a percent of the line: positive is too far along. */
  bigOff: number | null;
  /** True when the big numbers are put well short of where they go (a squashed line). */
  squashed: boolean;
}

export function placingSummary(recent: readonly { round: Round; taps: readonly Tap[] }[]): PlacingSummary {
  const misses = recent.flatMap((r) => {
    try {
      return replay(r.round, r.taps).misses;
    } catch {
      return [];
    }
  }).slice(0, TEACHER_TAPS);
  if (!misses.length) return { taps: 0, averageOff: null, bigOff: null, squashed: false };
  const pct = (m: { off: number; max: number }) => (m.off / m.max) * 100;
  const averageOff = misses.reduce((t, m) => t + Math.abs(pct(m)), 0) / misses.length;
  const big = misses.filter((m) => m.n / m.max > BIG_SHARE);
  const bigOff = big.length ? big.reduce((t, m) => t + pct(m), 0) / big.length : null;
  return { taps: misses.length, averageOff, bigOff, squashed: bigOff !== null && big.length >= 2 && bigOff <= -SQUASH_PERCENT };
}
